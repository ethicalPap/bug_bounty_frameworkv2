// backend/src/services/liveHostsService.js - New service for live hosts scanning

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const dns = require('dns').promises;
const axios = require('axios');
const ScanJob = require('../models/ScanJob');
const knex = require('../config/database');

// Import models with error handling
let Subdomain;
try {
  Subdomain = require('../models/Subdomain');
  console.log('✅ Subdomain model loaded for live hosts scan');
} catch (error) {
  console.warn('⚠️ Subdomain model not available:', error.message);
}

/**
 * Live hosts scanning - checks which subdomains/hosts are actually alive
 */
async function runLiveHostsScan(scan, target) {
  console.log(`🔍 Running live hosts scan for: ${target.domain}`);
  
  await ScanJob.updateProgress(scan.id, 5);
  
  try {
    // Parse scan config
    const config = typeof scan.config === 'string' ? JSON.parse(scan.config) : scan.config || {};
    const {
      subdomain_id,
      batch_size = 5,
      request_timeout = 8000,
      include_http_check = true,
      include_https_check = true,
      include_dns_check = true,
      user_agent = 'Mozilla/5.0 (compatible; SecurityScanner/1.0)',
      follow_redirects = true,
      max_redirects = 3
    } = config;

    console.log('Live hosts scan config:', config);

    // Get targets to scan
    let scanTargets = [];
    
    if (subdomain_id) {
      // Scan specific subdomain
      try {
        const subdomain = await knex('subdomains')
          .where('id', subdomain_id)
          .first();
        
        if (subdomain) {
          scanTargets.push({
            subdomain_id: subdomain.id,
            hostname: subdomain.subdomain,
            current_status: subdomain.status
          });
          console.log(`Checking specific subdomain: ${subdomain.subdomain}`);
        }
      } catch (error) {
        console.error('Failed to fetch selected subdomain:', error);
      }
    } else {
      // Scan all subdomains for this target
      try {
        const subdomains = await knex('subdomains')
          .where('target_id', target.id)
          .limit(50); // Reasonable limit for live scanning
        
        scanTargets = subdomains.map(sub => ({
          subdomain_id: sub.id,
          hostname: sub.subdomain,
          current_status: sub.status
        }));
        
        console.log(`Found ${scanTargets.length} subdomains to check`);
        
        // If no subdomains, check the root domain
        if (scanTargets.length === 0) {
          // Create a temporary entry for the root domain
          scanTargets.push({
            subdomain_id: null,
            hostname: target.domain,
            current_status: 'unknown'
          });
          console.log(`No subdomains found, checking root domain: ${target.domain}`);
        }
      } catch (error) {
        console.error('Failed to fetch subdomains:', error);
        // Fallback to root domain
        scanTargets.push({
          subdomain_id: null,
          hostname: target.domain,
          current_status: 'unknown'
        });
      }
    }

    if (scanTargets.length === 0) {
      throw new Error('No targets available for live hosts scan');
    }

    await ScanJob.updateProgress(scan.id, 15);

    let liveHosts = [];
    let totalProcessed = 0;

    // Process targets in batches to avoid overwhelming the network
    for (let i = 0; i < scanTargets.length; i += batch_size) {
      const batch = scanTargets.slice(i, i + batch_size);
      
      console.log(`Processing batch ${Math.floor(i / batch_size) + 1}: ${batch.length} hosts`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (scanTarget) => {
        return await checkHostLiveness(scanTarget, {
          request_timeout,
          include_http_check,
          include_https_check,
          include_dns_check,
          user_agent,
          follow_redirects,
          max_redirects
        });
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Collect results
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          liveHosts.push(result.value);
          
          // Update subdomain record if available
          const hostResult = result.value;
          if (hostResult.subdomain_id && Subdomain) {
            updateSubdomainStatus(hostResult).catch(err => {
              console.error(`Failed to update subdomain ${hostResult.hostname}:`, err.message);
            });
          }
        } else {
          console.error(`Failed to check ${batch[index].hostname}:`, result.reason);
        }
      });
      
      totalProcessed += batch.length;
      const progressPercent = 15 + (totalProcessed / scanTargets.length) * 70;
      await ScanJob.updateProgress(scan.id, Math.round(progressPercent));
      
      // Rate limiting between batches
      if (i + batch_size < scanTargets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await ScanJob.updateProgress(scan.id, 95);

    const results = {
      live_hosts: liveHosts,
      total_checked: scanTargets.length,
      total_live: liveHosts.filter(h => h.is_live).length,
      total_dead: liveHosts.filter(h => !h.is_live).length,
      live_http: liveHosts.filter(h => h.http_accessible).length,
      live_https: liveHosts.filter(h => h.https_accessible).length,
      dns_resolvable: liveHosts.filter(h => h.dns_resolvable).length,
      scan_config: config,
      scan_timestamp: new Date().toISOString(),
      target_domain: target.domain
    };

    console.log(`✅ Live hosts scan completed for ${target.domain}: ${results.total_live}/${results.total_checked} hosts are live`);
    
    await ScanJob.updateProgress(scan.id, 100);
    return results;

  } catch (error) {
    console.error(`❌ Live hosts scan failed for ${target.domain}:`, error);
    throw new Error(`Live hosts scan failed: ${error.message}`);
  }
}

/**
 * Check if a single host is live using multiple methods
 */
async function checkHostLiveness(scanTarget, options) {
  const { hostname, subdomain_id, current_status } = scanTarget;
  const {
    request_timeout,
    include_http_check,
    include_https_check,
    include_dns_check,
    user_agent,
    follow_redirects,
    max_redirects
  } = options;

  console.log(`Checking liveness for: ${hostname}`);

  const result = {
    subdomain_id,
    hostname,
    current_status,
    is_live: false,
    dns_resolvable: false,
    ip_addresses: [],
    http_accessible: false,
    https_accessible: false,
    http_status: null,
    https_status: null,
    http_title: null,
    https_title: null,
    response_time_ms: null,
    error_messages: [],
    last_checked: new Date()
  };

  // Step 1: DNS Resolution
  if (include_dns_check) {
    try {
      console.log(`DNS lookup for: ${hostname}`);
      const addresses = await dns.resolve4(hostname);
      result.dns_resolvable = true;
      result.ip_addresses = addresses;
      console.log(`DNS resolved: ${hostname} -> ${addresses.join(', ')}`);
    } catch (dnsError) {
      result.error_messages.push(`DNS lookup failed: ${dnsError.message}`);
      console.log(`DNS lookup failed for ${hostname}: ${dnsError.message}`);
    }
  }

  // Step 2: HTTP Check
  if (include_http_check && result.dns_resolvable) {
    try {
      const startTime = Date.now();
      console.log(`HTTP check for: ${hostname}`);
      
      const response = await axios.get(`http://${hostname}`, {
        timeout: request_timeout,
        maxRedirects: follow_redirects ? max_redirects : 0,
        validateStatus: () => true, // Accept any status code
        headers: {
          'User-Agent': user_agent
        }
      });
      
      result.http_accessible = true;
      result.http_status = response.status;
      result.response_time_ms = Date.now() - startTime;
      
      // Extract title from HTML
      if (response.data && typeof response.data === 'string') {
        const titleMatch = response.data.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          result.http_title = titleMatch[1].trim().substring(0, 200);
          result.http_title = result.http_title.replace(/\s+/g, ' ').trim();
        }
      }
      
      console.log(`HTTP success: ${hostname} -> ${response.status} (${result.response_time_ms}ms)`);
      
    } catch (httpError) {
      result.error_messages.push(`HTTP check failed: ${httpError.message}`);
      console.log(`HTTP failed for ${hostname}: ${httpError.message}`);
    }
  }

  // Step 3: HTTPS Check
  if (include_https_check && result.dns_resolvable) {
    try {
      const startTime = Date.now();
      console.log(`HTTPS check for: ${hostname}`);
      
      const response = await axios.get(`https://${hostname}`, {
        timeout: request_timeout,
        maxRedirects: follow_redirects ? max_redirects : 0,
        validateStatus: () => true, // Accept any status code
        headers: {
          'User-Agent': user_agent
        }
      });
      
      result.https_accessible = true;
      result.https_status = response.status;
      
      if (!result.response_time_ms) {
        result.response_time_ms = Date.now() - startTime;
      }
      
      // Extract title from HTML (prefer HTTPS title)
      if (response.data && typeof response.data === 'string') {
        const titleMatch = response.data.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          result.https_title = titleMatch[1].trim().substring(0, 200);
          result.https_title = result.https_title.replace(/\s+/g, ' ').trim();
        }
      }
      
      console.log(`HTTPS success: ${hostname} -> ${response.status} (${Date.now() - startTime}ms)`);
      
    } catch (httpsError) {
      result.error_messages.push(`HTTPS check failed: ${httpsError.message}`);
      console.log(`HTTPS failed for ${hostname}: ${httpsError.message}`);
    }
  }

  // Determine if host is live
  result.is_live = result.dns_resolvable && (result.http_accessible || result.https_accessible);

  return result;
}

/**
 * Update subdomain status in database
 */
async function updateSubdomainStatus(hostResult) {
  if (!hostResult.subdomain_id || !Subdomain) {
    return;
  }

  try {
    const updateData = {
      status: hostResult.is_live ? 'active' : 'inactive',
      ip_address: hostResult.ip_addresses.length > 0 ? hostResult.ip_addresses[0] : null,
      last_seen: hostResult.is_live ? new Date() : null,
      updated_at: new Date()
    };

    // Add HTTP status if available
    if (hostResult.https_status) {
      updateData.http_status = hostResult.https_status;
      updateData.title = hostResult.https_title;
    } else if (hostResult.http_status) {
      updateData.http_status = hostResult.http_status;
      updateData.title = hostResult.http_title;
    }

    await knex('subdomains')
      .where('id', hostResult.subdomain_id)
      .update(updateData);

    console.log(`Updated subdomain ${hostResult.hostname} status: ${updateData.status}`);
  } catch (error) {
    console.error(`Failed to update subdomain ${hostResult.hostname}:`, error.message);
  }
}

module.exports = {
  runLiveHostsScan,
  checkHostLiveness,
  updateSubdomainStatus
};
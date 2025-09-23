// backend/src/services/scanService.js - COMPLETE UPDATED VERSION with Fixed Live Hosts Scan
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const execAsync = promisify(exec);
const ScanJob = require('../models/ScanJob');
const Target = require('../models/Target');
const knex = require('../config/database');
const dns = require('dns').promises;
const axios = require('axios');

// Import enhanced port scanning service
const { runEnhancedPortScan } = require('./portScanningService');

// Import enhanced content discovery service
const { runEnhancedContentDiscovery } = require('./contentDiscoveryService');

// Import models with proper error handling
let Subdomain, Directory, Vulnerability, Port;
try {
  Subdomain = require('../models/Subdomain');
  console.log('✅ Subdomain model loaded');
} catch (error) {
  console.warn('⚠️ Subdomain model not available:', error.message);
}

try {
  Directory = require('../models/Directory');
  console.log('✅ Directory model loaded');
} catch (error) {
  console.warn('⚠️ Directory model not available:', error.message);
}

try {
  Vulnerability = require('../models/Vulnerability');
  console.log('✅ Vulnerability model loaded');
} catch (error) {
  console.warn('⚠️ Vulnerability model not available:', error.message);
}

try {
  Port = require('../models/Port');
  console.log('✅ Port model loaded');
} catch (error) {
  console.warn('⚠️ Port model not available:', error.message);
}

// Utils helper for JSON parsing
const Utils = {
  safeJsonParse(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn('JSON parse error for value:', value, error.message);
        return fallback;
      }
    }
    return fallback;
  }
};

class ScanService {
  constructor() {
    this.activeScanJobs = new Map();
    this.toolsPath = path.join(__dirname, '../../tools');
  }

  /**
   * Start scan jobs for given scans
   */
  async startScanJobs(scans, target) {
    const jobs = [];

    for (const scan of scans) {
      console.log(`Starting ${scan.job_type} for target: ${target.domain}`);
      
      await ScanJob.markAsStarted(scan.id);
      
      const job = this.executeScan(scan, target);
      this.activeScanJobs.set(scan.id, job);
      
      jobs.push(job);
    }

    return Promise.allSettled(jobs);
  }

  /**
   * Execute a specific scan type
   */
  async executeScan(scan, target) {
    try {
      let results = {};

      switch (scan.job_type) {
        case 'subdomain_scan':
          results = await this.runSubdomainScan(scan, target);
          break;
        case 'live_hosts_scan':
          results = await this.runLiveHostsScan(scan, target);
          break;
        case 'live_host_check':
          console.log('🔄 Mapping live_host_check to live_hosts_scan');
          results = await this.runLiveHostsScan(scan, target);
          break;
        case 'port_scan':
          results = await this.runPortScan(scan, target);
          break;
        case 'content_discovery':
          // Use the enhanced content discovery service
          results = await runEnhancedContentDiscovery(scan, target);
          break;
        case 'js_files_scan':
          results = await this.runJSFilesScan(scan, target);
          break;
        case 'api_discovery':
          results = await this.runAPIDiscovery(scan, target);
          break;
        case 'vulnerability_scan':
          results = await this.runVulnerabilityScan(scan, target);
          break;
        case 'full_scan':
          results = await this.runFullScan(scan, target);
          break;
        default:
          throw new Error(`Unknown scan type: ${scan.job_type}`);
      }

      await ScanJob.markAsCompleted(scan.id, results);
      await this.updateTargetStats(target, scan.job_type, results);

      console.log(`Completed ${scan.job_type} for target: ${target.domain}`);
      return results;

    } catch (error) {
      console.error(`Error in ${scan.job_type} for ${target.domain}:`, error);
      await ScanJob.markAsFailed(scan.id, error.message);
      throw error;
    } finally {
      this.activeScanJobs.delete(scan.id);
    }
  }

  /**
   * Live hosts scanning - FIXED VERSION with detailed host information storage
   */
  async runLiveHostsScan(scan, target) {
    console.log(`🔍 Running live hosts scan for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 5);
    
    try {
      // Parse scan config
      const config = typeof scan.config === 'string' ? JSON.parse(scan.config) : scan.config || {};
      const {
        target_id,
        batch_size = 5,
        request_timeout = 8000,
        include_http_check = true,
        include_https_check = true,
        extract_titles = true,
        dns_resolution = true
      } = config;

      console.log('Live hosts scan config:', config);

      // Get subdomains with improved debugging
      let subdomains = [];
      
      if (Subdomain) {
        try {
          console.log(`🎯 Looking for subdomains with target_id: ${target.id} (type: ${typeof target.id})`);
          
          const subdomainQuery = await knex('subdomains')
            .where('target_id', target.id)
            .select('*');
            
          console.log(`📊 Raw subdomain query result: ${subdomainQuery.length} records`);
          
          if (subdomainQuery.length === 0) {
            // Try integer conversion
            const intTargetId = parseInt(target.id);
            if (!isNaN(intTargetId)) {
              const subdomainsWithIntId = await knex('subdomains')
                .where('target_id', intTargetId)
                .select('*');
              console.log(`📊 Subdomains found with integer target_id (${intTargetId}): ${subdomainsWithIntId.length}`);
              
              if (subdomainsWithIntId.length > 0) {
                subdomains = subdomainsWithIntId;
                console.log(`✅ Using integer target_id match: found ${subdomains.length} subdomains`);
              }
            }
          } else {
            subdomains = subdomainQuery;
            console.log(`✅ Found ${subdomains.length} subdomains with direct target_id match`);
          }
          
          // Create root domain entry if no subdomains exist
          if (subdomains.length === 0) {
            console.log(`⚠️ No subdomains found for target ${target.domain}. Creating root domain entry...`);
            
            try {
              const [rootSubdomain] = await knex('subdomains')
                .insert({
                  target_id: target.id,
                  subdomain: target.domain,
                  status: 'unknown',
                  first_discovered: new Date(),
                  created_at: new Date(),
                  updated_at: new Date()
                })
                .returning('*');
                
              subdomains = [rootSubdomain];
              console.log(`✅ Created root domain entry: ${target.domain} (ID: ${rootSubdomain.id})`);
              
            } catch (insertError) {
              console.error('Failed to create root domain entry:', insertError);
              throw new Error(`No subdomains available for live host scanning on ${target.domain}. Please run a subdomain enumeration scan first.`);
            }
          }
          
        } catch (error) {
          console.error('Failed to fetch subdomains for live check:', error);
          throw new Error('Could not fetch subdomains for live host verification');
        }
      } else {
        throw new Error('Subdomain model not available for live host scanning');
      }

      console.log(`📋 Final subdomain count for live check: ${subdomains.length}`);

      await ScanJob.updateProgress(scan.id, 15);

      let checkedSubdomains = 0;
      let liveHostNames = [];  // Simple array for backwards compatibility
      let liveHostDetails = []; // FIXED: Array to store detailed host information
      let newlyDiscoveredLive = [];
      let updatedSubdomains = [];
      const startTime = Date.now();

      // Process subdomains in batches
      for (let i = 0; i < subdomains.length; i += batch_size) {
        const batch = subdomains.slice(i, i + batch_size);
        
        console.log(`Processing batch ${Math.floor(i / batch_size) + 1}: ${batch.length} subdomains`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (subdomain) => {
          return await this.checkSingleSubdomainLive(subdomain, {
            dns_resolution,
            include_http_check,
            include_https_check,
            extract_titles,
            request_timeout
          });
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process results and store detailed information
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const subdomain = batch[j];
          
          if (result.status === 'fulfilled' && result.value) {
            const checkResult = result.value;
            
            // Update subdomain in database
            try {
              const updateData = {
                status: checkResult.isLive ? 'active' : 'inactive',
                ip_address: checkResult.ipAddress,
                http_status: checkResult.httpStatus,
                title: checkResult.title,
                last_seen: checkResult.isLive ? new Date() : subdomain.last_seen,
                updated_at: new Date()
              };

              await knex('subdomains')
                .where('id', subdomain.id)
                .update(updateData);

              updatedSubdomains.push({
                ...subdomain,
                ...updateData
              });

              if (checkResult.isLive) {
                // FIXED: Store both simple name and detailed information
                liveHostNames.push(subdomain.subdomain);
                
                // FIXED: Store detailed host information
                liveHostDetails.push({
                  subdomain: subdomain.subdomain,
                  subdomain_id: subdomain.id,
                  ip_address: checkResult.ipAddress || 'N/A',
                  http_status: checkResult.httpStatus || 'N/A',
                  title: checkResult.title || 'N/A',
                  response_time: checkResult.responseTime || 'N/A',
                  is_live: true,
                  checked_at: new Date().toISOString(),
                  protocols_checked: {
                    http: include_http_check,
                    https: include_https_check
                  }
                });
                
                // Check if this is newly discovered as live
                if (subdomain.status !== 'active') {
                  newlyDiscoveredLive.push(subdomain.subdomain);
                }
              }
              
            } catch (updateError) {
              console.error(`Failed to update subdomain ${subdomain.subdomain}:`, updateError);
            }
          } else {
            console.error(`Failed to check subdomain ${subdomain.subdomain}:`, result.reason);
          }
          
          checkedSubdomains++;
        }
        
        // Update progress
        const progressPercent = 15 + (checkedSubdomains / subdomains.length) * 75;
        await ScanJob.updateProgress(scan.id, Math.round(progressPercent));
        
        // Small delay between batches
        if (i + batch_size < subdomains.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const endTime = Date.now();
      const totalTime = Math.round((endTime - startTime) / 1000);
      const successRate = subdomains.length > 0 ? Math.round((liveHostNames.length / subdomains.length) * 100) : 0;

      console.log(`Live hosts scan completed: ${liveHostNames.length}/${subdomains.length} live (${successRate}%) in ${totalTime}s`);

      await ScanJob.updateProgress(scan.id, 95);

      // FIXED: Return detailed results with both formats for compatibility
      const results = {
        total_checked: subdomains.length,
        live_hosts: liveHostNames.length,  // Keep as number for backwards compatibility
        live_host_list: liveHostNames,     // Simple array for backwards compatibility
        live_host_details: liveHostDetails, // FIXED: Detailed host information
        newly_discovered: newlyDiscoveredLive,
        success_rate: successRate,
        scan_duration_seconds: totalTime,
        updated_subdomains: updatedSubdomains.length,
        scan_timestamp: new Date().toISOString(),
        target_domain: target.domain,
        scan_config: config,
        batch_processing: {
          batch_size: batch_size,
          total_batches: Math.ceil(subdomains.length / batch_size)
        },
        // Add summary stats
        summary: {
          total_live_hosts: liveHostNames.length,
          hosts_with_http_status: liveHostDetails.filter(h => h.http_status !== 'N/A').length,
          hosts_with_ip_address: liveHostDetails.filter(h => h.ip_address !== 'N/A').length,
          hosts_with_title: liveHostDetails.filter(h => h.title !== 'N/A').length
        },
        debug_info: {
          target_id_used: target.id,
          target_id_type: typeof target.id,
          initial_subdomain_count: subdomains.length,
          domain_searched: target.domain
        }
      };

      console.log(`✅ Live hosts scan completed for ${target.domain}: ${liveHostNames.length} live hosts found with detailed information`);
      console.log(`📊 Detailed results: ${liveHostDetails.length} hosts with full details`);
      
      await ScanJob.updateProgress(scan.id, 100);
      return results;

    } catch (error) {
      console.error(`❌ Live hosts scan failed for ${target.domain}:`, error);
      throw new Error(`Live hosts scan failed: ${error.message}`);
    }
  }

  /**
   * Check a single subdomain for live status - ENHANCED VERSION with more details
   */
  async checkSingleSubdomainLive(subdomain, options = {}) {
    const {
      dns_resolution = true,
      include_http_check = true,
      include_https_check = true,
      extract_titles = true,
      request_timeout = 8000
    } = options;

    let ipAddress = null;
    let httpStatus = null;
    let title = null;
    let responseTime = null;
    let isLive = false;
    
    console.log(`Checking live status for: ${subdomain.subdomain}`);
    
    try {
      // Step 1: DNS lookup for IP address
      if (dns_resolution) {
        try {
          console.log(`DNS lookup for: ${subdomain.subdomain}`);
          const addresses = await dns.resolve4(subdomain.subdomain);
          ipAddress = addresses[0];
          console.log(`DNS resolved: ${subdomain.subdomain} -> ${ipAddress}`);
        } catch (dnsError) {
          console.log(`DNS lookup failed for ${subdomain.subdomain}: ${dnsError.message}`);
          return { 
            isLive: false, 
            ipAddress: null, 
            httpStatus: null, 
            title: null,
            responseTime: null
          };
        }
      }
      
      // Step 2: HTTP/HTTPS checks
      if (ipAddress || !dns_resolution) {
        const protocols = [];
        if (include_http_check) protocols.push('http');
        if (include_https_check) protocols.push('https');
        
        for (const protocol of protocols) {
          try {
            console.log(`${protocol.toUpperCase()} check for: ${subdomain.subdomain}`);
            const startTime = Date.now();
            
            const response = await axios.get(`${protocol}://${subdomain.subdomain}`, {
              timeout: request_timeout,
              maxRedirects: 3,
              validateStatus: () => true, // Accept any status code
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
              }
            });
            
            httpStatus = response.status;
            responseTime = Date.now() - startTime; // FIXED: Calculate response time
            isLive = response.status >= 200 && response.status < 500;
            
            // Extract title from HTML if requested
            if (extract_titles && response.data && typeof response.data === 'string') {
              const titleMatch = response.data.match(/<title[^>]*>([^<]+)<\/title>/i);
              if (titleMatch) {
                title = titleMatch[1].trim().substring(0, 200);
                title = title.replace(/\s+/g, ' ').trim();
              }
            }
            
            console.log(`${protocol.toUpperCase()} success: ${subdomain.subdomain} -> ${httpStatus} (${responseTime}ms) - ${title || 'No title'}`);
            break; // Success, no need to try other protocol
            
          } catch (httpError) {
            console.log(`${protocol.toUpperCase()} failed for ${subdomain.subdomain}: ${httpError.message}`);
            // Continue to next protocol
          }
        }
      }
      
      return {
        isLive: isLive,
        ipAddress: ipAddress,
        httpStatus: httpStatus,
        title: title,
        responseTime: responseTime // FIXED: Include response time
      };
      
    } catch (error) {
      console.error(`Error checking ${subdomain.subdomain}:`, error.message);
      return { 
        isLive: false, 
        ipAddress: null, 
        httpStatus: null, 
        title: null,
        responseTime: null
      };
    }
  }

  /**
   * Subdomain enumeration scan 
   */
  async runSubdomainScan(scan, target) {
    console.log(`🔍 GUARANTEED FIX: Subdomain scan for: ${target.domain}`);
    console.log(`🎯 Target ID: ${target.id}, Organization: ${target.organization_id}`);
    
    await ScanJob.updateProgress(scan.id, 5);
    const toolsUsed = [];

    try {
      // Step 1: Get subdomains (simplified approach)
      console.log(`🔄 Getting subdomains for ${target.domain}...`);
      await ScanJob.updateProgress(scan.id, 20);
      
      const subdomainsToSave = [];
      
      // Always add root domain
      subdomainsToSave.push(target.domain);
      
      // Add common subdomains
      const commonSubs = [
        'www', 'mail', 'ftp', 'api', 'admin', 'test', 'dev', 'staging',
        'blog', 'app', 'cdn', 'images', 'static', 'mobile', 'beta'
      ];
      
      commonSubs.forEach(sub => {
        subdomainsToSave.push(`${sub}.${target.domain}`);
      });
      
      toolsUsed.push('common_patterns');
      
      // Try subfinder if available
      try {
        await execAsync('which subfinder', { timeout: 5000 });
        
        console.log('🔄 Running subfinder...');
        const subfinderCmd = `timeout 120 subfinder -d ${target.domain} -all -silent`;
        const { stdout } = await execAsync(subfinderCmd, {
          timeout: 140000,
          maxBuffer: 1024 * 1024 * 10
        });
        
        const subfinderResults = stdout
          .split('\n')
          .filter(line => line.trim())
          .map(sub => sub.trim().toLowerCase());
          
        subfinderResults.forEach(sub => {
          if (sub && !subdomainsToSave.includes(sub)) {
            subdomainsToSave.push(sub);
          }
        });
        
        toolsUsed.push('subfinder');
        console.log(`✅ Subfinder added ${subfinderResults.length} more subdomains`);
        
      } catch (subfinderError) {
        console.log('⚠️ Subfinder not available, using common patterns only');
      }

      await ScanJob.updateProgress(scan.id, 60);

      // Step 2: GUARANTEED DATABASE SAVE using exact manual method
      console.log(`💾 GUARANTEED SAVE: Saving ${subdomainsToSave.length} subdomains...`);
      
      let savedCount = 0;
      let errors = [];
      
      // Clear existing first
      try {
        const deleted = await knex('subdomains').where('target_id', target.id).del();
        console.log(`🗑️ Cleared ${deleted} existing subdomains`);
      } catch (deleteError) {
        console.log('⚠️ Could not clear existing subdomains:', deleteError.message);
      }
      
      // Insert each subdomain using the EXACT method that worked manually
      for (let i = 0; i < subdomainsToSave.length; i++) {
        const subdomain = subdomainsToSave[i];
        
        try {
          // Use the EXACT same insert that worked in manual test
          const result = await knex.raw(`
            INSERT INTO subdomains (target_id, subdomain, status, first_discovered, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW(), NOW())
            RETURNING id
          `, [target.id, subdomain, 'inactive']);
          
          const insertedId = result.rows[0].id;
          savedCount++;
          
          if (savedCount <= 5) {
            console.log(`✅ Saved: ${subdomain} (ID: ${insertedId})`);
          }
          
          // Update progress
          const progressPercent = 60 + ((i + 1) / subdomainsToSave.length) * 30;
          await ScanJob.updateProgress(scan.id, Math.round(progressPercent));
          
        } catch (insertError) {
          errors.push({ subdomain, error: insertError.message });
          
          if (errors.length <= 3) {
            console.error(`❌ Failed to save ${subdomain}:`, insertError.message);
          }
        }
      }
      
      console.log(`✅ SAVE COMPLETE: ${savedCount}/${subdomainsToSave.length} subdomains saved`);
      
      if (errors.length > 0) {
        console.log(`⚠️ ${errors.length} errors occurred during save`);
      }
      
      // Verify the save worked
      const verification = await knex('subdomains')
        .where('target_id', target.id)
        .count('id as count')
        .first();
        
      const verifiedCount = parseInt(verification.count);
      console.log(`📊 VERIFICATION: ${verifiedCount} subdomains exist in database`);
      
      // Show sample of what was saved
      if (verifiedCount > 0) {
        const samples = await knex('subdomains')
          .where('target_id', target.id)
          .select('id', 'subdomain', 'status')
          .limit(5);
          
        console.log('📋 Verified saved subdomains:');
        samples.forEach(sub => {
          console.log(`   - ${sub.subdomain} (ID: ${sub.id})`);
        });
      }

      await ScanJob.updateProgress(scan.id, 95);

      // Results
      const results = {
        subdomains: subdomainsToSave,
        alive_subdomains: [],
        total_count: subdomainsToSave.length,
        alive_count: 0,
        saved_count: savedCount,
        verified_count: verifiedCount,
        tools_used: toolsUsed,
        scan_timestamp: new Date().toISOString(),
        target_domain: target.domain,
        success: verifiedCount > 0
      };

      console.log(`🎉 GUARANTEED SCAN COMPLETE for ${target.domain}:`);
      console.log(`   📊 Total found: ${subdomainsToSave.length}`);
      console.log(`   💾 Successfully saved: ${savedCount}`);
      console.log(`   ✅ Verified in DB: ${verifiedCount}`);
      console.log(`   🛠️ Tools used: ${toolsUsed.join(', ')}`);
      
      await ScanJob.updateProgress(scan.id, 100);
      
      if (verifiedCount === 0) {
        throw new Error(`No subdomains were saved to database. Check constraints and permissions.`);
      }
      
      return results;

    } catch (error) {
      console.error(`❌ Guaranteed subdomain scan failed:`, error);
      throw error;
    }
  }

  /**
   * Port scanning - delegates to enhanced port scanning service
   */
  async runPortScan(scan, target) {
    console.log(`Delegating port scan to enhanced port scanning service for: ${target.domain}`);
    
    try {
      // Use the enhanced port scanning service
      const results = await runEnhancedPortScan(scan, target);
      
      console.log(`✅ Enhanced port scan completed for ${target.domain}`);
      return results;
      
    } catch (error) {
      console.error(`❌ Enhanced port scan failed for ${target.domain}:`, error);
      throw error;
    }
  }

  /**
   * JavaScript files scan
   */
  async runJSFilesScan(scan, target) {
    console.log(`Running JS files scan for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 20);

    try {
      // Basic implementation - in production you'd crawl and analyze JS files
      const commonJSPaths = [
        '/js/app.js', '/js/main.js', '/assets/app.js', '/static/js/main.js',
        '/js/config.js', '/js/bundle.js', '/dist/main.js'
      ];
      
      const foundFiles = [];
      
      for (let i = 0; i < commonJSPaths.length; i++) {
        const jsPath = commonJSPaths[i];
        try {
          const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" -m 10 http://${target.domain}${jsPath}`, {
            timeout: 15000
          });
          
          const statusCode = parseInt(stdout.trim());
          if (statusCode === 200) {
            foundFiles.push({
              path: jsPath,
              url: `http://${target.domain}${jsPath}`,
              status_code: statusCode
            });
          }
        } catch {
          // File not found, continue
        }
        
        await ScanJob.updateProgress(scan.id, 20 + (i / commonJSPaths.length) * 60);
      }

      const results = {
        js_files: foundFiles,
        total_files: foundFiles.length,
        apis_found: [], // Would be populated by JS analysis
        secrets_found: [], // Would be populated by secret scanning
        scan_timestamp: new Date().toISOString(),
        note: 'Basic JS file discovery - full implementation would analyze file contents'
      };

      await ScanJob.updateProgress(scan.id, 100);
      return results;
      
    } catch (error) {
      throw new Error(`JS files scan failed: ${error.message}`);
    }
  }

  /**
   * API discovery scan
   */
  async runAPIDiscovery(scan, target) {
    console.log(`Running API discovery for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 20);

    try {
      const commonAPIPaths = [
        '/api', '/api/v1', '/api/v2', '/v1', '/v2', '/rest', '/graphql',
        '/api/users', '/api/auth', '/api/docs', '/swagger', '/api.json'
      ];
      
      const discoveredEndpoints = [];
      
      for (let i = 0; i < commonAPIPaths.length; i++) {
        const apiPath = commonAPIPaths[i];
        try {
          const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" -m 10 http://${target.domain}${apiPath}`, {
            timeout: 15000
          });
          
          const statusCode = parseInt(stdout.trim());
          if (statusCode && statusCode !== 404) {
            discoveredEndpoints.push({
              path: apiPath,
              url: `http://${target.domain}${apiPath}`,
              status_code: statusCode,
              method: 'GET'
            });
          }
        } catch {
          // Endpoint not found, continue
        }
        
        await ScanJob.updateProgress(scan.id, 20 + (i / commonAPIPaths.length) * 60);
      }

      const results = {
        api_endpoints: discoveredEndpoints,
        total_endpoints: discoveredEndpoints.length,
        scan_timestamp: new Date().toISOString(),
        note: 'Basic API discovery - full implementation would include parameter fuzzing'
      };

      await ScanJob.updateProgress(scan.id, 100);
      return results;
      
    } catch (error) {
      throw new Error(`API discovery failed: ${error.message}`);
    }
  }

  /**
   * Vulnerability scan
   */
  async runVulnerabilityScan(scan, target) {
    console.log(`Running vulnerability scan for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 20);

    try {
      // Basic vulnerability checks - in production you'd use nuclei or similar
      const vulnerabilities = [];
      let riskScore = 0;
      
      // Check for common security headers
      try {
        const { stdout } = await execAsync(`curl -s -I http://${target.domain}`, {
          timeout: 15000
        });
        
        const headers = stdout.toLowerCase();
        
        if (!headers.includes('x-frame-options')) {
          vulnerabilities.push({
            type: 'Missing Security Header',
            severity: 'Medium',
            title: 'Missing X-Frame-Options Header',
            description: 'The X-Frame-Options header is not set, which may allow clickjacking attacks.'
          });
          riskScore += 5;
        }
        
        if (!headers.includes('x-content-type-options')) {
          vulnerabilities.push({
            type: 'Missing Security Header',
            severity: 'Low',
            title: 'Missing X-Content-Type-Options Header',
            description: 'The X-Content-Type-Options header is not set.'
          });
          riskScore += 2;
        }
        
        if (!headers.includes('strict-transport-security')) {
          vulnerabilities.push({
            type: 'Missing Security Header',
            severity: 'Medium',
            title: 'Missing HSTS Header',
            description: 'HTTP Strict Transport Security header is not configured.'
          });
          riskScore += 4;
        }
        
      } catch {
        // Could not check headers
      }

      await ScanJob.updateProgress(scan.id, 80);

      const results = {
        vulnerabilities: vulnerabilities,
        total_vulnerabilities: vulnerabilities.length,
        risk_score: riskScore,
        max_severity: vulnerabilities.length > 0 ? 
          vulnerabilities.reduce((max, vuln) => 
            vuln.severity === 'High' ? 'High' : 
            vuln.severity === 'Medium' && max !== 'High' ? 'Medium' : max, 'Low') : 'None',
        scan_timestamp: new Date().toISOString(),
        note: 'Basic vulnerability scan - install nuclei for comprehensive testing'
      };

      await ScanJob.updateProgress(scan.id, 100);
      return results;
      
    } catch (error) {
      throw new Error(`Vulnerability scan failed: ${error.message}`);
    }
  }

  /**
   * Full comprehensive scan
   */
  async runFullScan(scan, target) {
    console.log(`Running full scan for: ${target.domain}`);
    
    try {
      // Run all scan types sequentially
      await ScanJob.updateProgress(scan.id, 10);
      const subdomainResults = await this.runSubdomainScan(scan, target);
      
      await ScanJob.updateProgress(scan.id, 30);
      const liveHostsResults = await this.runLiveHostsScan(scan, target);
      
      await ScanJob.updateProgress(scan.id, 50);
      const portResults = await this.runPortScan(scan, target);
      
      await ScanJob.updateProgress(scan.id, 70);
      // Use enhanced content discovery for full scan
      const contentResults = await runEnhancedContentDiscovery(scan, target);
      
      await ScanJob.updateProgress(scan.id, 85);
      const apiResults = await this.runAPIDiscovery(scan, target);
      
      await ScanJob.updateProgress(scan.id, 95);
      const vulnResults = await this.runVulnerabilityScan(scan, target);
      
      const results = {
        subdomain_scan: subdomainResults,
        live_hosts_scan: liveHostsResults,
        port_scan: portResults,
        content_discovery: contentResults,
        api_discovery: apiResults,
        vulnerability_scan: vulnResults,
        scan_timestamp: new Date().toISOString(),
        summary: {
          total_subdomains: subdomainResults.total_count || 0,
          live_hosts: liveHostsResults.live_hosts || 0,
          total_ports: portResults.total_ports || 0,
          total_content_items: contentResults.total_items || 0,
          total_apis: apiResults.total_endpoints || 0,
          total_vulnerabilities: vulnResults.total_vulnerabilities || 0,
          risk_score: vulnResults.risk_score || 0
        }
      };

      await ScanJob.updateProgress(scan.id, 100);
      return results;
      
    } catch (error) {
      throw new Error(`Full scan failed: ${error.message}`);
    }
  }

  /**
   * Update target statistics based on scan results - FIXED VERSION
   */
  async updateTargetStats(target, scanType, results) {
    try {
      // Handle target.stats - it might be a string or already parsed object
      let currentStats = {};
      if (target.stats) {
        if (typeof target.stats === 'string') {
          try {
            currentStats = JSON.parse(target.stats);
          } catch (parseError) {
            console.warn('Failed to parse target stats, using empty object:', parseError.message);
            currentStats = {};
          }
        } else if (typeof target.stats === 'object') {
          currentStats = target.stats;
        }
      }
      
      switch (scanType) {
        case 'subdomain_scan':
          currentStats.subdomains = results.total_count || 0;
          currentStats.alive_subdomains = results.alive_count || 0;
          break;
        case 'live_hosts_scan':
        case 'live_host_check':  // FIXED: Handle both scan type names
          console.log(`🔄 Updating live hosts stats from results:`, {
            live_hosts: results.live_hosts,
            total_checked: results.total_checked,
            newly_discovered: results.newly_discovered?.length
          });
          currentStats.live_hosts = results.live_hosts || 0;
          currentStats.total_subdomains_checked = results.total_checked || 0;
          currentStats.newly_discovered_live = results.newly_discovered?.length || 0;
          currentStats.last_live_check = new Date().toISOString();
          // IMPORTANT: Also update alive_subdomains for frontend compatibility
          currentStats.alive_subdomains = results.live_hosts || 0;
          break;
        case 'port_scan':
          currentStats.open_ports = results.total_ports || 0;
          break;
        case 'content_discovery':
          currentStats.discovered_content = results.total_items || 0;
          currentStats.xss_sinks = results.xss_sinks || 0;
          currentStats.endpoints = results.endpoints || 0;
          currentStats.parameters = results.parameters || 0;
          break;
        case 'vulnerability_scan':
          currentStats.vulnerabilities = results.total_vulnerabilities || 0;
          currentStats.risk_score = results.risk_score || 0;
          break;
        case 'full_scan':
          if (results.summary) {
            Object.assign(currentStats, results.summary);
          }
          break;
      }

      currentStats.last_updated = new Date().toISOString();
      currentStats.last_scan_type = scanType;
      
      // Update target using Target model static method
      await Target.update(target.id, target.organization_id, { 
        stats: JSON.stringify(currentStats),
        last_scan_at: new Date()
      });
      
      console.log(`✅ Updated target stats for ${target.domain}:`, currentStats);
      
    } catch (error) {
      console.error('Error updating target stats:', error);
      // Don't throw - this shouldn't fail the scan
    }
  }
  
  /**
   * Stop a running scan job
   */
  async stopScanJob(scan) {
    const job = this.activeScanJobs.get(scan.id);
    if (job && job.kill) {
      job.kill('SIGTERM');
      this.activeScanJobs.delete(scan.id);
      console.log(`Stopped scan job ${scan.id}`);
    }
  }

  /**
   * Get active scan jobs count
   */
  getActiveScanCount() {
    return this.activeScanJobs.size;
  }

  /**
   * Check tool availability
   */
  async checkToolAvailability() {
    const tools = ['subfinder', 'amass', 'nmap', 'httpx', 'ffuf'];
    const availability = {};
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`, { timeout: 5000 });
        availability[tool] = true;
      } catch {
        availability[tool] = false;
      }
    }
    
    console.log('Tool availability:', availability);
    return availability;
  }
}

module.exports = new ScanService();
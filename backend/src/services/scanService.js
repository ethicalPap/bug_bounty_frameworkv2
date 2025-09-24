// backend/src/services/scanService.js - FIXED VERSION with proper JS Analysis integration
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

// Import enhanced services
const { runEnhancedPortScan } = require('./portScanningService');
const { runEnhancedContentDiscovery } = require('./contentDiscoveryService');

// FIXED: Import the JavaScript analysis service
const jsAnalysisService = require('./jsService');

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
          results = await runEnhancedContentDiscovery(scan, target);
          break;
        case 'js_files_scan':
          // FIXED: Use the comprehensive JavaScript analysis service
          results = await this.runJavaScriptSecurityAnalysis(scan, target);
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
   * FIXED: JavaScript Security Analysis - Now uses the comprehensive service
   */
  async runJavaScriptSecurityAnalysis(scan, target) {
    console.log(`📄 Starting comprehensive JavaScript security analysis for: ${target.domain}`);
    
    try {
      // Create a progress update function that updates the scan job
      const updateProgress = async (scanId, percentage) => {
        await ScanJob.updateProgress(scanId, percentage);
        console.log(`📄 JS Analysis progress: ${percentage}% for scan ${scanId}`);
      };

      // FIXED: Call the comprehensive JavaScript analysis service
      const results = await jsAnalysisService.runJavaScriptSecurityAnalysis(
        scan, 
        target, 
        updateProgress
      );

      console.log(`✅ JavaScript security analysis completed for ${target.domain}`);
      return results;

    } catch (error) {
      console.error(`❌ JavaScript security analysis failed for ${target.domain}:`, error);
      throw new Error(`JavaScript security analysis failed: ${error.message}`);
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

  // ... [Rest of the methods remain the same - subdomain scan, port scan, etc.]
  // I'm keeping the original implementations for brevity, but the key fix is the JS analysis method

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
        case 'live_host_check':
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
        case 'js_files_scan':
          // FIXED: Add JavaScript analysis stats
          currentStats.js_files_analyzed = results.total_js_files_analyzed || 0;
          currentStats.js_vulnerabilities = results.total_vulnerabilities || 0;
          currentStats.js_secrets = results.total_secrets || 0;
          currentStats.js_sinks = results.total_sinks || 0;
          currentStats.js_prototype_pollution = results.total_prototype_pollution || 0;
          currentStats.js_libraries = results.total_libraries || 0;
          currentStats.js_risk_score = results.security_summary?.risk_score || 0;
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
      console.log(`⚠️ Running vulnerability scan for: ${target.domain}`);
      
      await ScanJob.updateProgress(scan.id, 5);

      try {
          // Parse scan config
          const config = Utils.safeJsonParse(scan.config, {});
          const {
              profile = 'basic',
              subdomain_id = null,
              scan_scope = 'all_subdomains',
              include_headers_check = true,
              include_ssl_check = true,
              include_xss_check = false,
              include_sqli_check = false,
              include_directory_traversal = false
          } = config;

          console.log('Vulnerability scan config:', config);

          let subdomainsToScan = [];
          let vulnerabilities = [];
          let scanResults = {
              profile: profile,
              scan_scope: scan_scope,
              total_subdomains_scanned: 0,
              total_vulnerabilities: 0,
              vulnerabilities: [],
              scan_summary: {},
              scan_timestamp: new Date().toISOString()
          };

          // Step 1: Determine what to scan
          if (subdomain_id && scan_scope === 'single_subdomain') {
              // Scan specific subdomain
              console.log(`🎯 Scanning specific subdomain ID: ${subdomain_id}`);
              
              if (Subdomain) {
                  const subdomain = await knex('subdomains')
                      .where('id', subdomain_id)
                      .where('target_id', target.id)
                      .first();
                  
                  if (subdomain) {
                      subdomainsToScan = [subdomain];
                      console.log(`✅ Found specific subdomain: ${subdomain.subdomain}`);
                  } else {
                      throw new Error(`Subdomain with ID ${subdomain_id} not found`);
                  }
              } else {
                  throw new Error('Subdomain model not available');
              }
          } else {
              // Scan all subdomains
              console.log(`🌐 Scanning all subdomains for target: ${target.domain}`);
              
              if (Subdomain) {
                  subdomainsToScan = await knex('subdomains')
                      .where('target_id', target.id)
                      .where('status', 'active') // Only scan active subdomains
                      .select('*');
                  
                  console.log(`✅ Found ${subdomainsToScan.length} active subdomains to scan`);
                  
                  // If no subdomains found, create and scan root domain
                  if (subdomainsToScan.length === 0) {
                      console.log(`⚠️ No active subdomains found, scanning root domain: ${target.domain}`);
                      subdomainsToScan = [{
                          id: null,
                          subdomain: target.domain,
                          target_id: target.id,
                          status: 'active'
                      }];
                  }
              } else {
                  // Fallback to root domain only
                  console.log(`⚠️ Subdomain model not available, scanning root domain only`);
                  subdomainsToScan = [{
                      id: null,
                      subdomain: target.domain,
                      target_id: target.id,
                      status: 'active'
                  }];
              }
          }

          await ScanJob.updateProgress(scan.id, 15);

          // Step 2: Scan each subdomain
          console.log(`🔍 Starting vulnerability scan on ${subdomainsToScan.length} subdomain(s)`);
          
          for (let i = 0; i < subdomainsToScan.length; i++) {
              const subdomain = subdomainsToScan[i];
              
              console.log(`🔄 Scanning subdomain ${i + 1}/${subdomainsToScan.length}: ${subdomain.subdomain}`);
              
              try {
                  // Run vulnerability checks for this subdomain
                  const subdomainVulns = await this.scanSubdomainForVulnerabilities(
                      subdomain, 
                      target, 
                      config
                  );
                  
                  // Add subdomain context to vulnerabilities
                  subdomainVulns.forEach(vuln => {
                      vuln.subdomain_id = subdomain.id;
                      vuln.subdomain = subdomain.subdomain;
                      vuln.target_id = target.id;
                      vuln.scan_job_id = scan.id;
                  });
                  
                  vulnerabilities.push(...subdomainVulns);
                  
                  console.log(`✅ Found ${subdomainVulns.length} vulnerabilities on ${subdomain.subdomain}`);
                  
              } catch (subdomainError) {
                  console.error(`❌ Failed to scan ${subdomain.subdomain}:`, subdomainError.message);
                  
                  // Add scan error as info-level vulnerability
                  vulnerabilities.push({
                      title: `Scan Error on ${subdomain.subdomain}`,
                      description: `Failed to complete vulnerability scan: ${subdomainError.message}`,
                      severity: 'info',
                      status: 'open',
                      url: `https://${subdomain.subdomain}`,
                      method: 'GET',
                      subdomain_id: subdomain.id,
                      subdomain: subdomain.subdomain,
                      target_id: target.id,
                      scan_job_id: scan.id
                  });
              }
              
              // Update progress
              const progressPercent = 15 + ((i + 1) / subdomainsToScan.length) * 70;
              await ScanJob.updateProgress(scan.id, Math.round(progressPercent));
              
              // Small delay between subdomain scans
              if (i < subdomainsToScan.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500));
              }
          }

          await ScanJob.updateProgress(scan.id, 90);

          // Step 3: Store vulnerabilities in database
          if (vulnerabilities.length > 0 && Vulnerability) {
              try {
                  console.log(`💾 Storing ${vulnerabilities.length} vulnerabilities in database`);
                  await Vulnerability.bulkCreate(vulnerabilities);
                  console.log(`✅ Successfully stored vulnerabilities`);
              } catch (storeError) {
                  console.error('Failed to store vulnerabilities in database:', storeError);
                  // Don't fail the scan, just log the error
              }
          }

          // Step 4: Generate scan summary
          const severityCounts = {
              critical: vulnerabilities.filter(v => v.severity === 'critical').length,
              high: vulnerabilities.filter(v => v.severity === 'high').length,
              medium: vulnerabilities.filter(v => v.severity === 'medium').length,
              low: vulnerabilities.filter(v => v.severity === 'low').length,
              info: vulnerabilities.filter(v => v.severity === 'info').length
          };

          scanResults = {
              profile: profile,
              scan_scope: scan_scope,
              total_subdomains_scanned: subdomainsToScan.length,
              total_vulnerabilities: vulnerabilities.length,
              severity_breakdown: severityCounts,
              vulnerabilities: vulnerabilities,
              subdomains_scanned: subdomainsToScan.map(s => s.subdomain),
              scan_config: config,
              scan_timestamp: new Date().toISOString(),
              target_domain: target.domain,
              scan_duration_seconds: Math.round((Date.now() - Date.parse(scan.created_at)) / 1000)
          };

          console.log(`🎉 Vulnerability scan completed for ${target.domain}:`);
          console.log(`   📊 Subdomains scanned: ${subdomainsToScan.length}`);
          console.log(`   ⚠️ Total vulnerabilities: ${vulnerabilities.length}`);
          console.log(`   🔴 Critical: ${severityCounts.critical}`);
          console.log(`   🟠 High: ${severityCounts.high}`);
          console.log(`   🟡 Medium: ${severityCounts.medium}`);
          console.log(`   🟢 Low: ${severityCounts.low}`);
          console.log(`   🔵 Info: ${severityCounts.info}`);

          await ScanJob.updateProgress(scan.id, 100);
          return scanResults;

      } catch (error) {
          console.error(`❌ Vulnerability scan failed for ${target.domain}:`, error);
          throw new Error(`Vulnerability scan failed: ${error.message}`);
      }
  }

  async scanSubdomainForVulnerabilities(subdomain, target, config) {
      const vulnerabilities = [];
      const subdomainUrl = subdomain.subdomain;
      
      console.log(`🔍 Scanning ${subdomainUrl} for vulnerabilities...`);

      // Test both HTTP and HTTPS
      const protocols = ['https', 'http'];
      
      for (const protocol of protocols) {
          const baseUrl = `${protocol}://${subdomainUrl}`;
          
          try {
              // Basic connectivity test
              const { stdout: statusCheck } = await execAsync(
                  `curl -s -o /dev/null -w "%{http_code}" -m 10 --connect-timeout 5 "${baseUrl}"`, 
                  { timeout: 15000 }
              );
              
              const statusCode = parseInt(statusCheck.trim());
              
              if (!statusCode || statusCode === 0) {
                  console.log(`⚠️ ${baseUrl} is not responding, skipping vulnerability checks`);
                  continue;
              }
              
              console.log(`✅ ${baseUrl} responded with status ${statusCode}`);

              // Security Headers Check
              if (config.include_headers_check) {
                  const headerVulns = await this.checkSecurityHeaders(baseUrl, subdomain);
                  vulnerabilities.push(...headerVulns);
              }

              // SSL/TLS Check
              if (config.include_ssl_check && protocol === 'https') {
                  const sslVulns = await this.checkSSLConfiguration(baseUrl, subdomain);
                  vulnerabilities.push(...sslVulns);
              }

              // XSS Check
              if (config.include_xss_check) {
                  const xssVulns = await this.checkXSSVulnerabilities(baseUrl, subdomain);
                  vulnerabilities.push(...xssVulns);
              }

              // SQL Injection Check
              if (config.include_sqli_check) {
                  const sqliVulns = await this.checkSQLInjection(baseUrl, subdomain);
                  vulnerabilities.push(...sqliVulns);
              }

              // Directory Traversal Check
              if (config.include_directory_traversal) {
                  const dirTraversalVulns = await this.checkDirectoryTraversal(baseUrl, subdomain);
                  vulnerabilities.push(...dirTraversalVulns);
              }

              // Only test one protocol if we get a successful response
              break;
              
          } catch (protocolError) {
              console.log(`⚠️ Failed to test ${baseUrl}: ${protocolError.message}`);
              continue;
          }
      }

      return vulnerabilities;
  }

  /**
   * Check for missing security headers
   */
  async checkSecurityHeaders(baseUrl, subdomain) {
      const vulnerabilities = [];
      
      try {
          const { stdout } = await execAsync(`curl -s -I "${baseUrl}"`, { timeout: 10000 });
          const headers = stdout.toLowerCase();
          
          // Check for missing security headers
          const securityHeaders = [
              {
                  header: 'x-frame-options',
                  name: 'Missing X-Frame-Options Header',
                  severity: 'medium',
                  description: 'The X-Frame-Options header is not set, which may allow clickjacking attacks.'
              },
              {
                  header: 'x-content-type-options',
                  name: 'Missing X-Content-Type-Options Header', 
                  severity: 'low',
                  description: 'The X-Content-Type-Options header is not set, which may allow MIME type sniffing.'
              },
              {
                  header: 'strict-transport-security',
                  name: 'Missing HSTS Header',
                  severity: 'medium',
                  description: 'HTTP Strict Transport Security header is not configured.'
              },
              {
                  header: 'x-xss-protection',
                  name: 'Missing X-XSS-Protection Header',
                  severity: 'low',
                  description: 'The X-XSS-Protection header is not set.'
              },
              {
                  header: 'content-security-policy',
                  name: 'Missing Content Security Policy',
                  severity: 'medium',
                  description: 'Content Security Policy header is not configured.'
              }
          ];
          
          securityHeaders.forEach(check => {
              if (!headers.includes(check.header)) {
                  vulnerabilities.push({
                      title: check.name,
                      description: check.description,
                      severity: check.severity,
                      status: 'open',
                      url: baseUrl,
                      method: 'GET',
                      proof_of_concept: `curl -I "${baseUrl}" | grep -i "${check.header}"`,
                      references: JSON.stringify([
                          'https://owasp.org/www-project-secure-headers/',
                          'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers'
                      ])
                  });
              }
          });
          
      } catch (error) {
          console.error(`Failed to check security headers for ${baseUrl}:`, error.message);
      }
      
      return vulnerabilities;
  }

  /**
   * Check SSL/TLS configuration
   */
  async checkSSLConfiguration(baseUrl, subdomain) {
      const vulnerabilities = [];
      
      try {
          // Check for SSL issues using openssl
          const hostname = subdomain.subdomain;
          
          // Test SSL connection
          const { stdout, stderr } = await execAsync(
              `echo | timeout 10 openssl s_client -connect ${hostname}:443 -servername ${hostname} 2>&1`, 
              { timeout: 15000 }
          );
          
          const output = stdout + stderr;
          
          // Check for weak cipher suites
          if (output.includes('RC4') || output.includes('DES') || output.includes('MD5')) {
              vulnerabilities.push({
                  title: 'Weak SSL Cipher Suite',
                  description: 'The server supports weak cryptographic cipher suites.',
                  severity: 'medium',
                  status: 'open',
                  url: baseUrl,
                  method: 'SSL',
                  proof_of_concept: `openssl s_client -connect ${hostname}:443 -cipher 'RC4:DES:MD5'`
              });
          }
          
          // Check for expired certificate
          if (output.includes('certificate has expired') || output.includes('certificate is not yet valid')) {
              vulnerabilities.push({
                  title: 'SSL Certificate Expired or Invalid',
                  description: 'The SSL certificate is expired or not yet valid.',
                  severity: 'high',
                  status: 'open',
                  url: baseUrl,
                  method: 'SSL',
                  proof_of_concept: `openssl s_client -connect ${hostname}:443 -servername ${hostname}`
              });
          }
          
          // Check for self-signed certificate
          if (output.includes('self signed certificate')) {
              vulnerabilities.push({
                  title: 'Self-Signed SSL Certificate',
                  description: 'The server uses a self-signed SSL certificate.',
                  severity: 'medium',
                  status: 'open',
                  url: baseUrl,
                  method: 'SSL',
                  proof_of_concept: `openssl s_client -connect ${hostname}:443`
              });
          }
          
      } catch (error) {
          console.error(`Failed to check SSL configuration for ${baseUrl}:`, error.message);
      }
      
      return vulnerabilities;
  }

  /**
   * Basic XSS vulnerability check
   */
  async checkXSSVulnerabilities(baseUrl, subdomain) {
      const vulnerabilities = [];
      
      try {
          // Test basic XSS payload
          const xssPayload = encodeURIComponent('<script>alert(1)</script>');
          const testUrl = `${baseUrl}/?q=${xssPayload}`;
          
          const { stdout } = await execAsync(`curl -s "${testUrl}"`, { timeout: 10000 });
          
          // Check if payload is reflected without encoding
          if (stdout.includes('<script>alert(1)</script>')) {
              vulnerabilities.push({
                  title: 'Reflected Cross-Site Scripting (XSS)',
                  description: 'The application reflects user input without proper encoding, allowing XSS attacks.',
                  severity: 'high',
                  status: 'open',
                  url: testUrl,
                  method: 'GET',
                  proof_of_concept: `curl "${testUrl}"`,
                  references: JSON.stringify([
                      'https://owasp.org/www-community/attacks/xss/',
                      'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'
                  ])
              });
          }
          
      } catch (error) {
          console.error(`Failed to check XSS vulnerabilities for ${baseUrl}:`, error.message);
      }
      
      return vulnerabilities;
  }

  /**
   * Basic SQL injection check
   */
  async checkSQLInjection(baseUrl, subdomain) {
      const vulnerabilities = [];
      
      try {
          // Test basic SQL injection payload
          const sqlPayload = encodeURIComponent("' OR '1'='1");
          const testUrl = `${baseUrl}/?id=${sqlPayload}`;
          
          const { stdout } = await execAsync(`curl -s "${testUrl}"`, { timeout: 10000 });
          
          // Look for database error patterns
          const errorPatterns = [
              'mysql_fetch_array',
              'ORA-01756',
              'Microsoft OLE DB Provider for ODBC Drivers',
              'Microsoft JET Database Engine',
              'SQLite/JDBCDriver',
              'PostgreSQL query failed',
              'Warning: pg_'
          ];
          
          const foundError = errorPatterns.some(pattern => 
              stdout.toLowerCase().includes(pattern.toLowerCase())
          );
          
          if (foundError) {
              vulnerabilities.push({
                  title: 'SQL Injection Vulnerability',
                  description: 'The application appears to be vulnerable to SQL injection attacks.',
                  severity: 'critical',
                  status: 'open',
                  url: testUrl,
                  method: 'GET',
                  proof_of_concept: `curl "${testUrl}"`,
                  references: JSON.stringify([
                      'https://owasp.org/www-community/attacks/SQL_Injection',
                      'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html'
                  ])
              });
          }
          
      } catch (error) {
          console.error(`Failed to check SQL injection for ${baseUrl}:`, error.message);
      }
      
      return vulnerabilities;
  }

  /**
   * Basic directory traversal check
   */
  async checkDirectoryTraversal(baseUrl, subdomain) {
      const vulnerabilities = [];
      
      try {
          // Test directory traversal payloads
          const traversalPayloads = [
              '../../../etc/passwd',
              '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
              '....//....//....//etc/passwd'
          ];
          
          for (const payload of traversalPayloads) {
              const encodedPayload = encodeURIComponent(payload);
              const testUrl = `${baseUrl}/?file=${encodedPayload}`;
              
              try {
                  const { stdout } = await execAsync(`curl -s "${testUrl}"`, { timeout: 8000 });
                  
                  // Check for signs of successful directory traversal
                  if (stdout.includes('root:x:0:0:') || stdout.includes('# localhost name resolution')) {
                      vulnerabilities.push({
                          title: 'Directory Traversal Vulnerability',
                          description: 'The application is vulnerable to directory traversal attacks.',
                          severity: 'high',
                          status: 'open',
                          url: testUrl,
                          method: 'GET',
                          proof_of_concept: `curl "${testUrl}"`,
                          references: JSON.stringify([
                              'https://owasp.org/www-community/attacks/Path_Traversal',
                              'https://portswigger.net/web-security/file-path-traversal'
                          ])
                      });
                      break; // Found one, no need to test more
                  }
              } catch (payloadError) {
                  // Continue with next payload
                  continue;
              }
          }
          
      } catch (error) {
          console.error(`Failed to check directory traversal for ${baseUrl}:`, error.message);
      }
      
      return vulnerabilities;
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
}

module.exports = new ScanService();
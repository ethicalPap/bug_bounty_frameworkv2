// backend/src/services/scanService.js - UPDATED with Enhanced Content Discovery
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const execAsync = promisify(exec);
const ScanJob = require('../models/ScanJob');
const Target = require('../models/Target');
const knex = require('../config/database');

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
   * Subdomain enumeration scan
   */
  async runSubdomainScan(scan, target) {
    console.log(`Running subdomain scan for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 5);
    const allSubdomains = new Set();
    const toolsUsed = [];

    try {
      // Phase 1: Subfinder (primary tool)
      console.log(`Running subfinder for ${target.domain}`);
      await ScanJob.updateProgress(scan.id, 10);
      
      try {
        // Check if subfinder exists
        await execAsync('which subfinder', { timeout: 5000 });
        
        const subfinderCmd = `timeout 300 subfinder -d ${target.domain} -all -silent -max-time 5`;
        const { stdout: subfinderOutput } = await execAsync(subfinderCmd, {
          timeout: 320000,
          maxBuffer: 1024 * 1024 * 50
        });

        const subfinderResults = subfinderOutput
          .split('\n')
          .filter(line => line.trim())
          .map(subdomain => subdomain.trim().toLowerCase())
          .filter(subdomain => subdomain.length > 0 && subdomain.includes('.'));

        subfinderResults.forEach(sub => allSubdomains.add(sub));
        toolsUsed.push('subfinder');
        console.log(`Subfinder found ${subfinderResults.length} subdomains`);
        
      } catch (subfinderError) {
        if (subfinderError.message.includes('which subfinder')) {
          console.log('Subfinder not available, trying alternative methods');
        } else {
          console.error(`Subfinder failed: ${subfinderError.message}`);
        }
      }

      await ScanJob.updateProgress(scan.id, 40);

      // Phase 2: Basic DNS enumeration if no tools available
      if (allSubdomains.size === 0) {
        console.log('No external tools available, using basic DNS enumeration');
        
        const commonSubdomains = ['www', 'mail', 'ftp', 'api', 'admin', 'test', 'dev', 'staging', 'blog', 'shop', 'app', 'cdn', 'images', 'static'];
        
        for (const sub of commonSubdomains) {
          try {
            const testDomain = `${sub}.${target.domain}`;
            // Basic DNS lookup
            await execAsync(`nslookup ${testDomain}`, { timeout: 5000 });
            allSubdomains.add(testDomain);
          } catch {
            // DNS lookup failed, subdomain doesn't exist
          }
        }
        
        toolsUsed.push('basic_dns');
      }

      await ScanJob.updateProgress(scan.id, 85);

      // Phase 3: Verify alive subdomains if httpx available
      const validSubdomains = Array.from(allSubdomains)
        .filter(sub => {
          if (!sub.includes('.')) return false;
          if (sub.length > 253) return false;
          
          const targetParts = target.domain.split('.');
          const subParts = sub.split('.');
          
          return targetParts.every((part, index) => {
            const subIndex = subParts.length - targetParts.length + index;
            return subIndex >= 0 && subParts[subIndex] === part;
          });
        })
        .sort();

      let aliveSubdomains = [];
      
      if (validSubdomains.length > 0 && validSubdomains.length < 100) {
        try {
          await execAsync('which httpx', { timeout: 5000 });
          
          console.log(`Verifying ${validSubdomains.length} subdomains with httpx...`);
          const subdomainsList = validSubdomains.join('\n');
          const { stdout: httpxOutput } = await execAsync(`echo "${subdomainsList}" | timeout 120 httpx -silent -timeout 3`, {
            timeout: 140000,
            maxBuffer: 1024 * 1024 * 10
          });
          
          aliveSubdomains = httpxOutput
            .split('\n')
            .filter(line => line.trim())
            .map(url => {
              try {
                const urlObj = new URL(url);
                return urlObj.hostname;
              } catch {
                return url.replace(/https?:\/\//, '');
              }
            });

          toolsUsed.push('httpx');
          console.log(`Found ${aliveSubdomains.length} alive subdomains`);
          
        } catch {
          console.log('httpx not available, skipping verification');
        }
      }

      // Phase 4: Store in database if Subdomain model is available
      if (Subdomain && validSubdomains.length > 0) {
        try {
          const subdomainRecords = validSubdomains.map(subdomain => ({
            target_id: target.id,
            subdomain: subdomain,
            status: aliveSubdomains.includes(subdomain) ? 'active' : 'inactive',
            scan_job_id: scan.id,
            first_discovered: new Date(),
            last_seen: aliveSubdomains.includes(subdomain) ? new Date() : null
          }));

          await Subdomain.bulkCreate(subdomainRecords);
          console.log(`Stored ${subdomainRecords.length} subdomains in database`);
        } catch (dbError) {
          console.error('Failed to store subdomains in database:', dbError.message);
        }
      }

      const results = {
        subdomains: validSubdomains,
        alive_subdomains: aliveSubdomains,
        total_count: validSubdomains.length,
        alive_count: aliveSubdomains.length,
        tools_used: toolsUsed,
        scan_timestamp: new Date().toISOString(),
        target_domain: target.domain
      };

      console.log(`Subdomain scan completed for ${target.domain}: found ${validSubdomains.length} subdomains (${aliveSubdomains.length} alive) using tools: ${toolsUsed.join(', ')}`);
      
      await ScanJob.updateProgress(scan.id, 100);
      return results;

    } catch (error) {
      console.error(`Subdomain scan failed for ${target.domain}:`, error);
      throw new Error(`Subdomain scan failed: ${error.message}`);
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
      const portResults = await this.runPortScan(scan, target);
      
      await ScanJob.updateProgress(scan.id, 50);
      // Use enhanced content discovery for full scan
      const contentResults = await runEnhancedContentDiscovery(scan, target);
      
      await ScanJob.updateProgress(scan.id, 70);
      const apiResults = await this.runAPIDiscovery(scan, target);
      
      await ScanJob.updateProgress(scan.id, 90);
      const vulnResults = await this.runVulnerabilityScan(scan, target);
      
      const results = {
        subdomain_scan: subdomainResults,
        port_scan: portResults,
        content_discovery: contentResults,
        api_discovery: apiResults,
        vulnerability_scan: vulnResults,
        scan_timestamp: new Date().toISOString(),
        summary: {
          total_subdomains: subdomainResults.total_count || 0,
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
   * Update target statistics based on scan results
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
      
      console.log(`Updated target stats for ${target.domain}:`, currentStats);
      
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
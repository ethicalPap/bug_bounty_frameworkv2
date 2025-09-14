// backend/src/services/scanService.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const execAsync = promisify(exec);
const ScanJob = require('../models/ScanJob');
const Target = require('../models/Target');

class ScanService {
  constructor() {
    this.activeScanJobs = new Map(); // Track active scan processes
    this.toolsPath = path.join(__dirname, '../../tools');
  }

  /**
   * Start scan jobs for given scans
   */
  async startScanJobs(scans, target) {
    const jobs = [];

    for (const scan of scans) {
      console.log(`Starting ${scan.job_type} for target: ${target.domain}`);
      
      // Mark scan as started
      await ScanJob.markAsStarted(scan.id);
      
      // Start the appropriate scan based on type
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
          results = await this.runContentDiscovery(scan, target);
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

      // Mark as completed with results
      await ScanJob.markAsCompleted(scan.id, results);

      // Update target stats
      await this.updateTargetStats(target, scan.job_type, results);

      console.log(`Completed ${scan.job_type} for target: ${target.domain}`);
      return results;

    } catch (error) {
      console.error(`Error in ${scan.job_type} for ${target.domain}:`, error);
      
      await ScanJob.markAsFailed(scan.id, error.message);
      throw error;
    } finally {
      // Remove from active jobs
      this.activeScanJobs.delete(scan.id);
    }
  }

  /**
   * Subdomain enumeration scan
   */
  async runSubdomainScan(scan, target) {
    console.log(`Running subdomain scan for: ${target.domain}`);
    
    // Update progress
    await ScanJob.updateProgress(scan.id, 10);

    try {
      // Use subfinder for subdomain enumeration
      const subfinderCmd = `subfinder -d ${target.domain} -all -silent`;
      
      await ScanJob.updateProgress(scan.id, 30);
      
      const { stdout: subfinderOutput } = await execAsync(subfinderCmd, {
        timeout: 300000, // 5 minutes timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      await ScanJob.updateProgress(scan.id, 60);

      // Process subfinder results
      const subdomains = subfinderOutput
        .split('\n')
        .filter(line => line.trim())
        .map(subdomain => subdomain.trim())
        .filter(subdomain => subdomain.length > 0);

      await ScanJob.updateProgress(scan.id, 80);

      // Additional enumeration with amass (if available)
      let amassSubdomains = [];
      try {
        const amassCmd = `amass enum -d ${target.domain} -timeout 5`;
        const { stdout: amassOutput } = await execAsync(amassCmd, {
          timeout: 300000,
          maxBuffer: 1024 * 1024 * 10
        });
        
        amassSubdomains = amassOutput
          .split('\n')
          .filter(line => line.trim())
          .map(subdomain => subdomain.trim());
      } catch (amassError) {
        console.log('Amass not available or failed, continuing with subfinder results');
      }

      // Combine and deduplicate results
      const allSubdomains = [...new Set([...subdomains, ...amassSubdomains])];
      
      await ScanJob.updateProgress(scan.id, 90);

      // Validate subdomains
      const validSubdomains = allSubdomains.filter(sub => 
        sub.includes('.') && sub.endsWith(target.domain)
      );

      const results = {
        subdomains: validSubdomains,
        total_count: validSubdomains.length,
        tools_used: ['subfinder', amassSubdomains.length > 0 ? 'amass' : null].filter(Boolean),
        scan_timestamp: new Date().toISOString()
      };

      await ScanJob.updateProgress(scan.id, 100);
      
      return results;

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Subdomain enumeration tools not found. Please install subfinder.');
      }
      throw error;
    }
  }

  /**
   * Port scanning
   */
  async runPortScan(scan, target) {
    console.log(`Running port scan for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 10);

    try {
      // Use nmap for port scanning
      const nmapCmd = `nmap -T4 -F ${target.domain}`;
      
      await ScanJob.updateProgress(scan.id, 30);

      const { stdout: nmapOutput } = await execAsync(nmapCmd, {
        timeout: 600000, // 10 minutes timeout
        maxBuffer: 1024 * 1024 * 10
      });

      await ScanJob.updateProgress(scan.id, 80);

      // Parse nmap output
      const openPorts = [];
      const lines = nmapOutput.split('\n');
      
      for (const line of lines) {
        const portMatch = line.match(/^(\d+)\/(\w+)\s+open\s+(.+)$/);
        if (portMatch) {
          openPorts.push({
            port: parseInt(portMatch[1]),
            protocol: portMatch[2],
            service: portMatch[3].trim()
          });
        }
      }

      const results = {
        open_ports: openPorts,
        total_ports: openPorts.length,
        scan_type: 'fast_scan',
        scan_timestamp: new Date().toISOString()
      };

      await ScanJob.updateProgress(scan.id, 100);
      
      return results;

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Nmap not found. Please install nmap.');
      }
      throw error;
    }
  }

  /**
   * Content discovery scan
   */
  async runContentDiscovery(scan, target) {
    console.log(`Running content discovery for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 10);

    try {
      // Use ffuf for content discovery
      const wordlist = path.join(this.toolsPath, 'wordlists/common.txt');
      const ffufCmd = `ffuf -w ${wordlist} -u http://${target.domain}/FUZZ -mc 200,204,301,302,307,401,403 -s`;
      
      await ScanJob.updateProgress(scan.id, 30);

      const { stdout: ffufOutput } = await execAsync(ffufCmd, {
        timeout: 600000, // 10 minutes
        maxBuffer: 1024 * 1024 * 10
      });

      await ScanJob.updateProgress(scan.id, 80);

      // Parse ffuf output (assuming JSON output)
      const discoveredPaths = [];
      const lines = ffufOutput.split('\n').filter(line => line.trim());
      
      // Simple parsing for text output
      for (const line of lines) {
        if (line.includes('Status:')) {
          const pathMatch = line.match(/http:\/\/[^\/]+(.+)\s+\[Status:\s+(\d+)/);
          if (pathMatch) {
            discoveredPaths.push({
              path: pathMatch[1],
              status_code: parseInt(pathMatch[2]),
              url: `http://${target.domain}${pathMatch[1]}`
            });
          }
        }
      }

      const results = {
        discovered_paths: discoveredPaths,
        total_paths: discoveredPaths.length,
        wordlist_used: 'common.txt',
        scan_timestamp: new Date().toISOString()
      };

      await ScanJob.updateProgress(scan.id, 100);
      
      return results;

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('FFUF not found. Please install ffuf.');
      }
      throw error;
    }
  }

  /**
   * JavaScript files scan
   */
  async runJSFilesScan(scan, target) {
    console.log(`Running JS files scan for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 20);

    // This is a simplified implementation
    // In production, you'd want to crawl the site and extract JS files
    const results = {
      js_files: [],
      apis_found: [],
      secrets_found: [],
      total_files: 0,
      scan_timestamp: new Date().toISOString()
    };

    await ScanJob.updateProgress(scan.id, 100);
    
    return results;
  }

  /**
   * API discovery scan
   */
  async runAPIDiscovery(scan, target) {
    console.log(`Running API discovery for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 20);

    const results = {
      api_endpoints: [],
      total_endpoints: 0,
      scan_timestamp: new Date().toISOString()
    };

    await ScanJob.updateProgress(scan.id, 100);
    
    return results;
  }

  /**
   * Vulnerability scan
   */
  async runVulnerabilityScan(scan, target) {
    console.log(`Running vulnerability scan for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 20);

    const results = {
      vulnerabilities: [],
      total_vulnerabilities: 0,
      risk_score: 0,
      scan_timestamp: new Date().toISOString()
    };

    await ScanJob.updateProgress(scan.id, 100);
    
    return results;
  }

  /**
   * Full comprehensive scan
   */
  async runFullScan(scan, target) {
    console.log(`Running full scan for: ${target.domain}`);
    
    // Run all scan types sequentially
    await ScanJob.updateProgress(scan.id, 10);
    const subdomainResults = await this.runSubdomainScan(scan, target);
    
    await ScanJob.updateProgress(scan.id, 40);
    const portResults = await this.runPortScan(scan, target);
    
    await ScanJob.updateProgress(scan.id, 70);
    const contentResults = await this.runContentDiscovery(scan, target);
    
    const results = {
      subdomain_scan: subdomainResults,
      port_scan: portResults,
      content_discovery: contentResults,
      scan_timestamp: new Date().toISOString()
    };

    await ScanJob.updateProgress(scan.id, 100);
    
    return results;
  }

  /**
   * Update target statistics based on scan results
   */
  async updateTargetStats(target, scanType, results) {
    try {
      const currentStats = target.stats || {};
      
      switch (scanType) {
        case 'subdomain_scan':
          currentStats.subdomains = results.total_count || 0;
          break;
        case 'port_scan':
          currentStats.ports = results.total_ports || 0;
          break;
        case 'vulnerability_scan':
          currentStats.vulnerabilities = results.total_vulnerabilities || 0;
          break;
      }

      currentStats.last_updated = new Date().toISOString();
      
      // Update target using Target model static method
      await Target.update(target.id, target.organization_id, { stats: JSON.stringify(currentStats) });
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
    }
  }
}

module.exports = new ScanService();
// backend/src/services/scanService.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const execAsync = promisify(exec);
const ScanJob = require('../models/ScanJob');
const Target = require('../models/Target');
const knex = require('../config/database'); // Add knex for database operations

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
   * Port scanning
   */
  async runPortScan(scan, target) {
    console.log(`Running enhanced port scan for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 5);

    try {
      // Parse scan config with enhanced options
      const config = this.safeJsonParse(scan.config, {});
      const {
        subdomain_id,
        port_profile = 'top-1000',
        custom_ports,
        scan_technique = 'syn',
        service_detection = 'version',
        timing_template = 'T4',
        max_parallel = 3,
        live_hosts_only = true
      } = config;

      console.log('Enhanced port scan config:', config);

      // Get scan targets
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
              ip_address: subdomain.ip_address
            });
            console.log(`Scanning specific subdomain: ${subdomain.subdomain}`);
          }
        } catch (error) {
          console.error('Failed to fetch selected subdomain:', error);
        }
      } else {
        // Get subdomains for scanning
        try {
          let query = knex('subdomains')
            .where('target_id', target.id);
          
          if (live_hosts_only) {
            query = query.where('status', 'active');
          }
          
          const subdomains = await query.limit(max_parallel * 5);
          
          scanTargets = subdomains.map(sub => ({
            subdomain_id: sub.id,
            hostname: sub.subdomain,
            ip_address: sub.ip_address
          }));
          
          console.log(`Found ${scanTargets.length} subdomains to scan`);
          
          // If no subdomains, scan root domain
          if (scanTargets.length === 0) {
            scanTargets.push({
              subdomain_id: null,
              hostname: target.domain,
              ip_address: null
            });
            console.log(`No subdomains found, scanning root domain: ${target.domain}`);
          }
        } catch (error) {
          console.error('Failed to fetch subdomains:', error);
          scanTargets.push({
            subdomain_id: null,
            hostname: target.domain,
            ip_address: null
          });
        }
      }

      if (scanTargets.length === 0) {
        throw new Error('No targets available for port scanning');
      }

      await ScanJob.updateProgress(scan.id, 15);

      // Build nmap command
      const nmapCommand = this.buildNmapCommand(port_profile, custom_ports, scan_technique, service_detection, timing_template);
      console.log(`Using nmap command: ${nmapCommand}`);

      let allDiscoveredPorts = [];
      let totalProcessed = 0;
      const batchSize = Math.min(max_parallel, 3);

      // Process targets in batches
      for (let i = 0; i < scanTargets.length; i += batchSize) {
        const batch = scanTargets.slice(i, i + batchSize);
        
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} targets`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (scanTarget) => {
          return await this.scanSingleTarget(scanTarget, nmapCommand);
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Collect successful results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            allDiscoveredPorts = allDiscoveredPorts.concat(result.value);
          } else {
            console.error(`Failed to scan ${batch[index].hostname}:`, result.reason);
          }
        });
        
        totalProcessed += batch.length;
        const progressPercent = 15 + (totalProcessed / scanTargets.length) * 70;
        await ScanJob.updateProgress(scan.id, Math.round(progressPercent));
      }

      console.log(`Found ${allDiscoveredPorts.length} total ports`);

      // Store results in database if Port model is available
      if (Port && allDiscoveredPorts.length > 0) {
        try {
          const portRecords = allDiscoveredPorts.map(port => ({
            subdomain_id: port.subdomain_id,
            port: port.port,
            protocol: port.protocol,
            state: port.state,
            service: port.service,
            version: port.version,
            banner: port.banner,
            service_info: port.service_info || {},
            scan_job_id: scan.id
          }));

          console.log(`Storing ${portRecords.length} ports in database`);
          const createdRecords = await Port.bulkCreate(portRecords);
          console.log(`✅ Successfully stored ${createdRecords.length} ports`);
        } catch (dbError) {
          console.error('❌ Failed to store ports:', dbError.message);
        }
      }

      await ScanJob.updateProgress(scan.id, 95);

      const results = {
        discovered_ports: allDiscoveredPorts,
        total_ports: allDiscoveredPorts.length,
        open_ports: allDiscoveredPorts.filter(p => p.state === 'open').length,
        scan_targets: scanTargets.length,
        scan_config: config,
        nmap_command: nmapCommand,
        scan_timestamp: new Date().toISOString(),
        target_domain: target.domain
      };

      console.log(`✅ Port scan completed for ${target.domain}: found ${allDiscoveredPorts.length} ports (${results.open_ports} open)`);
      
      await ScanJob.updateProgress(scan.id, 100);
      return results;

    } catch (error) {
      console.error(`❌ Port scan failed for ${target.domain}:`, error);
      if (error.code === 'ENOENT') {
        throw new Error('Nmap not found. Please install nmap in the container.');
      }
      throw new Error(`Port scan failed: ${error.message}`);
    }
  }

  // ADD these new methods to your ScanService class:

  /**
   * Build nmap command based on configuration
   */
  buildNmapCommand(profile, customPorts, technique, serviceDetection, timing) {
    let command = 'nmap';
    
    // Add timing template
    command += ` -${timing}`;
    
    // Add scan technique
    switch (technique) {
      case 'syn':
        command += ' -sS';
        break;
      case 'connect':
        command += ' -sT';
        break;
      case 'udp':
        command += ' -sU';
        break;
      case 'comprehensive':
        command += ' -sS -sU';
        break;
      default:
        command += ' -sS';
    }
    
    // Add port specification
    if (profile === 'custom' && customPorts) {
      command += ` -p ${customPorts}`;
    } else {
      switch (profile) {
        case 'top-100':
          command += ' --top-ports 100';
          break;
        case 'top-1000':
          command += ' --top-ports 1000';
          break;
        case 'common-tcp':
          command += ' -p 1-1024';
          break;
        case 'common-udp':
          command += ' -sU --top-ports 100';
          break;
        case 'all-tcp':
          command += ' -p 1-65535';
          break;
        default:
          command += ' --top-ports 1000';
      }
    }
    
    // Add service detection
    switch (serviceDetection) {
      case 'basic':
        break;
      case 'version':
        command += ' -sV';
        break;
      case 'aggressive':
        command += ' -sV -sC -A';
        break;
    }
    
    // Additional flags
    command += ' -Pn --open -oG -';
    
    return command;
  }

  /**
   * Scan a single target with nmap
   */
  async scanSingleTarget(scanTarget, nmapCommand) {
    try {
      const { hostname, subdomain_id } = scanTarget;
      
      console.log(`Scanning ${hostname} with nmap...`);
      
      const fullCommand = `timeout 600 ${nmapCommand} ${hostname}`;
      
      const { stdout: nmapOutput } = await execAsync(fullCommand, {
        timeout: 620000,
        maxBuffer: 1024 * 1024 * 10
      });

      const ports = this.parseNmapOutput(nmapOutput, hostname, subdomain_id);
      
      console.log(`Found ${ports.length} ports on ${hostname}`);
      return ports;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.error('Nmap not found');
        return [];
      }
      
      console.error(`Port scan failed for ${scanTarget.hostname}:`, error.message);
      return [];
    }
  }

  /**
   * Parse nmap output for port information
   */
  parseNmapOutput(nmapOutput, hostname, subdomainId) {
    const ports = [];
    
    try {
      const lines = nmapOutput.split('\n');
      
      for (const line of lines) {
        // Parse grepable output: Host: 192.168.1.1 ()	Ports: 22/open/tcp//ssh//OpenSSH 7.4/
        if (line.startsWith('Host:') && line.includes('Ports:')) {
          const portsSection = line.split('Ports:')[1];
          if (!portsSection) continue;
          
          const portEntries = portsSection.split(',');
          
          for (const entry of portEntries) {
            const parts = entry.trim().split('/');
            if (parts.length >= 6) {
              const [portNum, state, protocol, , service, version] = parts;
              
              if (state === 'open' || state === 'closed' || state === 'filtered') {
                ports.push({
                  subdomain_id: subdomainId,
                  hostname: hostname,
                  port: parseInt(portNum),
                  protocol: protocol || 'tcp',
                  state: state,
                  service: service || null,
                  version: version || null,
                  banner: null,
                  service_info: {}
                });
              }
            }
          }
        }
        
        // Also parse regular format: "80/tcp   open  http"
        const portMatch = line.match(/^(\d+)\/(tcp|udp)\s+(open|closed|filtered)\s+(.+)$/);
        if (portMatch) {
          const [, portNumber, protocol, state, service] = portMatch;
          
          ports.push({
            subdomain_id: subdomainId,
            hostname: hostname,
            port: parseInt(portNumber),
            protocol: protocol,
            state: state,
            service: service.trim() || null,
            version: null,
            banner: null,
            service_info: {}
          });
        }
      }
      
    } catch (parseError) {
      console.error('Error parsing nmap output:', parseError.message);
    }
    
    return ports;
  }

  /**
   * Content discovery scan - COMPLETELY REWRITTEN
   */
  async runContentDiscovery(scan, target) {
    console.log(`Running content discovery for: ${target.domain}`);
    
    await ScanJob.updateProgress(scan.id, 10);

    try {
      // Parse scan config to get subdomain and wordlist preferences
      const config = Utils.safeJsonParse(scan.config, {});
      const selectedSubdomainId = config.subdomain_id;
      const selectedWordlist = config.wordlist || 'common';
      
      console.log(`Content discovery config:`, { selectedSubdomainId, selectedWordlist });
      
      // Determine which URLs to scan
      let scanTargets = [];
      
      if (selectedSubdomainId) {
        // Scan specific subdomain
        try {
          const subdomain = await knex('subdomains')
            .where('id', selectedSubdomainId)
            .first();
          
          if (subdomain) {
            scanTargets.push({
              url: subdomain.subdomain,
              subdomain_id: subdomain.id,
              subdomain_name: subdomain.subdomain
            });
            console.log(`Scanning specific subdomain: ${subdomain.subdomain}`);
          } else {
            console.warn(`Subdomain ID ${selectedSubdomainId} not found`);
          }
        } catch (error) {
          console.error('Failed to fetch selected subdomain:', error);
        }
      } else {
        // Scan all active subdomains for this target
        try {
          const subdomains = await knex('subdomains')
            .where('target_id', target.id)
            .where('status', 'active')
            .limit(10); // Limit to prevent overwhelming scans
          
          scanTargets = subdomains.map(sub => ({
            url: sub.subdomain,
            subdomain_id: sub.id,
            subdomain_name: sub.subdomain
          }));
          
          console.log(`Found ${scanTargets.length} active subdomains to scan`);
          
          // If no subdomains, scan the root domain
          if (scanTargets.length === 0) {
            scanTargets.push({
              url: target.domain,
              subdomain_id: null,
              subdomain_name: target.domain
            });
            console.log(`No active subdomains found, scanning root domain: ${target.domain}`);
          }
        } catch (error) {
          console.error('Failed to fetch subdomains:', error);
          // Fallback to root domain
          scanTargets.push({
            url: target.domain,
            subdomain_id: null,
            subdomain_name: target.domain
          });
        }
      }

      if (scanTargets.length === 0) {
        throw new Error('No targets to scan for content discovery');
      }

      console.log(`Scanning ${scanTargets.length} targets for content discovery`);
      
      let allDiscoveredPaths = [];
      let totalProcessed = 0;
      
      // Check if ffuf is available
      let useFFUF = false;
      try {
        await execAsync('which ffuf', { timeout: 5000 });
        useFFUF = true;
        console.log('Using ffuf for content discovery');
      } catch {
        console.log('ffuf not available, using basic curl testing');
      }

      await ScanJob.updateProgress(scan.id, 20);

      // Scan each target
      for (const scanTarget of scanTargets) {
        console.log(`Scanning ${scanTarget.url} for content discovery`);
        
        let discoveredPaths = [];
        
        if (useFFUF) {
          discoveredPaths = await this.runFFUFScan(scanTarget, selectedWordlist, scan.id);
        } else {
          discoveredPaths = await this.runBasicPathScan(scanTarget);
        }
        
        // Add subdomain_id to each discovered path
        discoveredPaths.forEach(path => {
          path.subdomain_id = scanTarget.subdomain_id;
          path.scan_job_id = scan.id;
        });
        
        allDiscoveredPaths = allDiscoveredPaths.concat(discoveredPaths);
        
        totalProcessed++;
        const progressPercent = 20 + (totalProcessed / scanTargets.length) * 60;
        await ScanJob.updateProgress(scan.id, Math.round(progressPercent));
      }

      console.log(`Found ${allDiscoveredPaths.length} total directories/files`);

      // Store results in database if Directory model is available
      if (Directory && allDiscoveredPaths.length > 0) {
        try {
          const directoryRecords = allDiscoveredPaths.map(path => ({
            subdomain_id: path.subdomain_id,
            path: path.path,
            url: path.url,
            status_code: path.status_code,
            content_length: path.content_length || null,
            response_time: path.response_time || null,
            title: path.title || null,
            headers: path.headers ? JSON.stringify(path.headers) : null,
            method: 'GET',
            scan_job_id: scan.id
          }));

          console.log(`Attempting to store ${directoryRecords.length} directories in database`);
          const createdRecords = await Directory.bulkCreate(directoryRecords);
          console.log(`✅ Successfully stored ${createdRecords.length} directories in database`);
        } catch (dbError) {
          console.error('❌ Failed to store directories in database:', dbError.message);
          // Continue execution - don't fail the scan because of database issues
        }
      } else if (!Directory) {
        console.warn('Directory model not available - results will not be stored in database');
      }

      await ScanJob.updateProgress(scan.id, 90);

      const results = {
        discovered_paths: allDiscoveredPaths,
        total_paths: allDiscoveredPaths.length,
        scan_targets: scanTargets.length,
        tool_used: useFFUF ? 'ffuf' : 'basic_curl',
        wordlist_used: selectedWordlist,
        scan_timestamp: new Date().toISOString(),
        target_domain: target.domain,
        config: config
      };

      console.log(`✅ Content discovery completed for ${target.domain}: found ${allDiscoveredPaths.length} paths using ${results.tool_used}`);
      
      await ScanJob.updateProgress(scan.id, 100);
      return results;

    } catch (error) {
      console.error(`❌ Content discovery failed for ${target.domain}:`, error);
      throw new Error(`Content discovery failed: ${error.message}`);
    }
  }

  /**
   * Run FFUF scan for a specific target
   */
  async runFFUFScan(scanTarget, wordlist = 'common', scanId) {
    try {
      const wordlistPath = path.join(this.toolsPath, `wordlists/${wordlist}.txt`);
      
      // Check if wordlist exists, fallback to common.txt
      let finalWordlistPath = wordlistPath;
      try {
        await fs.access(wordlistPath);
        console.log(`Using wordlist: ${wordlistPath}`);
      } catch {
        finalWordlistPath = path.join(this.toolsPath, 'wordlists/common.txt');
        console.log(`Wordlist ${wordlistPath} not found, using: ${finalWordlistPath}`);
      }

      // Use both HTTP and HTTPS, try HTTP first then HTTPS if it fails
      const protocols = ['http', 'https'];
      const discoveredPaths = [];
      
      for (const protocol of protocols) {
        try {
          const targetUrl = `${protocol}://${scanTarget.url}/FUZZ`;
          const outputFile = `/tmp/ffuf_${scanId}_${Date.now()}.json`;
          
          // Updated ffuf command with JSON output for better parsing
          const ffufCmd = `timeout 300 ffuf -w "${finalWordlistPath}" -u "${targetUrl}" -mc 200,204,301,302,307,401,403,500 -fc 404 -t 20 -timeout 10 -o "${outputFile}" -of json -s`;
          
          console.log(`Running: ${ffufCmd}`);
          
          const { stdout: ffufOutput } = await execAsync(ffufCmd, {
            timeout: 320000,
            maxBuffer: 1024 * 1024 * 50
          });

          // Try to read JSON output file
          try {
            const jsonContent = await fs.readFile(outputFile, 'utf8');
            const ffufResults = JSON.parse(jsonContent);
            
            if (ffufResults.results && ffufResults.results.length > 0) {
              ffufResults.results.forEach(result => {
                discoveredPaths.push({
                  path: result.input.FUZZ.startsWith('/') ? result.input.FUZZ : `/${result.input.FUZZ}`,
                  url: result.url,
                  status_code: result.status,
                  content_length: result.length,
                  response_time: Math.round(result.duration / 1000000), // Convert nanoseconds to milliseconds
                  title: null,
                  protocol: protocol
                });
              });
              
              console.log(`ffuf found ${discoveredPaths.length} paths using ${protocol}://${scanTarget.url}`);
              
              // Clean up temp file
              try {
                await fs.unlink(outputFile);
              } catch (cleanupError) {
                console.warn(`Could not clean up temp file ${outputFile}:`, cleanupError.message);
              }
              
              // If we found results with this protocol, use them and break
              if (discoveredPaths.length > 0) {
                break;
              }
            }
          } catch (jsonError) {
            console.warn('Failed to parse ffuf JSON output, trying stdout parsing:', jsonError.message);
            
            // Fallback: parse stdout if JSON parsing failed
            if (ffufOutput) {
              const lines = ffufOutput.split('\n').filter(line => line.trim());
              
              for (const line of lines) {
                // Try different ffuf output formats
                let urlMatch = line.match(/^(https?:\/\/[^\s]+)/);
                let statusMatch = line.match(/\[Status:\s*(\d+)/);
                let sizeMatch = line.match(/Size:\s*(\d+)/);
                
                if (!urlMatch || !statusMatch) {
                  // Try alternative format: "http://example.com/path [Status: 200, Size: 1234]"
                  const altMatch = line.match(/^(https?:\/\/[^\s]+)\s+\[Status:\s*(\d+).*?Size:\s*(\d+)/);
                  if (altMatch) {
                    urlMatch = [null, altMatch[1]];
                    statusMatch = [null, altMatch[2]];
                    sizeMatch = [null, altMatch[3]];
                  }
                }
                
                if (urlMatch && statusMatch) {
                  try {
                    const url = urlMatch[1];
                    const urlObj = new URL(url);
                    const path = urlObj.pathname;
                    
                    discoveredPaths.push({
                      path: path,
                      url: url,
                      status_code: parseInt(statusMatch[1]),
                      content_length: sizeMatch ? parseInt(sizeMatch[1]) : null,
                      response_time: null,
                      protocol: protocol
                    });
                  } catch (urlError) {
                    console.warn(`Could not parse URL from line: ${line}`);
                  }
                }
              }
            }
          }
          
          // If we found results, don't try the other protocol
          if (discoveredPaths.length > 0) {
            console.log(`Found ${discoveredPaths.length} paths using ${protocol}://${scanTarget.url}`);
            break;
          }
          
        } catch (protocolError) {
          console.log(`${protocol}://${scanTarget.url} failed: ${protocolError.message}`);
          continue;
        }
      }
      
      return discoveredPaths;
      
    } catch (error) {
      console.error(`FFUF scan failed for ${scanTarget.url}:`, error);
      return [];
    }
  }

  /**
   * Run basic path scan using curl
   */
  async runBasicPathScan(scanTarget) {
    const commonPaths = [
      '/admin', '/api', '/login', '/dashboard', '/wp-admin', '/phpmyadmin',
      '/robots.txt', '/sitemap.xml', '/.env', '/config', '/backup',
      '/test', '/dev', '/staging', '/beta', '/app', '/upload', '/uploads',
      '/files', '/docs', '/help', '/support', '/contact', '/about',
      '/services', '/products', '/news', '/blog', '/search', '/feed',
      '/assets', '/css', '/js', '/images', '/img', '/static'
    ];
    
    const discoveredPaths = [];
    const protocols = ['http', 'https'];
    
    for (const protocol of protocols) {
      let foundAny = false;
      
      for (const path of commonPaths) {
        try {
          const url = `${protocol}://${scanTarget.url}${path}`;
          const startTime = Date.now();
          
          const { stdout } = await execAsync(
            `curl -s -o /dev/null -w "%{http_code}|%{size_download}|%{time_total}" -m 10 -L "${url}"`,
            { timeout: 15000 }
          );
          
          const [statusCode, sizeDownload, timeTotal] = stdout.trim().split('|');
          const status = parseInt(statusCode);
          const responseTime = Math.round(parseFloat(timeTotal) * 1000);
          
          if (status && status !== 404 && status !== 0) {
            discoveredPaths.push({
              path: path,
              url: url,
              status_code: status,
              content_length: parseInt(sizeDownload) || null,
              response_time: responseTime,
              protocol: protocol
            });
            
            foundAny = true;
          }
        } catch {
          // Path test failed, continue
        }
      }
      
      // If we found results with this protocol, don't try the other
      if (foundAny) {
        console.log(`Found ${discoveredPaths.length} paths using ${protocol}://${scanTarget.url}`);
        break;
      }
    }
    
    return discoveredPaths;
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
      const contentResults = await this.runContentDiscovery(scan, target);
      
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
          total_paths: contentResults.total_paths || 0,
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
          currentStats.discovered_paths = results.total_paths || 0;
          currentStats.scan_targets = results.scan_targets || 0;
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
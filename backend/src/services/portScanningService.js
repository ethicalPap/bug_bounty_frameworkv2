// backend/src/services/portScanningService.js - Enhanced port scanning functionality

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const ScanJob = require('../models/ScanJob');
const knex = require('../config/database');

// Import models with proper error handling
let Port;
try {
  Port = require('../models/Port');
  console.log('✅ Port model loaded');
} catch (error) {
  console.warn('⚠️ Port model not available:', error.message);
}

/**
 * Enhanced port scanning functionality for the scan service
 * Add this to your existing scanService.js file or create as separate module
 */

/**
 * Enhanced port scanning implementation
 */
async function runEnhancedPortScan(scan, target) {
  console.log(`Running enhanced port scan for: ${target.domain}`);
  
  await ScanJob.updateProgress(scan.id, 5);
  
  try {
    // Parse scan config
    const config = typeof scan.config === 'string' ? JSON.parse(scan.config) : scan.config || {};
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

    console.log('Port scan config:', config);

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
            ip_address: subdomain.ip_address
          });
          console.log(`Scanning specific subdomain: ${subdomain.subdomain}`);
        }
      } catch (error) {
        console.error('Failed to fetch selected subdomain:', error);
      }
    } else {
      // Scan all active subdomains for this target
      try {
        const statusFilter = live_hosts_only ? 'active' : undefined;
        const subdomains = await knex('subdomains')
          .where('target_id', target.id)
          .modify(query => {
            if (statusFilter) {
              query.where('status', statusFilter);
            }
          })
          .limit(max_parallel * 5); // Reasonable limit to prevent overwhelming scans
        
        scanTargets = subdomains.map(sub => ({
          subdomain_id: sub.id,
          hostname: sub.subdomain,
          ip_address: sub.ip_address
        }));
        
        console.log(`Found ${scanTargets.length} subdomains to scan`);
        
        // If no subdomains, try scanning the root domain
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
        // Fallback to root domain
        scanTargets.push({
          subdomain_id: null,
          hostname: target.domain,
          ip_address: null
        });
      }
    }

    if (scanTargets.length === 0) {
      throw new Error('No targets to scan for port discovery');
    }

    await ScanJob.updateProgress(scan.id, 15);

    // Build nmap command
    const nmapCommand = buildNmapCommand(port_profile, custom_ports, scan_technique, service_detection, timing_template);
    console.log(`Using nmap command template: ${nmapCommand}`);

    let allDiscoveredPorts = [];
    let totalProcessed = 0;

    // Process targets in batches
    const batchSize = Math.min(max_parallel, 3);
    
    for (let i = 0; i < scanTargets.length; i += batchSize) {
      const batch = scanTargets.slice(i, i + batchSize);
      
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} targets`);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (scanTarget) => {
        return await scanSingleTarget(scanTarget, nmapCommand, scan.id);
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

        console.log(`Attempting to store ${portRecords.length} ports in database`);
        const createdRecords = await Port.bulkCreate(portRecords);
        console.log(`✅ Successfully stored ${createdRecords.length} ports in database`);
      } catch (dbError) {
        console.error('❌ Failed to store ports in database:', dbError.message);
        // Continue execution - don't fail the scan because of database issues
      }
    } else if (!Port) {
      console.warn('Port model not available - results will not be stored in database');
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
    throw new Error(`Port scan failed: ${error.message}`);
  }
}

/**
 * Build nmap command based on configuration
 */
function buildNmapCommand(profile, customPorts, technique, serviceDetection, timing) {
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
      command += ' -sS'; // Default to SYN scan
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
      // No additional flags
      break;
    case 'version':
      command += ' -sV';
      break;
    case 'aggressive':
      command += ' -sV -sC -A';
      break;
  }
  
  // Add additional flags
  command += ' -Pn'; // Skip host discovery
  command += ' --open'; // Only show open ports
  command += ' -oX -'; // XML output to stdout
  
  return command;
}

/**
 * Scan a single target and parse results
 */
async function scanSingleTarget(scanTarget, nmapCommand, scanJobId) {
  try {
    const { hostname, subdomain_id } = scanTarget;
    
    console.log(`Scanning ${hostname} with nmap...`);
    
    // Build full command
    const fullCommand = `timeout 600 ${nmapCommand} ${hostname}`;
    
    const { stdout: nmapOutput } = await execAsync(fullCommand, {
      timeout: 620000, // 10.3 minutes
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    // Parse nmap XML output
    const ports = parseNmapOutput(nmapOutput, hostname, subdomain_id);
    
    console.log(`Found ${ports.length} ports on ${hostname}`);
    return ports;
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('Nmap not found. Please install nmap.');
      return [];
    }
    
    console.error(`Port scan failed for ${scanTarget.hostname}:`, error.message);
    return [];
  }
}

/**
 * Parse nmap XML output to extract port information
 */
function parseNmapOutput(xmlOutput, hostname, subdomainId) {
  const ports = [];
  
  try {
    // Simple regex parsing of nmap XML (for production, consider using a proper XML parser)
    const portRegex = /<port protocol="([^"]+)" portid="(\d+)">[\s\S]*?<state state="([^"]+)"[^>]*>[\s\S]*?(?:<service name="([^"]*)"[^>]*version="([^"]*)"[^>]*>)?/g;
    
    let match;
    while ((match = portRegex.exec(xmlOutput)) !== null) {
      const [, protocol, portNumber, state, service, version] = match;
      
      ports.push({
        subdomain_id: subdomainId,
        hostname: hostname,
        port: parseInt(portNumber),
        protocol: protocol,
        state: state,
        service: service || null,
        version: version || null,
        banner: null, // Could be extracted from nmap output if needed
        service_info: {}
      });
    }
    
    // Fallback: parse simple text output if XML parsing fails
    if (ports.length === 0) {
      const lines = xmlOutput.split('\n');
      
      for (const line of lines) {
        // Match open ports: "80/tcp   open  http"
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
    }
    
  } catch (parseError) {
    console.error('Error parsing nmap output:', parseError.message);
  }
  
  return ports;
}

module.exports = {
  runEnhancedPortScan,
  buildNmapCommand,
  scanSingleTarget,
  parseNmapOutput
};
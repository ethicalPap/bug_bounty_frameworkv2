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
 * Enhanced port scanning implementation with automatic fallback
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
      scan_technique = 'auto', // Changed to auto for smart fallback
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

    // Determine best scan technique with automatic fallback
    const bestScanTechnique = await determineBestScanTechnique(scan_technique, target.domain);
    console.log(`Using scan technique: ${bestScanTechnique}`);

    // Build nmap command
    const nmapCommand = buildNmapCommand(port_profile, custom_ports, bestScanTechnique, service_detection, timing_template);
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
        return await scanSingleTargetWithFallback(scanTarget, nmapCommand, port_profile, service_detection, timing_template, scan.id);
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
      scan_technique_used: bestScanTechnique,
      nmap_command: nmapCommand,
      scan_timestamp: new Date().toISOString(),
      target_domain: target.domain
    };

    console.log(`✅ Port scan completed for ${target.domain}: found ${allDiscoveredPorts.length} ports (${results.open_ports} open) using ${bestScanTechnique}`);
    
    await ScanJob.updateProgress(scan.id, 100);
    return results;

  } catch (error) {
    console.error(`❌ Port scan failed for ${target.domain}:`, error);
    throw new Error(`Port scan failed: ${error.message}`);
  }
}

/**
 * Determine the best scan technique with automatic fallback
 */
async function determineBestScanTechnique(requestedTechnique, testHost) {
  console.log(`Determining best scan technique (requested: ${requestedTechnique})`);
  
  // If user specifically requested a technique other than auto, try it first
  if (requestedTechnique !== 'auto' && requestedTechnique !== 'syn') {
    return requestedTechnique;
  }
  
  // Test if SYN scan works
  try {
    console.log('Testing SYN scan capability...');
    const testCommand = `timeout 10 nmap -sS --top-ports 1 -Pn ${testHost}`;
    await execAsync(testCommand, { timeout: 15000 });
    console.log('✅ SYN scan works');
    return 'syn';
  } catch (error) {
    if (error.message.includes('requires root') || error.message.includes('QUITTING')) {
      console.log('⚠️ SYN scan requires root, falling back to TCP connect');
      return 'connect';
    } else {
      console.log(`SYN test failed with: ${error.message}, falling back to TCP connect`);
      return 'connect';
    }
  }
}

/**
 * Build nmap command based on configuration - Updated with better fallback
 */
function buildNmapCommand(profile, customPorts, technique, serviceDetection, timing) {
  let command = 'nmap';
  
  // Add timing template
  command += ` -${timing}`;
  
  // Add scan technique with fallback logic
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
      command += ' -sT -sU'; // Use TCP connect for comprehensive to avoid root issues
      break;
    default:
      command += ' -sT'; // Default to TCP connect scan (safer)
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
      command += ' -sV -sC';
      break;
  }
  
  // Add additional flags
  command += ' -Pn'; // Skip host discovery
  command += ' --open'; // Only show open ports
  command += ' -oG -'; // Use grepable output instead of XML for better parsing
  
  return command;
}

/**
 * Scan a single target with automatic fallback for permission issues
 */
async function scanSingleTargetWithFallback(scanTarget, nmapCommand, portProfile, serviceDetection, timing, scanJobId) {
  try {
    const { hostname, subdomain_id } = scanTarget;
    
    console.log(`Scanning ${hostname} with nmap...`);
    
    // Build full command
    const fullCommand = `timeout 600 ${nmapCommand} ${hostname}`;
    
    const { stdout: nmapOutput } = await execAsync(fullCommand, {
      timeout: 620000, // 10.3 minutes
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    // Parse nmap output
    const ports = parseNmapOutput(nmapOutput, hostname, subdomain_id);
    
    if (ports.length > 0) {
      console.log(`Found ${ports.length} ports on ${hostname}`);
      return ports;
    } else {
      console.log(`No ports found on ${hostname}`);
      return [];
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('Nmap not found. Please install nmap.');
      return [];
    }
    
    if (error.message.includes('requires root') || error.message.includes('QUITTING')) {
      console.log(`⚠️ Root required for ${scanTarget.hostname}, trying TCP connect fallback...`);
      
      // Build fallback command with TCP connect
      const fallbackCommand = buildNmapCommand(portProfile, null, 'connect', serviceDetection, timing);
      
      try {
        const { stdout: fallbackOutput } = await execAsync(`timeout 600 ${fallbackCommand} ${scanTarget.hostname}`, {
          timeout: 620000,
          maxBuffer: 1024 * 1024 * 10
        });
        
        const ports = parseNmapOutput(fallbackOutput, scanTarget.hostname, scanTarget.subdomain_id);
        console.log(`✅ Fallback scan found ${ports.length} ports on ${scanTarget.hostname}`);
        return ports;
      } catch (fallbackError) {
        console.error(`❌ Fallback scan also failed: ${fallbackError.message}`);
        return [];
      }
    }
    
    console.error(`Port scan failed for ${scanTarget.hostname}:`, error.message);
    return [];
  }
}

/**
 * Original scanSingleTarget function - kept for compatibility
 */
async function scanSingleTarget(scanTarget, nmapCommand, scanJobId) {
  return await scanSingleTargetWithFallback(scanTarget, nmapCommand, 'top-1000', 'version', 'T4', scanJobId);
}

/**
 * Parse nmap output - Updated to handle both XML and grepable output
 */
function parseNmapOutput(nmapOutput, hostname, subdomainId) {
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
      
      // Parse XML output if present (fallback)
      const portRegex = /<port protocol="([^"]+)" portid="(\d+)">[\s\S]*?<state state="([^"]+)"[^>]*>[\s\S]*?(?:<service name="([^"]*)"[^>]*version="([^"]*)"[^>]*>)?/g;
      
      let match;
      while ((match = portRegex.exec(line)) !== null) {
        const [, protocol, portNumber, state, service, version] = match;
        
        ports.push({
          subdomain_id: subdomainId,
          hostname: hostname,
          port: parseInt(portNumber),
          protocol: protocol,
          state: state,
          service: service || null,
          version: version || null,
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

module.exports = {
  runEnhancedPortScan,
  buildNmapCommand,
  scanSingleTarget,
  scanSingleTargetWithFallback,
  parseNmapOutput,
  determineBestScanTechnique
};
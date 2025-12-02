/**
 * API Client - Aligned with Backend Endpoints
 * Backend: FastAPI at http://localhost:8000
 */

// Backend API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * OUTPUT PATH CONFIGURATION
 */
export const OUTPUT_PATHS = {
  base: '/opt/bugbounty/output',
  scans: {
    subdomains: '/opt/bugbounty/output/subdomains',
    liveHosts: '/opt/bugbounty/output/live-hosts',
    ports: '/opt/bugbounty/output/ports',
    contentDiscovery: '/opt/bugbounty/output/content-discovery',
    vulnerabilities: '/opt/bugbounty/output/vulnerabilities'
  },
  contentDiscovery: {
    apis: '/opt/bugbounty/output/content-discovery/apis',
    endpoints: '/opt/bugbounty/output/content-discovery/endpoints',
    directories: '/opt/bugbounty/output/content-discovery/directories',
    javascript: '/opt/bugbounty/output/content-discovery/javascript'
  },
  exports: {
    json: '/opt/bugbounty/output/exports/json',
    csv: '/opt/bugbounty/output/exports/csv',
    txt: '/opt/bugbounty/output/exports/txt',
    reports: '/opt/bugbounty/output/exports/reports'
  }
}

export const OUTPUT_NAMING = {
  getFilename: (target, scanType, extension = 'json') => {
    const sanitizedTarget = target.replace(/[^a-zA-Z0-9.-]/g, '_')
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0]
    return `${sanitizedTarget}_${scanType}_${timestamp}.${extension}`
  }
}

/**
 * API Request Helper
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  }
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || error.message || `HTTP ${response.status}`)
    }
    
    return response.json()
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error)
    throw error
  }
}

// ==================== HEALTH & INFO ====================

export async function healthCheck() {
  return apiRequest('/health')
}

export async function getApiInfo() {
  return apiRequest('/')
}

export async function getStatistics() {
  return apiRequest('/api/v1/stats')
}

// ==================== SUBDOMAIN SCANNING ====================

export async function startSubdomainScan(config) {
  return apiRequest('/api/v1/scan', {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function getSubdomains(domain) {
  return apiRequest(`/api/v1/subdomains/${encodeURIComponent(domain)}`)
}

export async function getSubdomainResults(scanId) {
  // Backend doesn't have scan-specific endpoint, use domain query
  return apiRequest(`/api/v1/subdomains?scan_id=${encodeURIComponent(scanId)}`)
}

export async function getDomains() {
  return apiRequest('/api/v1/domains')
}

// ==================== HTTP PROBING / LIVE HOSTS ====================

export async function startLiveHostsScan(config) {
  return apiRequest('/api/v1/probe-hosts', {
    method: 'POST',
    body: JSON.stringify({
      subdomains: config.subdomains || config.hosts || [],
      concurrency: config.concurrency || 10,
      timeout: config.timeout || 10
    })
  })
}

export async function probeHosts(subdomains, concurrency = 10, timeout = 10) {
  return apiRequest('/api/v1/probe-hosts', {
    method: 'POST',
    body: JSON.stringify({ subdomains, concurrency, timeout })
  })
}

export async function probeHostsBatch(subdomains, concurrency = 10, timeout = 10) {
  return apiRequest('/api/v1/probe-hosts/batch', {
    method: 'POST',
    body: JSON.stringify({ subdomains, concurrency, timeout })
  })
}

export async function probeHostsWithProgress(hosts, onProgress) {
  const batchSize = 20
  const results = []
  const total = hosts.length
  
  for (let i = 0; i < hosts.length; i += batchSize) {
    const batch = hosts.slice(i, i + batchSize)
    
    try {
      const response = await probeHosts(batch, 10, 10)
      results.push(...(response.results || []))
    } catch (e) {
      // Add failed hosts
      batch.forEach(host => {
        results.push({ subdomain: host, is_active: false, error: e.message })
      })
    }
    
    if (onProgress) {
      onProgress({
        current: Math.min(i + batchSize, total),
        total,
        percentage: Math.round((Math.min(i + batchSize, total) / total) * 100),
        results
      })
    }
  }
  
  return results
}

export async function probeSingleHost(host) {
  const response = await probeHosts([host], 1, 10)
  return response.results ? response.results[0] : null
}

export async function getLiveHostsResults(scanId) {
  // No direct endpoint - return empty for now
  return { results: [] }
}

// ==================== CONTENT DISCOVERY ====================

export async function startContentDiscovery(config) {
  return apiRequest('/api/v1/content-discovery/start', {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function getContentDiscoveryResults(scanId) {
  return apiRequest(`/api/v1/content-discovery/scan/${encodeURIComponent(scanId)}`)
}

export async function getContentForTarget(target) {
  // URL encode the target properly
  const encodedTarget = encodeURIComponent(target)
  return apiRequest(`/api/v1/content-discovery/target/${encodedTarget}`)
}

export async function getInterestingDiscoveries(limit = 100) {
  return apiRequest(`/api/v1/content-discovery/interesting?limit=${limit}`)
}

export async function exportContentDiscovery(options) {
  return apiRequest('/api/v1/content-discovery/export', {
    method: 'POST',
    body: JSON.stringify(options)
  })
}

// ==================== PORT SCANNING ====================

export async function startPortScan(config) {
  return apiRequest('/api/v1/ports/scan', {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function getPortScanResults(scanId) {
  return apiRequest(`/api/v1/ports/scan/${encodeURIComponent(scanId)}`)
}

export async function getPortsByTarget(target) {
  return apiRequest(`/api/v1/ports/target/${encodeURIComponent(target)}`)
}

export async function getPortsBySubdomain(subdomainId) {
  return apiRequest(`/api/v1/ports/subdomain/${subdomainId}`)
}

export async function getOpenPorts(limit = 100) {
  return apiRequest(`/api/v1/ports/open?limit=${limit}`)
}

export async function getPortsByService(service) {
  return apiRequest(`/api/v1/ports/service/${encodeURIComponent(service)}`)
}

// ==================== VULNERABILITY SCANNING ====================

export async function startVulnScan(config) {
  const scanner = config.scanner || 'nuclei'
  return apiRequest(`/api/v1/vuln-scan/${scanner}`, {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function runNucleiScan(config) {
  return apiRequest('/api/v1/vuln-scan/nuclei', {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function runNiktoScan(config) {
  return apiRequest('/api/v1/vuln-scan/nikto', {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function runBatchVulnScan(config) {
  return apiRequest('/api/v1/vuln-scan/batch', {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function getVulnScanResults(scanId) {
  return apiRequest(`/api/v1/vuln-scan/findings/${encodeURIComponent(scanId)}`)
}

export async function getVulnScansByTarget(target) {
  return apiRequest(`/api/v1/vuln-scan/target/${encodeURIComponent(target)}`)
}

export async function getVulnScansByDomain(domain) {
  return apiRequest(`/api/v1/vuln-scan/domain/${encodeURIComponent(domain)}`)
}

export async function getVulnFindingsBySeverity(severity, limit = 100) {
  return apiRequest(`/api/v1/vuln-scan/findings/severity/${severity}?limit=${limit}`)
}

export async function getVulnStatistics() {
  return apiRequest('/api/v1/vuln-scan/statistics')
}

export async function updateVulnFinding(findingId, updates) {
  return apiRequest(`/api/v1/vuln-scan/finding/${findingId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  })
}

// ==================== VALIDATION ====================

export async function validateTarget(config) {
  return apiRequest('/api/v1/validation/validate-target', {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function quickValidateTarget(targetUrl, discoveredPaths = []) {
  return apiRequest('/api/v1/validation/quick-validate', {
    method: 'POST',
    body: JSON.stringify({
      target_url: targetUrl,
      discovered_paths: discoveredPaths
    })
  })
}

export async function validateDomain(config) {
  return apiRequest('/api/v1/validation/validate-domain', {
    method: 'POST',
    body: JSON.stringify(config)
  })
}

export async function getValidationResults(domain) {
  return apiRequest(`/api/v1/validation/results/${encodeURIComponent(domain)}`)
}

export async function getTargetValidation(subdomain) {
  return apiRequest(`/api/v1/validation/target/${encodeURIComponent(subdomain)}`)
}

// ==================== VISUALIZATION ====================

export async function getVisualizationData(domain) {
  return apiRequest(`/api/v1/visualization/${encodeURIComponent(domain)}`)
}

export async function getTechnologyBreakdown(domain) {
  return apiRequest(`/api/v1/visualization/${encodeURIComponent(domain)}/technology`)
}

export async function getServiceBreakdown(domain) {
  return apiRequest(`/api/v1/visualization/${encodeURIComponent(domain)}/services`)
}

export async function getEndpointTree(domain) {
  return apiRequest(`/api/v1/visualization/${encodeURIComponent(domain)}/tree`)
}

export async function getAttackSurface(domain) {
  return apiRequest(`/api/v1/attack-surface/${encodeURIComponent(domain)}`)
}

// ==================== EXPORT ====================

export async function exportAll(format = 'json') {
  return apiRequest('/api/v1/exports/all', {
    method: 'POST',
    body: JSON.stringify({ format })
  })
}

export async function exportBySubdomain(subdomain, format = 'json') {
  return apiRequest('/api/v1/exports/by-subdomain', {
    method: 'POST',
    body: JSON.stringify({ subdomain, format })
  })
}

export async function exportByType(type, format = 'json') {
  return apiRequest('/api/v1/exports/by-type', {
    method: 'POST',
    body: JSON.stringify({ type, format })
  })
}

// ==================== DEFAULT EXPORT ====================

export default {
  // Config
  OUTPUT_PATHS,
  OUTPUT_NAMING,
  
  // Health
  healthCheck,
  getApiInfo,
  getStatistics,
  
  // Subdomains
  startSubdomainScan,
  getSubdomains,
  getSubdomainResults,
  getDomains,
  
  // Live Hosts / Probing
  startLiveHostsScan,
  probeHosts,
  probeHostsBatch,
  probeHostsWithProgress,
  probeSingleHost,
  getLiveHostsResults,
  
  // Content Discovery
  startContentDiscovery,
  getContentDiscoveryResults,
  getContentForTarget,
  getInterestingDiscoveries,
  exportContentDiscovery,
  
  // Port Scanning
  startPortScan,
  getPortScanResults,
  getPortsByTarget,
  getPortsBySubdomain,
  getOpenPorts,
  getPortsByService,
  
  // Vulnerability Scanning
  startVulnScan,
  runNucleiScan,
  runNiktoScan,
  runBatchVulnScan,
  getVulnScanResults,
  getVulnScansByTarget,
  getVulnScansByDomain,
  getVulnFindingsBySeverity,
  getVulnStatistics,
  updateVulnFinding,
  
  // Validation
  validateTarget,
  quickValidateTarget,
  validateDomain,
  getValidationResults,
  getTargetValidation,
  
  // Visualization
  getVisualizationData,
  getTechnologyBreakdown,
  getServiceBreakdown,
  getEndpointTree,
  getAttackSurface,
  
  // Export
  exportAll,
  exportBySubdomain,
  exportByType
}
/**
 * Bug Bounty Platform - API Client
 * Complete client for all backend endpoints including HTTP probing
 */

import axios from 'axios'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 60000, // 60 seconds for long-running operations
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    console.error('❌ Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.config.url}`)
    return response
  },
  (error) => {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data)
    } else if (error.request) {
      console.error('❌ Network Error:', error.message)
    } else {
      console.error('❌ Error:', error.message)
    }
    return Promise.reject(error)
  }
)


// ============================================================================
// SUBDOMAIN SCANNING
// ============================================================================

/**
 * Get all subdomains for a domain
 * @param {string} domain - Target domain
 */
export const getSubdomains = async (domain) => {
  try {
    const response = await api.get(`/subdomains/${domain}`)
    return response.data
  } catch (error) {
    console.error('Error fetching subdomains:', error)
    throw error
  }
}

/**
 * Start subdomain enumeration scan
 * @param {string} domain - Target domain
 * @param {string[]} tools - Tools to use (subfinder, amass, etc.)
 * @param {string} workspaceId - Optional workspace ID
 */
export const startSubdomainScan = async (domain, tools = ['subfinder', 'amass'], workspaceId = null) => {
  try {
    const response = await api.post('/subdomains/scan', {
      domain,
      tools,
      workspace_id: workspaceId
    })
    return response.data
  } catch (error) {
    console.error('Error starting subdomain scan:', error)
    throw error
  }
}

/**
 * Get scan results by scan ID
 * @param {string} scanId - Scan ID
 */
export const getScanResults = async (scanId) => {
  try {
    const response = await api.get(`/subdomains/scan/${scanId}`)
    return response.data
  } catch (error) {
    console.error('Error fetching scan results:', error)
    throw error
  }
}


// ============================================================================
// HTTP PROBING (CORS-FREE)
// ============================================================================

/**
 * Probe hosts through backend proxy (bypasses CORS)
 * @param {string[]} subdomains - List of subdomains to probe
 * @param {number} maxConcurrent - Max concurrent requests (default: 10)
 * @param {number} timeout - Timeout in seconds (default: 10)
 */
export const probeHosts = async (subdomains, maxConcurrent = 10, timeout = 10) => {
  try {
    const response = await api.post('/probe-hosts', {
      subdomains: subdomains,
      max_concurrent: maxConcurrent,
      timeout: timeout,
      verify_ssl: false
    })
    return response.data
  } catch (error) {
    console.error('Error probing hosts:', error)
    throw error
  }
}

/**
 * Quick probe for a single host (5 second timeout)
 * @param {string} subdomain - Subdomain to probe
 * @param {string[]} protocols - Protocols to try (default: ['https', 'http'])
 */
export const quickProbe = async (subdomain, protocols = ['https', 'http']) => {
  try {
    const response = await api.post(`/quick-probe/${subdomain}`, {
      protocols: protocols
    })
    return response.data
  } catch (error) {
    console.error('Error in quick probe:', error)
    throw error
  }
}

/**
 * Probe all subdomains for a domain (also updates database)
 * @param {string} domain - Target domain
 * @param {number} concurrency - Number of concurrent probes (default: 10)
 */
export const probeDomain = async (domain, concurrency = 10) => {
  try {
    const response = await api.post(`/probe-domain/${domain}?concurrency=${concurrency}`)
    return response.data
  } catch (error) {
    console.error('Error probing domain:', error)
    throw error
  }
}

/**
 * Probe scan results by scan ID (also updates database)
 * @param {string} scanId - Scan ID
 * @param {number} concurrency - Number of concurrent probes (default: 10)
 */
export const probeScan = async (scanId, concurrency = 10) => {
  try {
    const response = await api.post(`/probe-scan/${scanId}?concurrency=${concurrency}`)
    return response.data
  } catch (error) {
    console.error('Error probing scan:', error)
    throw error
  }
}

/**
 * Probe hosts with progress tracking (batched on frontend)
 * @param {string[]} subdomains - List of subdomains to probe
 * @param {function} onProgress - Progress callback function
 * @param {number} batchSize - Batch size (default: 20)
 */
export const probeHostsWithProgress = async (subdomains, onProgress, batchSize = 20) => {
  const batches = []
  
  // Split into batches
  for (let i = 0; i < subdomains.length; i += batchSize) {
    batches.push(subdomains.slice(i, i + batchSize))
  }
  
  const allResults = []
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    
    // Probe this batch
    const response = await probeHosts(batch, batchSize)
    const batchResults = response.results || []
    
    allResults.push(...batchResults)
    
    // Report progress
    if (onProgress) {
      onProgress({
        completed: Math.min((i + 1) * batchSize, subdomains.length),
        total: subdomains.length,
        currentBatch: i + 1,
        totalBatches: batches.length,
        results: allResults,
        stats: {
          active: allResults.filter(r => r.is_active).length,
          inactive: allResults.filter(r => !r.is_active).length
        }
      })
    }
  }
  
  return allResults
}

/**
 * Probe with batching endpoint (single request, backend handles batching)
 * @param {string[]} subdomains - List of subdomains to probe
 * @param {number} maxConcurrent - Max concurrent per batch (default: 10)
 */
export const probeHostsBatched = async (subdomains, maxConcurrent = 10) => {
  try {
    const response = await api.post('/probe-hosts-batch', {
      subdomains: subdomains,
      max_concurrent: maxConcurrent,
      timeout: 10,
      verify_ssl: false
    })
    return response.data
  } catch (error) {
    console.error('Error in batched probe:', error)
    throw error
  }
}


// ============================================================================
// PORT SCANNING
// ============================================================================

/**
 * Start port scan for a subdomain
 * @param {string} subdomain - Target subdomain
 * @param {string} ports - Port range (e.g., "1-1000" or "80,443,8080")
 * @param {string} scanType - Type of scan (syn, tcp, udp)
 */
export const startPortScan = async (subdomain, ports = '1-1000', scanType = 'syn') => {
  try {
    const response = await api.post('/port-scan', {
      subdomain,
      ports,
      scan_type: scanType
    })
    return response.data
  } catch (error) {
    console.error('Error starting port scan:', error)
    throw error
  }
}


// ============================================================================
// CONTENT DISCOVERY
// ============================================================================

/**
 * Start content discovery scan
 * @param {string} subdomain - Target subdomain
 * @param {string} wordlist - Wordlist to use (common, medium, large)
 * @param {string[]} extensions - File extensions to check
 */
export const startContentDiscovery = async (subdomain, wordlist = 'common', extensions = ['php', 'html', 'js']) => {
  try {
    const response = await api.post('/content-discovery', {
      subdomain,
      wordlist,
      extensions
    })
    return response.data
  } catch (error) {
    console.error('Error starting content discovery:', error)
    throw error
  }
}


// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate target for vulnerabilities
 * @param {string} target - Target to validate
 * @param {string} scanType - Type of validation (quick, full)
 */
export const validateTarget = async (target, scanType = 'full') => {
  try {
    const response = await api.post('/validate', {
      target,
      scan_type: scanType
    })
    return response.data
  } catch (error) {
    console.error('Error validating target:', error)
    throw error
  }
}

/**
 * Quick validation for a target
 * @param {string} target - Target to validate
 */
export const quickValidateTarget = async (target) => {
  return await validateTarget(target, 'quick')
}


// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

/**
 * Get statistics for a domain
 * @param {string} domain - Target domain
 */
export const getDomainStats = async (domain) => {
  try {
    const response = await api.get(`/stats/${domain}`)
    return response.data
  } catch (error) {
    console.error('Error fetching domain stats:', error)
    throw error
  }
}


// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export results in various formats
 * @param {string} domain - Target domain
 * @param {string} format - Export format (json, csv)
 */
export const exportResults = async (domain, format = 'json') => {
  try {
    const response = await api.get(`/export/${domain}?format=${format}`)
    return response.data
  } catch (error) {
    console.error('Error exporting results:', error)
    throw error
  }
}

/**
 * Download export as file
 * @param {string} domain - Target domain
 * @param {string} format - Export format (json, csv)
 */
export const downloadExport = async (domain, format = 'json') => {
  try {
    const data = await exportResults(domain, format)
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${domain}-export-${Date.now()}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    return true
  } catch (error) {
    console.error('Error downloading export:', error)
    throw error
  }
}


// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check API health status
 */
export const checkHealth = async () => {
  try {
    const response = await api.get('/health')
    return response.data
  } catch (error) {
    console.error('Error checking health:', error)
    throw error
  }
}

/**
 * Check if API is reachable
 */
export const isApiReachable = async () => {
  try {
    await checkHealth()
    return true
  } catch (error) {
    return false
  }
}


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get API base URL
 */
export const getApiBaseUrl = () => {
  return api.defaults.baseURL
}

/**
 * Set API base URL
 * @param {string} url - New base URL
 */
export const setApiBaseUrl = (url) => {
  api.defaults.baseURL = url
}


// ============================================================================
// EXPORTS
// ============================================================================

export default api
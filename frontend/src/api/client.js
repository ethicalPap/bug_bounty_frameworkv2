/**
 * Bug Bounty Platform - API Client
 * Complete client for all backend endpoints
 */

import axios from 'axios'

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 60000,
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
    const response = await api.get(`/api/v1/subdomains/${domain}`)
    return response.data
  } catch (error) {
    console.error('Error fetching subdomains:', error)
    throw error
  }
}

/**
 * Start subdomain enumeration scan
 * @param {object} scanConfig - Scan configuration
 */
export const startSubdomainScan = async (scanConfig) => {
  try {
    const response = await api.post('/api/v1/scan', scanConfig)
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
    const response = await api.get(`/api/v1/scan/${scanId}/results`)
    return response.data
  } catch (error) {
    console.error('Error fetching scan results:', error)
    throw error
  }
}


// ============================================================================
// HTTP PROBING - FIXED IMPLEMENTATION
// ============================================================================

/**
 * Probe hosts with progress tracking via backend API
 * @param {string[]} subdomains - List of subdomains to probe
 * @param {function} onProgress - Progress callback function
 * @param {number} concurrency - Concurrency level (default: 10)
 */
export const probeHostsWithProgress = async (subdomains, onProgress, concurrency = 10) => {
  const batchSize = Math.min(concurrency, 20)
  const batches = []
  
  // Split into batches
  for (let i = 0; i < subdomains.length; i += batchSize) {
    batches.push(subdomains.slice(i, i + batchSize))
  }
  
  const allResults = []
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    
    try {
      // Call backend API for this batch
      const response = await api.post('/api/v1/probe-hosts', {
        subdomains: batch,
        concurrency: batchSize,
        timeout: 10
      })
      
      const batchResults = response.data.results || []
      allResults.push(...batchResults)
      
      // Call progress callback
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
      
    } catch (error) {
      console.error(`Batch ${i + 1} failed:`, error)
      // Continue with next batch even if one fails
    }
  }
  
  return allResults
}

/**
 * Probe hosts through backend (single batch)
 * @param {string[]} subdomains - List of subdomains to probe
 * @param {number} concurrency - Max concurrent requests
 * @param {number} timeout - Timeout in seconds
 */
export const probeHosts = async (subdomains, concurrency = 10, timeout = 10) => {
  try {
    const response = await api.post('/api/v1/probe-hosts', {
      subdomains: subdomains,
      concurrency: concurrency,
      timeout: timeout
    })
    return response.data
  } catch (error) {
    console.error('Error probing hosts:', error)
    throw error
  }
}

/**
 * Quick probe for a single host
 */
export const quickProbe = async (subdomain, protocols = ['https', 'http']) => {
  try {
    const response = await api.post('/api/v1/probe-hosts', {
      subdomains: [subdomain],
      concurrency: 1,
      timeout: 10
    })
    return response.data.results?.[0] || {}
  } catch (error) {
    console.error('Error in quick probe:', error)
    throw error
  }
}

/**
 * Probe all subdomains for a domain
 */
export const probeDomain = async (domain, concurrency = 10) => {
  try {
    // First get all subdomains for the domain
    const subdomains = await getSubdomains(domain)
    const subdomainList = subdomains?.data || subdomains || []
    
    if (subdomainList.length === 0) {
      return { results: [], total: 0, active: 0, inactive: 0 }
    }
    
    // Extract subdomain names
    const names = subdomainList.map(s => s.full_domain || s.subdomain || s)
    
    // Probe them
    return await probeHosts(names, concurrency)
  } catch (error) {
    console.error('Error probing domain:', error)
    throw error
  }
}

/**
 * Probe with batching endpoint
 */
export const probeHostsBatched = async (subdomains, concurrency = 10) => {
  try {
    const response = await api.post('/api/v1/probe-hosts/batch', {
      subdomains: subdomains,
      concurrency: concurrency,
      timeout: 10
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
 * Start port scan
 * @param {object} scanConfig - Port scan configuration
 */
export const startPortScan = async (scanConfig) => {
  try {
    const response = await api.post('/api/v1/ports/scan', scanConfig)
    return response.data
  } catch (error) {
    console.error('Error starting port scan:', error)
    throw error
  }
}

/**
 * Get ports for a target
 * @param {string} target - Target host
 */
export const getPortsForTarget = async (target) => {
  try {
    const response = await api.get(`/api/v1/ports/target/${target}`)
    return response.data
  } catch (error) {
    console.error('Error fetching ports:', error)
    throw error
  }
}


// ============================================================================
// CONTENT DISCOVERY
// ============================================================================

/**
 * Start content discovery scan
 * @param {object} scanConfig - Content discovery configuration
 */
export const startContentDiscovery = async (scanConfig) => {
  try {
    const response = await api.post('/api/v1/content/scan', scanConfig)
    return response.data
  } catch (error) {
    console.error('Error starting content discovery:', error)
    throw error
  }
}

/**
 * Get content for a target URL
 * @param {string} targetUrl - Target URL
 */
export const getContentForTarget = async (targetUrl) => {
  try {
    const response = await api.get(`/api/v1/content-discovery/target/${encodeURIComponent(targetUrl)}`)
    return response.data
  } catch (error) {
    console.error('Error fetching content:', error)
    throw error
  }
}


// ============================================================================
// VISUALIZATION
// ============================================================================

/**
 * Get visualization data for domain
 * @param {string} domain - Target domain
 */
export const getVisualizationData = async (domain) => {
  try {
    const response = await api.get(`/api/v1/visualization/${domain}`)
    return response.data
  } catch (error) {
    console.error('Error fetching visualization data:', error)
    throw error
  }
}

/**
 * Get technology breakdown
 * @param {string} domain - Target domain
 */
export const getTechnologyBreakdown = async (domain) => {
  try {
    const response = await api.get(`/api/v1/visualization/${domain}/technology`)
    return response.data
  } catch (error) {
    console.error('Error fetching technology breakdown:', error)
    throw error
  }
}

/**
 * Get service breakdown
 * @param {string} domain - Target domain
 */
export const getServiceBreakdown = async (domain) => {
  try {
    const response = await api.get(`/api/v1/visualization/${domain}/services`)
    return response.data
  } catch (error) {
    console.error('Error fetching service breakdown:', error)
    throw error
  }
}

/**
 * Get endpoint tree
 * @param {string} domain - Target domain
 */
export const getEndpointTree = async (domain) => {
  try {
    const response = await api.get(`/api/v1/visualization/${domain}/tree`)
    return response.data
  } catch (error) {
    console.error('Error fetching endpoint tree:', error)
    throw error
  }
}

/**
 * Get attack surface summary
 * @param {string} domain - Target domain
 */
export const getAttackSurface = async (domain) => {
  try {
    const response = await api.get(`/api/v1/visualization/${domain}/attack-surface`)
    return response.data
  } catch (error) {
    console.error('Error fetching attack surface:', error)
    throw error
  }
}


// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get platform statistics
 */
export const getStats = async () => {
  try {
    const response = await api.get('/api/v1/stats')
    return response.data
  } catch (error) {
    console.error('Error fetching stats:', error)
    throw error
  }
}

/**
 * Get domain statistics
 */
export const getDomainStats = async (domain) => {
  try {
    const response = await api.get(`/api/v1/visualization/${domain}/attack-surface`)
    return response.data
  } catch (error) {
    console.error('Error fetching domain stats:', error)
    throw error
  }
}


// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate target for vulnerabilities
 * @param {string} targetUrl - Target URL to validate
 * @param {string[]} discoveredPaths - Discovered paths
 * @param {boolean} background - Run in background
 */
export const validateTarget = async (targetUrl, discoveredPaths = [], background = false) => {
  try {
    const response = await api.post('/api/v1/validation/validate-target', {
      target_url: targetUrl,
      discovered_paths: discoveredPaths,
      background: background
    })
    return response.data
  } catch (error) {
    console.error('Error validating target:', error)
    throw error
  }
}

/**
 * Quick validation for a target
 * @param {string} targetUrl - Target URL to validate
 * @param {string[]} discoveredPaths - Discovered paths
 */
export const quickValidateTarget = async (targetUrl, discoveredPaths = []) => {
  try {
    const response = await api.post('/api/v1/validation/quick-validate', {
      target_url: targetUrl,
      discovered_paths: discoveredPaths
    })
    return response.data
  } catch (error) {
    console.error('Error in quick validation:', error)
    throw error
  }
}

/**
 * Validate domain high-value targets
 * @param {string} domain - Domain to validate
 * @param {number} limit - Max targets to validate
 * @param {number} minRiskScore - Minimum risk score
 */
export const validateDomain = async (domain, limit = 10, minRiskScore = 30) => {
  try {
    const response = await api.post('/api/v1/validation/validate-domain', {
      domain: domain,
      limit: limit,
      min_risk_score: minRiskScore
    })
    return response.data
  } catch (error) {
    console.error('Error validating domain:', error)
    throw error
  }
}

/**
 * Get validation report for domain
 * @param {string} domain - Domain
 */
export const getValidationReport = async (domain) => {
  try {
    const response = await api.get(`/api/v1/validation/results/${domain}`)
    return response.data
  } catch (error) {
    console.error('Error fetching validation report:', error)
    throw error
  }
}

/**
 * Get validation for specific target
 * @param {string} subdomain - Subdomain
 */
export const getTargetValidation = async (subdomain) => {
  try {
    const response = await api.get(`/api/v1/validation/target/${subdomain}`)
    return response.data
  } catch (error) {
    console.error('Error fetching target validation:', error)
    throw error
  }
}


// ============================================================================
// EXPORT
// ============================================================================

/**
 * Export results
 */
export const exportResults = async (domain, format = 'json') => {
  try {
    const response = await api.get(`/api/v1/visualization/${domain}`)
    return response.data
  } catch (error) {
    console.error('Error exporting results:', error)
    throw error
  }
}

/**
 * Download export
 */
export const downloadExport = async (domain, format = 'json') => {
  try {
    const data = await exportResults(domain, format)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${domain}-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    window.URL.revokeObjectURL(url)
    return true
  } catch (error) {
    console.error('Error downloading export:', error)
    return false
  }
}


// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check API health status
 */
export const healthCheck = async () => {
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
    await healthCheck()
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
 */
export const setApiBaseUrl = (url) => {
  api.defaults.baseURL = url
}


// ============================================================================
// EXPORTS
// ============================================================================

export default api
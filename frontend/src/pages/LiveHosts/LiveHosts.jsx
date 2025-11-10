import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSubdomains } from '../../api/client'
import { Activity, Play, CheckCircle, XCircle, ExternalLink, Loader, Download, Copy, RefreshCw, AlertTriangle, X, Globe } from 'lucide-react'
import axios from 'axios'

// LocalStorage keys
const STORAGE_KEYS = {
  LIVE_HOSTS_DOMAIN: 'live_hosts_last_domain',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
  LIVE_HOSTS_PROGRESS: 'live_hosts_progress',
}

const LiveHosts = () => {
  const [availableDomains, setAvailableDomains] = useState([])
  const [selectedDomain, setSelectedDomain] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_DOMAIN) || ''
  })
  const [isProbing, setIsProbing] = useState(false)
  const [probeProgress, setProbeProgress] = useState(0)
  const [probeResults, setProbeResults] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
    return saved ? JSON.parse(saved) : []
  })
  const [currentlyProbing, setCurrentlyProbing] = useState('')
  const [concurrency, setConcurrency] = useState(10)
  
  const probeAbortController = useRef(null)
  const queryClient = useQueryClient()

  // Persist results to localStorage
  useEffect(() => {
    if (probeResults.length > 0) {
      localStorage.setItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS, JSON.stringify(probeResults))
    }
  }, [probeResults])

  useEffect(() => {
    if (selectedDomain) {
      localStorage.setItem(STORAGE_KEYS.LIVE_HOSTS_DOMAIN, selectedDomain)
    }
  }, [selectedDomain])

  // Fetch available domains from subdomain scanner
  useEffect(() => {
    const fetchAvailableDomains = async () => {
      try {
        // Get all cached subdomain queries
        const queryCache = queryClient.getQueryCache()
        const allQueries = queryCache.getAll()
        
        const domains = allQueries
          .filter(query => query.queryKey[0] === 'subdomains' && query.state.data?.data?.length > 0)
          .map(query => query.queryKey[1])
          .filter(Boolean)
        
        setAvailableDomains([...new Set(domains)])
      } catch (error) {
        console.error('Failed to fetch domains:', error)
      }
    }

    fetchAvailableDomains()
  }, [queryClient])

  // Query for fetching subdomains
  const { data: subdomains, isLoading: isLoadingSubdomains } = useQuery({
    queryKey: ['subdomains', selectedDomain],
    queryFn: () => getSubdomains(selectedDomain),
    enabled: !!selectedDomain,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60 * 24,
  })

  const subdomainsList = subdomains?.data || []

  // HTTP Probe function
  const probeSubdomain = async (subdomain) => {
    const protocols = ['https', 'http']
    
    for (const protocol of protocols) {
      try {
        const url = `${protocol}://${subdomain}`
        const startTime = Date.now()
        
        const response = await axios.get(url, {
          timeout: 10000,
          maxRedirects: 5,
          validateStatus: () => true, // Accept any status code
          signal: probeAbortController.current?.signal
        })
        
        const responseTime = Date.now() - startTime

        return {
          subdomain,
          url,
          protocol,
          status_code: response.status,
          response_time: responseTime,
          is_active: true,
          content_length: response.data?.length || 0,
          server: response.headers['server'] || 'Unknown',
          title: extractTitle(response.data),
          redirect_url: response.request?.responseURL !== url ? response.request?.responseURL : null,
          error: null,
          probed_at: new Date().toISOString()
        }
      } catch (error) {
        // If it's an abort, throw it up
        if (error.name === 'CanceledError' || error.message?.includes('aborted')) {
          throw error
        }
        // Try next protocol
        continue
      }
    }

    // Both protocols failed
    return {
      subdomain,
      url: `https://${subdomain}`,
      protocol: null,
      status_code: null,
      response_time: null,
      is_active: false,
      content_length: null,
      server: null,
      title: null,
      redirect_url: null,
      error: 'Connection failed',
      probed_at: new Date().toISOString()
    }
  }

  // Extract title from HTML
  const extractTitle = (html) => {
    if (!html || typeof html !== 'string') return null
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return titleMatch ? titleMatch[1].trim().substring(0, 100) : null
  }

  // Start probing
  const startProbing = async () => {
    if (!selectedDomain || subdomainsList.length === 0 || isProbing) return

    setIsProbing(true)
    setProbeProgress(0)
    setProbeResults([])
    probeAbortController.current = new AbortController()

    const results = []
    const total = subdomainsList.length
    let completed = 0

    try {
      // Process in batches for concurrency control
      const batchSize = concurrency
      for (let i = 0; i < subdomainsList.length; i += batchSize) {
        const batch = subdomainsList.slice(i, i + batchSize)
        
        const batchPromises = batch.map(async (sub) => {
          setCurrentlyProbing(sub.full_domain)
          try {
            const result = await probeSubdomain(sub.full_domain)
            completed++
            setProbeProgress((completed / total) * 100)
            return result
          } catch (error) {
            if (error.name === 'CanceledError' || error.message?.includes('aborted')) {
              throw error // Propagate abort
            }
            completed++
            setProbeProgress((completed / total) * 100)
            return {
              subdomain: sub.full_domain,
              is_active: false,
              error: 'Probe failed',
              probed_at: new Date().toISOString()
            }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        setProbeResults([...results]) // Update UI after each batch
      }

      setIsProbing(false)
      setProbeProgress(100)
      setCurrentlyProbing('')
      
    } catch (error) {
      if (error.name === 'CanceledError' || error.message?.includes('aborted')) {
        console.log('Probing cancelled by user')
        setProbeResults([...results]) // Save partial results
      } else {
        console.error('Probing error:', error)
      }
      setIsProbing(false)
      setCurrentlyProbing('')
    }
  }

  // Cancel probing
  const cancelProbing = () => {
    if (probeAbortController.current) {
      probeAbortController.current.abort()
    }
    setIsProbing(false)
    setCurrentlyProbing('')
  }

  // Clear results
  const clearResults = () => {
    setProbeResults([])
    setProbeProgress(0)
    localStorage.removeItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
  }

  // Export to CSV - exports all results (Host and Status only)
  const exportToCSV = () => {
    const headers = ['Host', 'Status']
    const rows = probeResults.map(r => [
      r.subdomain,
      r.is_active ? 'Active' : 'Inactive'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedDomain}-live-hosts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Copy active subdomains to clipboard
  const copyActiveToClipboard = () => {
    const activeHosts = probeResults.filter(r => r.is_active).map(r => r.subdomain).join('\n')
    navigator.clipboard.writeText(activeHosts)
      .then(() => alert('Active hosts copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err))
  }

  // Statistics
  const stats = {
    total: probeResults.length,
    active: probeResults.filter(r => r.is_active).length,
    inactive: probeResults.filter(r => !r.is_active).length,
    avg_response_time: probeResults.filter(r => r.response_time).length > 0
      ? Math.round(probeResults.filter(r => r.response_time).reduce((sum, r) => sum + r.response_time, 0) / probeResults.filter(r => r.response_time).length)
      : 0
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="text-cyber-green" />
            Live Hosts
          </h2>
          <p className="text-gray-400 mt-2">Probe subdomains to discover active hosts and services</p>
        </div>

        {probeResults.length > 0 && !isProbing && (
          <div className="flex gap-2">
            <button
              onClick={copyActiveToClipboard}
              disabled={stats.active === 0}
              className="flex items-center gap-2 px-4 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-green transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Copy active hosts"
            >
              <Copy size={16} />
              Copy Active ({stats.active})
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-blue transition-all"
              title="Export to CSV"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={clearResults}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-all"
              title="Clear results"
            >
              <X size={16} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Probe Configuration */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <div className="space-y-6">
          {/* Domain Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Domain to Probe
            </label>
            {availableDomains.length === 0 ? (
              <div className="text-center py-8 bg-dark-200 border border-dark-50 rounded-lg">
                <Globe className="mx-auto text-gray-600 mb-3" size={48} />
                <p className="text-gray-400 mb-2">No domains available</p>
                <p className="text-sm text-gray-500">
                  Run a subdomain scan first to discover domains
                </p>
              </div>
            ) : (
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-4 py-3 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-green transition-all disabled:opacity-50"
                disabled={isProbing}
              >
                <option value="">Select a domain...</option>
                {availableDomains.map((domain) => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            )}
          </div>

          {/* Show subdomain count */}
          {selectedDomain && subdomainsList.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-dark-200 border border-dark-50 rounded-lg">
              <div>
                <p className="text-white font-medium">
                  {subdomainsList.length} subdomains ready to probe
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Estimated time: ~{Math.ceil((subdomainsList.length * 2) / concurrency)} seconds
                </p>
              </div>
              <div className="text-right">
                <label className="block text-xs text-gray-400 mb-1">Concurrency</label>
                <input
                  type="number"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                  className="w-20 px-3 py-1 bg-dark-100 border border-dark-50 rounded text-white text-center"
                  min="1"
                  max="50"
                  disabled={isProbing}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isProbing ? (
              <button
                onClick={startProbing}
                disabled={!selectedDomain || subdomainsList.length === 0}
                className="w-full py-3 px-6 bg-gradient-to-r from-cyber-green to-cyber-blue rounded-lg font-medium text-white hover:from-cyber-green/90 hover:to-cyber-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Play size={20} />
                Start Probing
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-cyber-green to-cyber-blue rounded-lg font-medium text-white opacity-75 cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Loader className="animate-spin" size={20} />
                  Probing... {probeProgress.toFixed(0)}%
                </button>
                
                <button
                  type="button"
                  onClick={cancelProbing}
                  className="px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-lg font-medium text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <X size={20} />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isProbing && (
          <div className="mt-6 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Probe Progress</span>
                <span className="text-sm font-medium text-cyber-green">{probeProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-dark-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyber-green to-cyber-blue transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${probeProgress}%` }}
                />
              </div>
            </div>

            {currentlyProbing && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader className="animate-spin text-cyber-green" size={16} />
                <span>Currently probing: <span className="text-white font-mono">{currentlyProbing}</span></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Probe Complete - Export Only */}
      {probeResults.length > 0 && !isProbing && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          {/* Completion Banner */}
          <div className="bg-gradient-to-r from-cyber-green/10 to-cyber-blue/10 border border-cyber-green/30 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <CheckCircle className="text-green-400" size={24} />
                  Probing Complete! 🎉
                </h4>
                <p className="text-sm text-gray-400 mt-2">
                  Successfully probed {stats.total} hosts from <span className="text-white font-medium">{selectedDomain}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Export your results below or view detailed analysis in the Dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-dark-200 border border-dark-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white mb-1">{stats.total}</div>
              <div className="text-xs text-gray-400">Total Probed</div>
            </div>
            <div className="bg-dark-200 border border-green-500/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">{stats.active}</div>
              <div className="text-xs text-gray-400">Active Hosts</div>
              {stats.active > 0 && (
                <div className="text-xs text-green-400/70 mt-1">
                  {((stats.active / stats.total) * 100).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="bg-dark-200 border border-dark-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-500 mb-1">{stats.inactive}</div>
              <div className="text-xs text-gray-400">Inactive</div>
            </div>
            <div className="bg-dark-200 border border-cyber-blue/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-cyber-blue mb-1">{stats.avg_response_time}ms</div>
              <div className="text-xs text-gray-400">Avg Response</div>
            </div>
          </div>

          {/* Export Information */}
          <div className="bg-dark-200 border border-dark-50 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyber-green/10 rounded-lg flex-shrink-0">
                <Download className="text-cyber-green" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white mb-2">
                  Export Your Results
                </h4>
                <p className="text-sm text-gray-400 mb-4">
                  Export a simple list of all probed hosts with their status (Active/Inactive). 
                  Use "Copy Active" to get just the active hostnames, or "Export CSV" for the complete list.
                </p>
                
                {/* Export Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  <div className="bg-dark-100 border border-dark-50 rounded px-3 py-2 text-center">
                    <div className="text-white font-semibold">{probeResults.filter(r => r.protocol === 'https').length}</div>
                    <div className="text-xs text-gray-400">HTTPS</div>
                  </div>
                  <div className="bg-dark-100 border border-dark-50 rounded px-3 py-2 text-center">
                    <div className="text-white font-semibold">{probeResults.filter(r => r.protocol === 'http').length}</div>
                    <div className="text-xs text-gray-400">HTTP Only</div>
                  </div>
                  <div className="bg-dark-100 border border-dark-50 rounded px-3 py-2 text-center">
                    <div className="text-white font-semibold">
                      {probeResults.filter(r => r.status_code >= 200 && r.status_code < 300).length}
                    </div>
                    <div className="text-xs text-gray-400">2xx Success</div>
                  </div>
                  <div className="bg-dark-100 border border-dark-50 rounded px-3 py-2 text-center">
                    <div className="text-white font-semibold">
                      {probeResults.filter(r => r.response_time && r.response_time < 500).length}
                    </div>
                    <div className="text-xs text-gray-400">Fast (&lt;500ms)</div>
                  </div>
                </div>

                <div className="bg-dark-100 border border-dark-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">CSV Export Contains:</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-2 py-1 bg-dark-200 rounded text-xs text-white">Host</span>
                    <span className="px-2 py-1 bg-dark-200 rounded text-xs text-white">Status</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Simple format for easy integration with other tools
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveHosts
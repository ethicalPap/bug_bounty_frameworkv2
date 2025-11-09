import { useState, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startSubdomainScan, getSubdomains } from '../../api/client'
import { Globe, Play, CheckCircle, XCircle, ExternalLink, Loader, Download, Copy, RefreshCw, AlertTriangle, X } from 'lucide-react'

// LocalStorage keys
const STORAGE_KEYS = {
  LAST_SCAN_DOMAIN: 'subdomain_scanner_last_domain',
  SCAN_CONFIG: 'subdomain_scanner_config',
  FILTER_STATE: 'subdomain_scanner_filter',
  IS_SCANNING: 'subdomain_scanner_is_scanning',
}

const SubdomainScanner = () => {
  // Load persisted state from localStorage
  const [domain, setDomain] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_SCAN_DOMAIN) || ''
  })
  
  const [scanConfig, setScanConfig] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCAN_CONFIG)
    return saved ? JSON.parse(saved) : {
      use_subfinder: true,
      use_sublist3r: true,
      use_amass: true,
      use_assetfinder: true,
      use_findomain: true,
      use_chaos: false,
    }
  })
  
  const [lastScanDomain, setLastScanDomain] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_SCAN_DOMAIN) || null
  })
  
  const [filterActive, setFilterActive] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FILTER_STATE)
    return saved ? JSON.parse(saved).filterActive : 'all'
  })
  
  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FILTER_STATE)
    return saved ? JSON.parse(saved).searchTerm : ''
  })
  
  const [scanProgress, setScanProgress] = useState(0)
  const [scanningTools, setScanningTools] = useState([])
  const [completedTools, setCompletedTools] = useState([])
  const [isCancelled, setIsCancelled] = useState(false)
  const [dataRestoredFromCache, setDataRestoredFromCache] = useState(false)
  
  const [isScanning, setIsScanning] = useState(() => {
    // Don't restore scanning state - always start fresh
    return false
  })

  const queryClient = useQueryClient()
  const progressIntervalRef = useRef(null)
  const hasCheckedCache = useRef(false)

  // Persist state changes to localStorage
  useEffect(() => {
    if (lastScanDomain) {
      localStorage.setItem(STORAGE_KEYS.LAST_SCAN_DOMAIN, lastScanDomain)
    }
  }, [lastScanDomain])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCAN_CONFIG, JSON.stringify(scanConfig))
  }, [scanConfig])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILTER_STATE, JSON.stringify({
      filterActive,
      searchTerm
    }))
  }, [filterActive, searchTerm])

  // Memoize enabled tools to prevent infinite re-renders
  const enabledTools = useMemo(() => 
    Object.entries(scanConfig).filter(([_, enabled]) => enabled).map(([tool]) => tool),
    [scanConfig]
  )
  
  const totalTools = enabledTools.length

  // Check if we have cached data on mount
  useEffect(() => {
    if (!hasCheckedCache.current && lastScanDomain) {
      // Check if React Query has cached data for this domain
      const cachedData = queryClient.getQueryData(['subdomains', lastScanDomain])
      if (cachedData?.data && cachedData.data.length > 0) {
        console.log('✅ Found cached data for:', lastScanDomain, '- Count:', cachedData.data.length)
        setDataRestoredFromCache(true)
      } else {
        console.log('⚠️ No cached data found for:', lastScanDomain, '- Will fetch from backend')
      }
      hasCheckedCache.current = true
    }
  }, [lastScanDomain, queryClient])

  // Mutation for starting scan
  const scanMutation = useMutation({
    mutationFn: startSubdomainScan,
    onSuccess: (data) => {
      setLastScanDomain(domain)
      // Don't set isScanning to false here - let the results query handle it
      console.log('Scan started:', data.data)
    },
    onError: (error) => {
      console.error('Scan failed:', error)
      setScanProgress(0)
      setIsCancelled(false)
      setIsScanning(false) // Stop scanning on error
      
      // Clear the interval on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    },
  })

  // Handle progress simulation - cleaner approach
  useEffect(() => {
    // Clean up interval on unmount
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  // Start progress when scan begins
  useEffect(() => {
    if ((scanMutation.isLoading || isScanning) && !isCancelled) {
      // Initialize scanning state
      setScanningTools(enabledTools)
      setCompletedTools([])
      
      // Clear any existing interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      
      // Start progress simulation
      let currentProgress = scanProgress || 0
      let toolsCompleted = completedTools.length
      
      progressIntervalRef.current = setInterval(() => {
        // Update progress
        currentProgress = Math.min(currentProgress + (100 / totalTools / 10), 95)
        setScanProgress(currentProgress)

        // Simulate tools completing
        if (toolsCompleted < totalTools && currentProgress > (toolsCompleted + 1) * (95 / totalTools)) {
          toolsCompleted++
          setCompletedTools(prev => [...prev, enabledTools[toolsCompleted - 1]])
        }
      }, 3000)
    } else {
      // Clear interval when not loading
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      
      if (!isScanning && !scanMutation.isLoading && !isCancelled) {
        setScanProgress(0)
        setScanningTools([])
        setCompletedTools([])
      }
    }
  }, [scanMutation.isLoading, isScanning, isCancelled])

  // Query for fetching results
  const { data: subdomains, isLoading: isLoadingResults, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['subdomains', lastScanDomain],
    queryFn: () => getSubdomains(lastScanDomain),
    enabled: !!lastScanDomain && !isCancelled,
    refetchInterval: isScanning ? 3000 : false, // Keep polling while scanning
    refetchOnMount: false, // Don't refetch when component remounts
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on network reconnect
    staleTime: Infinity, // Data never becomes stale
    cacheTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    keepPreviousData: true, // Keep showing old data while fetching new
    onSuccess: (data) => {
      console.log('📥 Query onSuccess called:', {
        hasData: !!data?.data,
        count: data?.data?.length || 0,
        isScanning,
        domain: lastScanDomain
      })
      
      // Check if we have results
      if (data?.data && data.data.length > 0 && isScanning) {
        // Results received! Complete the scan
        console.log('✅ Scan complete! Found', data.data.length, 'subdomains')
        setScanProgress(100)
        setCompletedTools(enabledTools)
        setIsScanning(false)
        setDataRestoredFromCache(false)
        
        // Clear interval
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
      } else if (data?.data && data.data.length > 0 && !isScanning && !isFetching) {
        // Data was restored from cache or localStorage
        console.log('🎉 Data restored from cache:', data.data.length, 'subdomains')
        setDataRestoredFromCache(true)
      }
    },
    onError: (error) => {
      console.error('❌ Query error:', error)
    }
  })

  // Reset cache indicator when starting new scan
  useEffect(() => {
    if (isScanning) {
      setDataRestoredFromCache(false)
    }
  }, [isScanning])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!domain.trim() || isScanning) return // Prevent multiple submissions

    // Clear previous results
    setLastScanDomain(null)
    setSearchTerm('')
    setFilterActive('all')
    setScanProgress(0)
    setIsCancelled(false)
    setIsScanning(true) // Start scanning

    // Start scan
    scanMutation.mutate({
      domain: domain.trim(),
      ...scanConfig,
    })
  }

  const handleCancel = () => {
    setIsCancelled(true)
    setIsScanning(false)
    setScanProgress(0)
    setScanningTools([])
    setCompletedTools([])
    
    // Clear interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    
    // Cancel queries
    queryClient.cancelQueries(['subdomains', domain])
  }

  const clearResults = () => {
    // Clear all state
    setLastScanDomain(null)
    setSearchTerm('')
    setFilterActive('all')
    setScanProgress(0)
    setIsCancelled(false)
    setIsScanning(false)
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.LAST_SCAN_DOMAIN)
    localStorage.removeItem(STORAGE_KEYS.FILTER_STATE)
    
    // Clear query cache
    queryClient.removeQueries(['subdomains'])
  }

  const results = subdomains?.data || []

  // Filter and search results
  const filteredResults = results.filter(subdomain => {
    // Filter by active status
    if (filterActive === 'active' && !subdomain.is_active) return false
    if (filterActive === 'inactive' && subdomain.is_active) return false

    // Filter by search term
    if (searchTerm && !subdomain.full_domain.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }

    return true
  })

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Subdomain', 'IP Address', 'Status', 'HTTP Code', 'Title']
    const rows = filteredResults.map(s => [
      s.full_domain,
      s.ip_address || 'N/A',
      s.is_active ? 'Active' : 'Inactive',
      s.status_code || 'N/A',
      s.title || 'N/A'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lastScanDomain}-subdomains-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Copy all subdomains to clipboard
  const copyToClipboard = () => {
    const text = filteredResults.map(s => s.full_domain).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => alert('Copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err))
  }

  // Statistics
  const stats = {
    total: results.length,
    active: results.filter(s => s.is_active).length,
    inactive: results.filter(s => !s.is_active).length,
    filtered: filteredResults.length
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Globe className="text-cyber-blue" />
            Subdomain Scanner
          </h2>
          <p className="text-gray-400 mt-2">Discover subdomains using multiple reconnaissance tools</p>
        </div>
        
        {lastScanDomain && results.length > 0 && !scanMutation.isLoading && (
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-blue transition-all"
              title="Copy all subdomains"
            >
              <Copy size={16} />
              Copy
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-green transition-all"
              title="Export to CSV"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-purple transition-all"
              title="Refresh results"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              onClick={clearResults}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-all"
              title="Clear all results and start fresh"
            >
              <X size={16} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Scan Configuration */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Domain Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-3 bg-dark-200 border border-dark-50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyber-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isScanning || scanMutation.isLoading}
              readOnly={isScanning || scanMutation.isLoading}
            />
          </div>

          {/* Tool Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Scanning Tools ({totalTools} selected)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.keys(scanConfig).map((tool) => (
                <label
                  key={tool}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isScanning || scanMutation.isLoading
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'cursor-pointer'
                  } ${
                    scanConfig[tool]
                      ? 'bg-cyber-blue/10 border-cyber-blue'
                      : 'bg-dark-200 border-dark-50 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={scanConfig[tool]}
                    onChange={(e) => setScanConfig({ ...scanConfig, [tool]: e.target.checked })}
                    className="w-4 h-4 text-cyber-blue bg-dark-200 border-gray-600 rounded focus:ring-cyber-blue disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isScanning || scanMutation.isLoading}
                  />
                  <span className="text-sm text-white capitalize">
                    {tool.replace('use_', '').replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
            {isScanning || scanMutation.isLoading ? (
              <p className="text-xs text-orange-400 mt-2 flex items-center gap-2">
                <Loader className="animate-spin" size={12} />
                Scan in progress - settings locked
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Enable multiple tools for better coverage
              </p>
            )}
          </div>

          {/* Submit/Cancel Buttons */}
          <div className="flex gap-3">
            {!isScanning && !scanMutation.isLoading ? (
              <button
                type="submit"
                disabled={!domain.trim() || totalTools === 0}
                className="w-full py-3 px-6 bg-gradient-to-r from-cyber-blue to-cyber-purple rounded-lg font-medium text-white hover:from-cyber-blue/90 hover:to-cyber-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Play size={20} />
                Start Scan
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-cyber-blue to-cyber-purple rounded-lg font-medium text-white opacity-75 cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Loader className="animate-spin" size={20} />
                  Scanning... {scanProgress.toFixed(0)}%
                </button>
                
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-lg font-medium text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <X size={20} />
                  Cancel Scan
                </button>
              </>
            )}
          </div>
        </form>

        {/* Progress Bar */}
        {(isScanning || scanMutation.isLoading) && !isCancelled && (
          <div className="mt-6 space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Scan Progress</span>
                <span className="text-sm font-medium text-cyber-blue">{scanProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-dark-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyber-blue to-cyber-purple transition-all duration-500 ease-out rounded-full relative overflow-hidden"
                  style={{ width: `${scanProgress}%` }}
                >
                  {/* Animated shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                </div>
              </div>
            </div>

            {/* Tool Status */}
            <div className="bg-dark-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Tool Status</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {enabledTools.map((tool) => {
                  const isComplete = completedTools.includes(tool)
                  const isScanning = scanningTools.includes(tool) && !isComplete
                  
                  return (
                    <div
                      key={tool}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                        isComplete ? 'bg-green-500/10 border border-green-500/30' :
                        isScanning ? 'bg-cyber-blue/10 border border-cyber-blue/30' :
                        'bg-dark-100 border border-dark-50'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="text-green-400 flex-shrink-0" size={16} />
                      ) : isScanning ? (
                        <Loader className="text-cyber-blue animate-spin flex-shrink-0" size={16} />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-600 flex-shrink-0"></div>
                      )}
                      <span className={`capitalize truncate ${
                        isComplete ? 'text-green-400' :
                        isScanning ? 'text-cyber-blue' :
                        'text-gray-500'
                      }`}>
                        {tool.replace('use_', '').replace('_', ' ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Current Status */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader className="animate-spin text-cyber-blue" size={16} />
              <span>
                Scanning with {totalTools} tool{totalTools !== 1 ? 's' : ''}... 
                {completedTools.length > 0 && ` (${completedTools.length}/${totalTools} completed)`}
              </span>
            </div>
          </div>
        )}

        {/* Scan Status Messages */}
        {!isScanning && scanMutation.isSuccess && !scanMutation.isLoading && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
            <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-green-400 font-medium">Scan completed successfully!</p>
              <p className="text-green-400/70 text-sm mt-1">
                Found {results.length} subdomain{results.length !== 1 ? 's' : ''} for {lastScanDomain}
              </p>
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-orange-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-orange-400 font-medium">Scan cancelled</p>
              <p className="text-orange-400/70 text-sm mt-1">
                The scan was stopped. Results may be incomplete.
              </p>
            </div>
          </div>
        )}

        {scanMutation.isError && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-400 font-medium">Scan failed</p>
              <p className="text-red-400/70 text-sm mt-1">
                {scanMutation.error?.response?.data?.detail || 'Unknown error occurred'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {lastScanDomain && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          {/* Persistence Indicator */}
          {results.length > 0 && !isScanning && dataRestoredFromCache && (
            <div className="mb-4 p-3 bg-cyber-purple/10 border border-cyber-purple/30 rounded-lg flex items-center gap-3">
              <CheckCircle className="text-cyber-purple flex-shrink-0" size={20} />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">
                  🎉 Results restored from cache
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Last scanned: {lastScanDomain} • {results.length.toLocaleString()} subdomains • Data persists across navigation
                </p>
              </div>
              <button
                onClick={clearResults}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
          )}
          
          {/* Results Header with Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                Results for {lastScanDomain}
                {isLoadingResults && (
                  <Loader className="animate-spin text-cyber-blue" size={20} />
                )}
              </h3>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-gray-400">
                  Total: <span className="text-white font-medium">{stats.total}</span>
                </span>
                <span className="text-gray-400">
                  Active: <span className="text-green-400 font-medium">{stats.active}</span>
                </span>
                <span className="text-gray-400">
                  Inactive: <span className="text-gray-500 font-medium">{stats.inactive}</span>
                </span>
              </div>
            </div>

            {results.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search subdomains..."
                  className="px-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyber-blue transition-all"
                />

                {/* Filter Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterActive('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterActive === 'all'
                        ? 'bg-cyber-blue text-white'
                        : 'bg-dark-200 text-gray-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterActive('active')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterActive === 'active'
                        ? 'bg-green-500 text-white'
                        : 'bg-dark-200 text-gray-400 hover:text-white'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => setFilterActive('inactive')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterActive === 'inactive'
                        ? 'bg-gray-500 text-white'
                        : 'bg-dark-200 text-gray-400 hover:text-white'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Empty State */}
          {results.length === 0 ? (
            <div className="text-center py-16">
              <Globe className="mx-auto text-gray-600 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-white mb-2">No subdomains found yet</h3>
              <p className="text-gray-400">Results will appear here as the scan progresses</p>
              {isLoadingResults && (
                <div className="mt-4 flex items-center justify-center gap-2 text-cyber-blue">
                  <Loader className="animate-spin" size={16} />
                  <span className="text-sm">Scanning...</span>
                </div>
              )}
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="mx-auto text-gray-600 mb-3" size={48} />
              <p className="text-gray-400">No results match your filters</p>
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilterActive('all')
                }}
                className="mt-4 text-cyber-blue hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              {/* Results Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Subdomain</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">IP Address</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">HTTP Code</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Title</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((subdomain, index) => (
                      <tr key={index} className="border-b border-dark-50 hover:bg-dark-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="text-white font-mono text-sm">{subdomain.full_domain}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-400 text-sm font-mono">
                            {subdomain.ip_address || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {subdomain.is_active ? (
                            <span className="flex items-center gap-1 text-green-400">
                              <CheckCircle size={16} />
                              <span className="text-sm">Active</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-500">
                              <XCircle size={16} />
                              <span className="text-sm">Inactive</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {subdomain.status_code ? (
                            <span className={`text-sm font-medium ${
                              subdomain.status_code >= 200 && subdomain.status_code < 300 ? 'text-green-400' :
                              subdomain.status_code >= 300 && subdomain.status_code < 400 ? 'text-yellow-400' :
                              subdomain.status_code >= 400 && subdomain.status_code < 500 ? 'text-orange-400' :
                              'text-red-400'
                            }`}>
                              {subdomain.status_code}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-400 text-sm truncate max-w-xs block" title={subdomain.title || ''}>
                            {subdomain.title || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {subdomain.is_active && (
                            <a
                              href={`https://${subdomain.full_domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-cyber-blue hover:text-cyber-blue/80 transition-colors"
                            >
                              <span className="text-sm">Visit</span>
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Results Footer */}
              <div className="mt-4 pt-4 border-t border-dark-50 flex items-center justify-between text-sm">
                <div className="text-gray-400">
                  Showing <span className="text-white font-medium">{filteredResults.length}</span> of <span className="text-white font-medium">{results.length}</span> subdomains
                </div>
                {stats.active > 0 && (
                  <div className="text-gray-400">
                    Success rate: <span className="text-green-400 font-medium">
                      {((stats.active / stats.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default SubdomainScanner
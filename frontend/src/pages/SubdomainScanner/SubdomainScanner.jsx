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
  
  const [scanProgress, setScanProgress] = useState(0)
  const [scanningTools, setScanningTools] = useState([])
  const [completedTools, setCompletedTools] = useState([])
  const [isCancelled, setIsCancelled] = useState(false)
  const [dataRestoredFromCache, setDataRestoredFromCache] = useState(false)
  
  const [isScanning, setIsScanning] = useState(false)
  
  // Store scan result summary from backend
  const [scanSummary, setScanSummary] = useState(null)

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

  // Memoize enabled tools to prevent infinite re-renders
  const enabledTools = useMemo(() => 
    Object.entries(scanConfig).filter(([_, enabled]) => enabled).map(([tool]) => tool),
    [scanConfig]
  )
  
  const totalTools = enabledTools.length

  // Check if we have cached data on mount
  useEffect(() => {
    if (!hasCheckedCache.current && lastScanDomain) {
      const cachedData = queryClient.getQueryData(['subdomains', lastScanDomain])
      if (cachedData && cachedData.length > 0) {
        console.log('✅ Found cached data for:', lastScanDomain, '- Count:', cachedData.length)
        setDataRestoredFromCache(true)
      }
      hasCheckedCache.current = true
    }
  }, [lastScanDomain, queryClient])

  // Mutation for starting scan
  const scanMutation = useMutation({
    mutationFn: startSubdomainScan,
    onSuccess: (data) => {
      setLastScanDomain(domain)
      console.log('✅ Scan completed on backend:', data)
      
      // Store the scan summary - this contains total_unique_subdomains
      setScanSummary(data)
      
      // The scan is complete! Backend has finished processing
      setScanProgress(100)
      setCompletedTools(enabledTools)
      setIsScanning(false)
      setDataRestoredFromCache(false)
      
      // Clear the progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      
      // Invalidate and refetch the subdomains query to get fresh data
      queryClient.invalidateQueries(['subdomains', domain])
    },
    onError: (error) => {
      console.error('❌ Scan failed:', error)
      setScanProgress(0)
      setIsCancelled(false)
      setIsScanning(false)
      setScanSummary(null)
      
      // Clear the interval on error
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    },
  })

  // Handle progress simulation cleanup
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  // Start progress when scan begins
  useEffect(() => {
    if (isScanning && !isCancelled) {
      // Initialize scanning state
      setScanningTools(enabledTools)
      setCompletedTools([])
      
      // Clear any existing interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      
      // Start progress simulation
      let currentProgress = 0
      let toolsCompleted = 0
      
      progressIntervalRef.current = setInterval(() => {
        // Update progress (cap at 95% until mutation completes)
        currentProgress = Math.min(currentProgress + (95 / totalTools / 10), 95)
        setScanProgress(currentProgress)

        // Simulate tools completing
        if (toolsCompleted < totalTools && currentProgress > (toolsCompleted + 1) * (95 / totalTools)) {
          toolsCompleted++
          setCompletedTools(prev => [...prev, enabledTools[toolsCompleted - 1]])
        }
      }, 3000)
    } else {
      // Clear interval when not scanning
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [isScanning, isCancelled, enabledTools, totalTools])

  // Query for fetching results
  const { data: subdomainsResponse, isLoading: isLoadingResults, refetch, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['subdomains', lastScanDomain],
    queryFn: () => getSubdomains(lastScanDomain),
    enabled: !!lastScanDomain && !isCancelled,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60 * 24,
    keepPreviousData: true,
    onSuccess: (data) => {
      console.log('📥 Query onSuccess - Subdomains:', data?.length || 0)
      
      // Only update cache indicator when not scanning
      if (data && data.length > 0 && !isScanning && !isFetching) {
        setDataRestoredFromCache(true)
      }
    },
    onError: (error) => {
      console.error('❌ Query error:', error)
    }
  })

  // Handle different response formats from the API
  const results = useMemo(() => {
    if (!subdomainsResponse) return []
    
    // If it's already an array, use it directly
    if (Array.isArray(subdomainsResponse)) {
      return subdomainsResponse
    }
    
    // If it has a 'data' property that's an array
    if (subdomainsResponse.data && Array.isArray(subdomainsResponse.data)) {
      return subdomainsResponse.data
    }
    
    // If it has a 'subdomains' property that's an array
    if (subdomainsResponse.subdomains && Array.isArray(subdomainsResponse.subdomains)) {
      return subdomainsResponse.subdomains
    }
    
    console.warn('Unexpected subdomains response format:', subdomainsResponse)
    return []
  }, [subdomainsResponse])

  // Reset cache indicator when starting new scan
  useEffect(() => {
    if (isScanning) {
      setDataRestoredFromCache(false)
      setScanSummary(null)
    }
  }, [isScanning])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!domain.trim() || isScanning) return

    // Clear previous state
    setLastScanDomain(null)
    setScanProgress(0)
    setIsCancelled(false)
    setIsScanning(true)
    setCompletedTools([])
    setScanningTools([])
    setScanSummary(null)

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
    setScanSummary(null)
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    
    queryClient.cancelQueries(['subdomains', domain])
  }

  const clearResults = () => {
    setLastScanDomain(null)
    setScanProgress(0)
    setIsCancelled(false)
    setIsScanning(false)
    setScanSummary(null)
    localStorage.removeItem(STORAGE_KEYS.LAST_SCAN_DOMAIN)
    queryClient.removeQueries(['subdomains'])
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Subdomain', 'Status', 'IP Address', 'HTTP Code']
    const rows = results.map(s => [
      s.full_domain || s.subdomain,
      s.is_active ? 'Active' : 'Inactive',
      s.ip_address || 'N/A',
      s.status_code || 'N/A'
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
    const text = results.map(s => s.full_domain || s.subdomain).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => alert('Copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err))
  }

  // Statistics - use scan summary if available, otherwise use results
  const stats = useMemo(() => {
    // If we have scan summary from backend, use total_unique_subdomains
    const total = scanSummary?.total_unique_subdomains || results.length
    const active = results.filter(s => s.is_active).length
    const inactive = results.filter(s => !s.is_active).length
    
    return { total, active, inactive }
  }, [results, scanSummary])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20">
              <Globe size={24} className="text-blue-400" />
            </div>
            Subdomain Scanner
          </h1>
          <p className="text-gray-500 mt-1">Discover subdomains using multiple reconnaissance tools</p>
        </div>
        
        {lastScanDomain && results.length > 0 && !isScanning && (
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1f1f1f] rounded-lg text-gray-400 hover:text-white hover:border-[#2a2a2a] transition-colors"
              title="Copy all subdomains"
            >
              <Copy size={16} />
              Copy
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1f1f1f] rounded-lg text-gray-400 hover:text-white hover:border-[#2a2a2a] transition-colors"
              title="Export to CSV"
            >
              <Download size={16} />
              Export
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1f1f1f] rounded-lg text-gray-400 hover:text-white hover:border-[#2a2a2a] transition-colors"
              title="Refresh results"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              onClick={clearResults}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
              title="Clear all results and start fresh"
            >
              <X size={16} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Scan Configuration */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Domain Input */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Target Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isScanning}
              readOnly={isScanning}
            />
          </div>

          {/* Tool Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3">
              Scanning Tools ({totalTools} selected)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.keys(scanConfig).map((tool) => (
                <label
                  key={tool}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isScanning
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'cursor-pointer'
                  } ${
                    scanConfig[tool]
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-[#0a0a0a] border-[#1f1f1f] hover:border-[#2a2a2a]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={scanConfig[tool]}
                    onChange={(e) => setScanConfig({ ...scanConfig, [tool]: e.target.checked })}
                    className="w-4 h-4 rounded bg-[#0a0a0a] border-[#2a2a2a] text-emerald-500 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isScanning}
                  />
                  <span className="text-sm text-white capitalize">
                    {tool.replace('use_', '').replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
            {isScanning ? (
              <p className="text-xs text-yellow-400 mt-2 flex items-center gap-2">
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
            {!isScanning ? (
              <button
                type="submit"
                disabled={!domain.trim() || totalTools === 0}
                className="w-full py-3 px-6 bg-emerald-500/20 border border-emerald-500/30 rounded-lg font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Play size={20} />
                Start Scan
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="flex-1 py-3 px-6 bg-emerald-500/20 border border-emerald-500/30 rounded-lg font-medium text-emerald-400 opacity-75 cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
        {isScanning && !isCancelled && (
          <div className="mt-6 space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Scan Progress</span>
                <span className="text-sm font-medium text-emerald-400">{scanProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[#0a0a0a] rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            {/* Tool Status */}
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1f1f1f]">
              <h4 className="text-sm font-medium text-white mb-3">Tool Status</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {enabledTools.map((tool) => {
                  const isComplete = completedTools.includes(tool)
                  const isCurrentlyScanning = scanningTools.includes(tool) && !isComplete
                  
                  return (
                    <div
                      key={tool}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                        isComplete ? 'bg-green-500/10 border border-green-500/30' :
                        isCurrentlyScanning ? 'bg-blue-500/10 border border-blue-500/30' :
                        'bg-[#111111] border border-[#1f1f1f]'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="text-green-400 flex-shrink-0" size={16} />
                      ) : isCurrentlyScanning ? (
                        <Loader className="text-blue-400 animate-spin flex-shrink-0" size={16} />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-600 flex-shrink-0"></div>
                      )}
                      <span className={`capitalize truncate ${
                        isComplete ? 'text-green-400' :
                        isCurrentlyScanning ? 'text-blue-400' :
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
              <Loader className="animate-spin text-emerald-400" size={16} />
              <span>
                Scanning with {totalTools} tool{totalTools !== 1 ? 's' : ''}... 
                {completedTools.length > 0 && ` (${completedTools.length}/${totalTools} completed)`}
              </span>
            </div>
          </div>
        )}

        {/* Scan Status Messages */}
        {!isScanning && scanMutation.isSuccess && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
            <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-green-400 font-medium">Scan completed successfully!</p>
              <p className="text-green-400/70 text-sm mt-1">
                Found {scanSummary?.total_unique_subdomains || results.length} subdomain{(scanSummary?.total_unique_subdomains || results.length) !== 1 ? 's' : ''} for {lastScanDomain}
                {scanSummary?.new_subdomains_saved !== undefined && scanSummary.new_subdomains_saved > 0 && (
                  <span className="ml-2">({scanSummary.new_subdomains_saved} new)</span>
                )}
              </p>
              {scanSummary?.tool_results && (
                <p className="text-green-400/50 text-xs mt-1">
                  Tool results: {Object.entries(scanSummary.tool_results).map(([tool, count]) => `${tool}: ${count}`).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
            <AlertTriangle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-yellow-400 font-medium">Scan cancelled</p>
              <p className="text-yellow-400/70 text-sm mt-1">
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
                {scanMutation.error?.response?.data?.detail || scanMutation.error?.message || 'Unknown error occurred'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {lastScanDomain && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
          {/* Persistence Indicator */}
          {results.length > 0 && !isScanning && dataRestoredFromCache && (
            <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center gap-3">
              <CheckCircle className="text-purple-400 flex-shrink-0" size={20} />
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
          
          {/* Results Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                Results for {lastScanDomain}
                {(isLoadingResults || isFetching) && (
                  <Loader className="animate-spin text-emerald-400" size={20} />
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
          </div>

          {/* Results Summary */}
          {results.length === 0 && !isLoadingResults ? (
            <div className="text-center py-16">
              <Globe className="mx-auto text-gray-600 mb-4" size={64} />
              <h3 className="text-xl font-semibold text-white mb-2">
                {scanSummary?.total_unique_subdomains > 0 
                  ? `${scanSummary.total_unique_subdomains} subdomains found - Loading results...` 
                  : 'No subdomains found yet'}
              </h3>
              <p className="text-gray-400">
                {scanSummary?.total_unique_subdomains > 0 
                  ? 'Please wait while we fetch the results from the database'
                  : 'Start a scan to discover subdomains'}
              </p>
              {(isLoadingResults || isFetching) && (
                <div className="mt-4 flex items-center justify-center gap-2 text-emerald-400">
                  <Loader className="animate-spin" size={16} />
                  <span className="text-sm">Loading...</span>
                </div>
              )}
              {scanSummary?.total_unique_subdomains > 0 && !isLoadingResults && (
                <button
                  onClick={() => refetch()}
                  className="mt-4 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/30 transition-all"
                >
                  <RefreshCw size={16} className="inline mr-2" />
                  Refresh Results
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Results Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-white mb-2">{stats.total}</div>
                  <div className="text-sm text-gray-400">Total Subdomains</div>
                </div>
                <div className="bg-[#0a0a0a] border border-green-500/20 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-green-400 mb-2">{stats.active}</div>
                  <div className="text-sm text-gray-400">Active Hosts</div>
                  {stats.active > 0 && stats.total > 0 && (
                    <div className="text-xs text-green-400/70 mt-1">
                      {((stats.active / stats.total) * 100).toFixed(1)}% success rate
                    </div>
                  )}
                </div>
                <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-gray-500 mb-2">{stats.inactive}</div>
                  <div className="text-sm text-gray-400">Inactive</div>
                </div>
              </div>

              {/* Export Actions */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-1">
                      Scan Complete! 🎉
                    </h4>
                    <p className="text-sm text-gray-400">
                      {stats.total.toLocaleString()} subdomains discovered for {lastScanDomain}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Export results below or view detailed analysis in the Dashboard
                    </p>
                  </div>
                  <CheckCircle className="text-green-400" size={48} />
                </div>
              </div>

              {/* Export Info Box */}
              <div className="mt-4 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Download size={16} className="text-emerald-400" />
                  Export Options
                </h4>
                <p className="text-sm text-gray-400 mb-4">
                  Results are stored and can be exported at any time. Use the buttons above to export to CSV or copy to clipboard.
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-3 py-1 bg-[#111111] border border-[#1f1f1f] rounded-full text-gray-400">
                    📄 CSV Export Available
                  </span>
                  <span className="px-3 py-1 bg-[#111111] border border-[#1f1f1f] rounded-full text-gray-400">
                    📋 Clipboard Copy Ready
                  </span>
                  <span className="px-3 py-1 bg-[#111111] border border-[#1f1f1f] rounded-full text-gray-400">
                    🔄 Results Cached
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default SubdomainScanner
import { useState, useEffect, useRef, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSubdomains } from '../../api/client'
import { 
  Search, 
  Play, 
  CheckCircle, 
  XCircle, 
  Loader, 
  Download, 
  Copy, 
  X,
  Globe,
  AlertTriangle,
  FileText,
  Zap
} from 'lucide-react'
import axios from 'axios'

const STORAGE_KEYS = {
  CONTENT_DISCOVERY_TARGET: 'content_discovery_target',
  CONTENT_DISCOVERY_RESULTS: 'content_discovery_results',
  CONTENT_DISCOVERY_CONFIG: 'content_discovery_config',
}

const ContentDiscovery = () => {
  const queryClient = useQueryClient()
  
  // Available targets (active hosts from Live Hosts)
  const [availableTargets, setAvailableTargets] = useState([])
  const [selectedTarget, setSelectedTarget] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.CONTENT_DISCOVERY_TARGET) || ''
  })
  
  // Scan configuration
  const [scanConfig, setScanConfig] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONTENT_DISCOVERY_CONFIG)
    return saved ? JSON.parse(saved) : {
      scan_type: 'quick', // quick, full, passive, fuzzing
      wordlist_size: 'small', // small, medium, large
      threads: 10,
      timeout: 300,
    }
  })
  
  // Scan state
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [currentMethod, setCurrentMethod] = useState('')
  const [discoveryResults, setDiscoveryResults] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS)
    return saved ? JSON.parse(saved) : []
  })
  
  const scanAbortController = useRef(null)

  // Persist state
  useEffect(() => {
    if (selectedTarget) {
      localStorage.setItem(STORAGE_KEYS.CONTENT_DISCOVERY_TARGET, selectedTarget)
    }
  }, [selectedTarget])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTENT_DISCOVERY_CONFIG, JSON.stringify(scanConfig))
  }, [scanConfig])

  useEffect(() => {
    if (discoveryResults.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS, JSON.stringify(discoveryResults))
    }
  }, [discoveryResults])

  // Load available targets from Live Hosts data
  useEffect(() => {
    try {
      const liveHostsData = localStorage.getItem('live_hosts_results')
      if (liveHostsData) {
        const hosts = JSON.parse(liveHostsData)
        const activeHosts = hosts
          .filter(h => h.is_active)
          .map(h => ({
            url: `${h.protocol || 'https'}://${h.subdomain}`,
            subdomain: h.subdomain,
            protocol: h.protocol
          }))
        setAvailableTargets(activeHosts)
        
        // Auto-select first target if none selected
        if (!selectedTarget && activeHosts.length > 0) {
          setSelectedTarget(activeHosts[0].url)
        }
      }
    } catch (error) {
      console.error('Failed to load targets:', error)
    }
  }, [selectedTarget])

  // Mock content discovery function (replace with actual API call)
  const discoverContent = async (targetUrl, config) => {
    const methods = ['Directory Fuzzing', 'File Discovery', 'Backup Files', 'API Endpoints']
    const results = []
    
    for (let i = 0; i < methods.length; i++) {
      if (scanAbortController.current?.signal.aborted) {
        throw new Error('Scan aborted')
      }
      
      setCurrentMethod(methods[i])
      setScanProgress(((i + 1) / methods.length) * 100)
      
      // Simulate discovery
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock results
      const mockPaths = [
        '/admin', '/api', '/backup', '/config', '/dashboard',
        '/login', '/test', '/dev', '/staging', '/.git',
        '/robots.txt', '/sitemap.xml', '/.env', '/admin.php'
      ]
      
      const discovered = mockPaths.slice(0, Math.floor(Math.random() * 8) + 3).map(path => ({
        url: `${targetUrl}${path}`,
        path: path,
        status_code: [200, 301, 403, 404][Math.floor(Math.random() * 4)],
        method: methods[i],
        content_length: Math.floor(Math.random() * 10000),
        discovered_at: new Date().toISOString()
      }))
      
      results.push(...discovered)
    }
    
    return results
  }

  // Start content discovery
  const startDiscovery = async () => {
    if (!selectedTarget || isScanning) return

    setIsScanning(true)
    setScanProgress(0)
    setDiscoveryResults([])
    scanAbortController.current = new AbortController()

    try {
      const results = await discoverContent(selectedTarget, scanConfig)
      setDiscoveryResults(results)
      setScanProgress(100)
      setIsScanning(false)
      setCurrentMethod('')
    } catch (error) {
      console.error('Content discovery error:', error)
      setIsScanning(false)
      setCurrentMethod('')
    }
  }

  // Cancel scan
  const cancelScan = () => {
    if (scanAbortController.current) {
      scanAbortController.current.abort()
    }
    setIsScanning(false)
    setCurrentMethod('')
  }

  // Clear results
  const clearResults = () => {
    setDiscoveryResults([])
    setScanProgress(0)
    localStorage.removeItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS)
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['URL', 'Path', 'Status Code', 'Method', 'Content Length']
    const rows = discoveryResults.map(r => [
      r.url,
      r.path,
      r.status_code || 'N/A',
      r.method,
      r.content_length || 'N/A'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const targetDomain = selectedTarget.split('://')[1]?.split('/')[0] || 'target'
    a.download = `${targetDomain}-content-discovery-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Copy URLs to clipboard
  const copyToClipboard = () => {
    const urls = discoveryResults.map(r => r.url).join('\n')
    navigator.clipboard.writeText(urls)
      .then(() => alert('URLs copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err))
  }

  // Statistics
  const stats = {
    total: discoveryResults.length,
    by_status: {
      success: discoveryResults.filter(r => r.status_code >= 200 && r.status_code < 300).length,
      redirect: discoveryResults.filter(r => r.status_code >= 300 && r.status_code < 400).length,
      client_error: discoveryResults.filter(r => r.status_code >= 400 && r.status_code < 500).length,
      server_error: discoveryResults.filter(r => r.status_code >= 500).length,
    },
    by_method: discoveryResults.reduce((acc, r) => {
      acc[r.method] = (acc[r.method] || 0) + 1
      return acc
    }, {}),
    interesting: discoveryResults.filter(r => 
      r.path.includes('admin') || 
      r.path.includes('api') || 
      r.path.includes('backup') ||
      r.path.includes('.git') ||
      r.path.includes('.env')
    ).length
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Search className="text-cyber-purple" />
            Content Discovery
          </h2>
          <p className="text-gray-400 mt-2">Discover hidden files, directories, and endpoints</p>
        </div>

        {discoveryResults.length > 0 && !isScanning && (
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-purple transition-all"
              title="Copy all URLs"
            >
              <Copy size={16} />
              Copy URLs
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

      {/* Scan Configuration */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <div className="space-y-6">
          {/* Target Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Target URL
            </label>
            {availableTargets.length === 0 ? (
              <div className="text-center py-8 bg-dark-200 border border-dark-50 rounded-lg">
                <Globe className="mx-auto text-gray-600 mb-3" size={48} />
                <p className="text-gray-400 mb-2">No active hosts available</p>
                <p className="text-sm text-gray-500">
                  Run Live Hosts probe first to discover active targets
                </p>
              </div>
            ) : (
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full px-4 py-3 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-purple transition-all disabled:opacity-50"
                disabled={isScanning}
              >
                <option value="">Select a target...</option>
                {availableTargets.map((target) => (
                  <option key={target.url} value={target.url}>
                    {target.url}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Scan Configuration */}
          {selectedTarget && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Scan Type
                </label>
                <select
                  value={scanConfig.scan_type}
                  onChange={(e) => setScanConfig({...scanConfig, scan_type: e.target.value})}
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white text-sm focus:outline-none focus:border-cyber-purple transition-all disabled:opacity-50"
                  disabled={isScanning}
                >
                  <option value="quick">Quick Scan</option>
                  <option value="full">Full Scan</option>
                  <option value="passive">Passive Only</option>
                  <option value="fuzzing">Fuzzing Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Wordlist Size
                </label>
                <select
                  value={scanConfig.wordlist_size}
                  onChange={(e) => setScanConfig({...scanConfig, wordlist_size: e.target.value})}
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white text-sm focus:outline-none focus:border-cyber-purple transition-all disabled:opacity-50"
                  disabled={isScanning}
                >
                  <option value="small">Small (~1K)</option>
                  <option value="medium">Medium (~10K)</option>
                  <option value="large">Large (~100K)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Threads
                </label>
                <input
                  type="number"
                  value={scanConfig.threads}
                  onChange={(e) => setScanConfig({...scanConfig, threads: Math.max(1, Math.min(50, parseInt(e.target.value) || 10))})}
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white text-sm focus:outline-none focus:border-cyber-purple transition-all disabled:opacity-50"
                  min="1"
                  max="50"
                  disabled={isScanning}
                />
              </div>
            </div>
          )}

          {/* Scan Info */}
          {selectedTarget && (
            <div className="p-4 bg-dark-200 border border-dark-50 rounded-lg">
              <div className="flex items-start gap-3">
                <FileText className="text-cyber-purple flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white mb-1">Discovery Methods</h4>
                  <p className="text-xs text-gray-400 mb-2">
                    {scanConfig.scan_type === 'quick' && 'Common paths, backup files, and API endpoints'}
                    {scanConfig.scan_type === 'full' && 'Comprehensive fuzzing, passive discovery, and endpoint analysis'}
                    {scanConfig.scan_type === 'passive' && 'Archive sources and passive enumeration only'}
                    {scanConfig.scan_type === 'fuzzing' && 'Aggressive directory and file fuzzing'}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-1 bg-dark-100 rounded text-xs text-gray-400">Directory Fuzzing</span>
                    <span className="px-2 py-1 bg-dark-100 rounded text-xs text-gray-400">File Discovery</span>
                    <span className="px-2 py-1 bg-dark-100 rounded text-xs text-gray-400">Backup Files</span>
                    <span className="px-2 py-1 bg-dark-100 rounded text-xs text-gray-400">API Endpoints</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isScanning ? (
              <button
                onClick={startDiscovery}
                disabled={!selectedTarget}
                className="w-full py-3 px-6 bg-gradient-to-r from-cyber-purple to-cyber-blue rounded-lg font-medium text-white hover:from-cyber-purple/90 hover:to-cyber-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Play size={20} />
                Start Discovery
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-cyber-purple to-cyber-blue rounded-lg font-medium text-white opacity-75 cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Loader className="animate-spin" size={20} />
                  Discovering... {scanProgress.toFixed(0)}%
                </button>
                
                <button
                  type="button"
                  onClick={cancelScan}
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
        {isScanning && (
          <div className="mt-6 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Discovery Progress</span>
                <span className="text-sm font-medium text-cyber-purple">{scanProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-dark-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyber-purple to-cyber-blue transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            {currentMethod && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader className="animate-spin text-cyber-purple" size={16} />
                <span>Current method: <span className="text-white font-medium">{currentMethod}</span></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {discoveryResults.length > 0 && !isScanning && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          {/* Completion Banner */}
          <div className="bg-gradient-to-r from-cyber-purple/10 to-cyber-blue/10 border border-cyber-purple/30 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <CheckCircle className="text-green-400" size={24} />
                  Discovery Complete! 🎉
                </h4>
                <p className="text-sm text-gray-400 mt-2">
                  Found {stats.total} endpoints/paths on <span className="text-white font-medium">{selectedTarget}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Export results above or view detailed analysis in the Dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-dark-200 border border-dark-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white mb-1">{stats.total}</div>
              <div className="text-xs text-gray-400">Total Found</div>
            </div>
            <div className="bg-dark-200 border border-green-500/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400 mb-1">{stats.by_status.success}</div>
              <div className="text-xs text-gray-400">2xx Success</div>
            </div>
            <div className="bg-dark-200 border border-yellow-500/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400 mb-1">{stats.by_status.redirect}</div>
              <div className="text-xs text-gray-400">3xx Redirect</div>
            </div>
            <div className="bg-dark-200 border border-orange-500/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-orange-400 mb-1">{stats.by_status.client_error}</div>
              <div className="text-xs text-gray-400">4xx Error</div>
            </div>
            <div className="bg-dark-200 border border-cyber-purple/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-cyber-purple mb-1">{stats.interesting}</div>
              <div className="text-xs text-gray-400">Interesting</div>
            </div>
          </div>

          {/* Export Information */}
          <div className="bg-dark-200 border border-dark-50 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyber-purple/10 rounded-lg flex-shrink-0">
                <Download className="text-cyber-purple" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white mb-2">
                  Export Your Discoveries
                </h4>
                <p className="text-sm text-gray-400 mb-4">
                  Export complete list of discovered paths, endpoints, and files with status codes and methods used. 
                  Perfect for further analysis or integration with other tools.
                </p>
                
                {/* Method Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {Object.entries(stats.by_method).map(([method, count]) => (
                    <div key={method} className="bg-dark-100 border border-dark-50 rounded px-3 py-2 text-center">
                      <div className="text-white font-semibold">{count}</div>
                      <div className="text-xs text-gray-400 truncate" title={method}>{method}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-dark-100 border border-dark-50 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">CSV Export Contains:</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-2 py-1 bg-dark-200 rounded text-xs text-white">URL</span>
                    <span className="px-2 py-1 bg-dark-200 rounded text-xs text-white">Path</span>
                    <span className="px-2 py-1 bg-dark-200 rounded text-xs text-white">Status Code</span>
                    <span className="px-2 py-1 bg-dark-200 rounded text-xs text-white">Method</span>
                    <span className="px-2 py-1 bg-dark-200 rounded text-xs text-white">Content Length</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Detailed information for comprehensive analysis
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

export default ContentDiscovery
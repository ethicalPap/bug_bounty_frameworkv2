import { useState, useEffect, useMemo } from 'react'
import { 
  Search,
  Globe,
  FileCode,
  Folder,
  FolderOpen,
  ExternalLink,
  Loader,
  Download,
  RefreshCw,
  Play,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Code,
  Key,
  Link,
  FileText,
  Settings,
  Zap,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Copy,
  Terminal,
  ToggleLeft,
  ToggleRight,
  Archive,
  Bug,
  Database
} from 'lucide-react'
import { startContentDiscovery, getContentForTarget } from '../../api/client'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Storage keys
const STORAGE_KEYS = {
  CONTENT_DISCOVERY_RESULTS: 'content_discovery_results',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
  SUBDOMAIN_RESULTS: 'subdomain_scanner_last_domain',
}

// Content type configurations
const CONTENT_TYPES = {
  endpoint: { icon: Link, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Endpoint' },
  directory: { icon: FolderOpen, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Directory' },
  file: { icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'File' },
  javascript: { icon: FileCode, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'JavaScript' },
  api: { icon: Database, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'API' },
  parameter: { icon: Key, color: 'text-pink-400', bg: 'bg-pink-500/10', label: 'Parameter' },
  archive: { icon: Archive, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Archive' },
}

// Tool configurations
const TOOLS = {
  ffuf: { name: 'ffuf', description: 'Fast web fuzzer', category: 'fuzzing' },
  feroxbuster: { name: 'Feroxbuster', description: 'Recursive content discovery', category: 'fuzzing' },
  waymore: { name: 'Waymore', description: 'Wayback Machine URLs', category: 'passive' },
  gau: { name: 'GAU', description: 'Archive URLs', category: 'passive' },
  katana: { name: 'Katana', description: 'Web crawler', category: 'crawling' },
  gospider: { name: 'GoSpider', description: 'Fast web spider', category: 'crawling' },
  linkfinder: { name: 'LinkFinder', description: 'JS endpoint extraction', category: 'js' },
  arjun: { name: 'Arjun', description: 'Parameter discovery', category: 'api' },
}

// Scan type presets
const SCAN_PRESETS = {
  quick: {
    name: 'Quick Scan',
    description: 'Fast discovery using passive methods',
    tools: ['waymore', 'gau', 'katana'],
  },
  full: {
    name: 'Full Scan',
    description: 'Comprehensive discovery with all tools',
    tools: ['ffuf', 'feroxbuster', 'waymore', 'gau', 'katana', 'gospider', 'linkfinder', 'arjun'],
  },
  passive: {
    name: 'Passive Only',
    description: 'Non-intrusive archive-based discovery',
    tools: ['waymore', 'gau'],
  },
  fuzzing: {
    name: 'Fuzzing',
    description: 'Active directory and file fuzzing',
    tools: ['ffuf', 'feroxbuster'],
  },
}

export default function ContentDiscovery() {
  // State
  const [targetUrl, setTargetUrl] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [availableTargets, setAvailableTargets] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [results, setResults] = useState([])
  const [scanProgress, setScanProgress] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [expandedItems, setExpandedItems] = useState(new Set())
  
  // Scan configuration
  const [scanConfig, setScanConfig] = useState({
    scanType: 'full',
    enabledTools: ['ffuf', 'waymore', 'gau', 'katana', 'linkfinder', 'arjun'],
    wordlist: '/opt/wordlists/common.txt',
    threads: 10,
    timeout: 600,
    rateLimit: 150,
    crawlDepth: 3,
    followRedirects: true,
  })

  // Load available targets from localStorage
  useEffect(() => {
    const loadTargets = () => {
      const targets = []
      
      // Load from live hosts
      try {
        const liveHostsData = localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
        if (liveHostsData) {
          const parsed = JSON.parse(liveHostsData)
          const hosts = parsed.results || parsed || []
          hosts.forEach(host => {
            if (host.is_active && host.url) {
              targets.push({
                url: host.url,
                subdomain: host.subdomain,
                status: host.status_code,
                source: 'live_hosts'
              })
            }
          })
        }
      } catch (e) {
        console.error('Error loading live hosts:', e)
      }
      
      setAvailableTargets(targets)
      
      // Load saved results
      try {
        const savedResults = localStorage.getItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS)
        if (savedResults) {
          setResults(JSON.parse(savedResults))
        }
      } catch (e) {
        console.error('Error loading saved results:', e)
      }
    }
    
    loadTargets()
  }, [])

  // Save results to localStorage
  useEffect(() => {
    if (results.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS, JSON.stringify(results))
    }
  }, [results])

  // Toggle tool
  const toggleTool = (toolId) => {
    setScanConfig(prev => ({
      ...prev,
      enabledTools: prev.enabledTools.includes(toolId)
        ? prev.enabledTools.filter(t => t !== toolId)
        : [...prev.enabledTools, toolId]
    }))
  }

  // Apply preset
  const applyPreset = (presetId) => {
    const preset = SCAN_PRESETS[presetId]
    if (preset) {
      setScanConfig(prev => ({
        ...prev,
        scanType: presetId,
        enabledTools: preset.tools
      }))
    }
  }

  // Start scan
  const startScan = async () => {
    if (!targetUrl) return
    
    setIsScanning(true)
    setScanProgress({ status: 'running', message: 'Starting content discovery...', progress: 0 })
    
    try {
      const response = await startContentDiscovery({
        target_url: targetUrl,
        scan_type: scanConfig.scanType,
        use_ffuf: scanConfig.enabledTools.includes('ffuf'),
        use_feroxbuster: scanConfig.enabledTools.includes('feroxbuster'),
        use_waymore: scanConfig.enabledTools.includes('waymore'),
        use_gau: scanConfig.enabledTools.includes('gau'),
        use_katana: scanConfig.enabledTools.includes('katana'),
        use_gospider: scanConfig.enabledTools.includes('gospider'),
        use_linkfinder: scanConfig.enabledTools.includes('linkfinder'),
        use_arjun: scanConfig.enabledTools.includes('arjun'),
        threads: scanConfig.threads,
        timeout: scanConfig.timeout,
        rate_limit: scanConfig.rateLimit,
        crawl_depth: scanConfig.crawlDepth,
        wordlist: scanConfig.wordlist,
      })
      
      // Process results
      const newResults = processResults(response, targetUrl)
      setResults(prev => [...newResults, ...prev])
      
      setScanProgress({ 
        status: 'completed', 
        message: `Found ${newResults.length} items`,
        progress: 100
      })
      
    } catch (error) {
      console.error('Scan failed:', error)
      setScanProgress({ 
        status: 'failed', 
        message: error.message || 'Scan failed',
        progress: 0
      })
    } finally {
      setIsScanning(false)
    }
  }

  // Process results from API
  const processResults = (response, target) => {
    const items = []
    const timestamp = new Date().toISOString()
    
    // Handle different response formats
    if (response.urls) {
      response.urls.forEach((url, idx) => {
        items.push({
          id: `${target}-${idx}-${Date.now()}`,
          url: url,
          target: target,
          type: classifyUrl(url),
          status: response.status_codes?.[idx] || null,
          source: response.sources?.[idx] || 'discovery',
          timestamp: timestamp,
          interesting: isInteresting(url),
        })
      })
    }
    
    // Handle tool-specific results
    if (response.tool_results) {
      Object.entries(response.tool_results).forEach(([tool, count]) => {
        // Tool summary
      })
    }
    
    return items
  }

  // Classify URL type
  const classifyUrl = (url) => {
    const path = new URL(url, 'https://example.com').pathname.toLowerCase()
    
    if (path.endsWith('.js') || path.includes('/js/')) return 'javascript'
    if (path.includes('/api/') || path.includes('/v1/') || path.includes('/v2/')) return 'api'
    if (path.endsWith('/') || !path.includes('.')) return 'directory'
    if (path.match(/\.(jpg|png|gif|svg|css|woff|ttf)$/)) return 'file'
    if (path.match(/\.(zip|tar|gz|bak|old)$/)) return 'archive'
    if (path.includes('?') || path.includes('=')) return 'parameter'
    
    return 'endpoint'
  }

  // Check if URL is interesting
  const isInteresting = (url) => {
    const interestingPatterns = [
      /admin/i, /config/i, /backup/i, /\.bak$/i, /\.old$/i,
      /\.git/i, /\.env/i, /debug/i, /test/i, /dev/i,
      /api/i, /secret/i, /token/i, /auth/i, /login/i,
      /upload/i, /file/i, /download/i,
    ]
    
    return interestingPatterns.some(pattern => pattern.test(url))
  }

  // Filter results
  const filteredResults = useMemo(() => {
    return results.filter(item => {
      if (filterText && !item.url.toLowerCase().includes(filterText.toLowerCase())) {
        return false
      }
      if (filterType !== 'all' && item.type !== filterType) {
        return false
      }
      if (filterStatus === 'interesting' && !item.interesting) {
        return false
      }
      return true
    })
  }, [results, filterText, filterType, filterStatus])

  // Group results by target
  const groupedResults = useMemo(() => {
    const groups = {}
    filteredResults.forEach(item => {
      const host = new URL(item.url, 'https://example.com').host
      if (!groups[host]) {
        groups[host] = []
      }
      groups[host].push(item)
    })
    return groups
  }, [filteredResults])

  // Stats
  const stats = useMemo(() => {
    const typeCount = {}
    let interesting = 0
    
    results.forEach(item => {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1
      if (item.interesting) interesting++
    })
    
    return { total: results.length, typeCount, interesting }
  }, [results])

  // Export results
  const exportResults = (format = 'json') => {
    const data = format === 'json' 
      ? JSON.stringify(results, null, 2)
      : results.map(r => r.url).join('\n')
    
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content-discovery-${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'txt'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Copy URL to clipboard
  const copyUrl = (url) => {
    navigator.clipboard.writeText(url)
  }

  // Toggle expanded item
  const toggleExpanded = (id) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Discovery</h1>
          <p className="text-gray-500 mt-1">Discover endpoints, directories, files, and APIs</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-gray-300 rounded-xl border border-[#252525] hover:bg-[#252525] transition-colors"
          >
            <Settings size={16} />
            Configure
          </button>
          {results.length > 0 && (
            <button
              onClick={() => exportResults('json')}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-gray-300 rounded-xl border border-[#252525] hover:bg-[#252525] transition-colors"
            >
              <Download size={16} />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 border border-emerald-400/30">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={18} className="text-white/80" />
            <span className="text-sm text-white/70">Total Found</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        
        {Object.entries(CONTENT_TYPES).slice(0, 5).map(([type, config]) => {
          const Icon = config.icon
          const count = stats.typeCount[type] || 0
          return (
            <div key={type} className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f]">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${config.bg}`}>
                  <Icon size={14} className={config.color} />
                </div>
                <span className="text-sm text-gray-500">{config.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Target Input */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-400 mb-2">Target URL</label>
            <div className="relative">
              <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-10 py-3 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>
          
          {availableTargets.length > 0 && (
            <div className="lg:w-80">
              <label className="block text-sm font-medium text-gray-400 mb-2">Or Select from Live Hosts</label>
              <select
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              >
                <option value="">Select a target...</option>
                {availableTargets.map((target, idx) => (
                  <option key={idx} value={target.url}>
                    {target.subdomain} ({target.status})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex items-end gap-2">
            <button
              onClick={startScan}
              disabled={!targetUrl || isScanning}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isScanning ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Start Scan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scan Progress */}
        {scanProgress && (
          <div className="mt-4 p-4 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f]">
            <div className="flex items-center gap-3">
              {scanProgress.status === 'running' && <Loader size={16} className="animate-spin text-emerald-400" />}
              {scanProgress.status === 'completed' && <CheckCircle size={16} className="text-emerald-400" />}
              {scanProgress.status === 'failed' && <XCircle size={16} className="text-red-400" />}
              <span className={`text-sm ${
                scanProgress.status === 'completed' ? 'text-emerald-400' :
                scanProgress.status === 'failed' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {scanProgress.message}
              </span>
            </div>
            {scanProgress.status === 'running' && (
              <div className="mt-3 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${scanProgress.progress}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings size={20} className="text-emerald-400" />
            Scan Configuration
          </h3>

          {/* Presets */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-400">Scan Presets</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(SCAN_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => applyPreset(id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    scanConfig.scanType === id
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-[#0a0a0a] border-[#1f1f1f] text-gray-400 hover:border-[#252525]'
                  }`}
                >
                  <div className="font-medium text-white text-sm">{preset.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-400">Enabled Tools</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(TOOLS).map(([id, tool]) => {
                const isEnabled = scanConfig.enabledTools.includes(id)
                return (
                  <button
                    key={id}
                    onClick={() => toggleTool(id)}
                    className={`p-3 rounded-xl border transition-all ${
                      isEnabled
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-[#0a0a0a] border-[#1f1f1f] opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-medium text-sm ${isEnabled ? 'text-white' : 'text-gray-400'}`}>
                          {tool.name}
                        </div>
                        <div className="text-xs text-gray-500">{tool.description}</div>
                      </div>
                      {isEnabled ? (
                        <ToggleRight size={20} className="text-emerald-500" />
                      ) : (
                        <ToggleLeft size={20} className="text-gray-600" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Threads</label>
              <input
                type="number"
                value={scanConfig.threads}
                onChange={(e) => setScanConfig(prev => ({ ...prev, threads: parseInt(e.target.value) || 10 }))}
                className="w-full bg-[#0a0a0a] text-white px-3 py-2 rounded-xl border border-[#1f1f1f] focus:border-emerald-500/50 transition-colors"
                min={1}
                max={50}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Timeout (s)</label>
              <input
                type="number"
                value={scanConfig.timeout}
                onChange={(e) => setScanConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) || 600 }))}
                className="w-full bg-[#0a0a0a] text-white px-3 py-2 rounded-xl border border-[#1f1f1f] focus:border-emerald-500/50 transition-colors"
                min={60}
                max={1800}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Rate Limit (req/s)</label>
              <input
                type="number"
                value={scanConfig.rateLimit}
                onChange={(e) => setScanConfig(prev => ({ ...prev, rateLimit: parseInt(e.target.value) || 150 }))}
                className="w-full bg-[#0a0a0a] text-white px-3 py-2 rounded-xl border border-[#1f1f1f] focus:border-emerald-500/50 transition-colors"
                min={10}
                max={500}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Crawl Depth</label>
              <input
                type="number"
                value={scanConfig.crawlDepth}
                onChange={(e) => setScanConfig(prev => ({ ...prev, crawlDepth: parseInt(e.target.value) || 3 }))}
                className="w-full bg-[#0a0a0a] text-white px-3 py-2 rounded-xl border border-[#1f1f1f] focus:border-emerald-500/50 transition-colors"
                min={1}
                max={5}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter URLs..."
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl pl-10 pr-4 py-2.5 text-white placeholder:text-gray-500 focus:border-emerald-500/50 transition-colors"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-4 py-2.5 text-white focus:border-emerald-500/50 transition-colors"
            >
              <option value="all">All Types</option>
              {Object.entries(CONTENT_TYPES).map(([type, config]) => (
                <option key={type} value={type}>{config.label}</option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl px-4 py-2.5 text-white focus:border-emerald-500/50 transition-colors"
            >
              <option value="all">All Results</option>
              <option value="interesting">Interesting Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a1a] flex items-center justify-center">
              <Search size={32} className="text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No content discovered</h3>
            <p className="text-gray-500">Enter a target URL and start scanning to discover endpoints</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1f1f1f]">
            {Object.entries(groupedResults).map(([host, items]) => (
              <div key={host} className="bg-[#0a0a0a]">
                {/* Group Header */}
                <button
                  onClick={() => toggleExpanded(host)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedItems.has(host) ? (
                      <ChevronDown size={18} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={18} className="text-gray-400" />
                    )}
                    <Globe size={18} className="text-emerald-400" />
                    <span className="font-medium text-white">{host}</span>
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg border border-emerald-500/30">
                      {items.length} items
                    </span>
                  </div>
                </button>
                
                {/* Group Items */}
                {expandedItems.has(host) && (
                  <div className="border-t border-[#1f1f1f]">
                    {items.map((item) => {
                      const typeConfig = CONTENT_TYPES[item.type] || CONTENT_TYPES.endpoint
                      const Icon = typeConfig.icon
                      
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 px-4 py-3 hover:bg-[#1a1a1a] transition-colors border-b border-[#1f1f1f] last:border-b-0 ${
                            item.interesting ? 'bg-yellow-500/5' : ''
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${typeConfig.bg}`}>
                            <Icon size={16} className={typeConfig.color} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-white truncate">
                                {new URL(item.url, 'https://example.com').pathname}
                              </span>
                              {item.interesting && (
                                <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] rounded border border-yellow-500/30">
                                  Interesting
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className={typeConfig.color}>{typeConfig.label}</span>
                              {item.status && (
                                <span className={
                                  item.status >= 200 && item.status < 300 ? 'text-emerald-400' :
                                  item.status >= 300 && item.status < 400 ? 'text-blue-400' :
                                  item.status >= 400 ? 'text-red-400' : 'text-gray-400'
                                }>
                                  {item.status}
                                </span>
                              )}
                              <span>{item.source}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyUrl(item.url)}
                              className="p-2 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
                              title="Copy URL"
                            >
                              <Copy size={14} />
                            </button>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
                              title="Open in new tab"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {filteredResults.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          Showing {filteredResults.length} of {results.length} discovered items
        </div>
      )}
    </div>
  )
}
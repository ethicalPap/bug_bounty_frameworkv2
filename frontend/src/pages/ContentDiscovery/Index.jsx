/**
 * Content Discovery - Main Hub Page
 * Contains scan controls and overview stats
 * Links to specific category pages
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  Search,
  Globe,
  Play,
  Loader,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Link as LinkIcon,
  FolderOpen,
  FileCode,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Trash2,
  Activity,
  Server,
  Edit3,
  List,
  CheckSquare
} from 'lucide-react'
import { startContentDiscovery } from '../../api/client'
import { useContentDiscovery, CONTENT_TYPES } from '../../stores/contentDiscoveryStore.jsx'

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

// Scan presets
const SCAN_PRESETS = {
  quick: {
    name: 'Quick Scan',
    description: 'Fast passive discovery',
    tools: ['waymore', 'gau', 'katana'],
  },
  full: {
    name: 'Full Scan', 
    description: 'Comprehensive discovery',
    tools: ['ffuf', 'feroxbuster', 'waymore', 'gau', 'katana', 'gospider', 'linkfinder', 'arjun'],
  },
  passive: {
    name: 'Passive Only',
    description: 'Archive-based only',
    tools: ['waymore', 'gau'],
  },
  fuzzing: {
    name: 'Fuzzing',
    description: 'Active fuzzing',
    tools: ['ffuf', 'feroxbuster'],
  },
}

// Target source options
const TARGET_SOURCES = {
  manual: { id: 'manual', label: 'Manual Entry', icon: Edit3, description: 'Enter a URL manually' },
  subdomains: { id: 'subdomains', label: 'Subdomains', icon: Globe, description: 'Select from discovered subdomains' },
  liveHosts: { id: 'liveHosts', label: 'Live Hosts', icon: Activity, description: 'Select from probed live hosts' },
}

// Icon mapping
const iconMap = {
  Database,
  Link: LinkIcon,
  FolderOpen,
  FileCode
}

export default function ContentDiscoveryIndex() {
  const { 
    items, 
    stats, 
    isScanning, 
    scanProgress, 
    startScan, 
    updateProgress, 
    endScan, 
    addItems,
    clearItems 
  } = useContentDiscovery()

  // Target selection state
  const [targetSource, setTargetSource] = useState('manual')
  const [targetUrl, setTargetUrl] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [selectedTargets, setSelectedTargets] = useState([]) // For multi-select
  const [selectAll, setSelectAll] = useState(false)
  
  // Config state
  const [showConfig, setShowConfig] = useState(false)
  const [scanConfig, setScanConfig] = useState({
    scanType: 'full',
    enabledTools: ['ffuf', 'waymore', 'gau', 'katana', 'linkfinder', 'arjun'],
    wordlist: '/opt/wordlists/common.txt',
    threads: 10,
    timeout: 600,
    rateLimit: 150,
    crawlDepth: 3,
  })

  // Available domains from subdomain scans (from localStorage)
  const [availableDomains, setAvailableDomains] = useState([])
  
  // Get subdomains for selected domain
  const [subdomainsList, setSubdomainsList] = useState([])
  
  // All subdomains data from localStorage
  const [allSubdomainsData, setAllSubdomainsData] = useState({})
  
  // Live hosts from localStorage
  const [liveHosts, setLiveHosts] = useState([])

  // Load subdomain data from localStorage
  useEffect(() => {
    const loadSubdomainData = () => {
      try {
        const saved = localStorage.getItem('subdomain_scan_results')
        if (saved) {
          const parsed = JSON.parse(saved)
          // parsed could be:
          // 1. Object keyed by domain: { "example.com": [...subdomains] }
          // 2. Array of subdomains for a single domain
          // 3. Object with a different structure
          
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            // It's an object - could be keyed by domain or have other structure
            const domains = Object.keys(parsed).filter(d => {
              const subs = parsed[d]
              return Array.isArray(subs) && subs.length > 0
            })
            
            if (domains.length > 0) {
              setAllSubdomainsData(parsed)
              setAvailableDomains(domains)
              console.log('📋 [Content Discovery] Loaded domains from localStorage:', domains)
            }
          }
        }
      } catch (e) {
        console.error('Error loading subdomain data:', e)
      }
    }

    loadSubdomainData()
    
    // Listen for storage changes (in case subdomain scanner updates from another tab)
    const handleStorageChange = (e) => {
      if (e.key === 'subdomain_scan_results') {
        loadSubdomainData()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    
    // Also poll periodically in case same-tab updates
    const interval = setInterval(loadSubdomainData, 2000)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // Update subdomains list when domain is selected
  useEffect(() => {
    if (!selectedDomain || !allSubdomainsData[selectedDomain]) {
      setSubdomainsList([])
      return
    }

    const subs = allSubdomainsData[selectedDomain]
    
    // Normalize to have full_domain
    const normalized = subs.map(sub => {
      if (typeof sub === 'string') {
        return { full_domain: sub, subdomain: sub, source: 'unknown' }
      }
      return {
        full_domain: sub.full_domain || sub.subdomain || sub.name || String(sub),
        subdomain: sub.subdomain || sub.full_domain || sub.name || String(sub),
        source: sub.source || 'unknown',
        ...sub
      }
    })
    
    setSubdomainsList(normalized)
  }, [selectedDomain, allSubdomainsData])

  // Load live hosts from localStorage
  useEffect(() => {
    try {
      const liveHostsData = localStorage.getItem('live_hosts_results')
      if (liveHostsData) {
        const parsed = JSON.parse(liveHostsData)
        const hosts = Array.isArray(parsed) ? parsed : (parsed.results || [])
        const activeHosts = hosts.filter(h => h.is_active)
        setLiveHosts(activeHosts)
      }
    } catch (e) {
      console.error('Error loading live hosts:', e)
    }
  }, [])

  // Handle select all toggle
  useEffect(() => {
    if (selectAll) {
      if (targetSource === 'subdomains') {
        setSelectedTargets(subdomainsList.map(s => `https://${s.full_domain}`))
      } else if (targetSource === 'liveHosts') {
        setSelectedTargets(liveHosts.map(h => h.url || `https://${h.subdomain}`))
      }
    }
  }, [selectAll, targetSource, subdomainsList, liveHosts])

  // Toggle individual target selection
  const toggleTarget = (url) => {
    setSelectedTargets(prev => 
      prev.includes(url) 
        ? prev.filter(t => t !== url)
        : [...prev, url]
    )
    setSelectAll(false)
  }

  // Get display list based on source
  const displayList = useMemo(() => {
    if (targetSource === 'subdomains') {
      return subdomainsList.map(s => ({
        url: `https://${s.full_domain}`,
        label: s.full_domain,
        extra: s.source || 'subdomain'
      }))
    } else if (targetSource === 'liveHosts') {
      return liveHosts.map(h => ({
        url: h.url || `https://${h.subdomain}`,
        label: h.subdomain,
        extra: `${h.status_code || 'N/A'} - ${h.protocol || 'https'}`
      }))
    }
    return []
  }, [targetSource, subdomainsList, liveHosts])

  const toggleTool = (toolId) => {
    setScanConfig(prev => ({
      ...prev,
      enabledTools: prev.enabledTools.includes(toolId)
        ? prev.enabledTools.filter(t => t !== toolId)
        : [...prev.enabledTools, toolId]
    }))
  }

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

  // Get targets to scan
  const getTargetsToScan = () => {
    if (targetSource === 'manual') {
      return targetUrl ? [targetUrl] : []
    }
    return selectedTargets
  }

  const handleStartScan = async () => {
    const targets = getTargetsToScan()
    if (targets.length === 0 || isScanning) return

    // For now, scan first target (can extend to batch later)
    const target = targets[0]
    startScan(target)

    try {
      const response = await startContentDiscovery({
        target_url: target,
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

      // Process and add results
      const newItems = (response.discovered_urls || []).map(item => ({
        ...item,
        target_url: target,
        subdomain: new URL(target).hostname,
        scan_id: response.scan_id
      }))

      addItems(newItems)
      endScan(true, newItems.length)
    } catch (error) {
      console.error('Scan failed:', error)
      endScan(false, 0)
    }
  }

  // Category cards configuration
  const categoryCards = [
    { 
      type: 'api', 
      path: '/content-discovery/apis',
      config: CONTENT_TYPES.api 
    },
    { 
      type: 'endpoint', 
      path: '/content-discovery/endpoints',
      config: CONTENT_TYPES.endpoint 
    },
    { 
      type: 'directory', 
      path: '/content-discovery/directories',
      config: CONTENT_TYPES.directory 
    },
    { 
      type: 'javascript', 
      path: '/content-discovery/js-files',
      config: CONTENT_TYPES.javascript 
    },
  ]

  const targetsToScan = getTargetsToScan()

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Discovery</h1>
          <p className="text-gray-500 mt-1">Discover endpoints, directories, APIs, and JavaScript files</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-gray-300 rounded-xl border border-[#252525] hover:bg-[#252525] transition-colors"
          >
            <Settings size={16} />
            Configure
          </button>
          {items.length > 0 && (
            <button
              onClick={clearItems}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={16} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 border border-emerald-400/30">
          <div className="flex items-center gap-2 mb-2">
            <Search size={18} className="text-white/80" />
            <span className="text-sm text-white/70">Total Found</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>

        {/* Category stats */}
        {categoryCards.map(({ type, config }) => {
          const Icon = iconMap[config.icon]
          const count = stats.byType[type] || 0
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

      {/* Target Selection */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-5 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Server size={20} className="text-emerald-400" />
          Select Targets
        </h3>

        {/* Source Selection Tabs */}
        <div className="flex gap-2">
          {Object.values(TARGET_SOURCES).map(source => {
            const Icon = source.icon
            const isActive = targetSource === source.id
            return (
              <button
                key={source.id}
                onClick={() => {
                  setTargetSource(source.id)
                  setSelectedTargets([])
                  setSelectAll(false)
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-[#0a0a0a] border-[#1f1f1f] text-gray-400 hover:border-[#252525]'
                }`}
              >
                <Icon size={16} />
                <span className="font-medium">{source.label}</span>
                {source.id === 'subdomains' && availableDomains.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 rounded text-xs">
                    {Object.values(allSubdomainsData).reduce((sum, subs) => sum + (Array.isArray(subs) ? subs.length : 0), 0)}
                  </span>
                )}
                {source.id === 'liveHosts' && liveHosts.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 rounded text-xs">
                    {liveHosts.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Manual Entry */}
        {targetSource === 'manual' && (
          <div>
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
        )}

        {/* Subdomain Selection */}
        {targetSource === 'subdomains' && (
          <div className="space-y-4">
            {availableDomains.length === 0 ? (
              <div className="text-center py-8 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f]">
                <Globe className="mx-auto text-gray-600 mb-3" size={40} />
                <p className="text-gray-400">No domains available</p>
                <p className="text-sm text-gray-500 mt-1">Run a subdomain scan first</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Select Domain</label>
                  <select
                    value={selectedDomain}
                    onChange={(e) => {
                      setSelectedDomain(e.target.value)
                      setSelectedTargets([])
                      setSelectAll(false)
                    }}
                    className="w-full bg-[#1a1a1a] border border-[#252525] rounded-xl px-4 py-3 text-white focus:border-emerald-500/50"
                  >
                    <option value="">Choose a domain...</option>
                    {availableDomains.map(domain => (
                      <option key={domain} value={domain}>{domain}</option>
                    ))}
                  </select>
                </div>

                {selectedDomain && subdomainsList.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-400">
                        Select Subdomains ({selectedTargets.length} of {subdomainsList.length} selected)
                      </label>
                      <button
                        onClick={() => {
                          setSelectAll(!selectAll)
                          if (!selectAll) {
                            setSelectedTargets(subdomainsList.map(s => `https://${s.full_domain}`))
                          } else {
                            setSelectedTargets([])
                          }
                        }}
                        className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300"
                      >
                        <CheckSquare size={14} />
                        {selectAll ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto bg-[#0a0a0a] rounded-xl border border-[#1f1f1f] divide-y divide-[#1f1f1f]">
                      {displayList.map((item, idx) => (
                        <label
                          key={idx}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTargets.includes(item.url)}
                            onChange={() => toggleTarget(item.url)}
                            className="w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-emerald-500 focus:ring-emerald-500/20"
                          />
                          <span className="flex-1 text-white font-mono text-sm truncate">{item.label}</span>
                          <span className="text-xs text-gray-500">{item.extra}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Live Hosts Selection */}
        {targetSource === 'liveHosts' && (
          <div className="space-y-4">
            {liveHosts.length === 0 ? (
              <div className="text-center py-8 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f]">
                <Activity className="mx-auto text-gray-600 mb-3" size={40} />
                <p className="text-gray-400">No live hosts available</p>
                <p className="text-sm text-gray-500 mt-1">Run HTTP probing first in Live Hosts</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-400">
                    Select Live Hosts ({selectedTargets.length} of {liveHosts.length} selected)
                  </label>
                  <button
                    onClick={() => {
                      setSelectAll(!selectAll)
                      if (!selectAll) {
                        setSelectedTargets(liveHosts.map(h => h.url || `https://${h.subdomain}`))
                      } else {
                        setSelectedTargets([])
                      }
                    }}
                    className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    <CheckSquare size={14} />
                    {selectAll ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto bg-[#0a0a0a] rounded-xl border border-[#1f1f1f] divide-y divide-[#1f1f1f]">
                  {displayList.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTargets.includes(item.url)}
                        onChange={() => toggleTarget(item.url)}
                        className="w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-emerald-500 focus:ring-emerald-500/20"
                      />
                      <span className="flex-1 text-white font-mono text-sm truncate">{item.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        item.extra.includes('200') ? 'bg-green-500/20 text-green-400' :
                        item.extra.includes('30') ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {item.extra}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Start Scan Button */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-gray-500">
            {targetsToScan.length > 0 ? (
              <span className="text-emerald-400">{targetsToScan.length} target{targetsToScan.length !== 1 ? 's' : ''} selected</span>
            ) : (
              <span>No targets selected</span>
            )}
          </div>
          <button
            onClick={handleStartScan}
            disabled={targetsToScan.length === 0 || isScanning}
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

        {/* Scan Progress */}
        {scanProgress && (
          <div className="p-4 bg-[#0a0a0a] rounded-xl border border-[#1f1f1f]">
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
                className="w-full bg-[#0a0a0a] text-white px-3 py-2 rounded-xl border border-[#1f1f1f]"
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
                className="w-full bg-[#0a0a0a] text-white px-3 py-2 rounded-xl border border-[#1f1f1f]"
                min={60}
                max={1800}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Rate Limit</label>
              <input
                type="number"
                value={scanConfig.rateLimit}
                onChange={(e) => setScanConfig(prev => ({ ...prev, rateLimit: parseInt(e.target.value) || 150 }))}
                className="w-full bg-[#0a0a0a] text-white px-3 py-2 rounded-xl border border-[#1f1f1f]"
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
                className="w-full bg-[#0a0a0a] text-white px-3 py-2 rounded-xl border border-[#1f1f1f]"
                min={1}
                max={5}
              />
            </div>
          </div>
        </div>
      )}

      {/* Category Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categoryCards.map(({ type, path, config }) => {
          const Icon = iconMap[config.icon]
          const count = stats.byType[type] || 0
          
          return (
            <Link
              key={type}
              to={path}
              className={`group bg-[#111111] rounded-xl p-5 border ${config.border} hover:bg-[#1a1a1a] transition-all`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${config.bg}`}>
                  <Icon size={24} className={config.color} />
                </div>
                <ChevronRight size={20} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-white mt-4">{config.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{config.description}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className={`text-2xl font-bold ${config.color}`}>{count}</span>
                <span className="text-sm text-gray-500">items found</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* View All Link */}
      <Link
        to="/content-discovery/all"
        className="block bg-[#111111] rounded-xl p-5 border border-[#1f1f1f] hover:bg-[#1a1a1a] hover:border-emerald-500/30 transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <Search size={24} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">View All Content</h3>
              <p className="text-sm text-gray-500 mt-1">Browse all {stats.total} discovered items across all categories</p>
            </div>
          </div>
          <ChevronRight size={24} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
        </div>
      </Link>
    </div>
  )
}
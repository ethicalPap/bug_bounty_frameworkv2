/**
 * ContentScanPanel - Shared scanning interface for Content Discovery pages
 * Used by APIs, Endpoints, Directories, JS Files pages
 * 
 * Features:
 * - Target selection: Manual URL, Subdomain multi-select, Live Hosts multi-select
 * - Tool selection based on scan type (API, Endpoint, Directory, JS)
 * - Batch scanning with progress tracking
 * - Select All / Scan All functionality
 * - Persistent scan logs (survives navigation)
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Play,
  Loader,
  Globe,
  Activity,
  Edit3,
  Settings,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle,
  CheckSquare,
  Square,
  X,
  Trash2
} from 'lucide-react'
import { getDomains, getSubdomains, startContentDiscovery } from '../../api/client'

// Storage key for scan logs
const CONTENT_SCAN_LOGS_KEY = 'content_scan_logs'

// Load persisted scan logs
const loadScanLogs = (scanType) => {
  try {
    const saved = localStorage.getItem(`${CONTENT_SCAN_LOGS_KEY}_${scanType}`)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('Error loading scan logs:', e)
  }
  return { logs: [], lastScan: null, results: { successCount: 0, failCount: 0, totalItems: 0 } }
}

// Save scan logs
const saveScanLogs = (scanType, data) => {
  try {
    localStorage.setItem(`${CONTENT_SCAN_LOGS_KEY}_${scanType}`, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString()
    }))
  } catch (e) {
    console.error('Error saving scan logs:', e)
  }
}

// Tool definitions by scan type - only show relevant tools for each type
const SCAN_TYPE_TOOLS = {
  api: {
    label: 'API Discovery Scan',
    description: 'Tools optimized for finding API endpoints, REST routes, and GraphQL',
    categories: {
      passive: {
        label: 'Passive/Archive',
        tools: {
          waymore: { name: 'Waymore', description: 'Wayback Machine URLs' },
          gau: { name: 'GAU', description: 'Archive URLs with API patterns' },
        }
      },
      crawling: {
        label: 'API Crawling',
        tools: {
          katana: { name: 'Katana', description: 'Fast crawler with API detection' },
          zapspider: { name: 'ZAP Spider', description: 'OWASP ZAP API spider' },
          zapajax: { name: 'ZAP Ajax', description: 'Ajax/SPA API discovery' },
        }
      },
      apiSpecific: {
        label: 'API Analysis',
        tools: {
          paramspider: { name: 'ParamSpider', description: 'API parameter mining' },
        }
      }
    },
    defaultTools: ['waymore', 'gau', 'katana', 'zapspider']
  },
  
  endpoint: {
    label: 'Endpoint Discovery Scan',
    description: 'Tools for finding web endpoints, forms, and application routes',
    categories: {
      passive: {
        label: 'Passive/Archive',
        tools: {
          waymore: { name: 'Waymore', description: 'Historical endpoint URLs' },
          gau: { name: 'GAU', description: 'Archive endpoint discovery' },
        }
      },
      crawling: {
        label: 'Web Crawling',
        tools: {
          katana: { name: 'Katana', description: 'Fast endpoint crawler' },
          gospider: { name: 'GoSpider', description: 'Web spider with forms' },
          hakrawler: { name: 'Hakrawler', description: 'Simple endpoint crawler' },
        }
      }
    },
    defaultTools: ['waymore', 'gau', 'katana', 'gospider']
  },
  
  directory: {
    label: 'Directory Discovery Scan',
    description: 'Tools for finding directories, backup files, and hidden paths',
    categories: {
      passive: {
        label: 'Passive/Archive',
        tools: {
          waymore: { name: 'Waymore', description: 'Historical directory URLs' },
          gau: { name: 'GAU', description: 'Archive directory discovery' },
        }
      },
      crawling: {
        label: 'Directory Crawling',
        tools: {
          katana: { name: 'Katana', description: 'Directory enumeration' },
          gospider: { name: 'GoSpider', description: 'Path discovery spider' },
          hakrawler: { name: 'Hakrawler', description: 'Simple directory crawler' },
        }
      }
    },
    defaultTools: ['waymore', 'gau', 'katana', 'gospider']
  },
  
  javascript: {
    label: 'JavaScript Discovery Scan',
    description: 'Tools for finding JS files and extracting endpoints from them',
    categories: {
      passive: {
        label: 'Passive/Archive',
        tools: {
          waymore: { name: 'Waymore', description: 'Historical JS file URLs' },
          gau: { name: 'GAU', description: 'Archive JS discovery' },
        }
      },
      crawling: {
        label: 'JS Crawling',
        tools: {
          katana: { name: 'Katana', description: 'JS-aware crawler' },
          zapajax: { name: 'ZAP Ajax', description: 'Ajax/JS file discovery' },
        }
      },
      jsAnalysis: {
        label: 'JS Analysis',
        tools: {
          linkfinder: { name: 'LinkFinder', description: 'Extract endpoints from JS' },
          xnlinkfinder: { name: 'xnLinkFinder', description: 'Advanced JS link extraction' },
          jsluice: { name: 'JSLuice', description: 'Extract URLs from JS files' },
        }
      }
    },
    defaultTools: ['waymore', 'gau', 'katana', 'linkfinder', 'xnlinkfinder']
  }
}

// Target source types
const TARGET_SOURCES = {
  manual: { id: 'manual', label: 'Manual URL', icon: Edit3 },
  subdomain: { id: 'subdomain', label: 'Subdomain', icon: Globe },
  liveHost: { id: 'liveHost', label: 'Live Host', icon: Activity }
}

export default function ContentScanPanel({ 
  scanType = 'endpoint', // 'api', 'endpoint', 'directory', 'javascript'
  onScanComplete,
  onScanStart,
  compact = false 
}) {
  const scanConfig = SCAN_TYPE_TOOLS[scanType] || SCAN_TYPE_TOOLS.endpoint
  
  // Target selection
  const [targetSource, setTargetSource] = useState('manual')
  const [manualTarget, setManualTarget] = useState('')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [selectedTargets, setSelectedTargets] = useState([]) // Multi-select
  const [selectAll, setSelectAll] = useState(false)
  
  // Tool configuration
  const [showConfig, setShowConfig] = useState(false)
  const [enabledTools, setEnabledTools] = useState(scanConfig.defaultTools || [])
  
  // Scan state
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(null)
  const [scanError, setScanError] = useState(null)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentTarget: '' })
  
  // Persistent scan logs - use lazy initializer to load from localStorage
  const [scanLogs, setScanLogs] = useState(() => {
    const data = loadScanLogs(scanType)
    return data.logs || []
  })
  const [lastScanResults, setLastScanResults] = useState(() => {
    const data = loadScanLogs(scanType)
    return data.results || { successCount: 0, failCount: 0, totalItems: 0 }
  })
  
  // Live hosts from localStorage
  const [liveHosts, setLiveHosts] = useState([])

  // Save logs whenever they change
  useEffect(() => {
    saveScanLogs(scanType, {
      logs: scanLogs,
      results: lastScanResults,
      lastScan: scanLogs.length > 0 ? new Date().toISOString() : null
    })
  }, [scanLogs, lastScanResults, scanType])

  // Add log entry helper
  const addLog = useCallback((message, type = 'info') => {
    setScanLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      message,
      type
    }])
  }, [])

  // Clear logs
  const clearLogs = useCallback(() => {
    setScanLogs([])
    setLastScanResults({ successCount: 0, failCount: 0, totalItems: 0 })
    localStorage.removeItem(`${CONTENT_SCAN_LOGS_KEY}_${scanType}`)
  }, [scanType])

  // Fetch domains from backend
  const { data: domainsData, isLoading: isLoadingDomains } = useQuery({
    queryKey: ['domains'],
    queryFn: getDomains,
    staleTime: 30000,
  })

  // Parse domains
  const availableDomains = useMemo(() => {
    if (!domainsData) return []
    if (typeof domainsData === 'string') return [domainsData]
    if (Array.isArray(domainsData)) {
      return domainsData.map(d => typeof d === 'string' ? d : d.domain || d.name).filter(Boolean)
    }
    if (domainsData.domains) return domainsData.domains.map(d => typeof d === 'string' ? d : d.domain).filter(Boolean)
    return []
  }, [domainsData])

  // Fetch subdomains for selected domain
  const { data: subdomainsData, isLoading: isLoadingSubdomains } = useQuery({
    queryKey: ['subdomains', selectedDomain],
    queryFn: () => getSubdomains(selectedDomain),
    enabled: !!selectedDomain,
    staleTime: 60000,
  })

  // Parse subdomains
  const subdomainsList = useMemo(() => {
    if (!subdomainsData) return []
    let subs = []
    if (Array.isArray(subdomainsData)) subs = subdomainsData
    else if (subdomainsData.data) subs = subdomainsData.data
    else if (subdomainsData.subdomains) subs = subdomainsData.subdomains
    
    return subs.map(s => {
      const name = typeof s === 'string' ? s : s.full_domain || s.subdomain || s.name
      return { name, url: `https://${name}` }
    }).filter(s => s.name)
  }, [subdomainsData])

  // Load live hosts
  useEffect(() => {
    try {
      const saved = localStorage.getItem('live_hosts_results')
      if (saved) {
        const parsed = JSON.parse(saved)
        const hosts = Array.isArray(parsed) ? parsed : (parsed.results || [])
        setLiveHosts(hosts.filter(h => h.is_active).map(h => ({
          ...h,
          name: h.subdomain,
          url: h.url || `https://${h.subdomain}`
        })))
      }
    } catch (e) {
      console.error('Error loading live hosts:', e)
    }
  }, [])

  // Reset selections when source changes
  useEffect(() => {
    setSelectedTargets([])
    setSelectAll(false)
  }, [targetSource, selectedDomain])

  // Get current list based on source
  const currentList = useMemo(() => {
    if (targetSource === 'subdomain') return subdomainsList
    if (targetSource === 'liveHost') return liveHosts
    return []
  }, [targetSource, subdomainsList, liveHosts])

  // Toggle single target
  const toggleTarget = (url) => {
    setSelectedTargets(prev => 
      prev.includes(url) ? prev.filter(t => t !== url) : [...prev, url]
    )
  }

  // Toggle all targets
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedTargets([])
    } else {
      setSelectedTargets(currentList.map(t => t.url))
    }
    setSelectAll(!selectAll)
  }

  // Toggle tool
  const toggleTool = (toolId) => {
    setEnabledTools(prev => 
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    )
  }

  // Get targets to scan
  const getTargetsToScan = () => {
    if (targetSource === 'manual') {
      return manualTarget ? [manualTarget] : []
    }
    return selectedTargets
  }

  // Scan a single target
  const scanSingleTarget = async (target) => {
    try {
      const toolFlags = {
        use_waymore: enabledTools.includes('waymore'),
        use_gau: enabledTools.includes('gau'),
        use_katana: enabledTools.includes('katana'),
        use_gospider: enabledTools.includes('gospider'),
        use_hakrawler: enabledTools.includes('hakrawler'),
        use_linkfinder: enabledTools.includes('linkfinder') || enabledTools.includes('xnlinkfinder'),
        use_paramspider: enabledTools.includes('paramspider'),
        use_jsluice: enabledTools.includes('jsluice'),
        use_zap_spider: enabledTools.includes('zapspider'),
        use_zap_ajax: enabledTools.includes('zapajax'),
      }

      const response = await startContentDiscovery({
        target_url: target,
        scan_type: scanType,
        ...toolFlags,
        threads: 10,
        timeout: 300,
        crawl_depth: 3,
      })

      return { 
        success: true, 
        results: response.discovered_urls || [], 
        target,
        scanId: response.scan_id 
      }
    } catch (error) {
      console.error(`Scan failed for ${target}:`, error)
      return { success: false, results: [], target, error: error.message }
    }
  }

  // Start scan (batch support)
  const handleStartScan = async () => {
    const targets = getTargetsToScan()
    if (targets.length === 0 || isScanning) return

    setIsScanning(true)
    setScanError(null)
    setScanProgress({ status: 'running', message: 'Starting scan...', progress: 0 })
    setBatchProgress({ current: 0, total: targets.length, currentTarget: '' })
    
    // Clear previous logs for new scan
    setScanLogs([])
    addLog(`Starting ${scanConfig.label} on ${targets.length} target(s)`, 'info')
    addLog('═'.repeat(40), 'info')
    
    if (onScanStart) onScanStart(targets[0])

    let allResults = []
    let successCount = 0
    let failCount = 0
    let totalItems = 0

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      let hostname = target
      try {
        hostname = new URL(target).hostname
      } catch (e) {
        hostname = target
      }
      
      setBatchProgress({ current: i + 1, total: targets.length, currentTarget: hostname })
      setScanProgress({ 
        status: 'running', 
        message: `Scanning ${i + 1}/${targets.length}: ${hostname}`, 
        progress: Math.round(((i + 0.5) / targets.length) * 100)
      })
      
      addLog(`Scanning ${i + 1}/${targets.length}: ${hostname}`, 'info')

      const result = await scanSingleTarget(target)
      
      if (result.success) {
        successCount++
        const itemCount = result.results.length
        totalItems += itemCount
        addLog(`✓ Found ${itemCount} items from ${hostname}`, 'success')
        
        const processedResults = result.results.map(item => ({
          ...item,
          target_url: target,
          subdomain: hostname,
          scan_id: result.scanId
        }))
        allResults = [...allResults, ...processedResults]
        
        // Callback with partial results
        if (onScanComplete) {
          onScanComplete(processedResults, target)
        }
      } else {
        failCount++
        addLog(`✗ Failed on ${hostname}: ${result.error || 'Unknown error'}`, 'error')
      }
    }

    addLog('═'.repeat(40), 'info')
    addLog(`Scan complete: ${totalItems} items found from ${successCount}/${targets.length} targets`, successCount > 0 ? 'success' : 'warning')
    if (failCount > 0) {
      addLog(`${failCount} target(s) failed`, 'warning')
    }
    
    // Save results summary
    setLastScanResults({ successCount, failCount, totalItems })

    setScanProgress({ 
      status: successCount > 0 ? 'completed' : 'failed', 
      message: `Scan complete: ${allResults.length} items found from ${successCount}/${targets.length} targets`, 
      progress: 100 
    })
    setBatchProgress({ current: 0, total: 0, currentTarget: '' })
    setIsScanning(false)
  }

  // Scan all (quick action)
  const handleScanAll = () => {
    const allUrls = currentList.map(t => t.url)
    setSelectedTargets(allUrls)
    setSelectAll(true)
    
    // Trigger scan after state update
    setTimeout(() => {
      handleStartScanWithTargets(allUrls)
    }, 100)
  }

  // Start scan with specific targets
  const handleStartScanWithTargets = async (targets) => {
    if (targets.length === 0 || isScanning) return

    setIsScanning(true)
    setScanError(null)
    setScanProgress({ status: 'running', message: 'Starting scan...', progress: 0 })
    setBatchProgress({ current: 0, total: targets.length, currentTarget: '' })
    
    // Clear previous logs for new scan
    setScanLogs([])
    addLog(`Starting ${scanConfig.label} on ${targets.length} target(s)`, 'info')
    addLog('═'.repeat(40), 'info')
    
    if (onScanStart) onScanStart(targets[0])

    let allResults = []
    let successCount = 0
    let failCount = 0
    let totalItems = 0

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      let hostname = target
      try {
        hostname = new URL(target).hostname
      } catch (e) {
        hostname = target
      }
      
      setBatchProgress({ current: i + 1, total: targets.length, currentTarget: hostname })
      setScanProgress({ 
        status: 'running', 
        message: `Scanning ${i + 1}/${targets.length}: ${hostname}`, 
        progress: Math.round(((i + 0.5) / targets.length) * 100)
      })
      
      addLog(`Scanning ${i + 1}/${targets.length}: ${hostname}`, 'info')

      const result = await scanSingleTarget(target)
      
      if (result.success) {
        successCount++
        const itemCount = result.results.length
        totalItems += itemCount
        addLog(`✓ Found ${itemCount} items from ${hostname}`, 'success')
        
        const processedResults = result.results.map(item => ({
          ...item,
          target_url: target,
          subdomain: hostname,
          scan_id: result.scanId
        }))
        allResults = [...allResults, ...processedResults]
        
        if (onScanComplete) {
          onScanComplete(processedResults, target)
        }
      } else {
        failCount++
        addLog(`✗ Failed on ${hostname}: ${result.error || 'Unknown error'}`, 'error')
      }
    }

    addLog('═'.repeat(40), 'info')
    addLog(`Scan complete: ${totalItems} items found from ${successCount}/${targets.length} targets`, successCount > 0 ? 'success' : 'warning')
    if (failCount > 0) {
      addLog(`${failCount} target(s) failed`, 'warning')
    }
    
    setLastScanResults({ successCount, failCount, totalItems })

    setScanProgress({ 
      status: successCount > 0 ? 'completed' : 'failed', 
      message: `Scan complete: ${allResults.length} items found from ${successCount}/${targets.length} targets`, 
      progress: 100 
    })
    setBatchProgress({ current: 0, total: 0, currentTarget: '' })
    setIsScanning(false)
  }

  const targetsToScan = getTargetsToScan()
  const hasTargets = targetsToScan.length > 0

  return (
    <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play size={18} className="text-emerald-400" />
          <h3 className="text-base font-semibold text-white">{scanConfig.label}</h3>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-[#0a0a0a] rounded-lg border border-[#1f1f1f] transition-colors"
        >
          <Settings size={14} />
          Tools ({enabledTools.length})
          {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Target Source Tabs */}
      <div className="flex gap-2">
        {Object.values(TARGET_SOURCES).map(source => {
          const Icon = source.icon
          const isActive = targetSource === source.id
          let count = 0
          if (source.id === 'subdomain') count = subdomainsList.length
          if (source.id === 'liveHost') count = liveHosts.length
          
          return (
            <button
              key={source.id}
              onClick={() => setTargetSource(source.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                isActive
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-[#0a0a0a] border-[#1f1f1f] text-gray-400 hover:border-[#252525]'
              }`}
            >
              <Icon size={14} />
              {source.label}
              {count > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-500/20 rounded text-xs">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Target Input based on source */}
      <div className="space-y-3">
        {/* Manual URL Input */}
        {targetSource === 'manual' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Target URL</label>
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={manualTarget}
                onChange={(e) => setManualTarget(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Subdomain Multi-Select */}
        {targetSource === 'subdomain' && (
          <div className="space-y-3">
            {/* Domain Selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Domain</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                disabled={isLoadingDomains}
                className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2.5 text-white text-sm focus:border-emerald-500/50 focus:outline-none disabled:opacity-50"
              >
                <option value="">Select domain...</option>
                {availableDomains.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Subdomain List */}
            {selectedDomain && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">
                    Subdomains ({selectedTargets.length}/{subdomainsList.length} selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      {selectAll ? <CheckSquare size={12} /> : <Square size={12} />}
                      {selectAll ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                      onClick={handleScanAll}
                      disabled={isScanning || subdomainsList.length === 0}
                      className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={12} />
                      Scan All ({subdomainsList.length})
                    </button>
                  </div>
                </div>
                
                {isLoadingSubdomains ? (
                  <div className="flex items-center justify-center py-6 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
                    <Loader size={16} className="animate-spin text-emerald-400 mr-2" />
                    <span className="text-sm text-gray-400">Loading subdomains...</span>
                  </div>
                ) : subdomainsList.length === 0 ? (
                  <div className="text-center py-6 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
                    <Globe className="mx-auto text-gray-600 mb-2" size={24} />
                    <p className="text-sm text-gray-500">No subdomains found for this domain</p>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto bg-[#0a0a0a] rounded-lg border border-[#1f1f1f] divide-y divide-[#1f1f1f]">
                    {subdomainsList.map((sub, idx) => (
                      <label
                        key={idx}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTargets.includes(sub.url)}
                          onChange={() => toggleTarget(sub.url)}
                          className="w-3.5 h-3.5 rounded border-gray-600 bg-[#1a1a1a] text-emerald-500 focus:ring-emerald-500/20"
                        />
                        <span className="flex-1 text-sm text-white font-mono truncate">{sub.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Live Host Multi-Select */}
        {targetSource === 'liveHost' && (
          <div>
            {liveHosts.length === 0 ? (
              <div className="text-center py-6 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
                <Activity className="mx-auto text-gray-600 mb-2" size={24} />
                <p className="text-sm text-gray-500">No live hosts. Run HTTP probing first.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">
                    Live Hosts ({selectedTargets.length}/{liveHosts.length} selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      {selectAll ? <CheckSquare size={12} /> : <Square size={12} />}
                      {selectAll ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                      onClick={handleScanAll}
                      disabled={isScanning || liveHosts.length === 0}
                      className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Play size={12} />
                      Scan All ({liveHosts.length})
                    </button>
                  </div>
                </div>
                
                <div className="max-h-48 overflow-y-auto bg-[#0a0a0a] rounded-lg border border-[#1f1f1f] divide-y divide-[#1f1f1f]">
                  {liveHosts.map((host, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTargets.includes(host.url)}
                        onChange={() => toggleTarget(host.url)}
                        className="w-3.5 h-3.5 rounded border-gray-600 bg-[#1a1a1a] text-emerald-500 focus:ring-emerald-500/20"
                      />
                      <span className="flex-1 text-sm text-white font-mono truncate">{host.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        host.status_code === 200 ? 'bg-green-500/20 text-green-400' :
                        String(host.status_code).startsWith('3') ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {host.status_code || 'N/A'}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tool Configuration - Scan Type Specific */}
      {showConfig && (
        <div className="bg-[#0a0a0a] rounded-lg border border-[#1f1f1f] p-4 space-y-4">
          <p className="text-xs text-gray-500">{scanConfig.description}</p>
          
          {Object.entries(scanConfig.categories).map(([catId, cat]) => (
            <div key={catId}>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">{cat.label}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(cat.tools).map(([toolId, tool]) => {
                  const isEnabled = enabledTools.includes(toolId)
                  return (
                    <button
                      key={toolId}
                      onClick={() => toggleTool(toolId)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                        isEnabled
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-[#111111] border-[#1f1f1f] opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-medium truncate ${isEnabled ? 'text-white' : 'text-gray-400'}`}>
                          {tool.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{tool.description}</div>
                      </div>
                      {isEnabled ? (
                        <ToggleRight size={16} className="text-emerald-500 flex-shrink-0 ml-2" />
                      ) : (
                        <ToggleLeft size={16} className="text-gray-600 flex-shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start Scan Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-gray-500">
          {hasTargets ? (
            <span className="text-emerald-400">
              {targetsToScan.length} target{targetsToScan.length !== 1 ? 's' : ''} selected
            </span>
          ) : (
            <span>Select a target to scan</span>
          )}
        </div>
        <button
          onClick={handleStartScan}
          disabled={!hasTargets || isScanning}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isScanning ? (
            <>
              <Loader size={16} className="animate-spin" />
              {batchProgress.total > 1 ? `Scanning (${batchProgress.current}/${batchProgress.total})` : 'Scanning...'}
            </>
          ) : (
            <>
              <Play size={16} />
              Start Scan{targetsToScan.length > 1 ? ` (${targetsToScan.length})` : ''}
            </>
          )}
        </button>
      </div>

      {/* Scan Progress */}
      {scanProgress && (
        <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {scanProgress.status === 'running' && <Loader size={14} className="animate-spin text-emerald-400" />}
              {scanProgress.status === 'completed' && <CheckCircle size={14} className="text-emerald-400" />}
              {scanProgress.status === 'failed' && <AlertCircle size={14} className="text-red-400" />}
              <span className={`text-sm ${
                scanProgress.status === 'completed' ? 'text-emerald-400' :
                scanProgress.status === 'failed' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {scanProgress.message}
              </span>
            </div>
            {batchProgress.total > 1 && scanProgress.status === 'running' && (
              <span className="text-xs text-emerald-400">
                {batchProgress.current}/{batchProgress.total}
              </span>
            )}
          </div>
          {scanProgress.status === 'running' && (
            <>
              <div className="mt-2 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress.progress}%` }}
                />
              </div>
              {batchProgress.currentTarget && (
                <p className="mt-1.5 text-xs text-gray-500 truncate">
                  Current: <span className="text-gray-400 font-mono">{batchProgress.currentTarget}</span>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Scan Logs (Persisted) */}
      {scanLogs.length > 0 && (
        <div className="border border-[#1f1f1f] rounded-lg overflow-hidden">
          <div className="p-2 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between">
            <span className="text-xs text-gray-500">Scan Logs ({scanLogs.length})</span>
            <button
              onClick={clearLogs}
              disabled={isScanning}
              className="p-1 text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors"
              title="Clear logs"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto p-2 bg-[#050505] font-mono text-xs space-y-0.5">
            {scanLogs.map((log, i) => {
              const typeColors = {
                info: 'text-gray-400',
                success: 'text-green-400',
                error: 'text-red-400',
                warning: 'text-yellow-400'
              }
              return (
                <div key={i} className={`${typeColors[log.type]} flex gap-2`}>
                  <span className="text-gray-600 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{log.message}</span>
                </div>
              )
            })}
          </div>
          {lastScanResults.totalItems > 0 && !isScanning && (
            <div className="p-2 bg-[#0a0a0a] border-t border-[#1f1f1f] flex items-center gap-4 text-xs">
              <span className="text-green-400">{lastScanResults.successCount} succeeded</span>
              {lastScanResults.failCount > 0 && (
                <span className="text-red-400">{lastScanResults.failCount} failed</span>
              )}
              <span className="text-emerald-400">{lastScanResults.totalItems} items found</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
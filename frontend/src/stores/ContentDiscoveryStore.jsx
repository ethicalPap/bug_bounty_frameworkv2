import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

const STORAGE_KEY = 'content_discovery_store'
const SUBDOMAINS_KEY = 'subdomain_scan_results'

export const CONTENT_TYPES = {
  api: {
    id: 'api',
    label: 'APIs',
    description: 'API endpoints and REST routes',
    icon: 'Database',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    patterns: ['/api/', '/v1/', '/v2/', '/v3/', '/graphql', '/rest/', '/json/', '/xml/', '/oauth/', '/auth/', '/token/'],
    tools: ['zapspider', 'paramspider', 'ffuf', 'gau', 'waymore'],
    riskFactors: ['IDOR', 'Auth Bypass', 'Rate Limiting', 'Mass Assignment']
  },
  endpoint: {
    id: 'endpoint',
    label: 'Endpoints',
    description: 'Web endpoints and routes',
    icon: 'Link',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    patterns: [],
    tools: ['katana', 'gospider', 'ffuf', 'feroxbuster'],
    riskFactors: ['Open Redirect', 'XSS', 'SSRF', 'Path Traversal']
  },
  directory: {
    id: 'directory',
    label: 'Directories',
    description: 'Directory listings and folder paths',
    icon: 'FolderOpen',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    patterns: [],
    tools: ['ffuf', 'feroxbuster', 'dirsearch'],
    riskFactors: ['Info Disclosure', 'Backup Files', 'Config Exposure']
  },
  javascript: {
    id: 'javascript',
    label: 'JS Files',
    description: 'JavaScript files and modules',
    icon: 'FileCode',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    patterns: ['.js', '.mjs', '.jsx', '.ts', '.tsx', '/js/', '/javascript/', '/scripts/', '/bundle', '/chunk', '/webpack'],
    tools: ['linkfinder', 'katana', 'gau', 'waymore'],
    riskFactors: ['API Keys', 'Hardcoded Secrets', 'Hidden Endpoints', 'Source Maps']
  }
}

export function classifyUrl(url) {
  if (!url) return 'endpoint'
  
  var urlLower = url.toLowerCase()
  var path = ''
  try {
    path = new URL(url, 'https://example.com').pathname.toLowerCase()
  } catch (e) {
    path = url.toLowerCase()
  }
  
  var jsPatterns = CONTENT_TYPES.javascript.patterns
  for (var i = 0; i < jsPatterns.length; i++) {
    if (urlLower.includes(jsPatterns[i])) return 'javascript'
  }
  if (/\.(js|mjs|jsx|ts|tsx)$/.test(path)) return 'javascript'
  
  var apiPatterns = CONTENT_TYPES.api.patterns
  for (var j = 0; j < apiPatterns.length; j++) {
    if (urlLower.includes(apiPatterns[j])) return 'api'
  }
  
  var lastSegment = path.split('/').pop()
  if (path.endsWith('/') || (lastSegment && !lastSegment.includes('.'))) {
    return 'directory'
  }
  
  return 'endpoint'
}

export function isInteresting(url) {
  if (!url) return false
  var patterns = [
    /admin/i, /config/i, /backup/i, /\.bak$/i, /\.old$/i,
    /\.git/i, /\.env/i, /debug/i, /test/i, /dev/i,
    /secret/i, /token/i, /auth/i, /login/i, /password/i,
    /upload/i, /download/i, /internal/i, /private/i,
    /swagger/i, /graphql/i, /phpinfo/i, /\.sql/i,
    /dashboard/i, /portal/i, /console/i, /manager/i,
    /\.log$/i, /\.conf$/i, /\.ini$/i, /\.xml$/i
  ]
  for (var i = 0; i < patterns.length; i++) {
    if (patterns[i].test(url)) return true
  }
  return false
}

export function extractSubdomain(url) {
  try {
    return new URL(url, 'https://example.com').hostname
  } catch (e) {
    var parts = url.split('/')
    return parts[0] || 'unknown'
  }
}

var ContentDiscoveryContext = createContext(null)

export function ContentDiscoveryProvider(props) {
  var children = props.children
  
  function loadInitialState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        var parsed = JSON.parse(saved)
        return {
          items: parsed.items || [],
          scanHistory: parsed.scanHistory || []
        }
      }
    } catch (e) {
      console.error('Error loading content discovery state:', e)
    }
    return { items: [], scanHistory: [] }
  }

  function loadSubdomains() {
    try {
      var saved = localStorage.getItem(SUBDOMAINS_KEY)
      if (saved) {
        var parsed = JSON.parse(saved)
        return Array.isArray(parsed) ? parsed : (parsed.results || [])
      }
    } catch (e) {
      console.error('Error loading subdomains:', e)
    }
    return []
  }

  function loadLiveHosts() {
    try {
      var saved = localStorage.getItem('live_hosts_results')
      if (saved) {
        var parsed = JSON.parse(saved)
        var hosts = Array.isArray(parsed) ? parsed : (parsed.results || [])
        return hosts.filter(function(h) { return h.is_active && h.url })
      }
    } catch (e) {
      console.error('Error loading live hosts:', e)
    }
    return []
  }

  var initialState = loadInitialState()
  
  var itemsState = useState(initialState.items)
  var items = itemsState[0]
  var setItems = itemsState[1]
  
  var scanHistoryState = useState(initialState.scanHistory)
  var scanHistory = scanHistoryState[0]
  var setScanHistory = scanHistoryState[1]
  
  var subdomainsState = useState(function() { return loadSubdomains() })
  var subdomains = subdomainsState[0]
  var setSubdomains = subdomainsState[1]
  
  var liveHostsState = useState(function() { return loadLiveHosts() })
  var liveHosts = liveHostsState[0]
  var setLiveHosts = liveHostsState[1]
  
  var isScanningState = useState(false)
  var isScanning = isScanningState[0]
  var setIsScanning = isScanningState[1]
  
  var scanProgressState = useState(null)
  var scanProgress = scanProgressState[0]
  var setScanProgress = scanProgressState[1]
  
  var currentTargetState = useState(null)
  var currentTarget = currentTargetState[0]
  var setCurrentTarget = currentTargetState[1]
  
  var globalFiltersState = useState({
    search: '',
    subdomain: 'all',
    tool: 'all',
    status: 'all',
    interesting: false
  })
  var globalFilters = globalFiltersState[0]
  var setGlobalFilters = globalFiltersState[1]

  useEffect(function() {
    function handleStorageChange() {
      setSubdomains(loadSubdomains())
      setLiveHosts(loadLiveHosts())
    }
    window.addEventListener('storage', handleStorageChange)
    var interval = setInterval(handleStorageChange, 5000)
    return function() {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  useEffect(function() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: items,
        scanHistory: scanHistory
      }))
    } catch (e) {
      console.error('Error saving content discovery state:', e)
    }
  }, [items, scanHistory])

  var enrichItem = useCallback(function(item) {
    var url = item.discovered_url || item.url
    return {
      id: item.id || (url + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)),
      discovered_url: url,
      content_type: item.content_type || classifyUrl(url),
      is_interesting: item.is_interesting !== undefined ? item.is_interesting : isInteresting(url),
      subdomain: item.subdomain || extractSubdomain(url),
      created_at: item.created_at || new Date().toISOString(),
      status_code: item.status_code,
      tool_name: item.tool_name,
      target_url: item.target_url,
      scan_id: item.scan_id
    }
  }, [])

  var addItems = useCallback(function(newItems) {
    setItems(function(prev) {
      var existingUrls = {}
      prev.forEach(function(i) { existingUrls[i.discovered_url] = true })
      var uniqueNew = []
      newItems.forEach(function(item) {
        var url = item.discovered_url || item.url
        if (!existingUrls[url]) {
          uniqueNew.push(enrichItem(item))
        }
      })
      return prev.concat(uniqueNew)
    })
  }, [enrichItem])

  var setAllItems = useCallback(function(newItems) {
    setItems(newItems.map(enrichItem))
  }, [enrichItem])

  var clearItems = useCallback(function() {
    setItems([])
  }, [])

  var removeItem = useCallback(function(id) {
    setItems(function(prev) {
      return prev.filter(function(item) { return item.id !== id })
    })
  }, [])

  var updateItem = useCallback(function(id, updates) {
    setItems(function(prev) {
      return prev.map(function(item) {
        if (item.id === id) {
          return Object.assign({}, item, updates)
        }
        return item
      })
    })
  }, [])

  var startScan = useCallback(function(target) {
    setIsScanning(true)
    setCurrentTarget(target)
    setScanProgress({ status: 'running', message: 'Starting scan...', progress: 0 })
  }, [])

  var updateProgress = useCallback(function(progress) {
    setScanProgress(progress)
  }, [])

  var endScan = useCallback(function(success, itemCount) {
    if (success === undefined) success = true
    if (itemCount === undefined) itemCount = 0
    setIsScanning(false)
    setScanProgress(success 
      ? { status: 'completed', message: 'Found ' + itemCount + ' items', progress: 100 }
      : { status: 'failed', message: 'Scan failed', progress: 0 }
    )
    setScanHistory(function(prev) {
      var newEntry = {
        target: currentTarget,
        timestamp: new Date().toISOString(),
        success: success,
        itemCount: itemCount
      }
      return [newEntry].concat(prev.slice(0, 49))
    })
  }, [currentTarget])

  var updateFilters = useCallback(function(updates) {
    setGlobalFilters(function(prev) {
      return Object.assign({}, prev, updates)
    })
  }, [])

  var resetFilters = useCallback(function() {
    setGlobalFilters({
      search: '',
      subdomain: 'all',
      tool: 'all',
      status: 'all',
      interesting: false
    })
  }, [])

  var stats = useMemo(function() {
    var byType = { api: 0, endpoint: 0, directory: 0, javascript: 0 }
    var bySubdomain = {}
    var byTool = {}
    var interesting = 0

    items.forEach(function(item) {
      var type = item.content_type || 'endpoint'
      byType[type] = (byType[type] || 0) + 1

      var subdomain = item.subdomain || extractSubdomain(item.discovered_url)
      bySubdomain[subdomain] = (bySubdomain[subdomain] || 0) + 1

      if (item.tool_name) {
        byTool[item.tool_name] = (byTool[item.tool_name] || 0) + 1
      }

      if (item.is_interesting) interesting++
    })

    return {
      total: items.length,
      byType: byType,
      bySubdomain: bySubdomain,
      byTool: byTool,
      interesting: interesting,
      apis: byType.api,
      endpoints: byType.endpoint,
      directories: byType.directory,
      javascript: byType.javascript
    }
  }, [items])

  var uniqueSubdomains = useMemo(function() {
    var set = {}
    items.forEach(function(item) {
      var subdomain = item.subdomain || extractSubdomain(item.discovered_url)
      set[subdomain] = true
    })
    return Object.keys(set).sort()
  }, [items])

  var uniqueTools = useMemo(function() {
    var set = {}
    items.forEach(function(item) {
      if (item.tool_name) set[item.tool_name] = true
    })
    return Object.keys(set).sort()
  }, [items])

  var getItemsByType = useCallback(function(type) {
    return items.filter(function(item) { return item.content_type === type })
  }, [items])

  var getItemsBySubdomain = useCallback(function(subdomain) {
    return items.filter(function(item) {
      return item.subdomain === subdomain || 
        (item.discovered_url && item.discovered_url.includes(subdomain))
    })
  }, [items])

  var getFilteredItems = useCallback(function(typeFilter) {
    return items.filter(function(item) {
      if (typeFilter && item.content_type !== typeFilter) return false

      if (globalFilters.search) {
        var search = globalFilters.search.toLowerCase()
        if (!item.discovered_url || !item.discovered_url.toLowerCase().includes(search)) return false
      }

      if (globalFilters.subdomain !== 'all') {
        var subdomain = item.subdomain || extractSubdomain(item.discovered_url)
        if (subdomain !== globalFilters.subdomain) return false
      }

      if (globalFilters.tool !== 'all' && item.tool_name !== globalFilters.tool) return false

      if (globalFilters.status !== 'all') {
        if (globalFilters.status === '2xx' && (item.status_code < 200 || item.status_code >= 300)) return false
        if (globalFilters.status === '3xx' && (item.status_code < 300 || item.status_code >= 400)) return false
        if (globalFilters.status === '4xx' && (item.status_code < 400 || item.status_code >= 500)) return false
        if (globalFilters.status === '5xx' && item.status_code < 500) return false
      }

      if (globalFilters.interesting && !item.is_interesting) return false

      return true
    })
  }, [items, globalFilters])

  var value = {
    items: items,
    scanHistory: scanHistory,
    isScanning: isScanning,
    scanProgress: scanProgress,
    currentTarget: currentTarget,
    globalFilters: globalFilters,
    subdomains: subdomains,
    liveHosts: liveHosts,
    stats: stats,
    uniqueSubdomains: uniqueSubdomains,
    uniqueTools: uniqueTools,
    addItems: addItems,
    setItems: setAllItems,
    clearItems: clearItems,
    removeItem: removeItem,
    updateItem: updateItem,
    startScan: startScan,
    updateProgress: updateProgress,
    endScan: endScan,
    updateFilters: updateFilters,
    resetFilters: resetFilters,
    getItemsByType: getItemsByType,
    getItemsBySubdomain: getItemsBySubdomain,
    getFilteredItems: getFilteredItems,
    refreshSubdomains: function() { setSubdomains(loadSubdomains()) },
    refreshLiveHosts: function() { setLiveHosts(loadLiveHosts()) }
  }

  return (
    <ContentDiscoveryContext.Provider value={value}>
      {children}
    </ContentDiscoveryContext.Provider>
  )
}

export function useContentDiscovery() {
  var context = useContext(ContentDiscoveryContext)
  if (!context) {
    throw new Error('useContentDiscovery must be used within ContentDiscoveryProvider')
  }
  return context
}

export default useContentDiscovery
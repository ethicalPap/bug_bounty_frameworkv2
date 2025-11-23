import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSubdomains } from '../../api/client'
import { 
  Home, 
  Globe, 
  Activity, 
  Search, 
  Network, 
  Filter,
  Download,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  Zap,
  AlertCircle,
  Shield,
  Target,
  TrendingUp,
  Eye,
  Server,
  Code,
  Layers,
  ChevronRight,
  Info,
  BarChart3
} from 'lucide-react'

const STORAGE_KEYS = {
  SUBDOMAIN_RESULTS: 'subdomain_scanner_last_domain',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
  PORT_SCAN_RESULTS: 'port_scan_results',
  CONTENT_DISCOVERY_RESULTS: 'content_discovery_results',
  FILTER_STATE: 'dashboard_filter_state',
  SORT_STATE: 'dashboard_sort_state',
  VIEW_MODE: 'dashboard_view_mode',
  EXPANDED_SECTIONS: 'dashboard_expanded_sections',
}

const Dashboard = () => {
  const queryClient = useQueryClient()
  
  // State management
  const [availableDomains, setAvailableDomains] = useState([])
  const [selectedDomain, setSelectedDomain] = useState('')
  
  // View mode: 'overview' | 'detailed' | 'attack-surface'
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || 'overview'
  })
  
  // Expanded sections for better UX
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXPANDED_SECTIONS)
    return saved ? JSON.parse(saved) : {
      stats: true,
      quick_actions: true,
      attack_vectors: true,
      high_value_targets: true,
      reconnaissance: true,
    }
  })
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FILTER_STATE)
    return saved ? JSON.parse(saved).searchTerm || '' : ''
  })
  const [filterStatus, setFilterStatus] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FILTER_STATE)
    return saved ? JSON.parse(saved).filterStatus || 'all' : 'all'
  })
  const [filterProtocol, setFilterProtocol] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FILTER_STATE)
    return saved ? JSON.parse(saved).filterProtocol || 'all' : 'all'
  })
  const [filterInteresting, setFilterInteresting] = useState(false)
  
  // Sorting
  const [sortBy, setSortBy] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SORT_STATE)
    return saved ? JSON.parse(saved).sortBy || 'subdomain' : 'subdomain'
  })
  const [sortOrder, setSortOrder] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SORT_STATE)
    return saved ? JSON.parse(saved).sortOrder || 'asc' : 'asc'
  })
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILTER_STATE, JSON.stringify({
      searchTerm,
      filterStatus,
      filterProtocol
    }))
  }, [searchTerm, filterStatus, filterProtocol])
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SORT_STATE, JSON.stringify({
      sortBy,
      sortOrder
    }))
  }, [sortBy, sortOrder])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXPANDED_SECTIONS, JSON.stringify(expandedSections))
  }, [expandedSections])

  // Fetch available domains from cache
  useEffect(() => {
    const queryCache = queryClient.getQueryCache()
    const allQueries = queryCache.getAll()
    
    const domains = allQueries
      .filter(query => query.queryKey[0] === 'subdomains' && query.state.data?.data?.length > 0)
      .map(query => query.queryKey[1])
      .filter(Boolean)
    
    const uniqueDomains = [...new Set(domains)]
    setAvailableDomains(uniqueDomains)
    
    if (!selectedDomain && uniqueDomains.length > 0) {
      setSelectedDomain(uniqueDomains[0])
    }
  }, [queryClient, selectedDomain])

  // Fetch subdomain data
  const { data: subdomainsData, isLoading: isLoadingSubdomains } = useQuery({
    queryKey: ['subdomains', selectedDomain],
    queryFn: () => getSubdomains(selectedDomain),
    enabled: !!selectedDomain,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60 * 24,
  })

  // Get all scan data from localStorage
  const liveHostsData = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }, [selectedDomain])

  const portScanData = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PORT_SCAN_RESULTS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }, [selectedDomain])

  const contentDiscoveryData = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }, [selectedDomain])

  // Merge all data sources
  const mergedData = useMemo(() => {
    const subdomains = subdomainsData?.data || []
    const dataMap = new Map()
    
    // Add subdomain scanner data
    subdomains.forEach(sub => {
      dataMap.set(sub.full_domain, {
        subdomain: sub.full_domain,
        from_subdomain_scan: true,
        ip_address: sub.ip_address,
        status_code: sub.status_code,
        is_active: sub.is_active,
        title: sub.title,
        server: sub.server,
        content_length: sub.content_length,
        protocol: null,
        response_time: null,
        technologies: null,
        open_ports: null,
        vulnerabilities: null,
        discovered_paths: 0,
        interesting_score: 0,
        last_updated: sub.updated_at,
      })
    })
    
    // Merge live hosts data
    liveHostsData.forEach(host => {
      const existing = dataMap.get(host.subdomain)
      if (existing) {
        existing.protocol = host.protocol
        existing.response_time = host.response_time
        existing.is_active = host.is_active
        existing.status_code = host.status_code || existing.status_code
        existing.title = host.title || existing.title
        existing.server = host.server || existing.server
        existing.from_live_probe = true
      } else {
        dataMap.set(host.subdomain, {
          subdomain: host.subdomain,
          from_live_probe: true,
          protocol: host.protocol,
          response_time: host.response_time,
          is_active: host.is_active,
          status_code: host.status_code,
          title: host.title,
          server: host.server,
          ip_address: null,
          content_length: null,
          technologies: null,
          open_ports: null,
          vulnerabilities: null,
          discovered_paths: 0,
          interesting_score: 0,
          last_updated: host.probed_at,
        })
      }
    })
    
    // Merge port scan data
    portScanData.forEach(portData => {
      const target = portData.target
      const existing = dataMap.get(target)
      
      if (existing) {
        if (!existing.open_ports) {
          existing.open_ports = []
        }
        if (portData.state === 'open') {
          existing.open_ports.push({
            port: portData.port,
            service: portData.service,
            version: portData.version,
            protocol: portData.protocol
          })
          // Increase interesting score for common vulnerable ports
          if ([21, 22, 23, 3306, 3389, 5432, 27017].includes(portData.port)) {
            existing.interesting_score += 10
          }
        }
        existing.from_port_scan = true
        if (!existing.ip_address && portData.ip_address) {
          existing.ip_address = portData.ip_address
        }
      } else {
        dataMap.set(target, {
          subdomain: target,
          from_port_scan: true,
          protocol: null,
          response_time: null,
          is_active: false,
          status_code: null,
          title: null,
          server: null,
          ip_address: portData.ip_address || null,
          content_length: null,
          technologies: null,
          open_ports: portData.state === 'open' ? [{
            port: portData.port,
            service: portData.service,
            version: portData.version,
            protocol: portData.protocol
          }] : [],
          vulnerabilities: null,
          discovered_paths: 0,
          interesting_score: 0,
          last_updated: portData.created_at,
        })
      }
    })
    
    // Merge content discovery data
    contentDiscoveryData.forEach(content => {
      let targetDomain = null
      try {
        const url = new URL(content.target_url || content.discovered_url)
        targetDomain = url.hostname
      } catch {
        return
      }
      
      const existing = dataMap.get(targetDomain)
      
      if (existing) {
        if (content.technologies && !existing.technologies) {
          existing.technologies = content.technologies
        }
        existing.from_content_discovery = true
        if (!existing.discovered_paths) {
          existing.discovered_paths = 0
        }
        existing.discovered_paths += 1
        
        // Increase interesting score for sensitive paths
        const path = content.path?.toLowerCase() || ''
        if (path.includes('admin') || path.includes('api') || path.includes('backup') || 
            path.includes('.git') || path.includes('.env')) {
          existing.interesting_score += 5
        }
      } else {
        dataMap.set(targetDomain, {
          subdomain: targetDomain,
          from_content_discovery: true,
          protocol: null,
          response_time: null,
          is_active: false,
          status_code: content.status_code || null,
          title: null,
          server: null,
          ip_address: null,
          content_length: null,
          technologies: content.technologies || null,
          open_ports: null,
          vulnerabilities: null,
          discovered_paths: 1,
          interesting_score: 0,
          last_updated: content.created_at,
        })
      }
    })
    
    return Array.from(dataMap.values())
  }, [subdomainsData, liveHostsData, portScanData, contentDiscoveryData])

  // Filter data
  const filteredData = useMemo(() => {
    return mergedData.filter(item => {
      if (searchTerm && !item.subdomain.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      
      if (filterStatus === 'active' && !item.is_active) return false
      if (filterStatus === 'inactive' && item.is_active) return false
      
      if (filterProtocol === 'https' && item.protocol !== 'https') return false
      if (filterProtocol === 'http' && item.protocol !== 'http') return false
      
      if (filterInteresting && item.interesting_score < 5) return false
      
      return true
    })
  }, [mergedData, searchTerm, filterStatus, filterProtocol, filterInteresting])

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData]
    
    sorted.sort((a, b) => {
      let aVal, bVal
      
      switch (sortBy) {
        case 'subdomain':
          aVal = a.subdomain
          bVal = b.subdomain
          break
        case 'status':
          aVal = a.is_active ? 1 : 0
          bVal = b.is_active ? 1 : 0
          break
        case 'protocol':
          aVal = a.protocol || ''
          bVal = b.protocol || ''
          break
        case 'response_time':
          aVal = a.response_time || 999999
          bVal = b.response_time || 999999
          break
        case 'status_code':
          aVal = a.status_code || 0
          bVal = b.status_code || 0
          break
        case 'interesting':
          aVal = a.interesting_score || 0
          bVal = b.interesting_score || 0
          break
        default:
          return 0
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    
    return sorted
  }, [filteredData, sortBy, sortOrder])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sortedData.slice(startIndex, endIndex)
  }, [sortedData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  // Handle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Subdomain',
      'Status',
      'Protocol',
      'HTTP Code',
      'Response Time (ms)',
      'IP Address',
      'Title',
      'Server',
      'Open Ports',
      'Technologies',
      'Interesting Score'
    ]
    
    const rows = sortedData.map(item => [
      item.subdomain,
      item.is_active ? 'Active' : 'Inactive',
      item.protocol || 'N/A',
      item.status_code || 'N/A',
      item.response_time || 'N/A',
      item.ip_address || 'N/A',
      item.title || 'N/A',
      item.server || 'N/A',
      item.open_ports ? item.open_ports.map(p => `${p.port}/${p.service}`).join('; ') : 'N/A',
      item.technologies || 'N/A',
      item.interesting_score || 0
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedDomain}-dashboard-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Copy to clipboard
  const copyToClipboard = () => {
    const text = sortedData.map(item => item.subdomain).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => alert('Copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err))
  }

  // Statistics
  const stats = {
    total: mergedData.length,
    active: mergedData.filter(d => d.is_active).length,
    inactive: mergedData.filter(d => !d.is_active).length,
    https: mergedData.filter(d => d.protocol === 'https').length,
    http: mergedData.filter(d => d.protocol === 'http').length,
    with_probe_data: mergedData.filter(d => d.from_live_probe).length,
    with_subdomain_data: mergedData.filter(d => d.from_subdomain_scan).length,
    with_port_data: mergedData.filter(d => d.from_port_scan).length,
    total_open_ports: mergedData.reduce((sum, d) => sum + (d.open_ports?.length || 0), 0),
    with_content_discovery: mergedData.filter(d => d.from_content_discovery).length,
    with_technologies: mergedData.filter(d => d.technologies).length,
    high_value_targets: mergedData.filter(d => d.interesting_score >= 15).length,
    medium_value_targets: mergedData.filter(d => d.interesting_score >= 5 && d.interesting_score < 15).length,
  }

  // High value targets
  const highValueTargets = useMemo(() => {
    return mergedData
      .filter(d => d.interesting_score >= 5)
      .sort((a, b) => b.interesting_score - a.interesting_score)
      .slice(0, 10)
  }, [mergedData])

  // Attack surface summary
  const attackSurface = useMemo(() => {
    const services = new Map()
    mergedData.forEach(host => {
      if (host.open_ports) {
        host.open_ports.forEach(port => {
          const key = `${port.service || 'unknown'}:${port.port}`
          if (!services.has(key)) {
            services.set(key, {
              service: port.service || 'unknown',
              port: port.port,
              count: 0,
              hosts: []
            })
          }
          const svc = services.get(key)
          svc.count++
          svc.hosts.push(host.subdomain)
        })
      }
    })
    
    return Array.from(services.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [mergedData])

  return (
    <div className="p-8 space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Target className="text-cyber-blue" />
            Attack Surface Dashboard
          </h2>
          <p className="text-gray-400 mt-2">Comprehensive reconnaissance intelligence</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Selector */}
          <div className="flex bg-dark-100 border border-dark-50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                viewMode === 'overview'
                  ? 'bg-cyber-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                viewMode === 'detailed'
                  ? 'bg-cyber-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => setViewMode('attack-surface')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                viewMode === 'attack-surface'
                  ? 'bg-cyber-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Attack Surface
            </button>
          </div>

          {mergedData.length > 0 && (
            <>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-3 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-blue transition-all text-sm"
                title="Copy all subdomains"
              >
                <Copy size={16} />
                Copy
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-green transition-all text-sm"
                title="Export to CSV"
              >
                <Download size={16} />
                Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* Domain Selection */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Target Domain
        </label>
        {availableDomains.length === 0 ? (
          <div className="text-center py-8 bg-dark-200 border border-dark-50 rounded-lg">
            <Globe className="mx-auto text-gray-600 mb-3" size={48} />
            <p className="text-gray-400 mb-2">No reconnaissance data available</p>
            <p className="text-sm text-gray-500">
              Start by running a subdomain scan from the Subdomain Scanner
            </p>
          </div>
        ) : (
          <select
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full px-4 py-3 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all"
          >
            {availableDomains.map((domain) => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        )}
      </div>

      {/* Overview Mode */}
      {selectedDomain && mergedData.length > 0 && viewMode === 'overview' && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-cyber-blue/10 to-cyber-blue/5 border border-cyber-blue/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Globe className="text-cyber-blue" size={24} />
                <TrendingUp className="text-cyber-blue/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.total}</div>
              <div className="text-sm text-gray-400">Total Assets</div>
              <div className="text-xs text-cyber-blue mt-2">
                {stats.active > 0 ? `${((stats.active / stats.total) * 100).toFixed(1)}% active` : 'No active hosts'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <CheckCircle className="text-green-400" size={24} />
                <Activity className="text-green-400/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-green-400 mb-1">{stats.active}</div>
              <div className="text-sm text-gray-400">Active Hosts</div>
              <div className="text-xs text-green-400/70 mt-2">
                {stats.https} HTTPS, {stats.http} HTTP
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyber-pink/10 to-cyber-pink/5 border border-cyber-pink/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Network className="text-cyber-pink" size={24} />
                <Server className="text-cyber-pink/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-cyber-pink mb-1">{stats.total_open_ports}</div>
              <div className="text-sm text-gray-400">Open Ports</div>
              <div className="text-xs text-cyber-pink/70 mt-2">
                {stats.with_port_data} hosts scanned
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyber-purple/10 to-cyber-purple/5 border border-cyber-purple/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Shield className="text-cyber-purple" size={24} />
                <Eye className="text-cyber-purple/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-cyber-purple mb-1">{stats.high_value_targets}</div>
              <div className="text-sm text-gray-400">High Value Targets</div>
              <div className="text-xs text-cyber-purple/70 mt-2">
                {stats.medium_value_targets} medium priority
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
            <button
              onClick={() => toggleSection('quick_actions')}
              className="w-full flex items-center justify-between mb-4"
            >
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="text-cyber-blue" size={20} />
                Quick Actions
              </h3>
              {expandedSections.quick_actions ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </button>

            {expandedSections.quick_actions && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button className="flex items-center gap-3 p-4 bg-dark-200 border border-dark-50 rounded-lg hover:border-cyber-blue transition-all group">
                  <div className="p-2 bg-cyber-blue/10 rounded-lg group-hover:bg-cyber-blue/20 transition-all">
                    <Activity size={20} className="text-cyber-blue" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Live Probe</div>
                    <div className="text-xs text-gray-400">Check all hosts</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-600 group-hover:text-cyber-blue transition-all" />
                </button>

                <button className="flex items-center gap-3 p-4 bg-dark-200 border border-dark-50 rounded-lg hover:border-cyber-pink transition-all group">
                  <div className="p-2 bg-cyber-pink/10 rounded-lg group-hover:bg-cyber-pink/20 transition-all">
                    <Network size={20} className="text-cyber-pink" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Port Scan</div>
                    <div className="text-xs text-gray-400">Active targets</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-600 group-hover:text-cyber-pink transition-all" />
                </button>

                <button className="flex items-center gap-3 p-4 bg-dark-200 border border-dark-50 rounded-lg hover:border-cyber-purple transition-all group">
                  <div className="p-2 bg-cyber-purple/10 rounded-lg group-hover:bg-cyber-purple/20 transition-all">
                    <Search size={20} className="text-cyber-purple" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Content Discovery</div>
                    <div className="text-xs text-gray-400">Find hidden paths</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-600 group-hover:text-cyber-purple transition-all" />
                </button>

                <button className="flex items-center gap-3 p-4 bg-dark-200 border border-dark-50 rounded-lg hover:border-cyber-green transition-all group">
                  <div className="p-2 bg-cyber-green/10 rounded-lg group-hover:bg-cyber-green/20 transition-all">
                    <Download size={20} className="text-cyber-green" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Export All</div>
                    <div className="text-xs text-gray-400">Complete report</div>
                  </div>
                  <ChevronRight size={16} className="ml-auto text-gray-600 group-hover:text-cyber-green transition-all" />
                </button>
              </div>
            )}
          </div>

          {/* High Value Targets */}
          {highValueTargets.length > 0 && (
            <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
              <button
                onClick={() => toggleSection('high_value_targets')}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="text-cyber-purple" size={20} />
                  High Value Targets
                  <span className="ml-2 px-2 py-0.5 bg-cyber-purple/20 rounded-full text-xs text-cyber-purple">
                    {highValueTargets.length}
                  </span>
                </h3>
                {expandedSections.high_value_targets ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>

              {expandedSections.high_value_targets && (
                <div className="space-y-2">
                  {highValueTargets.map((target, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-4 p-4 bg-dark-200 border border-dark-50 rounded-lg hover:border-cyber-purple transition-all"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-cyber-purple/10 rounded-lg flex items-center justify-center">
                          <span className="text-cyber-purple font-bold">{idx + 1}</span>
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-mono text-sm truncate">{target.subdomain}</span>
                          {target.is_active && (
                            <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          {target.open_ports && target.open_ports.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Network size={12} />
                              {target.open_ports.length} ports
                            </span>
                          )}
                          {target.discovered_paths > 0 && (
                            <span className="flex items-center gap-1">
                              <Search size={12} />
                              {target.discovered_paths} paths
                            </span>
                          )}
                          {target.protocol && (
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              target.protocol === 'https' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {target.protocol.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Risk Score</div>
                          <div className="text-sm font-bold text-cyber-purple">{target.interesting_score}</div>
                        </div>
                        {target.is_active && (
                          <a
                            href={`${target.protocol || 'https'}://${target.subdomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-dark-100 rounded transition-all"
                          >
                            <ExternalLink size={16} className="text-cyber-blue" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Attack Surface Summary */}
          {attackSurface.length > 0 && (
            <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
              <button
                onClick={() => toggleSection('attack_vectors')}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Shield className="text-cyber-pink" size={20} />
                  Attack Surface Analysis
                </h3>
                {expandedSections.attack_vectors ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>

              {expandedSections.attack_vectors && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {attackSurface.map((svc, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-dark-200 border border-dark-50 rounded-lg hover:border-cyber-pink transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-cyber-pink/10 rounded">
                          <Server size={16} className="text-cyber-pink" />
                        </div>
                        <span className="text-xs font-mono text-gray-400">:{svc.port}</span>
                      </div>
                      <div className="text-sm font-medium text-white capitalize mb-1">
                        {svc.service}
                      </div>
                      <div className="text-xs text-gray-400">
                        {svc.count} {svc.count === 1 ? 'instance' : 'instances'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Detailed Mode - Full Table */}
      {selectedDomain && mergedData.length > 0 && viewMode === 'detailed' && (
        <>
          {/* Filters and Search */}
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Search assets..."
                    className="w-full pl-10 pr-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyber-blue transition-all"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>

                <select
                  value={filterProtocol}
                  onChange={(e) => {
                    setFilterProtocol(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all text-sm"
                >
                  <option value="all">All Protocols</option>
                  <option value="https">HTTPS Only</option>
                  <option value="http">HTTP Only</option>
                </select>

                <label className="flex items-center gap-2 px-4 py-2 bg-dark-200 border border-dark-50 rounded-lg cursor-pointer hover:border-cyber-purple transition-all">
                  <input
                    type="checkbox"
                    checked={filterInteresting}
                    onChange={(e) => {
                      setFilterInteresting(e.target.checked)
                      setCurrentPage(1)
                    }}
                    className="w-4 h-4 text-cyber-purple bg-dark-100 border-gray-600 rounded focus:ring-cyber-purple"
                  />
                  <span className="text-sm text-white whitespace-nowrap">Interesting Only</span>
                </label>

                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all text-sm"
                >
                  <option value="25">25 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                  <option value="200">200 per page</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-dark-100 border border-dark-50 rounded-xl overflow-hidden">
            {sortedData.length === 0 ? (
              <div className="text-center py-12 px-6">
                <AlertCircle className="mx-auto text-gray-600 mb-3" size={48} />
                <p className="text-gray-400">No results match your filters</p>
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilterStatus('all')
                    setFilterProtocol('all')
                    setFilterInteresting(false)
                  }}
                  className="mt-4 text-cyber-blue hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-dark-200 border-b border-dark-50">
                      <tr>
                        <th 
                          onClick={() => handleSort('interesting')}
                          className="text-left py-3 px-4 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            Score
                            {sortBy === 'interesting' && (
                              sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('subdomain')}
                          className="text-left py-3 px-4 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            Asset
                            {sortBy === 'subdomain' && (
                              sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('status')}
                          className="text-center py-3 px-4 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center justify-center gap-2">
                            Status
                            {sortBy === 'status' && (
                              sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('protocol')}
                          className="text-center py-3 px-4 text-xs font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                        >
                          <div className="flex items-center justify-center gap-2">
                            Protocol
                            {sortBy === 'protocol' && (
                              sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                            )}
                          </div>
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">IP Address</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Open Ports</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Technologies</th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-gray-400">Paths</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((item, index) => (
                        <tr key={index} className="border-b border-dark-50 hover:bg-dark-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className={`w-12 h-8 rounded flex items-center justify-center text-xs font-bold ${
                              item.interesting_score >= 15 ? 'bg-red-500/20 text-red-400' :
                              item.interesting_score >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-500'
                            }`}>
                              {item.interesting_score || 0}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-white font-mono text-sm">{item.subdomain}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.is_active ? (
                              <span className="inline-flex items-center gap-1 text-green-400">
                                <CheckCircle size={16} />
                                <span className="text-xs">Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-gray-500">
                                <XCircle size={16} />
                                <span className="text-xs">Inactive</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.protocol ? (
                              <span className={`text-xs font-medium px-2 py-1 rounded ${
                                item.protocol === 'https' 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {item.protocol.toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-400 text-xs font-mono">
                              {item.ip_address || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {item.open_ports && item.open_ports.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.open_ports.slice(0, 3).map((port, idx) => (
                                  <span 
                                    key={idx}
                                    className="text-xs bg-cyber-pink/20 text-cyber-pink px-2 py-1 rounded font-mono"
                                    title={`${port.port}/${port.protocol} - ${port.service}${port.version ? ' (' + port.version + ')' : ''}`}
                                  >
                                    {port.port}
                                  </span>
                                ))}
                                {item.open_ports.length > 3 && (
                                  <span 
                                    className="text-xs text-gray-500 px-2 py-1"
                                    title={`Total: ${item.open_ports.length} open ports`}
                                  >
                                    +{item.open_ports.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-600 text-xs italic">No data</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {item.technologies ? (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs bg-cyber-purple/20 text-cyber-purple px-2 py-1 rounded">
                                  Detected
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-600 text-xs italic">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.discovered_paths > 0 ? (
                              <span className="text-xs bg-cyber-blue/20 text-cyber-blue px-2 py-1 rounded font-mono">
                                {item.discovered_paths}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.is_active && (
                              <a
                                href={`${item.protocol || 'https'}://${item.subdomain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-cyber-blue hover:text-cyber-blue/80 transition-colors"
                              >
                                <span className="text-xs">Visit</span>
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-dark-50 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-dark-200 border border-dark-50 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyber-blue transition-all text-sm"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-dark-200 border border-dark-50 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyber-blue transition-all text-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Attack Surface Mode */}
      {selectedDomain && mergedData.length > 0 && viewMode === 'attack-surface' && (
        <div className="space-y-6">
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="text-cyber-blue" size={20} />
              Attack Surface Breakdown
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Service Distribution */}
              <div className="col-span-2">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Exposed Services</h4>
                <div className="space-y-2">
                  {attackSurface.map((svc, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white capitalize">{svc.service}:{svc.port}</span>
                          <span className="text-xs text-gray-400">{svc.count} instances</span>
                        </div>
                        <div className="w-full bg-dark-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-cyber-pink to-cyber-purple h-2 rounded-full"
                            style={{ width: `${(svc.count / stats.total_open_ports) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="space-y-3">
                <div className="p-4 bg-dark-200 border border-dark-50 rounded-lg">
                  <div className="text-2xl font-bold text-white mb-1">{attackSurface.length}</div>
                  <div className="text-xs text-gray-400">Unique Services</div>
                </div>
                <div className="p-4 bg-dark-200 border border-dark-50 rounded-lg">
                  <div className="text-2xl font-bold text-cyber-pink mb-1">{stats.total_open_ports}</div>
                  <div className="text-xs text-gray-400">Total Open Ports</div>
                </div>
                <div className="p-4 bg-dark-200 border border-dark-50 rounded-lg">
                  <div className="text-2xl font-bold text-cyber-purple mb-1">{stats.with_port_data}</div>
                  <div className="text-xs text-gray-400">Assets Scanned</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Source Indicators */}
      {selectedDomain && mergedData.length > 0 && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-4">
          <div className="flex items-center gap-6 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyber-blue rounded-full"></div>
              <span className="text-gray-400">Subdomain Scan: <span className="text-white font-medium">{stats.with_subdomain_data}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyber-green rounded-full"></div>
              <span className="text-gray-400">Live Probe: <span className="text-white font-medium">{stats.with_probe_data}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyber-pink rounded-full"></div>
              <span className="text-gray-400">Port Scan: <span className="text-white font-medium">{stats.with_port_data}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyber-purple rounded-full"></div>
              <span className="text-gray-400">Content Discovery: <span className="text-white font-medium">{stats.with_content_discovery}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
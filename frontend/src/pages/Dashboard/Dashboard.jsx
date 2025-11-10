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
  AlertCircle
} from 'lucide-react'

const STORAGE_KEYS = {
  SUBDOMAIN_RESULTS: 'subdomain_scanner_last_domain',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
  FILTER_STATE: 'dashboard_filter_state',
  SORT_STATE: 'dashboard_sort_state',
}

const Dashboard = () => {
  const queryClient = useQueryClient()
  
  // Get available domains from all scan types
  const [availableDomains, setAvailableDomains] = useState([])
  const [selectedDomain, setSelectedDomain] = useState('')
  
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
  
  // Persist filter and sort state
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
    
    // Auto-select first domain if none selected
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

  // Get live hosts data from localStorage
  const liveHostsData = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }, [selectedDomain]) // Re-compute when domain changes

  // Merge data from different sources
  const mergedData = useMemo(() => {
    const subdomains = subdomainsData?.data || []
    
    // Create a map of subdomain data
    const dataMap = new Map()
    
    // Add subdomain scanner data
    subdomains.forEach(sub => {
      dataMap.set(sub.full_domain, {
        subdomain: sub.full_domain,
        from_subdomain_scan: true,
        // Data from subdomain scanner
        ip_address: sub.ip_address,
        status_code: sub.status_code,
        is_active: sub.is_active,
        title: sub.title,
        server: sub.server,
        content_length: sub.content_length,
        // Placeholders for other scan types
        protocol: null,
        response_time: null,
        technologies: null,
        open_ports: null,
        vulnerabilities: null,
        last_updated: sub.updated_at,
      })
    })
    
    // Merge live hosts data
    liveHostsData.forEach(host => {
      const existing = dataMap.get(host.subdomain)
      if (existing) {
        // Update existing entry with live host data
        existing.protocol = host.protocol
        existing.response_time = host.response_time
        existing.is_active = host.is_active
        existing.status_code = host.status_code || existing.status_code
        existing.title = host.title || existing.title
        existing.server = host.server || existing.server
        existing.from_live_probe = true
      } else {
        // Add new entry from live hosts
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
          last_updated: host.probed_at,
        })
      }
    })
    
    return Array.from(dataMap.values())
  }, [subdomainsData, liveHostsData])

  // Filter data
  const filteredData = useMemo(() => {
    return mergedData.filter(item => {
      // Search filter
      if (searchTerm && !item.subdomain.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      
      // Status filter
      if (filterStatus === 'active' && !item.is_active) return false
      if (filterStatus === 'inactive' && item.is_active) return false
      
      // Protocol filter
      if (filterProtocol === 'https' && item.protocol !== 'https') return false
      if (filterProtocol === 'http' && item.protocol !== 'http') return false
      
      return true
    })
  }, [mergedData, searchTerm, filterStatus, filterProtocol])

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
      'Technologies',
      'Open Ports',
      'Vulnerabilities'
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
      item.technologies || 'N/A',
      item.open_ports || 'N/A',
      item.vulnerabilities || 'N/A'
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
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Home className="text-cyber-blue" />
            Dashboard
          </h2>
          <p className="text-gray-400 mt-2">Unified view of all reconnaissance data</p>
        </div>

        {mergedData.length > 0 && (
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
          </div>
        )}
      </div>

      {/* Domain Selection */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Domain
        </label>
        {availableDomains.length === 0 ? (
          <div className="text-center py-8 bg-dark-200 border border-dark-50 rounded-lg">
            <Globe className="mx-auto text-gray-600 mb-3" size={48} />
            <p className="text-gray-400 mb-2">No data available</p>
            <p className="text-sm text-gray-500">
              Run a subdomain scan to populate the dashboard
            </p>
          </div>
        ) : (
          <select
            value={selectedDomain}
            onChange={(e) => {
              setSelectedDomain(e.target.value)
              setCurrentPage(1) // Reset to first page
            }}
            className="w-full px-4 py-3 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all"
          >
            {availableDomains.map((domain) => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
        )}
      </div>

      {/* Statistics Cards */}
      {selectedDomain && mergedData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyber-blue/10 rounded-lg">
                <Globe className="text-cyber-blue" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-gray-400">Total Hosts</div>
              </div>
            </div>
          </div>

          <div className="bg-dark-100 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="text-green-400" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{stats.active}</div>
                <div className="text-xs text-gray-400">Active Hosts</div>
                {stats.active > 0 && (
                  <div className="text-xs text-green-400/70">
                    {((stats.active / stats.total) * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-dark-100 border border-dark-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Lock className="text-green-400" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.https}</div>
                <div className="text-xs text-gray-400">HTTPS</div>
              </div>
            </div>
          </div>

          <div className="bg-dark-100 border border-dark-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Unlock className="text-yellow-400" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{stats.http}</div>
                <div className="text-xs text-gray-400">HTTP Only</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Source Indicators */}
      {selectedDomain && mergedData.length > 0 && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyber-blue rounded-full"></div>
              <span className="text-gray-400">Subdomain Scan: <span className="text-white font-medium">{stats.with_subdomain_data}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyber-green rounded-full"></div>
              <span className="text-gray-400">Live Probe: <span className="text-white font-medium">{stats.with_probe_data}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-gray-400">Port Scan: <span className="text-white font-medium">0</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-gray-400">Tech Detection: <span className="text-white font-medium">0</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      {selectedDomain && mergedData.length > 0 && (
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
                  placeholder="Search hosts..."
                  className="w-full pl-10 pr-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyber-blue transition-all"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Protocol Filter */}
            <div>
              <select
                value={filterProtocol}
                onChange={(e) => {
                  setFilterProtocol(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all"
              >
                <option value="all">All Protocols</option>
                <option value="https">HTTPS Only</option>
                <option value="http">HTTP Only</option>
              </select>
            </div>

            {/* Items per page */}
            <div>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-4 py-2 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all"
              >
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
                <option value="200">200 per page</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {selectedDomain && mergedData.length > 0 && (
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
                        onClick={() => handleSort('subdomain')}
                        className="text-left py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          Subdomain
                          {sortBy === 'subdomain' && (
                            sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('status')}
                        className="text-center py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
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
                        className="text-center py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                      >
                        <div className="flex items-center justify-center gap-2">
                          Protocol
                          {sortBy === 'protocol' && (
                            sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('status_code')}
                        className="text-center py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                      >
                        <div className="flex items-center justify-center gap-2">
                          HTTP Code
                          {sortBy === 'status_code' && (
                            sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => handleSort('response_time')}
                        className="text-center py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer hover:text-white transition-colors"
                      >
                        <div className="flex items-center justify-center gap-2">
                          Response
                          {sortBy === 'response_time' && (
                            sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </div>
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">IP Address</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Technologies</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Ports</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Vulns</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((item, index) => (
                      <tr key={index} className="border-b border-dark-50 hover:bg-dark-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="text-white font-mono text-sm">{item.subdomain}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.is_active ? (
                            <span className="inline-flex items-center gap-1 text-green-400">
                              <CheckCircle size={16} />
                              <span className="text-sm">Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <XCircle size={16} />
                              <span className="text-sm">Inactive</span>
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
                        <td className="py-3 px-4 text-center">
                          {item.status_code ? (
                            <span className={`text-sm font-medium ${
                              item.status_code >= 200 && item.status_code < 300 ? 'text-green-400' :
                              item.status_code >= 300 && item.status_code < 400 ? 'text-yellow-400' :
                              item.status_code >= 400 && item.status_code < 500 ? 'text-orange-400' :
                              'text-red-400'
                            }`}>
                              {item.status_code}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.response_time ? (
                            <span className={`text-sm ${
                              item.response_time < 500 ? 'text-green-400' :
                              item.response_time < 1500 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {item.response_time}ms
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-400 text-sm font-mono">
                            {item.ip_address || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-400 text-sm truncate max-w-xs block" title={item.title || ''}>
                            {item.title || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-600 text-xs italic">
                            {item.technologies || 'Not detected'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-600 text-xs italic">
                            {item.open_ports || 'Not scanned'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-gray-600 text-xs italic">
                            {item.vulnerabilities || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.is_active && (
                            <a
                              href={`${item.protocol || 'https'}://${item.subdomain}`}
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

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-dark-50 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-dark-200 border border-dark-50 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyber-blue transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-dark-200 border border-dark-50 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-cyber-blue transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Dashboard
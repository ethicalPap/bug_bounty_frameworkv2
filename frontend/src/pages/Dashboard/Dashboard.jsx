import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getSubdomains, validateTarget, quickValidateTarget } from '../../api/client'
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
  BarChart3,
  AlertTriangle,
  Loader
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
  const [searchParams, setSearchParams] = useSearchParams()
  
  // State management
  const [availableDomains, setAvailableDomains] = useState([])
  
  // Get domain from URL params, fallback to empty string
  const selectedDomain = searchParams.get('domain') || ''
  
  // Function to update domain in URL
  const setSelectedDomain = (domain) => {
    if (domain) {
      setSearchParams({ domain })
    } else {
      setSearchParams({})
    }
  }
  
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
  
  // Validation state
  const [validating, setValidating] = useState({})
  const [validationResults, setValidationResults] = useState({})
  
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
  const [filterTier, setFilterTier] = useState('all')
  
  // Sorting
  const [sortBy, setSortBy] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SORT_STATE)
    return saved ? JSON.parse(saved).sortBy || 'risk_score' : 'risk_score'
  })
  const [sortOrder, setSortOrder] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SORT_STATE)
    return saved ? JSON.parse(saved).sortOrder || 'desc' : 'desc'
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

  // Validation handler
  const handleValidateTarget = async (target) => {
    const targetUrl = `${target.protocol || 'https'}://${target.subdomain}`
    
    setValidating(prev => ({ ...prev, [target.subdomain]: true }))
    
    try {
      // Quick validation (faster)
      const result = await quickValidateTarget(targetUrl, [])
      
      // Store results
      setValidationResults(prev => ({
        ...prev,
        [target.subdomain]: result
      }))
      
      // Show results
      if (result.total_vulns > 0) {
        alert(`🎯 Validation Complete!\n\nFound ${result.total_vulns} vulnerabilities on ${target.subdomain}\n\nCheck the console for details.`)
        console.log('Validation Results:', result)
      } else {
        alert(`✅ Validation Complete!\n\nNo vulnerabilities found on ${target.subdomain}`)
      }
      
      // Optionally refresh data to show updated validation status
      queryClient.invalidateQueries(['subdomains', selectedDomain])
      
    } catch (error) {
      console.error('Validation failed:', error)
      alert(`❌ Validation Failed\n\n${error.response?.data?.detail || error.message}`)
    } finally {
      setValidating(prev => ({ ...prev, [target.subdomain]: false }))
    }
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

  // Fetch available domains from API on mount
  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/domains')
        if (response.ok) {
          const domains = await response.json()
          setAvailableDomains(domains)
          
          // If no domain in URL and we have domains, set the first one
          if (!selectedDomain && domains.length > 0) {
            setSelectedDomain(domains[0])
          }
        }
      } catch (error) {
        console.error('Error fetching domains:', error)
        
        // Fallback: try to get from query cache
        const queryCache = queryClient.getQueryCache()
        const allQueries = queryCache.getAll()
        
        const cachedDomains = allQueries
          .filter(query => query.queryKey[0] === 'subdomains' && query.state.data?.data?.length > 0)
          .map(query => query.queryKey[1])
          .filter(Boolean)
        
        const uniqueDomains = [...new Set(cachedDomains)]
        setAvailableDomains(uniqueDomains)
        
        if (!selectedDomain && uniqueDomains.length > 0) {
          setSelectedDomain(uniqueDomains[0])
        }
      }
    }
    
    fetchDomains()
  }, []) // Only run on mount

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

  // Advanced Risk Scoring System
  const calculateRiskScore = (data) => {
    let score = 0
    const findings = []
    
    // CRITICAL TIER (50+)
    const criticalSubdomains = ['admin', 'internal', 'staging', 'dev', 'test', 'jenkins', 'vpn', 'console', 'panel']
    const subdomain = data.subdomain.toLowerCase()
    const isCriticalSubdomain = criticalSubdomains.some(keyword => subdomain.includes(keyword))
    
    if (isCriticalSubdomain) {
      score += 25
      findings.push({
        type: 'critical_subdomain',
        description: `Critical subdomain detected: ${subdomain}`,
        impact: 'High-value target for authentication bypass, privilege escalation'
      })
    }
    
    // Critical ports
    const criticalPorts = {
      3389: { name: 'RDP', severity: 30, note: 'Remote Desktop - BlueKeep RCE, auth bypass' },
      5900: { name: 'VNC', severity: 30, note: 'VNC - Remote access, often weak auth' },
      27017: { name: 'MongoDB', severity: 30, note: 'MongoDB - Often no authentication, data exposure' },
      6379: { name: 'Redis', severity: 28, note: 'Redis - RCE via module loading, data leak' },
      9200: { name: 'Elasticsearch', severity: 28, note: 'Elasticsearch - RCE, sensitive data exposure' },
      2375: { name: 'Docker', severity: 30, note: 'Docker API - Container escape, RCE' },
      8080: { name: 'Jenkins', severity: 25, note: 'Jenkins - Script console RCE' },
      8443: { name: 'Alt-HTTPS', severity: 15, note: 'Alternative HTTPS - Often development/staging' },
      5432: { name: 'PostgreSQL', severity: 25, note: 'PostgreSQL - SQL injection, credential theft' },
      3306: { name: 'MySQL', severity: 25, note: 'MySQL - SQL injection, credential theft' },
      1433: { name: 'MSSQL', severity: 25, note: 'MSSQL - SQL injection, xp_cmdshell RCE' },
      22: { name: 'SSH', severity: 10, note: 'SSH - Brute force target, key leaks' },
      23: { name: 'Telnet', severity: 35, note: 'Telnet - Unencrypted, ancient protocol' },
      21: { name: 'FTP', severity: 20, note: 'FTP - Anonymous access, directory traversal' },
    }
    
    if (data.open_ports) {
      data.open_ports.forEach(port => {
        const criticalPort = criticalPorts[port.port]
        if (criticalPort) {
          score += criticalPort.severity
          findings.push({
            type: 'critical_port',
            port: port.port,
            service: criticalPort.name,
            description: `${criticalPort.name} exposed on port ${port.port}`,
            impact: criticalPort.note,
            severity: criticalPort.severity
          })
        }
      })
    }
    
    // Source code leaks
    const sourceCodeLeaks = ['.git', '.svn', '.env', 'backup.sql', '.sql', 'database.sql', '.bak']
    if (data.discovered_paths > 0) {
      const hasSourceLeak = sourceCodeLeaks.some(leak => 
        contentDiscoveryData.some(item => 
          item.target_url?.includes(data.subdomain) && 
          item.path?.toLowerCase().includes(leak)
        )
      )
      
      if (hasSourceLeak) {
        score += 30
        findings.push({
          type: 'source_leak',
          description: 'Source code / backup file exposed',
          impact: 'Hardcoded credentials, API keys, database credentials'
        })
      }
    }
    
    // API endpoints
    if (subdomain.includes('api')) {
      score += 20
      findings.push({
        type: 'api_endpoint',
        description: 'API subdomain detected',
        impact: 'BOLA/IDOR, authentication bypass, data exposure'
      })
    }
    
    // Staging/dev environments
    if (subdomain.includes('staging') || subdomain.includes('dev') || subdomain.includes('test')) {
      score += 15
      findings.push({
        type: 'staging_env',
        description: 'Staging/Development environment',
        impact: 'Production data with weaker security controls'
      })
    }
    
    // Authentication portals
    if (data.status_code === 401 || data.status_code === 403) {
      score += 12
      findings.push({
        type: 'auth_portal',
        description: 'Authentication portal detected',
        impact: 'Auth bypass, credential stuffing, brute force'
      })
    }
    
    return {
      score: Math.min(score, 100),
      findings,
      tier: score >= 50 ? 'CRITICAL' : score >= 30 ? 'HIGH' : score >= 15 ? 'MEDIUM' : 'LOW'
    }
  }

  // Merge all data sources with risk scoring
  const mergedData = useMemo(() => {
    const subdomains = subdomainsData?.data || []
    const dataMap = new Map()
    
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
        last_updated: sub.updated_at,
      })
    })
    
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
          last_updated: host.probed_at,
        })
      }
    })
    
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
        }
        existing.from_port_scan = true
        if (!existing.ip_address && portData.ip_address) {
          existing.ip_address = portData.ip_address
        }
      }
    })
    
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
      }
    })
    
    return Array.from(dataMap.values()).map(asset => {
      const riskAnalysis = calculateRiskScore(asset)
      return {
        ...asset,
        risk_score: riskAnalysis.score,
        risk_tier: riskAnalysis.tier,
        risk_findings: riskAnalysis.findings,
        interesting_score: riskAnalysis.score
      }
    })
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
      
      if (filterInteresting && item.risk_score < 15) return false
      
      if (filterTier !== 'all' && item.risk_tier !== filterTier) return false
      
      return true
    })
  }, [mergedData, searchTerm, filterStatus, filterProtocol, filterInteresting, filterTier])

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
        case 'risk_score':
        case 'interesting':
          aVal = a.risk_score || 0
          bVal = b.risk_score || 0
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

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Subdomain',
      'Risk Score',
      'Risk Tier',
      'Status',
      'Protocol',
      'HTTP Code',
      'Response Time (ms)',
      'IP Address',
      'Title',
      'Server',
      'Open Ports',
      'Technologies'
    ]
    
    const rows = sortedData.map(item => [
      item.subdomain,
      item.risk_score || 0,
      item.risk_tier || 'LOW',
      item.is_active ? 'Active' : 'Inactive',
      item.protocol || 'N/A',
      item.status_code || 'N/A',
      item.response_time || 'N/A',
      item.ip_address || 'N/A',
      item.title || 'N/A',
      item.server || 'N/A',
      item.open_ports ? item.open_ports.map(p => `${p.port}/${p.service}`).join('; ') : 'N/A',
      item.technologies || 'N/A'
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
    critical_targets: mergedData.filter(d => d.risk_tier === 'CRITICAL').length,
    high_targets: mergedData.filter(d => d.risk_tier === 'HIGH').length,
    medium_targets: mergedData.filter(d => d.risk_tier === 'MEDIUM').length,
    low_targets: mergedData.filter(d => d.risk_tier === 'LOW').length,
  }

  // High value targets
  const highValueTargets = useMemo(() => {
    return mergedData
      .filter(d => d.risk_score >= 30)
      .sort((a, b) => b.risk_score - a.risk_score)
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

  // Helper to get tier color
  const getTierColor = (tier) => {
    switch (tier) {
      case 'CRITICAL': return 'text-red-400 bg-red-500/20 border-red-500/30'
      case 'HIGH': return 'text-orange-400 bg-orange-500/20 border-orange-500/30'
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
      case 'LOW': return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Target className="text-cyber-blue" />
            Attack Surface Dashboard
          </h2>
          <p className="text-gray-400 mt-2">Elite bug bounty hunter methodology • Battle-tested risk scoring</p>
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

      {/* Overview Mode - Just Metrics */}
      {selectedDomain && mergedData.length > 0 && viewMode === 'overview' && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <AlertTriangle className="text-red-400" size={24} />
                <Shield className="text-red-400/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-red-400 mb-1">{stats.critical_targets}</div>
              <div className="text-sm text-gray-400">CRITICAL Tier</div>
              <div className="text-xs text-red-400 mt-2">
                Drop everything and test! 🎯
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Zap className="text-orange-400" size={24} />
                <TrendingUp className="text-orange-400/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-orange-400 mb-1">{stats.high_targets}</div>
              <div className="text-sm text-gray-400">HIGH Priority</div>
              <div className="text-xs text-orange-400 mt-2">
                Priority testing targets
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border border-yellow-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Eye className="text-yellow-400" size={24} />
                <Activity className="text-yellow-400/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-yellow-400 mb-1">{stats.medium_targets}</div>
              <div className="text-sm text-gray-400">MEDIUM Tier</div>
              <div className="text-xs text-yellow-400 mt-2">
                Worth investigating
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyber-blue/10 to-cyber-blue/5 border border-cyber-blue/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Globe className="text-cyber-blue" size={24} />
                <BarChart3 className="text-cyber-blue/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.total}</div>
              <div className="text-sm text-gray-400">Total Assets</div>
              <div className="text-xs text-cyber-blue mt-2">
                {stats.active > 0 ? `${((stats.active / stats.total) * 100).toFixed(1)}% active` : 'No active hosts'}
              </div>
            </div>
          </div>

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

          {/* Data Source Summary */}
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="text-cyber-blue" size={20} />
              Reconnaissance Summary
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-dark-200 border border-dark-50 rounded-lg">
                <div className="text-2xl font-bold text-cyber-blue mb-1">{stats.with_subdomain_data}</div>
                <div className="text-xs text-gray-400">Subdomain Scan</div>
              </div>
              <div className="p-4 bg-dark-200 border border-dark-50 rounded-lg">
                <div className="text-2xl font-bold text-cyber-green mb-1">{stats.with_probe_data}</div>
                <div className="text-xs text-gray-400">Live Hosts</div>
              </div>
              <div className="p-4 bg-dark-200 border border-dark-50 rounded-lg">
                <div className="text-2xl font-bold text-cyber-pink mb-1">{stats.with_port_data}</div>
                <div className="text-xs text-gray-400">Port Scanned</div>
              </div>
              <div className="p-4 bg-dark-200 border border-dark-50 rounded-lg">
                <div className="text-2xl font-bold text-cyber-purple mb-1">{stats.with_content_discovery}</div>
                <div className="text-xs text-gray-400">Content Discovery</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Attack Surface Mode - Validation & Exploitation Focus */}
      {selectedDomain && mergedData.length > 0 && viewMode === 'attack-surface' && (
        <>
          {/* Validation Status Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Shield className="text-purple-400" size={24} />
                <CheckCircle className="text-purple-400/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-purple-400 mb-1">
                {mergedData.filter(t => t.validated).length}
              </div>
              <div className="text-sm text-gray-400">Validated Targets</div>
              <div className="text-xs text-purple-400 mt-2">
                Vulnerability checks completed
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <AlertTriangle className="text-red-400" size={24} />
                <Zap className="text-red-400/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-red-400 mb-1">
                {mergedData.filter(t => t.confirmed_vulns && t.confirmed_vulns > 0).length}
              </div>
              <div className="text-sm text-gray-400">Exploitable Targets</div>
              <div className="text-xs text-red-400 mt-2">
                Confirmed vulnerabilities found
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border border-yellow-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Target className="text-yellow-400" size={24} />
                <Activity className="text-yellow-400/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-yellow-400 mb-1">
                {highValueTargets.filter(t => !t.validated).length}
              </div>
              <div className="text-sm text-gray-400">Pending Validation</div>
              <div className="text-xs text-yellow-400 mt-2">
                High-value targets to check
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyber-blue/10 to-cyber-blue/5 border border-cyber-blue/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <Layers className="text-cyber-blue" size={24} />
                <BarChart3 className="text-cyber-blue/50" size={16} />
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {mergedData.reduce((sum, t) => sum + (t.confirmed_vulns || 0), 0)}
              </div>
              <div className="text-sm text-gray-400">Total Vulnerabilities</div>
              <div className="text-xs text-cyber-blue mt-2">
                Across all validated targets
              </div>
            </div>
          </div>

          {/* High Value Targets with Validation */}
          {highValueTargets.length > 0 && (
            <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
              <button
                onClick={() => toggleSection('high_value_targets')}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Target className="text-red-400" size={20} />
                  🎯 Top Priority Targets
                  <span className="ml-2 px-2 py-0.5 bg-red-500/20 rounded-full text-xs text-red-400">
                    {highValueTargets.length}
                  </span>
                </h3>
                {expandedSections.high_value_targets ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
              </button>

              {expandedSections.high_value_targets && (
                <div className="space-y-3">
                  {highValueTargets.map((target, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 hover:border-opacity-100 transition-all ${
                        target.risk_tier === 'CRITICAL' 
                          ? 'bg-red-500/5 border-red-500/30 hover:border-red-500/50' 
                          : 'bg-orange-500/5 border-orange-500/30 hover:border-orange-500/50'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Rank Badge */}
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          target.risk_tier === 'CRITICAL' ? 'bg-red-500/20' : 'bg-orange-500/20'
                        }`}>
                          <span className={`text-xl font-bold ${
                            target.risk_tier === 'CRITICAL' ? 'text-red-400' : 'text-orange-400'
                          }`}>
                            #{idx + 1}
                          </span>
                        </div>
                        
                        {/* Target Info */}
                        <div className="flex-1 min-w-0">
                          {/* Subdomain and Tier */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-white font-mono text-base font-semibold truncate">
                              {target.subdomain}
                            </span>
                            {target.is_active && (
                              <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                            )}
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getTierColor(target.risk_tier)}`}>
                              {target.risk_tier}
                            </span>
                          </div>

                          {/* Risk Findings */}
                          {target.risk_findings && target.risk_findings.length > 0 && (
                            <div className="space-y-1 mb-3">
                              {target.risk_findings.slice(0, 3).map((finding, fidx) => (
                                <div key={fidx} className="flex items-start gap-2 text-xs">
                                  <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    finding.type === 'combo_bonus' || finding.severity >= 25 
                                      ? 'bg-red-400' 
                                      : finding.severity >= 15 
                                      ? 'bg-orange-400' 
                                      : 'bg-yellow-400'
                                  }`} />
                                  <div>
                                    <div className="text-gray-300">{finding.description}</div>
                                    <div className="text-gray-500 text-xs">{finding.impact}</div>
                                  </div>
                                </div>
                              ))}
                              {target.risk_findings.length > 3 && (
                                <div className="text-xs text-gray-500 ml-3">
                                  +{target.risk_findings.length - 3} more findings
                                </div>
                              )}
                            </div>
                          )}

                          {/* Quick Stats */}
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

                        {/* Score and Actions */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-gray-500 mb-1">Risk Score</div>
                            <div className={`text-2xl font-bold ${
                              target.risk_tier === 'CRITICAL' ? 'text-red-400' : 'text-orange-400'
                            }`}>
                              {target.risk_score}
                            </div>
                          </div>
                          
                          {/* Validation Button */}
                          <button
                            onClick={() => handleValidateTarget(target)}
                            disabled={validating[target.subdomain]}
                            className="p-2 bg-cyber-purple/20 rounded hover:bg-cyber-purple/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            title="Validate vulnerabilities"
                          >
                            {validating[target.subdomain] ? (
                              <Loader size={16} className="animate-spin text-cyber-purple" />
                            ) : (
                              <Shield size={16} className="text-cyber-purple" />
                            )}
                          </button>
                          
                          {target.is_active && (
                            <a
                              href={`${target.protocol || 'https'}://${target.subdomain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-dark-200 rounded transition-all"
                            >
                              <ExternalLink size={16} className={
                                target.risk_tier === 'CRITICAL' ? 'text-red-400' : 'text-orange-400'
                              } />
                            </a>
                          )}
                        </div>
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
            <div className="ml-auto flex items-center gap-2">
              <Shield className="text-red-400" size={14} />
              <span className="text-gray-400">Risk Scoring: <span className="text-white font-medium">Elite BB Hunter Methodology</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
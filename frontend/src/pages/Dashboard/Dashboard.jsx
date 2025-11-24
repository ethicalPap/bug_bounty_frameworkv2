import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getSubdomains, validateTarget, quickValidateTarget } from '../../api/client'
import { 
  Globe, 
  Activity, 
  Search, 
  Network, 
  ChevronRight,
  Shield,
  Target,
  TrendingUp,
  Server,
  Layers,
  BarChart3,
  AlertTriangle,
  Zap,
  Eye,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader,
  Download,
  Copy,
  Filter,
  ChevronDown,
  ChevronUp,
  Code,
  Lock,
  RefreshCw,
  FileText,
  Database,
  Terminal
} from 'lucide-react'

const STORAGE_KEYS = {
  SUBDOMAIN_RESULTS: 'subdomain_scanner_last_domain',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
  PORT_SCAN_RESULTS: 'port_scan_results',
  CONTENT_DISCOVERY_RESULTS: 'content_discovery_results',
  FILTER_STATE: 'dashboard_filter_state',
  SORT_STATE: 'dashboard_sort_state',
  VIEW_MODE: 'dashboard_view_mode',
}

// Risk scoring keywords
const RISK_KEYWORDS = {
  HIGH: ['admin', 'api', 'dev', 'stage', 'staging', 'test', 'internal', 'vpn', 'db', 'database', 'backup'],
  MEDIUM: ['beta', 'qa', 'uat', 'demo', 'sandbox', 'git', 'jenkins', 'ci'],
  LOW: ['www', 'mail', 'blog', 'cdn', 'static', 'assets']
}

// Critical services for security assessment
const CRITICAL_SERVICES = {
  3389: { name: 'RDP', severity: 'critical' },
  5900: { name: 'VNC', severity: 'critical' },
  27017: { name: 'MongoDB', severity: 'critical' },
  6379: { name: 'Redis', severity: 'critical' },
  9200: { name: 'Elasticsearch', severity: 'critical' },
  445: { name: 'SMB', severity: 'high' },
  3306: { name: 'MySQL', severity: 'high' },
  5432: { name: 'PostgreSQL', severity: 'high' },
  1433: { name: 'MSSQL', severity: 'high' },
  22: { name: 'SSH', severity: 'medium' },
  21: { name: 'FTP', severity: 'medium' },
  23: { name: 'Telnet', severity: 'high' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // State management
  const [selectedDomain, setSelectedDomain] = useState(
    () => localStorage.getItem(STORAGE_KEYS.SUBDOMAIN_RESULTS) || ''
  )
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || 'overview'
  )
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    highValue: true,
    attackSurface: true,
    criticalFindings: true,
    reconnaissance: true
  })
  
  // Filter state
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FILTER_STATE)
      return saved ? JSON.parse(saved) : {
        search: '',
        status: 'all',
        protocol: 'all',
        tier: 'all',
        interesting: false,
        hasVulnerabilities: false,
        hasPorts: false,
        hasEndpoints: false
      }
    } catch (error) {
      console.error('Error parsing filter state:', error)
      return {
        search: '',
        status: 'all',
        protocol: 'all',
        tier: 'all',
        interesting: false,
        hasVulnerabilities: false,
        hasPorts: false,
        hasEndpoints: false
      }
    }
  })
  
  // Sort state
  const [sortConfig, setSortConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SORT_STATE)
      return saved ? JSON.parse(saved) : {
        field: 'risk_score',
        direction: 'desc'
      }
    } catch (error) {
      console.error('Error parsing sort state:', error)
      return {
        field: 'risk_score',
        direction: 'desc'
      }
    }
  })
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50
  
  // Validation state
  const [validatingTargets, setValidatingTargets] = useState(new Set())
  const [validationResults, setValidationResults] = useState({})

  // Fetch data from various sources
  const { data: subdomainDataRaw, isLoading } = useQuery({
    queryKey: ['subdomains', selectedDomain],
    queryFn: () => getSubdomains(selectedDomain),
    enabled: !!selectedDomain,
    staleTime: Infinity,
    cacheTime: Infinity
  })

  // Ensure subdomainData is always an array
  const subdomainData = useMemo(() => {
    if (!subdomainDataRaw) return []
    if (Array.isArray(subdomainDataRaw)) return subdomainDataRaw
    if (subdomainDataRaw.subdomains && Array.isArray(subdomainDataRaw.subdomains)) {
      return subdomainDataRaw.subdomains
    }
    return []
  }, [subdomainDataRaw])

  const liveHostsData = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error('Error parsing live hosts data:', error)
      return []
    }
  }, [])

  const portScanData = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PORT_SCAN_RESULTS)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error('Error parsing port scan data:', error)
      return []
    }
  }, [])

  const contentDiscoveryData = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error('Error parsing content discovery data:', error)
      return []
    }
  }, [])

  // Calculate risk score for a subdomain
  const calculateRiskScore = (subdomain) => {
    let score = 0
    const subdomainLower = subdomain.toLowerCase()
    
    // Keyword analysis (0-40 points)
    if (RISK_KEYWORDS.HIGH.some(kw => subdomainLower.includes(kw))) score += 40
    else if (RISK_KEYWORDS.MEDIUM.some(kw => subdomainLower.includes(kw))) score += 25
    else if (RISK_KEYWORDS.LOW.some(kw => subdomainLower.includes(kw))) score += 5
    else score += 15 // Unknown/custom subdomain
    
    // Open ports analysis (0-30 points)
    const ports = portScanData.filter(p => p.subdomain === subdomain)
    if (ports.length > 0) {
      const criticalPorts = ports.filter(p => CRITICAL_SERVICES[p.port]?.severity === 'critical')
      const highPorts = ports.filter(p => CRITICAL_SERVICES[p.port]?.severity === 'high')
      
      if (criticalPorts.length > 0) score += 30
      else if (highPorts.length > 0) score += 20
      else if (ports.length > 10) score += 15
      else score += 10
    }
    
    // Content discovery analysis (0-20 points)
    const endpoints = contentDiscoveryData.filter(e => e.subdomain === subdomain)
    const interestingEndpoints = endpoints.filter(e => e.is_interesting)
    const apiEndpoints = endpoints.filter(e => 
      e.path?.includes('/api/') || e.path?.includes('/v1/') || e.path?.includes('/v2/')
    )
    
    if (interestingEndpoints.length > 0) score += 20
    else if (apiEndpoints.length > 5) score += 15
    else if (endpoints.length > 20) score += 10
    else if (endpoints.length > 0) score += 5
    
    // Staging/development indicators (0-10 points)
    if (subdomainLower.includes('staging') || 
        subdomainLower.includes('dev') || 
        subdomainLower.includes('test')) {
      score += 10
    }
    
    return Math.min(100, score)
  }

  // Merge all data sources
  const mergedData = useMemo(() => {
    return subdomainData.map(sub => {
      const hostInfo = liveHostsData.find(h => h.subdomain === sub.subdomain)
      const ports = portScanData.filter(p => p.subdomain === sub.subdomain)
      const endpoints = contentDiscoveryData.filter(e => e.subdomain === sub.subdomain)
      
      const riskScore = calculateRiskScore(sub.subdomain)
      const tier = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low'
      
      return {
        ...sub,
        is_active: hostInfo?.is_active || false,
        status_code: hostInfo?.status_code,
        final_url: hostInfo?.final_url,
        response_time: hostInfo?.response_time,
        server: hostInfo?.server,
        content_type: hostInfo?.content_type,
        ports: ports,
        endpoints: endpoints,
        interesting_endpoints: endpoints.filter(e => e.is_interesting),
        risk_score: riskScore,
        tier: tier,
        critical_services: ports.filter(p => CRITICAL_SERVICES[p.port]?.severity === 'critical'),
        validation_result: validationResults[sub.subdomain]
      }
    })
  }, [subdomainData, liveHostsData, portScanData, contentDiscoveryData, validationResults])

  // Apply filters
  const filteredData = useMemo(() => {
    return mergedData.filter(item => {
      // Search filter
      if (filters.search && !item.subdomain.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }
      
      // Status filter
      if (filters.status !== 'all') {
        if (filters.status === 'active' && !item.is_active) return false
        if (filters.status === 'inactive' && item.is_active) return false
      }
      
      // Protocol filter
      if (filters.protocol !== 'all') {
        const url = item.final_url || ''
        if (filters.protocol === 'http' && !url.startsWith('http://')) return false
        if (filters.protocol === 'https' && !url.startsWith('https://')) return false
      }
      
      // Tier filter
      if (filters.tier !== 'all' && item.tier !== filters.tier) return false
      
      // Interesting endpoints filter
      if (filters.interesting && item.interesting_endpoints.length === 0) return false
      
      // Has vulnerabilities filter
      if (filters.hasVulnerabilities && !item.validation_result?.has_vulnerabilities) return false
      
      // Has ports filter
      if (filters.hasPorts && item.ports.length === 0) return false
      
      // Has endpoints filter
      if (filters.hasEndpoints && item.endpoints.length === 0) return false
      
      return true
    })
  }, [mergedData, filters])

  // Apply sorting
  const sortedData = useMemo(() => {
    const sorted = [...filteredData]
    sorted.sort((a, b) => {
      let aVal, bVal
      
      switch (sortConfig.field) {
        case 'subdomain':
          aVal = a.subdomain
          bVal = b.subdomain
          break
        case 'status':
          aVal = a.is_active ? 1 : 0
          bVal = b.is_active ? 1 : 0
          break
        case 'protocol':
          aVal = a.final_url?.startsWith('https://') ? 1 : 0
          bVal = b.final_url?.startsWith('https://') ? 1 : 0
          break
        case 'response_time':
          aVal = a.response_time || 0
          bVal = b.response_time || 0
          break
        case 'risk_score':
          aVal = a.risk_score
          bVal = b.risk_score
          break
        case 'ports':
          aVal = a.ports.length
          bVal = b.ports.length
          break
        case 'endpoints':
          aVal = a.endpoints.length
          bVal = b.endpoints.length
          break
        default:
          return 0
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    
    return sorted
  }, [filteredData, sortConfig])

  // Pagination
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage
    return sortedData.slice(startIdx, startIdx + itemsPerPage)
  }, [sortedData, currentPage])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total_subdomains: mergedData.length,
      active_hosts: mergedData.filter(d => d.is_active).length,
      total_ports: portScanData.length,
      critical_ports: portScanData.filter(p => CRITICAL_SERVICES[p.port]?.severity === 'critical').length,
      total_endpoints: contentDiscoveryData.length,
      interesting_endpoints: contentDiscoveryData.filter(e => e.is_interesting).length,
      high_risk: mergedData.filter(d => d.tier === 'high').length,
      medium_risk: mergedData.filter(d => d.tier === 'medium').length,
      low_risk: mergedData.filter(d => d.tier === 'low').length,
      validated: Object.keys(validationResults).length,
      with_vulnerabilities: Object.values(validationResults).filter(r => r.has_vulnerabilities).length
    }
  }, [mergedData, portScanData, contentDiscoveryData, validationResults])

  // Attack surface score (0-100)
  const attackSurfaceScore = useMemo(() => {
    let score = 0
    score += Math.min(25, mergedData.length * 0.5)
    score += Math.min(20, stats.active_hosts * 2)
    score += Math.min(25, portScanData.length * 0.5)
    score += Math.min(20, contentDiscoveryData.length * 0.1)
    score += Math.min(10, stats.critical_ports * 5)
    return Math.round(score)
  }, [mergedData, stats, portScanData, contentDiscoveryData])

  // High-value targets
  const highValueTargets = useMemo(() => {
    return mergedData
      .filter(d => d.tier === 'high' && d.is_active)
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 10)
  }, [mergedData])

  // Top services
  const topServices = useMemo(() => {
    const serviceCounts = {}
    portScanData.forEach(port => {
      const service = port.service || `Port ${port.port}`
      serviceCounts[service] = (serviceCounts[service] || 0) + 1
    })
    
    return Object.entries(serviceCounts)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [portScanData])

  // Handle validation
  const handleValidate = async (subdomain, quick = false) => {
    setValidatingTargets(prev => new Set([...prev, subdomain]))
    
    try {
      const result = quick 
        ? await quickValidateTarget(subdomain)
        : await validateTarget(subdomain)
      
      setValidationResults(prev => ({
        ...prev,
        [subdomain]: result
      }))
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setValidatingTargets(prev => {
        const newSet = new Set(prev)
        newSet.delete(subdomain)
        return newSet
      })
    }
  }

  // Handle sort
  const handleSort = (field) => {
    setSortConfig(prev => {
      const newConfig = {
        field,
        direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
      }
      localStorage.setItem(STORAGE_KEYS.SORT_STATE, JSON.stringify(newConfig))
      return newConfig
    })
    setCurrentPage(1)
  }

  // Update filters
  const updateFilters = (updates) => {
    const newFilters = { ...filters, ...updates }
    setFilters(newFilters)
    localStorage.setItem(STORAGE_KEYS.FILTER_STATE, JSON.stringify(newFilters))
    setCurrentPage(1)
  }

  // Export data
  const handleExport = (format = 'json') => {
    const dataToExport = filteredData.map(item => ({
      subdomain: item.subdomain,
      active: item.is_active,
      status_code: item.status_code,
      risk_score: item.risk_score,
      tier: item.tier,
      ports: item.ports.length,
      endpoints: item.endpoints.length,
      critical_services: item.critical_services.length,
      interesting_endpoints: item.interesting_endpoints.length
    }))
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashboard-export-${Date.now()}.json`
      a.click()
    } else if (format === 'csv') {
      const headers = Object.keys(dataToExport[0] || {}).join(',')
      const rows = dataToExport.map(row => Object.values(row).join(','))
      const csv = [headers, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashboard-export-${Date.now()}.csv`
      a.click()
    }
  }

  // Copy to clipboard
  const handleCopy = () => {
    const text = filteredData.map(d => d.subdomain).join('\n')
    navigator.clipboard.writeText(text)
  }

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-500'
      case 'high': return 'text-orange-500'
      case 'medium': return 'text-yellow-500'
      default: return 'text-gray-400'
    }
  }

  const getTierColor = (tier) => {
    switch (tier) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/30'
      case 'medium': return 'text-orange-500 bg-orange-500/10 border-orange-500/30'
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/30'
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    }
  }

  if (!selectedDomain) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Domain Selected</h3>
          <p className="text-gray-400 mb-6">Start by scanning a domain to see the dashboard</p>
          <button
            onClick={() => navigate('/subdomain-scanner')}
            className="px-6 py-3 bg-cyber-blue text-white rounded-lg hover:bg-cyber-blue/80 transition-colors"
          >
            Start Scanning
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader className="w-16 h-16 text-cyber-blue mx-auto mb-4 animate-spin" />
          <h3 className="text-xl font-semibold text-white mb-2">Loading Dashboard</h3>
          <p className="text-gray-400">Gathering reconnaissance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyber-blue" />
            Attack Surface Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Analyzing <span className="text-cyber-blue font-medium">{selectedDomain}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex gap-2 bg-dark-200 rounded-lg p-1">
            <button
              onClick={() => {
                setViewMode('overview')
                localStorage.setItem(STORAGE_KEYS.VIEW_MODE, 'overview')
              }}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'overview'
                  ? 'bg-cyber-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => {
                setViewMode('detailed')
                localStorage.setItem(STORAGE_KEYS.VIEW_MODE, 'detailed')
              }}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'detailed'
                  ? 'bg-cyber-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => {
                setViewMode('attack-surface')
                localStorage.setItem(STORAGE_KEYS.VIEW_MODE, 'attack-surface')
              }}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'attack-surface'
                  ? 'bg-cyber-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Attack Surface
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={() => handleExport('json')}
            className="p-2 bg-dark-200 text-gray-400 rounded-lg hover:text-white hover:bg-dark-300 transition-colors"
            title="Export JSON"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 bg-dark-200 text-gray-400 rounded-lg hover:text-white hover:bg-dark-300 transition-colors"
            title="Copy Subdomains"
          >
            <Copy className="w-5 h-5" />
          </button>
          <button
            onClick={() => queryClient.invalidateQueries(['subdomains'])}
            className="p-2 bg-dark-200 text-gray-400 rounded-lg hover:text-white hover:bg-dark-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Overview Mode */}
      {viewMode === 'overview' && (
        <>
          {/* Attack Surface Score */}
          <div className="bg-dark-200 rounded-lg p-6 border border-dark-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Target className="w-6 h-6 text-cyber-pink" />
                Attack Surface Score
              </h2>
              <button
                onClick={() => toggleSection('metrics')}
                className="text-gray-400 hover:text-white"
              >
                {expandedSections.metrics ? <ChevronUp /> : <ChevronDown />}
              </button>
            </div>
            
            {expandedSections.metrics && (
              <>
                <div className="flex items-center gap-6 mb-6">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        fill="none"
                        stroke={
                          attackSurfaceScore >= 75 ? '#ef4444' :
                          attackSurfaceScore >= 50 ? '#f97316' :
                          attackSurfaceScore >= 25 ? '#eab308' :
                          '#22c55e'
                        }
                        strokeWidth="8"
                        strokeDasharray={`${attackSurfaceScore * 3.51} 351`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-3xl font-bold ${
                        attackSurfaceScore >= 75 ? 'text-red-500' :
                        attackSurfaceScore >= 50 ? 'text-orange-500' :
                        attackSurfaceScore >= 25 ? 'text-yellow-500' :
                        'text-green-500'
                      }`}>
                        {attackSurfaceScore}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-red-500">{stats.high_risk}</div>
                        <div className="text-sm text-gray-400">High Risk</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-500">{stats.medium_risk}</div>
                        <div className="text-sm text-gray-400">Medium Risk</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-500">{stats.low_risk}</div>
                        <div className="text-sm text-gray-400">Low Risk</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div
                    onClick={() => navigate('/subdomain-scanner')}
                    className="bg-gradient-to-br from-cyber-blue/10 to-cyber-blue/5 border border-cyber-blue/30 rounded-lg p-4 cursor-pointer hover:border-cyber-blue transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Globe className="w-5 h-5 text-cyber-blue" />
                      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.total_subdomains}</div>
                    <div className="text-sm text-gray-400">Subdomains</div>
                  </div>

                  <div
                    onClick={() => navigate('/live-hosts')}
                    className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30 rounded-lg p-4 cursor-pointer hover:border-green-500 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Activity className="w-5 h-5 text-green-500" />
                      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.active_hosts}</div>
                    <div className="text-sm text-gray-400">Active Hosts</div>
                  </div>

                  <div
                    onClick={() => navigate('/port-scanner')}
                    className="bg-gradient-to-br from-cyber-pink/10 to-cyber-pink/5 border border-cyber-pink/30 rounded-lg p-4 cursor-pointer hover:border-cyber-pink transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Server className="w-5 h-5 text-cyber-pink" />
                      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.total_ports}</div>
                    <div className="text-sm text-gray-400">Open Ports</div>
                    {stats.critical_ports > 0 && (
                      <div className="text-xs text-red-500 mt-1">
                        {stats.critical_ports} critical
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => navigate('/content-discovery')}
                    className="bg-gradient-to-br from-cyber-purple/10 to-cyber-purple/5 border border-cyber-purple/30 rounded-lg p-4 cursor-pointer hover:border-cyber-purple transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Network className="w-5 h-5 text-cyber-purple" />
                      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.total_endpoints}</div>
                    <div className="text-sm text-gray-400">Endpoints</div>
                    {stats.interesting_endpoints > 0 && (
                      <div className="text-xs text-yellow-500 mt-1">
                        {stats.interesting_endpoints} interesting
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* High-Value Targets */}
          <div className="bg-dark-200 rounded-lg p-6 border border-dark-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Target className="w-6 h-6 text-red-500" />
                High-Value Targets
                <span className="text-sm text-gray-400 font-normal">
                  ({highValueTargets.length} found)
                </span>
              </h2>
              <button
                onClick={() => toggleSection('highValue')}
                className="text-gray-400 hover:text-white"
              >
                {expandedSections.highValue ? <ChevronUp /> : <ChevronDown />}
              </button>
            </div>

            {expandedSections.highValue && (
              <div className="space-y-3">
                {highValueTargets.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No high-value targets identified</p>
                  </div>
                ) : (
                  highValueTargets.map((target, idx) => (
                    <div
                      key={target.subdomain}
                      className="bg-dark-100 rounded-lg p-4 border border-red-500/20 hover:border-red-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-mono text-gray-400">#{idx + 1}</span>
                            <a
                              href={target.final_url || `https://${target.subdomain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white hover:text-cyber-blue transition-colors font-medium"
                            >
                              {target.subdomain}
                            </a>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                            <span className={`text-xs px-2 py-1 rounded border ${getTierColor(target.tier)}`}>
                              {target.tier.toUpperCase()}
                            </span>
                            <span className="text-sm font-bold text-red-500">
                              Risk: {target.risk_score}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-gray-400">Ports</div>
                              <div className="text-white font-medium">{target.ports.length}</div>
                              {target.critical_services.length > 0 && (
                                <div className="text-xs text-red-500">
                                  {target.critical_services.length} critical
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-gray-400">Endpoints</div>
                              <div className="text-white font-medium">{target.endpoints.length}</div>
                              {target.interesting_endpoints.length > 0 && (
                                <div className="text-xs text-yellow-500">
                                  {target.interesting_endpoints.length} interesting
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-gray-400">Status</div>
                              <div className="text-white font-medium">{target.status_code || 'N/A'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Response</div>
                              <div className="text-white font-medium">
                                {target.response_time ? `${target.response_time}ms` : 'N/A'}
                              </div>
                            </div>
                          </div>

                          {target.critical_services.length > 0 && (
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <span className="text-sm text-gray-400">Critical Services:</span>
                              {target.critical_services.map(port => (
                                <span
                                  key={port.port}
                                  className="text-xs px-2 py-1 bg-red-500/10 text-red-500 rounded border border-red-500/30"
                                >
                                  {CRITICAL_SERVICES[port.port]?.name || port.service} ({port.port})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleValidate(target.subdomain, true)}
                            disabled={validatingTargets.has(target.subdomain)}
                            className="p-2 bg-cyber-blue/20 text-cyber-blue rounded hover:bg-cyber-blue/30 transition-colors disabled:opacity-50"
                            title="Quick Validate"
                          >
                            {validatingTargets.has(target.subdomain) ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleValidate(target.subdomain, false)}
                            disabled={validatingTargets.has(target.subdomain)}
                            className="p-2 bg-cyber-purple/20 text-cyber-purple rounded hover:bg-cyber-purple/30 transition-colors disabled:opacity-50"
                            title="Full Validate"
                          >
                            {validatingTargets.has(target.subdomain) ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Shield className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {target.validation_result && (
                        <div className="mt-3 p-3 bg-dark-200 rounded border border-dark-300">
                          <div className="flex items-center gap-2 mb-2">
                            {target.validation_result.has_vulnerabilities ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            <span className="text-sm font-medium text-white">
                              Validation Result
                            </span>
                          </div>
                          <div className="text-sm text-gray-400">
                            {target.validation_result.summary || 'Validation complete'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Attack Surface Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Critical Findings */}
            <div className="bg-dark-200 rounded-lg p-6 border border-dark-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  Critical Findings
                </h2>
                <button
                  onClick={() => toggleSection('criticalFindings')}
                  className="text-gray-400 hover:text-white"
                >
                  {expandedSections.criticalFindings ? <ChevronUp /> : <ChevronDown />}
                </button>
              </div>

              {expandedSections.criticalFindings && (
                <div className="space-y-4">
                  {stats.critical_ports > 0 ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Server className="w-5 h-5 text-red-500" />
                          <span className="font-medium text-white">Critical Services Exposed</span>
                        </div>
                        <span className="text-2xl font-bold text-red-500">{stats.critical_ports}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">
                        High-risk services detected (RDP, VNC, databases)
                      </p>
                      <button
                        onClick={() => {
                          updateFilters({ hasPorts: true })
                          setViewMode('detailed')
                        }}
                        className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1"
                      >
                        Investigate <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}

                  {stats.interesting_endpoints > 0 ? (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Eye className="w-5 h-5 text-yellow-500" />
                          <span className="font-medium text-white">Interesting Endpoints</span>
                        </div>
                        <span className="text-2xl font-bold text-yellow-500">{stats.interesting_endpoints}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">
                        Admin panels, configs, or sensitive paths found
                      </p>
                      <button
                        onClick={() => navigate('/content-discovery')}
                        className="text-sm text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                      >
                        Investigate <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}

                  {stats.with_vulnerabilities > 0 ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-red-500" />
                          <span className="font-medium text-white">Validated Vulnerabilities</span>
                        </div>
                        <span className="text-2xl font-bold text-red-500">{stats.with_vulnerabilities}</span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">
                        Confirmed security issues from validation scans
                      </p>
                      <button
                        onClick={() => {
                          updateFilters({ hasVulnerabilities: true })
                          setViewMode('detailed')
                        }}
                        className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1"
                      >
                        Review <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}

                  {stats.critical_ports === 0 && stats.interesting_endpoints === 0 && stats.with_vulnerabilities === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <p className="text-green-500 font-medium">No Critical Issues Detected</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Continue monitoring for new findings
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Top Services */}
            <div className="bg-dark-200 rounded-lg p-6 border border-dark-300">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Database className="w-6 h-6 text-cyber-purple" />
                Top Services Exposed
              </h2>
              
              <div className="space-y-3">
                {topServices.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No services detected</p>
                  </div>
                ) : (
                  topServices.map((item, idx) => (
                    <div key={item.service} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-cyber-purple/20 text-cyber-purple flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium capitalize">{item.service}</div>
                        <div className="text-sm text-gray-400">{item.count} instances</div>
                      </div>
                      <div className="w-24 bg-dark-100 rounded-full h-2">
                        <div
                          className="bg-cyber-purple h-2 rounded-full"
                          style={{ width: `${(item.count / topServices[0].count) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
                
                {topServices.length > 0 && (
                  <button
                    onClick={() => navigate('/port-scanner')}
                    className="w-full mt-4 text-sm text-cyber-purple hover:text-cyber-purple/80 flex items-center justify-center gap-1"
                  >
                    View All Services <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reconnaissance Coverage */}
          <div className="bg-dark-200 rounded-lg p-6 border border-dark-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Target className="w-6 h-6 text-cyber-green" />
                Reconnaissance Coverage
              </h2>
              <button
                onClick={() => toggleSection('reconnaissance')}
                className="text-gray-400 hover:text-white"
              >
                {expandedSections.reconnaissance ? <ChevronUp /> : <ChevronDown />}
              </button>
            </div>

            {expandedSections.reconnaissance && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    stats.total_subdomains > 0 ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                  }`}>
                    <Globe className="w-8 h-8" />
                  </div>
                  <div className="text-white font-medium">Subdomain Enumeration</div>
                  <div className={`text-sm mt-1 ${stats.total_subdomains > 0 ? 'text-green-500' : 'text-gray-500'}`}>
                    {stats.total_subdomains > 0 ? 'Complete' : 'Pending'}
                  </div>
                </div>

                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    stats.active_hosts > 0 ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                  }`}>
                    <Activity className="w-8 h-8" />
                  </div>
                  <div className="text-white font-medium">Live Host Probing</div>
                  <div className={`text-sm mt-1 ${stats.active_hosts > 0 ? 'text-green-500' : 'text-gray-500'}`}>
                    {stats.active_hosts > 0 ? 'Complete' : 'Pending'}
                  </div>
                </div>

                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    stats.total_ports > 0 ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                  }`}>
                    <Server className="w-8 h-8" />
                  </div>
                  <div className="text-white font-medium">Port Scanning</div>
                  <div className={`text-sm mt-1 ${stats.total_ports > 0 ? 'text-green-500' : 'text-gray-500'}`}>
                    {stats.total_ports > 0 ? 'Complete' : 'Pending'}
                  </div>
                </div>

                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    stats.total_endpoints > 0 ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                  }`}>
                    <Network className="w-8 h-8" />
                  </div>
                  <div className="text-white font-medium">Content Discovery</div>
                  <div className={`text-sm mt-1 ${stats.total_endpoints > 0 ? 'text-green-500' : 'text-gray-500'}`}>
                    {stats.total_endpoints > 0 ? 'Complete' : 'Pending'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/visualization')}
              className="bg-gradient-to-br from-cyber-purple/10 to-cyber-purple/5 border border-cyber-purple/30 rounded-lg p-6 hover:border-cyber-purple transition-colors text-left group"
            >
              <BarChart3 className="w-8 h-8 text-cyber-purple mb-3" />
              <div className="text-white font-medium mb-1">View Analytics</div>
              <div className="text-sm text-gray-400">Detailed visualizations</div>
              <ChevronRight className="w-5 h-5 text-gray-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => navigate('/exports')}
              className="bg-gradient-to-br from-cyber-green/10 to-cyber-green/5 border border-cyber-green/30 rounded-lg p-6 hover:border-cyber-green transition-colors text-left group"
            >
              <Layers className="w-8 h-8 text-cyber-green mb-3" />
              <div className="text-white font-medium mb-1">Export Data</div>
              <div className="text-sm text-gray-400">Download reports</div>
              <ChevronRight className="w-5 h-5 text-gray-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => navigate('/subdomain-scanner')}
              className="bg-gradient-to-br from-cyber-blue/10 to-cyber-blue/5 border border-cyber-blue/30 rounded-lg p-6 hover:border-cyber-blue transition-colors text-left group"
            >
              <Globe className="w-8 h-8 text-cyber-blue mb-3" />
              <div className="text-white font-medium mb-1">New Scan</div>
              <div className="text-sm text-gray-400">Start reconnaissance</div>
              <ChevronRight className="w-5 h-5 text-gray-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <button
              onClick={() => navigate('/live-hosts')}
              className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30 rounded-lg p-6 hover:border-green-500 transition-colors text-left group"
            >
              <Activity className="w-8 h-8 text-green-500 mb-3" />
              <div className="text-white font-medium mb-1">Probe Hosts</div>
              <div className="text-sm text-gray-400">Check availability</div>
              <ChevronRight className="w-5 h-5 text-gray-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </>
      )}

      {/* Detailed View Mode */}
      {viewMode === 'detailed' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-dark-200 rounded-lg p-6 border border-dark-300">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-cyber-blue" />
              <h3 className="text-lg font-semibold text-white">Filters & Search</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-2">Search Subdomains</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => updateFilters({ search: e.target.value })}
                    placeholder="Filter by subdomain..."
                    className="w-full bg-dark-100 text-white pl-10 pr-4 py-2 rounded-lg border border-dark-300 focus:border-cyber-blue focus:outline-none"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => updateFilters({ status: e.target.value })}
                  className="w-full bg-dark-100 text-white px-4 py-2 rounded-lg border border-dark-300 focus:border-cyber-blue focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              {/* Protocol Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Protocol</label>
                <select
                  value={filters.protocol}
                  onChange={(e) => updateFilters({ protocol: e.target.value })}
                  className="w-full bg-dark-100 text-white px-4 py-2 rounded-lg border border-dark-300 focus:border-cyber-blue focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                </select>
              </div>

              {/* Tier Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Risk Tier</label>
                <select
                  value={filters.tier}
                  onChange={(e) => updateFilters({ tier: e.target.value })}
                  className="w-full bg-dark-100 text-white px-4 py-2 rounded-lg border border-dark-300 focus:border-cyber-blue focus:outline-none"
                >
                  <option value="all">All Tiers</option>
                  <option value="high">High Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="low">Low Risk</option>
                </select>
              </div>

              {/* Advanced Filters */}
              <div className="md:col-span-3 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.interesting}
                    onChange={(e) => updateFilters({ interesting: e.target.checked })}
                    className="form-checkbox bg-dark-100 border-dark-300 text-cyber-blue rounded focus:ring-cyber-blue"
                  />
                  Interesting Endpoints Only
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasVulnerabilities}
                    onChange={(e) => updateFilters({ hasVulnerabilities: e.target.checked })}
                    className="form-checkbox bg-dark-100 border-dark-300 text-cyber-blue rounded focus:ring-cyber-blue"
                  />
                  Has Vulnerabilities
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasPorts}
                    onChange={(e) => updateFilters({ hasPorts: e.target.checked })}
                    className="form-checkbox bg-dark-100 border-dark-300 text-cyber-blue rounded focus:ring-cyber-blue"
                  />
                  Has Open Ports
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasEndpoints}
                    onChange={(e) => updateFilters({ hasEndpoints: e.target.checked })}
                    className="form-checkbox bg-dark-100 border-dark-300 text-cyber-blue rounded focus:ring-cyber-blue"
                  />
                  Has Endpoints
                </label>
              </div>

              {/* Reset Filters */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    const resetFilters = {
                      search: '',
                      status: 'all',
                      protocol: 'all',
                      tier: 'all',
                      interesting: false,
                      hasVulnerabilities: false,
                      hasPorts: false,
                      hasEndpoints: false
                    }
                    setFilters(resetFilters)
                    localStorage.setItem(STORAGE_KEYS.FILTER_STATE, JSON.stringify(resetFilters))
                  }}
                  className="px-4 py-2 bg-dark-100 text-gray-400 rounded-lg hover:text-white hover:bg-dark-300 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-400">
              Showing {filteredData.length} of {mergedData.length} targets
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-dark-200 rounded-lg border border-dark-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-dark-100 border-b border-dark-300">
                    <th
                      onClick={() => handleSort('subdomain')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        Subdomain
                        {sortConfig.field === 'subdomain' && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        Status
                        {sortConfig.field === 'status' && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('protocol')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        Protocol
                        {sortConfig.field === 'protocol' && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('response_time')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        Response
                        {sortConfig.field === 'response_time' && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('risk_score')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        Risk Score
                        {sortConfig.field === 'risk_score' && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('ports')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        Ports
                        {sortConfig.field === 'ports' && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('endpoints')}
                      className="px-4 py-3 text-left text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        Endpoints
                        {sortConfig.field === 'endpoints' && (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item) => (
                    <tr
                      key={item.subdomain}
                      className="border-b border-dark-300 hover:bg-dark-100 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={item.final_url || `https://${item.subdomain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white hover:text-cyber-blue transition-colors font-mono text-sm"
                          >
                            {item.subdomain}
                          </a>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.is_active ? (
                            <>
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-green-500">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-500">Inactive</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.final_url?.startsWith('https://') ? (
                            <>
                              <Lock className="w-4 h-4 text-green-500" />
                              <span className="text-sm text-green-500">HTTPS</span>
                            </>
                          ) : item.final_url?.startsWith('http://') ? (
                            <>
                              <Lock className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-500">HTTP</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-500">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white">
                          {item.response_time ? `${item.response_time}ms` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm px-2 py-1 rounded border ${getTierColor(item.tier)}`}>
                            {item.tier.toUpperCase()}
                          </span>
                          <span className={`text-sm font-bold ${
                            item.risk_score >= 70 ? 'text-red-500' :
                            item.risk_score >= 40 ? 'text-orange-500' :
                            'text-green-500'
                          }`}>
                            {item.risk_score}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">{item.ports.length}</span>
                          {item.critical_services.length > 0 && (
                            <span className="text-xs px-2 py-1 bg-red-500/10 text-red-500 rounded border border-red-500/30">
                              {item.critical_services.length} critical
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">{item.endpoints.length}</span>
                          {item.interesting_endpoints.length > 0 && (
                            <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded border border-yellow-500/30">
                              {item.interesting_endpoints.length} interesting
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleValidate(item.subdomain, true)}
                            disabled={validatingTargets.has(item.subdomain)}
                            className="p-2 bg-cyber-blue/20 text-cyber-blue rounded hover:bg-cyber-blue/30 transition-colors disabled:opacity-50"
                            title="Quick Validate"
                          >
                            {validatingTargets.has(item.subdomain) ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleValidate(item.subdomain, false)}
                            disabled={validatingTargets.has(item.subdomain)}
                            className="p-2 bg-cyber-purple/20 text-cyber-purple rounded hover:bg-cyber-purple/30 transition-colors disabled:opacity-50"
                            title="Full Validate"
                          >
                            {validatingTargets.has(item.subdomain) ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Shield className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-dark-100 border-t border-dark-300">
                <div className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attack Surface View Mode */}
      {viewMode === 'attack-surface' && (
        <div className="space-y-6">
          <div className="bg-dark-200 rounded-lg p-6 border border-dark-300">
            <h2 className="text-xl font-semibold text-white mb-6">Attack Surface Analysis</h2>
            
            {/* Coming soon placeholder */}
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Advanced Analysis View</h3>
              <p className="text-gray-400 mb-6">
                Visual attack surface mapping with relationship graphs and threat modeling
              </p>
              <button
                onClick={() => setViewMode('overview')}
                className="px-6 py-3 bg-cyber-blue text-white rounded-lg hover:bg-cyber-blue/80 transition-colors"
              >
                Back to Overview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
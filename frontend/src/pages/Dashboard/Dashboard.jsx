import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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

// Shared storage key for validation - MUST match ValidationResults page
const VALIDATION_STORAGE_KEY = 'validation_results'

const STORAGE_KEYS = {
  SUBDOMAIN_RESULTS: 'subdomain_scanner_last_domain',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
  PORT_SCAN_RESULTS: 'port_scan_results',
  CONTENT_DISCOVERY_RESULTS: 'content_discovery_results',
  VALIDATION_RESULTS: VALIDATION_STORAGE_KEY,
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
  
  // Force refresh counter to trigger re-reads from localStorage
  const [refreshCounter, setRefreshCounter] = useState(0)
  
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
  
  // Validation state - load from shared localStorage
  const [validatingTargets, setValidatingTargets] = useState(new Set())
  const [validationResults, setValidationResults] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VALIDATION_RESULTS)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  // Sync validation results from localStorage (when ValidationResults page updates)
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.VALIDATION_RESULTS)
        const parsed = saved ? JSON.parse(saved) : {}
        if (Object.keys(parsed).length !== Object.keys(validationResults).length) {
          setValidationResults(parsed)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [validationResults])

  // Fetch subdomain data from API/cache
  const { data: subdomainDataRaw, isLoading } = useQuery({
    queryKey: ['subdomains', selectedDomain],
    queryFn: () => getSubdomains(selectedDomain),
    enabled: !!selectedDomain,
    staleTime: Infinity,
    cacheTime: Infinity
  })

  // Normalize subdomain data - handle all possible formats
  const subdomainData = useMemo(() => {
    if (!subdomainDataRaw) return []
    
    // If it's already an array
    if (Array.isArray(subdomainDataRaw)) return subdomainDataRaw
    
    // If it has a 'data' property that's an array
    if (subdomainDataRaw.data && Array.isArray(subdomainDataRaw.data)) {
      return subdomainDataRaw.data
    }
    
    // If it has a 'subdomains' property
    if (subdomainDataRaw.subdomains && Array.isArray(subdomainDataRaw.subdomains)) {
      return subdomainDataRaw.subdomains
    }
    
    console.warn('Unexpected subdomain data format:', subdomainDataRaw)
    return []
  }, [subdomainDataRaw])

  // Read live hosts data from localStorage - FIXED to handle all formats
  const liveHostsData = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
      if (!stored) {
        console.log('📊 Dashboard: No live hosts data in localStorage')
        return []
      }
      const parsed = JSON.parse(stored)
      const result = Array.isArray(parsed) ? parsed : []
      console.log(`📊 Dashboard: Loaded ${result.length} live hosts from localStorage`)
      return result
    } catch (error) {
      console.error('Error parsing live hosts data:', error)
      return []
    }
  }, [refreshCounter]) // Re-read when refresh counter changes

  // Read port scan data from localStorage
  const portScanData = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PORT_SCAN_RESULTS)
      if (!stored) {
        console.log('📊 Dashboard: No port scan data in localStorage')
        return []
      }
      const parsed = JSON.parse(stored)
      const result = Array.isArray(parsed) ? parsed : []
      console.log(`📊 Dashboard: Loaded ${result.length} port scan results from localStorage`)
      return result
    } catch (error) {
      console.error('Error parsing port scan data:', error)
      return []
    }
  }, [refreshCounter])

  // Read content discovery data from localStorage
  const contentDiscoveryData = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS)
      if (!stored) {
        console.log('📊 Dashboard: No content discovery data in localStorage')
        return []
      }
      const parsed = JSON.parse(stored)
      const result = Array.isArray(parsed) ? parsed : []
      console.log(`📊 Dashboard: Loaded ${result.length} content discoveries from localStorage`)
      return result
    } catch (error) {
      console.error('Error parsing content discovery data:', error)
      return []
    }
  }, [refreshCounter])

  // Helper function to get subdomain identifier
  const getSubdomainKey = (item) => {
    return item.full_domain || item.subdomain || item.host || item.target || ''
  }

  // Calculate risk score for a subdomain
  const calculateRiskScore = (subdomainName, ports = [], endpoints = [], isActive = false) => {
    let score = 0
    const subdomainLower = subdomainName.toLowerCase()
    
    // Base score for active hosts
    if (isActive) score += 10
    
    // Keyword analysis (0-40 points)
    if (RISK_KEYWORDS.HIGH.some(kw => subdomainLower.includes(kw))) score += 40
    else if (RISK_KEYWORDS.MEDIUM.some(kw => subdomainLower.includes(kw))) score += 25
    else if (RISK_KEYWORDS.LOW.some(kw => subdomainLower.includes(kw))) score += 5
    else score += 15 // Unknown/custom subdomain
    
    // Open ports analysis (0-30 points)
    if (ports.length > 0) {
      const criticalPorts = ports.filter(p => CRITICAL_SERVICES[p.port]?.severity === 'critical')
      const highPorts = ports.filter(p => CRITICAL_SERVICES[p.port]?.severity === 'high')
      
      if (criticalPorts.length > 0) score += 30
      else if (highPorts.length > 0) score += 20
      else if (ports.length > 10) score += 15
      else score += 10
    }
    
    // Content discovery analysis (0-20 points)
    const interestingEndpoints = endpoints.filter(e => e.is_interesting)
    const apiEndpoints = endpoints.filter(e => 
      e.path?.includes('/api/') || e.path?.includes('/v1/') || e.path?.includes('/v2/')
    )
    
    if (interestingEndpoints.length > 0) score += 20
    else if (apiEndpoints.length > 5) score += 15
    else if (endpoints.length > 20) score += 10
    else if (endpoints.length > 0) score += 5
    
    return Math.min(100, score)
  }

  // Merge all data sources - FIXED matching logic
  const mergedData = useMemo(() => {
    console.log('📊 Merging data sources:')
    console.log('  - Subdomains:', subdomainData.length)
    console.log('  - Live hosts:', liveHostsData.length)
    console.log('  - Port scans:', portScanData.length)
    console.log('  - Content discoveries:', contentDiscoveryData.length)

    return subdomainData.map(sub => {
      // Get the subdomain name - handle both formats
      const subdomainName = sub.full_domain || sub.subdomain || ''
      
      // Match live host data - check multiple possible field names
      const hostInfo = liveHostsData.find(h => {
        const hostName = h.subdomain || h.full_domain || h.host || h.target || ''
        return hostName === subdomainName || 
               hostName === sub.subdomain ||
               hostName === sub.full_domain
      })
      
      // Match port data
      const ports = portScanData.filter(p => {
        const portTarget = p.target || p.subdomain || p.host || ''
        return portTarget === subdomainName || 
               portTarget === sub.subdomain ||
               portTarget === sub.full_domain
      })
      
      // Match endpoint data
      const endpoints = contentDiscoveryData.filter(e => {
        const endpointTarget = e.subdomain || e.target || e.host || ''
        return endpointTarget === subdomainName || 
               endpointTarget === sub.subdomain ||
               endpointTarget === sub.full_domain ||
               e.target_url?.includes(subdomainName)
      })
      
      // Determine if active from multiple sources
      const isActive = hostInfo?.is_active || sub.is_active || false
      
      const riskScore = calculateRiskScore(subdomainName, ports, endpoints, isActive)
      const tier = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low'
      
      return {
        ...sub,
        subdomain: subdomainName, // Normalize the field name
        is_active: isActive,
        status_code: hostInfo?.status_code || sub.status_code,
        final_url: hostInfo?.final_url || (isActive ? `https://${subdomainName}` : null),
        response_time: hostInfo?.response_time,
        server: hostInfo?.server || sub.server,
        content_type: hostInfo?.content_type,
        protocol: hostInfo?.protocol,
        ip_address: hostInfo?.ip_address || sub.ip_address,
        ports: ports,
        endpoints: endpoints,
        interesting_endpoints: endpoints.filter(e => e.is_interesting),
        risk_score: riskScore,
        tier: tier,
        critical_services: ports.filter(p => CRITICAL_SERVICES[p.port]?.severity === 'critical'),
        validation_result: validationResults[subdomainName]
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
        const protocol = item.protocol || ''
        const url = item.final_url || ''
        if (filters.protocol === 'http' && protocol !== 'http' && !url.startsWith('http://')) return false
        if (filters.protocol === 'https' && protocol !== 'https' && !url.startsWith('https://')) return false
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
          aVal = a.protocol === 'https' || a.final_url?.startsWith('https://') ? 1 : 0
          bVal = b.protocol === 'https' || b.final_url?.startsWith('https://') ? 1 : 0
          break
        case 'response_time':
          aVal = a.response_time || 9999
          bVal = b.response_time || 9999
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
      unique_ports_count: mergedData.reduce((sum, d) => sum + d.ports.length, 0),
      critical_ports: portScanData.filter(p => CRITICAL_SERVICES[p.port]?.severity === 'critical').length,
      total_endpoints: contentDiscoveryData.length,
      interesting_endpoints: contentDiscoveryData.filter(e => e.is_interesting).length,
      high_risk: mergedData.filter(d => d.tier === 'high').length,
      medium_risk: mergedData.filter(d => d.tier === 'medium').length,
      low_risk: mergedData.filter(d => d.tier === 'low').length,
      validated: Object.keys(validationResults).length,
      with_vulnerabilities: Object.values(validationResults).filter(r => r.has_vulnerabilities).length,
      // Additional stats from live hosts
      https_count: liveHostsData.filter(h => h.protocol === 'https').length,
      http_count: liveHostsData.filter(h => h.protocol === 'http').length,
    }
  }, [mergedData, portScanData, contentDiscoveryData, validationResults, liveHostsData])

  // Attack surface score (0-100)
  const attackSurfaceScore = useMemo(() => {
    let score = 0
    score += Math.min(25, mergedData.length * 0.5)
    score += Math.min(20, stats.active_hosts * 2)
    score += Math.min(25, stats.unique_ports_count * 0.5)
    score += Math.min(20, contentDiscoveryData.length * 0.1)
    score += Math.min(10, stats.critical_ports * 5)
    return Math.round(score)
  }, [mergedData, stats, contentDiscoveryData])

  // High-value targets
  const highValueTargets = useMemo(() => {
    return mergedData
      .filter(d => d.tier === 'high' || d.risk_score >= 50)
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 10)
  }, [mergedData])

  // Top services
  const topServices = useMemo(() => {
    const serviceCounts = {}
    portScanData.forEach(port => {
      const service = port.service || CRITICAL_SERVICES[port.port]?.name || `Port ${port.port}`
      serviceCounts[service] = (serviceCounts[service] || 0) + 1
    })
    
    return Object.entries(serviceCounts)
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [portScanData])

  // Handle refresh - force re-read localStorage
  const handleRefresh = () => {
    setRefreshCounter(prev => prev + 1)
    queryClient.invalidateQueries(['subdomains'])
  }

  // Handle validation
  const handleValidate = async (subdomain, quick = false) => {
    setValidatingTargets(prev => new Set([...prev, subdomain]))
    
    try {
      const targetUrl = `https://${subdomain}`
      const result = quick 
        ? await quickValidateTarget(targetUrl)
        : await validateTarget(targetUrl)
      
      const newResult = {
        ...result,
        target: subdomain,
        validated_at: new Date().toISOString(),
        validation_type: quick ? 'quick' : 'full'
      }
      
      setValidationResults(prev => {
        const updated = { ...prev, [subdomain]: newResult }
        // Save to localStorage for cross-component sync
        localStorage.setItem(STORAGE_KEYS.VALIDATION_RESULTS, JSON.stringify(updated))
        return updated
      })
      
      console.log(`✅ Validation complete for ${subdomain}:`, result)
    } catch (error) {
      console.error('Validation failed:', error)
      const errorResult = {
        target: subdomain,
        error: error.message || 'Validation failed',
        validated_at: new Date().toISOString(),
        validation_type: quick ? 'quick' : 'full'
      }
      setValidationResults(prev => {
        const updated = { ...prev, [subdomain]: errorResult }
        localStorage.setItem(STORAGE_KEYS.VALIDATION_RESULTS, JSON.stringify(updated))
        return updated
      })
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
      protocol: item.protocol,
      ip_address: item.ip_address,
      response_time: item.response_time,
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
      a.download = `dashboard-export-${selectedDomain}-${Date.now()}.json`
      a.click()
    } else if (format === 'csv') {
      const headers = Object.keys(dataToExport[0] || {}).join(',')
      const rows = dataToExport.map(row => Object.values(row).join(','))
      const csv = [headers, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashboard-export-${selectedDomain}-${Date.now()}.csv`
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
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Domain Selected</h3>
          <p className="text-gray-400 mb-6">Start by scanning a domain to see the dashboard</p>
          <button
            onClick={() => navigate('/subdomain-scanner')}
            className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-500/80 transition-colors"
          >
            Start Scanning
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <Loader className="w-16 h-16 text-emerald-400 mx-auto mb-4 animate-spin" />
          <h3 className="text-xl font-semibold text-white mb-2">Loading Dashboard</h3>
          <p className="text-gray-400">Gathering reconnaissance data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-400" />
            Attack Surface Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Analyzing <span className="text-emerald-400 font-medium">{selectedDomain}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex gap-2 bg-[#0a0a0a] rounded-lg p-1">
            <button
              onClick={() => {
                setViewMode('overview')
                localStorage.setItem(STORAGE_KEYS.VIEW_MODE, 'overview')
              }}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'overview'
                  ? 'bg-emerald-500 text-white'
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
                  ? 'bg-emerald-500 text-white'
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
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Attack Surface
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={() => handleExport('json')}
            className="p-2 bg-[#0a0a0a] text-gray-400 rounded-lg hover:text-white hover:bg-[#111111] transition-colors"
            title="Export JSON"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 bg-[#0a0a0a] text-gray-400 rounded-lg hover:text-white hover:bg-[#111111] transition-colors"
            title="Copy Subdomains"
          >
            <Copy className="w-5 h-5" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 bg-[#0a0a0a] text-gray-400 rounded-lg hover:text-white hover:bg-[#111111] transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Data Source Status */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${subdomainData.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-gray-400">Subdomains:</span>
              <span className="text-white font-medium">{subdomainData.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${liveHostsData.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-gray-400">Live Hosts:</span>
              <span className="text-white font-medium">{liveHostsData.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${portScanData.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-gray-400">Port Scans:</span>
              <span className="text-white font-medium">{portScanData.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${contentDiscoveryData.length > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-gray-400">Endpoints:</span>
              <span className="text-white font-medium">{contentDiscoveryData.length}</span>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="text-sm text-emerald-400 hover:text-emerald-400/80 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Overview Mode */}
      {viewMode === 'overview' && (
        <>
          {/* Attack Surface Score */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
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
                      <Globe className="w-5 h-5 text-emerald-400" />
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
                    {stats.https_count > 0 && (
                      <div className="text-xs text-green-400 mt-1">
                        {stats.https_count} HTTPS
                      </div>
                    )}
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
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
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
                    <p>No high-value targets identified yet</p>
                    <p className="text-sm mt-2">Run Live Hosts scan to identify active targets</p>
                  </div>
                ) : (
                  highValueTargets.map((target, idx) => (
                    <div
                      key={target.subdomain}
                      className="bg-[#0a0a0a] rounded-lg p-4 border border-red-500/20 hover:border-red-500/40 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-mono text-gray-400">#{idx + 1}</span>
                            <a
                              href={target.final_url || `https://${target.subdomain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white hover:text-emerald-400 transition-colors font-medium"
                            >
                              {target.subdomain}
                            </a>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                            {target.is_active && (
                              <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded border border-green-500/30">
                                ACTIVE
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded border ${getTierColor(target.tier)}`}>
                              {target.tier.toUpperCase()}
                            </span>
                            <span className="text-sm font-bold text-red-500">
                              Risk: {target.risk_score}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-4 text-sm">
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
                            <div>
                              <div className="text-gray-400">Ports</div>
                              <div className="text-white font-medium">{target.ports.length}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Endpoints</div>
                              <div className="text-white font-medium">{target.endpoints.length}</div>
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
                            className="p-2 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
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
                    </div>
                  ))
                )}
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
              <Globe className="w-8 h-8 text-emerald-400 mb-3" />
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
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-emerald-400" />
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
                    className="w-full bg-[#0a0a0a] text-white pl-10 pr-4 py-2 rounded-lg border border-[#1f1f1f] focus:border-cyber-blue focus:outline-none"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => updateFilters({ status: e.target.value })}
                  className="w-full bg-[#0a0a0a] text-white px-4 py-2 rounded-lg border border-[#1f1f1f] focus:border-cyber-blue focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              {/* Tier Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Risk Tier</label>
                <select
                  value={filters.tier}
                  onChange={(e) => updateFilters({ tier: e.target.value })}
                  className="w-full bg-[#0a0a0a] text-white px-4 py-2 rounded-lg border border-[#1f1f1f] focus:border-cyber-blue focus:outline-none"
                >
                  <option value="all">All Tiers</option>
                  <option value="high">High Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="low">Low Risk</option>
                </select>
              </div>
            </div>

            {/* Checkbox Filters */}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasPorts}
                  onChange={(e) => updateFilters({ hasPorts: e.target.checked })}
                  className="form-checkbox bg-[#0a0a0a] border-[#1f1f1f] text-emerald-400 rounded focus:ring-cyber-blue"
                />
                Has Open Ports
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasEndpoints}
                  onChange={(e) => updateFilters({ hasEndpoints: e.target.checked })}
                  className="form-checkbox bg-[#0a0a0a] border-[#1f1f1f] text-emerald-400 rounded focus:ring-cyber-blue"
                />
                Has Endpoints
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.interesting}
                  onChange={(e) => updateFilters({ interesting: e.target.checked })}
                  className="form-checkbox bg-[#0a0a0a] border-[#1f1f1f] text-emerald-400 rounded focus:ring-cyber-blue"
                />
                Interesting Endpoints Only
              </label>
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
                className="px-4 py-2 bg-[#0a0a0a] text-gray-400 rounded-lg hover:text-white hover:bg-[#1a1a1a] transition-colors"
              >
                Reset Filters
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-400">
              Showing {filteredData.length} of {mergedData.length} targets
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0a0a0a] border-b border-[#1f1f1f]">
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">
                      Protocol
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
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No results match your filters</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((item) => (
                      <tr
                        key={item.subdomain}
                        className="border-b border-[#1f1f1f] hover:bg-[#0a0a0a] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <a
                              href={item.final_url || `https://${item.subdomain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white hover:text-emerald-400 transition-colors font-mono text-sm"
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
                            {item.protocol === 'https' || item.final_url?.startsWith('https://') ? (
                              <>
                                <Lock className="w-4 h-4 text-green-500" />
                                <span className="text-sm text-green-500">HTTPS</span>
                              </>
                            ) : item.protocol === 'http' || item.final_url?.startsWith('http://') ? (
                              <>
                                <Lock className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm text-yellow-500">HTTP</span>
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
                            <span className={`text-xs px-2 py-1 rounded border ${getTierColor(item.tier)}`}>
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
                              className="p-2 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                              title="Quick Validate"
                            >
                              {validatingTargets.has(item.subdomain) ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Zap className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 bg-[#0a0a0a] border-t border-[#1f1f1f]">
                <div className="text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-[#111111] text-white rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-[#111111] text-white rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Attack Surface Analysis</h2>
            
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Advanced Analysis View</h3>
              <p className="text-gray-400 mb-6">
                Visual attack surface mapping with relationship graphs and threat modeling
              </p>
              <button
                onClick={() => setViewMode('overview')}
                className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-500/80 transition-colors"
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
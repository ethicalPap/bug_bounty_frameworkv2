import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { 
  Globe, 
  Network, 
  Search, 
  Shield, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Lock,
  Zap,
  Code,
  Server,
  Database,
  ExternalLink
} from 'lucide-react'

const STORAGE_KEYS = {
  SUBDOMAIN_RESULTS: 'subdomain_scanner_last_domain',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
  PORT_SCAN_RESULTS: 'port_scan_results',
  CONTENT_DISCOVERY_RESULTS: 'content_discovery_results',
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#06b6d4',
}

const Visualization = () => {
  const queryClient = useQueryClient()
  const [selectedDomain, setSelectedDomain] = useState('')
  const [availableDomains, setAvailableDomains] = useState([])

  // Fetch available domains
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

  // Get all data
  const { subdomainsData, liveHostsData, portScanData, contentDiscoveryData } = useMemo(() => {
    // Subdomains
    const cachedData = queryClient.getQueryData(['subdomains', selectedDomain])
    const subdomains = cachedData?.data || []

    // Live Hosts
    let liveHosts = []
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
      liveHosts = saved ? JSON.parse(saved) : []
    } catch {
      liveHosts = []
    }

    // Port Scans
    let portScans = []
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PORT_SCAN_RESULTS)
      portScans = saved ? JSON.parse(saved) : []
    } catch {
      portScans = []
    }

    // Content Discovery
    let contentDiscovery = []
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONTENT_DISCOVERY_RESULTS)
      contentDiscovery = saved ? JSON.parse(saved) : []
    } catch {
      contentDiscovery = []
    }

    return {
      subdomainsData: subdomains,
      liveHostsData: liveHosts,
      portScanData: portScans,
      contentDiscoveryData: contentDiscovery
    }
  }, [selectedDomain, queryClient])

  // ========== PORT STATISTICS ==========
  const portStats = useMemo(() => {
    if (!portScanData || portScanData.length === 0) return null

    // Group by service
    const byService = portScanData.reduce((acc, port) => {
      const service = port.service || 'unknown'
      acc[service] = (acc[service] || 0) + 1
      return acc
    }, {})

    // Group by port number (top ports)
    const byPort = portScanData.reduce((acc, port) => {
      acc[port.port] = (acc[port.port] || 0) + 1
      return acc
    }, {})

    // Group by target
    const byTarget = portScanData.reduce((acc, port) => {
      acc[port.target] = (acc[port.target] || 0) + 1
      return acc
    }, {})

    return {
      totalOpenPorts: portScanData.length,
      uniqueTargets: Object.keys(byTarget).length,
      byService: Object.entries(byService)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      topPorts: Object.entries(byPort)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([port, count]) => ({ 
          port: parseInt(port), 
          count,
          service: portScanData.find(p => p.port === parseInt(port))?.service || 'unknown'
        })),
      byTarget: Object.entries(byTarget)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([target, count]) => ({ target, count })),
    }
  }, [portScanData])

  // ========== TECHNOLOGY STATISTICS ==========
  const techStats = useMemo(() => {
    if (!contentDiscoveryData || contentDiscoveryData.length === 0) return null

    const technologies = {}
    const statusCodes = {}
    const discoveryTypes = {}

    contentDiscoveryData.forEach(item => {
      // Technologies
      if (item.technologies) {
        try {
          const techs = typeof item.technologies === 'string' 
            ? JSON.parse(item.technologies) 
            : item.technologies
          
          if (Array.isArray(techs)) {
            techs.forEach(tech => {
              technologies[tech] = (technologies[tech] || 0) + 1
            })
          } else if (typeof techs === 'object') {
            Object.keys(techs).forEach(tech => {
              technologies[tech] = (technologies[tech] || 0) + 1
            })
          }
        } catch {}
      }

      // Status codes
      if (item.status_code) {
        const codeGroup = Math.floor(item.status_code / 100) * 100
        statusCodes[codeGroup] = (statusCodes[codeGroup] || 0) + 1
      }

      // Discovery types
      if (item.discovery_type) {
        discoveryTypes[item.discovery_type] = (discoveryTypes[item.discovery_type] || 0) + 1
      }
    })

    return {
      totalDiscoveries: contentDiscoveryData.length,
      technologies: Object.entries(technologies)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      statusCodes: Object.entries(statusCodes)
        .map(([code, count]) => ({ code: parseInt(code), count }))
        .sort((a, b) => a.code - b.code),
      discoveryTypes: Object.entries(discoveryTypes)
        .map(([type, count]) => ({ type, count }))
    }
  }, [contentDiscoveryData])

  // ========== LIVE HOSTS STATISTICS ==========
  const liveHostStats = useMemo(() => {
    if (!liveHostsData || liveHostsData.length === 0) return null

    const protocolBreakdown = liveHostsData.reduce((acc, host) => {
      const protocol = host.protocol || 'unknown'
      acc[protocol] = (acc[protocol] || 0) + 1
      return acc
    }, {})

    const statusCodeBreakdown = liveHostsData.reduce((acc, host) => {
      if (host.status_code) {
        const codeGroup = Math.floor(host.status_code / 100) * 100
        acc[codeGroup] = (acc[codeGroup] || 0) + 1
      }
      return acc
    }, {})

    return {
      total: liveHostsData.length,
      active: liveHostsData.filter(h => h.is_active).length,
      protocols: Object.entries(protocolBreakdown).map(([name, count]) => ({ name, count })),
      statusCodes: Object.entries(statusCodeBreakdown)
        .map(([code, count]) => ({ code: parseInt(code), count }))
        .sort((a, b) => a.code - b.code),
    }
  }, [liveHostsData])

  // ========== ATTACK SURFACE ANALYSIS ==========
  const attackSurfaceData = useMemo(() => {
    const data = []

    // Subdomain enumeration
    if (subdomainsData?.length > 0) {
      data.push({
        category: 'Subdomains',
        value: subdomainsData.length,
        fullMark: Math.max(100, subdomainsData.length)
      })
    }

    // Live hosts
    if (liveHostsData?.length > 0) {
      data.push({
        category: 'Live Hosts',
        value: liveHostsData.filter(h => h.is_active).length,
        fullMark: Math.max(50, liveHostsData.filter(h => h.is_active).length)
      })
    }

    // Open ports
    if (portScanData?.length > 0) {
      data.push({
        category: 'Open Ports',
        value: portScanData.length,
        fullMark: Math.max(50, portScanData.length)
      })
    }

    // Content discoveries
    if (contentDiscoveryData?.length > 0) {
      data.push({
        category: 'Endpoints',
        value: contentDiscoveryData.length,
        fullMark: Math.max(100, contentDiscoveryData.length)
      })
    }

    // Technologies
    if (techStats?.technologies?.length > 0) {
      data.push({
        category: 'Technologies',
        value: techStats.technologies.length,
        fullMark: 20
      })
    }

    return data
  }, [subdomainsData, liveHostsData, portScanData, contentDiscoveryData, techStats])

  if (availableDomains.length === 0) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="text-cyber-purple" />
            Visualization Dashboard
          </h2>
          <p className="text-gray-400 mt-2">Interactive charts and analysis of reconnaissance data</p>
        </div>
        
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-12 text-center">
          <Globe className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
          <p className="text-gray-400">Run reconnaissance scans to see visualizations</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="text-cyber-purple" />
            Visualization Dashboard
          </h2>
          <p className="text-gray-400 mt-2">Interactive analysis and visualization of all reconnaissance data</p>
        </div>
      </div>

      {/* Domain Selection */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select Domain
        </label>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="w-full px-4 py-3 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-purple transition-all"
        >
          {availableDomains.map((domain) => (
            <option key={domain} value={domain}>{domain}</option>
          ))}
        </select>
      </div>

      {/* Attack Surface Radar Chart */}
      {attackSurfaceData.length > 0 && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="text-cyber-purple" />
            Attack Surface Overview
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={attackSurfaceData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="category" stroke="#94a3b8" />
              <PolarRadiusAxis stroke="#64748b" />
              <Radar 
                name="Coverage" 
                dataKey="value" 
                stroke={COLORS.purple} 
                fill={COLORS.purple} 
                fillOpacity={0.3} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #334155',
                  borderRadius: '8px'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Port Scan Visualizations */}
      {portStats && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Services Distribution */}
            <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Server className="text-cyber-pink" />
                Services Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={portStats.byService}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill={COLORS.pink} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Ports */}
            <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Network className="text-cyber-blue" />
                Most Common Open Ports
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {portStats.topPorts.map((item, index) => (
                  <div 
                    key={item.port}
                    className="flex items-center justify-between p-3 bg-dark-200 border border-dark-50 rounded-lg hover:border-cyber-blue transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-cyber-blue w-8">
                        #{index + 1}
                      </span>
                      <div>
                        <span className="text-white font-mono font-semibold">
                          Port {item.port}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          ({item.service})
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-cyber-blue/20 text-cyber-blue rounded-full text-sm font-medium">
                      {item.count} hosts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Targets with Most Open Ports */}
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-yellow-400" />
              Targets with Most Open Ports
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={portStats.byTarget} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis 
                  dataKey="target" 
                  type="category" 
                  stroke="#94a3b8" 
                  width={200}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #334155',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill={COLORS.warning} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Technology Stack Visualization */}
      {techStats && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Technologies Detected */}
            <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Code className="text-cyber-purple" />
                Detected Technologies
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {techStats.technologies.map((tech, index) => (
                  <div 
                    key={tech.name}
                    className="flex items-center justify-between p-3 bg-dark-200 border border-dark-50 rounded-lg hover:border-cyber-purple transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-cyber-purple w-6">
                        {index + 1}
                      </span>
                      <span className="text-white font-medium">{tech.name}</span>
                    </div>
                    <span className="px-3 py-1 bg-cyber-purple/20 text-cyber-purple rounded-full text-sm font-medium">
                      {tech.count} instances
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* HTTP Status Codes Distribution */}
            <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="text-cyan-400" />
                HTTP Status Code Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={techStats.statusCodes}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ code, count }) => `${code}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {techStats.statusCodes.map((entry, index) => {
                      const color = entry.code >= 200 && entry.code < 300 ? COLORS.success :
                                    entry.code >= 300 && entry.code < 400 ? COLORS.warning :
                                    entry.code >= 400 && entry.code < 500 ? COLORS.danger :
                                    COLORS.purple
                      return <Cell key={`cell-${index}`} fill={color} />
                    })}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Discovery Types */}
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Search className="text-cyber-green" />
              Discovery Methods Used
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={techStats.discoveryTypes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="type" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #334155',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill={COLORS.success} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Live Hosts Analysis */}
      {liveHostStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Protocol Distribution */}
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="text-green-400" />
              Protocol Distribution
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={liveHostStats.protocols}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, count }) => `${name.toUpperCase()}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {liveHostStats.protocols.map((entry, index) => {
                    const color = entry.name === 'https' ? COLORS.success : COLORS.warning
                    return <Cell key={`cell-${index}`} fill={color} />
                  })}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #334155',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Active vs Inactive */}
          <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="text-green-400" />
              Host Activity Status
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active', value: liveHostStats.active },
                    { name: 'Inactive', value: liveHostStats.total - liveHostStats.active }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill={COLORS.success} />
                  <Cell fill="#64748b" />
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid #334155',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Overall Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-dark-200 border border-dark-50 rounded-lg p-4 text-center">
            <Globe className="mx-auto text-cyber-blue mb-2" size={32} />
            <div className="text-2xl font-bold text-white">{subdomainsData?.length || 0}</div>
            <div className="text-xs text-gray-400">Total Subdomains</div>
          </div>
          <div className="bg-dark-200 border border-green-500/20 rounded-lg p-4 text-center">
            <CheckCircle className="mx-auto text-green-400 mb-2" size={32} />
            <div className="text-2xl font-bold text-green-400">{liveHostStats?.active || 0}</div>
            <div className="text-xs text-gray-400">Active Hosts</div>
          </div>
          <div className="bg-dark-200 border border-cyber-pink/20 rounded-lg p-4 text-center">
            <Network className="mx-auto text-cyber-pink mb-2" size={32} />
            <div className="text-2xl font-bold text-cyber-pink">{portStats?.totalOpenPorts || 0}</div>
            <div className="text-xs text-gray-400">Open Ports</div>
          </div>
          <div className="bg-dark-200 border border-cyber-purple/20 rounded-lg p-4 text-center">
            <Code className="mx-auto text-cyber-purple mb-2" size={32} />
            <div className="text-2xl font-bold text-cyber-purple">{techStats?.totalDiscoveries || 0}</div>
            <div className="text-xs text-gray-400">Endpoints Found</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Visualization
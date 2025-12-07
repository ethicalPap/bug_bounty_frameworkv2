/**
 * Dashboard - Bug Bounty Metrics & Analytics
 * 
 * WORKSPACE ISOLATED - Only shows data for the current workspace
 * Fetches all data from API, NOT localStorage
 */

import { useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart3,
  Globe,
  Activity,
  Database,
  Link as LinkIcon,
  FolderOpen,
  Lock,
  Shield,
  Star,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  Target,
  Search,
  Eye,
  Layers,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { 
  getWorkspaceStats, 
  getSubdomainsByWorkspace,
  getContentByWorkspace,
  getPortsByWorkspace,
  getWorkspace
} from '../../api/client'

export default function Dashboard() {
  const { workspaceId } = useParams()
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Workspace info
  const [workspace, setWorkspace] = useState(null)
  
  // Stats from API
  const [stats, setStats] = useState({
    subdomains: 0,
    live_hosts: 0,
    open_ports: 0,
    content_discoveries: 0,
    vulnerabilities: 0
  })
  
  // Data from API
  const [subdomains, setSubdomains] = useState([])
  const [contentItems, setContentItems] = useState([])
  const [portScans, setPortScans] = useState([])
  
  // Filters
  const [selectedDomain, setSelectedDomain] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [showInterestingOnly, setShowInterestingOnly] = useState(false)

  // Get active workspace from localStorage
  const getActiveWorkspaceId = () => {
    if (workspaceId) return workspaceId
    try {
      const active = JSON.parse(localStorage.getItem('active_workspace') || '{}')
      return active.id || null
    } catch (e) {
      return null
    }
  }

  // Load workspace data
  useEffect(() => {
    const activeId = getActiveWorkspaceId()
    if (activeId) {
      loadWorkspaceData(activeId)
    } else {
      setIsLoading(false)
      setStats({ subdomains: 0, live_hosts: 0, open_ports: 0, content_discoveries: 0, vulnerabilities: 0 })
      setSubdomains([])
      setContentItems([])
      setPortScans([])
    }
  }, [workspaceId])

  const loadWorkspaceData = async (wsId) => {
    const targetWorkspaceId = wsId || getActiveWorkspaceId()
    if (!targetWorkspaceId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const workspaceData = await getWorkspace(targetWorkspaceId)
      setWorkspace(workspaceData)
      
      const statsData = await getWorkspaceStats(targetWorkspaceId)
      setStats(statsData || { subdomains: 0, live_hosts: 0, open_ports: 0, content_discoveries: 0, vulnerabilities: 0 })
      
      try {
        const subData = await getSubdomainsByWorkspace(targetWorkspaceId)
        setSubdomains(Array.isArray(subData) ? subData : subData?.subdomains || [])
      } catch (e) {
        setSubdomains([])
      }
      
      try {
        const contentData = await getContentByWorkspace(targetWorkspaceId)
        setContentItems(Array.isArray(contentData) ? contentData : contentData?.items || [])
      } catch (e) {
        setContentItems([])
      }
      
      try {
        const portData = await getPortsByWorkspace(targetWorkspaceId)
        setPortScans(Array.isArray(portData) ? portData : portData?.results || [])
      } catch (e) {
        setPortScans([])
      }
      
    } catch (err) {
      console.error('Failed to load workspace data:', err)
      setError('Failed to load workspace data')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate content type distribution
  const contentDistribution = useMemo(() => {
    const dist = { api: 0, endpoint: 0, directory: 0, javascript: 0 }
    
    contentItems.forEach(item => {
      const url = (item.discovered_url || item.url || '').toLowerCase()
      const type = item.content_type || item.discovery_type
      
      if (type === 'api' || url.includes('/api/') || url.includes('/v1/') || url.includes('/v2/')) {
        dist.api++
      } else if (type === 'javascript' || url.endsWith('.js')) {
        dist.javascript++
      } else if (type === 'directory' || url.endsWith('/')) {
        dist.directory++
      } else {
        dist.endpoint++
      }
    })
    
    return dist
  }, [contentItems])

  // Get interesting findings
  const interestingFindings = useMemo(() => {
    return contentItems.filter(item => item.is_interesting).slice(0, 10)
  }, [contentItems])

  // Get top subdomains by content count
  const topSubdomains = useMemo(() => {
    const counts = {}
    contentItems.forEach(item => {
      const url = item.discovered_url || item.url || ''
      try {
        const hostname = new URL(url).hostname
        counts[hostname] = (counts[hostname] || 0) + 1
      } catch (e) {}
    })
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([subdomain, count]) => ({ subdomain, count }))
  }, [contentItems])

  // Get unique domains for filter
  const availableDomains = useMemo(() => {
    const domains = new Set()
    subdomains.forEach(s => {
      const domain = (s.domain || s.subdomain || '').split('.').slice(-2).join('.')
      if (domain) domains.add(domain)
    })
    return Array.from(domains).sort()
  }, [subdomains])

  const openPortsCount = useMemo(() => {
    return portScans.filter(p => p.state === 'open' || p.is_open).length
  }, [portScans])

  const liveHostsCount = useMemo(() => {
    return subdomains.filter(s => s.is_live || s.is_active).length
  }, [subdomains])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-emerald-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading workspace data...</p>
        </div>
      </div>
    )
  }

  const total = contentDistribution.api + contentDistribution.endpoint + contentDistribution.directory + contentDistribution.javascript

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <BarChart3 size={24} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">{workspace?.name || 'Workspace'} Dashboard</h1>
          </div>
          <p className="text-gray-500">
            Analytics and metrics for this workspace
            {workspace?.target_scope && <span className="ml-2 text-gray-600">• {workspace.target_scope}</span>}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => loadWorkspaceData()} className="flex items-center gap-2 px-4 py-2 bg-[#111111] border border-[#1f1f1f] rounded-lg text-gray-400 hover:text-white hover:border-[#2a2a2a] transition-colors">
            <RefreshCw size={16} />
            Refresh
          </button>
          
          <div className="relative">
            <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)} className="appearance-none px-4 py-2 pr-10 bg-[#111111] border border-[#1f1f1f] rounded-lg text-gray-300 text-sm focus:outline-none focus:border-emerald-500/50 cursor-pointer">
              <option value="all">All Domains</option>
              {availableDomains.map(domain => <option key={domain} value={domain}>{domain}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          <button onClick={() => setShowInterestingOnly(!showInterestingOnly)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${showInterestingOnly ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-[#111111] border-[#1f1f1f] text-gray-400 hover:text-white'}`}>
            <Star size={16} />
            Interesting
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Globe size={20} className="text-blue-400" /></div>
            <ArrowUpRight size={16} className="text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.subdomains || 0}</div>
          <div className="text-xs text-gray-500">Subdomains</div>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-500/10 rounded-lg"><Activity size={20} className="text-green-400" /></div>
            <ArrowUpRight size={16} className="text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-green-400">{stats.live_hosts || liveHostsCount}</div>
          <div className="text-xs text-gray-500">Live Hosts</div>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg"><Lock size={20} className="text-yellow-400" /></div>
            <ArrowUpRight size={16} className="text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.open_ports || openPortsCount}</div>
          <div className="text-xs text-gray-500">Open Ports</div>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-500/10 rounded-lg"><Database size={20} className="text-orange-400" /></div>
            <ArrowUpRight size={16} className="text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-white">{contentDistribution.api}</div>
          <div className="text-xs text-gray-500">APIs Found</div>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-500/10 rounded-lg"><LinkIcon size={20} className="text-purple-400" /></div>
            <ArrowUpRight size={16} className="text-gray-600" />
          </div>
          <div className="text-2xl font-bold text-white">{contentDistribution.endpoint}</div>
          <div className="text-xs text-gray-500">Endpoints</div>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg"><Star size={20} className="text-yellow-400" /></div>
          </div>
          <div className="text-2xl font-bold text-yellow-400">{interestingFindings.length}</div>
          <div className="text-xs text-gray-500">Interesting</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Content Distribution */}
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} className="text-emerald-400" />
            <h3 className="font-semibold text-white">Content Distribution</h3>
          </div>
          
          <div className="space-y-3">
            {[
              { label: 'APIs', value: contentDistribution.api, color: 'bg-orange-500' },
              { label: 'Endpoints', value: contentDistribution.endpoint, color: 'bg-blue-500' },
              { label: 'Directories', value: contentDistribution.directory, color: 'bg-yellow-500' },
              { label: 'JS Files', value: contentDistribution.javascript, color: 'bg-purple-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{item.label}</span>
                  <span className="text-white">{item.value}</span>
                </div>
                <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${total > 0 ? (item.value / total * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Subdomains */}
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-green-400" />
              <h3 className="font-semibold text-white">Top Subdomains</h3>
            </div>
            <span className="text-xs text-gray-500">by content count</span>
          </div>
          
          {topSubdomains.length > 0 ? (
            <div className="space-y-2">
              {topSubdomains.map((item, idx) => (
                <div key={item.subdomain} className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-4">{idx + 1}</span>
                    <span className="text-sm text-gray-300 truncate max-w-[200px]">{item.subdomain}</span>
                  </div>
                  <span className="text-sm font-medium text-emerald-400">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Globe size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No content discovered yet</p>
            </div>
          )}
        </div>

        {/* Interesting Findings */}
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Star size={18} className="text-yellow-400" />
            <h3 className="font-semibold text-white">Interesting Findings</h3>
          </div>
          
          {interestingFindings.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {interestingFindings.map((item, idx) => {
                let path = item.path || ''
                let hostname = ''
                try {
                  const url = new URL(item.discovered_url || item.url || '')
                  path = path || url.pathname
                  hostname = url.hostname
                } catch (e) {}
                
                return (
                  <div key={idx} className="p-2 bg-[#0a0a0a] rounded-lg border-l-2 border-yellow-500/50">
                    <div className="flex items-start gap-2">
                      <Star size={12} className="text-yellow-400 mt-1 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{path}</p>
                        <p className="text-xs text-gray-500 truncate">{hostname}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Star size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No interesting findings yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/subdomain-scanner" className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-500/10 rounded-lg"><Globe size={24} className="text-blue-400" /></div>
            <ArrowRight size={20} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
          </div>
          <h3 className="font-medium text-white mt-3">Scan Subdomains</h3>
          <p className="text-sm text-gray-500">Discover subdomains</p>
        </Link>

        <Link to="/content-discovery" className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-orange-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-orange-500/10 rounded-lg"><Search size={24} className="text-orange-400" /></div>
            <ArrowRight size={20} className="text-gray-600 group-hover:text-orange-400 transition-colors" />
          </div>
          <h3 className="font-medium text-white mt-3">Content Discovery</h3>
          <p className="text-sm text-gray-500">Find APIs & endpoints</p>
        </Link>

        <Link to="/vuln-scanner" className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-red-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-red-500/10 rounded-lg"><Shield size={24} className="text-red-400" /></div>
            <ArrowRight size={20} className="text-gray-600 group-hover:text-red-400 transition-colors" />
          </div>
          <h3 className="font-medium text-white mt-3">Vulnerability Scan</h3>
          <p className="text-sm text-gray-500">Check for vulns</p>
        </Link>

        <Link to="/visualization" className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-emerald-500/10 rounded-lg"><Eye size={24} className="text-emerald-400" /></div>
            <ArrowRight size={20} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
          </div>
          <h3 className="font-medium text-white mt-3">View Attack Map</h3>
          <p className="text-sm text-gray-500">Visualize surface</p>
        </Link>
      </div>
    </div>
  )
}
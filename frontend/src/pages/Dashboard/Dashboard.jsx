/**
 * Dashboard - Bug Bounty Metrics & Analytics
 * 
 * Features:
 * - Findings overview with filters
 * - Content type breakdown charts
 * - Subdomain distribution
 * - Discovery timeline
 * - Quick stats cards
 * - Interesting findings highlight
 */

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Globe,
  Activity,
  Database,
  Link as LinkIcon,
  FolderOpen,
  FileCode,
  Lock,
  Shield,
  ShieldAlert,
  Star,
  Filter,
  ChevronDown,
  ArrowRight,
  ArrowUpRight,
  Target,
  Zap,
  Search,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers
} from 'lucide-react'
import { useContentDiscovery } from '../../stores/contentDiscoveryStore.jsx'
import { getDomains, getSubdomains } from '../../api/client'

export default function Dashboard() {
  const { items, stats } = useContentDiscovery()
  
  // Filters
  const [selectedDomain, setSelectedDomain] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [showInterestingOnly, setShowInterestingOnly] = useState(false)
  
  // Data from various sources
  const [liveHosts, setLiveHosts] = useState([])
  const [portScans, setPortScans] = useState([])
  const [vulnFindings, setVulnFindings] = useState([])
  const [subdomainData, setSubdomainData] = useState([])

  // Fetch domains
  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: getDomains,
    staleTime: 30000,
  })

  const availableDomains = useMemo(() => {
    if (!domainsData) return []
    if (Array.isArray(domainsData)) {
      return domainsData.map(d => typeof d === 'string' ? d : d.domain || d.name).filter(Boolean)
    }
    return []
  }, [domainsData])

  // Load data from localStorage
  useEffect(() => {
    try {
      const savedHosts = localStorage.getItem('live_hosts_results')
      if (savedHosts) {
        const parsed = JSON.parse(savedHosts)
        setLiveHosts(Array.isArray(parsed) ? parsed : (parsed.results || []))
      }
      
      const savedPorts = localStorage.getItem('port_scan_results')
      if (savedPorts) {
        const parsed = JSON.parse(savedPorts)
        setPortScans(Array.isArray(parsed) ? parsed : (parsed.results || []))
      }
      
      const savedVulns = localStorage.getItem('vuln_scan_results')
      if (savedVulns) {
        const parsed = JSON.parse(savedVulns)
        setVulnFindings(Array.isArray(parsed) ? parsed : (parsed.findings || []))
      }
      
      const savedSubs = localStorage.getItem('subdomain_scan_results')
      if (savedSubs) {
        const parsed = JSON.parse(savedSubs)
        setSubdomainData(Array.isArray(parsed) ? parsed : (parsed.results || []))
      }
    } catch (e) {
      console.error('Error loading data:', e)
    }
  }, [])

  // Filter items based on selections
  const filteredItems = useMemo(() => {
    let filtered = [...items]
    
    if (selectedDomain !== 'all') {
      filtered = filtered.filter(i => 
        i.subdomain?.endsWith(selectedDomain) || i.target_url?.includes(selectedDomain)
      )
    }
    
    if (selectedType !== 'all') {
      filtered = filtered.filter(i => i.content_type === selectedType)
    }
    
    if (showInterestingOnly) {
      filtered = filtered.filter(i => i.is_interesting)
    }
    
    return filtered
  }, [items, selectedDomain, selectedType, showInterestingOnly])

  // Calculate metrics
  const metrics = useMemo(() => {
    const activeLiveHosts = liveHosts.filter(h => h.is_active).length
    const openPorts = portScans.filter(p => p.state === 'open').length
    const criticalVulns = vulnFindings.filter(v => v.severity === 'critical').length
    const highVulns = vulnFindings.filter(v => v.severity === 'high').length
    
    return {
      totalDomains: availableDomains.length,
      totalSubdomains: subdomainData.length,
      liveHosts: activeLiveHosts,
      openPorts,
      totalContent: filteredItems.length,
      apis: filteredItems.filter(i => i.content_type === 'api').length,
      endpoints: filteredItems.filter(i => i.content_type === 'endpoint').length,
      directories: filteredItems.filter(i => i.content_type === 'directory').length,
      javascript: filteredItems.filter(i => i.content_type === 'javascript').length,
      interesting: filteredItems.filter(i => i.is_interesting).length,
      criticalVulns,
      highVulns,
      totalVulns: vulnFindings.length
    }
  }, [availableDomains, subdomainData, liveHosts, portScans, vulnFindings, filteredItems])

  // Content type distribution for chart
  const contentDistribution = useMemo(() => {
    const total = metrics.apis + metrics.endpoints + metrics.directories + metrics.javascript
    if (total === 0) return []
    
    return [
      { type: 'APIs', count: metrics.apis, percentage: Math.round((metrics.apis / total) * 100), color: '#f97316' },
      { type: 'Endpoints', count: metrics.endpoints, percentage: Math.round((metrics.endpoints / total) * 100), color: '#6366f1' },
      { type: 'Directories', count: metrics.directories, percentage: Math.round((metrics.directories / total) * 100), color: '#eab308' },
      { type: 'JS Files', count: metrics.javascript, percentage: Math.round((metrics.javascript / total) * 100), color: '#a855f7' }
    ].filter(d => d.count > 0)
  }, [metrics])

  // Top subdomains by content count
  const topSubdomains = useMemo(() => {
    const subdomainCounts = {}
    filteredItems.forEach(item => {
      const sub = item.subdomain || 'unknown'
      subdomainCounts[sub] = (subdomainCounts[sub] || 0) + 1
    })
    
    return Object.entries(subdomainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([subdomain, count]) => ({ subdomain, count }))
  }, [filteredItems])

  // Interesting findings
  const interestingFindings = useMemo(() => {
    return filteredItems
      .filter(i => i.is_interesting)
      .slice(0, 10)
  }, [filteredItems])

  // Quick action cards
  const quickStats = [
    { label: 'Subdomains', value: metrics.totalSubdomains, icon: Globe, color: 'blue', href: '/subdomain-scanner' },
    { label: 'Live Hosts', value: metrics.liveHosts, icon: Activity, color: 'green', href: '/live-hosts' },
    { label: 'Open Ports', value: metrics.openPorts, icon: Lock, color: 'pink', href: '/port-scanner' },
    { label: 'APIs Found', value: metrics.apis, icon: Database, color: 'orange', href: '/content-discovery/apis' },
    { label: 'Endpoints', value: metrics.endpoints, icon: LinkIcon, color: 'indigo', href: '/content-discovery/endpoints' },
    { label: 'Interesting', value: metrics.interesting, icon: Star, color: 'yellow', href: '/content-discovery' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <BarChart3 size={24} className="text-emerald-400" />
            </div>
            Bug Bounty Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Analytics and metrics from your reconnaissance
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="all">All Domains</option>
            {availableDomains.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="api">APIs</option>
            <option value="endpoint">Endpoints</option>
            <option value="directory">Directories</option>
            <option value="javascript">JS Files</option>
          </select>
          
          <button
            onClick={() => setShowInterestingOnly(!showInterestingOnly)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              showInterestingOnly 
                ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' 
                : 'bg-[#111111] border-[#1f1f1f] text-gray-400 hover:text-white'
            }`}
          >
            <Star size={14} />
            Interesting
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {quickStats.map(stat => (
          <Link
            key={stat.label}
            to={stat.href}
            className={`bg-[#111111] rounded-xl p-4 border border-[#1f1f1f] hover:border-${stat.color}-500/30 transition-all group`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg bg-${stat.color}-500/10`}>
                <stat.icon size={18} className={`text-${stat.color}-400`} />
              </div>
              <ArrowUpRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
            </div>
            <div className={`text-2xl font-bold text-white group-hover:text-${stat.color}-400 transition-colors`}>
              {stat.value}
            </div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </Link>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Content Distribution Chart */}
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
          <div className="p-4 border-b border-[#1f1f1f]">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <PieChart size={16} className="text-emerald-400" />
              Content Distribution
            </h3>
          </div>
          <div className="p-4">
            {contentDistribution.length > 0 ? (
              <div className="space-y-4">
                {/* Visual bar chart */}
                <div className="space-y-3">
                  {contentDistribution.map(item => (
                    <div key={item.type}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-400">{item.type}</span>
                        <span className="text-white font-medium">{item.count}</span>
                      </div>
                      <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Legend dots */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {contentDistribution.map(item => (
                    <div key={item.type} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-500">{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Layers className="mx-auto text-gray-600 mb-2" size={32} />
                <p className="text-sm text-gray-500">No content discovered yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Subdomains */}
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
          <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              Top Subdomains
            </h3>
            <span className="text-xs text-gray-500">by content count</span>
          </div>
          <div className="p-2">
            {topSubdomains.length > 0 ? (
              <div className="space-y-1">
                {topSubdomains.map((item, i) => {
                  const maxCount = topSubdomains[0]?.count || 1
                  const percentage = (item.count / maxCount) * 100
                  return (
                    <div key={item.subdomain} className="relative">
                      <div 
                        className="absolute inset-0 bg-emerald-500/10 rounded-lg"
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="relative flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-4">{i + 1}</span>
                          <span className="text-sm text-white font-mono truncate max-w-[180px]">
                            {item.subdomain}
                          </span>
                        </div>
                        <span className="text-sm text-emerald-400 font-medium">{item.count}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Globe className="mx-auto text-gray-600 mb-2" size={32} />
                <p className="text-sm text-gray-500">No subdomain data</p>
              </div>
            )}
          </div>
        </div>

        {/* Interesting Findings */}
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
          <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Star size={16} className="text-yellow-400" />
              Interesting Findings
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
              {metrics.interesting}
            </span>
          </div>
          <div className="p-2 max-h-[300px] overflow-y-auto">
            {interestingFindings.length > 0 ? (
              <div className="space-y-1">
                {interestingFindings.map((item, i) => {
                  const typeColors = {
                    api: 'text-orange-400',
                    endpoint: 'text-indigo-400',
                    directory: 'text-yellow-400',
                    javascript: 'text-purple-400'
                  }
                  return (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors">
                      <Star size={12} className="text-yellow-400 mt-1 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate font-mono">
                          {item.path || new URL(item.discovered_url || item.url || 'http://x').pathname}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{item.subdomain}</p>
                      </div>
                      <span className={`text-xs ${typeColors[item.content_type] || 'text-gray-400'}`}>
                        {item.content_type}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Star className="mx-auto text-gray-600 mb-2" size={32} />
                <p className="text-sm text-gray-500">No interesting findings yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vulnerability Summary (if any) */}
      {metrics.totalVulns > 0 && (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
          <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-400" />
              Vulnerability Summary
            </h3>
            <Link to="/vuln-scanner" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-xs text-red-400">Critical</span>
                </div>
                <div className="text-3xl font-bold text-red-400">{metrics.criticalVulns}</div>
              </div>
              <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-orange-400" />
                  <span className="text-xs text-orange-400">High</span>
                </div>
                <div className="text-3xl font-bold text-orange-400">{metrics.highVulns}</div>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-yellow-400" />
                  <span className="text-xs text-yellow-400">Medium</span>
                </div>
                <div className="text-3xl font-bold text-yellow-400">
                  {metrics.totalVulns - metrics.criticalVulns - metrics.highVulns}
                </div>
              </div>
              <div className="bg-gray-500/10 rounded-xl p-4 border border-gray-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-gray-400" />
                  <span className="text-xs text-gray-400">Total</span>
                </div>
                <div className="text-3xl font-bold text-white">{metrics.totalVulns}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Scan Subdomains', href: '/subdomain-scanner', icon: Globe, desc: 'Discover subdomains' },
          { label: 'Content Discovery', href: '/content-discovery', icon: Search, desc: 'Find APIs & endpoints' },
          { label: 'Vulnerability Scan', href: '/vuln-scanner', icon: Shield, desc: 'Check for vulns' },
          { label: 'View Attack Map', href: '/visualization', icon: Target, desc: 'Visualize surface' },
        ].map(action => (
          <Link
            key={action.href}
            to={action.href}
            className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f] hover:border-emerald-500/30 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                <action.icon size={18} className="text-emerald-400" />
              </div>
              <ArrowRight size={14} className="ml-auto text-gray-600 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="text-sm font-medium text-white">{action.label}</div>
            <div className="text-xs text-gray-500">{action.desc}</div>
          </Link>
        ))}
      </div>

      {/* Recent Scanned Domains */}
      {availableDomains.length > 0 && (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
          <div className="p-4 border-b border-[#1f1f1f]">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe size={16} className="text-blue-400" />
              Scanned Domains ({availableDomains.length})
            </h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {availableDomains.slice(0, 15).map(domain => (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain === selectedDomain ? 'all' : domain)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-mono transition-colors ${
                    selectedDomain === domain
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-[#0a0a0a] text-gray-400 border border-[#1f1f1f] hover:border-[#252525]'
                  }`}
                >
                  {domain}
                </button>
              ))}
              {availableDomains.length > 15 && (
                <span className="px-3 py-1.5 text-sm text-gray-500">
                  +{availableDomains.length - 15} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
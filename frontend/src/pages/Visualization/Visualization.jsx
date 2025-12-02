/**
 * Visualization Page
 * Visualizes all reconnaissance data including content discovery
 * Shows relationships between subdomains and discovered content
 */

import { useState, useMemo, useEffect } from 'react'
import {
  BarChart3,
  PieChart,
  Network,
  Database,
  Link as LinkIcon,
  FolderOpen,
  FileCode,
  Globe,
  Activity,
  Shield,
  Star,
  ChevronDown,
  Filter
} from 'lucide-react'
import { useContentDiscovery, CONTENT_TYPES } from '../../stores/ContentDiscoveryStore'

export default function Visualization() {
  const { items, stats, uniqueSubdomains, getItemsByType, getItemsBySubdomain } = useContentDiscovery()
  
  const [selectedView, setSelectedView] = useState('overview')
  const [selectedSubdomain, setSelectedSubdomain] = useState('all')
  const [subdomainData, setSubdomainData] = useState([])
  const [liveHosts, setLiveHosts] = useState([])
  
  // Load live hosts data
  useEffect(() => {
    try {
      const saved = localStorage.getItem('live_hosts_results')
      if (saved) {
        const parsed = JSON.parse(saved)
        const hosts = Array.isArray(parsed) ? parsed : (parsed.results || [])
        setLiveHosts(hosts)
      }
    } catch (e) {
      console.error('Error loading live hosts:', e)
    }
  }, [])
  
  // Load subdomain data
  useEffect(() => {
    try {
      const saved = localStorage.getItem('subdomain_scan_results')
      if (saved) {
        const parsed = JSON.parse(saved)
        setSubdomainData(Array.isArray(parsed) ? parsed : (parsed.results || []))
      }
    } catch (e) {
      console.error('Error loading subdomains:', e)
    }
  }, [])
  
  // Calculate content discovery stats per subdomain
  const subdomainStats = useMemo(() => {
    const statsMap = {}
    
    uniqueSubdomains.forEach(sub => {
      const subItems = items.filter(i => i.subdomain === sub)
      statsMap[sub] = {
        subdomain: sub,
        total: subItems.length,
        apis: subItems.filter(i => i.content_type === 'api').length,
        endpoints: subItems.filter(i => i.content_type === 'endpoint').length,
        directories: subItems.filter(i => i.content_type === 'directory').length,
        javascript: subItems.filter(i => i.content_type === 'javascript').length,
        interesting: subItems.filter(i => i.is_interesting).length
      }
    })
    
    return Object.values(statsMap).sort((a, b) => b.total - a.total)
  }, [items, uniqueSubdomains])
  
  // Calculate max values for bar chart scaling
  const maxTotal = useMemo(() => {
    return Math.max(...subdomainStats.map(s => s.total), 1)
  }, [subdomainStats])
  
  // Overview metrics
  const overviewMetrics = useMemo(() => ({
    totalContent: stats.total,
    totalSubdomains: uniqueSubdomains.length,
    totalLiveHosts: liveHosts.filter(h => h.is_active).length,
    interestingFindings: stats.interesting,
    contentTypes: {
      apis: stats.apis || 0,
      endpoints: stats.endpoints || 0,
      directories: stats.directories || 0,
      javascript: stats.javascript || 0
    }
  }), [stats, uniqueSubdomains, liveHosts])
  
  // Content type distribution data
  const contentDistribution = useMemo(() => {
    const total = overviewMetrics.contentTypes.apis + 
                  overviewMetrics.contentTypes.endpoints + 
                  overviewMetrics.contentTypes.directories + 
                  overviewMetrics.contentTypes.javascript
    
    if (total === 0) return []
    
    return [
      { 
        type: 'APIs', 
        count: overviewMetrics.contentTypes.apis,
        percentage: Math.round((overviewMetrics.contentTypes.apis / total) * 100),
        color: 'bg-orange-500',
        textColor: 'text-orange-400'
      },
      { 
        type: 'Endpoints', 
        count: overviewMetrics.contentTypes.endpoints,
        percentage: Math.round((overviewMetrics.contentTypes.endpoints / total) * 100),
        color: 'bg-blue-500',
        textColor: 'text-blue-400'
      },
      { 
        type: 'Directories', 
        count: overviewMetrics.contentTypes.directories,
        percentage: Math.round((overviewMetrics.contentTypes.directories / total) * 100),
        color: 'bg-yellow-500',
        textColor: 'text-yellow-400'
      },
      { 
        type: 'JS Files', 
        count: overviewMetrics.contentTypes.javascript,
        percentage: Math.round((overviewMetrics.contentTypes.javascript / total) * 100),
        color: 'bg-purple-500',
        textColor: 'text-purple-400'
      }
    ]
  }, [overviewMetrics])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <BarChart3 size={24} className="text-emerald-400" />
            </div>
            Visualization
          </h1>
          <p className="text-gray-500 mt-1">
            Visual overview of all reconnaissance data
          </p>
        </div>
        
        {/* View Selector */}
        <div className="flex items-center gap-2 bg-[#111111] rounded-xl p-1 border border-[#1f1f1f]">
          {['overview', 'subdomains', 'content'].map(view => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedView === view
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Metrics */}
      {selectedView === 'overview' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#111111] rounded-xl p-5 border border-[#1f1f1f]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Network size={20} className="text-emerald-400" />
                </div>
                <span className="text-sm text-gray-400">Total Content</span>
              </div>
              <div className="text-3xl font-bold text-white">{overviewMetrics.totalContent}</div>
            </div>
            
            <div className="bg-[#111111] rounded-xl p-5 border border-[#1f1f1f]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Globe size={20} className="text-blue-400" />
                </div>
                <span className="text-sm text-gray-400">Subdomains</span>
              </div>
              <div className="text-3xl font-bold text-white">{overviewMetrics.totalSubdomains}</div>
            </div>
            
            <div className="bg-[#111111] rounded-xl p-5 border border-[#1f1f1f]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Activity size={20} className="text-green-400" />
                </div>
                <span className="text-sm text-gray-400">Live Hosts</span>
              </div>
              <div className="text-3xl font-bold text-white">{overviewMetrics.totalLiveHosts}</div>
            </div>
            
            <div className="bg-[#111111] rounded-xl p-5 border border-yellow-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Star size={20} className="text-yellow-400" />
                </div>
                <span className="text-sm text-gray-400">Interesting</span>
              </div>
              <div className="text-3xl font-bold text-yellow-400">{overviewMetrics.interestingFindings}</div>
            </div>
          </div>

          {/* Content Type Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#111111] rounded-xl p-6 border border-[#1f1f1f]">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <PieChart size={20} className="text-emerald-400" />
                Content Type Distribution
              </h3>
              
              {contentDistribution.length > 0 ? (
                <div className="space-y-4">
                  {contentDistribution.map(item => (
                    <div key={item.type}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${item.textColor}`}>{item.type}</span>
                        <span className="text-sm text-gray-400">{item.count} ({item.percentage}%)</span>
                      </div>
                      <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${item.color} rounded-full transition-all duration-500`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No content discovered yet. Run scans to see data.
                </div>
              )}
            </div>

            {/* Category Cards */}
            <div className="bg-[#111111] rounded-xl p-6 border border-[#1f1f1f]">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield size={20} className="text-emerald-400" />
                Discovery Categories
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-500/10 rounded-xl p-4 border border-orange-500/30">
                  <Database size={24} className="text-orange-400 mb-2" />
                  <div className="text-2xl font-bold text-orange-400">{overviewMetrics.contentTypes.apis}</div>
                  <div className="text-sm text-gray-400">APIs</div>
                </div>
                
                <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/30">
                  <LinkIcon size={24} className="text-blue-400 mb-2" />
                  <div className="text-2xl font-bold text-blue-400">{overviewMetrics.contentTypes.endpoints}</div>
                  <div className="text-sm text-gray-400">Endpoints</div>
                </div>
                
                <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/30">
                  <FolderOpen size={24} className="text-yellow-400 mb-2" />
                  <div className="text-2xl font-bold text-yellow-400">{overviewMetrics.contentTypes.directories}</div>
                  <div className="text-sm text-gray-400">Directories</div>
                </div>
                
                <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/30">
                  <FileCode size={24} className="text-purple-400 mb-2" />
                  <div className="text-2xl font-bold text-purple-400">{overviewMetrics.contentTypes.javascript}</div>
                  <div className="text-sm text-gray-400">JS Files</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Subdomains View */}
      {selectedView === 'subdomains' && (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
          <div className="p-5 border-b border-[#1f1f1f]">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Globe size={20} className="text-emerald-400" />
              Content per Subdomain
            </h3>
          </div>
          
          {subdomainStats.length > 0 ? (
            <div className="divide-y divide-[#1f1f1f]">
              {subdomainStats.map(sub => (
                <div key={sub.subdomain} className="p-4 hover:bg-[#1a1a1a] transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Globe size={16} className="text-gray-500" />
                      <span className="text-white font-medium">{sub.subdomain}</span>
                      {sub.interesting > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                          ★ {sub.interesting}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-400 text-sm">{sub.total} items</span>
                  </div>
                  
                  {/* Stacked Bar */}
                  <div className="h-4 bg-[#0a0a0a] rounded-full overflow-hidden flex">
                    {sub.apis > 0 && (
                      <div 
                        className="h-full bg-orange-500" 
                        style={{ width: `${(sub.apis / sub.total) * 100}%` }}
                        title={`APIs: ${sub.apis}`}
                      />
                    )}
                    {sub.endpoints > 0 && (
                      <div 
                        className="h-full bg-blue-500" 
                        style={{ width: `${(sub.endpoints / sub.total) * 100}%` }}
                        title={`Endpoints: ${sub.endpoints}`}
                      />
                    )}
                    {sub.directories > 0 && (
                      <div 
                        className="h-full bg-yellow-500" 
                        style={{ width: `${(sub.directories / sub.total) * 100}%` }}
                        title={`Directories: ${sub.directories}`}
                      />
                    )}
                    {sub.javascript > 0 && (
                      <div 
                        className="h-full bg-purple-500" 
                        style={{ width: `${(sub.javascript / sub.total) * 100}%` }}
                        title={`JS Files: ${sub.javascript}`}
                      />
                    )}
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    {sub.apis > 0 && (
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-gray-500">APIs: {sub.apis}</span>
                      </span>
                    )}
                    {sub.endpoints > 0 && (
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-gray-500">Endpoints: {sub.endpoints}</span>
                      </span>
                    )}
                    {sub.directories > 0 && (
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-gray-500">Directories: {sub.directories}</span>
                      </span>
                    )}
                    {sub.javascript > 0 && (
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-gray-500">JS: {sub.javascript}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              No subdomain data available. Run content discovery scans first.
            </div>
          )}
        </div>
      )}

      {/* Content View */}
      {selectedView === 'content' && (
        <div className="space-y-6">
          {/* Subdomain Filter */}
          <div className="flex items-center gap-4">
            <Filter size={18} className="text-gray-500" />
            <select
              value={selectedSubdomain}
              onChange={(e) => setSelectedSubdomain(e.target.value)}
              className="bg-[#111111] text-white px-4 py-2.5 rounded-xl border border-[#1f1f1f] outline-none"
            >
              <option value="all">All Subdomains</option>
              {uniqueSubdomains.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Content breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(CONTENT_TYPES).map(([key, config]) => {
              const typeItems = selectedSubdomain === 'all' 
                ? items.filter(i => i.content_type === key)
                : items.filter(i => i.content_type === key && i.subdomain === selectedSubdomain)
              
              const IconMap = {
                api: Database,
                endpoint: LinkIcon,
                directory: FolderOpen,
                javascript: FileCode
              }
              const Icon = IconMap[key]
              
              return (
                <div key={key} className={`bg-[#111111] rounded-xl p-5 border ${config.border}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <Icon size={20} className={config.color} />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{config.label}</h4>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${config.color}`}>{typeItems.length}</div>
                  </div>
                  
                  {/* Sample URLs */}
                  {typeItems.length > 0 && (
                    <div className="space-y-1 mt-3 pt-3 border-t border-[#1f1f1f]">
                      {typeItems.slice(0, 3).map(item => (
                        <div key={item.id} className="text-xs text-gray-500 truncate font-mono">
                          {item.discovered_url}
                        </div>
                      ))}
                      {typeItems.length > 3 && (
                        <div className="text-xs text-gray-600">
                          +{typeItems.length - 3} more...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
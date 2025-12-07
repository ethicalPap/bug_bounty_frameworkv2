/**
 * APIs Page - API endpoint discovery
 * Features:
 * - Target selection: Manual, Subdomain, Live Host
 * - Passive tools: waymore, gau
 * - Crawling: katana, gospider, ZAP Spider
 * - JS analysis: xnLinkFinder, linkfinder
 * - Parameter discovery: paramspider
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  Database, 
  ChevronLeft, 
  Star, 
  AlertTriangle,
  Search,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  Filter,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { useContentDiscovery, CONTENT_TYPES } from '../../stores/ContentDiscoveryStore'
import ContentScanPanel from './ContentScanPanel'

export default function APIs() {
  const { 
    items: allItems,
    addItems,
    clearItems
  } = useContentDiscovery()
  
  const [selectedSubdomain, setSelectedSubdomain] = useState('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [filterInteresting, setFilterInteresting] = useState(false)
  
  // Get API items only
  const apiItems = useMemo(() => {
    return allItems.filter(i => i.content_type === 'api')
  }, [allItems])

  // Get unique subdomains
  const uniqueSubdomains = useMemo(() => {
    const subs = new Set(apiItems.map(i => i.subdomain).filter(Boolean))
    return Array.from(subs).sort()
  }, [apiItems])
  
  // Apply filters
  const filteredItems = useMemo(() => {
    let filtered = apiItems
    
    if (selectedSubdomain !== 'all') {
      filtered = filtered.filter(i => i.subdomain === selectedSubdomain)
    }
    
    if (searchFilter) {
      const search = searchFilter.toLowerCase()
      filtered = filtered.filter(i => 
        i.discovered_url?.toLowerCase().includes(search) ||
        i.subdomain?.toLowerCase().includes(search)
      )
    }

    if (filterInteresting) {
      filtered = filtered.filter(i => i.is_interesting)
    }
    
    return filtered
  }, [apiItems, selectedSubdomain, searchFilter, filterInteresting])
  
  // Group by subdomain
  const groupedBySubdomain = useMemo(() => {
    const groups = {}
    filteredItems.forEach(item => {
      const sub = item.subdomain || 'unknown'
      if (!groups[sub]) {
        groups[sub] = {
          subdomain: sub,
          items: [],
          stats: { v1: 0, v2: 0, v3: 0, graphql: 0, rest: 0, interesting: 0 }
        }
      }
      groups[sub].items.push(item)
      
      // Categorize API versions
      const url = item.discovered_url?.toLowerCase() || ''
      if (url.includes('/v1/') || url.includes('/v1.')) groups[sub].stats.v1++
      if (url.includes('/v2/') || url.includes('/v2.')) groups[sub].stats.v2++
      if (url.includes('/v3/') || url.includes('/v3.')) groups[sub].stats.v3++
      if (url.includes('graphql')) groups[sub].stats.graphql++
      if (url.includes('/rest/') || url.includes('/api/')) groups[sub].stats.rest++
      if (item.is_interesting) groups[sub].stats.interesting++
    })
    return Object.values(groups).sort((a, b) => b.items.length - a.items.length)
  }, [filteredItems])

  // Handle scan complete
  const handleScanComplete = (results, target) => {
    // Filter for API-related results
    const apiResults = results.filter(item => {
      const url = item.url || item.discovered_url || ''
      return url.includes('/api/') || 
             url.includes('/v1/') || 
             url.includes('/v2/') ||
             url.includes('/v3/') ||
             url.includes('/rest/') ||
             url.includes('/graphql') ||
             url.includes('.json') ||
             url.includes('/swagger') ||
             url.includes('/openapi')
    }).map(item => ({
      ...item,
      content_type: 'api',
      discovered_url: item.url || item.discovered_url,
      subdomain: new URL(item.url || item.discovered_url || target).hostname,
      discovered_at: new Date().toISOString(),
      is_interesting: isInterestingApi(item.url || item.discovered_url)
    }))

    if (apiResults.length > 0) {
      addItems(apiResults)
    }
  }

  // Check if API endpoint is interesting
  const isInterestingApi = (url) => {
    if (!url) return false
    const interesting = [
      '/admin', '/auth', '/login', '/token', '/oauth',
      '/user', '/account', '/password', '/secret', '/key',
      '/internal', '/private', '/debug', '/test', '/dev',
      '/graphql', '/swagger', '/openapi', '/docs'
    ]
    return interesting.some(p => url.toLowerCase().includes(p))
  }

  // Copy URL
  const copyUrl = (url) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  // Export results
  const exportResults = () => {
    const data = filteredItems.map(item => item.discovered_url).join('\n')
    const blob = new Blob([data], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-endpoints-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Toggle group expansion
  const toggleGroup = (subdomain) => {
    setExpandedGroups(prev => ({
      ...prev,
      [subdomain]: !prev[subdomain]
    }))
  }

  const config = CONTENT_TYPES.api

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/content-discovery"
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className={`p-2 rounded-xl ${config.bg}`}>
                <Database size={24} className={config.color} />
              </div>
              API Discovery
            </h1>
            <p className="text-gray-500 mt-1">Discover API endpoints, REST routes, and GraphQL schemas</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {filteredItems.length > 0 && (
            <>
              <button
                onClick={exportResults}
                className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] text-gray-300 rounded-lg border border-[#252525] hover:bg-[#252525] transition-colors text-sm"
              >
                <Download size={14} />
                Export
              </button>
              <button
                onClick={() => clearItems('api')}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-colors text-sm"
              >
                <Trash2 size={14} />
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scan Panel */}
      <ContentScanPanel 
        scanType="api"
        onScanComplete={handleScanComplete}
      />

      {/* Stats Bar */}
      {apiItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-white">{apiItems.length}</div>
            <div className="text-xs text-gray-500">Total APIs</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-blue-400">{uniqueSubdomains.length}</div>
            <div className="text-xs text-gray-500">Subdomains</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-emerald-400">
              {apiItems.filter(i => i.discovered_url?.includes('/v1/')).length}
            </div>
            <div className="text-xs text-gray-500">v1 APIs</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-cyan-400">
              {apiItems.filter(i => i.discovered_url?.includes('/v2/')).length}
            </div>
            <div className="text-xs text-gray-500">v2 APIs</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-purple-400">
              {apiItems.filter(i => i.discovered_url?.toLowerCase().includes('graphql')).length}
            </div>
            <div className="text-xs text-gray-500">GraphQL</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-yellow-500/20">
            <div className="text-2xl font-bold text-yellow-400">
              {apiItems.filter(i => i.is_interesting).length}
            </div>
            <div className="text-xs text-gray-500">Interesting</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {apiItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search APIs..."
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-lg pl-9 pr-4 py-2 text-white text-sm placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          
          <select
            value={selectedSubdomain}
            onChange={(e) => setSelectedSubdomain(e.target.value)}
            className="bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="all">All Subdomains ({uniqueSubdomains.length})</option>
            {uniqueSubdomains.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>

          <button
            onClick={() => setFilterInteresting(!filterInteresting)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              filterInteresting 
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                : 'bg-[#111111] border-[#1f1f1f] text-gray-400 hover:border-[#252525]'
            }`}
          >
            <Star size={14} />
            Interesting Only
          </button>
        </div>
      )}

      {/* Results */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-[#111111] rounded-xl border border-[#1f1f1f]">
          <Database className="mx-auto text-gray-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-white mb-2">No API Endpoints Found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Run a scan above to discover API endpoints. Use passive tools like Waymore and GAU 
            for archive-based discovery, or Katana for active crawling.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBySubdomain.map(group => (
            <div key={group.subdomain} className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.subdomain)}
                className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedGroups[group.subdomain] ? (
                    <ChevronDown size={16} className="text-gray-500" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-500" />
                  )}
                  <span className="font-mono text-white">{group.subdomain}</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs">
                    {group.items.length} endpoints
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {group.stats.v1 > 0 && (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">v1: {group.stats.v1}</span>
                  )}
                  {group.stats.v2 > 0 && (
                    <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-xs">v2: {group.stats.v2}</span>
                  )}
                  {group.stats.graphql > 0 && (
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">GraphQL: {group.stats.graphql}</span>
                  )}
                  {group.stats.interesting > 0 && (
                    <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">
                      <Star size={10} className="inline mr-1" />
                      {group.stats.interesting}
                    </span>
                  )}
                </div>
              </button>

              {/* Group Items */}
              {expandedGroups[group.subdomain] && (
                <div className="border-t border-[#1f1f1f] divide-y divide-[#1f1f1f]">
                  {group.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#0a0a0a] transition-colors">
                      {item.is_interesting && (
                        <Star size={12} className="text-yellow-400 flex-shrink-0" />
                      )}
                      <span className="flex-1 font-mono text-sm text-gray-300 truncate">
                        {item.discovered_url}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => copyUrl(item.discovered_url)}
                          className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
                          title="Copy URL"
                        >
                          {copiedUrl === item.discovered_url ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} className="text-gray-500" />
                          )}
                        </button>
                        <a
                          href={item.discovered_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
                          title="Open in new tab"
                        >
                          <ExternalLink size={12} className="text-gray-500" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
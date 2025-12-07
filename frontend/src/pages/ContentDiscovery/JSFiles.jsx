/**
 * JS Files Page - JavaScript file discovery
 * Discovers .js files and extracts secrets/endpoints
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  FileCode, 
  ChevronLeft, 
  Star, 
  Search,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
  Key,
  AlertTriangle
} from 'lucide-react'
import { useContentDiscovery, CONTENT_TYPES } from '../../stores/ContentDiscoveryStore'
import ContentScanPanel from './ContentScanPanel'

export default function JSFiles() {
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
  const [filterByType, setFilterByType] = useState('all')
  
  // Get JS items only
  const jsItems = useMemo(() => {
    return allItems.filter(i => i.content_type === 'javascript')
  }, [allItems])

  // Get unique subdomains
  const uniqueSubdomains = useMemo(() => {
    const subs = new Set(jsItems.map(i => i.subdomain).filter(Boolean))
    return Array.from(subs).sort()
  }, [jsItems])
  
  // Apply filters
  const filteredItems = useMemo(() => {
    let filtered = jsItems
    
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

    if (filterByType !== 'all') {
      filtered = filtered.filter(i => {
        const url = i.discovered_url?.toLowerCase() || ''
        switch (filterByType) {
          case 'bundle': return url.includes('bundle') || url.includes('chunk') || url.includes('vendor')
          case 'main': return url.includes('main') || url.includes('app') || url.includes('index')
          case 'api': return url.includes('api') || url.includes('client') || url.includes('service')
          case 'minified': return url.includes('.min.js')
          default: return true
        }
      })
    }
    
    return filtered
  }, [jsItems, selectedSubdomain, searchFilter, filterInteresting, filterByType])
  
  // Group by subdomain
  const groupedBySubdomain = useMemo(() => {
    const groups = {}
    filteredItems.forEach(item => {
      const sub = item.subdomain || 'unknown'
      if (!groups[sub]) {
        groups[sub] = {
          subdomain: sub,
          items: [],
          stats: { bundle: 0, main: 0, api: 0, secrets: 0, interesting: 0 }
        }
      }
      groups[sub].items.push(item)
      
      const url = item.discovered_url?.toLowerCase() || ''
      if (url.includes('bundle') || url.includes('chunk') || url.includes('vendor')) groups[sub].stats.bundle++
      if (url.includes('main') || url.includes('app') || url.includes('index')) groups[sub].stats.main++
      if (url.includes('api') || url.includes('client') || url.includes('service')) groups[sub].stats.api++
      if (item.has_secrets) groups[sub].stats.secrets++
      if (item.is_interesting) groups[sub].stats.interesting++
    })
    return Object.values(groups).sort((a, b) => b.items.length - a.items.length)
  }, [filteredItems])

  // Handle scan complete
  const handleScanComplete = (results, target) => {
    const jsResults = results.filter(item => {
      const url = item.url || item.discovered_url || ''
      return /\.(js|mjs|jsx|ts|tsx)(\?|$)/i.test(url) ||
             url.includes('/static/js/') ||
             url.includes('/assets/js/') ||
             url.includes('webpack') ||
             url.includes('bundle')
    }).map(item => ({
      ...item,
      content_type: 'javascript',
      discovered_url: item.url || item.discovered_url,
      subdomain: new URL(item.url || item.discovered_url || target).hostname,
      discovered_at: new Date().toISOString(),
      is_interesting: isInterestingJS(item.url || item.discovered_url),
      has_secrets: checkForSecrets(item)
    }))

    if (jsResults.length > 0) {
      addItems(jsResults)
    }
  }

  const isInterestingJS = (url) => {
    if (!url) return false
    const interesting = [
      'main', 'app', 'index', 'bundle', 'vendor', 'runtime',
      'api', 'client', 'service', 'config', 'env', 'settings',
      'auth', 'login', 'admin', 'dashboard', 'user'
    ]
    const lower = url.toLowerCase()
    // Exclude common libraries
    if (/jquery|react|angular|vue|lodash|moment|bootstrap/i.test(lower)) return false
    return interesting.some(p => lower.includes(p))
  }

  const checkForSecrets = (item) => {
    // This would need actual content analysis
    // For now, flag potentially interesting files
    const url = item.url || item.discovered_url || ''
    return /config|env|secret|key|token|auth/i.test(url)
  }

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const exportResults = () => {
    const data = filteredItems.map(item => item.discovered_url).join('\n')
    const blob = new Blob([data], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `js-files-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleGroup = (subdomain) => {
    setExpandedGroups(prev => ({ ...prev, [subdomain]: !prev[subdomain] }))
  }

  const config = CONTENT_TYPES.javascript

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/content-discovery" className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors">
            <ChevronLeft size={20} className="text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className={`p-2 rounded-xl ${config.bg}`}>
                <FileCode size={24} className={config.color} />
              </div>
              JavaScript Discovery
            </h1>
            <p className="text-gray-500 mt-1">Discover JavaScript files for endpoint extraction and secret scanning</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {filteredItems.length > 0 && (
            <>
              <button onClick={exportResults} className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] text-gray-300 rounded-lg border border-[#252525] hover:bg-[#252525] transition-colors text-sm">
                <Download size={14} /> Export
              </button>
              <button onClick={() => clearItems('javascript')} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-colors text-sm">
                <Trash2 size={14} /> Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scan Panel */}
      <ContentScanPanel scanType="javascript" onScanComplete={handleScanComplete} />

      {/* Stats */}
      {jsItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-white">{jsItems.length}</div>
            <div className="text-xs text-gray-500">Total JS Files</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-blue-400">{uniqueSubdomains.length}</div>
            <div className="text-xs text-gray-500">Subdomains</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-purple-400">
              {jsItems.filter(i => /bundle|chunk|vendor/i.test(i.discovered_url || '')).length}
            </div>
            <div className="text-xs text-gray-500">Bundles</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-[#1f1f1f]">
            <div className="text-2xl font-bold text-cyan-400">
              {jsItems.filter(i => /main|app|index/i.test(i.discovered_url || '')).length}
            </div>
            <div className="text-xs text-gray-500">Main Files</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-red-500/20">
            <div className="text-2xl font-bold text-red-400">
              {jsItems.filter(i => i.has_secrets).length}
            </div>
            <div className="text-xs text-gray-500">Potential Secrets</div>
          </div>
          <div className="bg-[#111111] rounded-lg p-3 border border-yellow-500/20">
            <div className="text-2xl font-bold text-yellow-400">
              {jsItems.filter(i => i.is_interesting).length}
            </div>
            <div className="text-xs text-gray-500">Interesting</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {jsItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search JS files..."
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-lg pl-9 pr-4 py-2 text-white text-sm placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none"
            />
          </div>
          
          <select value={selectedSubdomain} onChange={(e) => setSelectedSubdomain(e.target.value)} className="bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
            <option value="all">All Subdomains</option>
            {uniqueSubdomains.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>

          <select value={filterByType} onChange={(e) => setFilterByType(e.target.value)} className="bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
            <option value="all">All Types</option>
            <option value="bundle">Bundles</option>
            <option value="main">Main/App</option>
            <option value="api">API/Service</option>
            <option value="minified">Minified</option>
          </select>

          <button
            onClick={() => setFilterInteresting(!filterInteresting)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${filterInteresting ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-[#111111] border-[#1f1f1f] text-gray-400'}`}
          >
            <Star size={14} /> Interesting
          </button>
        </div>
      )}

      {/* Results */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-[#111111] rounded-xl border border-[#1f1f1f]">
          <FileCode className="mx-auto text-gray-600 mb-4" size={48} />
          <h3 className="text-lg font-medium text-white mb-2">No JavaScript Files Found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Run a scan to discover JavaScript files. Use xnLinkFinder or LinkFinder to extract 
            endpoints and secrets from discovered files.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedBySubdomain.map(group => (
            <div key={group.subdomain} className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
              <button onClick={() => toggleGroup(group.subdomain)} className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition-colors">
                <div className="flex items-center gap-3">
                  {expandedGroups[group.subdomain] ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                  <span className="font-mono text-white">{group.subdomain}</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-xs">{group.items.length} files</span>
                </div>
                <div className="flex items-center gap-2">
                  {group.stats.bundle > 0 && <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">Bundles: {group.stats.bundle}</span>}
                  {group.stats.api > 0 && <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-xs">API: {group.stats.api}</span>}
                  {group.stats.secrets > 0 && <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs"><Key size={10} className="inline mr-1" />{group.stats.secrets}</span>}
                  {group.stats.interesting > 0 && <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs"><Star size={10} className="inline mr-1" />{group.stats.interesting}</span>}
                </div>
              </button>
              {expandedGroups[group.subdomain] && (
                <div className="border-t border-[#1f1f1f] divide-y divide-[#1f1f1f]">
                  {group.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#0a0a0a]">
                      {item.has_secrets && <Key size={12} className="text-red-400" />}
                      {item.is_interesting && !item.has_secrets && <Star size={12} className="text-yellow-400" />}
                      <span className="flex-1 font-mono text-sm text-gray-300 truncate">{item.discovered_url}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => copyUrl(item.discovered_url)} className="p-1.5 hover:bg-[#1a1a1a] rounded">
                          {copiedUrl === item.discovered_url ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-gray-500" />}
                        </button>
                        <a href={item.discovered_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-[#1a1a1a] rounded">
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
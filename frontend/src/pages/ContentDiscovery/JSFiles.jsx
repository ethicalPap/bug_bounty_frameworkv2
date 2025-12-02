/**
 * JS Files Page - Standalone page for JavaScript file discovery
 * Features:
 * - JS-specific scanning with LinkFinder, Katana
 * - Subdomain grouping
 * - Secret/API key detection
 * - Security checklist
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  FileCode, 
  ChevronLeft, 
  Star, 
  AlertTriangle,
  Play,
  Loader,
  Search,
  Globe,
  Settings,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  Shield,
  Key,
  Lock,
  Eye
} from 'lucide-react'
import { useContentDiscovery, CONTENT_TYPES } from '../../stores/contentDiscoveryStore.jsx'
import { startContentDiscovery } from '../../api/client'

const JS_TOOLS = {
  linkfinder: { name: 'LinkFinder', description: 'JS endpoint extraction', active: true },
  katana: { name: 'Katana', description: 'JS crawling', active: true },
  gau: { name: 'GAU', description: 'Archive JS files', active: true },
  waymore: { name: 'Waymore', description: 'Wayback JS', active: true }
}

export default function JSFiles() {
  const { 
    items: allItems,
    liveHosts,
    addItems,
    startScan,
    endScan,
    uniqueSubdomains
  } = useContentDiscovery()
  
  const [selectedSubdomain, setSelectedSubdomain] = useState('all')
  const [isScanning, setIsScanning] = useState(false)
  const [scanTarget, setScanTarget] = useState('')
  const [expandedSubdomains, setExpandedSubdomains] = useState({})
  const [searchFilter, setSearchFilter] = useState('')
  const [copiedUrl, setCopiedUrl] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [enabledTools, setEnabledTools] = useState(['linkfinder', 'katana', 'gau', 'waymore'])
  const [extractEndpoints, setExtractEndpoints] = useState(true)
  const [scanSecrets, setScanSecrets] = useState(true)
  
  // Get JS items only
  const jsItems = useMemo(() => {
    return allItems.filter(i => i.content_type === 'javascript')
  }, [allItems])
  
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
    
    return filtered
  }, [jsItems, selectedSubdomain, searchFilter])
  
  // Group by subdomain
  const groupedBySubdomain = useMemo(() => {
    const groups = {}
    filteredItems.forEach(item => {
      const sub = item.subdomain || 'unknown'
      if (!groups[sub]) {
        groups[sub] = {
          subdomain: sub,
          items: [],
          stats: { 
            bundle: 0, 
            chunk: 0, 
            map: 0, 
            minified: 0,
            interesting: 0 
          }
        }
      }
      groups[sub].items.push(item)
      
      // Update stats
      const url = item.discovered_url || ''
      if (url.match(/bundle|vendor|main/i)) groups[sub].stats.bundle++
      if (url.match(/chunk|split/i)) groups[sub].stats.chunk++
      if (url.match(/\.map$/i)) groups[sub].stats.map++
      if (url.match(/\.min\.js$/i)) groups[sub].stats.minified++
      if (item.is_interesting) groups[sub].stats.interesting++
    })
    
    return Object.values(groups).sort((a, b) => b.items.length - a.items.length)
  }, [filteredItems])
  
  // Overall stats
  const stats = useMemo(() => {
    return {
      total: jsItems.length,
      filtered: filteredItems.length,
      bundle: jsItems.filter(i => i.discovered_url?.match(/bundle|vendor|main/i)).length,
      chunk: jsItems.filter(i => i.discovered_url?.match(/chunk|split/i)).length,
      map: jsItems.filter(i => i.discovered_url?.match(/\.map$/i)).length,
      minified: jsItems.filter(i => i.discovered_url?.match(/\.min\.js$/i)).length,
      interesting: jsItems.filter(i => i.is_interesting).length,
      subdomains: new Set(jsItems.map(i => i.subdomain)).size
    }
  }, [jsItems, filteredItems])
  
  // Available targets from live hosts
  const availableTargets = useMemo(() => {
    return (liveHosts || []).map(h => ({
      url: h.url,
      subdomain: h.subdomain,
      status: h.status_code
    }))
  }, [liveHosts])
  
  // Handle JS scan
  const handleScan = async () => {
    if (!scanTarget || isScanning) return
    
    setIsScanning(true)
    startScan(scanTarget)
    
    try {
      const response = await startContentDiscovery({
        target_url: scanTarget,
        scan_type: 'js',
        use_linkfinder: enabledTools.includes('linkfinder'),
        use_katana: enabledTools.includes('katana'),
        use_gau: enabledTools.includes('gau'),
        use_waymore: enabledTools.includes('waymore'),
        use_ffuf: false,
        use_feroxbuster: false,
        use_gospider: false,
        use_arjun: false,
        threads: 10,
        timeout: 300,
        rate_limit: 100,
        extract_endpoints: extractEndpoints,
        scan_secrets: scanSecrets
      })
      
      // Process results - force type to javascript
      const newItems = (response.discovered_urls || []).map(item => ({
        ...item,
        content_type: 'javascript',
        target_url: scanTarget,
        subdomain: new URL(scanTarget).hostname,
        scan_id: response.scan_id
      }))
      
      addItems(newItems)
      endScan(true, newItems.length)
    } catch (error) {
      console.error('JS scan failed:', error)
      endScan(false, 0)
    } finally {
      setIsScanning(false)
    }
  }
  
  const toggleSubdomain = (subdomain) => {
    setExpandedSubdomains(prev => ({
      ...prev,
      [subdomain]: !prev[subdomain]
    }))
  }
  
  const copyUrl = (url) => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }
  
  const toggleTool = (toolId) => {
    setEnabledTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(t => t !== toolId)
        : [...prev, toolId]
    )
  }

  const config = CONTENT_TYPES.javascript

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/content-discovery"
            className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className={`p-2 rounded-xl ${config.bg}`}>
                <FileCode size={24} className={config.color} />
              </div>
              JavaScript Discovery
            </h1>
            <p className="text-gray-500 mt-1">
              Find and analyze JS files across {stats.subdomains} subdomains
            </p>
          </div>
        </div>

        {stats.interesting > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
            <Star size={16} className="text-yellow-400" />
            <span className="text-yellow-400 font-medium">{stats.interesting} interesting</span>
          </div>
        )}
      </div>

      {/* Scan Controls */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileCode size={20} className={config.color} />
            JS Scanner
          </h3>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-[#1a1a1a] rounded-lg border border-[#252525] transition-colors"
          >
            <Settings size={14} />
            Configure
          </button>
        </div>
        
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={scanTarget}
              onChange={(e) => setScanTarget(e.target.value)}
              placeholder="https://example.com or select from live hosts..."
              className="w-full bg-[#0a0a0a] text-white px-4 py-3 rounded-xl border border-[#1f1f1f] focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>
          
          {availableTargets.length > 0 && (
            <select
              value=""
              onChange={(e) => setScanTarget(e.target.value)}
              className="bg-[#0a0a0a] text-gray-400 px-4 py-3 rounded-xl border border-[#1f1f1f] outline-none"
            >
              <option value="">Select live host...</option>
              {availableTargets.map((target, idx) => (
                <option key={idx} value={target.url}>
                  {target.subdomain} ({target.status})
                </option>
              ))}
            </select>
          )}
          
          <button
            onClick={handleScan}
            disabled={!scanTarget || isScanning}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium shadow-lg transition-all ${
              isScanning 
                ? 'bg-purple-500/50 text-white cursor-wait'
                : 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isScanning ? (
              <>
                <Loader size={18} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play size={18} />
                Find JS Files
              </>
            )}
          </button>
        </div>
        
        {/* Tool Configuration */}
        {showConfig && (
          <div className="mt-4 pt-4 border-t border-[#1f1f1f] space-y-4">
            <div>
              <div className="text-sm text-gray-400 mb-3">Enabled Tools</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(JS_TOOLS).map(([id, tool]) => (
                  <button
                    key={id}
                    onClick={() => toggleTool(id)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      enabledTools.includes(id)
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-[#0a0a0a] text-gray-500 border border-[#1f1f1f]'
                    }`}
                  >
                    {tool.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractEndpoints}
                  onChange={(e) => setExtractEndpoints(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${extractEndpoints ? 'bg-purple-500' : 'bg-[#252525]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${extractEndpoints ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-400">Extract endpoints from JS</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scanSecrets}
                  onChange={(e) => setScanSecrets(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${scanSecrets ? 'bg-purple-500' : 'bg-[#252525]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${scanSecrets ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-400">Scan for secrets/API keys</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className={`bg-[#111111] rounded-xl p-4 border ${config.border}`}>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total</div>
          <div className={`text-2xl font-bold ${config.color} mt-1`}>{stats.total}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f]">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Bundles</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.bundle}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f]">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Chunks</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.chunk}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-cyan-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Source Maps</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{stats.map}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f]">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Minified</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.minified}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f]">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Subdomains</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.subdomains}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-yellow-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Interesting</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.interesting}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter JS files..."
            className="w-full bg-[#111111] text-white pl-10 pr-4 py-2.5 rounded-xl border border-[#1f1f1f] focus:border-purple-500/50 outline-none transition-all"
          />
        </div>
        
        <select
          value={selectedSubdomain}
          onChange={(e) => setSelectedSubdomain(e.target.value)}
          className="bg-[#111111] text-white px-4 py-2.5 rounded-xl border border-[#1f1f1f] outline-none"
        >
          <option value="all">All Subdomains ({stats.subdomains})</option>
          {uniqueSubdomains.filter(s => jsItems.some(i => i.subdomain === s)).map(sub => (
            <option key={sub} value={sub}>
              {sub} ({jsItems.filter(i => i.subdomain === sub).length})
            </option>
          ))}
        </select>
      </div>

      {/* Security Tips */}
      {stats.total > 0 && (
        <div className="bg-purple-500/5 rounded-xl p-4 border border-purple-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-purple-400 mb-2">JavaScript Security Checklist</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Key size={12} className="text-purple-400" />
                  Search for hardcoded API keys
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Eye size={12} className="text-purple-400" />
                  Look for hidden endpoints in code
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Lock size={12} className="text-purple-400" />
                  Check for exposed secrets
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <FileCode size={12} className="text-purple-400" />
                  Analyze source maps for original code
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Source Maps Alert */}
      {stats.map > 0 && (
        <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/30">
          <div className="flex items-start gap-3">
            <Eye size={20} className="text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-cyan-400">Source Maps Detected!</h4>
              <p className="text-sm text-gray-400 mt-1">
                Found {stats.map} source map files. These can expose original source code and should be analyzed for sensitive information.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grouped Results */}
      {groupedBySubdomain.length > 0 ? (
        <div className="space-y-4">
          {groupedBySubdomain.map(group => (
            <div 
              key={group.subdomain}
              className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden"
            >
              {/* Subdomain Header */}
              <button
                onClick={() => toggleSubdomain(group.subdomain)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe size={18} className={config.color} />
                  <span className="text-white font-medium">{group.subdomain}</span>
                  <span className="text-gray-500 text-sm">({group.items.length} files)</span>
                </div>
                <div className="flex items-center gap-4">
                  {group.stats.bundle > 0 && (
                    <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded">Bundles: {group.stats.bundle}</span>
                  )}
                  {group.stats.map > 0 && (
                    <span className="text-xs px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded">Maps: {group.stats.map}</span>
                  )}
                  {group.stats.interesting > 0 && (
                    <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded">★ {group.stats.interesting}</span>
                  )}
                  <ChevronDown 
                    size={18} 
                    className={`text-gray-500 transition-transform ${expandedSubdomains[group.subdomain] ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>
              
              {/* Expanded Content */}
              {expandedSubdomains[group.subdomain] && (
                <div className="border-t border-[#1f1f1f]">
                  <div className="max-h-96 overflow-y-auto">
                    {group.items.map(item => (
                      <div 
                        key={item.id}
                        className="px-5 py-3 border-b border-[#1f1f1f] last:border-0 hover:bg-[#0a0a0a] flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {item.is_interesting && (
                            <Star size={14} className="text-yellow-400 flex-shrink-0" />
                          )}
                          {item.discovered_url?.match(/\.map$/i) && (
                            <Eye size={14} className="text-cyan-400 flex-shrink-0" />
                          )}
                          <span className="text-gray-300 truncate font-mono text-sm">
                            {item.discovered_url}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => copyUrl(item.discovered_url)}
                            className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
                            title="Copy URL"
                          >
                            {copiedUrl === item.discovered_url ? (
                              <Check size={14} className="text-green-400" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <a
                            href={item.discovered_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-12 text-center">
          <FileCode size={48} className="mx-auto text-gray-700 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No JavaScript files discovered yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter a target URL above and click "Find JS Files" to discover JavaScript files.
            You can also select from your live hosts.
          </p>
        </div>
      )}
    </div>
  )
}
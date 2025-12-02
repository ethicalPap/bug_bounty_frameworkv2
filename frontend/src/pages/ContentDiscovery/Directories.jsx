/**
 * Directories Page - Standalone page for directory discovery
 * Features:
 * - Directory-specific scanning with ffuf, Feroxbuster
 * - Subdomain grouping
 * - Sensitive directory detection
 * - Security checklist
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  FolderOpen, 
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
  FileText,
  Archive,
  Database
} from 'lucide-react'
import { useContentDiscovery, CONTENT_TYPES } from '../../stores/contentDiscoveryStore.jsx'
import { startContentDiscovery } from '../../api/client'

const DIRECTORY_TOOLS = {
  ffuf: { name: 'ffuf', description: 'Fast web fuzzer', active: true },
  feroxbuster: { name: 'Feroxbuster', description: 'Recursive discovery', active: true },
  dirsearch: { name: 'Dirsearch', description: 'Directory brute force', active: false }
}

const WORDLISTS = {
  common: { name: 'Common', path: '/opt/wordlists/common.txt', size: '4,652' },
  medium: { name: 'Medium', path: '/opt/wordlists/directory-list-2.3-medium.txt', size: '220K' },
  large: { name: 'Large', path: '/opt/wordlists/directory-list-2.3-big.txt', size: '1.3M' },
  raft: { name: 'Raft', path: '/opt/wordlists/raft-large-directories.txt', size: '62K' }
}

export default function Directories() {
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
  const [enabledTools, setEnabledTools] = useState(['ffuf', 'feroxbuster'])
  const [selectedWordlist, setSelectedWordlist] = useState('common')
  const [threads, setThreads] = useState(20)
  
  // Get directory items only
  const directoryItems = useMemo(() => {
    return allItems.filter(i => i.content_type === 'directory')
  }, [allItems])
  
  // Apply filters
  const filteredItems = useMemo(() => {
    let filtered = directoryItems
    
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
  }, [directoryItems, selectedSubdomain, searchFilter])
  
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
            admin: 0, 
            backup: 0, 
            config: 0, 
            uploads: 0,
            interesting: 0 
          }
        }
      }
      groups[sub].items.push(item)
      
      // Update stats
      const url = item.discovered_url || ''
      if (url.match(/admin|administrator|manage/i)) groups[sub].stats.admin++
      if (url.match(/backup|bak|old|copy/i)) groups[sub].stats.backup++
      if (url.match(/config|conf|settings/i)) groups[sub].stats.config++
      if (url.match(/upload|uploads|files|media/i)) groups[sub].stats.uploads++
      if (item.is_interesting) groups[sub].stats.interesting++
    })
    
    return Object.values(groups).sort((a, b) => b.items.length - a.items.length)
  }, [filteredItems])
  
  // Overall stats
  const stats = useMemo(() => {
    return {
      total: directoryItems.length,
      filtered: filteredItems.length,
      admin: directoryItems.filter(i => i.discovered_url?.match(/admin|administrator|manage/i)).length,
      backup: directoryItems.filter(i => i.discovered_url?.match(/backup|bak|old|copy/i)).length,
      config: directoryItems.filter(i => i.discovered_url?.match(/config|conf|settings/i)).length,
      uploads: directoryItems.filter(i => i.discovered_url?.match(/upload|uploads|files|media/i)).length,
      interesting: directoryItems.filter(i => i.is_interesting).length,
      subdomains: new Set(directoryItems.map(i => i.subdomain)).size
    }
  }, [directoryItems, filteredItems])
  
  // Available targets from live hosts
  const availableTargets = useMemo(() => {
    return (liveHosts || []).map(h => ({
      url: h.url,
      subdomain: h.subdomain,
      status: h.status_code
    }))
  }, [liveHosts])
  
  // Handle directory scan
  const handleScan = async () => {
    if (!scanTarget || isScanning) return
    
    setIsScanning(true)
    startScan(scanTarget)
    
    try {
      const response = await startContentDiscovery({
        target_url: scanTarget,
        scan_type: 'fuzzing',
        use_ffuf: enabledTools.includes('ffuf'),
        use_feroxbuster: enabledTools.includes('feroxbuster'),
        use_katana: false,
        use_gospider: false,
        use_arjun: false,
        use_gau: false,
        use_waymore: false,
        use_linkfinder: false,
        threads: threads,
        timeout: 600,
        rate_limit: 100,
        wordlist: WORDLISTS[selectedWordlist].path
      })
      
      // Process results - force type to directory
      const newItems = (response.discovered_urls || []).map(item => ({
        ...item,
        content_type: 'directory',
        target_url: scanTarget,
        subdomain: new URL(scanTarget).hostname,
        scan_id: response.scan_id
      }))
      
      addItems(newItems)
      endScan(true, newItems.length)
    } catch (error) {
      console.error('Directory scan failed:', error)
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

  const config = CONTENT_TYPES.directory

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
                <FolderOpen size={24} className={config.color} />
              </div>
              Directory Discovery
            </h1>
            <p className="text-gray-500 mt-1">
              Brute-force directories across {stats.subdomains} subdomains
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
            <FolderOpen size={20} className={config.color} />
            Directory Fuzzer
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
              className="w-full bg-[#0a0a0a] text-white px-4 py-3 rounded-xl border border-[#1f1f1f] focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 outline-none transition-all"
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
                ? 'bg-yellow-500/50 text-white cursor-wait'
                : 'bg-yellow-500 hover:bg-yellow-600 text-black shadow-yellow-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isScanning ? (
              <>
                <Loader size={18} className="animate-spin" />
                Fuzzing...
              </>
            ) : (
              <>
                <Play size={18} />
                Start Fuzzing
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
                {Object.entries(DIRECTORY_TOOLS).map(([id, tool]) => (
                  <button
                    key={id}
                    onClick={() => toggleTool(id)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      enabledTools.includes(id)
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-[#0a0a0a] text-gray-500 border border-[#1f1f1f]'
                    }`}
                  >
                    {tool.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-400 mb-3">Wordlist</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(WORDLISTS).map(([id, wl]) => (
                  <button
                    key={id}
                    onClick={() => setSelectedWordlist(id)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedWordlist === id
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                        : 'bg-[#0a0a0a] text-gray-500 border border-[#1f1f1f]'
                    }`}
                  >
                    {wl.name} ({wl.size})
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-400">Threads:</div>
              <input
                type="number"
                value={threads}
                onChange={(e) => setThreads(parseInt(e.target.value) || 20)}
                min={1}
                max={100}
                className="w-20 bg-[#0a0a0a] text-white px-3 py-2 rounded-lg border border-[#1f1f1f] outline-none text-center"
              />
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
        <div className="bg-[#111111] rounded-xl p-4 border border-red-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Admin</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{stats.admin}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-orange-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Backup</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{stats.backup}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-purple-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Config</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{stats.config}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-cyan-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Uploads</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{stats.uploads}</div>
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
            placeholder="Filter directories..."
            className="w-full bg-[#111111] text-white pl-10 pr-4 py-2.5 rounded-xl border border-[#1f1f1f] focus:border-yellow-500/50 outline-none transition-all"
          />
        </div>
        
        <select
          value={selectedSubdomain}
          onChange={(e) => setSelectedSubdomain(e.target.value)}
          className="bg-[#111111] text-white px-4 py-2.5 rounded-xl border border-[#1f1f1f] outline-none"
        >
          <option value="all">All Subdomains ({stats.subdomains})</option>
          {uniqueSubdomains.filter(s => directoryItems.some(i => i.subdomain === s)).map(sub => (
            <option key={sub} value={sub}>
              {sub} ({directoryItems.filter(i => i.subdomain === sub).length})
            </option>
          ))}
        </select>
      </div>

      {/* Security Tips */}
      {stats.total > 0 && (
        <div className="bg-yellow-500/5 rounded-xl p-4 border border-yellow-500/20">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-400 mb-2">Directory Security Checklist</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Archive size={12} className="text-yellow-400" />
                  Look for backup files (.bak, .old, ~)
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <FileText size={12} className="text-yellow-400" />
                  Check for exposed config files
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Database size={12} className="text-yellow-400" />
                  Look for database dumps
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Shield size={12} className="text-yellow-400" />
                  Test admin panel access controls
                </div>
              </div>
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
                  <span className="text-gray-500 text-sm">({group.items.length} directories)</span>
                </div>
                <div className="flex items-center gap-4">
                  {group.stats.admin > 0 && (
                    <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded">Admin: {group.stats.admin}</span>
                  )}
                  {group.stats.backup > 0 && (
                    <span className="text-xs px-2 py-1 bg-orange-500/10 text-orange-400 rounded">Backup: {group.stats.backup}</span>
                  )}
                  {group.stats.config > 0 && (
                    <span className="text-xs px-2 py-1 bg-purple-500/10 text-purple-400 rounded">Config: {group.stats.config}</span>
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
          <FolderOpen size={48} className="mx-auto text-gray-700 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No directories discovered yet</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Enter a target URL above and click "Start Fuzzing" to discover directories.
            You can also select from your live hosts.
          </p>
        </div>
      )}
    </div>
  )
}
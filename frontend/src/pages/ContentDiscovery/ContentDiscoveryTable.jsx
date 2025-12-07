/**
 * Shared Content Discovery Table Component
 * Used across all content discovery pages
 */

import { useState, useMemo } from 'react'
import { 
  ExternalLink, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  ChevronRight,
  Star,
  Globe,
  Link,
  FolderOpen,
  FileCode,
  Database,
  Filter,
  Search,
  Download,
  Trash2,
  Eye
} from 'lucide-react'
import { useContentDiscovery, CONTENT_TYPES, extractSubdomain } from '../../stores/ContentDiscoveryStore'

// Icon mapping
const iconMap = {
  Database,
  Link,
  FolderOpen,
  FileCode
}

const ContentDiscoveryTable = ({ 
  items = [], 
  showTypeColumn = true,
  showSubdomainColumn = true,
  title = 'Discovered Content',
  emptyMessage = 'No content discovered yet',
  emptyIcon: EmptyIcon = Search
}) => {
  const { globalFilters, updateFilters, uniqueSubdomains, uniqueTools } = useContentDiscovery()
  
  const [sortConfig, setSortConfig] = useState({ field: 'discovered_url', direction: 'asc' })
  const [expandedItems, setExpandedItems] = useState(new Set())
  const [selectedItems, setSelectedItems] = useState(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  // Apply local sort
  const sortedItems = useMemo(() => {
    const sorted = [...items]
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.field] || ''
      let bVal = b[sortConfig.field] || ''
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [items, sortConfig])

  // Pagination
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return sortedItems.slice(start, start + itemsPerPage)
  }, [sortedItems, currentPage])

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage)

  // Group by subdomain
  const groupedItems = useMemo(() => {
    const groups = {}
    paginatedItems.forEach(item => {
      const subdomain = item.subdomain || extractSubdomain(item.discovered_url)
      if (!groups[subdomain]) groups[subdomain] = []
      groups[subdomain].push(item)
    })
    return groups
  }, [paginatedItems])

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url)
  }

  const copyAll = () => {
    const urls = items.map(i => i.discovered_url).join('\n')
    navigator.clipboard.writeText(urls)
  }

  const exportCsv = () => {
    const headers = ['URL', 'Type', 'Status', 'Subdomain', 'Tool', 'Interesting']
    const rows = items.map(i => [
      i.discovered_url,
      i.content_type,
      i.status_code || '',
      i.subdomain || '',
      i.tool_name || '',
      i.is_interesting ? 'Yes' : 'No'
    ])
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content-discovery-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleGroup = (subdomain) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(subdomain)) next.delete(subdomain)
      else next.add(subdomain)
      return next
    })
  }

  const getTypeConfig = (type) => CONTENT_TYPES[type] || CONTENT_TYPES.endpoint
  const getStatusColor = (code) => {
    if (!code) return 'text-gray-500'
    if (code >= 200 && code < 300) return 'text-emerald-400'
    if (code >= 300 && code < 400) return 'text-blue-400'
    if (code >= 400 && code < 500) return 'text-orange-400'
    return 'text-red-400'
  }

  if (items.length === 0) {
    return (
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1a1a1a] flex items-center justify-center">
            <EmptyIcon size={32} className="text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">{emptyMessage}</h3>
          <p className="text-gray-500">Run a content discovery scan to find URLs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={globalFilters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              placeholder="Filter URLs..."
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder:text-gray-500 focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Subdomain filter */}
          {showSubdomainColumn && uniqueSubdomains.length > 1 && (
            <select
              value={globalFilters.subdomain}
              onChange={(e) => updateFilters({ subdomain: e.target.value })}
              className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500/50"
            >
              <option value="all">All Subdomains</option>
              {uniqueSubdomains.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Tool filter */}
          {uniqueTools.length > 1 && (
            <select
              value={globalFilters.tool}
              onChange={(e) => updateFilters({ tool: e.target.value })}
              className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500/50"
            >
              <option value="all">All Tools</option>
              {uniqueTools.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          {/* Status filter */}
          <select
            value={globalFilters.status}
            onChange={(e) => updateFilters({ status: e.target.value })}
            className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500/50"
          >
            <option value="all">All Status</option>
            <option value="2xx">2xx Success</option>
            <option value="3xx">3xx Redirect</option>
            <option value="4xx">4xx Client Error</option>
            <option value="5xx">5xx Server Error</option>
          </select>

          {/* Interesting toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={globalFilters.interesting}
              onChange={(e) => updateFilters({ interesting: e.target.checked })}
              className="rounded border-gray-600 bg-[#0a0a0a] text-emerald-500 focus:ring-emerald-500"
            />
            <Star size={14} className="text-yellow-400" />
            Interesting Only
          </label>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={copyAll}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title="Copy all URLs"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={exportCsv}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
              title="Export CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Result count */}
        <div className="mt-3 text-sm text-gray-500">
          Showing {paginatedItems.length} of {items.length} items
          {Object.keys(groupedItems).length > 0 && ` across ${Object.keys(groupedItems).length} subdomains`}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
        <div className="divide-y divide-[#1f1f1f]">
          {Object.entries(groupedItems).map(([subdomain, subItems]) => (
            <div key={subdomain}>
              {/* Subdomain Header */}
              <button
                onClick={() => toggleGroup(subdomain)}
                className="w-full flex items-center justify-between p-4 bg-[#0a0a0a] hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedItems.has(subdomain) ? (
                    <ChevronDown size={18} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={18} className="text-gray-400" />
                  )}
                  <Globe size={16} className="text-emerald-400" />
                  <span className="font-medium text-white">{subdomain}</span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg border border-emerald-500/30">
                    {subItems.length} items
                  </span>
                </div>
              </button>

              {/* Items */}
              {expandedItems.has(subdomain) && (
                <div className="divide-y divide-[#1f1f1f]">
                  {subItems.map((item) => {
                    const typeConfig = getTypeConfig(item.content_type)
                    const Icon = iconMap[typeConfig.icon] || Link

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-4 px-4 py-3 pl-12 hover:bg-[#1a1a1a] transition-colors ${
                          item.is_interesting ? 'bg-yellow-500/5' : ''
                        }`}
                      >
                        {/* Type Icon */}
                        {showTypeColumn && (
                          <div className={`p-2 rounded-lg ${typeConfig.bg}`}>
                            <Icon size={14} className={typeConfig.color} />
                          </div>
                        )}

                        {/* URL */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-white truncate">
                              {item.discovered_url}
                            </span>
                            {item.is_interesting && (
                              <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {showTypeColumn && (
                              <span className={typeConfig.color}>{typeConfig.label}</span>
                            )}
                            {item.tool_name && <span>{item.tool_name}</span>}
                            {item.discovery_type && <span>{item.discovery_type}</span>}
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-4">
                          {item.status_code && (
                            <span className={`text-sm font-mono ${getStatusColor(item.status_code)}`}>
                              {item.status_code}
                            </span>
                          )}
                          {item.content_length && (
                            <span className="text-xs text-gray-500">
                              {(item.content_length / 1024).toFixed(1)}KB
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyUrl(item.discovered_url)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
                            title="Copy URL"
                          >
                            <Copy size={14} />
                          </button>
                          <a
                            href={item.discovered_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-white hover:bg-[#252525] rounded-lg transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-[#111111] text-white rounded-lg border border-[#1f1f1f] hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-[#111111] text-white rounded-lg border border-[#1f1f1f] hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContentDiscoveryTable
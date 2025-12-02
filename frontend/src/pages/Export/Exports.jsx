/**
 * Exports Page
 * Export all reconnaissance data with proper subdomain relationships
 * Supports JSON, CSV, and text formats with hierarchical structure
 */

import { useState, useMemo } from 'react'
import {
  Download,
  FileJson,
  FileText,
  Table,
  Globe,
  Database,
  Link as LinkIcon,
  FolderOpen,
  FileCode,
  CheckCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Eye
} from 'lucide-react'
import { useContentDiscovery, CONTENT_TYPES } from '../../stores/ContentDiscoveryStore'

export default function Exports() {
  const { items, stats, uniqueSubdomains } = useContentDiscovery()
  
  const [selectedFormat, setSelectedFormat] = useState('json')
  const [selectedScope, setSelectedScope] = useState('all')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [groupBySubdomain, setGroupBySubdomain] = useState(true)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [copiedPreview, setCopiedPreview] = useState(false)
  const [showMapping, setShowMapping] = useState(true)
  
  // Build the output mapping structure
  const outputMapping = useMemo(() => {
    const mapping = {
      metadata: {
        exported_at: new Date().toISOString(),
        total_items: items.length,
        total_subdomains: uniqueSubdomains.length,
        content_types: {
          apis: stats.apis || 0,
          endpoints: stats.endpoints || 0,
          directories: stats.directories || 0,
          javascript: stats.javascript || 0
        },
        interesting_count: stats.interesting || 0
      },
      subdomains: {}
    }
    
    // Group items by subdomain
    uniqueSubdomains.forEach(subdomain => {
      const subItems = items.filter(i => i.subdomain === subdomain)
      
      mapping.subdomains[subdomain] = {
        subdomain: subdomain,
        total_items: subItems.length,
        content: {
          apis: subItems
            .filter(i => i.content_type === 'api')
            .map(i => ({
              url: i.discovered_url,
              status_code: i.status_code,
              is_interesting: i.is_interesting,
              tool: i.tool_name,
              discovered_at: i.created_at
            })),
          endpoints: subItems
            .filter(i => i.content_type === 'endpoint')
            .map(i => ({
              url: i.discovered_url,
              status_code: i.status_code,
              is_interesting: i.is_interesting,
              tool: i.tool_name,
              discovered_at: i.created_at
            })),
          directories: subItems
            .filter(i => i.content_type === 'directory')
            .map(i => ({
              url: i.discovered_url,
              status_code: i.status_code,
              is_interesting: i.is_interesting,
              tool: i.tool_name,
              discovered_at: i.created_at
            })),
          javascript: subItems
            .filter(i => i.content_type === 'javascript')
            .map(i => ({
              url: i.discovered_url,
              status_code: i.status_code,
              is_interesting: i.is_interesting,
              tool: i.tool_name,
              discovered_at: i.created_at
            }))
        },
        stats: {
          apis: subItems.filter(i => i.content_type === 'api').length,
          endpoints: subItems.filter(i => i.content_type === 'endpoint').length,
          directories: subItems.filter(i => i.content_type === 'directory').length,
          javascript: subItems.filter(i => i.content_type === 'javascript').length,
          interesting: subItems.filter(i => i.is_interesting).length
        }
      }
    })
    
    return mapping
  }, [items, uniqueSubdomains, stats])
  
  // Generate flat list for CSV export
  const flatItems = useMemo(() => {
    return items.map(item => ({
      subdomain: item.subdomain,
      content_type: item.content_type,
      url: item.discovered_url,
      status_code: item.status_code || '',
      is_interesting: item.is_interesting ? 'Yes' : 'No',
      tool: item.tool_name || '',
      discovered_at: item.created_at || ''
    }))
  }, [items])
  
  // Generate export data based on format
  const generateExport = () => {
    let data, filename, mimeType
    
    switch (selectedFormat) {
      case 'json':
        data = JSON.stringify(groupBySubdomain ? outputMapping : { items: flatItems }, null, 2)
        filename = 'content-discovery-export.json'
        mimeType = 'application/json'
        break
        
      case 'csv':
        const headers = ['subdomain', 'content_type', 'url', 'status_code', 'is_interesting', 'tool', 'discovered_at']
        const csvRows = [
          headers.join(','),
          ...flatItems.map(item => 
            headers.map(h => `"${(item[h] || '').toString().replace(/"/g, '""')}"`).join(',')
          )
        ]
        data = csvRows.join('\n')
        filename = 'content-discovery-export.csv'
        mimeType = 'text/csv'
        break
        
      case 'txt':
        let txtOutput = `# Content Discovery Export\n`
        txtOutput += `# Generated: ${new Date().toISOString()}\n`
        txtOutput += `# Total Items: ${items.length}\n\n`
        
        uniqueSubdomains.forEach(subdomain => {
          const subItems = items.filter(i => i.subdomain === subdomain)
          txtOutput += `\n## ${subdomain} (${subItems.length} items)\n`
          txtOutput += `${'='.repeat(50)}\n\n`
          
          const types = ['api', 'endpoint', 'directory', 'javascript']
          types.forEach(type => {
            const typeItems = subItems.filter(i => i.content_type === type)
            if (typeItems.length > 0) {
              txtOutput += `### ${type.toUpperCase()}S (${typeItems.length})\n`
              typeItems.forEach(item => {
                const marker = item.is_interesting ? '★ ' : '  '
                txtOutput += `${marker}${item.discovered_url}\n`
              })
              txtOutput += '\n'
            }
          })
        })
        data = txtOutput
        filename = 'content-discovery-export.txt'
        mimeType = 'text/plain'
        break
        
      default:
        return
    }
    
    // Create and trigger download
    const blob = new Blob([data], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    setExportSuccess(true)
    setTimeout(() => setExportSuccess(false), 3000)
  }
  
  const copyPreview = () => {
    const preview = JSON.stringify(outputMapping, null, 2)
    navigator.clipboard.writeText(preview)
    setCopiedPreview(true)
    setTimeout(() => setCopiedPreview(false), 2000)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Download size={24} className="text-emerald-400" />
            </div>
            Export Data
          </h1>
          <p className="text-gray-500 mt-1">
            Export reconnaissance data with subdomain relationships
          </p>
        </div>
        
        {exportSuccess && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
            <CheckCircle size={16} className="text-emerald-400" />
            <span className="text-emerald-400 font-medium">Export successful!</span>
          </div>
        )}
      </div>

      {/* Export Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f]">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total Items</div>
          <div className="text-2xl font-bold text-white mt-1">{items.length}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f]">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Subdomains</div>
          <div className="text-2xl font-bold text-white mt-1">{uniqueSubdomains.length}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-orange-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">APIs</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{stats.apis || 0}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-blue-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Endpoints</div>
          <div className="text-2xl font-bold text-blue-400 mt-1">{stats.endpoints || 0}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-yellow-500/30">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Interesting</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{stats.interesting || 0}</div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Export Options</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Format</label>
            <div className="flex gap-2">
              {[
                { id: 'json', icon: FileJson, label: 'JSON' },
                { id: 'csv', icon: Table, label: 'CSV' },
                { id: 'txt', icon: FileText, label: 'Text' }
              ].map(format => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    selectedFormat === format.id
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                      : 'bg-[#0a0a0a] border-[#1f1f1f] text-gray-400 hover:border-[#252525]'
                  }`}
                >
                  <format.icon size={18} />
                  {format.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Options */}
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-400 mb-2">Options</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupBySubdomain}
                  onChange={(e) => setGroupBySubdomain(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${groupBySubdomain ? 'bg-emerald-500' : 'bg-[#252525]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${groupBySubdomain ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-400">Group by subdomain</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMetadata}
                  onChange={(e) => setIncludeMetadata(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${includeMetadata ? 'bg-emerald-500' : 'bg-[#252525]'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${includeMetadata ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-400">Include metadata</span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Export Button */}
        <button
          onClick={generateExport}
          disabled={items.length === 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={18} />
          Export {items.length} Items
        </button>
      </div>

      {/* Output Mapping Preview */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
        <button
          onClick={() => setShowMapping(!showMapping)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Eye size={20} className="text-emerald-400" />
            <span className="text-white font-semibold">Output Mapping Structure</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); copyPreview() }}
              className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-[#252525] transition-colors"
            >
              {copiedPreview ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
            <ChevronDown size={18} className={`text-gray-500 transition-transform ${showMapping ? 'rotate-180' : ''}`} />
          </div>
        </button>
        
        {showMapping && (
          <div className="border-t border-[#1f1f1f] p-5">
            {/* Visual Mapping Diagram */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Data Relationship Structure</h4>
              <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f]">
                <div className="space-y-3">
                  {/* Root */}
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500 mt-1.5" />
                    <div>
                      <span className="text-emerald-400 font-mono text-sm">export_data</span>
                      <span className="text-gray-600 text-sm ml-2">(root)</span>
                    </div>
                  </div>
                  
                  {/* Metadata */}
                  <div className="ml-6 flex items-start gap-2">
                    <ChevronRight size={14} className="text-gray-600 mt-1" />
                    <div className="w-3 h-3 rounded bg-gray-500 mt-1.5" />
                    <div>
                      <span className="text-gray-400 font-mono text-sm">metadata</span>
                      <span className="text-gray-600 text-sm ml-2">- export info, totals, stats</span>
                    </div>
                  </div>
                  
                  {/* Subdomains */}
                  <div className="ml-6 flex items-start gap-2">
                    <ChevronRight size={14} className="text-gray-600 mt-1" />
                    <div className="w-3 h-3 rounded bg-blue-500 mt-1.5" />
                    <div>
                      <span className="text-blue-400 font-mono text-sm">subdomains</span>
                      <span className="text-gray-600 text-sm ml-2">- grouped by subdomain</span>
                    </div>
                  </div>
                  
                  {/* Subdomain Entry */}
                  <div className="ml-12 flex items-start gap-2">
                    <ChevronRight size={14} className="text-gray-600 mt-1" />
                    <Globe size={14} className="text-blue-400 mt-1" />
                    <div>
                      <span className="text-white font-mono text-sm">[subdomain_name]</span>
                    </div>
                  </div>
                  
                  {/* Content Types */}
                  <div className="ml-20 space-y-2">
                    <div className="flex items-center gap-2">
                      <ChevronRight size={12} className="text-gray-600" />
                      <Database size={12} className="text-orange-400" />
                      <span className="text-orange-400 font-mono text-xs">apis[]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight size={12} className="text-gray-600" />
                      <LinkIcon size={12} className="text-blue-400" />
                      <span className="text-blue-400 font-mono text-xs">endpoints[]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight size={12} className="text-gray-600" />
                      <FolderOpen size={12} className="text-yellow-400" />
                      <span className="text-yellow-400 font-mono text-xs">directories[]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChevronRight size={12} className="text-gray-600" />
                      <FileCode size={12} className="text-purple-400" />
                      <span className="text-purple-400 font-mono text-xs">javascript[]</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* JSON Preview */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">JSON Structure Preview</h4>
              <pre className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f] text-xs text-gray-400 overflow-x-auto max-h-96">
{`{
  "metadata": {
    "exported_at": "${new Date().toISOString()}",
    "total_items": ${items.length},
    "total_subdomains": ${uniqueSubdomains.length},
    "content_types": {
      "apis": ${stats.apis || 0},
      "endpoints": ${stats.endpoints || 0},
      "directories": ${stats.directories || 0},
      "javascript": ${stats.javascript || 0}
    },
    "interesting_count": ${stats.interesting || 0}
  },
  "subdomains": {
${uniqueSubdomains.slice(0, 2).map(sub => {
  const subItems = items.filter(i => i.subdomain === sub)
  return `    "${sub}": {
      "subdomain": "${sub}",
      "total_items": ${subItems.length},
      "content": {
        "apis": [...${subItems.filter(i => i.content_type === 'api').length} items],
        "endpoints": [...${subItems.filter(i => i.content_type === 'endpoint').length} items],
        "directories": [...${subItems.filter(i => i.content_type === 'directory').length} items],
        "javascript": [...${subItems.filter(i => i.content_type === 'javascript').length} items]
      },
      "stats": {
        "apis": ${subItems.filter(i => i.content_type === 'api').length},
        "endpoints": ${subItems.filter(i => i.content_type === 'endpoint').length},
        "directories": ${subItems.filter(i => i.content_type === 'directory').length},
        "javascript": ${subItems.filter(i => i.content_type === 'javascript').length},
        "interesting": ${subItems.filter(i => i.is_interesting).length}
      }
    }`
}).join(',\n')}${uniqueSubdomains.length > 2 ? `,\n    // ... ${uniqueSubdomains.length - 2} more subdomains` : ''}
  }
}`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Per-Subdomain Breakdown */}
      {uniqueSubdomains.length > 0 && (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1f1f1f]">
            <h3 className="text-lg font-semibold text-white">Export Preview by Subdomain</h3>
          </div>
          <div className="divide-y divide-[#1f1f1f] max-h-96 overflow-y-auto">
            {uniqueSubdomains.map(subdomain => {
              const subItems = items.filter(i => i.subdomain === subdomain)
              const subStats = {
                apis: subItems.filter(i => i.content_type === 'api').length,
                endpoints: subItems.filter(i => i.content_type === 'endpoint').length,
                directories: subItems.filter(i => i.content_type === 'directory').length,
                javascript: subItems.filter(i => i.content_type === 'javascript').length
              }
              
              return (
                <div key={subdomain} className="px-5 py-4 hover:bg-[#1a1a1a] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Globe size={16} className="text-emerald-400" />
                      <span className="text-white font-medium">{subdomain}</span>
                    </div>
                    <span className="text-gray-500 text-sm">{subItems.length} items</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    {subStats.apis > 0 && (
                      <span className="flex items-center gap-1 text-orange-400">
                        <Database size={12} /> {subStats.apis}
                      </span>
                    )}
                    {subStats.endpoints > 0 && (
                      <span className="flex items-center gap-1 text-blue-400">
                        <LinkIcon size={12} /> {subStats.endpoints}
                      </span>
                    )}
                    {subStats.directories > 0 && (
                      <span className="flex items-center gap-1 text-yellow-400">
                        <FolderOpen size={12} /> {subStats.directories}
                      </span>
                    )}
                    {subStats.javascript > 0 && (
                      <span className="flex items-center gap-1 text-purple-400">
                        <FileCode size={12} /> {subStats.javascript}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
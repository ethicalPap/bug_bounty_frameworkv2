import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { 
  Download, 
  FileText, 
  Globe, 
  Activity, 
  Search, 
  Network,
  CheckCircle,
  AlertCircle,
  Database,
  FileJson,
  FileSpreadsheet,
  Settings,
  Package
} from 'lucide-react'

const STORAGE_KEYS = {
  SUBDOMAIN_RESULTS: 'subdomain_scanner_last_domain',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
  PORT_SCAN_RESULTS: 'port_scan_results',
  CONTENT_DISCOVERY_RESULTS: 'content_discovery_results',
}

const Exports = () => {
  const queryClient = useQueryClient()
  const [selectedDomain, setSelectedDomain] = useState('')
  const [availableDomains, setAvailableDomains] = useState([])
  const [exportFormat, setExportFormat] = useState('json')
  
  // Export options
  const [exportOptions, setExportOptions] = useState({
    includeSubdomains: true,
    includeLiveHosts: true,
    includePortScans: true,
    includeContentDiscovery: true,
    includeMetadata: true,
    includeTimestamps: true,
    includeRelationships: true
  })

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

  // Get all data with relationships
  const allData = useMemo(() => {
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

    // Build relational structure - everything linked to subdomains
    const subdomainsWithRelations = subdomains.map(subdomain => {
      const subdomainName = subdomain.full_domain

      // Find related live hosts
      const relatedLiveHosts = liveHosts.filter(host => 
        host.subdomain === subdomainName || host.subdomain?.includes(subdomainName)
      )

      // Find related port scans
      const relatedPorts = portScans.filter(port =>
        port.target === subdomainName || 
        port.target?.includes(subdomainName) ||
        relatedLiveHosts.some(host => host.ip_address === port.target)
      )

      // Find related content discovery
      const relatedEndpoints = contentDiscovery.filter(endpoint =>
        endpoint.discovered_url?.includes(subdomainName) ||
        endpoint.base_url?.includes(subdomainName)
      )

      return {
        subdomain: subdomain,
        live_hosts: relatedLiveHosts,
        open_ports: relatedPorts,
        discovered_endpoints: relatedEndpoints,
        statistics: {
          total_live_hosts: relatedLiveHosts.length,
          active_hosts: relatedLiveHosts.filter(h => h.is_active).length,
          total_open_ports: relatedPorts.length,
          total_endpoints: relatedEndpoints.length
        }
      }
    })

    return {
      raw: {
        subdomains,
        liveHosts,
        portScans,
        contentDiscovery
      },
      relational: subdomainsWithRelations
    }
  }, [selectedDomain, queryClient])

  // Statistics
  const stats = {
    subdomains: allData.raw.subdomains.length,
    liveHosts: allData.raw.liveHosts.filter(h => h.is_active).length,
    ports: allData.raw.portScans.length,
    endpoints: allData.raw.contentDiscovery.length,
    lastScan: allData.raw.subdomains[0]?.created_at || null
  }

  // Main comprehensive export function
  const handleExport = () => {
    const timestamp = new Date().toISOString()
    const dateStr = timestamp.split('T')[0]

    if (exportFormat === 'json') {
      const exportData = {
        metadata: exportOptions.includeMetadata ? {
          domain: selectedDomain,
          exported_at: timestamp,
          export_version: '1.0',
          total_subdomains: stats.subdomains,
          total_active_hosts: stats.liveHosts,
          total_open_ports: stats.ports,
          total_endpoints: stats.endpoints,
          last_scan_date: stats.lastScan
        } : undefined,

        // Relational data structure - everything grouped by subdomain
        reconnaissance: exportOptions.includeRelationships ? allData.relational.map(item => ({
          subdomain: exportOptions.includeSubdomains ? {
            full_domain: item.subdomain.full_domain,
            is_active: item.subdomain.is_active,
            ip_address: item.subdomain.ip_address,
            status_code: item.subdomain.status_code,
            title: item.subdomain.title,
            server: item.subdomain.server,
            technologies: item.subdomain.technologies,
            screenshot_path: item.subdomain.screenshot_path,
            created_at: exportOptions.includeTimestamps ? item.subdomain.created_at : undefined
          } : undefined,

          live_hosts: exportOptions.includeLiveHosts ? item.live_hosts.map(host => ({
            subdomain: host.subdomain,
            is_active: host.is_active,
            protocol: host.protocol,
            status_code: host.status_code,
            response_time: host.response_time,
            ip_address: host.ip_address,
            content_length: host.content_length,
            server: host.server,
            checked_at: exportOptions.includeTimestamps ? host.checked_at : undefined
          })) : undefined,

          open_ports: exportOptions.includePortScans ? item.open_ports.map(port => ({
            target: port.target,
            port: port.port,
            protocol: port.protocol,
            state: port.state,
            service: port.service,
            version: port.version,
            product: port.product,
            extra_info: port.extra_info,
            scanned_at: exportOptions.includeTimestamps ? port.scanned_at : undefined
          })) : undefined,

          discovered_endpoints: exportOptions.includeContentDiscovery ? item.discovered_endpoints.map(endpoint => ({
            discovered_url: endpoint.discovered_url,
            status_code: endpoint.status_code,
            method: endpoint.method,
            content_length: endpoint.content_length,
            redirect_location: endpoint.redirect_location,
            discovery_type: endpoint.discovery_type,
            tool_name: endpoint.tool_name,
            discovered_at: exportOptions.includeTimestamps ? endpoint.discovered_at : undefined
          })) : undefined,

          statistics: exportOptions.includeMetadata ? item.statistics : undefined
        })) : undefined,

        // Raw data structure - flat lists
        raw_data: !exportOptions.includeRelationships ? {
          subdomains: exportOptions.includeSubdomains ? allData.raw.subdomains : undefined,
          live_hosts: exportOptions.includeLiveHosts ? allData.raw.liveHosts : undefined,
          port_scans: exportOptions.includePortScans ? allData.raw.portScans : undefined,
          content_discovery: exportOptions.includeContentDiscovery ? allData.raw.contentDiscovery : undefined
        } : undefined
      }

      // Remove undefined fields
      const cleanData = JSON.parse(JSON.stringify(exportData))

      const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedDomain}-reconnaissance-${dateStr}.json`
      a.click()
      window.URL.revokeObjectURL(url)
    } else if (exportFormat === 'csv') {
      // CSV export with relational context
      const csvSections = []

      // Subdomains section
      if (exportOptions.includeSubdomains && allData.raw.subdomains.length > 0) {
        csvSections.push('=== SUBDOMAINS ===')
        csvSections.push('Full Domain,Status,IP Address,HTTP Code,Title,Server,Technologies,Created At')
        allData.raw.subdomains.forEach(s => {
          csvSections.push([
            s.full_domain,
            s.is_active ? 'Active' : 'Inactive',
            s.ip_address || 'N/A',
            s.status_code || 'N/A',
            `"${(s.title || 'N/A').replace(/"/g, '""')}"`,
            s.server || 'N/A',
            `"${(s.technologies?.join(', ') || 'N/A').replace(/"/g, '""')}"`,
            exportOptions.includeTimestamps ? (s.created_at || 'N/A') : ''
          ].filter(Boolean).join(','))
        })
        csvSections.push('')
      }

      // Live Hosts section with subdomain context
      if (exportOptions.includeLiveHosts && allData.raw.liveHosts.length > 0) {
        csvSections.push('=== LIVE HOSTS ===')
        csvSections.push('Subdomain,Status,Protocol,HTTP Code,Response Time (ms),IP Address,Server,Checked At')
        allData.raw.liveHosts.forEach(h => {
          csvSections.push([
            h.subdomain,
            h.is_active ? 'Active' : 'Inactive',
            h.protocol || 'N/A',
            h.status_code || 'N/A',
            h.response_time || 'N/A',
            h.ip_address || 'N/A',
            h.server || 'N/A',
            exportOptions.includeTimestamps ? (h.checked_at || 'N/A') : ''
          ].filter(Boolean).join(','))
        })
        csvSections.push('')
      }

      // Port Scans section with target context
      if (exportOptions.includePortScans && allData.raw.portScans.length > 0) {
        csvSections.push('=== OPEN PORTS ===')
        csvSections.push('Target,Port,Protocol,State,Service,Version,Product,Extra Info,Scanned At')
        allData.raw.portScans.forEach(p => {
          csvSections.push([
            p.target,
            p.port,
            p.protocol,
            p.state,
            p.service || 'unknown',
            p.version || 'N/A',
            p.product || 'N/A',
            `"${(p.extra_info || 'N/A').replace(/"/g, '""')}"`,
            exportOptions.includeTimestamps ? (p.scanned_at || 'N/A') : ''
          ].filter(Boolean).join(','))
        })
        csvSections.push('')
      }

      // Content Discovery section with URL context
      if (exportOptions.includeContentDiscovery && allData.raw.contentDiscovery.length > 0) {
        csvSections.push('=== DISCOVERED ENDPOINTS ===')
        csvSections.push('URL,Status Code,Method,Content Length,Redirect,Discovery Type,Tool,Discovered At')
        allData.raw.contentDiscovery.forEach(c => {
          csvSections.push([
            c.discovered_url,
            c.status_code || 'N/A',
            c.method || 'GET',
            c.content_length || 'N/A',
            c.redirect_location || 'N/A',
            c.discovery_type || 'N/A',
            c.tool_name || 'N/A',
            exportOptions.includeTimestamps ? (c.discovered_at || 'N/A') : ''
          ].filter(Boolean).join(','))
        })
        csvSections.push('')
      }

      // Add metadata header if enabled
      if (exportOptions.includeMetadata) {
        csvSections.unshift(
          '=== METADATA ===',
          `Domain,${selectedDomain}`,
          `Exported At,${timestamp}`,
          `Total Subdomains,${stats.subdomains}`,
          `Active Hosts,${stats.liveHosts}`,
          `Open Ports,${stats.ports}`,
          `Endpoints,${stats.endpoints}`,
          ''
        )
      }

      const csvContent = csvSections.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedDomain}-reconnaissance-${dateStr}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }
  }

  const toggleOption = (option) => {
    setExportOptions(prev => ({ ...prev, [option]: !prev[option] }))
  }

  const hasAnyData = stats.subdomains > 0 || stats.liveHosts > 0 || stats.ports > 0 || stats.endpoints > 0

  if (availableDomains.length === 0) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Download className="text-cyber-blue" />
            Exports
          </h2>
          <p className="text-gray-400 mt-2">Export reconnaissance data with full context</p>
        </div>
        
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-12 text-center">
          <Database className="mx-auto text-gray-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-white mb-2">No Data Available</h3>
          <p className="text-gray-400">Run reconnaissance scans to generate exportable data</p>
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
            <Download className="text-cyber-blue" />
            Exports
          </h2>
          <p className="text-gray-400 mt-2">Export all reconnaissance data with relationships and context</p>
        </div>
      </div>

      {/* Domain & Format Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Domain Selection */}
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Globe className="text-cyber-blue" size={18} />
            Target Domain
          </label>
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="w-full px-4 py-3 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-blue transition-all"
          >
            {availableDomains.map((domain) => (
              <option key={domain} value={domain}>{domain}</option>
            ))}
          </select>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-dark-200 rounded-lg p-3 border border-dark-50">
              <div className="text-gray-400 text-xs mb-1">Subdomains</div>
              <div className="text-xl font-bold text-cyber-blue">{stats.subdomains}</div>
            </div>
            <div className="bg-dark-200 rounded-lg p-3 border border-green-500/20">
              <div className="text-gray-400 text-xs mb-1">Live Hosts</div>
              <div className="text-xl font-bold text-green-400">{stats.liveHosts}</div>
            </div>
            <div className="bg-dark-200 rounded-lg p-3 border border-cyber-pink/20">
              <div className="text-gray-400 text-xs mb-1">Open Ports</div>
              <div className="text-xl font-bold text-cyber-pink">{stats.ports}</div>
            </div>
            <div className="bg-dark-200 rounded-lg p-3 border border-cyber-purple/20">
              <div className="text-gray-400 text-xs mb-1">Endpoints</div>
              <div className="text-xl font-bold text-cyber-purple">{stats.endpoints}</div>
            </div>
          </div>
        </div>

        {/* Format Selection */}
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <FileText className="text-cyber-blue" size={18} />
            Export Format
          </label>
          <div className="space-y-3">
            <button
              onClick={() => setExportFormat('json')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                exportFormat === 'json'
                  ? 'border-cyber-blue bg-cyber-blue/10'
                  : 'border-dark-50 bg-dark-200 hover:border-cyber-blue/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileJson className={exportFormat === 'json' ? 'text-cyber-blue' : 'text-gray-400'} size={24} />
                <div>
                  <div className="text-white font-semibold">JSON Format</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Structured data with full relationships. Best for analysis and tool integration.
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setExportFormat('csv')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                exportFormat === 'csv'
                  ? 'border-cyber-blue bg-cyber-blue/10'
                  : 'border-dark-50 bg-dark-200 hover:border-cyber-blue/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className={exportFormat === 'csv' ? 'text-cyber-blue' : 'text-gray-400'} size={24} />
                <div>
                  <div className="text-white font-semibold">CSV Format</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Spreadsheet-compatible with sections. Best for Excel/Sheets analysis.
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="text-cyber-blue" />
          Export Options
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Data Type Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Include Data Types</h4>
            
            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-50 transition-all">
              <input
                type="checkbox"
                checked={exportOptions.includeSubdomains}
                onChange={() => toggleOption('includeSubdomains')}
                className="w-5 h-5 rounded border-dark-50 bg-dark-100 checked:bg-cyber-blue focus:ring-2 focus:ring-cyber-blue"
              />
              <Globe className="text-cyber-blue" size={18} />
              <div className="flex-1">
                <div className="text-white font-medium">Subdomains</div>
                <div className="text-xs text-gray-400">{stats.subdomains} records</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-50 transition-all">
              <input
                type="checkbox"
                checked={exportOptions.includeLiveHosts}
                onChange={() => toggleOption('includeLiveHosts')}
                className="w-5 h-5 rounded border-dark-50 bg-dark-100 checked:bg-green-500 focus:ring-2 focus:ring-green-500"
              />
              <Activity className="text-green-400" size={18} />
              <div className="flex-1">
                <div className="text-white font-medium">Live Hosts</div>
                <div className="text-xs text-gray-400">{stats.liveHosts} active</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-50 transition-all">
              <input
                type="checkbox"
                checked={exportOptions.includePortScans}
                onChange={() => toggleOption('includePortScans')}
                className="w-5 h-5 rounded border-dark-50 bg-dark-100 checked:bg-cyber-pink focus:ring-2 focus:ring-cyber-pink"
              />
              <Network className="text-cyber-pink" size={18} />
              <div className="flex-1">
                <div className="text-white font-medium">Port Scans</div>
                <div className="text-xs text-gray-400">{stats.ports} open ports</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-50 transition-all">
              <input
                type="checkbox"
                checked={exportOptions.includeContentDiscovery}
                onChange={() => toggleOption('includeContentDiscovery')}
                className="w-5 h-5 rounded border-dark-50 bg-dark-100 checked:bg-cyber-purple focus:ring-2 focus:ring-cyber-purple"
              />
              <Search className="text-cyber-purple" size={18} />
              <div className="flex-1">
                <div className="text-white font-medium">Content Discovery</div>
                <div className="text-xs text-gray-400">{stats.endpoints} endpoints</div>
              </div>
            </label>
          </div>

          {/* Additional Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Additional Settings</h4>
            
            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-50 transition-all">
              <input
                type="checkbox"
                checked={exportOptions.includeMetadata}
                onChange={() => toggleOption('includeMetadata')}
                className="w-5 h-5 rounded border-dark-50 bg-dark-100 checked:bg-cyber-blue focus:ring-2 focus:ring-cyber-blue"
              />
              <Database className="text-cyber-blue" size={18} />
              <div className="flex-1">
                <div className="text-white font-medium">Metadata & Statistics</div>
                <div className="text-xs text-gray-400">Include export info and totals</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-50 transition-all">
              <input
                type="checkbox"
                checked={exportOptions.includeTimestamps}
                onChange={() => toggleOption('includeTimestamps')}
                className="w-5 h-5 rounded border-dark-50 bg-dark-100 checked:bg-cyber-blue focus:ring-2 focus:ring-cyber-blue"
              />
              <FileText className="text-cyber-blue" size={18} />
              <div className="flex-1">
                <div className="text-white font-medium">Timestamps</div>
                <div className="text-xs text-gray-400">Include scan and discovery dates</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-50 transition-all">
              <input
                type="checkbox"
                checked={exportOptions.includeRelationships}
                onChange={() => toggleOption('includeRelationships')}
                disabled={exportFormat === 'csv'}
                className="w-5 h-5 rounded border-dark-50 bg-dark-100 checked:bg-cyber-blue focus:ring-2 focus:ring-cyber-blue disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Package className="text-cyber-blue" size={18} />
              <div className="flex-1">
                <div className="text-white font-medium">Relational Structure</div>
                <div className="text-xs text-gray-400">
                  {exportFormat === 'csv' 
                    ? 'Only available in JSON format'
                    : 'Group data by subdomain with relationships'
                  }
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Export Info */}
      <div className="bg-gradient-to-r from-cyber-blue/10 to-cyber-purple/10 border border-cyber-blue/30 rounded-xl p-6">
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <AlertCircle className="text-cyber-blue" size={16} />
          Export Structure Information
        </h4>
        <div className="space-y-2 text-sm text-gray-400">
          {exportFormat === 'json' && exportOptions.includeRelationships && (
            <p>• <strong>Relational Structure:</strong> All reconnaissance data will be organized by subdomain. Each subdomain will have its associated live hosts, open ports, and discovered endpoints grouped together for easy analysis.</p>
          )}
          {exportFormat === 'json' && !exportOptions.includeRelationships && (
            <p>• <strong>Flat Structure:</strong> Data will be exported as separate arrays for each scan type. Use this for raw data processing.</p>
          )}
          {exportFormat === 'csv' && (
            <p>• <strong>CSV Sections:</strong> The export will contain multiple sections (Subdomains, Live Hosts, Port Scans, Endpoints) with contextual information showing what belongs to which subdomain.</p>
          )}
          <p>• <strong>Context Preservation:</strong> Every port scan references its target host, every endpoint shows its parent subdomain, and all live hosts are linked to their subdomain.</p>
          <p>• <strong>Complete Data:</strong> Export includes all discovered information including IP addresses, status codes, services, versions, and metadata.</p>
        </div>
      </div>

      {/* Export Button */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Ready to Export</h3>
            <p className="text-sm text-gray-400">
              {Object.values(exportOptions).filter(Boolean).length} options selected • 
              {stats.subdomains + stats.liveHosts + stats.ports + stats.endpoints} total records
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={!hasAnyData}
            className="px-8 py-4 bg-gradient-to-r from-cyber-blue to-cyber-purple rounded-lg text-white font-semibold hover:from-cyber-blue/90 hover:to-cyber-purple/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-lg shadow-lg shadow-cyber-blue/20"
          >
            <Download size={24} />
            Export {exportFormat.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Exports
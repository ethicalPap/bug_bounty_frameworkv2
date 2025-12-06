import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { 
  Network, 
  Play, 
  CheckCircle, 
  XCircle, 
  Loader, 
  Download, 
  Copy, 
  X,
  Globe,
  AlertTriangle,
  Shield,
  Zap,
  Lock
} from 'lucide-react'

const STORAGE_KEYS = {
  PORT_SCAN_TARGETS: 'port_scan_targets',
  PORT_SCAN_RESULTS: 'port_scan_results',
  PORT_SCAN_CONFIG: 'port_scan_config',
}

// Common port presets
const PORT_PRESETS = {
  'top-20': { label: 'Top 20 Ports', ports: '21,22,23,25,53,80,110,111,135,139,143,443,445,993,995,3306,3389,5432,5900,8080', count: 20 },
  'top-100': { label: 'Top 100 Ports', ports: 'top-100', count: 100 },
  'top-1000': { label: 'Top 1000 Ports', ports: 'top-1000', count: 1000 },
  'common-web': { label: 'Common Web', ports: '80,443,8000,8008,8080,8081,8443,8888,3000,5000', count: 10 },
  'common-db': { label: 'Common Database', ports: '1433,3306,5432,5984,6379,9042,9200,27017', count: 8 },
  'all-tcp': { label: 'All TCP (1-65535)', ports: 'all-tcp', count: 65535 },
  'custom': { label: 'Custom Range', ports: '', count: 0 },
}

const PortScanner = () => {
  const queryClient = useQueryClient()
  
  // Available targets (active hosts from Live Hosts)
  const [availableTargets, setAvailableTargets] = useState([])
  const [selectedTargets, setSelectedTargets] = useState([])
  const [customTarget, setCustomTarget] = useState('')
  
  // Scan configuration
  const [scanConfig, setScanConfig] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PORT_SCAN_CONFIG)
    return saved ? JSON.parse(saved) : {
      port_preset: 'top-100',
      custom_ports: '',
      scan_type: 'syn', // syn, connect, version
      scan_speed: 'normal', // slow, normal, fast, aggressive
      service_detection: true,
      os_detection: false,
      threads: 10,
    }
  })
  
  // Scan state
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [currentTarget, setCurrentTarget] = useState('')
  const [scanResults, setScanResults] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PORT_SCAN_RESULTS)
    return saved ? JSON.parse(saved) : []
  })
  
  const scanAbortController = useRef(null)

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PORT_SCAN_CONFIG, JSON.stringify(scanConfig))
  }, [scanConfig])

  useEffect(() => {
    if (scanResults.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PORT_SCAN_RESULTS, JSON.stringify(scanResults))
    }
  }, [scanResults])

  // Load available targets
  useEffect(() => {
    try {
      const liveHostsData = localStorage.getItem('live_hosts_results')
      if (liveHostsData) {
        const hosts = JSON.parse(liveHostsData)
        const targets = hosts
          .filter(h => h.is_active)
          .map(h => ({
            host: h.subdomain,
            ip: null // Will be resolved during scan
          }))
        setAvailableTargets(targets)
      }
    } catch (error) {
      console.error('Failed to load targets:', error)
    }
  }, [])

  // Add custom target
  const addCustomTarget = () => {
    if (customTarget.trim() && !selectedTargets.includes(customTarget.trim())) {
      setSelectedTargets([...selectedTargets, customTarget.trim()])
      setCustomTarget('')
    }
  }

  // Remove target
  const removeTarget = (target) => {
    setSelectedTargets(selectedTargets.filter(t => t !== target))
  }

  // Select all targets
  const selectAllTargets = () => {
    setSelectedTargets(availableTargets.map(t => t.host))
  }

  // Clear all targets
  const clearAllTargets = () => {
    setSelectedTargets([])
  }

  // Mock port scan function (replace with actual API call)
  const scanPorts = async (targets, config) => {
    const results = []
    const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 8080, 8443]
    
    for (let i = 0; i < targets.length; i++) {
      if (scanAbortController.current?.signal.aborted) {
        throw new Error('Scan aborted')
      }
      
      const target = targets[i]
      setCurrentTarget(target)
      setScanProgress(((i + 1) / targets.length) * 100)
      
      // Simulate port scan
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock open ports (random subset of common ports)
      const openPortsCount = Math.floor(Math.random() * 5) + 2
      const openPorts = commonPorts
        .sort(() => 0.5 - Math.random())
        .slice(0, openPortsCount)
        .map(port => ({
          target: target,
          port: port,
          state: 'open',
          service: getServiceName(port),
          version: config.service_detection ? getServiceVersion(port) : null,
          protocol: 'tcp',
          scanned_at: new Date().toISOString()
        }))
      
      results.push(...openPorts)
    }
    
    return results
  }

  // Get service name for port
  const getServiceName = (port) => {
    const services = {
      21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns',
      80: 'http', 110: 'pop3', 143: 'imap', 443: 'https', 445: 'smb',
      3306: 'mysql', 3389: 'rdp', 5432: 'postgresql', 8080: 'http-proxy', 8443: 'https-alt'
    }
    return services[port] || 'unknown'
  }

  // Get service version
  const getServiceVersion = (port) => {
    const versions = {
      22: 'OpenSSH 8.2',
      80: 'nginx 1.18.0',
      443: 'nginx 1.18.0',
      3306: 'MySQL 5.7',
      3389: 'Microsoft RDP',
      5432: 'PostgreSQL 12.8',
      8080: 'Apache httpd 2.4.41'
    }
    return versions[port] || null
  }

  // Start port scan
  const startScan = async () => {
    if (selectedTargets.length === 0 || isScanning) return

    setIsScanning(true)
    setScanProgress(0)
    setScanResults([])
    scanAbortController.current = new AbortController()

    try {
      const results = await scanPorts(selectedTargets, scanConfig)
      setScanResults(results)
      setScanProgress(100)
      setIsScanning(false)
      setCurrentTarget('')
    } catch (error) {
      console.error('Port scan error:', error)
      setIsScanning(false)
      setCurrentTarget('')
    }
  }

  // Cancel scan
  const cancelScan = () => {
    if (scanAbortController.current) {
      scanAbortController.current.abort()
    }
    setIsScanning(false)
    setCurrentTarget('')
  }

  // Clear results
  const clearResults = () => {
    setScanResults([])
    setScanProgress(0)
    localStorage.removeItem(STORAGE_KEYS.PORT_SCAN_RESULTS)
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Target', 'Port', 'State', 'Service', 'Version', 'Protocol']
    const rows = scanResults.map(r => [
      r.target,
      r.port,
      r.state,
      r.service || 'unknown',
      r.version || 'N/A',
      r.protocol
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `port-scan-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Copy open ports to clipboard
  const copyToClipboard = () => {
    const text = scanResults.map(r => `${r.target}:${r.port}`).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => alert('Open ports copied to clipboard!'))
      .catch(err => console.error('Failed to copy:', err))
  }

  // Statistics
  const stats = {
    total_ports: scanResults.length,
    unique_targets: [...new Set(scanResults.map(r => r.target))].length,
    by_service: scanResults.reduce((acc, r) => {
      acc[r.service] = (acc[r.service] || 0) + 1
      return acc
    }, {}),
    common_ports: scanResults.filter(r => r.port <= 1024).length,
    high_ports: scanResults.filter(r => r.port > 1024).length,
    with_version: scanResults.filter(r => r.version).length,
  }

  const topServices = Object.entries(stats.by_service)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 4)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-600/20">
              <Network size={24} className="text-pink-400" />
            </div>
            Port Scanner
          </h1>
          <p className="text-gray-500 mt-1">Discover open ports and running services</p>
        </div>

        {scanResults.length > 0 && !isScanning && (
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1f1f1f] rounded-lg text-gray-400 hover:text-white hover:border-[#2a2a2a] transition-colors"
              title="Copy open ports"
            >
              <Copy size={16} />
              Copy Ports
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-2 bg-[#111111] border border-[#1f1f1f] rounded-lg text-gray-400 hover:text-white hover:border-[#2a2a2a] transition-colors"
              title="Export to CSV"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={clearResults}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
              title="Clear results"
            >
              <X size={16} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Scan Configuration */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
        <div className="space-y-6">
          {/* Target Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-400">
                Select Targets ({selectedTargets.length} selected)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAllTargets}
                  disabled={isScanning || availableTargets.length === 0}
                  className="text-xs text-emerald-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select All
                </button>
                <button
                  onClick={clearAllTargets}
                  disabled={isScanning || selectedTargets.length === 0}
                  className="text-xs text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
              </div>
            </div>

            {availableTargets.length === 0 ? (
              <div className="text-center py-8 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg">
                <Globe className="mx-auto text-gray-600 mb-3" size={48} />
                <p className="text-gray-400 mb-2">No active hosts available</p>
                <p className="text-sm text-gray-500">
                  Run Live Hosts probe first to discover targets
                </p>
              </div>
            ) : (
              <>
                {/* Available Targets */}
                <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {availableTargets.map((target) => (
                      <label
                        key={target.host}
                        className={`flex items-center gap-2 p-2 rounded border transition-all cursor-pointer ${
                          selectedTargets.includes(target.host)
                            ? 'bg-pink-500/10 border-pink-500/30'
                            : 'bg-[#111111] border-[#1f1f1f] hover:border-[#2a2a2a]'
                        } ${isScanning ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTargets.includes(target.host)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTargets([...selectedTargets, target.host])
                            } else {
                              removeTarget(target.host)
                            }
                          }}
                          disabled={isScanning}
                          className="w-4 h-4 rounded bg-[#0a0a0a] border-[#2a2a2a] text-pink-500 focus:ring-pink-500/50"
                        />
                        <span className="text-sm text-white truncate flex-1" title={target.host}>
                          {target.host}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Custom Target Input */}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
                    placeholder="Add custom target (IP or domain)"
                    className="flex-1 px-4 py-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                    disabled={isScanning}
                  />
                  <button
                    onClick={addCustomTarget}
                    disabled={!customTarget.trim() || isScanning}
                    className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Port Configuration */}
          {selectedTargets.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Port Range
                  </label>
                  <select
                    value={scanConfig.port_preset}
                    onChange={(e) => setScanConfig({...scanConfig, port_preset: e.target.value})}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                    disabled={isScanning}
                  >
                    {Object.entries(PORT_PRESETS).map(([key, preset]) => (
                      <option key={key} value={key}>
                        {preset.label} {preset.count > 0 ? `(${preset.count} ports)` : ''}
                      </option>
                    ))}
                  </select>
                  {scanConfig.port_preset === 'custom' && (
                    <input
                      type="text"
                      value={scanConfig.custom_ports}
                      onChange={(e) => setScanConfig({...scanConfig, custom_ports: e.target.value})}
                      placeholder="e.g., 80,443,8080-8090"
                      className="w-full mt-2 px-3 py-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                      disabled={isScanning}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Scan Type
                  </label>
                  <select
                    value={scanConfig.scan_type}
                    onChange={(e) => setScanConfig({...scanConfig, scan_type: e.target.value})}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                    disabled={isScanning}
                  >
                    <option value="syn">SYN Scan (Stealth)</option>
                    <option value="connect">Connect Scan (TCP)</option>
                    <option value="version">Version Detection</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Scan Speed
                  </label>
                  <select
                    value={scanConfig.scan_speed}
                    onChange={(e) => setScanConfig({...scanConfig, scan_speed: e.target.value})}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                    disabled={isScanning}
                  >
                    <option value="slow">Slow (Stealthy)</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                </div>

                <div>
                  <label className={`flex items-center gap-2 p-3 bg-[#0a0a0a] border rounded-lg cursor-pointer transition-colors ${
                    scanConfig.service_detection ? 'border-emerald-500/30' : 'border-[#1f1f1f] hover:border-[#2a2a2a]'
                  }`}>
                    <input
                      type="checkbox"
                      checked={scanConfig.service_detection}
                      onChange={(e) => setScanConfig({...scanConfig, service_detection: e.target.checked})}
                      disabled={isScanning}
                      className="w-4 h-4 rounded bg-[#0a0a0a] border-[#2a2a2a] text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span className="text-sm text-white">Service Detection</span>
                  </label>
                </div>

                <div>
                  <label className={`flex items-center gap-2 p-3 bg-[#0a0a0a] border rounded-lg cursor-pointer transition-colors ${
                    scanConfig.os_detection ? 'border-emerald-500/30' : 'border-[#1f1f1f] hover:border-[#2a2a2a]'
                  }`}>
                    <input
                      type="checkbox"
                      checked={scanConfig.os_detection}
                      onChange={(e) => setScanConfig({...scanConfig, os_detection: e.target.checked})}
                      disabled={isScanning}
                      className="w-4 h-4 rounded bg-[#0a0a0a] border-[#2a2a2a] text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span className="text-sm text-white">OS Detection</span>
                  </label>
                </div>
              </div>

              {/* Scan Info */}
              <div className="p-4 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="text-pink-400 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-white mb-1">Scan Configuration</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400">Targets:</span>
                        <span className="text-white ml-2 font-medium">{selectedTargets.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Ports:</span>
                        <span className="text-white ml-2 font-medium">
                          {PORT_PRESETS[scanConfig.port_preset]?.count || 'Custom'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Type:</span>
                        <span className="text-white ml-2 font-medium capitalize">{scanConfig.scan_type}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Speed:</span>
                        <span className="text-white ml-2 font-medium capitalize">{scanConfig.scan_speed}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isScanning ? (
              <button
                onClick={startScan}
                disabled={selectedTargets.length === 0}
                className="w-full py-3 px-6 bg-emerald-500/20 border border-emerald-500/30 rounded-lg font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Play size={20} />
                Start Port Scan
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="flex-1 py-3 px-6 bg-emerald-500/20 border border-emerald-500/30 rounded-lg font-medium text-emerald-400 opacity-75 cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <Loader className="animate-spin" size={20} />
                  Scanning... {scanProgress.toFixed(0)}%
                </button>
                
                <button
                  type="button"
                  onClick={cancelScan}
                  className="px-6 py-3 bg-red-500/10 border border-red-500/30 rounded-lg font-medium text-red-400 hover:bg-red-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
                >
                  <X size={20} />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isScanning && (
          <div className="mt-6 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Scan Progress</span>
                <span className="text-sm font-medium text-emerald-400">{scanProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[#0a0a0a] rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            {currentTarget && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader className="animate-spin text-emerald-400" size={16} />
                <span>Scanning: <span className="text-white font-mono font-medium">{currentTarget}</span></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {scanResults.length > 0 && !isScanning && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
          {/* Completion Banner */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <CheckCircle className="text-green-400" size={24} />
                  Port Scan Complete! 🎉
                </h4>
                <p className="text-sm text-gray-400 mt-2">
                  Found {stats.total_ports} open ports across {stats.unique_targets} target(s)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Export results above or view detailed analysis in the Dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white mb-1">{stats.total_ports}</div>
              <div className="text-xs text-gray-400">Open Ports</div>
            </div>
            <div className="bg-[#0a0a0a] border border-pink-500/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-pink-400 mb-1">{stats.unique_targets}</div>
              <div className="text-xs text-gray-400">Targets Scanned</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white mb-1">{stats.common_ports}</div>
              <div className="text-xs text-gray-400">Common Ports</div>
              <div className="text-xs text-gray-500 mt-1">(&lt;1024)</div>
            </div>
            <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white mb-1">{stats.with_version}</div>
              <div className="text-xs text-gray-400">With Version</div>
            </div>
          </div>

          {/* Top Services */}
          {topServices.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-white mb-3">Top Services Discovered</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {topServices.map(([service, count]) => (
                  <div key={service} className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white font-medium capitalize">{service}</span>
                      <span className="text-xs text-gray-400 bg-[#111111] px-2 py-1 rounded">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Information */}
          <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg flex-shrink-0">
                <Download className="text-emerald-400" size={24} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white mb-2">
                  Export Your Results
                </h4>
                <p className="text-sm text-gray-400 mb-4">
                  Export complete list of open ports with service information, versions, and protocols. 
                  Perfect for vulnerability assessment and further security analysis.
                </p>

                <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">CSV Export Contains:</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-2 py-1 bg-[#0a0a0a] rounded text-xs text-white">Target</span>
                    <span className="px-2 py-1 bg-[#0a0a0a] rounded text-xs text-white">Port</span>
                    <span className="px-2 py-1 bg-[#0a0a0a] rounded text-xs text-white">State</span>
                    <span className="px-2 py-1 bg-[#0a0a0a] rounded text-xs text-white">Service</span>
                    <span className="px-2 py-1 bg-[#0a0a0a] rounded text-xs text-white">Version</span>
                    <span className="px-2 py-1 bg-[#0a0a0a] rounded text-xs text-white">Protocol</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Detailed port and service information for security analysis
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PortScanner
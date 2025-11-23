import { useState, useEffect } from 'react'
import { Search, Loader, AlertCircle, Download, Copy, ExternalLink, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

const ContentDiscovery = () => {
  const [availableDomains, setAvailableDomains] = useState([])
  const [selectedDomain, setSelectedDomain] = useState('')
  const [subdomains, setSubdomains] = useState([])
  const [selectedSubdomains, setSelectedSubdomains] = useState([])
  const [customTarget, setCustomTarget] = useState('')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState('')
  const [scanResults, setScanResults] = useState(null)
  const [results, setResults] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Tool configuration
  const [toolConfig, setToolConfig] = useState({
    use_ffuf: true,
    use_feroxbuster: true,
    use_waymore: true,
    use_gau: true,
    use_katana: true,
    use_gospider: false,
    use_linkfinder: false,
    use_arjun: true,
    use_unfurl: true,
    use_uro: true,
    use_nuclei: false
  })

  const [advancedOptions, setAdvancedOptions] = useState({
    threads: 10,
    timeout: 600,
    rate_limit: 150,
    crawl_depth: 3,
    wordlist: '/opt/wordlists/common.txt'
  })

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Load available domains on mount
  useEffect(() => {
    fetchAvailableDomains()
  }, [])

  // Load subdomains when domain is selected
  useEffect(() => {
    if (selectedDomain) {
      fetchSubdomains(selectedDomain)
    }
  }, [selectedDomain])

  const fetchAvailableDomains = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/domains')
      if (response.ok) {
        const domains = await response.json()
        setAvailableDomains(domains)
      }
    } catch (error) {
      console.error('Error fetching domains:', error)
      setAvailableDomains([])
    }
  }

  const fetchSubdomains = async (targetDomain) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/subdomains/${targetDomain}`)
      const data = await response.json()
      setSubdomains(data || [])
      setSelectedSubdomains([]) // Clear selections when domain changes
    } catch (error) {
      console.error('Error fetching subdomains:', error)
    }
  }

  const toggleSubdomain = (subdomain) => {
    setSelectedSubdomains(prev => 
      prev.includes(subdomain)
        ? prev.filter(s => s !== subdomain)
        : [...prev, subdomain]
    )
  }

  const selectAll = () => {
    setSelectedSubdomains(subdomains.map(s => s.full_domain))
  }

  const clearAll = () => {
    setSelectedSubdomains([])
  }

  const addCustomTarget = () => {
    if (customTarget && !selectedSubdomains.includes(customTarget)) {
      setSelectedSubdomains([...selectedSubdomains, customTarget])
      setCustomTarget('')
    }
  }

  const toggleTool = (toolId) => {
    setToolConfig(prev => ({
      ...prev,
      [toolId]: !prev[toolId]
    }))
  }

  const startScan = async () => {
    if (selectedSubdomains.length === 0) {
      alert('Please select at least one target')
      return
    }

    setScanning(true)
    setProgress('Initializing scan...')
    setResults([])
    setScanResults(null)

    try {
      let allResults = []
      
      // Scan each target
      for (const target of selectedSubdomains) {
        setProgress(`Scanning ${target}...`)
        
        const response = await fetch('http://localhost:8000/api/v1/content-discovery/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_url: target.startsWith('http') ? target : `https://${target}`,
            scan_type: 'full',
            ...toolConfig,
            ...advancedOptions
          })
        })

        if (!response.ok) {
          console.error(`Failed to scan ${target}`)
          continue
        }

        const data = await response.json()
        console.log('Scan response for', target, ':', data)
        
        setScanResults(prev => ({
          ...prev,
          [target]: data
        }))
        
        // Collect results from scan response if available
        if (data.discovered_urls && Array.isArray(data.discovered_urls)) {
          allResults = [...allResults, ...data.discovered_urls]
        }
      }
      
      // Set results from scan responses
      if (allResults.length > 0) {
        console.log('Setting results from scan responses:', allResults.length)
        setResults(allResults)
        setProgress(`Completed! Found ${allResults.length} URLs`)
      } else {
        // Fallback: Fetch from database
        setProgress('Fetching results from database...')
        await fetchAllResults()
        setProgress('All scans completed!')
      }
      
    } catch (error) {
      console.error('Scan error:', error)
      setProgress(`Error: ${error.message}`)
    } finally {
      setScanning(false)
    }
  }

  const fetchAllResults = async () => {
    try {
      let allResults = []
      for (const target of selectedSubdomains) {
        const targetUrl = target.startsWith('http') ? target : `https://${target}`
        console.log('Fetching results for:', targetUrl)
        
        const response = await fetch(`http://localhost:8000/api/v1/content-discovery/target/${encodeURIComponent(targetUrl)}`)
        
        if (!response.ok) {
          console.error(`Failed to fetch results for ${targetUrl}:`, response.status)
          continue
        }
        
        const data = await response.json()
        console.log(`Got ${data?.length || 0} results for ${targetUrl}`)
        allResults = [...allResults, ...(data || [])]
      }
      
      console.log('Total results fetched:', allResults.length)
      setResults(allResults)
      
      if (allResults.length > 0) {
        setProgress(`Completed! Found ${allResults.length} URLs`)
      }
    } catch (error) {
      console.error('Error fetching results:', error)
    }
  }

  const selectedCount = Object.values(toolConfig).filter(Boolean).length

  const filteredResults = results.filter(item => {
    if (searchTerm && !item.discovered_url?.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (filterType !== 'all') {
      if (filterType === 'interesting' && !item.is_interesting) return false
      if (filterType === 'api' && !item.discovered_url?.includes('/api/')) return false
      if (filterType === 'param' && !item.discovered_url?.includes('?')) return false
      if (filterType === 'js' && !item.discovered_url?.endsWith('.js')) return false
    }
    if (filterStatus !== 'all') {
      if (filterStatus === '2xx' && !item.status_code?.toString().startsWith('2')) return false
      if (filterStatus === '3xx' && !item.status_code?.toString().startsWith('3')) return false
      if (filterStatus === '4xx' && !item.status_code?.toString().startsWith('4')) return false
      if (filterStatus === '5xx' && !item.status_code?.toString().startsWith('5')) return false
    }
    return true
  })

  const stats = {
    total: results.length,
    interesting: results.filter(r => r.is_interesting).length,
    apis: results.filter(r => r.discovered_url?.includes('/api/')).length,
    params: results.filter(r => r.discovered_url?.includes('?')).length,
    js_files: results.filter(r => r.discovered_url?.endsWith('.js')).length,
    status_2xx: results.filter(r => r.status_code?.toString().startsWith('2')).length
  }

  const exportResults = () => {
    const csv = filteredResults.map(r => 
      `${r.discovered_url},${r.status_code || 'N/A'},${r.method || 'GET'},${r.is_interesting ? 'YES' : 'NO'},${r.tool_name || ''}`
    ).join('\n')
    const blob = new Blob([`URL,Status,Method,Interesting,Tool\n${csv}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content_discovery_${new Date().toISOString()}.csv`
    a.click()
  }

  const copyToClipboard = () => {
    const urls = filteredResults.map(r => r.discovered_url).join('\n')
    navigator.clipboard.writeText(urls)
    alert('Copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-6 space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-2">
            <Search className="text-blue-400" size={28} />
            Content Discovery
          </h1>
          <p className="text-sm text-gray-400">
            Multi-tool URL discovery • Fuzzing • Crawling • Passive recon
          </p>
        </div>
        
        {results.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const activeUrls = filteredResults.filter(r => r.status_code?.toString().startsWith('2'))
                const urls = activeUrls.map(r => r.discovered_url).join('\n')
                navigator.clipboard.writeText(urls)
                alert(`Copied ${activeUrls.length} active URLs to clipboard!`)
              }}
              className="px-4 py-2 bg-[#151b2e] border border-[#1e2943] rounded-lg text-white hover:border-blue-500 transition-colors flex items-center gap-2 text-sm"
            >
              <Copy size={16} />
              <span>Copy Active ({filteredResults.filter(r => r.status_code?.toString().startsWith('2')).length})</span>
            </button>
            <button
              onClick={exportResults}
              className="px-4 py-2 bg-[#151b2e] border border-[#1e2943] rounded-lg text-white hover:border-blue-500 transition-colors flex items-center gap-2 text-sm"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                if (confirm('Clear all results?')) {
                  setResults([])
                  setScanResults(null)
                  setProgress('')
                }
              }}
              className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2 text-sm"
            >
              <XCircle size={16} />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>
      {/* Domain Dropdown */}
      <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Select Domain
        </label>
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="w-full px-4 py-3 bg-[#0a0e1a] border border-[#1e2943] rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">Choose a domain...</option>
          {availableDomains.map(domain => (
            <option key={domain} value={domain}>{domain}</option>
          ))}
        </select>
      </div>

      {/* Target Selection */}
      <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-gray-300">
            Select Targets ({selectedSubdomains.length} selected)
          </div>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        {subdomains.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
            {subdomains.map((sub) => (
              <button
                key={sub.id}
                onClick={() => toggleSubdomain(sub.full_domain)}
                disabled={scanning}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                  selectedSubdomains.includes(sub.full_domain)
                    ? 'bg-blue-500/10 border-blue-500 text-white'
                    : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  selectedSubdomains.includes(sub.full_domain) ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                }`}>
                  {selectedSubdomains.includes(sub.full_domain) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm truncate">{sub.full_domain}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Select a domain to load subdomains
          </div>
        )}

        {/* Custom Target Input */}
        <div className="mt-4 pt-4 border-t border-[#1e2943]">
          <label className="block text-xs text-gray-400 mb-2">
            Add custom target (IP or domain)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customTarget}
              onChange={(e) => setCustomTarget(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomTarget()}
              placeholder="https://example.com or 192.168.1.1"
              className="flex-1 px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={addCustomTarget}
              className="px-4 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white hover:border-blue-500 transition-colors text-sm"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Discovery Tools */}
      <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-6">
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-300 mb-2">
            Discovery Tools ({selectedCount} selected)
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Fuzzing Tools */}
          <div className="col-span-full mt-2 mb-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fuzzing Tools</div>
          </div>
          
          {/* FFUF */}
          <button
            onClick={() => toggleTool('use_ffuf')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_ffuf
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_ffuf ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_ffuf && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>FFUF</span>
          </button>

          {/* Feroxbuster */}
          <button
            onClick={() => toggleTool('use_feroxbuster')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_feroxbuster
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_feroxbuster ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_feroxbuster && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>Feroxbuster</span>
          </button>

          {/* Passive Discovery */}
          <div className="col-span-full mt-4 mb-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Passive Discovery</div>
          </div>

          {/* Waymore */}
          <button
            onClick={() => toggleTool('use_waymore')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_waymore
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_waymore ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_waymore && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>Waymore</span>
          </button>

          {/* GAU */}
          <button
            onClick={() => toggleTool('use_gau')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_gau
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_gau ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_gau && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>GAU</span>
          </button>

          {/* Active Crawling */}
          <div className="col-span-full mt-4 mb-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Crawling</div>
          </div>

          {/* Katana */}
          <button
            onClick={() => toggleTool('use_katana')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_katana
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_katana ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_katana && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>Katana</span>
          </button>

          {/* GoSpider */}
          <button
            onClick={() => toggleTool('use_gospider')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_gospider
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_gospider ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_gospider && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>GoSpider</span>
          </button>

          {/* Specialized Tools */}
          <div className="col-span-full mt-4 mb-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Specialized Tools</div>
          </div>

          {/* LinkFinder */}
          <button
            onClick={() => toggleTool('use_linkfinder')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_linkfinder
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_linkfinder ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_linkfinder && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>LinkFinder</span>
          </button>

          {/* Arjun */}
          <button
            onClick={() => toggleTool('use_arjun')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_arjun
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_arjun ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_arjun && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>Arjun</span>
          </button>

          {/* Unfurl */}
          <button
            onClick={() => toggleTool('use_unfurl')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_unfurl
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_unfurl ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_unfurl && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>Unfurl</span>
          </button>

          {/* URO */}
          <button
            onClick={() => toggleTool('use_uro')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_uro
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_uro ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_uro && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>URO</span>
          </button>

          {/* Nuclei */}
          <button
            onClick={() => toggleTool('use_nuclei')}
            disabled={scanning}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              toolConfig.use_nuclei
                ? 'bg-blue-500/10 border-blue-500 text-white'
                : 'bg-[#0a0e1a] border-[#1e2943] text-gray-400 hover:border-gray-600'
            }`}
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              toolConfig.use_nuclei ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
            }`}>
              {toolConfig.use_nuclei && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span>Nuclei</span>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-yellow-400">
          <span>💡</span>
          <span>Tip: Enable multiple tools for better coverage</span>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-300"
        >
          <span>Advanced Options</span>
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Threads</label>
              <input
                type="number"
                value={advancedOptions.threads}
                onChange={(e) => setAdvancedOptions({...advancedOptions, threads: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm focus:outline-none focus:border-blue-500"
                min="1"
                max="50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Timeout (s)</label>
              <input
                type="number"
                value={advancedOptions.timeout}
                onChange={(e) => setAdvancedOptions({...advancedOptions, timeout: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm focus:outline-none focus:border-blue-500"
                min="60"
                max="3600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rate Limit</label>
              <input
                type="number"
                value={advancedOptions.rate_limit}
                onChange={(e) => setAdvancedOptions({...advancedOptions, rate_limit: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm focus:outline-none focus:border-blue-500"
                min="1"
                max="500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Crawl Depth</label>
              <input
                type="number"
                value={advancedOptions.crawl_depth}
                onChange={(e) => setAdvancedOptions({...advancedOptions, crawl_depth: parseInt(e.target.value)})}
                className="w-full px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm focus:outline-none focus:border-blue-500"
                min="1"
                max="10"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Wordlist</label>
              <input
                type="text"
                value={advancedOptions.wordlist}
                onChange={(e) => setAdvancedOptions({...advancedOptions, wordlist: e.target.value})}
                className="w-full px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Start Scan Button */}
      <button
        onClick={startScan}
        disabled={scanning || selectedSubdomains.length === 0 || selectedCount === 0}
        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white font-semibold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
      >
        {scanning ? (
          <>
            <Loader className="animate-spin" size={20} />
            Scanning...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
            Start Content Discovery
          </>
        )}
      </button>

      {/* Progress */}
      {progress && (
        <div className={`p-4 rounded-lg border ${
          progress.includes('Error') 
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {progress.includes('Error') ? <XCircle size={16} /> : scanning ? <Loader className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              <span>{progress}</span>
            </div>
            
            {!scanning && progress.includes('completed') && results.length === 0 && (
              <button
                onClick={fetchAllResults}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={14} />
                Refresh Results
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completion Summary */}
      {!scanning && results.length > 0 && (
        <div className="bg-[#1e3a4a] border border-[#2a5568] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle size={24} className="text-green-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Discovery Completed! 🎉</h3>
              <p className="text-sm text-gray-400">
                Successfully discovered {stats.total} URLs from {selectedSubdomains.length} target(s)
              </p>
            </div>
          </div>
          <p className="text-xs text-yellow-400 flex items-center gap-1">
            <span>💡</span>
            <span>Export your results below or view detailed analysis in the table</span>
          </p>
        </div>
      )}

      {/* Export Results Section */}
      {!scanning && results.length > 0 && (
        <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Download size={20} className="text-blue-400" />
            <div>
              <h3 className="text-base font-semibold text-white">Export Your Results</h3>
              <p className="text-xs text-gray-400">
                Export a simple list of all discovered URLs with their status. Use "Copy" to get just the URLs, or "Export CSV" for the complete list.
              </p>
            </div>
          </div>

          {/* Export Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#0a0e1a] border border-[#1e2943] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">{stats.status_2xx}</div>
              <div className="text-xs text-gray-400">Success (2xx)</div>
            </div>
            <div className="bg-[#0a0e1a] border border-[#1e2943] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-400 mb-1">{stats.interesting}</div>
              <div className="text-xs text-gray-400">Interesting</div>
            </div>
            <div className="bg-[#0a0e1a] border border-[#1e2943] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">{stats.apis}</div>
              <div className="text-xs text-gray-400">API Endpoints</div>
            </div>
            <div className="bg-[#0a0e1a] border border-[#1e2943] rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-400 mb-1">{stats.js_files}</div>
              <div className="text-xs text-gray-400">JavaScript</div>
            </div>
          </div>

          {/* CSV Export Info */}
          <div className="bg-[#0a0e1a] border border-[#1e2943] rounded-lg p-3 mb-4">
            <div className="text-xs font-semibold text-gray-400 mb-1">CSV Export Contains:</div>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-0.5 bg-[#151b2e] border border-[#1e2943] rounded text-xs text-gray-300">URL</span>
              <span className="px-2 py-0.5 bg-[#151b2e] border border-[#1e2943] rounded text-xs text-gray-300">Status</span>
              <span className="px-2 py-0.5 bg-[#151b2e] border border-[#1e2943] rounded text-xs text-gray-300">Method</span>
              <span className="px-2 py-0.5 bg-[#151b2e] border border-[#1e2943] rounded text-xs text-gray-300">Type</span>
              <span className="px-2 py-0.5 bg-[#151b2e] border border-[#1e2943] rounded text-xs text-gray-300">Tool</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Simple format for easy integration with other tools</p>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-3">
            <button
              onClick={copyToClipboard}
              className="flex-1 px-4 py-3 bg-[#0a0e1a] border border-[#1e2943] rounded-lg text-white hover:border-blue-500 transition-colors flex items-center justify-center gap-2"
            >
              <Copy size={16} />
              <span>Copy URLs</span>
            </button>
            <button
              onClick={exportResults}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400 mb-1">{stats.total}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400 mb-1">{stats.interesting}</div>
              <div className="text-xs text-gray-400">Interesting</div>
            </div>
            <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-400 mb-1">{stats.apis}</div>
              <div className="text-xs text-gray-400">APIs</div>
            </div>
            <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-4">
              <div className="text-2xl font-bold text-cyan-400 mb-1">{stats.params}</div>
              <div className="text-xs text-gray-400">Params</div>
            </div>
            <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400 mb-1">{stats.js_files}</div>
              <div className="text-xs text-gray-400">JS Files</div>
            </div>
            <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400 mb-1">{stats.status_2xx}</div>
              <div className="text-xs text-gray-400">2xx</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="flex-1 min-w-[200px] px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="interesting">Interesting</option>
                <option value="api">APIs</option>
                <option value="param">Params</option>
                <option value="js">JS Files</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="2xx">2xx</option>
                <option value="3xx">3xx</option>
                <option value="4xx">4xx</option>
                <option value="5xx">5xx</option>
              </select>
              <button onClick={copyToClipboard} className="px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white hover:border-blue-500 transition-colors">
                <Copy size={16} />
              </button>
              <button onClick={exportResults} className="px-3 py-2 bg-[#0a0e1a] border border-[#1e2943] rounded text-white hover:border-blue-500 transition-colors">
                <Download size={16} />
              </button>
              <span className="text-xs text-gray-400">{filteredResults.length} / {results.length}</span>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-[#151b2e] border border-[#1e2943] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#0a0e1a] border-b border-[#1e2943]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Tool</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2943]">
                {filteredResults.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#0a0e1a] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.is_interesting && <AlertCircle size={14} className="text-red-400" />}
                        <span className="text-sm text-white font-mono truncate max-w-md">{item.discovered_url}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.status_code?.toString().startsWith('2') ? 'bg-green-500/20 text-green-400' :
                        item.status_code?.toString().startsWith('3') ? 'bg-blue-500/20 text-blue-400' :
                        item.status_code?.toString().startsWith('4') ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {item.status_code || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{item.tool_name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {item.discovered_url?.includes('/api/') && <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">API</span>}
                        {item.discovered_url?.includes('?') && <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs">PARAM</span>}
                        {item.discovered_url?.endsWith('.js') && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">JS</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={item.discovered_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                        <ExternalLink size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default ContentDiscovery
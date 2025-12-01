import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Loader,
  Download,
  RefreshCw,
  Eye,
  Zap,
  Bug,
  Lock,
  FileWarning,
  Database,
  Key,
  Globe,
  ChevronDown,
  ChevronUp,
  Search,
  Target,
  Clock,
  Square
} from 'lucide-react'
import { validateTarget, quickValidateTarget } from '../../api/client'

// Shared storage key - MUST match Dashboard
export const VALIDATION_STORAGE_KEY = 'validation_results'

const STORAGE_KEYS = {
  VALIDATION_RESULTS: VALIDATION_STORAGE_KEY,
  SUBDOMAIN_RESULTS: 'subdomain_scanner_last_domain',
  LIVE_HOSTS_RESULTS: 'live_hosts_results',
}

// Vulnerability type icons and colors
const VULN_CONFIG = {
  default_credentials: { icon: Key, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  sqli_auth_bypass: { icon: Database, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  sql_injection: { icon: Database, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  reflected_xss: { icon: Bug, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  git_exposure: { icon: FileWarning, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  env_file: { icon: FileWarning, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  database_backup: { icon: Database, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  config_file: { icon: FileWarning, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  phpinfo: { icon: FileWarning, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  s3_takeover: { icon: Globe, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  heroku_takeover: { icon: Globe, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  clickjacking: { icon: Eye, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
}

export default function ValidationResults() {
  const navigate = useNavigate()
  const [selectedDomain] = useState(() => localStorage.getItem(STORAGE_KEYS.SUBDOMAIN_RESULTS) || '')
  
  const [validationResults, setValidationResults] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VALIDATION_RESULTS)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  
  const [validatingTargets, setValidatingTargets] = useState(new Set())
  const [isBatchValidating, setIsBatchValidating] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [shouldStopBatch, setShouldStopBatch] = useState(false)
  const [filters, setFilters] = useState({ search: '', severity: 'all', hasVulns: false })
  const [expandedTargets, setExpandedTargets] = useState(new Set())
  
  const liveHostsData = useMemo(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LIVE_HOSTS_RESULTS)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? parsed.filter(h => h.is_active) : []
    } catch { return [] }
  }, [])

  // Listen for storage changes from other components (Dashboard)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEYS.VALIDATION_RESULTS) {
        try {
          const newData = e.newValue ? JSON.parse(e.newValue) : {}
          setValidationResults(newData)
        } catch (error) { console.error('Error parsing storage event:', error) }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Poll for changes (same-tab updates from Dashboard)
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.VALIDATION_RESULTS)
        const parsed = saved ? JSON.parse(saved) : {}
        if (Object.keys(parsed).length !== Object.keys(validationResults).length) {
          setValidationResults(parsed)
        }
      } catch {}
    }, 1000)
    return () => clearInterval(interval)
  }, [validationResults])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VALIDATION_RESULTS, JSON.stringify(validationResults))
  }, [validationResults])

  const handleValidate = async (target, quick = false) => {
    const targetUrl = target.startsWith('http') ? target : `https://${target}`
    setValidatingTargets(prev => new Set([...prev, target]))
    
    try {
      const result = quick ? await quickValidateTarget(targetUrl) : await validateTarget(targetUrl)
      const newResult = { ...result, target, validated_at: new Date().toISOString(), validation_type: quick ? 'quick' : 'full' }
      
      setValidationResults(prev => {
        const updated = { ...prev, [target]: newResult }
        localStorage.setItem(STORAGE_KEYS.VALIDATION_RESULTS, JSON.stringify(updated))
        return updated
      })
      return newResult
    } catch (error) {
      const errorResult = { target, error: error.message || 'Validation failed', validated_at: new Date().toISOString(), validation_type: quick ? 'quick' : 'full' }
      setValidationResults(prev => {
        const updated = { ...prev, [target]: errorResult }
        localStorage.setItem(STORAGE_KEYS.VALIDATION_RESULTS, JSON.stringify(updated))
        return updated
      })
      return errorResult
    } finally {
      setValidatingTargets(prev => { const newSet = new Set(prev); newSet.delete(target); return newSet })
    }
  }

  const handleBatchValidate = async (quick = true) => {
    const pendingTargets = liveHostsData
      .map(h => h.subdomain || h.full_domain)
      .filter(target => !validationResults[target])
    
    if (pendingTargets.length === 0) { alert('All active hosts have already been validated!'); return }
    
    setIsBatchValidating(true)
    setShouldStopBatch(false)
    setBatchProgress({ current: 0, total: pendingTargets.length })
    
    for (let i = 0; i < pendingTargets.length; i++) {
      if (shouldStopBatch) break
      setBatchProgress({ current: i + 1, total: pendingTargets.length })
      await handleValidate(pendingTargets[i], quick)
      if (i < pendingTargets.length - 1) await new Promise(resolve => setTimeout(resolve, quick ? 1500 : 3000))
    }
    
    setIsBatchValidating(false)
    setBatchProgress({ current: 0, total: 0 })
    setShouldStopBatch(false)
  }

  const toggleExpanded = (target) => {
    setExpandedTargets(prev => {
      const newSet = new Set(prev)
      newSet.has(target) ? newSet.delete(target) : newSet.add(target)
      return newSet
    })
  }

  const validatedTargets = useMemo(() => {
    return Object.entries(validationResults).map(([target, result]) => ({
      target, ...result,
      has_vulnerabilities: (result.total_vulns || 0) > 0 || (result.http_validation?.total_vulns || 0) > 0 || (result.browser_validation?.total_issues || 0) > 0,
      vuln_count: (result.total_vulns || 0) + (result.http_validation?.total_vulns || 0) + (result.browser_validation?.total_issues || 0),
      critical_count: (result.critical_vulns || 0) + (result.http_validation?.critical_vulns || 0)
    }))
  }, [validationResults])

  const filteredResults = useMemo(() => {
    return validatedTargets.filter(item => {
      if (filters.search && !item.target.toLowerCase().includes(filters.search.toLowerCase())) return false
      if (filters.hasVulns && !item.has_vulnerabilities) return false
      if (filters.severity === 'critical' && item.critical_count === 0) return false
      if (filters.severity === 'high' && item.vuln_count === 0) return false
      return true
    }).sort((a, b) => b.critical_count !== a.critical_count ? b.critical_count - a.critical_count : b.vuln_count - a.vuln_count)
  }, [validatedTargets, filters])

  const stats = useMemo(() => ({
    total_validated: validatedTargets.length,
    with_vulns: validatedTargets.filter(t => t.has_vulnerabilities).length,
    total_vulns: validatedTargets.reduce((sum, t) => sum + t.vuln_count, 0),
    critical_vulns: validatedTargets.reduce((sum, t) => sum + t.critical_count, 0),
    pending: liveHostsData.filter(h => !validationResults[h.subdomain || h.full_domain]).length
  }), [validatedTargets, liveHostsData, validationResults])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ domain: selectedDomain, exported_at: new Date().toISOString(), summary: stats, results: filteredResults }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `validation-results-${selectedDomain}-${Date.now()}.json`; a.click()
  }

  const handleClear = () => { if (confirm('Clear all validation results?')) { setValidationResults({}); localStorage.removeItem(STORAGE_KEYS.VALIDATION_RESULTS) } }

  const getVulnerabilities = (result) => {
    const vulns = []
    if (result.proofs) vulns.push(...result.proofs)
    if (result.http_validation?.proofs) vulns.push(...result.http_validation.proofs)
    if (result.vulns) vulns.push(...result.vulns)
    if (result.browser_validation?.sinks) result.browser_validation.sinks.forEach(sink => vulns.push({ type: sink.sink_type, severity: sink.severity, url: sink.url, evidence: sink.evidence }))
    if (result.browser_validation?.clickjacking) vulns.push(result.browser_validation.clickjacking)
    return vulns
  }

  const getSeverityColor = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/30'
      case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/30'
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30'
    }
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-cyber-purple" />
            Validation Results
          </h1>
          <p className="text-gray-400 mt-1">
            Security validation findings for <span className="text-emerald-400 font-medium">{selectedDomain || 'all targets'}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {!isBatchValidating ? (
            <>
              <button onClick={() => handleBatchValidate(true)} disabled={stats.pending === 0}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-500/80 transition-colors disabled:opacity-50 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Quick Validate All ({stats.pending})
              </button>
              <button onClick={() => handleBatchValidate(false)} disabled={stats.pending === 0}
                className="px-4 py-2 bg-cyber-purple text-white rounded-lg hover:bg-cyber-purple/80 transition-colors disabled:opacity-50 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Full Validate All ({stats.pending})
              </button>
            </>
          ) : (
            <button onClick={() => setShouldStopBatch(true)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2">
              <Square className="w-4 h-4" /> Stop ({batchProgress.current}/{batchProgress.total})
            </button>
          )}
          <button onClick={handleExport} className="p-2 bg-[#0a0a0a] text-gray-400 rounded-lg hover:text-white hover:bg-[#111111]"><Download className="w-5 h-5" /></button>
          <button onClick={handleClear} className="p-2 bg-[#0a0a0a] text-gray-400 rounded-lg hover:text-red-400 hover:bg-[#111111]"><XCircle className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Batch Progress */}
      {isBatchValidating && (
        <div className="bg-[#111111] border border-cyber-blue/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-medium flex items-center gap-2">
              <Loader className="w-4 h-4 animate-spin text-emerald-400" /> Batch Validation in Progress
            </span>
            <span className="text-emerald-400 font-medium">{batchProgress.current} / {batchProgress.total}</span>
          </div>
          <div className="w-full bg-[#0a0a0a] rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-4">
          <div className="text-2xl font-bold text-white">{stats.total_validated}</div>
          <div className="text-sm text-gray-400">Targets Validated</div>
        </div>
        <div className="bg-[#111111] border border-red-500/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-500">{stats.with_vulns}</div>
          <div className="text-sm text-gray-400">With Vulnerabilities</div>
        </div>
        <div className="bg-[#111111] border border-red-500/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-500">{stats.critical_vulns}</div>
          <div className="text-sm text-gray-400">Critical Issues</div>
        </div>
        <div className="bg-[#111111] border border-orange-500/30 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-500">{stats.total_vulns}</div>
          <div className="text-sm text-gray-400">Total Vulnerabilities</div>
        </div>
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-400">{stats.pending}</div>
          <div className="text-sm text-gray-400">Pending Validation</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" value={filters.search} onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search targets..." className="w-full bg-[#0a0a0a] text-white pl-10 pr-4 py-2 rounded-lg border border-[#1f1f1f] focus:border-cyber-blue focus:outline-none" />
          </div>
          <select value={filters.severity} onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
            className="bg-[#0a0a0a] text-white px-4 py-2 rounded-lg border border-[#1f1f1f]">
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="high">High & Above</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={filters.hasVulns} onChange={(e) => setFilters(prev => ({ ...prev, hasVulns: e.target.checked }))}
              className="form-checkbox bg-[#0a0a0a] border-[#1f1f1f] text-emerald-400 rounded" />
            Vulnerabilities Only
          </label>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-12 text-center">
            <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Validation Results Yet</h3>
            <p className="text-gray-400 mb-6">Run validation scans from the Dashboard or use the buttons above</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => navigate('/live-hosts')} className="px-6 py-3 bg-[#0a0a0a] text-white rounded-lg hover:bg-[#1a1a1a]">Go to Live Hosts</button>
              <button onClick={() => handleBatchValidate(true)} disabled={stats.pending === 0}
                className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-500/80 disabled:opacity-50">Start Quick Validation</button>
            </div>
          </div>
        ) : (
          filteredResults.map((result) => {
            const isExpanded = expandedTargets.has(result.target)
            const vulns = getVulnerabilities(result)
            const VulnIcon = result.has_vulnerabilities ? AlertTriangle : CheckCircle
            
            return (
              <div key={result.target} className={`bg-[#111111] border rounded-xl overflow-hidden transition-colors ${result.has_vulnerabilities ? 'border-red-500/30 hover:border-red-500/50' : 'border-[#1f1f1f]'}`}>
                <div onClick={() => toggleExpanded(result.target)} className="p-4 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <VulnIcon className={`w-6 h-6 ${result.has_vulnerabilities ? 'text-red-500' : 'text-green-500'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <a href={`https://${result.target}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="text-white hover:text-emerald-400 font-medium">{result.target}</a>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                          <span className={`text-xs px-2 py-1 rounded border ${result.validation_type === 'full' ? 'bg-cyber-purple/10 text-cyber-purple border-cyber-purple/30' : 'bg-emerald-500/10 text-emerald-400 border-cyber-blue/30'}`}>
                            {result.validation_type === 'full' ? 'FULL' : 'QUICK'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{result.validated_at ? new Date(result.validated_at).toLocaleString() : 'Unknown'}</span>
                          {result.error && <span className="text-red-400">Error: {result.error}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {result.has_vulnerabilities && (
                        <div className="flex items-center gap-2">
                          {result.critical_count > 0 && <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-sm font-medium border border-red-500/30">{result.critical_count} Critical</span>}
                          <span className="px-3 py-1 bg-orange-500/10 text-orange-500 rounded-full text-sm font-medium border border-orange-500/30">{result.vuln_count} Total</span>
                        </div>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleValidate(result.target, false) }} disabled={validatingTargets.has(result.target)}
                        className="p-2 bg-cyber-purple/20 text-cyber-purple rounded hover:bg-cyber-purple/30 disabled:opacity-50">
                        {validatingTargets.has(result.target) ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#1f1f1f] p-4 bg-[#0a0a0a]">
                    {vulns.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p className="text-green-400 font-medium">No vulnerabilities detected</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-400">Vulnerability Details ({vulns.length})</h4>
                        {vulns.map((vuln, idx) => {
                          const config = VULN_CONFIG[vuln.type] || VULN_CONFIG[vuln.vuln_type] || { icon: Bug, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' }
                          const IconComponent = config.icon
                          return (
                            <div key={idx} className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
                              <div className="flex items-start gap-3">
                                <IconComponent className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-medium ${config.color}`}>{(vuln.type || vuln.vuln_type || 'Unknown').replace(/_/g, ' ').toUpperCase()}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded border ${getSeverityColor(vuln.severity)}`}>{vuln.severity || 'UNKNOWN'}</span>
                                  </div>
                                  {vuln.evidence && <p className="text-sm text-gray-300 mb-2">{vuln.evidence}</p>}
                                  {vuln.url && <div className="text-xs text-gray-400 mb-2"><span className="text-gray-500">URL:</span> <a href={vuln.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">{vuln.url}</a></div>}
                                  {vuln.payload && <div className="text-xs mb-2"><span className="text-gray-500">Payload:</span> <code className="bg-[#111111] px-2 py-0.5 rounded text-yellow-400">{vuln.payload}</code></div>}
                                  {vuln.remediation && <div className="text-xs text-gray-400 mt-2 p-2 bg-[#111111] rounded"><span className="text-gray-500">Remediation:</span> {vuln.remediation}</div>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <details className="mt-4">
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">View Raw Result</summary>
                      <pre className="mt-2 p-3 bg-[#111111] rounded text-xs text-gray-400 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pending Targets */}
      {stats.pending > 0 && (
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" /> Active Hosts Pending Validation ({stats.pending})
          </h3>
          <div className="flex flex-wrap gap-2">
            {liveHostsData.filter(h => !validationResults[h.subdomain || h.full_domain]).slice(0, 20).map((host) => {
              const target = host.subdomain || host.full_domain
              const isValidating = validatingTargets.has(target)
              return (
                <div key={target} className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
                  <span className="text-sm text-white font-mono">{target}</span>
                  <button onClick={() => handleValidate(target, true)} disabled={isValidating || isBatchValidating} className="p-1 text-emerald-400 hover:text-emerald-400/80 disabled:opacity-50">
                    {isValidating ? <Loader className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleValidate(target, false)} disabled={isValidating || isBatchValidating} className="p-1 text-cyber-purple hover:text-cyber-purple/80 disabled:opacity-50">
                    {isValidating ? <Loader className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  </button>
                </div>
              )
            })}
          </div>
          {stats.pending > 20 && <p className="text-sm text-gray-400 mt-3">+ {stats.pending - 20} more targets</p>}
        </div>
      )}
    </div>
  )
}
/**
 * AutoScan - Fully Automated Reconnaissance
 * 
 * UI for the background ScanManager service.
 * Scans continue running even when navigating away.
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap,
  Globe,
  Activity,
  Lock,
  Search,
  Shield,
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Settings,
  Loader2,
  Trash2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import scanManager, { SCAN_PHASES } from '../../services/ScanManager'

export default function AutoScan() {
  // Subscribe to scan manager state
  const [scanState, setScanState] = useState(scanManager.getState())
  const [expandedPhases, setExpandedPhases] = useState(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [localSettings, setLocalSettings] = useState(scanState.settings)
  const [targetInput, setTargetInput] = useState(scanState.targetDomain || '')
  
  const logsEndRef = useRef(null)

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = scanManager.subscribe((state) => {
      setScanState(state)
    })
    return unsubscribe
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [scanState.logs])

  // Sync target input when state changes
  useEffect(() => {
    if (scanState.targetDomain && !targetInput) {
      setTargetInput(scanState.targetDomain)
    }
  }, [scanState.targetDomain])

  // Control functions
  const startScan = () => {
    if (!targetInput.trim()) return
    scanManager.startScan(targetInput.trim(), localSettings)
  }

  const pauseScan = () => scanManager.pause()
  const resumeScan = () => scanManager.resume()
  const cancelScan = () => scanManager.cancel()
  const clearScan = () => {
    scanManager.clear()
    setTargetInput('')
  }

  // Derived state
  const isRunning = scanState.status === 'running'
  const isPaused = scanState.status === 'paused'
  const isComplete = scanState.status === 'completed'
  const hasData = scanState.logs.length > 0 || scanState.completedPhases.length > 0

  // Get phase status icon
  const getPhaseIcon = (phaseId) => {
    if (scanState.completedPhases.includes(phaseId)) {
      return <CheckCircle size={18} className="text-green-400" />
    }
    if (scanState.failedPhases.includes(phaseId)) {
      return <XCircle size={18} className="text-red-400" />
    }
    if (scanState.currentPhase === phaseId) {
      return <Loader2 size={18} className="text-emerald-400 animate-spin" />
    }
    return <Clock size={18} className="text-gray-600" />
  }

  // Toggle phase expansion
  const togglePhase = (phaseId) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  // Status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-emerald-500/20 text-emerald-400'
      case 'paused': return 'bg-yellow-500/20 text-yellow-400'
      case 'completed': return 'bg-green-500/20 text-green-400'
      case 'failed': return 'bg-red-500/20 text-red-400'
      case 'cancelled': return 'bg-gray-500/20 text-gray-400'
      case 'interrupted': return 'bg-orange-500/20 text-orange-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  // Calculate elapsed time
  const getElapsedTime = () => {
    if (!scanState.startedAt) return null
    const start = new Date(scanState.startedAt)
    const end = scanState.completedAt ? new Date(scanState.completedAt) : new Date()
    const diff = Math.floor((end - start) / 1000)
    const mins = Math.floor(diff / 60)
    const secs = diff % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20">
              <Zap size={24} className="text-emerald-400" />
            </div>
            Auto Scan
            {scanState.status !== 'idle' && (
              <span className={`ml-2 text-xs px-2 py-1 rounded-full flex items-center gap-1 ${getStatusColor(scanState.status)}`}>
                {isRunning && <Loader2 size={10} className="animate-spin" />}
                {isPaused && <Pause size={10} />}
                {scanState.status.charAt(0).toUpperCase() + scanState.status.slice(1)}
                {getElapsedTime() && <span className="ml-1 opacity-70">({getElapsedTime()})</span>}
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1">
            Fully automated reconnaissance workflow
            {isRunning && <span className="text-emerald-400 ml-2">• Scan continues in background</span>}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasData && !isRunning && !isPaused && (
            <button
              onClick={clearScan}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111111] border border-[#1f1f1f] text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
            >
              <Trash2 size={16} />
              Clear
            </button>
          )}
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg border transition-colors ${
              showSettings 
                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                : 'bg-[#111111] border-[#1f1f1f] text-gray-400 hover:text-white'
            }`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Target Input & Controls */}
      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">Target Domain</label>
            <input
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="example.com"
              disabled={isRunning || isPaused}
              className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-4 py-3 text-white text-lg font-mono placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none disabled:opacity-50"
            />
          </div>
          
          <div className="flex items-center gap-2 pt-7">
            {!isRunning && !isPaused ? (
              <button
                onClick={startScan}
                disabled={!targetInput.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                <Play size={18} />
                Start Scan
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    onClick={resumeScan}
                    className="flex items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <Play size={18} />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={pauseScan}
                    className="flex items-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg font-medium transition-colors"
                  >
                    <Pause size={18} />
                    Pause
                  </button>
                )}
                <button
                  onClick={cancelScan}
                  className="flex items-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Square size={18} />
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-6 pt-6 border-t border-[#1f1f1f]">
            <h3 className="text-sm font-medium text-white mb-4">Scan Settings</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Port Scan Type</label>
                <select
                  value={localSettings.portScanType}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, portScanType: e.target.value }))}
                  disabled={isRunning}
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
                >
                  <option value="top-100">Top 100 Ports</option>
                  <option value="top-1000">Top 1000 Ports</option>
                  <option value="full">Full Scan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Concurrency</label>
                <input
                  type="number"
                  value={localSettings.maxConcurrency}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, maxConcurrency: parseInt(e.target.value) || 10 }))}
                  disabled={isRunning}
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Timeout (sec)</label>
                <input
                  type="number"
                  value={localSettings.timeout}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, timeout: parseInt(e.target.value) || 30 }))}
                  disabled={isRunning}
                  className="w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-white text-sm disabled:opacity-50"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.skipSubdomains}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, skipSubdomains: e.target.checked }))}
                    disabled={isRunning}
                    className="rounded bg-[#0a0a0a] border-[#1f1f1f]"
                  />
                  <span className="text-sm text-gray-400">Skip subdomain scan</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scan Phases */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Scan Phases</h3>
          
          {SCAN_PHASES.map((phase) => {
            const progress = scanState.phaseProgress[phase.id]?.progress || 0
            const isActive = scanState.currentPhase === phase.id
            const isCompleted = scanState.completedPhases.includes(phase.id)
            const isFailed = scanState.failedPhases.includes(phase.id)
            const isExpanded = expandedPhases.has(phase.id)
            const results = scanState.results[phase.id] || []
            
            return (
              <div
                key={phase.id}
                className={`bg-[#111111] rounded-xl border transition-colors ${
                  isActive 
                    ? 'border-emerald-500/50' 
                    : isCompleted 
                      ? 'border-green-500/30' 
                      : isFailed 
                        ? 'border-red-500/30' 
                        : 'border-[#1f1f1f]'
                }`}
              >
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => togglePhase(phase.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8">
                      {getPhaseIcon(phase.id)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{phase.name}</span>
                        {isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            {progress}%
                          </span>
                        )}
                        {isCompleted && results.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                            {results.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {results.length > 0 && (
                      isExpanded ? (
                        <ChevronDown size={16} className="text-gray-500" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-500" />
                      )
                    )}
                  </div>
                  
                  {/* Progress bar */}
                  {(isActive || isCompleted || isFailed) && (
                    <div className="mt-3 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                
                {/* Expanded results */}
                {isExpanded && results.length > 0 && (
                  <div className="px-4 pb-4 border-t border-[#1f1f1f] mt-2 pt-3">
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {results.slice(0, 15).map((item, i) => (
                        <div key={i} className="text-xs text-gray-400 font-mono truncate">
                          {typeof item === 'string' ? item : item.subdomain || item.host || item.url || JSON.stringify(item).slice(0, 50)}
                        </div>
                      ))}
                      {results.length > 15 && (
                        <div className="text-xs text-gray-600">
                          +{results.length - 15} more...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Logs Panel */}
        <div className="lg:col-span-2 bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
          <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              Scan Logs
              {isRunning && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </h3>
            <span className="text-xs text-gray-500">{scanState.logs.length} entries</span>
          </div>
          
          <div className="h-[500px] overflow-y-auto p-4 font-mono text-sm bg-[#0a0a0a]">
            {scanState.logs.length === 0 ? (
              <div className="text-gray-600 text-center py-12">
                <Zap className="mx-auto mb-3 opacity-50" size={32} />
                Enter a domain and click "Start Scan" to begin
              </div>
            ) : (
              <div className="space-y-1">
                {scanState.logs.map((log, i) => {
                  const typeColors = {
                    info: 'text-gray-400',
                    success: 'text-green-400',
                    error: 'text-red-400',
                    warning: 'text-yellow-400'
                  }
                  return (
                    <div key={i} className={`${typeColors[log.type]} flex gap-2`}>
                      <span className="text-gray-600 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {log.phase && (
                        <span className="text-gray-600">[{log.phase}]</span>
                      )}
                      <span>{log.message}</span>
                    </div>
                  )
                })}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      {hasData && (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Results Summary</h3>
            {scanState.startedAt && (
              <span className="text-xs text-gray-500">
                Started: {new Date(scanState.startedAt).toLocaleString()}
                {scanState.completedAt && ` • Completed: ${new Date(scanState.completedAt).toLocaleString()}`}
              </span>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link to="/subdomain-scanner" className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f] hover:border-blue-500/30 transition-colors group">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={16} className="text-blue-400" />
                <span className="text-xs text-gray-500">Subdomains</span>
              </div>
              <div className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
                {scanState.results.subdomains.length}
              </div>
            </Link>
            
            <Link to="/live-hosts" className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f] hover:border-green-500/30 transition-colors group">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-green-400" />
                <span className="text-xs text-gray-500">Live Hosts</span>
              </div>
              <div className="text-2xl font-bold text-white group-hover:text-green-400 transition-colors">
                {scanState.results.liveHosts.length}
              </div>
            </Link>
            
            <Link to="/port-scanner" className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f] hover:border-pink-500/30 transition-colors group">
              <div className="flex items-center gap-2 mb-2">
                <Lock size={16} className="text-pink-400" />
                <span className="text-xs text-gray-500">Open Ports</span>
              </div>
              <div className="text-2xl font-bold text-white group-hover:text-pink-400 transition-colors">
                {scanState.results.ports.filter(p => p.state === 'open').length}
              </div>
            </Link>
            
            <Link to="/content-discovery" className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f] hover:border-orange-500/30 transition-colors group">
              <div className="flex items-center gap-2 mb-2">
                <Search size={16} className="text-orange-400" />
                <span className="text-xs text-gray-500">Content</span>
              </div>
              <div className="text-2xl font-bold text-white group-hover:text-orange-400 transition-colors">
                {scanState.results.content.length}
              </div>
            </Link>
            
            <Link to="/vuln-scanner" className="bg-[#0a0a0a] rounded-xl p-4 border border-[#1f1f1f] hover:border-red-500/30 transition-colors group">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} className="text-red-400" />
                <span className="text-xs text-gray-500">Vulnerabilities</span>
              </div>
              <div className="text-2xl font-bold text-white group-hover:text-red-400 transition-colors">
                {scanState.results.vulns.length}
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Interrupted Warning */}
      {scanState.status === 'interrupted' && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-orange-400 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-orange-400 font-medium">Scan was interrupted</p>
            <p className="text-orange-400/70 text-sm">The page was closed or refreshed while a scan was running. You can start a new scan or clear the results.</p>
          </div>
          <button
            onClick={() => {
              setTargetInput(scanState.targetDomain)
              scanManager.startScan(scanState.targetDomain, scanState.settings)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
          >
            <RefreshCw size={16} />
            Restart
          </button>
        </div>
      )}
    </div>
  )
}
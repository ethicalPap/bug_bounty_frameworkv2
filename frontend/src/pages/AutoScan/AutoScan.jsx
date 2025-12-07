/**
 * AutoScan - Fully Automated Reconnaissance
 * 
 * UI for the backend AutoScan service.
 * Scans run on the server and continue even when browser is closed.
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  RefreshCw,
  Server
} from 'lucide-react'
import {
  startAutoScan,
  getAutoScanStatus,
  pauseAutoScan,
  resumeAutoScan,
  cancelAutoScan,
  deleteAutoScanJob
} from '../../api/client'

// Scan phases configuration
const SCAN_PHASES = [
  {
    id: 'subdomains',
    name: 'Subdomain Enumeration',
    description: 'Discover all subdomains using multiple sources',
    icon: Globe,
    color: 'blue',
    estimatedTime: '2-5 min'
  },
  {
    id: 'live_hosts',
    name: 'Live Host Detection',
    description: 'Probe subdomains to find active HTTP hosts',
    icon: Activity,
    color: 'green',
    estimatedTime: '1-3 min'
  },
  {
    id: 'ports',
    name: 'Port Scanning',
    description: 'Scan for open ports on live hosts',
    icon: Lock,
    color: 'pink',
    estimatedTime: '3-10 min'
  },
  {
    id: 'content',
    name: 'Content Discovery',
    description: 'Find APIs, endpoints, directories, and JS files',
    icon: Search,
    color: 'orange',
    estimatedTime: '5-15 min'
  },
  {
    id: 'vulns',
    name: 'Vulnerability Scanning',
    description: 'Run Nuclei templates against discovered content',
    icon: Shield,
    color: 'red',
    estimatedTime: '5-20 min'
  }
]

export default function AutoScan() {
  const { workspaceId } = useParams()
  const queryClient = useQueryClient()
  
  const [targetInput, setTargetInput] = useState('')
  const [expandedPhases, setExpandedPhases] = useState(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const [localSettings, setLocalSettings] = useState({
    use_subfinder: true,
    use_amass: true,
    use_assetfinder: true,
    use_findomain: true,
    probe_concurrency: 50,
    port_range: 'top-100',
    content_tools: ['waymore', 'gau', 'katana'],
    vuln_severity: 'medium,high,critical'
  })
  
  const logsEndRef = useRef(null)

  // Fetch scan status from backend (polls every 2 seconds when running)
  const { data: scanData, isLoading, refetch } = useQuery({
    queryKey: ['autoscan-status', workspaceId],
    queryFn: () => getAutoScanStatus(workspaceId),
    refetchInterval: (data) => {
      // Poll more frequently when scan is running
      if (data?.status === 'running' || data?.status === 'queued') {
        return 2000
      }
      return false // Don't poll when idle/complete
    },
    enabled: !!workspaceId
  })

  const job = scanData?.job
  const currentStatus = scanData?.status || 'idle'
  const isRunning = currentStatus === 'running'
  const isPaused = currentStatus === 'paused'
  const isComplete = currentStatus === 'completed'
  const hasData = job && (job.logs?.length > 0 || job.completed_phases?.length > 0)

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [job?.logs])

  // Sync target input when job data loads
  useEffect(() => {
    if (job?.target_domain && !targetInput) {
      setTargetInput(job.target_domain)
    }
  }, [job?.target_domain])

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => startAutoScan(workspaceId, targetInput.trim(), localSettings),
    onSuccess: () => {
      queryClient.invalidateQueries(['autoscan-status', workspaceId])
    },
    onError: (error) => {
      alert(`Failed to start scan: ${error.message}`)
    }
  })

  const pauseMutation = useMutation({
    mutationFn: () => pauseAutoScan(job?.id),
    onSuccess: () => refetch()
  })

  const resumeMutation = useMutation({
    mutationFn: () => resumeAutoScan(job?.id),
    onSuccess: () => refetch()
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelAutoScan(job?.id),
    onSuccess: () => refetch()
  })

  const clearMutation = useMutation({
    mutationFn: () => deleteAutoScanJob(job?.id),
    onSuccess: () => {
      queryClient.invalidateQueries(['autoscan-status', workspaceId])
      setTargetInput('')
    }
  })

  // Control functions
  const startScan = () => {
    if (!targetInput.trim()) return
    startMutation.mutate()
  }

  const pauseScan = () => pauseMutation.mutate()
  const resumeScan = () => resumeMutation.mutate()
  const cancelScan = () => cancelMutation.mutate()
  const clearScan = () => {
    if (job?.id) {
      clearMutation.mutate()
    }
    setTargetInput('')
  }

  // Get phase status icon
  const getPhaseIcon = (phaseId) => {
    if ((job?.completed_phases || []).includes(phaseId)) {
      return <CheckCircle size={18} className="text-green-400" />
    }
    if ((job?.failed_phases || []).includes(phaseId)) {
      return <XCircle size={18} className="text-red-400" />
    }
    if (job?.current_phase === phaseId) {
      return <Loader2 size={18} className="text-emerald-400 animate-spin" />
    }
    return <Clock size={18} className="text-gray-600" />
  }

  // Toggle phase expansion
  const togglePhase = (phaseId) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phaseId)) {
        next.delete(phaseId)
      } else {
        next.add(phaseId)
      }
      return next
    })
  }

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'cancelled': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  // Format elapsed time
  const getElapsedTime = () => {
    if (!job?.started_at) return null
    const start = new Date(job.started_at)
    const end = job.completed_at ? new Date(job.completed_at) : new Date()
    const diff = Math.floor((end - start) / 1000)
    const mins = Math.floor(diff / 60)
    const secs = diff % 60
    return `${mins}m ${secs}s`
  }

  const statusDisplay = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-emerald-400" />
      </div>
    )
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
            {currentStatus !== 'idle' && (
              <span className={`ml-2 text-xs px-2 py-1 rounded-full flex items-center gap-1 border ${getStatusColor(currentStatus)}`}>
                {isRunning && <Loader2 size={10} className="animate-spin" />}
                {isPaused && <Pause size={10} />}
                {statusDisplay}
                {getElapsedTime() && <span className="ml-1 opacity-70">({getElapsedTime()})</span>}
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <Server size={14} />
            Scans run on the server - safe to close browser
            {isRunning && <span className="text-emerald-400">• Scan running in background</span>}
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
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111111] border border-[#1f1f1f] text-gray-400 hover:text-white hover:border-emerald-500/30 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111111] border transition-colors ${
              showSettings ? 'border-emerald-500/50 text-emerald-400' : 'border-[#1f1f1f] text-gray-400 hover:text-white'
            }`}
          >
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-4">Scan Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={localSettings.use_subfinder}
                onChange={e => setLocalSettings(s => ({ ...s, use_subfinder: e.target.checked }))}
                className="rounded"
              />
              Subfinder
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={localSettings.use_amass}
                onChange={e => setLocalSettings(s => ({ ...s, use_amass: e.target.checked }))}
                className="rounded"
              />
              Amass
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={localSettings.use_assetfinder}
                onChange={e => setLocalSettings(s => ({ ...s, use_assetfinder: e.target.checked }))}
                className="rounded"
              />
              Assetfinder
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={localSettings.use_findomain}
                onChange={e => setLocalSettings(s => ({ ...s, use_findomain: e.target.checked }))}
                className="rounded"
              />
              Findomain
            </label>
          </div>
        </div>
      )}

      {/* Target Input & Controls */}
      <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">Target Domain</label>
            <input
              type="text"
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              placeholder="example.com"
              disabled={isRunning || isPaused}
              className="w-full px-4 py-3 bg-[#111111] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
              onKeyPress={e => e.key === 'Enter' && !isRunning && startScan()}
            />
          </div>
          
          <div className="flex items-end gap-2">
            {!isRunning && !isPaused && (
              <button
                onClick={startScan}
                disabled={!targetInput.trim() || startMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-lg font-medium transition-colors"
              >
                {startMutation.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Play size={18} />
                )}
                Start Scan
              </button>
            )}
            
            {isRunning && (
              <>
                <button
                  onClick={pauseScan}
                  disabled={pauseMutation.isPending}
                  className="flex items-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Pause size={18} />
                  Pause
                </button>
                <button
                  onClick={cancelScan}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Square size={18} />
                  Stop
                </button>
              </>
            )}
            
            {isPaused && (
              <>
                <button
                  onClick={resumeScan}
                  disabled={resumeMutation.isPending}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Play size={18} />
                  Resume
                </button>
                <button
                  onClick={cancelScan}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Square size={18} />
                  Stop
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scan Phases */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Scan Phases</h2>
        
        {SCAN_PHASES.map((phase, index) => {
          const PhaseIcon = phase.icon
          const isExpanded = expandedPhases.has(phase.id)
          const progress = job?.phase_progress?.[phase.id] || 0
          const resultCount = job?.results?.[phase.id] || 0
          
          return (
            <div
              key={phase.id}
              className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-[#111111] transition-colors"
              >
                <div className={`p-2 rounded-lg bg-${phase.color}-500/10`}>
                  <PhaseIcon size={20} className={`text-${phase.color}-400`} />
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{phase.name}</span>
                    {resultCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        {resultCount} found
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{phase.description}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600">{phase.estimatedTime}</span>
                  {getPhaseIcon(phase.id)}
                  {isExpanded ? <ChevronDown size={16} className="text-gray-600" /> : <ChevronRight size={16} className="text-gray-600" />}
                </div>
              </button>
              
              {/* Progress bar */}
              {job?.current_phase === phase.id && (
                <div className="h-1 bg-[#111111]">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              
              {/* Expanded content */}
              {isExpanded && (
                <div className="p-4 border-t border-[#1f1f1f] bg-[#080808]">
                  <div className="text-sm text-gray-400">
                    {resultCount > 0 ? (
                      <p>Found {resultCount} {phase.id.replace('_', ' ')}</p>
                    ) : (
                      <p className="text-gray-600">No results yet</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Results Summary */}
      {job?.results && Object.values(job.results).some(v => v > 0) && (
        <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl p-4">
          <h3 className="text-white font-medium mb-4">Results Summary</h3>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{job.results.subdomains || 0}</div>
              <div className="text-xs text-gray-500">Subdomains</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{job.results.live_hosts || 0}</div>
              <div className="text-xs text-gray-500">Live Hosts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">{job.results.ports || 0}</div>
              <div className="text-xs text-gray-500">Open Ports</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">{job.results.content || 0}</div>
              <div className="text-xs text-gray-500">Content</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{job.results.vulns || 0}</div>
              <div className="text-xs text-gray-500">Vulns</div>
            </div>
          </div>
        </div>
      )}

      {/* Logs */}
      {job?.logs?.length > 0 && (
        <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded-xl overflow-hidden">
          <div className="p-3 border-b border-[#1f1f1f] flex items-center justify-between">
            <h3 className="text-white font-medium">Scan Logs</h3>
            <span className="text-xs text-gray-500">{job.logs.length} entries</span>
          </div>
          
          <div className="max-h-64 overflow-y-auto p-3 space-y-1 font-mono text-xs">
            {job.logs.map((log, i) => (
              <div
                key={i}
                className={`flex gap-2 ${
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warning' ? 'text-yellow-400' :
                  'text-gray-400'
                }`}
              >
                <span className="text-gray-600 flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {log.phase && (
                  <span className="text-emerald-400 flex-shrink-0">[{log.phase}]</span>
                )}
                <span>{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Error Display */}
      {job?.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-red-400 font-medium">Scan Error</p>
            <p className="text-red-400/70 text-sm">{job.error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
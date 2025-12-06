/**
 * GlobalScanStatus - Shows scan status across all pages
 * Displays in sidebar/layout to show ongoing scans from any page
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Globe,
  Database,
  Link as LinkIcon,
  FolderOpen,
  FileCode,
  Shield,
  Server,
  X
} from 'lucide-react'

// All scan log keys we track
const SCAN_KEYS = {
  autoscan: { key: 'autoscan_manager_state', label: 'Auto Scan', icon: Zap, path: '/auto-scan', color: 'emerald' },
  subdomain: { key: 'subdomain_scan_state', label: 'Subdomains', icon: Globe, path: '/subdomain-scanner', color: 'blue' },
  livehosts: { key: 'live_hosts_progress', label: 'Live Hosts', icon: Activity, path: '/live-hosts', color: 'green' },
  ports: { key: 'port_scan_state', label: 'Port Scan', icon: Server, path: '/port-scanner', color: 'pink' },
  api: { key: 'content_scan_logs_api', label: 'API Discovery', icon: Database, path: '/content-discovery/apis', color: 'orange' },
  endpoint: { key: 'content_scan_logs_endpoint', label: 'Endpoints', icon: LinkIcon, path: '/content-discovery/endpoints', color: 'blue' },
  directory: { key: 'content_scan_logs_directory', label: 'Directories', icon: FolderOpen, path: '/content-discovery/directories', color: 'yellow' },
  javascript: { key: 'content_scan_logs_javascript', label: 'JS Files', icon: FileCode, path: '/content-discovery/js-files', color: 'purple' },
  vulns: { key: 'vuln_scan_state', label: 'Vuln Scan', icon: Shield, path: '/vuln-scanner', color: 'red' },
}

// Load scan state from localStorage
function loadScanState(key) {
  try {
    const saved = localStorage.getItem(key)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    // Ignore errors
  }
  return null
}

// Check if a scan is active
function isActive(state) {
  if (!state) return false
  return state.status === 'running' || state.isScanning === true
}

// Get recent logs from state
function getLogs(state) {
  if (!state) return []
  return state.logs || []
}

export default function GlobalScanStatus({ collapsed = false }) {
  const [scanStates, setScanStates] = useState({})
  const [expanded, setExpanded] = useState(true)
  const [selectedScan, setSelectedScan] = useState(null)
  const logsEndRef = useRef(null)
  
  // Poll for scan state changes
  useEffect(() => {
    const updateStates = () => {
      const states = {}
      Object.entries(SCAN_KEYS).forEach(([id, config]) => {
        const state = loadScanState(config.key)
        if (state) {
          states[id] = state
        }
      })
      setScanStates(states)
    }
    
    updateStates()
    const interval = setInterval(updateStates, 1000) // Poll every second
    
    return () => clearInterval(interval)
  }, [])
  
  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [scanStates, selectedScan])
  
  // Get active scans
  const activeScans = Object.entries(scanStates).filter(([id, state]) => isActive(state))
  
  // Get recent scans (completed within last hour)
  const recentScans = Object.entries(scanStates).filter(([id, state]) => {
    if (!state || isActive(state)) return false
    const savedAt = state.savedAt || state.timestamp
    if (!savedAt) return false
    const age = Date.now() - new Date(savedAt).getTime()
    return age < 60 * 60 * 1000 // Within last hour
  })
  
  // Nothing to show
  if (activeScans.length === 0 && recentScans.length === 0) {
    return null
  }
  
  if (collapsed) {
    // Compact view for collapsed sidebar
    return (
      <div className="px-2 py-1">
        {activeScans.length > 0 && (
          <div className="flex items-center justify-center p-2 bg-emerald-500/10 rounded-lg">
            <Loader2 size={16} className="text-emerald-400 animate-spin" />
          </div>
        )}
      </div>
    )
  }
  
  const selectedState = selectedScan ? scanStates[selectedScan] : null
  const selectedConfig = selectedScan ? SCAN_KEYS[selectedScan] : null
  
  return (
    <div className="border-t border-[#1f1f1f] mt-auto">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-[#111111] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className={activeScans.length > 0 ? 'text-emerald-400' : 'text-gray-500'} />
          <span className="text-sm font-medium text-white">Scan Status</span>
          {activeScans.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full">
              {activeScans.length} active
            </span>
          )}
        </div>
        {expanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronUp size={14} className="text-gray-500" />}
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Active Scans */}
          {activeScans.map(([id, state]) => {
            const config = SCAN_KEYS[id]
            const Icon = config.icon
            const logs = getLogs(state)
            const lastLog = logs[logs.length - 1]
            
            return (
              <div
                key={id}
                onClick={() => setSelectedScan(selectedScan === id ? null : id)}
                className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedScan === id 
                    ? 'bg-[#1a1a1a] border-emerald-500/30' 
                    : 'bg-[#0a0a0a] border-[#1f1f1f] hover:border-[#2a2a2a]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-emerald-400 animate-spin" />
                  <Icon size={14} className="text-gray-400" />
                  <span className="text-xs text-white flex-1">{config.label}</span>
                  <Link 
                    to={config.path}
                    className="text-xs text-emerald-400 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    View
                  </Link>
                </div>
                {lastLog && (
                  <p className="text-xs text-gray-500 mt-1 truncate pl-6">
                    {lastLog.message}
                  </p>
                )}
              </div>
            )
          })}
          
          {/* Recent Completed Scans */}
          {recentScans.slice(0, 3).map(([id, state]) => {
            const config = SCAN_KEYS[id]
            const Icon = config.icon
            const isSuccess = state.status === 'completed'
            
            return (
              <div
                key={id}
                onClick={() => setSelectedScan(selectedScan === id ? null : id)}
                className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedScan === id 
                    ? 'bg-[#1a1a1a] border-gray-500/30' 
                    : 'bg-[#0a0a0a] border-[#1f1f1f] hover:border-[#2a2a2a]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isSuccess ? (
                    <CheckCircle size={14} className="text-green-400" />
                  ) : (
                    <XCircle size={14} className="text-red-400" />
                  )}
                  <Icon size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-400 flex-1">{config.label}</span>
                  <Link 
                    to={config.path}
                    className="text-xs text-gray-500 hover:text-white"
                    onClick={e => e.stopPropagation()}
                  >
                    View
                  </Link>
                </div>
              </div>
            )
          })}
          
          {/* Expanded Logs View */}
          {selectedScan && selectedState && (
            <div className="mt-2 p-2 bg-[#050505] rounded-lg border border-[#1f1f1f]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white">{selectedConfig.label} Logs</span>
                <button 
                  onClick={() => setSelectedScan(null)}
                  className="p-1 hover:bg-[#1a1a1a] rounded"
                >
                  <X size={12} className="text-gray-500" />
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5 font-mono text-xs">
                {getLogs(selectedState).slice(-20).map((log, i) => (
                  <div 
                    key={i} 
                    className={`${
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'warning' ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}
                  >
                    <span className="text-gray-600 mr-2">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
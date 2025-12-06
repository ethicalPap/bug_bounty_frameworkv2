/**
 * ScanLogsPanel - Shared scan logs display component
 * Shows real-time logs that persist across navigation
 * Used by Content Discovery pages, Port Scanner, Vuln Scanner, etc.
 */

import { useState, useEffect, useRef } from 'react'
import { 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info,
  Loader2,
  Clock,
  Download
} from 'lucide-react'

// Storage key prefix
const STORAGE_KEY_PREFIX = 'scan_logs_'

/**
 * Load logs from localStorage
 */
export function loadScanLogs(pageKey) {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${pageKey}`)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('Error loading scan logs:', e)
  }
  return { 
    logs: [], 
    status: 'idle', 
    results: { success: 0, failed: 0, total: 0 },
    savedAt: null
  }
}

/**
 * Save logs to localStorage
 */
export function saveScanLogs(pageKey, data) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${pageKey}`, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString()
    }))
  } catch (e) {
    console.error('Error saving scan logs:', e)
  }
}

/**
 * Clear logs from localStorage
 */
export function clearScanLogs(pageKey) {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${pageKey}`)
}

/**
 * Hook for managing scan logs state
 */
export function useScanLogs(pageKey) {
  const [state, setState] = useState(() => loadScanLogs(pageKey))
  
  // Save whenever state changes
  useEffect(() => {
    saveScanLogs(pageKey, state)
  }, [state, pageKey])
  
  const addLog = (message, type = 'info') => {
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, {
        timestamp: new Date().toISOString(),
        message,
        type
      }]
    }))
  }
  
  const setStatus = (status) => {
    setState(prev => ({ ...prev, status }))
  }
  
  const setResults = (results) => {
    setState(prev => ({ ...prev, results }))
  }
  
  const clear = () => {
    setState({ 
      logs: [], 
      status: 'idle', 
      results: { success: 0, failed: 0, total: 0 },
      savedAt: null
    })
    clearScanLogs(pageKey)
  }
  
  const startScan = (message = 'Starting scan...') => {
    setState({
      logs: [{
        timestamp: new Date().toISOString(),
        message,
        type: 'info'
      }],
      status: 'running',
      results: { success: 0, failed: 0, total: 0 },
      savedAt: null
    })
  }
  
  const endScan = (success = true, results = {}) => {
    setState(prev => ({
      ...prev,
      status: success ? 'completed' : 'failed',
      results: { ...prev.results, ...results }
    }))
  }
  
  return {
    logs: state.logs,
    status: state.status,
    results: state.results,
    savedAt: state.savedAt,
    addLog,
    setStatus,
    setResults,
    clear,
    startScan,
    endScan
  }
}

/**
 * ScanLogsPanel Component
 */
export default function ScanLogsPanel({ 
  pageKey,
  logs = [],
  status = 'idle',
  results = {},
  onClear,
  title = 'Scan Logs',
  maxHeight = '300px',
  collapsible = true,
  defaultCollapsed = false,
  showExport = true
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const logsEndRef = useRef(null)
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (!isCollapsed && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isCollapsed])
  
  // Get status icon and color
  const getStatusDisplay = () => {
    switch (status) {
      case 'running':
        return { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Running', animate: true }
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Completed', animate: false }
      case 'failed':
        return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed', animate: false }
      case 'paused':
        return { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Paused', animate: false }
      default:
        return { icon: Info, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'Idle', animate: false }
    }
  }
  
  const statusDisplay = getStatusDisplay()
  const StatusIcon = statusDisplay.icon
  
  // Get log type styling
  const getLogStyle = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-400'
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      default:
        return 'text-gray-400'
    }
  }
  
  // Export logs
  const exportLogs = () => {
    const content = logs.map(log => 
      `[${new Date(log.timestamp).toLocaleString()}] [${log.type.toUpperCase()}] ${log.message}`
    ).join('\n')
    
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pageKey}-logs-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  if (logs.length === 0 && status === 'idle') {
    return null // Don't show panel if no logs and idle
  }
  
  return (
    <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-xl overflow-hidden">
      {/* Header */}
      <div 
        className={`p-3 border-b border-[#1f1f1f] flex items-center justify-between ${collapsible ? 'cursor-pointer hover:bg-[#111111]' : ''}`}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          {collapsible && (
            isCollapsed ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />
          )}
          <span className="text-sm font-medium text-white">{title}</span>
          
          {/* Status Badge */}
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${statusDisplay.bg} ${statusDisplay.color}`}>
            <StatusIcon size={12} className={statusDisplay.animate ? 'animate-spin' : ''} />
            {statusDisplay.label}
          </span>
          
          {/* Log count */}
          <span className="text-xs text-gray-500">
            {logs.length} entries
          </span>
        </div>
        
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {/* Results summary */}
          {(results.success > 0 || results.failed > 0) && (
            <div className="flex items-center gap-2 text-xs mr-2">
              {results.success > 0 && (
                <span className="text-green-400">{results.success} ✓</span>
              )}
              {results.failed > 0 && (
                <span className="text-red-400">{results.failed} ✗</span>
              )}
              {results.total > 0 && (
                <span className="text-gray-400">({results.total} items)</span>
              )}
            </div>
          )}
          
          {/* Export button */}
          {showExport && logs.length > 0 && (
            <button
              onClick={exportLogs}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-[#1a1a1a] rounded transition-colors"
              title="Export logs"
            >
              <Download size={14} />
            </button>
          )}
          
          {/* Clear button */}
          {onClear && logs.length > 0 && status !== 'running' && (
            <button
              onClick={onClear}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="Clear logs"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      
      {/* Logs content */}
      {!isCollapsed && (
        <div 
          className="overflow-y-auto font-mono text-xs"
          style={{ maxHeight }}
        >
          <div className="p-3 space-y-1">
            {logs.map((log, index) => (
              <div key={index} className={`flex gap-2 ${getLogStyle(log.type)}`}>
                <span className="text-gray-600 flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}
/**
 * ScanManager - Background Scan Service
 * 
 * Manages automated reconnaissance scans that persist across navigation.
 * Uses localStorage for state persistence and a pub/sub pattern for UI updates.
 */

import {
  startSubdomainScan,
  getSubdomains,
  probeHosts,
  startPortScan,
  startContentDiscovery,
  runNucleiScan
} from '../api/client'

// Storage key
const STORAGE_KEY = 'autoscan_manager_state'

// Scan phases configuration
export const SCAN_PHASES = [
  {
    id: 'subdomains',
    name: 'Subdomain Enumeration',
    description: 'Discover all subdomains using multiple sources',
    icon: 'Globe',
    color: 'blue',
    estimatedTime: '2-5 min'
  },
  {
    id: 'liveHosts',
    name: 'Live Host Detection',
    description: 'Probe subdomains to find active HTTP hosts',
    icon: 'Activity',
    color: 'green',
    estimatedTime: '1-3 min'
  },
  {
    id: 'ports',
    name: 'Port Scanning',
    description: 'Scan for open ports on live hosts',
    icon: 'Lock',
    color: 'pink',
    estimatedTime: '3-10 min'
  },
  {
    id: 'content',
    name: 'Content Discovery',
    description: 'Find APIs, endpoints, directories, and JS files',
    icon: 'Search',
    color: 'orange',
    estimatedTime: '5-15 min'
  },
  {
    id: 'vulns',
    name: 'Vulnerability Scanning',
    description: 'Run Nuclei templates against discovered content',
    icon: 'Shield',
    color: 'red',
    estimatedTime: '5-20 min'
  }
]

// Default state
const getDefaultState = () => ({
  targetDomain: '',
  status: 'idle', // idle, running, paused, completed, failed, cancelled
  currentPhase: null,
  completedPhases: [],
  failedPhases: [],
  phaseProgress: {},
  results: {
    subdomains: [],
    liveHosts: [],
    ports: [],
    content: [],
    vulns: []
  },
  logs: [],
  settings: {
    skipSubdomains: false,
    portScanType: 'top-100',
    maxConcurrency: 10,
    timeout: 30
  },
  savedAt: null
})

// Load state from localStorage
const loadState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Don't restore "running" status - scan doesn't survive page refresh
      if (parsed.status === 'running') {
        parsed.status = 'paused'
        parsed.logs.push({
          timestamp: new Date().toISOString(),
          message: 'Scan was interrupted (page refreshed)',
          type: 'warning',
          phase: parsed.currentPhase
        })
      }
      return { ...getDefaultState(), ...parsed }
    }
  } catch (e) {
    console.error('Error loading scan state:', e)
  }
  return getDefaultState()
}

// Save state to localStorage
const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...state,
      savedAt: new Date().toISOString()
    }))
  } catch (e) {
    console.error('Error saving scan state:', e)
  }
}

class ScanManager {
  constructor() {
    this.state = loadState()
    this.subscribers = new Set()
    this.abortController = null
    this.isPaused = false
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  // Notify all subscribers
  notify() {
    saveState(this.state)
    this.subscribers.forEach(cb => cb(this.state))
  }

  // Get current state
  getState() {
    return this.state
  }

  // Update state
  setState(updates) {
    this.state = { ...this.state, ...updates }
    this.notify()
  }

  // Add log entry
  addLog(message, type = 'info', phase = null) {
    const log = {
      timestamp: new Date().toISOString(),
      message,
      type,
      phase: phase || this.state.currentPhase
    }
    this.state.logs = [...this.state.logs, log]
    this.notify()
  }

  // Update phase progress
  updateProgress(phase, progress, status = null) {
    this.state.phaseProgress = {
      ...this.state.phaseProgress,
      [phase]: { progress, status }
    }
    this.notify()
  }

  // Update settings
  updateSettings(settings) {
    this.state.settings = { ...this.state.settings, ...settings }
    this.notify()
  }

  // Clear all state
  clear() {
    this.state = getDefaultState()
    localStorage.removeItem(STORAGE_KEY)
    this.notify()
  }

  // Check if paused and wait
  async checkPause() {
    while (this.isPaused && this.state.status === 'paused') {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    if (this.abortController?.signal.aborted) {
      throw new Error('Cancelled')
    }
  }

  // Start full scan
  async startScan(domain) {
    if (!domain?.trim()) {
      this.addLog('Please enter a target domain', 'error')
      return
    }

    // Reset state
    this.abortController = new AbortController()
    this.isPaused = false
    this.setState({
      targetDomain: domain.trim(),
      status: 'running',
      currentPhase: null,
      completedPhases: [],
      failedPhases: [],
      phaseProgress: {},
      results: { subdomains: [], liveHosts: [], ports: [], content: [], vulns: [] },
      logs: []
    })

    this.addLog(`Starting full reconnaissance scan for ${domain}`, 'info')
    this.addLog('═'.repeat(50), 'info')

    try {
      // Phase 1: Subdomain Enumeration
      if (!this.state.settings.skipSubdomains) {
        await this.runSubdomainScan(domain)
      } else {
        this.addLog('Skipping subdomain enumeration (using domain directly)', 'warning')
        this.state.results.subdomains = [{ subdomain: domain, full_domain: domain }]
      }

      await this.checkPause()

      // Phase 2: Live Host Detection
      await this.runLiveHostScan()
      await this.checkPause()

      // Phase 3: Port Scanning
      await this.runPortScan()
      await this.checkPause()

      // Phase 4: Content Discovery
      await this.runContentDiscovery()
      await this.checkPause()

      // Phase 5: Vulnerability Scanning
      await this.runVulnScan()

      this.addLog('═'.repeat(50), 'info')
      this.addLog('🎉 Full scan complete!', 'success')
      this.setState({ status: 'completed', currentPhase: null })

    } catch (error) {
      if (error.message === 'Cancelled') {
        this.addLog('Scan cancelled by user', 'warning')
        this.setState({ status: 'cancelled' })
      } else {
        this.addLog(`Scan failed: ${error.message}`, 'error')
        this.setState({ status: 'failed' })
      }
    }
  }

  // Phase 1: Subdomain Enumeration
  async runSubdomainScan(domain) {
    this.setState({ currentPhase: 'subdomains' })
    this.addLog('Phase 1: Starting subdomain enumeration...', 'info', 'subdomains')
    this.updateProgress('subdomains', 0, 'running')

    try {
      this.updateProgress('subdomains', 20, 'running')
      this.addLog('Running subfinder, amass, assetfinder...', 'info', 'subdomains')

      // Pass config object with domain
      await startSubdomainScan({ 
        domain: domain,
        use_subfinder: true,
        use_amass: true,
        use_assetfinder: true
      })
      this.updateProgress('subdomains', 60, 'running')

      await this.checkPause()

      const subdomains = await getSubdomains(domain)
      const subList = Array.isArray(subdomains) ? subdomains : 
                      subdomains?.data || subdomains?.subdomains || []

      this.state.results.subdomains = subList
      localStorage.setItem('subdomain_scan_results', JSON.stringify(subList))

      this.updateProgress('subdomains', 100, 'completed')
      this.addLog(`✓ Found ${subList.length} subdomains`, 'success', 'subdomains')
      
      this.state.completedPhases = [...this.state.completedPhases, 'subdomains']
      this.notify()

    } catch (error) {
      this.updateProgress('subdomains', 0, 'failed')
      this.addLog(`✗ Subdomain scan failed: ${error.message}`, 'error', 'subdomains')
      this.state.failedPhases = [...this.state.failedPhases, 'subdomains']
      this.notify()
      throw error
    }
  }

  // Phase 2: Live Host Detection
  async runLiveHostScan() {
    this.setState({ currentPhase: 'liveHosts' })
    this.addLog('Phase 2: Starting live host detection...', 'info', 'liveHosts')
    this.updateProgress('liveHosts', 0, 'running')

    try {
      const subdomains = this.state.results.subdomains
      if (subdomains.length === 0) {
        this.addLog('No subdomains to probe', 'warning', 'liveHosts')
        this.updateProgress('liveHosts', 100, 'completed')
        this.state.completedPhases = [...this.state.completedPhases, 'liveHosts']
        this.notify()
        return
      }

      const hosts = subdomains.map(s => s.full_domain || s.subdomain || s)
      const batchSize = 50
      let allResults = []

      for (let i = 0; i < hosts.length; i += batchSize) {
        await this.checkPause()
        
        const batch = hosts.slice(i, i + batchSize)
        const progress = Math.round(((i + batch.length) / hosts.length) * 100)
        this.updateProgress('liveHosts', progress, 'running')
        this.addLog(`Probing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(hosts.length/batchSize)}...`, 'info', 'liveHosts')

        try {
          const results = await probeHosts(batch)
          const liveResults = Array.isArray(results) ? results : results?.results || []
          allResults = [...allResults, ...liveResults]
        } catch (e) {
          this.addLog(`Batch failed: ${e.message}`, 'warning', 'liveHosts')
        }
      }

      this.state.results.liveHosts = allResults
      localStorage.setItem('live_hosts_results', JSON.stringify(allResults))

      const activeCount = allResults.filter(r => r.is_active).length
      this.updateProgress('liveHosts', 100, 'completed')
      this.addLog(`✓ Found ${activeCount} live hosts out of ${allResults.length}`, 'success', 'liveHosts')

      this.state.completedPhases = [...this.state.completedPhases, 'liveHosts']
      this.notify()

    } catch (error) {
      this.updateProgress('liveHosts', 0, 'failed')
      this.addLog(`✗ Live host scan failed: ${error.message}`, 'error', 'liveHosts')
      this.state.failedPhases = [...this.state.failedPhases, 'liveHosts']
      this.notify()
      throw error
    }
  }

  // Phase 3: Port Scanning
  async runPortScan() {
    this.setState({ currentPhase: 'ports' })
    this.addLog('Phase 3: Starting port scanning...', 'info', 'ports')
    this.updateProgress('ports', 0, 'running')

    try {
      const liveHosts = this.state.results.liveHosts.filter(h => h.is_active)
      if (liveHosts.length === 0) {
        this.addLog('No live hosts to scan', 'warning', 'ports')
        this.updateProgress('ports', 100, 'completed')
        this.state.completedPhases = [...this.state.completedPhases, 'ports']
        this.notify()
        return
      }

      let allPorts = []
      const targets = liveHosts.slice(0, 20) // Limit to first 20 hosts

      for (let i = 0; i < targets.length; i++) {
        await this.checkPause()

        const host = targets[i]
        const hostname = host.subdomain || new URL(host.url).hostname
        const progress = Math.round(((i + 1) / targets.length) * 100)
        this.updateProgress('ports', progress, 'running')
        this.addLog(`Scanning ${hostname}...`, 'info', 'ports')

        try {
          const result = await startPortScan({
            target: hostname,
            scan_type: this.state.settings.portScanType || 'top-100',
            timeout: this.state.settings.timeout || 30
          })
          const ports = result?.ports || result?.open_ports || []
          if (ports.length > 0) {
            allPorts = [...allPorts, ...ports.map(p => ({ ...p, host: hostname }))]
          }
        } catch (e) {
          this.addLog(`Failed ${hostname}: ${e.message}`, 'warning', 'ports')
        }
      }

      this.state.results.ports = allPorts
      localStorage.setItem('port_scan_results', JSON.stringify(allPorts))

      this.updateProgress('ports', 100, 'completed')
      this.addLog(`✓ Found ${allPorts.length} open ports`, 'success', 'ports')

      this.state.completedPhases = [...this.state.completedPhases, 'ports']
      this.notify()

    } catch (error) {
      this.updateProgress('ports', 0, 'failed')
      this.addLog(`✗ Port scan failed: ${error.message}`, 'error', 'ports')
      this.state.failedPhases = [...this.state.failedPhases, 'ports']
      this.notify()
      throw error
    }
  }

  // Phase 4: Content Discovery
  async runContentDiscovery() {
    this.setState({ currentPhase: 'content' })
    this.addLog('Phase 4: Starting content discovery...', 'info', 'content')
    this.updateProgress('content', 0, 'running')

    try {
      const liveHosts = this.state.results.liveHosts.filter(h => h.is_active)
      if (liveHosts.length === 0) {
        this.addLog('No live hosts for content discovery', 'warning', 'content')
        this.updateProgress('content', 100, 'completed')
        this.state.completedPhases = [...this.state.completedPhases, 'content']
        this.notify()
        return
      }

      let allContent = []
      const targets = liveHosts.slice(0, 10) // Limit to first 10

      for (let i = 0; i < targets.length; i++) {
        await this.checkPause()

        const host = targets[i]
        const url = host.url || `https://${host.subdomain}`
        const progress = Math.round(((i + 1) / targets.length) * 100)
        this.updateProgress('content', progress, 'running')
        this.addLog(`Discovering content on ${new URL(url).hostname}...`, 'info', 'content')

        try {
          const result = await startContentDiscovery({
            target_url: url,
            scan_type: 'full',
            use_waymore: true,
            use_gau: true,
            use_katana: true,
            use_gospider: false,
            use_linkfinder: true
          })
          const urls = result?.discovered_urls || result?.urls || []
          if (urls.length > 0) {
            allContent = [...allContent, ...urls]
          }
        } catch (e) {
          this.addLog(`Failed ${url}: ${e.message}`, 'warning', 'content')
        }
      }

      this.state.results.content = allContent

      this.updateProgress('content', 100, 'completed')
      this.addLog(`✓ Discovered ${allContent.length} URLs`, 'success', 'content')

      this.state.completedPhases = [...this.state.completedPhases, 'content']
      this.notify()

    } catch (error) {
      this.updateProgress('content', 0, 'failed')
      this.addLog(`✗ Content discovery failed: ${error.message}`, 'error', 'content')
      this.state.failedPhases = [...this.state.failedPhases, 'content']
      this.notify()
      throw error
    }
  }

  // Phase 5: Vulnerability Scanning
  async runVulnScan() {
    this.setState({ currentPhase: 'vulns' })
    this.addLog('Phase 5: Starting vulnerability scanning...', 'info', 'vulns')
    this.updateProgress('vulns', 0, 'running')

    try {
      const liveHosts = this.state.results.liveHosts.filter(h => h.is_active)
      if (liveHosts.length === 0) {
        this.addLog('No live hosts for vulnerability scanning', 'warning', 'vulns')
        this.updateProgress('vulns', 100, 'completed')
        this.state.completedPhases = [...this.state.completedPhases, 'vulns']
        this.notify()
        return
      }

      let allVulns = []
      const targets = liveHosts.slice(0, 5) // Limit to first 5

      for (let i = 0; i < targets.length; i++) {
        await this.checkPause()

        const host = targets[i]
        const url = host.url || `https://${host.subdomain}`
        const progress = Math.round(((i + 1) / targets.length) * 100)
        this.updateProgress('vulns', progress, 'running')
        this.addLog(`Scanning ${new URL(url).hostname} for vulnerabilities...`, 'info', 'vulns')

        try {
          const result = await runNucleiScan({
            target: url,
            templates: ['cves', 'vulnerabilities', 'exposures'],
            severity: 'all'
          })
          const vulns = result?.vulnerabilities || result?.findings || []
          if (vulns.length > 0) {
            allVulns = [...allVulns, ...vulns]
          }
        } catch (e) {
          this.addLog(`Failed ${url}: ${e.message}`, 'warning', 'vulns')
        }
      }

      this.state.results.vulns = allVulns
      localStorage.setItem('vuln_scan_results', JSON.stringify(allVulns))

      this.updateProgress('vulns', 100, 'completed')
      this.addLog(`✓ Found ${allVulns.length} vulnerabilities`, 'success', 'vulns')

      this.state.completedPhases = [...this.state.completedPhases, 'vulns']
      this.notify()

    } catch (error) {
      this.updateProgress('vulns', 0, 'failed')
      this.addLog(`✗ Vulnerability scan failed: ${error.message}`, 'error', 'vulns')
      this.state.failedPhases = [...this.state.failedPhases, 'vulns']
      this.notify()
      throw error
    }
  }

  // Pause scan
  pause() {
    this.isPaused = true
    this.setState({ status: 'paused' })
    this.addLog('Scan paused', 'warning')
  }

  // Resume scan
  resume() {
    this.isPaused = false
    this.setState({ status: 'running' })
    this.addLog('Scan resumed', 'info')
  }

  // Cancel scan
  cancel() {
    this.abortController?.abort()
    this.isPaused = false
    this.setState({ status: 'cancelled', currentPhase: null })
    this.addLog('Scan cancelled', 'warning')
  }
}

// Singleton instance
const scanManager = new ScanManager()

export default scanManager
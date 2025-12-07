/**
 * Settings Page - Scanner Configuration & App Settings
 * 
 * Sections:
 * - Scanner Settings (timeouts, concurrency, tool defaults)
 * - Storage Management (clear cache, export data)
 * - API Configuration (backend URL, ZAP settings)
 * - Display Preferences (theme, notifications)
 */

import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Trash2,
  Download,
  Upload,
  Database,
  Globe,
  Activity,
  Lock,
  Search,
  Shield,
  Server,
  Zap,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  Wifi,
  Bell,
  Palette,
  Clock,
  Hash,
  FileJson,
  RefreshCw,
  Info,
  ExternalLink
} from 'lucide-react'
import { useContentDiscovery } from '../../stores/ContentDiscoveryStore'

// Default settings
const DEFAULT_SETTINGS = {
  // Subdomain Scanner
  subdomain: {
    useSubfinder: true,
    useAmass: true,
    useAssetfinder: true,
    useFindomain: false,
    useChaos: false,
    timeout: 300,
    chaosApiKey: ''
  },
  // Live Host Probing
  liveHosts: {
    concurrency: 20,
    timeout: 10,
    batchSize: 50,
    retries: 2,
    followRedirects: true
  },
  // Port Scanner
  ports: {
    scanType: 'top-100', // top-100, top-1000, full, custom
    customPorts: '80,443,8080,8443',
    timeout: 30,
    concurrency: 10,
    serviceDetection: true
  },
  // Content Discovery
  content: {
    useWaymore: true,
    useGau: true,
    useKatana: true,
    useGospider: false,
    useLinkfinder: true,
    useZapSpider: true,
    crawlDepth: 3,
    timeout: 300,
    rateLimit: 150,
    threads: 10
  },
  // Vulnerability Scanner
  vulns: {
    useNuclei: true,
    useNikto: false,
    templates: ['cves', 'vulnerabilities', 'exposures', 'misconfiguration'],
    severity: 'all', // all, critical, high, medium, low
    rateLimit: 150,
    timeout: 600,
    concurrency: 25
  },
  // Auto Scan
  autoScan: {
    skipSubdomains: false,
    portScanType: 'top-100',
    maxTargets: 50,
    pauseBetweenPhases: false
  },
  // API Configuration
  api: {
    backendUrl: 'http://localhost:8000',
    zapUrl: 'http://localhost:8080',
    zapApiKey: ''
  },
  // Display
  display: {
    theme: 'dark',
    showNotifications: true,
    autoRefresh: true,
    refreshInterval: 30,
    compactView: false
  },
  // Storage
  storage: {
    maxItems: 2000,
    maxLogs: 1000,
    autoCleanup: true
  }
}

// Storage key
const SETTINGS_KEY = 'app_settings'

// Load settings from localStorage
function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Merge with defaults to ensure all keys exist
      return deepMerge(DEFAULT_SETTINGS, parsed)
    }
  } catch (e) {
    console.error('Error loading settings:', e)
  }
  return DEFAULT_SETTINGS
}

// Save settings to localStorage
function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return true
  } catch (e) {
    console.error('Error saving settings:', e)
    return false
  }
}

// Deep merge helper
function deepMerge(target, source) {
  const result = { ...target }
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

// Calculate localStorage usage
function getStorageUsage() {
  let total = 0
  const breakdown = {}
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    const value = localStorage.getItem(key)
    const size = new Blob([value]).size
    total += size
    
    // Group by prefix
    const prefix = key.split('_')[0] || key.split('-')[0] || 'other'
    breakdown[prefix] = (breakdown[prefix] || 0) + size
  }
  
  return { total, breakdown }
}

export default function Settings() {
  const { clearAllData, stats } = useContentDiscovery()
  
  const [settings, setSettings] = useState(loadSettings)
  const [activeSection, setActiveSection] = useState('subdomain')
  const [saved, setSaved] = useState(false)
  const [storageUsage, setStorageUsage] = useState({ total: 0, breakdown: {} })
  const [backendStatus, setBackendStatus] = useState('checking')
  const [zapStatus, setZapStatus] = useState('checking')
  
  // Calculate storage on mount
  useEffect(() => {
    setStorageUsage(getStorageUsage())
  }, [])
  
  // Check backend connectivity
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${settings.api.backendUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        })
        setBackendStatus(response.ok ? 'connected' : 'error')
      } catch (e) {
        setBackendStatus('error')
      }
    }
    
    // Check ZAP through backend (direct browser requests blocked by CORS)
    const checkZap = async () => {
      try {
        // Try to check ZAP status through backend endpoint
        const response = await fetch(`${settings.api.backendUrl}/api/v1/zap/status`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        })
        if (response.ok) {
          setZapStatus('connected')
        } else {
          // Backend reachable but ZAP check failed - might not have endpoint
          setZapStatus('unknown')
        }
      } catch (e) {
        // Can't check ZAP through backend, mark as unknown (not error)
        setZapStatus('unknown')
      }
    }
    
    checkBackend()
    checkZap()
  }, [settings.api.backendUrl, settings.api.zapUrl])
  
  // Update a setting
  const updateSetting = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
    setSaved(false)
  }
  
  // Save all settings
  const handleSave = () => {
    if (saveSettings(settings)) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }
  
  // Reset to defaults
  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      setSettings(DEFAULT_SETTINGS)
      saveSettings(DEFAULT_SETTINGS)
      setSaved(true)
    }
  }
  
  // Clear all scan data
  const handleClearData = () => {
    if (confirm('Clear all cached scan data? This will not affect the database.')) {
      clearAllData()
      setStorageUsage(getStorageUsage())
    }
  }
  
  // Export settings
  const handleExport = () => {
    const data = JSON.stringify(settings, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scanner-settings-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // Import settings
  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result)
        const merged = deepMerge(DEFAULT_SETTINGS, imported)
        setSettings(merged)
        saveSettings(merged)
        setSaved(true)
      } catch (err) {
        alert('Invalid settings file')
      }
    }
    reader.readAsText(file)
  }
  
  // Format bytes
  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }
  
  // Section nav items
  const sections = [
    { id: 'subdomain', label: 'Subdomain Scanner', icon: Globe },
    { id: 'liveHosts', label: 'Live Hosts', icon: Activity },
    { id: 'ports', label: 'Port Scanner', icon: Lock },
    { id: 'content', label: 'Content Discovery', icon: Search },
    { id: 'vulns', label: 'Vuln Scanner', icon: Shield },
    { id: 'autoScan', label: 'Auto Scan', icon: Zap },
    { id: 'api', label: 'API & Services', icon: Server },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'display', label: 'Display', icon: Palette },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-gray-500/20 to-gray-600/20">
              <SettingsIcon size={24} className="text-gray-400" />
            </div>
            Settings
          </h1>
          <p className="text-gray-500 mt-1">Configure scanner tools and application preferences</p>
        </div>
        
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-400">
              <CheckCircle size={16} />
              Saved
            </span>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111111] border border-[#1f1f1f] text-gray-400 hover:text-white transition-colors"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar Navigation */}
        <div className="col-span-3">
          <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-2 space-y-1 sticky top-6">
            {sections.map(section => {
              const Icon = section.icon
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <Icon size={16} />
                  {section.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Settings Content */}
        <div className="col-span-9 space-y-6">
          {/* Subdomain Scanner Settings */}
          {activeSection === 'subdomain' && (
            <SettingsSection title="Subdomain Scanner" icon={Globe} description="Configure subdomain enumeration tools">
              <SettingsGroup title="Tools">
                <ToggleSetting
                  label="Subfinder"
                  description="Fast passive subdomain enumeration"
                  value={settings.subdomain.useSubfinder}
                  onChange={(v) => updateSetting('subdomain', 'useSubfinder', v)}
                />
                <ToggleSetting
                  label="Amass"
                  description="In-depth DNS enumeration"
                  value={settings.subdomain.useAmass}
                  onChange={(v) => updateSetting('subdomain', 'useAmass', v)}
                />
                <ToggleSetting
                  label="Assetfinder"
                  description="Find related domains and subdomains"
                  value={settings.subdomain.useAssetfinder}
                  onChange={(v) => updateSetting('subdomain', 'useAssetfinder', v)}
                />
                <ToggleSetting
                  label="Findomain"
                  description="Cross-platform subdomain finder"
                  value={settings.subdomain.useFindomain}
                  onChange={(v) => updateSetting('subdomain', 'useFindomain', v)}
                />
                <ToggleSetting
                  label="Chaos (ProjectDiscovery)"
                  description="Requires API key"
                  value={settings.subdomain.useChaos}
                  onChange={(v) => updateSetting('subdomain', 'useChaos', v)}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Configuration">
                <NumberSetting
                  label="Timeout (seconds)"
                  description="Maximum time per tool"
                  value={settings.subdomain.timeout}
                  onChange={(v) => updateSetting('subdomain', 'timeout', v)}
                  min={60}
                  max={600}
                />
                {settings.subdomain.useChaos && (
                  <TextSetting
                    label="Chaos API Key"
                    description="Get from chaos.projectdiscovery.io"
                    value={settings.subdomain.chaosApiKey}
                    onChange={(v) => updateSetting('subdomain', 'chaosApiKey', v)}
                    type="password"
                  />
                )}
              </SettingsGroup>
            </SettingsSection>
          )}

          {/* Live Hosts Settings */}
          {activeSection === 'liveHosts' && (
            <SettingsSection title="Live Host Detection" icon={Activity} description="Configure HTTP probing">
              <SettingsGroup title="Performance">
                <NumberSetting
                  label="Concurrency"
                  description="Number of simultaneous probes"
                  value={settings.liveHosts.concurrency}
                  onChange={(v) => updateSetting('liveHosts', 'concurrency', v)}
                  min={1}
                  max={100}
                />
                <NumberSetting
                  label="Batch Size"
                  description="Hosts per batch"
                  value={settings.liveHosts.batchSize}
                  onChange={(v) => updateSetting('liveHosts', 'batchSize', v)}
                  min={10}
                  max={200}
                />
                <NumberSetting
                  label="Timeout (seconds)"
                  description="Timeout per host"
                  value={settings.liveHosts.timeout}
                  onChange={(v) => updateSetting('liveHosts', 'timeout', v)}
                  min={1}
                  max={60}
                />
                <NumberSetting
                  label="Retries"
                  description="Retry failed hosts"
                  value={settings.liveHosts.retries}
                  onChange={(v) => updateSetting('liveHosts', 'retries', v)}
                  min={0}
                  max={5}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Behavior">
                <ToggleSetting
                  label="Follow Redirects"
                  description="Follow HTTP redirects"
                  value={settings.liveHosts.followRedirects}
                  onChange={(v) => updateSetting('liveHosts', 'followRedirects', v)}
                />
              </SettingsGroup>
            </SettingsSection>
          )}

          {/* Port Scanner Settings */}
          {activeSection === 'ports' && (
            <SettingsSection title="Port Scanner" icon={Lock} description="Configure port scanning">
              <SettingsGroup title="Scan Type">
                <SelectSetting
                  label="Default Scan Type"
                  description="Ports to scan by default"
                  value={settings.ports.scanType}
                  onChange={(v) => updateSetting('ports', 'scanType', v)}
                  options={[
                    { value: 'top-100', label: 'Top 100 Ports' },
                    { value: 'top-1000', label: 'Top 1000 Ports' },
                    { value: 'full', label: 'Full Scan (1-65535)' },
                    { value: 'custom', label: 'Custom Ports' },
                  ]}
                />
                {settings.ports.scanType === 'custom' && (
                  <TextSetting
                    label="Custom Ports"
                    description="Comma-separated port list"
                    value={settings.ports.customPorts}
                    onChange={(v) => updateSetting('ports', 'customPorts', v)}
                    placeholder="80,443,8080,8443"
                  />
                )}
              </SettingsGroup>
              
              <SettingsGroup title="Performance">
                <NumberSetting
                  label="Timeout (seconds)"
                  description="Timeout per port"
                  value={settings.ports.timeout}
                  onChange={(v) => updateSetting('ports', 'timeout', v)}
                  min={1}
                  max={120}
                />
                <NumberSetting
                  label="Concurrency"
                  description="Parallel port scans"
                  value={settings.ports.concurrency}
                  onChange={(v) => updateSetting('ports', 'concurrency', v)}
                  min={1}
                  max={50}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Detection">
                <ToggleSetting
                  label="Service Detection"
                  description="Identify services on open ports"
                  value={settings.ports.serviceDetection}
                  onChange={(v) => updateSetting('ports', 'serviceDetection', v)}
                />
              </SettingsGroup>
            </SettingsSection>
          )}

          {/* Content Discovery Settings */}
          {activeSection === 'content' && (
            <SettingsSection title="Content Discovery" icon={Search} description="Configure content discovery tools">
              <SettingsGroup title="Passive Tools">
                <ToggleSetting
                  label="Waymore"
                  description="Wayback Machine URL extraction"
                  value={settings.content.useWaymore}
                  onChange={(v) => updateSetting('content', 'useWaymore', v)}
                />
                <ToggleSetting
                  label="GAU"
                  description="Get All URLs from archives"
                  value={settings.content.useGau}
                  onChange={(v) => updateSetting('content', 'useGau', v)}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Active Crawling">
                <ToggleSetting
                  label="Katana"
                  description="Fast web crawler"
                  value={settings.content.useKatana}
                  onChange={(v) => updateSetting('content', 'useKatana', v)}
                />
                <ToggleSetting
                  label="GoSpider"
                  description="Web spider with form detection"
                  value={settings.content.useGospider}
                  onChange={(v) => updateSetting('content', 'useGospider', v)}
                />
                <ToggleSetting
                  label="ZAP Spider"
                  description="OWASP ZAP web spider"
                  value={settings.content.useZapSpider}
                  onChange={(v) => updateSetting('content', 'useZapSpider', v)}
                />
              </SettingsGroup>
              
              <SettingsGroup title="JS Analysis">
                <ToggleSetting
                  label="LinkFinder"
                  description="Extract endpoints from JavaScript"
                  value={settings.content.useLinkfinder}
                  onChange={(v) => updateSetting('content', 'useLinkfinder', v)}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Performance">
                <NumberSetting
                  label="Crawl Depth"
                  description="Maximum crawl depth"
                  value={settings.content.crawlDepth}
                  onChange={(v) => updateSetting('content', 'crawlDepth', v)}
                  min={1}
                  max={10}
                />
                <NumberSetting
                  label="Threads"
                  description="Parallel threads"
                  value={settings.content.threads}
                  onChange={(v) => updateSetting('content', 'threads', v)}
                  min={1}
                  max={50}
                />
                <NumberSetting
                  label="Rate Limit (req/s)"
                  description="Requests per second"
                  value={settings.content.rateLimit}
                  onChange={(v) => updateSetting('content', 'rateLimit', v)}
                  min={1}
                  max={500}
                />
                <NumberSetting
                  label="Timeout (seconds)"
                  description="Maximum scan time"
                  value={settings.content.timeout}
                  onChange={(v) => updateSetting('content', 'timeout', v)}
                  min={60}
                  max={1800}
                />
              </SettingsGroup>
            </SettingsSection>
          )}

          {/* Vulnerability Scanner Settings */}
          {activeSection === 'vulns' && (
            <SettingsSection title="Vulnerability Scanner" icon={Shield} description="Configure vulnerability scanning">
              <SettingsGroup title="Scanners">
                <ToggleSetting
                  label="Nuclei"
                  description="Template-based vulnerability scanner"
                  value={settings.vulns.useNuclei}
                  onChange={(v) => updateSetting('vulns', 'useNuclei', v)}
                />
                <ToggleSetting
                  label="Nikto"
                  description="Web server scanner"
                  value={settings.vulns.useNikto}
                  onChange={(v) => updateSetting('vulns', 'useNikto', v)}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Templates">
                <SelectSetting
                  label="Minimum Severity"
                  description="Only show vulnerabilities at or above this level"
                  value={settings.vulns.severity}
                  onChange={(v) => updateSetting('vulns', 'severity', v)}
                  options={[
                    { value: 'all', label: 'All Severities' },
                    { value: 'low', label: 'Low and above' },
                    { value: 'medium', label: 'Medium and above' },
                    { value: 'high', label: 'High and above' },
                    { value: 'critical', label: 'Critical only' },
                  ]}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Performance">
                <NumberSetting
                  label="Concurrency"
                  description="Parallel scans"
                  value={settings.vulns.concurrency}
                  onChange={(v) => updateSetting('vulns', 'concurrency', v)}
                  min={1}
                  max={100}
                />
                <NumberSetting
                  label="Rate Limit (req/s)"
                  description="Requests per second"
                  value={settings.vulns.rateLimit}
                  onChange={(v) => updateSetting('vulns', 'rateLimit', v)}
                  min={1}
                  max={500}
                />
                <NumberSetting
                  label="Timeout (seconds)"
                  description="Maximum scan time"
                  value={settings.vulns.timeout}
                  onChange={(v) => updateSetting('vulns', 'timeout', v)}
                  min={60}
                  max={3600}
                />
              </SettingsGroup>
            </SettingsSection>
          )}

          {/* Auto Scan Settings */}
          {activeSection === 'autoScan' && (
            <SettingsSection title="Auto Scan" icon={Zap} description="Configure automated reconnaissance">
              <SettingsGroup title="Workflow">
                <ToggleSetting
                  label="Skip Subdomain Enumeration"
                  description="Start directly with the provided domain"
                  value={settings.autoScan.skipSubdomains}
                  onChange={(v) => updateSetting('autoScan', 'skipSubdomains', v)}
                />
                <ToggleSetting
                  label="Pause Between Phases"
                  description="Wait for confirmation between scan phases"
                  value={settings.autoScan.pauseBetweenPhases}
                  onChange={(v) => updateSetting('autoScan', 'pauseBetweenPhases', v)}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Limits">
                <SelectSetting
                  label="Port Scan Type"
                  description="Default port scan scope"
                  value={settings.autoScan.portScanType}
                  onChange={(v) => updateSetting('autoScan', 'portScanType', v)}
                  options={[
                    { value: 'top-100', label: 'Top 100 Ports' },
                    { value: 'top-1000', label: 'Top 1000 Ports' },
                    { value: 'full', label: 'Full Scan' },
                  ]}
                />
                <NumberSetting
                  label="Max Targets"
                  description="Maximum hosts to scan per phase"
                  value={settings.autoScan.maxTargets}
                  onChange={(v) => updateSetting('autoScan', 'maxTargets', v)}
                  min={1}
                  max={500}
                />
              </SettingsGroup>
            </SettingsSection>
          )}

          {/* API & Services Settings */}
          {activeSection === 'api' && (
            <SettingsSection title="API & Services" icon={Server} description="Configure backend connections">
              <SettingsGroup title="Backend API">
                <TextSetting
                  label="Backend URL"
                  description="FastAPI backend address"
                  value={settings.api.backendUrl}
                  onChange={(v) => updateSetting('api', 'backendUrl', v)}
                  placeholder="http://localhost:8000"
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className={`flex items-center gap-1 text-sm ${
                    backendStatus === 'connected' ? 'text-green-400' :
                    backendStatus === 'error' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {backendStatus === 'connected' && <CheckCircle size={14} />}
                    {backendStatus === 'error' && <AlertTriangle size={14} />}
                    {backendStatus === 'checking' && <RefreshCw size={14} className="animate-spin" />}
                    {backendStatus === 'connected' ? 'Connected' : 
                     backendStatus === 'error' ? 'Not reachable' : 'Checking...'}
                  </span>
                </div>
              </SettingsGroup>
              
              <SettingsGroup title="OWASP ZAP">
                <TextSetting
                  label="ZAP URL"
                  description="ZAP proxy address"
                  value={settings.api.zapUrl}
                  onChange={(v) => updateSetting('api', 'zapUrl', v)}
                  placeholder="http://localhost:8080"
                />
                <TextSetting
                  label="ZAP API Key"
                  description="Leave empty if disabled"
                  value={settings.api.zapApiKey}
                  onChange={(v) => updateSetting('api', 'zapApiKey', v)}
                  type="password"
                  placeholder="Optional"
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className={`flex items-center gap-1 text-sm ${
                    zapStatus === 'connected' ? 'text-green-400' :
                    zapStatus === 'error' ? 'text-red-400' : 
                    zapStatus === 'unknown' ? 'text-gray-400' : 'text-yellow-400'
                  }`}>
                    {zapStatus === 'connected' && <CheckCircle size={14} />}
                    {zapStatus === 'error' && <AlertTriangle size={14} />}
                    {zapStatus === 'unknown' && <Info size={14} />}
                    {zapStatus === 'checking' && <RefreshCw size={14} className="animate-spin" />}
                    {zapStatus === 'connected' ? 'Connected' : 
                     zapStatus === 'error' ? 'Not reachable' : 
                     zapStatus === 'unknown' ? 'Cannot check (CORS)' : 'Checking...'}
                  </span>
                </div>
              </SettingsGroup>
            </SettingsSection>
          )}

          {/* Storage Settings */}
          {activeSection === 'storage' && (
            <SettingsSection title="Storage Management" icon={HardDrive} description="Manage cached data">
              <SettingsGroup title="Usage">
                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1f1f1f]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Total localStorage Usage</span>
                    <span className="text-lg font-mono text-white">{formatBytes(storageUsage.total)}</span>
                  </div>
                  <div className="w-full h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min((storageUsage.total / (5 * 1024 * 1024)) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">5 MB browser limit</p>
                  
                  {/* Breakdown */}
                  <div className="mt-4 space-y-2">
                    {Object.entries(storageUsage.breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([key, size]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{key}</span>
                          <span className="text-gray-400 font-mono">{formatBytes(size)}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </SettingsGroup>
              
              <SettingsGroup title="Limits">
                <NumberSetting
                  label="Max Cached Items"
                  description="Maximum discovered URLs to cache"
                  value={settings.storage.maxItems}
                  onChange={(v) => updateSetting('storage', 'maxItems', v)}
                  min={100}
                  max={10000}
                />
                <NumberSetting
                  label="Max Log Entries"
                  description="Maximum log entries to keep"
                  value={settings.storage.maxLogs}
                  onChange={(v) => updateSetting('storage', 'maxLogs', v)}
                  min={100}
                  max={5000}
                />
                <ToggleSetting
                  label="Auto Cleanup"
                  description="Automatically remove old data when storage is full"
                  value={settings.storage.autoCleanup}
                  onChange={(v) => updateSetting('storage', 'autoCleanup', v)}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Actions">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleClearData}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={16} />
                    Clear Cached Data
                  </button>
                  <button
                    onClick={() => setStorageUsage(getStorageUsage())}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
                  >
                    <RefreshCw size={16} />
                    Refresh Usage
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <Info size={12} className="inline mr-1" />
                  This only clears browser cache, not the backend database
                </p>
              </SettingsGroup>
              
              <SettingsGroup title="Import / Export">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
                  >
                    <Download size={16} />
                    Export Settings
                  </button>
                  <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:text-white transition-colors cursor-pointer">
                    <Upload size={16} />
                    Import Settings
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                  </label>
                </div>
              </SettingsGroup>
            </SettingsSection>
          )}

          {/* Display Settings */}
          {activeSection === 'display' && (
            <SettingsSection title="Display Preferences" icon={Palette} description="Customize the interface">
              <SettingsGroup title="Notifications">
                <ToggleSetting
                  label="Show Notifications"
                  description="Show scan completion notifications"
                  value={settings.display.showNotifications}
                  onChange={(v) => updateSetting('display', 'showNotifications', v)}
                />
              </SettingsGroup>
              
              <SettingsGroup title="Auto Refresh">
                <ToggleSetting
                  label="Auto Refresh Data"
                  description="Automatically refresh scan results"
                  value={settings.display.autoRefresh}
                  onChange={(v) => updateSetting('display', 'autoRefresh', v)}
                />
                {settings.display.autoRefresh && (
                  <NumberSetting
                    label="Refresh Interval (seconds)"
                    description="How often to refresh"
                    value={settings.display.refreshInterval}
                    onChange={(v) => updateSetting('display', 'refreshInterval', v)}
                    min={5}
                    max={300}
                  />
                )}
              </SettingsGroup>
              
              <SettingsGroup title="Layout">
                <ToggleSetting
                  label="Compact View"
                  description="Use condensed layout for tables"
                  value={settings.display.compactView}
                  onChange={(v) => updateSetting('display', 'compactView', v)}
                />
              </SettingsGroup>
            </SettingsSection>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper Components

function SettingsSection({ title, icon: Icon, description, children }) {
  return (
    <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
      <div className="p-4 border-b border-[#1f1f1f]">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Icon size={20} className="text-emerald-400" />
          {title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="p-4 space-y-6">
        {children}
      </div>
    </div>
  )
}

function SettingsGroup({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

function ToggleSetting({ label, description, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          value ? 'bg-emerald-500' : 'bg-[#2a2a2a]'
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          value ? 'left-6' : 'left-1'
        }`} />
      </button>
    </div>
  )
}

function NumberSetting({ label, description, value, onChange, min, max }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        min={min}
        max={max}
        className="w-24 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm text-right focus:outline-none focus:border-emerald-500/50"
      />
    </div>
  )
}

function TextSetting({ label, description, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="p-3 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
      <div className="mb-2">
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
      />
    </div>
  )
}

function SelectSetting({ label, description, value, onChange, options }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#1f1f1f]">
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
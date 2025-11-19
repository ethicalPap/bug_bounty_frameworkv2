import { useState, useEffect, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { 
  Network,
  Globe,
  Activity,
  Shield,
  Zap,
  Box,
  Layers,
  AlertCircle,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Info
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const COLORS = {
  domain: '#3b82f6',
  subdomain: '#10b981',
  subdomain_inactive: '#6b7280',
  technology: '#a855f7',
  service: '#ec4899',
  endpoint: '#f59e0b'
}

const Visualization = () => {
  const queryClient = useQueryClient()
  
  const [availableDomains, setAvailableDomains] = useState([])
  const [selectedDomain, setSelectedDomain] = useState('')
  
  // View mode
  const [viewMode, setViewMode] = useState('network') // network, tech, services, attack-surface
  
  // Network graph state
  const [graphData, setGraphData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Visualization controls
  const [showInactive, setShowInactive] = useState(true)
  const [showEndpoints, setShowEndpoints] = useState(true)
  const [showTechnologies, setShowTechnologies] = useState(true)
  const [showServices, setShowServices] = useState(true)
  
  // Canvas for network visualization
  const canvasRef = useRef(null)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [hoveredNode, setHoveredNode] = useState(null)
  
  // Technology & Service data
  const [techData, setTechData] = useState(null)
  const [serviceData, setServiceData] = useState(null)
  const [attackSurfaceData, setAttackSurfaceData] = useState(null)

  // Load available domains
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

  // Fetch visualization data when domain changes
  useEffect(() => {
    if (!selectedDomain) return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch network graph data
        const graphResponse = await axios.get(
          `${API_BASE_URL}/api/v1/visualization/${selectedDomain}`
        )
        setGraphData(graphResponse.data)
        setNodes(graphResponse.data.nodes || [])
        setEdges(graphResponse.data.edges || [])

        // Fetch technology breakdown
        const techResponse = await axios.get(
          `${API_BASE_URL}/api/v1/visualization/${selectedDomain}/technology`
        )
        setTechData(techResponse.data)

        // Fetch service breakdown
        const serviceResponse = await axios.get(
          `${API_BASE_URL}/api/v1/visualization/${selectedDomain}/services`
        )
        setServiceData(serviceResponse.data)

        // Fetch attack surface
        const attackResponse = await axios.get(
          `${API_BASE_URL}/api/v1/visualization/${selectedDomain}/attack-surface`
        )
        setAttackSurfaceData(attackResponse.data)

      } catch (err) {
        console.error('Failed to fetch visualization data:', err)
        setError('Failed to load visualization data. Please ensure you have scan data for this domain.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [selectedDomain])

  // Filter nodes based on controls
  const filteredNodes = useMemo(() => {
    if (!nodes) return []

    return nodes.filter(node => {
      if (!showInactive && node.type === 'subdomain' && !node.is_active) return false
      if (!showEndpoints && node.type === 'endpoint') return false
      if (!showTechnologies && node.type === 'technology') return false
      if (!showServices && node.type === 'service') return false
      return true
    })
  }, [nodes, showInactive, showEndpoints, showTechnologies, showServices])

  // Filter edges based on visible nodes
  const filteredEdges = useMemo(() => {
    if (!edges) return []

    const nodeIds = new Set(filteredNodes.map(n => n.id))
    return edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
  }, [edges, filteredNodes])

  // Draw network graph on canvas
  useEffect(() => {
    if (!canvasRef.current || filteredNodes.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Simple force-directed layout simulation
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 3

    // Position nodes in circular layout by type
    const nodesByType = filteredNodes.reduce((acc, node) => {
      if (!acc[node.type]) acc[node.type] = []
      acc[node.type].push(node)
      return acc
    }, {})

    const types = Object.keys(nodesByType)
    const angleStep = (2 * Math.PI) / types.length

    const positionedNodes = []
    types.forEach((type, typeIndex) => {
      const typeNodes = nodesByType[type]
      const typeAngle = angleStep * typeIndex
      const typeRadius = type === 'domain' ? 0 : radius * (0.5 + typeIndex * 0.3)
      
      typeNodes.forEach((node, nodeIndex) => {
        const nodeAngle = typeAngle + (2 * Math.PI / typeNodes.length) * nodeIndex
        positionedNodes.push({
          ...node,
          x: centerX + Math.cos(nodeAngle) * typeRadius,
          y: centerY + Math.sin(nodeAngle) * typeRadius
        })
      })
    })

    // Draw edges
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    filteredEdges.forEach(edge => {
      const source = positionedNodes.find(n => n.id === edge.source)
      const target = positionedNodes.find(n => n.id === edge.target)
      
      if (source && target) {
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.stroke()
      }
    })

    // Draw nodes
    positionedNodes.forEach(node => {
      ctx.fillStyle = node.color
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI)
      ctx.fill()

      // Draw label
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px Inter'
      ctx.textAlign = 'center'
      ctx.fillText(node.label, node.x, node.y + node.size + 12)
    })

  }, [filteredNodes, filteredEdges])

  // Export visualization
  const exportVisualization = () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `${selectedDomain}-visualization-${new Date().toISOString().split('T')[0]}.png`
    link.href = dataUrl
    link.click()
  }

  // Statistics display component
  const StatsCard = ({ icon: Icon, label, value, color = 'cyber-blue' }) => (
    <div className="bg-dark-200 border border-dark-50 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 bg-${color}/10 rounded-lg`}>
          <Icon className={`text-${color}`} size={24} />
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-gray-400">{label}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Network className="text-cyber-purple" />
            Visualization & Mapping
          </h2>
          <p className="text-gray-400 mt-2">Interactive visual representation of your attack surface</p>
        </div>

        {graphData && (
          <button
            onClick={exportVisualization}
            className="flex items-center gap-2 px-4 py-2 bg-dark-100 border border-dark-50 rounded-lg text-white hover:border-cyber-purple transition-all"
          >
            <Download size={16} />
            Export
          </button>
        )}
      </div>

      {/* Domain Selection */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Domain
            </label>
            {availableDomains.length === 0 ? (
              <div className="text-center py-8 bg-dark-200 border border-dark-50 rounded-lg">
                <Globe className="mx-auto text-gray-600 mb-3" size={48} />
                <p className="text-gray-400 mb-2">No data available</p>
                <p className="text-sm text-gray-500">
                  Run scans to populate visualization data
                </p>
              </div>
            ) : (
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-4 py-3 bg-dark-200 border border-dark-50 rounded-lg text-white focus:outline-none focus:border-cyber-purple transition-all"
              >
                {availableDomains.map((domain) => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              View Mode
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'network', label: 'Network', icon: Network },
                { value: 'tech', label: 'Tech', icon: Layers },
                { value: 'services', label: 'Services', icon: Activity },
                { value: 'attack-surface', label: 'Surface', icon: Shield }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setViewMode(value)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all ${
                    viewMode === value
                      ? 'bg-cyber-purple/10 border-cyber-purple'
                      : 'bg-dark-200 border-dark-50 hover:border-gray-600'
                  }`}
                >
                  <Icon size={16} className={viewMode === value ? 'text-cyber-purple' : 'text-gray-400'} />
                  <span className={`text-xs ${viewMode === value ? 'text-white' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-cyber-purple border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400">Loading visualization data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-red-400 font-medium">Visualization Error</p>
            <p className="text-red-400/70 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Statistics Overview */}
      {graphData && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            icon={Globe}
            label="Subdomains"
            value={graphData.stats.total_subdomains}
            color="cyber-blue"
          />
          <StatsCard
            icon={Layers}
            label="Technologies"
            value={graphData.stats.total_technologies}
            color="cyber-purple"
          />
          <StatsCard
            icon={Activity}
            label="Services"
            value={graphData.stats.total_services}
            color="cyber-pink"
          />
          <StatsCard
            icon={Zap}
            label="Endpoints"
            value={graphData.stats.total_endpoints}
            color="cyber-green"
          />
        </div>
      )}

      {/* Network View */}
      {viewMode === 'network' && graphData && !isLoading && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          {/* Controls */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Network Graph</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  showInactive
                    ? 'bg-cyber-blue/10 border-cyber-blue text-cyber-blue'
                    : 'bg-dark-200 border-dark-50 text-gray-400'
                }`}
              >
                {showInactive ? <Eye size={14} /> : <EyeOff size={14} />}
                Inactive
              </button>
              <button
                onClick={() => setShowEndpoints(!showEndpoints)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  showEndpoints
                    ? 'bg-cyber-blue/10 border-cyber-blue text-cyber-blue'
                    : 'bg-dark-200 border-dark-50 text-gray-400'
                }`}
              >
                {showEndpoints ? <Eye size={14} /> : <EyeOff size={14} />}
                Endpoints
              </button>
              <button
                onClick={() => setShowTechnologies(!showTechnologies)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  showTechnologies
                    ? 'bg-cyber-blue/10 border-cyber-blue text-cyber-blue'
                    : 'bg-dark-200 border-dark-50 text-gray-400'
                }`}
              >
                {showTechnologies ? <Eye size={14} /> : <EyeOff size={14} />}
                Tech
              </button>
              <button
                onClick={() => setShowServices(!showServices)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  showServices
                    ? 'bg-cyber-blue/10 border-cyber-blue text-cyber-blue'
                    : 'bg-dark-200 border-dark-50 text-gray-400'
                }`}
              >
                {showServices ? <Eye size={14} /> : <EyeOff size={14} />}
                Services
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="bg-dark-200 border border-dark-50 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={1200}
              height={800}
              className="w-full"
            />
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.domain }}></div>
              <span className="text-gray-400">Domain</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.subdomain }}></div>
              <span className="text-gray-400">Active Subdomain</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.subdomain_inactive }}></div>
              <span className="text-gray-400">Inactive Subdomain</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.technology }}></div>
              <span className="text-gray-400">Technology</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.service }}></div>
              <span className="text-gray-400">Service</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.endpoint }}></div>
              <span className="text-gray-400">Endpoint</span>
            </div>
          </div>

          {/* Info */}
          <div className="mt-4 p-4 bg-dark-200 border border-dark-50 rounded-lg flex items-start gap-3">
            <Info className="text-cyber-purple flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-gray-400">
              <p className="mb-1">
                <span className="text-white font-medium">Network Graph:</span> Visualizes relationships between domains, subdomains, technologies, services, and endpoints.
              </p>
              <p>
                Use the toggle buttons to show/hide different entity types. Node size indicates importance/usage frequency.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Technology View */}
      {viewMode === 'tech' && techData && !isLoading && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Technology Breakdown</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div className="bg-dark-200 border border-dark-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-4">Technology Distribution</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={techData.technologies.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                    labelStyle={{ color: '#ffffff' }}
                  />
                  <Bar dataKey="count" fill="#a855f7" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="bg-dark-200 border border-dark-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-4">Technology Distribution %</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={techData.technologies.slice(0, 8)}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {techData.technologies.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Technology List */}
          <div className="mt-6 bg-dark-200 border border-dark-50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-dark-100 border-b border-dark-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Technology</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Usage Count</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Subdomains</th>
                </tr>
              </thead>
              <tbody>
                {techData.technologies.map((tech, index) => (
                  <tr key={index} className="border-b border-dark-50">
                    <td className="py-3 px-4">
                      <span className="text-white font-medium">{tech.name}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-3 py-1 bg-cyber-purple/10 text-cyber-purple rounded-full text-sm font-medium">
                        {tech.count}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-400 text-sm">
                        {tech.subdomains.slice(0, 3).join(', ')}
                        {tech.subdomains.length > 3 && ` +${tech.subdomains.length - 3} more`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Services View */}
      {viewMode === 'services' && serviceData && !isLoading && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Service & Port Analysis</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div className="bg-dark-200 border border-dark-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-4">Service Distribution</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={serviceData.services.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                    labelStyle={{ color: '#ffffff' }}
                  />
                  <Bar dataKey="count" fill="#ec4899" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="bg-dark-200 border border-dark-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-4">Port Distribution</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={serviceData.services.slice(0, 8)}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {serviceData.services.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Service List */}
          <div className="mt-6 bg-dark-200 border border-dark-50 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-dark-100 border-b border-dark-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Service</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Count</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Ports</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Versions</th>
                </tr>
              </thead>
              <tbody>
                {serviceData.services.map((service, index) => (
                  <tr key={index} className="border-b border-dark-50">
                    <td className="py-3 px-4">
                      <span className="text-white font-medium">{service.name}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-3 py-1 bg-cyber-pink/10 text-cyber-pink rounded-full text-sm font-medium">
                        {service.count}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-400 text-sm font-mono">
                        {service.ports.slice(0, 5).join(', ')}
                        {service.ports.length > 5 && ` +${service.ports.length - 5}`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-400 text-sm">
                        {service.versions.length > 0 ? service.versions[0] : 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attack Surface View */}
      {viewMode === 'attack-surface' && attackSurfaceData && !isLoading && (
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Attack Surface Analysis</h3>
          
          {/* Exposure Score */}
          <div className="mb-6 p-6 bg-gradient-to-r from-cyber-purple/10 to-cyber-pink/10 border border-cyber-purple/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Overall Exposure Score</h4>
                <div className="text-5xl font-bold text-white">
                  {attackSurfaceData.attack_surface.exposure_score}
                  <span className="text-2xl text-gray-400">/100</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {attackSurfaceData.attack_surface.exposure_score < 30 && 'Low exposure - minimal attack surface'}
                  {attackSurfaceData.attack_surface.exposure_score >= 30 && attackSurfaceData.attack_surface.exposure_score < 60 && 'Moderate exposure - standard attack surface'}
                  {attackSurfaceData.attack_surface.exposure_score >= 60 && 'High exposure - extensive attack surface'}
                </p>
              </div>
              <Shield className="text-cyber-purple" size={80} />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-dark-200 border border-dark-50 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Subdomains</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total</span>
                  <span className="text-lg font-bold text-white">
                    {attackSurfaceData.attack_surface.subdomains.total}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Active</span>
                  <span className="text-lg font-bold text-green-400">
                    {attackSurfaceData.attack_surface.subdomains.active}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Inactive</span>
                  <span className="text-lg font-bold text-gray-500">
                    {attackSurfaceData.attack_surface.subdomains.inactive}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-dark-200 border border-dark-50 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Ports & Services</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Ports</span>
                  <span className="text-lg font-bold text-white">
                    {attackSurfaceData.attack_surface.ports.total}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Open</span>
                  <span className="text-lg font-bold text-cyber-pink">
                    {attackSurfaceData.attack_surface.ports.open}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Services</span>
                  <span className="text-lg font-bold text-white">
                    {attackSurfaceData.attack_surface.ports.services}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-dark-200 border border-dark-50 rounded-lg p-6">
              <h4 className="text-sm font-medium text-gray-400 mb-4">Endpoints</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total</span>
                  <span className="text-lg font-bold text-white">
                    {attackSurfaceData.attack_surface.endpoints.total}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Interesting</span>
                  <span className="text-lg font-bold text-cyber-blue">
                    {attackSurfaceData.attack_surface.endpoints.interesting}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Technologies</span>
                  <span className="text-lg font-bold text-cyber-purple">
                    {attackSurfaceData.attack_surface.technologies.count}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="bg-dark-200 border border-dark-50 rounded-lg p-6">
            <h4 className="text-sm font-medium text-white mb-4">Attack Surface Radar</h4>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={[
                {
                  category: 'Subdomains',
                  value: Math.min(attackSurfaceData.attack_surface.subdomains.active * 2, 100)
                },
                {
                  category: 'Open Ports',
                  value: Math.min(attackSurfaceData.attack_surface.ports.open, 100)
                },
                {
                  category: 'Services',
                  value: Math.min(attackSurfaceData.attack_surface.ports.services * 5, 100)
                },
                {
                  category: 'Endpoints',
                  value: Math.min(attackSurfaceData.attack_surface.endpoints.total / 10, 100)
                },
                {
                  category: 'Technologies',
                  value: Math.min(attackSurfaceData.attack_surface.technologies.count * 10, 100)
                }
              ]}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="category" stroke="#94a3b8" />
                <PolarRadiusAxis stroke="#94a3b8" />
                <Radar
                  name="Attack Surface"
                  dataKey="value"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.3}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

export default Visualization
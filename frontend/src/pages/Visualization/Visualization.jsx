/**
 * Visualization Page - Attack Surface Mapping
 * 
 * Views:
 * - Tree: Expandable hierarchy view
 * - Grid: Card-based subdomain view  
 * - Stats: Risk breakdown and content distribution
 * - Map: Interactive network graph (canvas-based)
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Network,
  Globe,
  Activity,
  Shield,
  ShieldAlert,
  Server,
  Database,
  Link as LinkIcon,
  FolderOpen,
  FileCode,
  ChevronDown,
  ChevronRight,
  Filter,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Lock,
  Eye,
  EyeOff,
  Map,
  Layers,
  Target,
  Crosshair,
  X,
  Maximize2
} from 'lucide-react'
import { useContentDiscovery } from '../../stores/ContentDiscoveryStore'
import { getDomains, getSubdomains } from '../../api/client'

// Risk level colors
const RISK_COLORS = {
  critical: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30' },
  high: { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30' },
  medium: { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  low: { bg: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500/30' },
  info: { bg: 'bg-gray-500', text: 'text-gray-400', border: 'border-gray-500/30' }
}

// Node types for the graph
const NODE_TYPES = {
  domain: { color: '#10b981', icon: Globe, radius: 40 },
  subdomain: { color: '#3b82f6', icon: Server, radius: 22 },
  liveHost: { color: '#22c55e', icon: Activity, radius: 20 },
  api: { color: '#f97316', icon: Database, radius: 14 },
  endpoint: { color: '#6366f1', icon: LinkIcon, radius: 14 },
  directory: { color: '#eab308', icon: FolderOpen, radius: 14 },
  javascript: { color: '#a855f7', icon: FileCode, radius: 14 },
  port: { color: '#ec4899', icon: Lock, radius: 12 },
  vulnerability: { color: '#ef4444', icon: ShieldAlert, radius: 16 }
}

export default function Visualization() {
  const { items, stats, uniqueSubdomains } = useContentDiscovery()
  
  // View state
  const [selectedView, setSelectedView] = useState('tree')
  const [selectedDomain, setSelectedDomain] = useState('')
  const [expandedNodes, setExpandedNodes] = useState(new Set())
  const [selectedNode, setSelectedNode] = useState(null)
  
  // Map view state
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const [mapNodes, setMapNodes] = useState([])
  const [mapEdges, setMapEdges] = useState([])
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [draggedNode, setDraggedNode] = useState(null)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [visibleTypes, setVisibleTypes] = useState(new Set(Object.keys(NODE_TYPES)))
  const [showFilters, setShowFilters] = useState(false)
  
  // Data from various sources
  const [liveHosts, setLiveHosts] = useState([])
  const [portScans, setPortScans] = useState([])
  const [vulnFindings, setVulnFindings] = useState([])

  // Fetch domains
  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: getDomains,
    staleTime: 30000,
  })

  const availableDomains = useMemo(() => {
    if (!domainsData) return []
    if (Array.isArray(domainsData)) {
      return domainsData.map(d => typeof d === 'string' ? d : d.domain || d.name).filter(Boolean)
    }
    return []
  }, [domainsData])

  // Fetch subdomains for selected domain
  const { data: subdomainsData } = useQuery({
    queryKey: ['subdomains', selectedDomain],
    queryFn: () => getSubdomains(selectedDomain),
    enabled: !!selectedDomain,
    staleTime: 60000,
  })

  const subdomainsList = useMemo(() => {
    if (!subdomainsData) return []
    let subs = Array.isArray(subdomainsData) ? subdomainsData : 
               subdomainsData.data || subdomainsData.subdomains || []
    return subs.map(s => typeof s === 'string' ? { full_domain: s } : s)
  }, [subdomainsData])

  // Load data from localStorage
  useEffect(() => {
    try {
      const savedHosts = localStorage.getItem('live_hosts_results')
      if (savedHosts) {
        const parsed = JSON.parse(savedHosts)
        setLiveHosts(Array.isArray(parsed) ? parsed : (parsed.results || []))
      }
      
      const savedPorts = localStorage.getItem('port_scan_results')
      if (savedPorts) {
        const parsed = JSON.parse(savedPorts)
        setPortScans(Array.isArray(parsed) ? parsed : (parsed.results || []))
      }
      
      const savedVulns = localStorage.getItem('vuln_scan_results')
      if (savedVulns) {
        const parsed = JSON.parse(savedVulns)
        setVulnFindings(Array.isArray(parsed) ? parsed : (parsed.findings || []))
      }
    } catch (e) {
      console.error('Error loading data:', e)
    }
  }, [])

  // Auto-select first domain
  useEffect(() => {
    if (availableDomains.length > 0 && !selectedDomain) {
      setSelectedDomain(availableDomains[0])
    }
  }, [availableDomains, selectedDomain])

  // Build attack surface data structure
  const attackSurface = useMemo(() => {
    if (!selectedDomain) return null

    const domainSubdomains = subdomainsList.filter(s => 
      s.full_domain?.endsWith(selectedDomain) || s.domain === selectedDomain
    )

    const domainLiveHosts = liveHosts.filter(h => 
      h.subdomain?.endsWith(selectedDomain) || h.domain === selectedDomain
    )

    const domainContent = items.filter(i => 
      i.subdomain?.endsWith(selectedDomain) || i.target_url?.includes(selectedDomain)
    )

    const domainPorts = portScans.filter(p => 
      p.target?.endsWith(selectedDomain) || p.host?.endsWith(selectedDomain)
    )

    const domainVulns = vulnFindings.filter(v =>
      v.target?.includes(selectedDomain) || v.host?.includes(selectedDomain)
    )

    const apiCount = domainContent.filter(i => i.content_type === 'api').length
    const endpointCount = domainContent.filter(i => i.content_type === 'endpoint').length
    const directoryCount = domainContent.filter(i => i.content_type === 'directory').length
    const jsCount = domainContent.filter(i => i.content_type === 'javascript').length
    const interestingCount = domainContent.filter(i => i.is_interesting).length
    
    const openPorts = domainPorts.filter(p => p.state === 'open').length
    const criticalVulns = domainVulns.filter(v => v.severity === 'critical').length
    const highVulns = domainVulns.filter(v => v.severity === 'high').length

    let riskScore = 0
    riskScore += criticalVulns * 40
    riskScore += highVulns * 20
    riskScore += interestingCount * 5
    riskScore += openPorts * 2
    riskScore += apiCount * 3
    riskScore = Math.min(riskScore, 100)

    const riskLevel = riskScore >= 80 ? 'critical' : 
                      riskScore >= 60 ? 'high' : 
                      riskScore >= 40 ? 'medium' : 
                      riskScore >= 20 ? 'low' : 'info'

    return {
      domain: selectedDomain,
      subdomains: domainSubdomains,
      liveHosts: domainLiveHosts,
      content: domainContent,
      ports: domainPorts,
      vulnerabilities: domainVulns,
      stats: {
        subdomainCount: domainSubdomains.length,
        liveHostCount: domainLiveHosts.filter(h => h.is_active).length,
        totalContent: domainContent.length,
        apis: apiCount,
        endpoints: endpointCount,
        directories: directoryCount,
        javascript: jsCount,
        interesting: interestingCount,
        openPorts,
        criticalVulns,
        highVulns,
        totalVulns: domainVulns.length,
        riskScore,
        riskLevel
      }
    }
  }, [selectedDomain, subdomainsList, liveHosts, items, portScans, vulnFindings])

  // Build graph nodes and edges for tree view
  const graphData = useMemo(() => {
    if (!attackSurface) return { nodes: [], edges: [] }

    const nodes = []
    const edges = []
    
    nodes.push({
      id: `domain-${attackSurface.domain}`,
      type: 'domain',
      label: attackSurface.domain,
      data: { ...attackSurface.stats }
    })

    attackSurface.subdomains.forEach(sub => {
      const name = sub.full_domain || sub.subdomain || sub.name
      if (!name) return
      
      const isLive = attackSurface.liveHosts.some(h => h.subdomain === name && h.is_active)
      const subContent = attackSurface.content.filter(c => c.subdomain === name)
      const subPorts = attackSurface.ports.filter(p => p.target === name || p.host === name)
      const subVulns = attackSurface.vulnerabilities.filter(v => v.target?.includes(name))
      
      nodes.push({
        id: `subdomain-${name}`,
        type: isLive ? 'liveHost' : 'subdomain',
        label: name.replace(`.${attackSurface.domain}`, ''),
        fullLabel: name,
        data: {
          isLive,
          contentCount: subContent.length,
          portCount: subPorts.length,
          vulnCount: subVulns.length,
          apis: subContent.filter(c => c.content_type === 'api').length,
          endpoints: subContent.filter(c => c.content_type === 'endpoint').length,
          statusCode: attackSurface.liveHosts.find(h => h.subdomain === name)?.status_code
        }
      })
      
      edges.push({
        from: `domain-${attackSurface.domain}`,
        to: `subdomain-${name}`
      })

      if (expandedNodes.has(`subdomain-${name}`)) {
        subContent.filter(c => c.content_type === 'api').slice(0, 10).forEach((api, i) => {
          nodes.push({
            id: `api-${name}-${i}`,
            type: 'api',
            label: api.path || new URL(api.discovered_url || api.url || 'http://x').pathname,
            data: api
          })
          edges.push({ from: `subdomain-${name}`, to: `api-${name}-${i}` })
        })
        
        subContent.filter(c => c.content_type === 'endpoint').slice(0, 10).forEach((ep, i) => {
          nodes.push({
            id: `endpoint-${name}-${i}`,
            type: 'endpoint',
            label: ep.path || new URL(ep.discovered_url || ep.url || 'http://x').pathname,
            data: ep
          })
          edges.push({ from: `subdomain-${name}`, to: `endpoint-${name}-${i}` })
        })

        subPorts.filter(p => p.state === 'open').slice(0, 10).forEach((port, i) => {
          nodes.push({
            id: `port-${name}-${i}`,
            type: 'port',
            label: `${port.port}/${port.protocol || 'tcp'}`,
            data: port
          })
          edges.push({ from: `subdomain-${name}`, to: `port-${name}-${i}` })
        })

        subVulns.slice(0, 5).forEach((vuln, i) => {
          nodes.push({
            id: `vuln-${name}-${i}`,
            type: 'vulnerability',
            label: vuln.name || vuln.title || vuln.id,
            data: vuln
          })
          edges.push({ from: `subdomain-${name}`, to: `vuln-${name}-${i}` })
        })
      }
    })

    return { nodes, edges }
  }, [attackSurface, expandedNodes])

  // Build map graph when view changes to map
  useEffect(() => {
    if (selectedView !== 'map' || !attackSurface) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const newNodes = []
    const newEdges = []

    // Root domain at center
    newNodes.push({
      id: `domain-${attackSurface.domain}`,
      type: 'domain',
      label: attackSurface.domain,
      x: centerX,
      y: centerY,
      data: {}
    })

    // Subdomains in a circle
    const subs = attackSurface.subdomains.slice(0, 50)
    const subRadius = 180
    const subAngleStep = (2 * Math.PI) / Math.max(subs.length, 1)
    
    subs.forEach((sub, i) => {
      const name = sub.full_domain || sub.subdomain || sub.name
      if (!name) return
      
      const isLive = attackSurface.liveHosts.some(h => h.subdomain === name && h.is_active)
      const angle = i * subAngleStep - Math.PI / 2
      
      const subNode = {
        id: `subdomain-${name}`,
        type: isLive ? 'liveHost' : 'subdomain',
        label: name.replace(`.${attackSurface.domain}`, ''),
        fullLabel: name,
        x: centerX + Math.cos(angle) * subRadius,
        y: centerY + Math.sin(angle) * subRadius,
        data: {
          isLive,
          statusCode: attackSurface.liveHosts.find(h => h.subdomain === name)?.status_code
        }
      }
      newNodes.push(subNode)
      newEdges.push({ source: `domain-${attackSurface.domain}`, target: subNode.id })

      // Content around subdomain
      const subContent = attackSurface.content.filter(item => item.subdomain === name)
      const subPorts = attackSurface.ports.filter(p => (p.target === name || p.host === name) && p.state === 'open')
      const subVulns = attackSurface.vulnerabilities.filter(v => v.target?.includes(name))

      const contentItems = [
        ...subContent.filter(c => c.content_type === 'api').slice(0, 3).map(c => ({ ...c, nodeType: 'api' })),
        ...subContent.filter(c => c.content_type === 'endpoint').slice(0, 3).map(c => ({ ...c, nodeType: 'endpoint' })),
        ...subPorts.slice(0, 2).map(p => ({ ...p, nodeType: 'port' })),
        ...subVulns.slice(0, 2).map(v => ({ ...v, nodeType: 'vulnerability' }))
      ]

      const contentRadius = 50
      const contentAngleStep = (2 * Math.PI) / Math.max(contentItems.length, 1)
      
      contentItems.forEach((item, j) => {
        const contentAngle = j * contentAngleStep
        let label = ''
        
        if (item.nodeType === 'port') {
          label = `${item.port}`
        } else if (item.nodeType === 'vulnerability') {
          label = item.name || item.id || 'vuln'
        } else {
          try {
            label = item.path || new URL(item.discovered_url || item.url || 'http://x').pathname
          } catch {
            label = 'unknown'
          }
        }
        
        const contentNode = {
          id: `${item.nodeType}-${name}-${j}`,
          type: item.nodeType,
          label: label.length > 12 ? label.slice(0, 10) + '..' : label,
          fullLabel: label,
          x: subNode.x + Math.cos(contentAngle) * contentRadius,
          y: subNode.y + Math.sin(contentAngle) * contentRadius,
          data: item
        }
        newNodes.push(contentNode)
        newEdges.push({ source: subNode.id, target: contentNode.id })
      })
    })

    setMapNodes(newNodes)
    setMapEdges(newEdges)
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [selectedView, attackSurface])

  // Canvas resize
  useEffect(() => {
    if (selectedView !== 'map') return
    
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [selectedView])

  // Draw canvas
  useEffect(() => {
    if (selectedView !== 'map') return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      ctx.save()
      ctx.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y)
      ctx.scale(transform.scale, transform.scale)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)

      // Draw edges
      mapEdges.forEach(edge => {
        const source = mapNodes.find(n => n.id === edge.source)
        const target = mapNodes.find(n => n.id === edge.target)
        if (!source || !target) return
        if (!visibleTypes.has(source.type) || !visibleTypes.has(target.type)) return
        
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.strokeStyle = '#1f1f1f'
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // Draw nodes
      mapNodes.forEach(node => {
        if (!visibleTypes.has(node.type)) return
        
        const config = NODE_TYPES[node.type]
        const isSelected = selectedNode?.id === node.id
        
        ctx.beginPath()
        ctx.arc(node.x, node.y, config.radius, 0, Math.PI * 2)
        ctx.fillStyle = isSelected ? config.color : `${config.color}30`
        ctx.fill()
        ctx.strokeStyle = config.color
        ctx.lineWidth = isSelected ? 3 : 1.5
        ctx.stroke()

        if (node.data?.isLive) {
          ctx.beginPath()
          ctx.arc(node.x + config.radius - 4, node.y - config.radius + 4, 5, 0, Math.PI * 2)
          ctx.fillStyle = '#22c55e'
          ctx.fill()
        }

        ctx.fillStyle = '#ffffff'
        ctx.font = `${config.radius > 18 ? '11px' : '9px'} Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.label, node.x, node.y + config.radius + 12)
      })

      ctx.restore()
    }
    
    draw()
  }, [selectedView, mapNodes, mapEdges, transform, selectedNode, visibleTypes])

  // Map mouse handlers
  const findNodeAt = (x, y) => {
    const canvas = canvasRef.current
    const canvasX = (x - canvas.width / 2 - transform.x) / transform.scale + canvas.width / 2
    const canvasY = (y - canvas.height / 2 - transform.y) / transform.scale + canvas.height / 2
    
    return mapNodes.find(node => {
      if (!visibleTypes.has(node.type)) return false
      const config = NODE_TYPES[node.type]
      const dx = node.x - canvasX
      const dy = node.y - canvasY
      return Math.sqrt(dx * dx + dy * dy) < config.radius
    })
  }

  const handleMouseDown = (e) => {
    if (selectedView !== 'map') return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const clickedNode = findNodeAt(x, y)
    
    if (clickedNode) {
      setDraggedNode(clickedNode)
      setSelectedNode(clickedNode)
    } else {
      setIsDragging(true)
    }
    
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e) => {
    if (selectedView !== 'map') return
    const dx = e.clientX - lastMousePos.x
    const dy = e.clientY - lastMousePos.y
    
    if (draggedNode) {
      setMapNodes(prev => prev.map(n => 
        n.id === draggedNode.id 
          ? { ...n, x: n.x + dx / transform.scale, y: n.y + dy / transform.scale }
          : n
      ))
    } else if (isDragging) {
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
    
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setDraggedNode(null)
  }

  const handleWheel = (e) => {
    if (selectedView !== 'map') return
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(prev => ({ ...prev, scale: Math.min(Math.max(prev.scale * delta, 0.3), 3) }))
  }

  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const toggleType = (type) => {
    setVisibleTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const RiskBadge = ({ level, score }) => {
    const colors = RISK_COLORS[level] || RISK_COLORS.info
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.bg}/20 ${colors.border} border`}>
        <Shield size={14} className={colors.text} />
        <span className={`text-sm font-medium ${colors.text}`}>{level.toUpperCase()} ({score})</span>
      </div>
    )
  }

  const TreeNode = ({ node, depth = 0 }) => {
    const config = NODE_TYPES[node.type]
    const Icon = config?.icon || Globe
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = graphData.edges.some(e => e.from === node.id)
    const isSelected = selectedNode?.id === node.id
    
    return (
      <div style={{ marginLeft: depth * 20 }}>
        <div
          onClick={() => {
            setSelectedNode(node)
            if (hasChildren || node.type === 'subdomain' || node.type === 'liveHost') toggleNode(node.id)
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
            isSelected ? 'bg-emerald-500/20 border border-emerald-500/30' : 'hover:bg-[#1a1a1a] border border-transparent'
          }`}
        >
          {(hasChildren || node.type === 'subdomain' || node.type === 'liveHost') ? (
            isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />
          ) : <span className="w-3.5" />}
          
          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${config?.color}20` }}>
            <Icon size={14} style={{ color: config?.color }} />
          </div>
          
          <span className="text-sm text-white font-medium truncate flex-1">{node.label}</span>
          
          {node.data?.isLive && <span className="w-2 h-2 rounded-full bg-green-500" />}
          {node.data?.contentCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">{node.data.contentCount}</span>
          )}
          {node.data?.vulnCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{node.data.vulnCount} vulns</span>
          )}
        </div>
        
        {isExpanded && (
          <div>
            {graphData.nodes
              .filter(n => graphData.edges.some(e => e.from === node.id && e.to === n.id))
              .map(childNode => <TreeNode key={childNode.id} node={childNode} depth={depth + 1} />)
            }
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Map size={24} className="text-emerald-400" />
            </div>
            Attack Surface Map
          </h1>
          <p className="text-gray-500 mt-1">Comprehensive visualization of all reconnaissance data</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="bg-[#111111] border border-[#1f1f1f] rounded-xl px-4 py-2 text-white text-sm focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="">Select domain...</option>
            {availableDomains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          
          <div className="flex items-center gap-1 bg-[#111111] rounded-xl p-1 border border-[#1f1f1f]">
            {[
              { id: 'tree', icon: Network, label: 'Tree' },
              { id: 'grid', icon: Layers, label: 'Grid' },
              { id: 'stats', icon: Target, label: 'Stats' },
              { id: 'map', icon: Crosshair, label: 'Map' }
            ].map(view => (
              <button
                key={view.id}
                onClick={() => setSelectedView(view.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedView === view.id ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <view.icon size={14} />
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {attackSurface && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { icon: Globe, label: 'Subdomains', value: attackSurface.stats.subdomainCount, color: 'blue' },
            { icon: Activity, label: 'Live Hosts', value: attackSurface.stats.liveHostCount, color: 'green' },
            { icon: Database, label: 'APIs', value: attackSurface.stats.apis, color: 'orange' },
            { icon: LinkIcon, label: 'Endpoints', value: attackSurface.stats.endpoints, color: 'indigo' },
            { icon: FolderOpen, label: 'Directories', value: attackSurface.stats.directories, color: 'yellow' },
            { icon: FileCode, label: 'JS Files', value: attackSurface.stats.javascript, color: 'purple' },
            { icon: Lock, label: 'Open Ports', value: attackSurface.stats.openPorts, color: 'pink' },
          ].map(item => (
            <div key={item.label} className="bg-[#111111] rounded-xl p-4 border border-[#1f1f1f]">
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={16} className={`text-${item.color}-400`} />
                <span className="text-xs text-gray-500">{item.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{item.value}</div>
            </div>
          ))}
          <div className={`rounded-xl p-4 border ${RISK_COLORS[attackSurface.stats.riskLevel].border} ${RISK_COLORS[attackSurface.stats.riskLevel].bg}/10`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} className={RISK_COLORS[attackSurface.stats.riskLevel].text} />
              <span className="text-xs text-gray-500">Risk Score</span>
            </div>
            <div className={`text-2xl font-bold ${RISK_COLORS[attackSurface.stats.riskLevel].text}`}>{attackSurface.stats.riskScore}</div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {selectedView === 'map' ? (
        // Map View
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden" style={{ height: '600px' }}>
          <div className="p-3 border-b border-[#1f1f1f] flex items-center justify-between">
            <span className="text-sm text-gray-400">Drag to pan • Scroll to zoom • Click nodes to select</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#1a1a1a]">
                <ZoomIn size={16} />
              </button>
              <span className="text-xs text-gray-500 w-12 text-center">{Math.round(transform.scale * 100)}%</span>
              <button onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(prev.scale * 0.8, 0.3) }))} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#1a1a1a]">
                <ZoomOut size={16} />
              </button>
              <button onClick={() => setShowFilters(!showFilters)} className={`p-1.5 rounded ${showFilters ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white'}`}>
                <Filter size={16} />
              </button>
              <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#1a1a1a]">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          
          <div className="flex" style={{ height: 'calc(100% - 49px)' }}>
            <div ref={containerRef} className="flex-1 relative bg-[#0a0a0a]">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className="cursor-grab active:cursor-grabbing"
              />
              
              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-[#111111]/95 backdrop-blur rounded-lg border border-[#1f1f1f] p-2">
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(NODE_TYPES).map(([type, config]) => (
                    <button key={type} onClick={() => toggleType(type)} className={`flex items-center gap-1.5 ${visibleTypes.has(type) ? 'opacity-100' : 'opacity-40'}`}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                      <span className="text-xs text-gray-400 capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Filter panel */}
            {showFilters && (
              <div className="w-48 border-l border-[#1f1f1f] p-3 overflow-y-auto">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Filter Nodes</h4>
                <div className="space-y-1">
                  {Object.entries(NODE_TYPES).map(([type, config]) => {
                    const Icon = config.icon
                    return (
                      <button key={type} onClick={() => toggleType(type)} className={`w-full flex items-center gap-2 p-2 rounded-lg text-left ${visibleTypes.has(type) ? 'bg-emerald-500/10' : 'opacity-50'}`}>
                        <Icon size={12} style={{ color: config.color }} />
                        <span className="text-xs text-white capitalize">{type}</span>
                        {visibleTypes.has(type) ? <Eye size={10} className="ml-auto text-emerald-400" /> : <EyeOff size={10} className="ml-auto text-gray-500" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Node details */}
            {selectedNode && (
              <div className="w-64 border-l border-[#1f1f1f] p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-white">Details</h4>
                  <button onClick={() => setSelectedNode(null)} className="p-1 text-gray-400 hover:text-white"><X size={14} /></button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${NODE_TYPES[selectedNode.type]?.color}20` }}>
                      {(() => { const Icon = NODE_TYPES[selectedNode.type]?.icon || Globe; return <Icon size={16} style={{ color: NODE_TYPES[selectedNode.type]?.color }} /> })()}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{selectedNode.type}</p>
                      <p className="text-sm text-white font-medium truncate">{selectedNode.fullLabel || selectedNode.label}</p>
                    </div>
                  </div>
                  {selectedNode.data?.isLive !== undefined && (
                    <div className="flex items-center gap-2">
                      {selectedNode.data.isLive ? <><CheckCircle size={14} className="text-green-400" /><span className="text-sm text-green-400">Live</span></> : <><AlertTriangle size={14} className="text-yellow-400" /><span className="text-sm text-yellow-400">Not Responding</span></>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Tree/Grid/Stats Views
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
            <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Network size={16} className="text-emerald-400" />
                Attack Surface {selectedView === 'tree' ? 'Tree' : selectedView === 'grid' ? 'Grid' : 'Stats'}
              </h3>
              {selectedView === 'tree' && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setExpandedNodes(new Set())} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1a1a1a]" title="Collapse All"><ZoomOut size={14} /></button>
                  <button onClick={() => setExpandedNodes(new Set(graphData.nodes.filter(n => n.type === 'subdomain' || n.type === 'liveHost').map(n => n.id)))} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#1a1a1a]" title="Expand All"><ZoomIn size={14} /></button>
                </div>
              )}
            </div>
            
            <div className="p-4 max-h-[600px] overflow-y-auto">
              {selectedView === 'tree' && graphData.nodes.length > 0 ? (
                <div className="space-y-1">
                  {graphData.nodes.filter(n => n.type === 'domain').map(node => <TreeNode key={node.id} node={node} depth={0} />)}
                </div>
              ) : selectedView === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {graphData.nodes.filter(n => n.type === 'subdomain' || n.type === 'liveHost').map(node => {
                    const config = NODE_TYPES[node.type]
                    const Icon = config?.icon || Globe
                    return (
                      <div key={node.id} onClick={() => { setSelectedNode(node); toggleNode(node.id) }} className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedNode?.id === node.id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#0a0a0a] border-[#1f1f1f] hover:border-[#252525]'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${config?.color}20` }}><Icon size={14} style={{ color: config?.color }} /></div>
                          {node.data?.isLive && <span className="w-2 h-2 rounded-full bg-green-500" />}
                        </div>
                        <p className="text-sm text-white font-mono truncate">{node.label}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {node.data?.apis > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">{node.data.apis} APIs</span>}
                          {node.data?.portCount > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400">{node.data.portCount} ports</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : selectedView === 'stats' && attackSurface ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Risk Breakdown</h4>
                    <div className="space-y-2">
                      {[
                        { label: 'Critical Vulns', value: attackSurface.stats.criticalVulns, color: 'text-red-400' },
                        { label: 'High Vulns', value: attackSurface.stats.highVulns, color: 'text-orange-400' },
                        { label: 'Interesting Findings', value: attackSurface.stats.interesting, color: 'text-yellow-400' },
                        { label: 'Total Vulns', value: attackSurface.stats.totalVulns, color: 'text-white' },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">{item.label}</span>
                          <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Content Distribution</h4>
                    <div className="space-y-2">
                      {[
                        { label: 'APIs', value: attackSurface.stats.apis, color: 'bg-orange-500' },
                        { label: 'Endpoints', value: attackSurface.stats.endpoints, color: 'bg-indigo-500' },
                        { label: 'Directories', value: attackSurface.stats.directories, color: 'bg-yellow-500' },
                        { label: 'JS Files', value: attackSurface.stats.javascript, color: 'bg-purple-500' }
                      ].map(item => {
                        const total = attackSurface.stats.totalContent || 1
                        const pct = Math.round((item.value / total) * 100)
                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-400">{item.label}</span>
                              <span className="text-white">{item.value} ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Network className="mx-auto text-gray-600 mb-3" size={48} />
                  <p className="text-gray-400">Select a domain to view attack surface</p>
                </div>
              )}
            </div>
          </div>

          {/* Node Details Panel */}
          <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden">
            <div className="p-4 border-b border-[#1f1f1f]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye size={16} className="text-emerald-400" />
                {selectedNode ? 'Node Details' : 'Select a Node'}
              </h3>
            </div>
            <div className="p-4">
              {selectedNode ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: `${NODE_TYPES[selectedNode.type]?.color}20` }}>
                      {(() => { const Icon = NODE_TYPES[selectedNode.type]?.icon || Globe; return <Icon size={20} style={{ color: NODE_TYPES[selectedNode.type]?.color }} /> })()}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">{selectedNode.type}</p>
                      <p className="text-white font-medium">{selectedNode.fullLabel || selectedNode.label}</p>
                    </div>
                  </div>
                  {selectedNode.data?.isLive !== undefined && (
                    <div className="flex items-center gap-2">
                      {selectedNode.data.isLive ? <><CheckCircle size={14} className="text-green-400" /><span className="text-sm text-green-400">Live</span></> : <><AlertTriangle size={14} className="text-yellow-400" /><span className="text-sm text-yellow-400">Not Responding</span></>}
                      {selectedNode.data.statusCode && <span className="text-xs px-2 py-0.5 rounded bg-[#1a1a1a] text-gray-400">HTTP {selectedNode.data.statusCode}</span>}
                    </div>
                  )}
                  {(selectedNode.type === 'subdomain' || selectedNode.type === 'liveHost') && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'APIs', value: selectedNode.data?.apis || 0, color: 'text-orange-400' },
                        { label: 'Endpoints', value: selectedNode.data?.endpoints || 0, color: 'text-indigo-400' },
                        { label: 'Ports', value: selectedNode.data?.portCount || 0, color: 'text-pink-400' },
                        { label: 'Vulns', value: selectedNode.data?.vulnCount || 0, color: 'text-red-400' },
                      ].map(item => (
                        <div key={item.label} className="bg-[#0a0a0a] rounded-lg p-3">
                          <p className="text-xs text-gray-500">{item.label}</p>
                          <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedNode.type === 'domain' && attackSurface && (
                    <div className="space-y-3">
                      <RiskBadge level={attackSurface.stats.riskLevel} score={attackSurface.stats.riskScore} />
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Subdomains', value: attackSurface.stats.subdomainCount, color: 'text-blue-400' },
                          { label: 'Live Hosts', value: attackSurface.stats.liveHostCount, color: 'text-green-400' },
                          { label: 'Total Content', value: attackSurface.stats.totalContent, color: 'text-emerald-400' },
                          { label: 'Interesting', value: attackSurface.stats.interesting, color: 'text-yellow-400' },
                        ].map(item => (
                          <div key={item.label} className="bg-[#0a0a0a] rounded-lg p-3">
                            <p className="text-xs text-gray-500">{item.label}</p>
                            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(selectedNode.type === 'api' || selectedNode.type === 'endpoint') && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">URL</p>
                      <p className="text-sm text-emerald-400 font-mono break-all">{selectedNode.data?.discovered_url || selectedNode.data?.url}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Crosshair className="mx-auto text-gray-600 mb-3" size={32} />
                  <p className="text-sm text-gray-500">Click on a node to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend (for non-map views) */}
      {selectedView !== 'map' && (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(NODE_TYPES).map(([type, config]) => {
              const Icon = config.icon
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${config.color}20` }}><Icon size={12} style={{ color: config.color }} /></div>
                  <span className="text-xs text-gray-400 capitalize">{type}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
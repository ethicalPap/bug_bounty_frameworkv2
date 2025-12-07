/**
 * Layout - Main app layout with sidebar
 * All routes are workspace-scoped: /workspace/:workspaceId/...
 */

import { useState } from 'react'
import { Link, Outlet, useParams, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Globe,
  Activity,
  Network,
  Search,
  Shield,
  Zap,
  BarChart3,
  History,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Menu,
  Home
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '' },
  { id: 'auto-scan', label: 'Auto Scan', icon: Zap, path: '/auto-scan' },
  { id: 'subdomains', label: 'Subdomains', icon: Globe, path: '/subdomain-scanner' },
  { id: 'live-hosts', label: 'Live Hosts', icon: Activity, path: '/live-hosts' },
  { id: 'ports', label: 'Port Scanner', icon: Network, path: '/port-scanner' },
  { id: 'content', label: 'Content Discovery', icon: Search, path: '/content-discovery' },
  { id: 'vulns', label: 'Vulnerabilities', icon: Shield, path: '/vuln-scanner' },
  { id: 'divider-1', type: 'divider' },
  { id: 'visualization', label: 'Visualization', icon: BarChart3, path: '/visualization' },
  { id: 'history', label: 'History', icon: History, path: '/history' },
  { id: 'exports', label: 'Exports', icon: Download, path: '/exports' },
  { id: 'divider-2', type: 'divider' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
]

export default function Layout() {
  const { workspaceId } = useParams()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  
  // Get current workspace info from localStorage
  const getWorkspaceName = () => {
    try {
      const active = JSON.parse(localStorage.getItem('active_workspace') || '{}')
      return active.name || 'Workspace'
    } catch (e) {
      return 'Workspace'
    }
  }

  // Build workspace-prefixed path
  const getPath = (itemPath) => {
    return `/workspace/${workspaceId}${itemPath}`
  }

  // Check if nav item is active
  const isActive = (itemPath) => {
    const fullPath = getPath(itemPath)
    if (itemPath === '') {
      // Dashboard - match exact or /dashboard
      return location.pathname === `/workspace/${workspaceId}` || 
             location.pathname === `/workspace/${workspaceId}/` ||
             location.pathname === `/workspace/${workspaceId}/dashboard`
    }
    return location.pathname.startsWith(fullPath)
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside 
        className={`${collapsed ? 'w-16' : 'w-64'} bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col transition-all duration-300`}
      >
        {/* Logo / Workspace */}
        <div className="p-4 border-b border-[#1a1a1a]">
          <Link 
            to="/"
            className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">BB</span>
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <div className="text-white font-semibold text-sm truncate">Bug Bounty</div>
                <div className="text-emerald-400 text-xs truncate">{getWorkspaceName()}</div>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            if (item.type === 'divider') {
              return <div key={item.id} className="my-2 border-t border-[#1a1a1a]" />
            }

            const Icon = item.icon
            const active = isActive(item.path)

            return (
              <Link
                key={item.id}
                to={getPath(item.path)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${
                  active 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-2 border-t border-[#1a1a1a]">
          {/* Switch workspace */}
          <Link
            to="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#111111] transition-all ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Switch Workspace' : undefined}
          >
            <FolderOpen size={20} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm">Workspaces</span>}
          </Link>
          
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#111111] transition-all mt-1 ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!collapsed && <span className="text-sm">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
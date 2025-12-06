import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { 
  Home, 
  Globe, 
  Activity, 
  Search, 
  Network, 
  BarChart3, 
  History as HistoryIcon, 
  ChevronDown, 
  ChevronRight, 
  Radar, 
  Target, 
  FileText, 
  Download,
  Shield,
  Scan,
  Bug,
  Bell,
  Settings,
  FolderOpen,
  Database,
  Link as LinkIcon,
  FileCode,
  Layers
} from 'lucide-react'

const Layout = () => {
  const location = useLocation()
  const [expandedSections, setExpandedSections] = useState({
    recon: true,
    content: true,
    analyze: true,
    reports: true
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const navigationStructure = [
    {
      label: 'Auto Scan',
      path: '/auto-scan',
      icon: Scan,
      standalone: true
,   },
    {
      label: 'Dashboard',
      path: '/',
      icon: Home,
      standalone: true
    },
    {
      label: 'Reconnaissance',
      icon: Radar,
      section: 'recon',
      children: [
        { path: '/subdomain-scanner', label: 'Subdomains', icon: Globe },
        { path: '/live-hosts', label: 'Live Hosts', icon: Activity },
        { path: '/port-scanner', label: 'Port Scanner', icon: Network },
      ]
    },
    {
      label: 'Content Discovery',
      icon: Layers,
      section: 'content',
      children: [
        { path: '/content-discovery', label: 'All Content', icon: Search },
        { path: '/content-discovery/apis', label: 'APIs', icon: Database },
        { path: '/content-discovery/endpoints', label: 'Endpoints', icon: LinkIcon },
        { path: '/content-discovery/directories', label: 'Directories', icon: FolderOpen },
        { path: '/content-discovery/js-files', label: 'JS Files', icon: FileCode },
      ]
    },
    {
      label: 'Analyze',
      icon: Target,
      section: 'analyze',
      children: [
        { path: '/vuln-scanner', label: 'Vulnerability Scanner', icon: Bug },
        { path: '/visualization', label: 'Visualization', icon: BarChart3 },
      ]
    },
    {
      label: 'Reports',
      icon: FileText,
      section: 'reports',
      children: [
        { path: '/exports', label: 'Exports', icon: Download },
        { path: '/history', label: 'Scan History', icon: HistoryIcon },
      ]
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      standalone: true
    }
  ]

  const isPathActive = (path) => {
    // Exact match
    if (location.pathname === path) return true
    // For content-discovery subroutes, match if starts with the path
    if (path.startsWith('/content-discovery/') && location.pathname.startsWith(path)) return true
    return false
  }
  const isSectionActive = (children) => children.some(child => {
    if (location.pathname === child.path) return true
    // Special handling for content discovery section
    if (child.path === '/content-discovery' && location.pathname.startsWith('/content-discovery')) return true
    return false
  })

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111111] border-r border-[#1f1f1f] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Bug Bounty</h1>
              <p className="text-xs text-gray-500">Reconnaissance Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigationStructure.map((item) => {
            const Icon = item.icon
            
            // Standalone items (like Dashboard)
            if (item.standalone) {
              const isActive = isPathActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white border border-transparent'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            }
            
            // Sections with children
            const isExpanded = expandedSections[item.section]
            const hasActiveChild = isSectionActive(item.children)
            
            return (
              <div key={item.section}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(item.section)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-150 ${
                    hasActiveChild
                      ? 'bg-[#1a1a1a] text-white border border-[#252525]'
                      : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                    <ChevronDown size={16} />
                  </div>
                </button>

                {/* Section Children */}
                <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-[#252525] pl-4">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      const isActive = isPathActive(child.path)
                      
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'text-gray-500 hover:bg-[#1a1a1a] hover:text-white'
                          }`}
                        >
                          <ChildIcon size={18} />
                          <span className="text-sm font-medium">{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#1f1f1f]">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>v2.0.0</span>
            <span>Built with ❤️</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-[#111111] border-b border-[#1f1f1f] flex items-center justify-between px-6">
          {/* Search */}
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full bg-[#1a1a1a] border border-[#252525] rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Active Scans */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] rounded-lg border border-[#252525]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-gray-400">0 active</span>
            </div>

            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-gray-400 hover:bg-[#1a1a1a] hover:text-white transition-colors">
              <Bell size={20} />
            </button>

            {/* Settings */}
            <button className="p-2 rounded-lg text-gray-400 hover:bg-[#1a1a1a] hover:text-white transition-colors">
              <Settings size={20} />
            </button>

            {/* User */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-sm font-semibold text-white ml-2">
              P
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-[#0a0a0a]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Home, Globe, Activity, Search, Network, BarChart3, History as HistoryIcon, ChevronDown, ChevronRight, Radar, Target, FileText, Download } from 'lucide-react'

const Layout = () => {
  const location = useLocation()
  const [expandedSections, setExpandedSections] = useState({
    recon: true,
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
        { path: '/content-discovery', label: 'Content Discovery', icon: Search },
        { path: '/port-scanner', label: 'Port Scanner', icon: Network },
      ]
    },
    {
      label: 'Analyze',
      icon: Target,
      section: 'analyze',
      children: [
        { path: '/visualization', label: 'Visualization', icon: BarChart3 },
        { path: '/visualization', label: 'Explore', icon: BarChart3 },
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
    }
  ]

  const isPathActive = (path) => location.pathname === path
  const isSectionActive = (children) => children.some(child => location.pathname === child.path)

  return (
    <div className="flex h-screen bg-dark-200">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-100 border-r border-dark-50 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-dark-50">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
            Bug Bounty
          </h1>
          <p className="text-sm text-gray-400 mt-1">Reconnaissance Platform</p>
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-cyber-blue text-white'
                      : 'text-gray-400 hover:bg-dark-50 hover:text-white'
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
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                    hasActiveChild
                      ? 'bg-dark-50 text-white'
                      : 'text-gray-400 hover:bg-dark-50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* Section Children */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-dark-50 pl-4">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      const isActive = isPathActive(child.path)
                      
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                            isActive
                              ? 'bg-cyber-blue text-white'
                              : 'text-gray-400 hover:bg-dark-50 hover:text-white'
                          }`}
                        >
                          <ChildIcon size={18} />
                          <span className="text-sm font-medium">{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-dark-50">
          <div className="text-xs text-gray-500 text-center">
            v2.0.0 • Built with ❤️
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Globe, Activity, Search, Network, History as HistoryIcon } from 'lucide-react'

const Layout = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/subdomain-scanner', label: 'Subdomain Scanner', icon: Globe },
    { path: '/live-hosts', label: 'Live Hosts', icon: Activity },
    { path: '/content-discovery', label: 'Content Discovery', icon: Search },
    { path: '/port-scanner', label: 'Port Scanner', icon: Network },
    { path: '/visualization', label: 'Visualization', icon: Network },
    { path: '/history', label: 'History', icon: HistoryIcon },
  ]

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
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
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
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-dark-50">
          <div className="text-xs text-gray-500 text-center">
            v1.0.0 • Built with ❤️
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

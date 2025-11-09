import { useQuery } from '@tanstack/react-query'
import { getStats } from '../../api/client'
import { Globe, Activity, Search, Database, TrendingUp, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const Dashboard = () => {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyber-blue"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-400">Failed to load statistics</div>
      </div>
    )
  }

  const statsData = stats?.data || {}

  const statCards = [
    {
      title: 'Total Subdomains',
      value: statsData.subdomain_stats?.total_subdomains || 0,
      icon: Globe,
      color: 'cyber-blue',
      change: '+12%',
    },
    {
      title: 'Active Hosts',
      value: statsData.subdomain_stats?.active_subdomains || 0,
      icon: Activity,
      color: 'cyber-green',
      change: '+8%',
    },
    {
      title: 'Discoveries',
      value: statsData.content_stats?.total_discoveries || 0,
      icon: Search,
      color: 'cyber-purple',
      change: '+24%',
    },
    {
      title: 'Open Ports',
      value: statsData.port_scan_stats?.open_ports || 0,
      icon: Database,
      color: 'cyber-pink',
      change: '+15%',
    },
  ]

  // Mock data for charts
  const activityData = [
    { name: 'Mon', scans: 24 },
    { name: 'Tue', scans: 32 },
    { name: 'Wed', scans: 28 },
    { name: 'Thu', scans: 45 },
    { name: 'Fri', scans: 38 },
    { name: 'Sat', scans: 20 },
    { name: 'Sun', scans: 15 },
  ]

  const discoveryData = [
    { name: 'Jan', count: 120 },
    { name: 'Feb', count: 180 },
    { name: 'Mar', count: 240 },
    { name: 'Apr', count: 310 },
    { name: 'May', count: 380 },
    { name: 'Jun', count: 420 },
  ]

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome to your reconnaissance command center</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.title} className="bg-dark-100 border border-dark-50 rounded-xl p-6 hover:border-cyber-blue transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-${stat.color}/10`}>
                  <Icon className={`text-${stat.color}`} size={24} />
                </div>
                <span className="text-green-400 text-sm font-medium">{stat.change}</span>
              </div>
              <div className="space-y-1">
                <p className="text-gray-400 text-sm">{stat.title}</p>
                <p className="text-3xl font-bold text-white">{stat.value.toLocaleString()}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-cyber-blue" size={20} />
            <h3 className="text-xl font-semibold text-white">Weekly Activity</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="scans" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Discovery Trend */}
        <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Search className="text-cyber-purple" size={20} />
            <h3 className="text-xl font-semibold text-white">Discovery Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={discoveryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                labelStyle={{ color: '#fff' }}
              />
              <Line type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center gap-3 p-4 rounded-lg bg-dark-50 hover:bg-dark-200 border border-transparent hover:border-cyber-blue transition-all text-left">
            <Globe className="text-cyber-blue" size={24} />
            <div>
              <p className="font-medium text-white">New Scan</p>
              <p className="text-sm text-gray-400">Start subdomain enumeration</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 rounded-lg bg-dark-50 hover:bg-dark-200 border border-transparent hover:border-cyber-green transition-all text-left">
            <Activity className="text-cyber-green" size={24} />
            <div>
              <p className="font-medium text-white">Check Hosts</p>
              <p className="text-sm text-gray-400">Probe live subdomains</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 rounded-lg bg-dark-50 hover:bg-dark-200 border border-transparent hover:border-cyber-purple transition-all text-left">
            <Search className="text-cyber-purple" size={24} />
            <div>
              <p className="font-medium text-white">Discover Content</p>
              <p className="text-sm text-gray-400">Find hidden paths</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Alerts (placeholder) */}
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="text-cyber-pink" size={20} />
          <h3 className="text-xl font-semibold text-white">Recent Alerts</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-50">
            <div className="w-2 h-2 rounded-full bg-cyber-green"></div>
            <div className="flex-1">
              <p className="text-white text-sm">New subdomain discovered: api.example.com</p>
              <p className="text-gray-400 text-xs mt-1">2 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-50">
            <div className="w-2 h-2 rounded-full bg-cyber-blue"></div>
            <div className="flex-1">
              <p className="text-white text-sm">Port scan completed for target</p>
              <p className="text-gray-400 text-xs mt-1">15 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-50">
            <div className="w-2 h-2 rounded-full bg-cyber-purple"></div>
            <div className="flex-1">
              <p className="text-white text-sm">Content discovery found 45 new endpoints</p>
              <p className="text-gray-400 text-xs mt-1">1 hour ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

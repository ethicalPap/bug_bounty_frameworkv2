/**
 * All Content Page
 * Shows all discovered content across all categories
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, Star } from 'lucide-react'
import { useContentDiscovery } from '../../stores/contentDiscoveryStore.jsx'
import ContentDiscoveryTable from './ContentDiscoveryTable'

export default function AllContent() {
  const { getFilteredItems, stats } = useContentDiscovery()
  
  const items = useMemo(() => getFilteredItems(null), [getFilteredItems])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/content-discovery"
            className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <Search size={24} className="text-emerald-400" />
              </div>
              All Content
            </h1>
            <p className="text-gray-500 mt-1">
              {stats.total} items discovered across all categories
            </p>
          </div>
        </div>

        {stats.interesting > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
            <Star size={16} className="text-yellow-400" />
            <span className="text-yellow-400 font-medium">{stats.interesting} interesting</span>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[#111111] rounded-xl p-4 border border-orange-500/30">
          <div className="text-sm text-gray-500">APIs</div>
          <div className="text-2xl font-bold text-orange-400">{stats.apis}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-blue-500/30">
          <div className="text-sm text-gray-500">Endpoints</div>
          <div className="text-2xl font-bold text-blue-400">{stats.endpoints}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-yellow-500/30">
          <div className="text-sm text-gray-500">Directories</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.directories}</div>
        </div>
        <div className="bg-[#111111] rounded-xl p-4 border border-purple-500/30">
          <div className="text-sm text-gray-500">JS Files</div>
          <div className="text-2xl font-bold text-purple-400">{stats.javascript}</div>
        </div>
      </div>

      {/* Table */}
      <ContentDiscoveryTable 
        items={items}
        title="All Discovered Content"
        emptyMessage="No content discovered yet"
        emptyIcon={Search}
        showTypeColumn={true}
        showSubdomainColumn={true}
      />
    </div>
  )
}
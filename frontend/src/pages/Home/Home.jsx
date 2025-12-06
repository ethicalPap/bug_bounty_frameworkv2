/**
 * Home Page - Welcome screen with Workspace Management
 * 
 * Features:
 * - Welcome message and quick stats
 * - Workspace creation and selection
 * - Recent activity overview
 * - Quick actions
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Zap,
  Plus,
  FolderOpen,
  Globe,
  Activity,
  Shield,
  Search,
  Clock,
  ArrowRight,
  Trash2,
  Edit3,
  MoreVertical,
  Target,
  ChevronRight,
  Sparkles,
  Layout,
  Lock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react'
import { getWorkspaces, createWorkspace, deleteWorkspace, getWorkspaceStats } from '../../api/client'

export default function Home() {
  const navigate = useNavigate()
  
  const [workspaces, setWorkspaces] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Create workspace modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '', target_scope: '' })
  const [isCreating, setIsCreating] = useState(false)
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Active workspace menu
  const [activeMenu, setActiveMenu] = useState(null)

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
  }, [])

  const loadWorkspaces = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getWorkspaces()
      setWorkspaces(Array.isArray(data) ? data : data.workspaces || [])
    } catch (err) {
      console.error('Failed to load workspaces:', err)
      setError('Failed to load workspaces')
      // Use mock data for demo if API fails
      setWorkspaces([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateWorkspace = async (e) => {
    e.preventDefault()
    if (!newWorkspace.name.trim()) return

    setIsCreating(true)
    try {
      const created = await createWorkspace({
        name: newWorkspace.name.trim(),
        description: newWorkspace.description.trim(),
        target_scope: newWorkspace.target_scope.trim()
      })
      
      setWorkspaces(prev => [created, ...prev])
      setShowCreateModal(false)
      setNewWorkspace({ name: '', description: '', target_scope: '' })
      
      // Navigate to the new workspace
      navigate(`/workspace/${created.id}`)
    } catch (err) {
      console.error('Failed to create workspace:', err)
      alert('Failed to create workspace: ' + (err.message || 'Unknown error'))
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteWorkspace = async (workspace) => {
    setIsDeleting(true)
    try {
      await deleteWorkspace(workspace.id)
      setWorkspaces(prev => prev.filter(w => w.id !== workspace.id))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete workspace:', err)
      alert('Failed to delete workspace: ' + (err.message || 'Unknown error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const selectWorkspace = (workspace) => {
    // Store selected workspace in localStorage
    localStorage.setItem('active_workspace', JSON.stringify(workspace))
    navigate(`/workspace/${workspace.id}`)
  }

  // Quick stats from localStorage
  const quickStats = {
    subdomains: JSON.parse(localStorage.getItem('subdomain_scan_results') || '[]').length,
    liveHosts: JSON.parse(localStorage.getItem('live_hosts_results') || '[]').filter(h => h.is_active).length,
    discoveries: JSON.parse(localStorage.getItem('content_discovery_store') || '{"items":[]}').items?.length || 0
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          {/* Welcome Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-6">
              <Sparkles size={16} />
              Bug Bounty Reconnaissance Platform
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">ReconPlatform</span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Automate your reconnaissance workflow with powerful subdomain enumeration, 
              live host detection, content discovery, and vulnerability scanning.
            </p>
          </div>

          {/* Quick Stats */}
          {(quickStats.subdomains > 0 || quickStats.liveHosts > 0 || quickStats.discoveries > 0) && (
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-12">
              <div className="bg-[#111111]/80 backdrop-blur border border-[#1f1f1f] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{quickStats.subdomains.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Subdomains</div>
              </div>
              <div className="bg-[#111111]/80 backdrop-blur border border-[#1f1f1f] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{quickStats.liveHosts.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Live Hosts</div>
              </div>
              <div className="bg-[#111111]/80 backdrop-blur border border-[#1f1f1f] rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">{quickStats.discoveries.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Discoveries</div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 hover:bg-emerald-500/30 transition-all font-medium"
            >
              <Plus size={20} />
              New Workspace
            </button>
            <Link
              to="/auto-scan"
              className="flex items-center gap-2 px-6 py-3 bg-[#111111] border border-[#1f1f1f] rounded-xl text-white hover:border-[#2a2a2a] transition-all font-medium"
            >
              <Zap size={20} className="text-yellow-400" />
              Quick Auto Scan
            </Link>
            <Link
              to="/subdomain-scanner"
              className="flex items-center gap-2 px-6 py-3 bg-[#111111] border border-[#1f1f1f] rounded-xl text-white hover:border-[#2a2a2a] transition-all font-medium"
            >
              <Globe size={20} className="text-blue-400" />
              Subdomain Scanner
            </Link>
          </div>
        </div>
      </div>

      {/* Workspaces Section */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <FolderOpen size={24} className="text-emerald-400" />
              Your Workspaces
            </h2>
            <p className="text-gray-500 mt-1">Organize your reconnaissance by target or project</p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/30 transition-all text-sm"
          >
            <Plus size={16} />
            Create Workspace
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-emerald-400" size={32} />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <AlertTriangle className="mx-auto text-red-400 mb-3" size={32} />
            <p className="text-red-400">{error}</p>
            <button
              onClick={loadWorkspaces}
              className="mt-4 px-4 py-2 bg-red-500/20 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && workspaces.length === 0 && (
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={32} className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No workspaces yet</h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Create your first workspace to organize your reconnaissance by target domain or bug bounty program.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 hover:bg-emerald-500/30 transition-all font-medium"
            >
              <Plus size={20} />
              Create Your First Workspace
            </button>
          </div>
        )}

        {/* Workspaces Grid */}
        {!isLoading && workspaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-emerald-500/30 transition-all cursor-pointer relative"
                onClick={() => selectWorkspace(workspace)}
              >
                {/* Menu Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenu(activeMenu === workspace.id ? null : workspace.id)
                  }}
                  className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical size={16} />
                </button>

                {/* Menu Dropdown */}
                {activeMenu === workspace.id && (
                  <div className="absolute top-12 right-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-10 py-1 min-w-[140px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenu(null)
                        // TODO: Edit workspace
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-[#222222] transition-colors"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenu(null)
                        setDeleteConfirm(workspace)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                )}

                {/* Workspace Icon */}
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Target size={24} className="text-emerald-400" />
                </div>

                {/* Workspace Info */}
                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                  {workspace.name}
                </h3>
                
                {workspace.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {workspace.description}
                  </p>
                )}

                {workspace.target_scope && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                    <Globe size={12} />
                    <span className="truncate">{workspace.target_scope}</span>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-[#1f1f1f]">
                  <span className="flex items-center gap-1">
                    <Globe size={12} />
                    {workspace.stats?.subdomains || 0} subdomains
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity size={12} />
                    {workspace.stats?.live_hosts || 0} live
                  </span>
                </div>

                {/* Last Activity */}
                <div className="flex items-center gap-1 text-xs text-gray-600 mt-2">
                  <Clock size={12} />
                  {workspace.updated_at 
                    ? `Updated ${new Date(workspace.updated_at).toLocaleDateString()}`
                    : 'Never scanned'
                  }
                </div>

                {/* Arrow */}
                <div className="absolute bottom-5 right-5 text-gray-600 group-hover:text-emerald-400 transition-colors">
                  <ChevronRight size={20} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <h2 className="text-xl font-semibold text-white mb-6">Platform Features</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/subdomain-scanner" className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-blue-500/30 transition-all">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-3">
              <Globe size={20} className="text-blue-400" />
            </div>
            <h3 className="font-medium text-white mb-1 group-hover:text-blue-400 transition-colors">Subdomain Scanner</h3>
            <p className="text-sm text-gray-500">Multi-tool subdomain enumeration</p>
          </Link>

          <Link to="/live-hosts" className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-green-500/30 transition-all">
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center mb-3">
              <Activity size={20} className="text-green-400" />
            </div>
            <h3 className="font-medium text-white mb-1 group-hover:text-green-400 transition-colors">Live Host Detection</h3>
            <p className="text-sm text-gray-500">HTTP/HTTPS probing</p>
          </Link>

          <Link to="/content-discovery" className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-orange-500/30 transition-all">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center mb-3">
              <Search size={20} className="text-orange-400" />
            </div>
            <h3 className="font-medium text-white mb-1 group-hover:text-orange-400 transition-colors">Content Discovery</h3>
            <p className="text-sm text-gray-500">APIs, endpoints, directories</p>
          </Link>

          <Link to="/vuln-scanner" className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-5 hover:border-red-500/30 transition-all">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center mb-3">
              <Shield size={20} className="text-red-400" />
            </div>
            <h3 className="font-medium text-white mb-1 group-hover:text-red-400 transition-colors">Vulnerability Scanner</h3>
            <p className="text-sm text-gray-500">Nuclei & custom templates</p>
          </Link>
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-[#1f1f1f]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Create Workspace</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-500 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Organize your recon by target or bug bounty program
              </p>
            </div>

            <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Workspace Name *
                </label>
                <input
                  type="text"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                  placeholder="e.g., HackerOne - Example Corp"
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Target Scope
                </label>
                <input
                  type="text"
                  value={newWorkspace.target_scope}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, target_scope: e.target.value })}
                  placeholder="e.g., *.example.com"
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Define the target domain or scope for this workspace
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Description
                </label>
                <textarea
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                  placeholder="Optional description or notes..."
                  rows={3}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 px-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWorkspace.name.trim() || isCreating}
                  className="flex-1 py-3 px-4 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Create Workspace
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl w-full max-w-md p-6">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            
            <h2 className="text-xl font-semibold text-white text-center mb-2">Delete Workspace?</h2>
            <p className="text-gray-400 text-center mb-6">
              Are you sure you want to delete "<span className="text-white">{deleteConfirm.name}</span>"? 
              This will permanently remove all associated data.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 px-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWorkspace(deleteConfirm)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
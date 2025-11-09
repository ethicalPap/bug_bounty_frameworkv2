import { Search } from 'lucide-react'

const ContentDiscovery = () => {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <Search className="text-cyber-purple" />
          Content Discovery
        </h2>
        <p className="text-gray-400 mt-2">Find hidden paths, files, and endpoints</p>
      </div>
      
      <div className="bg-dark-100 border border-dark-50 rounded-xl p-12 text-center">
        <Search className="mx-auto text-gray-600 mb-4" size={64} />
        <h3 className="text-xl font-semibold text-white mb-2">Coming Soon</h3>
        <p className="text-gray-400">Content discovery feature is under development</p>
      </div>
    </div>
  )
}

export default ContentDiscovery
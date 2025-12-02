import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import SubdomainScanner from './pages/SubdomainScanner/SubdomainScanner'
import LiveHosts from './pages/LiveHosts/LiveHosts'
import PortScanner from './pages/PortScanner/PortScanner'
import Visualization from './pages/Visualization/Visualization'
import History from './pages/History/History'
import Exports from './pages/Export/Exports'
import ValidationResults from './pages/ValidationResults/ValidationResults'
import VulnerabilityScanner from './pages/VulnerabilityScanner/VulnerabilityScanner'

// Content Discovery pages
import ContentDiscoveryIndex from './pages/ContentDiscovery/index'
import AllContent from './pages/ContentDiscovery/AllContent'
import APIs from './pages/ContentDiscovery/APIs'
import Endpoints from './pages/ContentDiscovery/Endpoints'
import Directories from './pages/ContentDiscovery/Directories'
import JSFiles from './pages/ContentDiscovery/JSFiles'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="subdomain-scanner" element={<SubdomainScanner />} />
        <Route path="live-hosts" element={<LiveHosts />} />
        <Route path="port-scanner" element={<PortScanner />} />
        
        {/* Content Discovery Routes */}
        <Route path="content-discovery" element={<ContentDiscoveryIndex />} />
        <Route path="content-discovery/all" element={<AllContent />} />
        <Route path="content-discovery/apis" element={<APIs />} />
        <Route path="content-discovery/endpoints" element={<Endpoints />} />
        <Route path="content-discovery/directories" element={<Directories />} />
        <Route path="content-discovery/js-files" element={<JSFiles />} />
        
        <Route path="validation" element={<ValidationResults />} />
        <Route path="vuln-scanner" element={<VulnerabilityScanner />} />
        <Route path="visualization" element={<Visualization />} />
        <Route path="history" element={<History />} />
        <Route path="/exports" element={<Exports />} />
      </Route>
    </Routes>
  )
}

export default App
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import SubdomainScanner from './pages/SubdomainScanner/SubdomainScanner'
import LiveHosts from './pages/LiveHosts/LiveHosts'
import ContentDiscovery from './pages/ContentDiscovery/ContentDiscovery'
import PortScanner from './pages/PortScanner/PortScanner'
import Visualization from './pages/Visualization/Visualization'
import History from './pages/History/History'
import Exports from './pages/Export/Exports'
import ValidationResults from './pages/ValidationResults/ValidationResults'
import VulnerabilityScanner from './pages/VulnerabilityScanner/VulnerabilityScanner'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="subdomain-scanner" element={<SubdomainScanner />} />
        <Route path="live-hosts" element={<LiveHosts />} />
        <Route path="content-discovery" element={<ContentDiscovery />} />
        <Route path="port-scanner" element={<PortScanner />} />
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
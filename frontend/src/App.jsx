import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Home from './pages/Home/Home'
import Dashboard from './pages/Dashboard/Dashboard'
import SubdomainScanner from './pages/SubdomainScanner/SubdomainScanner'
import LiveHosts from './pages/LiveHosts/LiveHosts'
import PortScanner from './pages/PortScanner/PortScanner'
import Visualization from './pages/Visualization/Visualization'
import History from './pages/History/History'
import Exports from './pages/Export/Exports'
import VulnerabilityScanner from './pages/VulnerabilityScanner/VulnerabilityScanner'
import AutoScan from './pages/AutoScan/AutoScan'
import Settings from './pages/Settings/Settings'

// Content Discovery pages
import ContentDiscoveryIndex from './pages/ContentDiscovery/index'
import APIs from './pages/ContentDiscovery/APIs'
import Endpoints from './pages/ContentDiscovery/Endpoints'
import Directories from './pages/ContentDiscovery/Directories'
import JSFiles from './pages/ContentDiscovery/JSFiles'

function App() {
  return (
    <Routes>
      {/* Home page - workspace selection (no sidebar) */}
      <Route path="/" element={<Home />} />
      
      {/* All tools require a workspace - nested under /workspace/:workspaceId */}
      <Route path="/workspace/:workspaceId" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="auto-scan" element={<AutoScan />} />
        <Route path="subdomain-scanner" element={<SubdomainScanner />} />
        <Route path="live-hosts" element={<LiveHosts />} />
        <Route path="port-scanner" element={<PortScanner />} />
        
        {/* Content Discovery Routes */}
        <Route path="content-discovery" element={<ContentDiscoveryIndex />} />
        <Route path="content-discovery/apis" element={<APIs />} />
        <Route path="content-discovery/endpoints" element={<Endpoints />} />
        <Route path="content-discovery/directories" element={<Directories />} />
        <Route path="content-discovery/js-files" element={<JSFiles />} />
        
        <Route path="vuln-scanner" element={<VulnerabilityScanner />} />
        <Route path="visualization" element={<Visualization />} />
        <Route path="history" element={<History />} />
        <Route path="exports" element={<Exports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      
      {/* Redirect old routes to home (workspace selection) */}
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/auto-scan" element={<Navigate to="/" replace />} />
      <Route path="/subdomain-scanner" element={<Navigate to="/" replace />} />
      <Route path="/live-hosts" element={<Navigate to="/" replace />} />
      <Route path="/port-scanner" element={<Navigate to="/" replace />} />
      <Route path="/content-discovery/*" element={<Navigate to="/" replace />} />
      <Route path="/vuln-scanner" element={<Navigate to="/" replace />} />
      <Route path="/visualization" element={<Navigate to="/" replace />} />
      <Route path="/history" element={<Navigate to="/" replace />} />
      <Route path="/exports" element={<Navigate to="/" replace />} />
      <Route path="/settings" element={<Navigate to="/" replace />} />
      
      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
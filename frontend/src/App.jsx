import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import SubdomainScanner from './pages/SubdomainScanner/SubdomainScanner'
import LiveHosts from './pages/LiveHosts/LiveHosts'
import ContentDiscovery from './pages/ContentDiscovery/ContentDiscovery'
import PortScanner from './pages/PortScanner/PortScanner'
import History from './pages/History/History'
import Visualization from './pages/Visualization/Visualization'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="subdomain-scanner" element={<SubdomainScanner />} />
        <Route path="live-hosts" element={<LiveHosts />} />
        <Route path="content-discovery" element={<ContentDiscovery />} />
        <Route path="port-scanner" element={<PortScanner />} />
        <Route path="visualization" element={<Visualization />} /> 
        <Route path="history" element={<History />} />
      </Route>
    </Routes>
  )
}

export default App

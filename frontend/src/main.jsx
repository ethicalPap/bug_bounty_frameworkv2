import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContentDiscoveryProvider } from './stores/contentDiscoveryStore.jsx'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 1000 * 60 * 5,
      cacheTime: 1000 * 60 * 60,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ContentDiscoveryProvider>
          <App />
        </ContentDiscoveryProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Subdomain Scanning
export const startSubdomainScan = (scanConfig) => {
  return api.post('/api/v1/scan', scanConfig);
};

export const getSubdomains = (domain) => {
  return api.get(`/api/v1/subdomains/${domain}`);
};

export const getScanResults = (scanId) => {
  return api.get(`/api/v1/scan/${scanId}/results`);
};

// Port Scanning
export const startPortScan = (scanConfig) => {
  return api.post('/api/v1/ports/scan', scanConfig);
};

export const getPortsForTarget = (target) => {
  return api.get(`/api/v1/ports/target/${target}`);
};

// Content Discovery
export const startContentDiscovery = (scanConfig) => {
  return api.post('/api/v1/content/scan', scanConfig);
};

export const getContentForTarget = (targetUrl) => {
  return api.get(`/api/v1/content/target/${targetUrl}`);
};

// Visualization Endpoints
export const getVisualizationData = (domain) => {
  return api.get(`/api/v1/visualization/${domain}`);
};

export const getTechnologyBreakdown = (domain) => {
  return api.get(`/api/v1/visualization/${domain}/technology`);
};

export const getServiceBreakdown = (domain) => {
  return api.get(`/api/v1/visualization/${domain}/services`);
};

export const getEndpointTree = (domain) => {
  return api.get(`/api/v1/visualization/${domain}/tree`);
};

export const getAttackSurface = (domain) => {
  return api.get(`/api/v1/visualization/${domain}/attack-surface`);
};

// Statistics
export const getStats = () => {
  return api.get('/api/v1/stats');
};

// Health Check
export const healthCheck = () => {
  return api.get('/health');
};

export default api;

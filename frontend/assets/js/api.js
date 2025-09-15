// assets/js/api.js

const API = {
    async call(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (response.status === 401) {
                // Token expired, redirect to login
                Auth.logout();
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    },

    // Auth endpoints
    auth: {
        async login(email, password) {
            return fetch(`${CONFIG.API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
        },

        async register(email, password, fullName, organizationName) {
            return fetch(`${CONFIG.API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, fullName, organizationName })
            });
        }
    },

    // Targets
    targets: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return API.call(`/targets${queryString ? '?' + queryString : ''}`);
        },

        async create(domain, description) {
            return API.call('/targets', {
                method: 'POST',
                body: JSON.stringify({ domain, description })
            });
        },

        async delete(id) {
            return API.call(`/targets/${id}`, { method: 'DELETE' });
        }
    },

    // Subdomains
    subdomains: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return API.call(`/subdomains${queryString ? '?' + queryString : ''}`);
        },

        async checkLive(id) {
            return API.call(`/subdomains/${id}/check-live`, { method: 'POST' });
        },

        async getStats() {
            return API.call('/subdomains/stats');
        }
    },

    // Directories
    directories: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return API.call(`/directories${queryString ? '?' + queryString : ''}`);
        },

        async getStats() {
            return API.call('/directories/stats');
        }
    },

    // Vulnerabilities
    vulnerabilities: {
        async getAll(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return API.call(`/vulnerabilities${queryString ? '?' + queryString : ''}`);
        },

        async update(id, data) {
            return API.call(`/vulnerabilities/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },

        async getStats() {
            return API.call('/vulnerabilities/stats');
        }
    },

    // Scans
    scans: {
        async start(targetId, scanTypes, priority = 'medium', config = {}) {
            return API.call('/scans/start', {
                method: 'POST',
                body: JSON.stringify({
                    targetId: parseInt(targetId),
                    scanTypes,
                    priority,
                    config
                })
            });
        },

        async getJobs(params = {}) {
            const queryString = new URLSearchParams(params).toString();
            return API.call(`/scans/jobs${queryString ? '?' + queryString : ''}`);
        },

        async get(id) {
            return API.call(`/scans/${id}`);
        },

        async getResults(id) {
            return API.call(`/scans/${id}/results`);
        },

        async stop(id) {
            return API.call(`/scans/stop/${id}`, { method: 'POST' });
        }
    }
};
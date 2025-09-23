// frontend/assets/js/utils.js - Updated with vulnerability scan support

// State management
const AppState = {
    currentUser: null,
    isRegistering: false,
    currentPageData: {
        subdomains: { page: 1, total: 0 },
        directories: { page: 1, total: 0 },
        ports: { page: 1, total: 0 },
        jsfiles: { page: 1, total: 0 },
        vulnerabilities: { page: 1, total: 0 }
    },
    refreshInterval: null
};

// Utility functions
const Utils = {
    showMessage(message, type = 'info', containerId = 'auth-messages') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        container.innerHTML = '';
        container.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, CONFIG.MESSAGE_TIMEOUT);
    },

    setButtonLoading(buttonId, loading = true) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        if (loading) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner"></span>Loading...';
        } else {
            button.disabled = false;
            // Restore original text based on button ID
            const originalTexts = {
                'auth-submit-btn': AppState.isRegistering ? 'Register' : 'Login',
                'add-target-btn': 'Add Target',
                'start-scan-btn': '🚀 Start Subdomain Scan',
                'start-vuln-scan-btn': '⚠️ Start Vuln Scan',
                'start-content-scan-btn': '🕷️ Start Content Scan',
                'start-port-scan-btn': '🔌 Start Port Scan',
                'start-js-analysis-btn': '📄 Start JS Analysis'
            };
            button.innerHTML = originalTexts[buttonId] || 'Submit';
        }
    },

    safeJsonParse(value, fallback = {}) {
        if (!value) return fallback;
        if (typeof value === 'object') return value;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (error) {
                console.warn('JSON parse error for value:', value, error.message);
                return fallback;
            }
        }
        return fallback;
    },

    getStatusColor(statusCode) {
        if (!statusCode) return 'status-inactive';
        if (statusCode >= 200 && statusCode < 300) return 'status-completed';
        if (statusCode >= 300 && statusCode < 400) return 'status-running';
        if (statusCode >= 400 && statusCode < 500) return 'status-pending';
        if (statusCode >= 500) return 'status-failed';
        return 'status-inactive';
    },

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '-';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    updatePagination(type, pagination) {
        const paginationContainer = document.getElementById(`${type}-pagination`);
        if (!paginationContainer) return;
        
        const { page, pages, total } = pagination;
        let paginationHtml = '';
        
        if (pages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        // Enhanced module name mapping for pagination
        const getModuleName = (type) => {
            switch(type) {
                case 'ports': return 'PortScanning';
                case 'jsfiles': return 'JSAnalysis';
                case 'js-files': return 'JSAnalysis';
                case 'vulnerabilities': return 'Vulnerabilities';
                case 'content-discovery': return 'ContentDiscovery';
                default: return Utils.capitalizeFirst(type);
            }
        };
        
        paginationHtml += `<button onclick="window.${getModuleName(type)}.load(${page - 1})" ${page <= 1 ? 'disabled' : ''} class="btn btn-secondary btn-small">Previous</button>`;
        
        for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
            paginationHtml += `<button onclick="window.${getModuleName(type)}.load(${i})" class="btn ${i === page ? 'btn-primary' : 'btn-secondary'} btn-small">${i}</button>`;
        }
        
        paginationHtml += `<button onclick="window.${getModuleName(type)}.load(${page + 1})" ${page >= pages ? 'disabled' : ''} class="btn btn-secondary btn-small">Next</button>`;
        
        paginationContainer.innerHTML = paginationHtml;
    }
};

window.Utils = Utils;
window.AppState = AppState;
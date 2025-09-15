// assets/js/config.js
const CONFIG = {
    API_BASE: 'http://localhost:3001/api/v1',
    
    // Pagination defaults
    DEFAULT_PAGE_SIZE: 25,
    
    // Auto-refresh intervals (in milliseconds)
    SCAN_REFRESH_INTERVAL: 5000,
    
    // Bulk operations
    BULK_CHECK_BATCH_SIZE: 5,
    BULK_CHECK_DELAY: 1000,
    
    // UI settings
    MESSAGE_TIMEOUT: 5000,
    
    // Tab titles mapping
    TAB_TITLES: {
        targets: 'Targets',
        dashboard: 'Dashboard', 
        scans: 'Subdomain Scans',
        subdomains: 'Subdomains',
        directories: 'Directories',
        'port-scanning': 'Port Scanning',
        'content-discovery': 'Content Discovery',
        'js-analysis': 'JS Analysis',
        'api-discovery': 'API Discovery',
        'vuln-scanning': 'Vulnerability Scanning',
        settings: 'Settings'
    },
    
    // Scan types
    SCAN_TYPES: {
        SUBDOMAIN: 'subdomain_scan',
        PORT: 'port_scan',
        CONTENT: 'content_discovery',
        JS: 'js_files_scan',
        API: 'api_discovery',
        VULN: 'vulnerability_scan',
        FULL: 'full_scan'
    },
    
    // Status mappings
    STATUS_COLORS: {
        200: 'status-completed',
        300: 'status-running',
        400: 'status-pending',
        500: 'status-failed'
    }
};
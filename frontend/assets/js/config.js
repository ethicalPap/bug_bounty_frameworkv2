// frontend/assets/js/config.js - ENHANCED WITH DYNAMIC ENDPOINT SETTINGS
const CONFIG = {
    API_BASE: 'http://localhost:3001/api/v1',
    
    // Pagination defaults
    DEFAULT_PAGE_SIZE: 25,
    
    // Auto-refresh intervals (in milliseconds)
    SCAN_REFRESH_INTERVAL: 5000,        // General scans refresh every 5 seconds
    PORT_SCAN_REFRESH_INTERVAL: 3000,   // Port scanning updates every 3 seconds
    SUBDOMAIN_REFRESH_INTERVAL: 10000,  // Subdomain updates every 10 seconds
    DIRECTORY_REFRESH_INTERVAL: 8000,   // Directory updates every 8 seconds
    DYNAMIC_ENDPOINTS_REFRESH_INTERVAL: 5000,  // Dynamic endpoints updates every 5 seconds
    
    // Bulk operations
    BULK_CHECK_BATCH_SIZE: 5,
    BULK_CHECK_DELAY: 1000,
    
    // Real-time monitoring
    REAL_TIME_ENABLED: true,
    MAX_AUTO_REFRESH_DURATION: 1800000, // Stop auto-refresh after 30 minutes
    SHOW_LIVE_INDICATORS: true,
    
    // Port scanning specific settings
    PORT_SCAN_SETTINGS: {
        SHOW_PROGRESS_BAR: true,
        SHOW_SCAN_STATUS: true,
        AUTO_REFRESH_ON_ACTIVE_SCAN: true,
        PROGRESS_UPDATE_INTERVAL: 2000,  // Check scan progress every 2 seconds
        SHOW_PERFORMANCE_STATS: true
    },
    
    // Dynamic endpoint analysis settings
    DYNAMIC_ENDPOINT_SETTINGS: {
        SHOW_PROGRESS_BAR: true,
        SHOW_ANALYSIS_STATUS: true,
        AUTO_REFRESH_ON_ACTIVE_ANALYSIS: true,
        PROGRESS_UPDATE_INTERVAL: 2000,  // Check analysis progress every 2 seconds
        SHOW_BEHAVIORAL_STATS: true,
        PARAMETER_TESTING_TIMEOUT: 5000,  // Timeout for parameter testing
        DOM_MUTATION_TRACKING: true,
        AJAX_CALL_MONITORING: true
    },
    
    // UI settings
    MESSAGE_TIMEOUT: 5000,
    SHOW_DEBUG_INFO: false, // Set to true for debugging
    
    // Tab titles mapping
    TAB_TITLES: {
        targets: 'Targets',
        dashboard: 'Dashboard', 
        scans: 'Subdomain Scans',
        subdomains: 'Live Hosts',
        directories: 'Directories',
        'port-scanning': 'Port Scanning',
        'content-discovery': 'Content Discovery',
        'dynamic-endpoints': 'Dynamic Endpoints',  // NEW
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
        DYNAMIC_ENDPOINT: 'dynamic_endpoint_analysis',  // NEW
        JS: 'js_files_scan',
        API: 'api_discovery',
        VULN: 'vulnerability_scan',
        FULL: 'full_scan'
    },
    
    // Dynamic endpoint analysis types
    DYNAMIC_ANALYSIS_TYPES: {
        REACTIVE_PARAM: 'reactive_param',
        AJAX_TRIGGER: 'ajax_trigger',
        DOM_MUTATOR: 'dom_mutator',
        STATE_CHANGER: 'state_changer',
        INTERACTIVE_FORM: 'interactive_form',
        CONDITIONAL_ENDPOINT: 'conditional_endpoint'
    },
    
    // Dynamic endpoint analysis depths
    ANALYSIS_DEPTHS: {
        'basic': {
            name: 'Basic Analysis',
            description: 'Form & URL parameters only (fastest)',
            estimated_time: '30s - 2m',
            techniques: ['form_analysis', 'url_parameter_testing']
        },
        'standard': {
            name: 'Standard Analysis',
            description: 'JS functions & AJAX calls (recommended)',
            estimated_time: '2m - 10m',
            techniques: ['form_analysis', 'url_parameter_testing', 'javascript_analysis', 'ajax_monitoring']
        },
        'deep': {
            name: 'Deep Analysis',
            description: 'DOM mutations & state tracking (thorough)',
            estimated_time: '5m - 20m',
            techniques: ['form_analysis', 'url_parameter_testing', 'javascript_analysis', 'ajax_monitoring', 'dom_mutation_tracking', 'state_monitoring']
        },
        'comprehensive': {
            name: 'Comprehensive Analysis',
            description: 'All methods + fuzzing (complete)',
            estimated_time: '10m - 45m',
            techniques: ['form_analysis', 'url_parameter_testing', 'javascript_analysis', 'ajax_monitoring', 'dom_mutation_tracking', 'state_monitoring', 'parameter_fuzzing', 'behavioral_analysis']
        }
    },
    
    // Status mappings
    STATUS_COLORS: {
        200: 'status-completed',
        300: 'status-running',
        400: 'status-pending',
        500: 'status-failed'
    },
    
    // Real-time status indicators
    LIVE_STATUS_ICONS: {
        active: '🟢',
        inactive: '🔴', 
        scanning: '🟡',
        analyzing: '🔵',  // NEW for dynamic analysis
        error: '🔴',
        unknown: '⚪'
    },
    
    // Performance monitoring
    PERFORMANCE_MONITORING: {
        TRACK_SCAN_PERFORMANCE: true,
        TRACK_ANALYSIS_PERFORMANCE: true,  // NEW
        SHOW_SCAN_METRICS: true,
        SHOW_ANALYSIS_METRICS: true,  // NEW
        LOG_PERFORMANCE_DATA: false // Set to true for detailed logging
    },
    
    // Port scanning profiles and their descriptions
    PORT_SCAN_PROFILES: {
        'top-100': {
            name: 'Top 100 Ports',
            description: 'Scan the 100 most common ports (fastest)',
            estimated_time: '30s - 2m',
            recommended_for: 'Quick assessment'
        },
        'top-1000': {
            name: 'Top 1000 Ports', 
            description: 'Scan the 1000 most common ports (recommended)',
            estimated_time: '2m - 10m',
            recommended_for: 'Standard assessment'
        },
        'common-tcp': {
            name: 'Common TCP Ports',
            description: 'Scan TCP ports 1-1024',
            estimated_time: '1m - 5m',
            recommended_for: 'Basic service discovery'
        },
        'common-udp': {
            name: 'Common UDP Ports',
            description: 'Scan common UDP ports',
            estimated_time: '5m - 15m',
            recommended_for: 'UDP service discovery'
        },
        'all-tcp': {
            name: 'All TCP Ports',
            description: 'Comprehensive scan of all 65535 TCP ports',
            estimated_time: '30m - 2h',
            recommended_for: 'Thorough assessment'
        },
        'custom': {
            name: 'Custom Port Range',
            description: 'Specify your own ports or ranges',
            estimated_time: 'Variable',
            recommended_for: 'Targeted scanning'
        }
    },
    
    // Dynamic endpoint test payloads
    DYNAMIC_TEST_PAYLOADS: {
        'safe': {
            name: 'Safe Payloads',
            description: 'Safe test values that won\'t cause harm',
            payloads: ['test', '123', 'true', 'false', 'sample']
        },
        'extended': {
            name: 'Extended Payloads',
            description: 'More comprehensive testing payloads',
            payloads: ['test', '123', 'true', 'false', 'sample', '<script>console.log("test")</script>', '{"test": "value"}', 'admin', 'user']
        },
        'custom': {
            name: 'Custom Payloads',
            description: 'User-defined test payloads',
            payloads: []  // User can customize
        }
    },
    
    // Logging and debugging
    DEBUG: {
        LOG_API_CALLS: false,
        LOG_SCAN_PROGRESS: true,
        LOG_ANALYSIS_PROGRESS: true,  // NEW
        LOG_AUTO_REFRESH: false,
        SHOW_PERFORMANCE_METRICS: true,
        LOG_DYNAMIC_BEHAVIOR: false  // NEW
    }
};

// Helper functions for configuration
CONFIG.getRefreshInterval = function(module) {
    switch(module) {
        case 'port-scanning':
            return this.PORT_SCAN_REFRESH_INTERVAL;
        case 'scans':
            return this.SCAN_REFRESH_INTERVAL;
        case 'subdomains':
            return this.SUBDOMAIN_REFRESH_INTERVAL;
        case 'directories':
            return this.DIRECTORY_REFRESH_INTERVAL;
        case 'dynamic-endpoints':
            return this.DYNAMIC_ENDPOINTS_REFRESH_INTERVAL;
        case 'content-discovery':
            return this.DIRECTORY_REFRESH_INTERVAL;  // Reuse directory interval
        default:
            return this.SCAN_REFRESH_INTERVAL;
    }
};

CONFIG.isRealTimeEnabled = function() {
    return this.REAL_TIME_ENABLED && this.PORT_SCAN_SETTINGS.AUTO_REFRESH_ON_ACTIVE_SCAN;
};

CONFIG.shouldShowLiveIndicators = function() {
    return this.SHOW_LIVE_INDICATORS && this.REAL_TIME_ENABLED;
};

CONFIG.isDynamicAnalysisEnabled = function() {
    return this.REAL_TIME_ENABLED && this.DYNAMIC_ENDPOINT_SETTINGS.AUTO_REFRESH_ON_ACTIVE_ANALYSIS;
};

// Development mode detection
CONFIG.isDevelopment = function() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           this.DEBUG.LOG_API_CALLS;
};

// Log configuration on load if in development mode
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    
    if (CONFIG.isDevelopment()) {
        console.log('🔧 Bug Bounty Platform Configuration Loaded:', {
            realTimeEnabled: CONFIG.isRealTimeEnabled(),
            dynamicAnalysisEnabled: CONFIG.isDynamicAnalysisEnabled(),
            portScanRefreshInterval: CONFIG.PORT_SCAN_REFRESH_INTERVAL,
            dynamicEndpointsRefreshInterval: CONFIG.DYNAMIC_ENDPOINTS_REFRESH_INTERVAL,
            showLiveIndicators: CONFIG.shouldShowLiveIndicators(),
            debugMode: CONFIG.SHOW_DEBUG_INFO
        });
    }
}

window.CONFIG = CONFIG;
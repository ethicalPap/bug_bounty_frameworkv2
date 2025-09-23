// frontend/assets/js/config.js - UPDATED CONFIG WITH ENHANCED CONTENT DISCOVERY SETTINGS
const CONFIG = {
    API_BASE: 'http://localhost:3001/api/v1',
    
    // Pagination defaults
    DEFAULT_PAGE_SIZE: 25,
    
    // Auto-refresh intervals (in milliseconds)
    SCAN_REFRESH_INTERVAL: 5000,        // General scans refresh every 5 seconds
    PORT_SCAN_REFRESH_INTERVAL: 3000,   // Port scanning updates every 3 seconds
    SUBDOMAIN_REFRESH_INTERVAL: 10000,  // Subdomain updates every 10 seconds
    DIRECTORY_REFRESH_INTERVAL: 8000,   // Directory updates every 8 seconds
    CONTENT_DISCOVERY_REFRESH_INTERVAL: 5000,  // Content discovery updates every 5 seconds
    
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
    
    // Enhanced content discovery settings (includes dynamic analysis)
    CONTENT_DISCOVERY_SETTINGS: {
        SHOW_PROGRESS_BAR: true,
        SHOW_DISCOVERY_STATUS: true,
        AUTO_REFRESH_ON_ACTIVE_DISCOVERY: true,
        PROGRESS_UPDATE_INTERVAL: 1000,  // Check discovery progress every 1 second
        SHOW_BEHAVIORAL_STATS: true,
        PARAMETER_TESTING_TIMEOUT: 8000,  // Timeout for parameter testing
        DOM_MUTATION_TRACKING: true,
        AJAX_CALL_MONITORING: true,
        DYNAMIC_ANALYSIS_ENABLED: true,   // Enable dynamic endpoint discovery
        XSS_SINK_DETECTION: true,
        STEALTH_MODE_AVAILABLE: true,
        ENHANCED_REPORTING: true
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
        'content-discovery': 'Content Discovery',  // Now includes dynamic endpoints
        'js-analysis': 'JS Analysis',
        'api-discovery': 'API Discovery',
        'vuln-scanning': 'Vulnerability Scanning',
        settings: 'Settings'
    },
    
    // Scan types
    SCAN_TYPES: {
        SUBDOMAIN: 'subdomain_scan',
        PORT: 'port_scan',
        CONTENT: 'content_discovery',           // Enhanced to include dynamic analysis
        JS: 'js_files_scan',
        API: 'api_discovery',
        VULN: 'vulnerability_scan',
        FULL: 'full_scan'
    },
    
    // Content discovery analysis types (includes dynamic endpoint types)
    CONTENT_ANALYSIS_TYPES: {
        STATIC_ENDPOINT: 'static_endpoint',
        DYNAMIC_ENDPOINT: 'dynamic_endpoint',
        REACTIVE_PARAM: 'reactive_param',
        AJAX_TRIGGER: 'ajax_trigger',
        DOM_MUTATOR: 'dom_mutator',
        STATE_CHANGER: 'state_changer',
        INTERACTIVE_FORM: 'interactive_form',
        CONDITIONAL_ENDPOINT: 'conditional_endpoint',
        XSS_SINK: 'xss_sink',
        PARAMETER: 'parameter'
    },
    
    // Enhanced content discovery modes
    DISCOVERY_MODES: {
        'comprehensive': {
            name: 'Comprehensive Discovery',
            description: 'Static + Dynamic analysis with all techniques',
            estimated_time: '10m - 30m',
            techniques: ['robots_txt', 'sitemap_xml', 'wayback_machine', 'javascript_analysis', 'dynamic_analysis', 'parameter_testing', 'xss_detection', 'form_analysis', 'ajax_monitoring']
        },
        'static_only': {
            name: 'Static Discovery Only',
            description: 'Traditional passive discovery methods (faster)',
            estimated_time: '3m - 10m',
            techniques: ['robots_txt', 'sitemap_xml', 'wayback_machine', 'javascript_analysis', 'link_extraction']
        },
        'dynamic_only': {
            name: 'Dynamic Analysis Only',
            description: 'Focus on interactive endpoints and behavior',
            estimated_time: '5m - 20m',
            techniques: ['dynamic_analysis', 'parameter_testing', 'ajax_monitoring', 'dom_mutation_tracking', 'state_monitoring']
        },
        'stealth': {
            name: 'Stealth Mode',
            description: 'Minimal footprint with maximum stealth',
            estimated_time: '2m - 8m',
            techniques: ['robots_txt', 'javascript_analysis', 'wayback_machine']
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
        discovering: '🔵',     // For content discovery
        analyzing: '🟣',       // For dynamic analysis
        error: '🔴',
        unknown: '⚪'
    },
    
    // Performance monitoring
    PERFORMANCE_MONITORING: {
        TRACK_SCAN_PERFORMANCE: true,
        TRACK_DISCOVERY_PERFORMANCE: true,
        SHOW_SCAN_METRICS: true,
        SHOW_DISCOVERY_METRICS: true,
        LOG_PERFORMANCE_DATA: false // Set to true for detailed logging
    },
    
    // Port scanning profiles
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
    
    // Enhanced test payloads for dynamic analysis
    DYNAMIC_TEST_PAYLOADS: {
        'safe': {
            name: 'Safe Payloads',
            description: 'Safe test values that won\'t cause harm',
            payloads: ['test', '123', 'true', 'false', 'sample', 'example']
        },
        'extended': {
            name: 'Extended Payloads',
            description: 'More comprehensive testing payloads',
            payloads: ['test', '123', 'true', 'false', 'sample', '<img src=x>', '{"test": "value"}', 'admin', 'user', 'null', 'undefined']
        },
        'behavioral': {
            name: 'Behavioral Payloads',
            description: 'Payloads designed to trigger dynamic behavior',
            payloads: ['onload=alert(1)', 'javascript:void(0)', '../../etc/passwd', 'SELECT * FROM users', '${7*7}', '{{7*7}}']
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
        LOG_DISCOVERY_PROGRESS: true,
        LOG_DYNAMIC_ANALYSIS: true,      // Enhanced logging for dynamic analysis
        LOG_AUTO_REFRESH: false,
        SHOW_PERFORMANCE_METRICS: true,
        LOG_PROGRESS_DETAILS: false      // Detailed progress logging
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
        case 'content-discovery':
            return this.CONTENT_DISCOVERY_REFRESH_INTERVAL;
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

CONFIG.isContentDiscoveryEnabled = function() {
    return this.REAL_TIME_ENABLED && this.CONTENT_DISCOVERY_SETTINGS.AUTO_REFRESH_ON_ACTIVE_DISCOVERY;
};

CONFIG.isDynamicAnalysisEnabled = function() {
    return this.CONTENT_DISCOVERY_SETTINGS.DYNAMIC_ANALYSIS_ENABLED;
};

// Development mode detection
CONFIG.isDevelopment = function() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           this.DEBUG.LOG_API_CALLS;
};

// Get discovery mode details
CONFIG.getDiscoveryModeDetails = function(mode) {
    return this.DISCOVERY_MODES[mode] || {
        name: 'Unknown Mode',
        description: 'Unknown discovery mode',
        estimated_time: 'Unknown',
        techniques: []
    };
};

// Get content analysis type details
CONFIG.getContentAnalysisTypeDetails = function(type) {
    const typeDetails = {
        'static_endpoint': { icon: '🔗', description: 'Static web endpoint' },
        'dynamic_endpoint': { icon: '🎯', description: 'Interactive dynamic endpoint' },
        'reactive_param': { icon: '⚡', description: 'Parameter that triggers responses' },
        'ajax_trigger': { icon: '📡', description: 'Triggers AJAX calls' },
        'dom_mutator': { icon: '🔄', description: 'Modifies DOM structure' },
        'state_changer': { icon: '🎭', description: 'Changes application state' },
        'interactive_form': { icon: '📝', description: 'Interactive form element' },
        'conditional_endpoint': { icon: '🔀', description: 'Conditional endpoint' },
        'xss_sink': { icon: '⚠️', description: 'Potential XSS vulnerability' },
        'parameter': { icon: '🔍', description: 'URL or form parameter' }
    };
    
    return typeDetails[type] || { icon: '📄', description: 'Unknown content type' };
};

// Log configuration on load if in development mode
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    
    if (CONFIG.isDevelopment()) {
        console.log('🔧 Enhanced Bug Bounty Platform Configuration Loaded:', {
            realTimeEnabled: CONFIG.isRealTimeEnabled(),
            contentDiscoveryEnabled: CONFIG.isContentDiscoveryEnabled(),
            dynamicAnalysisEnabled: CONFIG.isDynamicAnalysisEnabled(),
            portScanRefreshInterval: CONFIG.PORT_SCAN_REFRESH_INTERVAL,
            contentDiscoveryRefreshInterval: CONFIG.CONTENT_DISCOVERY_REFRESH_INTERVAL,
            showLiveIndicators: CONFIG.shouldShowLiveIndicators(),
            debugMode: CONFIG.SHOW_DEBUG_INFO,
            enhancedContentDiscovery: CONFIG.CONTENT_DISCOVERY_SETTINGS
        });
    }
}

window.CONFIG = CONFIG;
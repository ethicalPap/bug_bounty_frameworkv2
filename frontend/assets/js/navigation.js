// frontend/assets/js/navigation.js - Updated without Dynamic Endpoints tab

const Navigation = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Navigation clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-item')) {
                const tab = e.target.getAttribute('data-tab');
                this.switchTab(tab);
            }
        });

        // Global target filter
        const globalFilter = document.getElementById('global-target-filter');
        if (globalFilter) {
            globalFilter.addEventListener('change', (e) => {
                this.handleGlobalTargetFilter(e.target.value);
            });
        }
    },

    switchTab(tab) {
        // Cleanup any active auto-refresh from previous tab
        this.cleanupPreviousTab();

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-tab="${tab}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Update title
        const pageTitle = document.getElementById('page-title');
        if (pageTitle && window.CONFIG && CONFIG.TAB_TITLES) {
            pageTitle.textContent = CONFIG.TAB_TITLES[tab] || this.getTabDisplayName(tab);
        }

        // Load content for the specific tab
        this.loadTabContent(tab);
    },

    // Get display name for tabs
    getTabDisplayName(tab) {
        const displayNames = {
            'targets': 'Targets',
            'dashboard': 'Dashboard', 
            'scans': 'Subdomain Scans',
            'subdomains': 'Live Hosts',
            'directories': 'Directories',
            'port-scanning': 'Port Scanning',
            'content-discovery': 'Content Discovery',
            'js-analysis': 'JS Analysis',
            'api-discovery': 'API Discovery',
            'vuln-scanning': 'Vulnerability Scanning',
            'settings': 'Settings'
        };
        
        return displayNames[tab] || tab;
    },

    // Enhanced cleanup method for tab switching
    cleanupPreviousTab() {
        // Stop general auto-refresh
        if (window.AppState && AppState.refreshInterval) {
            clearInterval(AppState.refreshInterval);
            AppState.refreshInterval = null;
        }

        // Stop module-specific auto-refresh intervals
        const modulesToCleanup = [
            'Scans',           // Subdomain scans auto-refresh
            'Subdomains',      // Live hosts auto-refresh  
            'PortScanning',    // Port scanning auto-refresh
            'Directories',     // Directory auto-refresh
            'ContentDiscovery', // Content discovery auto-refresh (now includes dynamic endpoints)
            'Vulnerabilities'  // Vuln scanning auto-refresh
        ];

        modulesToCleanup.forEach(moduleName => {
            const module = window[moduleName];
            if (module && typeof module.cleanup === 'function') {
                try {
                    module.cleanup();
                    console.log(`✅ Cleaned up ${moduleName} module`);
                } catch (error) {
                    console.warn(`⚠️ Failed to cleanup ${moduleName}:`, error);
                }
            }
            
            // Also check for refreshInterval property
            if (module && module.refreshInterval) {
                clearInterval(module.refreshInterval);
                module.refreshInterval = null;
                console.log(`✅ Cleared ${moduleName} refreshInterval`);
            }
            
            // Check for scanJobsRefreshInterval
            if (module && module.scanJobsRefreshInterval) {
                clearInterval(module.scanJobsRefreshInterval);
                module.scanJobsRefreshInterval = null;
                console.log(`✅ Cleared ${moduleName} scanJobsRefreshInterval`);
            }

            // Check for progressCheckInterval
            if (module && module.progressCheckInterval) {
                clearInterval(module.progressCheckInterval);
                module.progressCheckInterval = null;
                console.log(`✅ Cleared ${moduleName} progressCheckInterval`);
            }
        });
    },

    async loadTabContent(tab) {
        const content = document.getElementById('main-content');
        if (!content) return;
        
        // Clear current content
        content.innerHTML = '<div style="text-align: center; color: #9a4dff; padding: 40px;">Loading...</div>';

        try {
            switch(tab) {
                case 'targets':
                    if (window.Targets && typeof window.Targets.init === 'function') {
                        await window.Targets.init();
                    } else {
                        this.showModuleNotAvailable('Targets');
                    }
                    break;
                    
                case 'dashboard':
                    if (window.Dashboard && typeof window.Dashboard.init === 'function') {
                        await window.Dashboard.init();
                    } else {
                        this.showModuleNotAvailable('Dashboard');
                    }
                    break;
                    
                case 'scans':
                    if (window.Scans && typeof window.Scans.init === 'function') {
                        await window.Scans.init();
                    } else {
                        this.showModuleNotAvailable('Scans');
                    }
                    break;
                    
                case 'subdomains':
                    if (window.Subdomains && typeof window.Subdomains.init === 'function') {
                        await window.Subdomains.init();
                    } else {
                        this.showModuleNotAvailable('Subdomains');
                    }
                    break;
                    
                case 'directories':
                    if (window.Directories && typeof window.Directories.init === 'function') {
                        await window.Directories.init();
                    } else {
                        this.showModuleNotAvailable('Directories');
                    }
                    break;
                    
                case 'port-scanning':
                    if (window.PortScanning && typeof window.PortScanning.init === 'function') {
                        await window.PortScanning.init();
                    } else {
                        this.showModuleNotAvailable('PortScanning');
                    }
                    break;
                    
                case 'content-discovery':
                    if (window.ContentDiscovery && typeof window.ContentDiscovery.init === 'function') {
                        await window.ContentDiscovery.init();
                    } else {
                        this.showModuleNotAvailable('ContentDiscovery');
                    }
                    break;
                    
                case 'vuln-scanning':
                    if (window.Vulnerabilities && typeof window.Vulnerabilities.init === 'function') {
                        await window.Vulnerabilities.init();
                    } else {
                        this.showModuleNotAvailable('Vulnerabilities');
                    }
                    break;
                    
                case 'js-analysis':
                case 'api-discovery':
                    content.innerHTML = this.getPlaceholderContent(tab);
                    break;
                    
                case 'settings':
                    content.innerHTML = this.getSettingsContent();
                    break;
                    
                default:
                    content.innerHTML = '<div style="text-align: center; color: #dc2626; padding: 40px;">Tab not implemented yet</div>';
            }
        } catch (error) {
            console.error('Error loading tab content:', error);
            content.innerHTML = `
                <div style="text-align: center; color: #dc2626; padding: 40px;">
                    <h3>Error Loading Content</h3>
                    <p>Failed to load ${this.getTabDisplayName(tab)} module</p>
                    <p style="font-size: 12px; margin-top: 10px;">Check console for details</p>
                    <button onclick="Navigation.loadTabContent('${tab}')" class="btn btn-secondary" style="margin-top: 15px;">
                        Try Again
                    </button>
                </div>
            `;
        }
    },

    showModuleNotAvailable(moduleName) {
        const content = document.getElementById('main-content');
        if (!content) return;
        
        content.innerHTML = `
            <div style="text-align: center; color: #d97706; padding: 40px;">
                <h3>⚠️ Module Not Available</h3>
                <p>The ${moduleName} module is not loaded or not available.</p>
                <p style="font-size: 14px; margin-top: 15px;">
                    Make sure to add <code>window.${moduleName} = ${moduleName};</code> at the end of ${moduleName.toLowerCase()}.js
                </p>
                <div style="margin-top: 20px;">
                    <button onclick="location.reload()" class="btn btn-primary">
                        🔄 Reload Page
                    </button>
                </div>
                <div style="margin-top: 15px; font-size: 12px; color: #6b46c1;">
                    <strong>Debug Info:</strong><br>
                    Available modules: ${Object.keys(window).filter(key => 
                        ['Targets', 'Dashboard', 'Scans', 'Subdomains', 'Directories', 'PortScanning', 'ContentDiscovery', 'Vulnerabilities'].includes(key)
                    ).join(', ') || 'None'}
                </div>
            </div>
        `;
    },

    handleGlobalTargetFilter(selectedTargetId) {
        // Update other target filters to match
        const filterIds = [
            'subdomain-target-filter', 
            'directory-target-filter', 
            'port-target-filter', 
            'vuln-scan-target',
            'content-discovery-target'
        ];
        
        filterIds.forEach(filterId => {
            const filter = document.getElementById(filterId);
            if (filter) {
                filter.value = selectedTargetId;
            }
        });
        
        // Reload current tab data if it's affected
        const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
        switch(activeTab) {
            case 'subdomains':
                if (window.Subdomains && typeof window.Subdomains.load === 'function') {
                    window.Subdomains.load();
                }
                break;
            case 'directories':
                if (window.Directories && typeof window.Directories.load === 'function') {
                    window.Directories.load();
                }
                break;
            case 'content-discovery':
                if (window.ContentDiscovery && typeof window.ContentDiscovery.loadTargets === 'function') {
                    window.ContentDiscovery.loadTargets();
                }
                if (window.ContentDiscovery && typeof window.ContentDiscovery.load === 'function') {
                    window.ContentDiscovery.load();
                }
                break;
            case 'port-scanning':
                if (window.PortScanning && typeof window.PortScanning.loadSubdomains === 'function') {
                    window.PortScanning.loadSubdomains();
                }
                if (window.PortScanning && typeof window.PortScanning.load === 'function') {
                    window.PortScanning.load();
                }
                break;
            case 'vuln-scanning':
                if (window.Vulnerabilities && typeof window.Vulnerabilities.load === 'function') {
                    window.Vulnerabilities.load();
                }
                break;
        }
    },

    getPlaceholderContent(tab) {
        const placeholders = {
            'js-analysis': {
                title: 'JavaScript Analysis',
                description: 'Analyze JavaScript files to extract API endpoints, secrets, and sensitive information. Helps identify client-side vulnerabilities and information disclosure.',
                content: 'Run JS analysis to discover JavaScript files and extract secrets'
            },
            'api-discovery': {
                title: 'API Discovery',
                description: 'Discover REST APIs, GraphQL endpoints, and API documentation. Identifies API endpoints that may be vulnerable to attacks like IDOR, injection, etc.',
                content: 'Run API discovery to find REST and GraphQL endpoints'
            }
        };

        const info = placeholders[tab];
        if (!info) {
            return `
                <div class="card">
                    <div class="card-title">Coming Soon</div>
                    <p style="color: #9a4dff; text-align: center; padding: 40px;">
                        This feature is under development
                    </p>
                </div>
            `;
        }

        return `
            <div class="scan-info">
                <h4>${info.title}</h4>
                <p>${info.description}</p>
            </div>
            <div class="card">
                <div class="card-title">Coming Soon</div>
                <p style="color: #9a4dff; text-align: center; padding: 40px;">${info.content}</p>
            </div>
        `;
    },

    getSettingsContent() {
        const apiBase = (window.CONFIG && window.CONFIG.API_BASE) || 'http://localhost:3001/api/v1';
        
        // Get active module intervals for debugging
        const getModuleStatus = (moduleName) => {
            const module = window[moduleName];
            if (!module) return '❌ Not Loaded';
            
            let status = '✅ Loaded';
            if (module.refreshInterval) status += ' | 🔄 Auto-refresh Active';
            if (module.scanJobsRefreshInterval) status += ' | 🔄 Scan Jobs Auto-refresh Active';
            if (module.progressCheckInterval) status += ' | 🔄 Progress Check Active';
            if (typeof module.cleanup === 'function') status += ' | 🧹 Has Cleanup';
            
            return status;
        };
        
        return `
            <div class="card">
                <div class="card-title">Settings</div>
                <div class="form-group">
                    <label>API Endpoint</label>
                    <input type="text" id="api-endpoint" value="${apiBase}" readonly>
                </div>
                <div class="form-group">
                    <label>Theme</label>
                    <select>
                        <option>Pyro Purple Cyberpunk (Current)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Auto-refresh Status</label>
                    <div style="font-family: 'Courier New', monospace; font-size: 12px; color: #9a4dff; padding: 10px; border: 1px solid #2d1b69; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                        <div>General Auto-refresh: ${window.AppState?.refreshInterval ? '🟢 Active' : '🔴 Inactive'}</div>
                        <div>Subdomain Scans Module: ${getModuleStatus('Scans')}</div>
                        <div>Live Hosts Module: ${getModuleStatus('Subdomains')}</div>
                        <div>Port Scanning Module: ${getModuleStatus('PortScanning')}</div>
                        <div>Content Discovery Module: ${getModuleStatus('ContentDiscovery')}</div>
                        <div>Directories Module: ${getModuleStatus('Directories')}</div>
                        <div>Vulnerabilities Module: ${getModuleStatus('Vulnerabilities')}</div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Module Status</label>
                    <div style="font-family: 'Courier New', monospace; font-size: 12px; color: #9a4dff; padding: 10px; border: 1px solid #2d1b69; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                        <div>CONFIG: ${window.CONFIG ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Utils: ${window.Utils ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>AppState: ${window.AppState ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>API: ${window.API ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Auth: ${window.Auth ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Navigation: ${window.Navigation ? '✅ Loaded' : '❌ Not Found'}</div>
                        <hr style="border-color: #2d1b69; margin: 8px 0;">
                        <div>Targets: ${getModuleStatus('Targets')}</div>
                        <div>Dashboard: ${getModuleStatus('Dashboard')}</div>
                        <div>Scans (Subdomain): ${getModuleStatus('Scans')}</div>
                        <div>Subdomains (Live Hosts): ${getModuleStatus('Subdomains')}</div>
                        <div>Directories: ${getModuleStatus('Directories')}</div>
                        <div>Content Discovery (Enhanced): ${getModuleStatus('ContentDiscovery')}</div>
                        <div>PortScanning: ${getModuleStatus('PortScanning')}</div>
                        <div>Vulnerabilities: ${getModuleStatus('Vulnerabilities')}</div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Actions</label>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="console.log('Available modules:', Object.keys(window).filter(k => ['CONFIG', 'Utils', 'API', 'Auth', 'Targets', 'Dashboard', 'Scans', 'Subdomains', 'Directories', 'ContentDiscovery', 'PortScanning', 'Vulnerabilities'].includes(k)))">
                            Debug Modules
                        </button>
                        <button class="btn btn-secondary" onclick="Navigation.cleanupPreviousTab(); console.log('✅ Cleaned up all auto-refresh intervals');">
                            Stop All Auto-refresh
                        </button>
                        <button class="btn btn-secondary" onclick="Navigation.forceCleanupAllIntervals();">
                            Force Cleanup All
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    // Force cleanup all intervals (for debugging)
    forceCleanupAllIntervals() {
        let clearedCount = 0;
        
        // Clear all intervals up to a reasonable limit
        for (let i = 1; i < 1000; i++) {
            try {
                clearInterval(i);
                clearedCount++;
            } catch (e) {
                // Ignore errors
            }
        }
        
        // Reset module intervals
        const modules = ['Scans', 'Subdomains', 'PortScanning', 'ContentDiscovery', 'Directories', 'Vulnerabilities'];
        modules.forEach(moduleName => {
            const module = window[moduleName];
            if (module) {
                if (module.refreshInterval) {
                    module.refreshInterval = null;
                }
                if (module.scanJobsRefreshInterval) {
                    module.scanJobsRefreshInterval = null;
                }
                if (module.progressCheckInterval) {
                    module.progressCheckInterval = null;
                }
            }
        });
        
        // Reset AppState
        if (window.AppState) {
            AppState.refreshInterval = null;
        }
        
        console.log(`🧹 Force cleanup completed - cleared ${clearedCount} intervals`);
        alert(`Force cleanup completed - cleared ${clearedCount} intervals`);
    }
};

// Export Navigation to global scope
window.Navigation = Navigation;
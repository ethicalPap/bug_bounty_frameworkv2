// frontend/assets/js/navigation.js - ENHANCED WITH PORT SCANNING AUTO-REFRESH

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

        // Global target filter - add safety check
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

        // Update title - add safety check
        const pageTitle = document.getElementById('page-title');
        if (pageTitle && window.CONFIG && CONFIG.TAB_TITLES) {
            pageTitle.textContent = CONFIG.TAB_TITLES[tab] || tab;
        }

        // Load content for the specific tab
        this.loadTabContent(tab);

        // Handle auto-refresh for specific tabs
        this.handleAutoRefresh(tab);
    },

    // NEW: Cleanup method for tab switching
    cleanupPreviousTab() {
        // Stop general auto-refresh
        if (window.AppState && AppState.refreshInterval) {
            clearInterval(AppState.refreshInterval);
            AppState.refreshInterval = null;
        }

        // Stop port scanning specific auto-refresh
        if (window.PortScanning && typeof window.PortScanning.cleanup === 'function') {
            window.PortScanning.cleanup();
        }

        // Stop any other module-specific intervals
        if (window.Subdomains && window.Subdomains.refreshInterval) {
            clearInterval(window.Subdomains.refreshInterval);
            window.Subdomains.refreshInterval = null;
        }

        if (window.Directories && window.Directories.refreshInterval) {
            clearInterval(window.Directories.refreshInterval);
            window.Directories.refreshInterval = null;
        }
    },

    async loadTabContent(tab) {
        const content = document.getElementById('main-content');
        if (!content) return;
        
        // Clear current content
        content.innerHTML = '<div style="text-align: center; color: #006600; padding: 40px;">Loading...</div>';

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
                    
                case 'vuln-scanning':
                    if (window.Vulnerabilities && typeof window.Vulnerabilities.init === 'function') {
                        await window.Vulnerabilities.init();
                    } else {
                        this.showModuleNotAvailable('Vulnerabilities');
                    }
                    break;
                    
                case 'scans':
                    if (window.Scans && typeof window.Scans.init === 'function') {
                        await window.Scans.init();
                    } else {
                        this.showModuleNotAvailable('Scans');
                    }
                    break;
                    
                case 'content-discovery':
                case 'js-analysis':
                case 'api-discovery':
                    content.innerHTML = this.getPlaceholderContent(tab);
                    break;
                    
                case 'settings':
                    content.innerHTML = this.getSettingsContent();
                    break;
                    
                default:
                    content.innerHTML = '<div style="text-align: center; color: #ff0000; padding: 40px;">Tab not implemented yet</div>';
            }
        } catch (error) {
            console.error('Error loading tab content:', error);
            content.innerHTML = `
                <div style="text-align: center; color: #ff0000; padding: 40px;">
                    <h3>Error Loading Content</h3>
                    <p>Failed to load ${tab} module</p>
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
            <div style="text-align: center; color: #ffff00; padding: 40px;">
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
                <div style="margin-top: 15px; font-size: 12px; color: #666;">
                    <strong>Debug Info:</strong><br>
                    Available modules: ${Object.keys(window).filter(key => 
                        ['Targets', 'Dashboard', 'Scans', 'Subdomains', 'Directories', 'PortScanning', 'Vulnerabilities'].includes(key)
                    ).join(', ') || 'None'}
                </div>
            </div>
        `;
    },

    handleGlobalTargetFilter(selectedTargetId) {
        // Update other target filters to match
        const filterIds = ['subdomain-target-filter', 'directory-target-filter', 'port-target-filter', 'vuln-scan-target'];
        
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

    handleAutoRefresh(tab) {
        // Stop any existing refresh
        if (window.AppState && AppState.refreshInterval) {
            clearInterval(AppState.refreshInterval);
            AppState.refreshInterval = null;
        }

        // Start auto-refresh for specific tabs
        if (tab === 'scans') {
            setTimeout(() => this.startScanAutoRefresh(), 1000);
        }
        // Note: Port scanning has its own auto-refresh mechanism that starts in the init() method
        // No need to start it here as it's handled by the PortScanning module itself
    },

    startScanAutoRefresh() {
        if (!window.AppState) {
            console.warn('AppState not available for auto-refresh');
            return;
        }
        
        if (AppState.refreshInterval) return;
        
        const refreshInterval = window.CONFIG?.SCAN_REFRESH_INTERVAL || 5000;
        
        AppState.refreshInterval = setInterval(async () => {
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'scans' && window.Scans && typeof window.Scans.load === 'function') {
                try {
                    // Check if API is available
                    if (!window.API || !window.API.scans) {
                        console.warn('API not available for auto-refresh');
                        return;
                    }
                    
                    const response = await API.scans.getJobs();
                    if (response && response.ok) {
                        const data = await response.json();
                        const scans = data.success ? data.data : [];
                        const hasRunningScans = scans.some(scan => 
                            scan.status === 'running' || scan.status === 'pending'
                        );
                        
                        if (hasRunningScans) {
                            window.Scans.load();
                        } else {
                            this.stopAutoRefresh();
                        }
                    }
                } catch (error) {
                    console.error('Auto-refresh failed:', error);
                }
            }
        }, refreshInterval);
    },

    stopAutoRefresh() {
        if (window.AppState && AppState.refreshInterval) {
            clearInterval(AppState.refreshInterval);
            AppState.refreshInterval = null;
        }
    },

    getPlaceholderContent(tab) {
        const placeholders = {
            'content-discovery': {
                title: 'Content Discovery',
                description: 'Discover hidden files, directories, and endpoints using ffuf and wordlists. Finds admin panels, backup files, and other interesting resources.',
                content: 'Run content discovery to find hidden files and directories'
            },
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
                    <p style="color: #006600; text-align: center; padding: 40px;">
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
                <p style="color: #006600; text-align: center; padding: 40px;">${info.content}</p>
            </div>
        `;
    },

    getSettingsContent() {
        const apiBase = (window.CONFIG && window.CONFIG.API_BASE) || 'http://localhost:3001/api/v1';
        
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
                        <option>Hacker Matrix (Current)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Auto-refresh Status</label>
                    <div style="font-family: 'Courier New', monospace; font-size: 12px; color: #006600; padding: 10px; border: 1px solid #003300; background-color: #001100;">
                        <div>General Auto-refresh: ${window.AppState?.refreshInterval ? '🟢 Active' : '🔴 Inactive'}</div>
                        <div>Port Scanning Auto-refresh: ${window.PortScanning?.refreshInterval ? '🟢 Active' : '🔴 Inactive'}</div>
                        <div>Active Scans Being Monitored: ${window.PortScanning?.activeScanJobId ? '🟢 Yes' : '🔴 No'}</div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Module Status</label>
                    <div style="font-family: 'Courier New', monospace; font-size: 12px; color: #006600; padding: 10px; border: 1px solid #003300; background-color: #001100;">
                        <div>CONFIG: ${window.CONFIG ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Utils: ${window.Utils ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>AppState: ${window.AppState ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>API: ${window.API ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Auth: ${window.Auth ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Targets: ${window.Targets ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Dashboard: ${window.Dashboard ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Scans: ${window.Scans ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Subdomains: ${window.Subdomains ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Directories: ${window.Directories ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>PortScanning: ${window.PortScanning ? '✅ Loaded' : '❌ Not Found'}</div>
                        <div>Vulnerabilities: ${window.Vulnerabilities ? '✅ Loaded' : '❌ Not Found'}</div>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="console.log('Available modules:', Object.keys(window).filter(k => ['CONFIG', 'Utils', 'API', 'Auth', 'Targets', 'Dashboard', 'Scans', 'Subdomains', 'Directories', 'PortScanning', 'Vulnerabilities'].includes(k)))">
                    Debug Modules
                </button>
                <button class="btn btn-secondary" onclick="Navigation.cleanupPreviousTab(); console.log('Cleaned up all auto-refresh intervals');">
                    Stop All Auto-refresh
                </button>
            </div>
        `;
    }
};

// Export Navigation to global scope
window.Navigation = Navigation;
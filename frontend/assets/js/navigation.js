// assets/js/navigation.js

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
        document.getElementById('global-target-filter').addEventListener('change', (e) => {
            this.handleGlobalTargetFilter(e.target.value);
        });
    },

    switchTab(tab) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        // Update title
        document.getElementById('page-title').textContent = CONFIG.TAB_TITLES[tab];

        // Load content for the specific tab
        this.loadTabContent(tab);

        // Handle auto-refresh for scans
        this.handleAutoRefresh(tab);
    },

    async loadTabContent(tab) {
        const content = document.getElementById('main-content');
        
        // Clear current content
        content.innerHTML = '<div style="text-align: center; color: #006600; padding: 40px;">Loading...</div>';

        try {
            switch(tab) {
                case 'targets':
                    await Targets.init();
                    break;
                case 'dashboard':
                    await Dashboard.init();
                    break;
                case 'subdomains':
                    await Subdomains.init();
                    break;
                case 'directories':
                    await Directories.init();
                    break;
                case 'vuln-scanning':
                    await Vulnerabilities.init();
                    break;
                case 'scans':
                    await Scans.init();
                    break;
                case 'port-scanning':
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
            content.innerHTML = '<div style="text-align: center; color: #ff0000; padding: 40px;">Error loading content</div>';
        }
    },

    handleGlobalTargetFilter(selectedTargetId) {
        // Update other target filters to match
        const filterIds = ['subdomain-target-filter', 'directory-target-filter', 'vuln-scan-target'];
        
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
                if (window.Subdomains) Subdomains.load();
                break;
            case 'directories':
                if (window.Directories) Directories.load();
                break;
            case 'vuln-scanning':
                if (window.Vulnerabilities) Vulnerabilities.load();
                break;
        }
    },

    handleAutoRefresh(tab) {
        // Stop any existing refresh
        if (AppState.refreshInterval) {
            clearInterval(AppState.refreshInterval);
            AppState.refreshInterval = null;
        }

        // Start auto-refresh for scans tab
        if (tab === 'scans') {
            setTimeout(() => this.startAutoRefresh(), 1000);
        }
    },

    startAutoRefresh() {
        if (AppState.refreshInterval) return;
        
        AppState.refreshInterval = setInterval(async () => {
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'scans' && window.Scans) {
                try {
                    const response = await API.scans.getJobs();
                    if (response && response.ok) {
                        const data = await response.json();
                        const scans = data.success ? data.data : [];
                        const hasRunningScans = scans.some(scan => 
                            scan.status === 'running' || scan.status === 'pending'
                        );
                        
                        if (hasRunningScans) {
                            Scans.load();
                        } else {
                            this.stopAutoRefresh();
                        }
                    }
                } catch (error) {
                    console.error('Auto-refresh failed:', error);
                }
            }
        }, CONFIG.SCAN_REFRESH_INTERVAL);
    },

    stopAutoRefresh() {
        if (AppState.refreshInterval) {
            clearInterval(AppState.refreshInterval);
            AppState.refreshInterval = null;
        }
    },

    getPlaceholderContent(tab) {
        const placeholders = {
            'port-scanning': {
                title: 'Port Scanning',
                description: 'Scan for open ports on discovered subdomains using nmap. Identifies services running on different ports to expand the attack surface.',
                content: 'Run a port scan to discover open ports'
            },
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
        return `
            <div class="card">
                <div class="card-title">Settings</div>
                <div class="form-group">
                    <label>API Endpoint</label>
                    <input type="text" id="api-endpoint" value="${CONFIG.API_BASE}" readonly>
                </div>
                <div class="form-group">
                    <label>Theme</label>
                    <select>
                        <option>Hacker Matrix (Current)</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="Utils.showMessage('Settings saved!', 'success')">Save Settings</button>
            </div>
        `;
    }
};
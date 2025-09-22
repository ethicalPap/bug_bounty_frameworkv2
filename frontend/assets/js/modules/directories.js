// frontend/assets/js/modules/directories.js - ENHANCED WITH SEARCH BUTTON AND LIVE UPDATES

const Directories = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets(); // Load targets first
        await this.load();
        this.startAutoRefresh(); // Start live updates
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        if (!content) {
            console.error('main-content element not found');
            return;
        }
        
        content.innerHTML = `
            <style>
                .export-menu {
                    box-shadow: 0 4px 6px rgba(124, 58, 237, 0.4);
                    border-radius: 2px;
                    background: linear-gradient(135deg, #0f0f23, #1a0a2e);
                    border: 2px solid #7c3aed;
                }
                .export-menu button:hover {
                    background: linear-gradient(90deg, #1a0a2e, #2d1b69) !important;
                    color: #a855f7 !important;
                }
            </style>

            <div class="scan-info">
                <h4>🔍 Passive Content Discovery <span id="directories-live-indicator" style="color: #7c3aed; font-size: 12px;">[LIVE]</span></h4>
                <p>Discover hidden files, directories, and endpoints using passive techniques like robots.txt analysis, sitemap crawling, Wayback Machine, JavaScript analysis, and web crawling. Stealthy approach that won't trigger rate limiting or blocking.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Passive Content Discovery</div>
                <div id="content-discovery-messages"></div>
                <form id="content-discovery-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end;">
                        <div class="form-group">
                            <label>Target</label>
                            <select id="content-discovery-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Subdomain (optional)</label>
                            <select id="content-discovery-subdomain">
                                <option value="">All subdomains</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Discovery Method</label>
                            <select id="content-discovery-method">
                                <option value="comprehensive">Comprehensive (All Methods)</option>
                                <option value="fast">Fast (robots.txt, sitemap, wayback)</option>
                                <option value="crawl_only">Web Crawling Only</option>
                                <option value="osint_only">OSINT Only (no crawling)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">🕷️ Start Discovery</button>
                    </div>
                    
                    <!-- Advanced Options -->
                    <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label>Max Crawl Depth</label>
                            <select id="crawl-depth">
                                <option value="1">1 level (fast)</option>
                                <option value="2" selected>2 levels (recommended)</option>
                                <option value="3">3 levels (thorough)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Max Pages</label>
                            <select id="max-pages">
                                <option value="25">25 pages (fast)</option>
                                <option value="50" selected>50 pages (recommended)</option>
                                <option value="100">100 pages (thorough)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Include JavaScript Analysis</label>
                            <select id="js-analysis">
                                <option value="true" selected>Yes (recommended)</option>
                                <option value="false">No (faster)</option>
                            </select>
                        </div>
                    </div>
                </form>
                
                <!-- Discovery Methods Info -->
                <div style="margin-top: 20px; padding: 15px; border: 1px solid #2d1b69; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                    <h5 style="color: #7c3aed; margin-bottom: 10px;">🛡️ Passive Discovery Methods Used:</h5>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #9a4dff;">
                        <div>📋 robots.txt analysis</div>
                        <div>🗺️ sitemap.xml parsing</div>
                        <div>🕐 Wayback Machine archives</div>
                        <div>🕷️ Gentle web crawling</div>
                        <div>📄 JavaScript endpoint extraction</div>
                        <div>🌐 Common Crawl data</div>
                        <div>🔒 Certificate Transparency logs</div>
                        <div>🕸️ ZAP Ajax Spider (if available)</div>
                    </div>
                    <div style="margin-top: 10px; font-size: 12px; color: #666666;">
                        ⚡ Stealth mode: No brute forcing, no rate limiting concerns, WAF-friendly
                    </div>
                </div>
            </div>

            <div class="filters">
                <div class="filter-group">
                    <label>Target</label>
                    <select id="directory-target-filter">
                        <option value="">All Targets</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Subdomain</label>
                    <select id="directory-subdomain-filter">
                        <option value="">All Subdomains</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Discovery Source</label>
                    <select id="directory-source-filter">
                        <option value="">All Sources</option>
                        <option value="robots_txt">robots.txt</option>
                        <option value="sitemap.xml">Sitemap</option>
                        <option value="wayback_machine">Wayback Machine</option>
                        <option value="javascript_analysis">JavaScript</option>
                        <option value="link_extraction">Link Extraction</option>
                        <option value="form_analysis">Form Analysis</option>
                        <option value="ajax_discovery">AJAX Discovery</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Status Code</label>
                    <select id="directory-status-filter">
                        <option value="">All Status</option>
                        <option value="200">200 OK</option>
                        <option value="403">403 Forbidden</option>
                        <option value="404">404 Not Found</option>
                        <option value="500">500 Error</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Search</label>
                    <input type="text" id="directory-search" placeholder="Search paths...">
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="Directories.search()" class="btn btn-primary">🔍 Search</button>
                    <button onclick="Directories.clearFilters()" class="btn btn-secondary">🗑️ Clear</button>
                    <button onclick="Directories.toggleAutoRefresh()" class="btn btn-secondary" id="auto-refresh-toggle">
                        ⏸️ Pause Live Updates
                    </button>
                </div>
            </div>

            <div class="card">
                <div class="card-title">
                    Discovered Content & Endpoints
                    <div style="float: right; position: relative; display: inline-block;">
                        <button onclick="Directories.toggleExportMenu()" class="btn btn-success btn-small" id="export-directories-btn">
                            📤 Export Results
                        </button>
                        <div id="export-directories-menu" class="export-menu" style="display: none; position: absolute; top: 100%; right: 0; min-width: 140px; z-index: 1000;">
                            <button onclick="Directories.exportDirectories('csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📊 CSV</button>
                            <button onclick="Directories.exportDirectories('json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📋 JSON</button>
                            <button onclick="Directories.exportDirectories('xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                        </div>
                    </div>
                    <span id="directories-last-updated" style="font-size: 12px; color: #666; float: right; margin-right: 160px;"></span>
                </div>
                
                <!-- Live Update Status -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span id="directories-status" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="directories-live-status" style="color: #7c3aed; font-size: 12px;">
                        🔄 Auto-updating every 10 seconds
                    </span>
                </div>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Path</th>
                                <th>Subdomain</th>
                                <th>Source</th>
                                <th>Status</th>
                                <th>Size</th>
                                <th>Title</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="directories-list">
                            <tr>
                                <td colspan="7" style="text-align: center; color: #9a4dff;">Loading discovered content...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="directories-pagination" class="pagination"></div>
            </div>
        `;
    },

    bindEvents() {
        // Content discovery form submission
        const contentDiscoveryForm = document.getElementById('content-discovery-form');
        if (contentDiscoveryForm) {
            contentDiscoveryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startPassiveDiscovery();
            });
        }

        // Content discovery target filter - when changed, update subdomains
        const contentTargetFilter = document.getElementById('content-discovery-target');
        if (contentTargetFilter) {
            contentTargetFilter.addEventListener('change', async () => {
                await this.loadContentDiscoverySubdomains();
            });
        }

        // Target filter - when changed, update subdomains and trigger search
        const targetFilter = document.getElementById('directory-target-filter');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
                this.search(1);
            });
        }

        // Other filters - trigger search instead of load
        ['directory-subdomain-filter', 'directory-source-filter', 'directory-status-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.search(1));
            }
        });

        // Search with debounce and Enter key support
        const directorySearch = document.getElementById('directory-search');
        if (directorySearch && window.Utils && typeof window.Utils.debounce === 'function') {
            directorySearch.addEventListener('input', Utils.debounce(() => this.search(1), 500));
            directorySearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.search(1);
                }
            });
        }

        // Close export menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#export-directories-menu') && !e.target.closest('#export-directories-btn')) {
                const menu = document.getElementById('export-directories-menu');
                if (menu) {
                    menu.style.display = 'none';
                }
            }
        });
    },

    // Start auto-refresh for live updates
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        console.log('🔄 Starting directories live updates');
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'directories') {
                try {
                    await this.updateDirectoriesRealTime();
                } catch (error) {
                    console.error('Directories auto-refresh failed:', error);
                }
            }
        }, CONFIG.getRefreshInterval('directories'));
        
        this.updateAutoRefreshIndicator(true);
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('🛑 Stopped directories auto-refresh');
        }
    },

    // Real-time directories update
    async updateDirectoriesRealTime() {
        try {
            // Preserve current page
            const currentPage = AppState.currentPageData.directories?.page || 1;
            await this.load(currentPage);
            
            // Update last update time
            const lastUpdatedElement = document.getElementById('directories-last-updated');
            if (lastUpdatedElement) {
                lastUpdatedElement.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
            }
            
            // Update status
            const statusElement = document.getElementById('directories-status');
            if (statusElement) {
                const response = await API.directories.getAll({ limit: 1 });
                if (response && response.ok) {
                    const data = await response.json();
                    const total = data.success ? data.pagination.total : 0;
                    statusElement.textContent = `📊 ${total} total endpoints discovered`;
                    statusElement.style.color = '#7c3aed';
                }
            }
            
        } catch (error) {
            console.error('Real-time directories update failed:', error);
        }
    },

    toggleAutoRefresh() {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        const toggleBtn = document.getElementById('auto-refresh-toggle');
        const liveStatus = document.getElementById('directories-live-status');
        
        if (toggleBtn) {
            if (this.isAutoRefreshEnabled) {
                toggleBtn.innerHTML = '⏸️ Pause Live Updates';
                if (liveStatus) {
                    liveStatus.innerHTML = '🔄 Auto-updating every 10 seconds';
                    liveStatus.style.color = '#7c3aed';
                }
                this.startAutoRefresh();
                Utils.showMessage('Live updates enabled', 'success', 'content-discovery-messages');
            } else {
                toggleBtn.innerHTML = '▶️ Resume Live Updates';
                if (liveStatus) {
                    liveStatus.innerHTML = '⏸️ Live updates paused';
                    liveStatus.style.color = '#ffff00';
                }
                this.updateAutoRefreshIndicator(false);
                Utils.showMessage('Live updates paused', 'warning', 'content-discovery-messages');
            }
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('directories-live-indicator');
        if (indicator) {
            if (isActive) {
                indicator.innerHTML = '[LIVE]';
                indicator.style.color = '#7c3aed';
            } else {
                indicator.innerHTML = '[PAUSED]';
                indicator.style.color = '#ffff00';
            }
        }
    },

    // Load targets for the target dropdown
    async loadTargets() {
        try {
            if (!window.API || !API.targets) {
                console.warn('API not available for loading targets');
                return;
            }

            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            // Update directory filter dropdown
            const targetSelect = document.getElementById('directory-target-filter');
            if (targetSelect) {
                const currentValue = targetSelect.value;
                targetSelect.innerHTML = '<option value="">All Targets</option>';
                
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    targetSelect.appendChild(option);
                });

                if (currentValue && targets.find(t => t.id == currentValue)) {
                    targetSelect.value = currentValue;
                }
            }

            // Update content discovery target dropdown
            const contentTargetSelect = document.getElementById('content-discovery-target');
            if (contentTargetSelect) {
                const currentValue = contentTargetSelect.value;
                contentTargetSelect.innerHTML = '<option value="">Select target...</option>';
                
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    contentTargetSelect.appendChild(option);
                });

                if (currentValue && targets.find(t => t.id == currentValue)) {
                    contentTargetSelect.value = currentValue;
                    await this.loadContentDiscoverySubdomains();
                }
            }

            console.log(`Loaded ${targets.length} targets for passive discovery`);
            await this.loadSubdomains();
            
        } catch (error) {
            console.error('Failed to load targets for directory filter:', error);
        }
    },

    // Load subdomains based on selected target
    async loadSubdomains() {
        try {
            if (!window.API || !API.subdomains) {
                console.warn('API not available for loading subdomains');
                return;
            }

            const targetId = document.getElementById('directory-target-filter')?.value;
            const subdomainSelect = document.getElementById('directory-subdomain-filter');
            
            if (!subdomainSelect) return;

            const currentValue = subdomainSelect.value;
            subdomainSelect.innerHTML = '<option value="">All Subdomains</option>';
            
            if (!targetId) {
                const response = await API.subdomains.getAll({ limit: 1000 });
                if (response && response.ok) {
                    const data = await response.json();
                    const subdomains = data.success ? data.data : [];
                    
                    subdomains.forEach(subdomain => {
                        const option = document.createElement('option');
                        option.value = subdomain.id;
                        option.textContent = `${subdomain.subdomain} (${subdomain.target_domain})`;
                        subdomainSelect.appendChild(option);
                    });
                }
            } else {
                const response = await API.subdomains.getAll({ 
                    target_id: targetId,
                    limit: 1000
                });
                
                if (response && response.ok) {
                    const data = await response.json();
                    const subdomains = data.success ? data.data : [];
                    
                    subdomains.forEach(subdomain => {
                        const option = document.createElement('option');
                        option.value = subdomain.id;
                        option.textContent = subdomain.subdomain;
                        subdomainSelect.appendChild(option);
                    });
                }
            }
            
            if (currentValue) {
                const optionExists = Array.from(subdomainSelect.options).some(option => option.value === currentValue);
                if (optionExists) {
                    subdomainSelect.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('Failed to load subdomains for directory filter:', error);
        }
    },

    // Load subdomains for content discovery form
    async loadContentDiscoverySubdomains() {
        try {
            if (!window.API || !API.subdomains) {
                console.warn('API not available for loading content discovery subdomains');
                return;
            }

            const targetId = document.getElementById('content-discovery-target')?.value;
            const subdomainSelect = document.getElementById('content-discovery-subdomain');
            
            if (!subdomainSelect) return;

            const currentValue = subdomainSelect.value;
            subdomainSelect.innerHTML = '<option value="">All subdomains</option>';
            
            if (!targetId) return;

            const response = await API.subdomains.getAll({ 
                target_id: targetId,
                limit: 1000
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const subdomains = data.success ? data.data : [];
                
                subdomains.forEach(subdomain => {
                    const option = document.createElement('option');
                    option.value = subdomain.id;
                    option.textContent = subdomain.subdomain;
                    subdomainSelect.appendChild(option);
                });
            }
            
            if (currentValue) {
                const optionExists = Array.from(subdomainSelect.options).some(option => option.value === currentValue);
                if (optionExists) {
                    subdomainSelect.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('Failed to load subdomains for content discovery:', error);
        }
    },

    // Search method (renamed from load)
    async search(page = 1) {
        console.log('🔍 Search triggered for directories');
        
        // Show searching message
        const directoriesList = document.getElementById('directories-list');
        if (directoriesList) {
            directoriesList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #a855f7;">🔍 Searching directories...</td></tr>';
        }
        
        await this.load(page);
    },

    // Clear filters method
    clearFilters() {
        // Clear all filter inputs and selects (excluding target filter which might be controlled globally)
        const subdomainFilter = document.getElementById('directory-subdomain-filter');
        const sourceFilter = document.getElementById('directory-source-filter');
        const statusFilter = document.getElementById('directory-status-filter');
        const searchFilter = document.getElementById('directory-search');
        
        if (subdomainFilter) subdomainFilter.value = '';
        if (sourceFilter) sourceFilter.value = '';
        if (statusFilter) statusFilter.value = '';
        if (searchFilter) searchFilter.value = '';
        
        // Reload with cleared filters
        this.search(1);
        
        Utils.showMessage('Filters cleared', 'info', 'content-discovery-messages');
    },

    async load(page = 1) {
        try {
            if (!window.API || !API.directories) {
                console.warn('API not available for loading directories');
                this.showNoAPIMessage();
                return;
            }

            const targetId = document.getElementById('directory-target-filter')?.value;
            const subdomainId = document.getElementById('directory-subdomain-filter')?.value;
            const sourceFilter = document.getElementById('directory-source-filter')?.value;
            const statusCode = document.getElementById('directory-status-filter')?.value;
            const search = document.getElementById('directory-search')?.value;
            
            const params = {
                page: page,
                limit: (window.CONFIG && CONFIG.DEFAULT_PAGE_SIZE) || 50
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (sourceFilter) params.source = sourceFilter;
            if (statusCode) params.status_code = statusCode;
            if (search && search.trim()) params.search = search.trim();

            const response = await API.directories.getAll(params);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success) {
                const directories = data.data;
                if (window.AppState) {
                    AppState.currentPageData.directories = { page, total: data.pagination.total };
                }
                
                this.renderDirectoriesList(directories);
                
                // Show result count message for searches
                if (search && search.trim()) {
                    const resultMessage = `Found ${directories.length} directories matching "${search.trim()}"`;
                    if (directories.length === 0) {
                        Utils.showMessage('No directories found matching your search criteria', 'warning', 'content-discovery-messages');
                    } else {
                        Utils.showMessage(resultMessage, 'success', 'content-discovery-messages');
                    }
                }
                
                if (data.pagination.pages > 1 && window.Utils) {
                    Utils.updatePagination('directories', data.pagination);
                } else {
                    const paginationElement = document.getElementById('directories-pagination');
                    if (paginationElement) {
                        paginationElement.innerHTML = '';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load directories:', error);
            this.showErrorMessage('Failed to load directories. Check console for details.');
        }
    },

    renderDirectoriesList(directories) {
        const directoriesList = document.getElementById('directories-list');
        
        // Safety check - ensure element exists
        if (!directoriesList) {
            console.error('directories-list element not found');
            return;
        }
        
        if (directories.length > 0) {
            directoriesList.innerHTML = directories.map(directory => `
                <tr>
                    <td style="font-family: 'Courier New', monospace; color: #7c3aed;">${directory.path || directory.url}</td>
                    <td style="color: #9a4dff;">${directory.subdomain || '-'}</td>
                    <td>
                        <span class="status" style="padding: 2px 6px; border: 1px solid #6b46c1; color: #9a4dff; font-size: 11px;">
                            ${this.getSourceIcon(directory.source || 'unknown')} ${directory.source || 'unknown'}
                        </span>
                    </td>
                    <td>
                        <span class="status ${this.getStatusColor(directory.status_code)}">${directory.status_code || '-'}</span>
                    </td>
                    <td>${this.formatBytes(directory.content_length)}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${directory.title || ''}">${directory.title || '-'}</td>
                    <td>
                        <button onclick="window.open('${directory.url}', '_blank')" class="btn btn-secondary btn-small">Open</button>
                    </td>
                </tr>
            `).join('');
        } else {
            directoriesList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #6b46c1;">No content discovered yet. Run a passive content discovery scan to find directories and endpoints!</td></tr>';
        }
    },

    showErrorMessage(message) {
        const directoriesList = document.getElementById('directories-list');
        if (directoriesList) {
            directoriesList.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626;">${message}</td></tr>`;
        }
    },

    showNoAPIMessage() {
        const directoriesList = document.getElementById('directories-list');
        if (directoriesList) {
            directoriesList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #d97706;">API not available. Please check your connection.</td></tr>';
        }
    },

    getSourceIcon(source) {
        const icons = {
            'robots_txt': '📋',
            'sitemap.xml': '🗺️',
            'wayback_machine': '🕐',
            'javascript_analysis': '📄',
            'link_extraction': '🔗',
            'form_analysis': '📝',
            'ajax_discovery': '⚡',
            'unknown': '❓'
        };
        return icons[source] || '❓';
    },

    getStatusColor(statusCode) {
        if (!statusCode) return '';
        
        if (statusCode >= 200 && statusCode < 300) return 'status-completed';
        if (statusCode >= 300 && statusCode < 400) return 'status-running';
        if (statusCode >= 400 && statusCode < 500) return 'severity-medium';
        if (statusCode >= 500) return 'severity-high';
        return '';
    },

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '-';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    // Start passive content discovery scan
    async startPassiveDiscovery() {
        const targetId = document.getElementById('content-discovery-target')?.value;
        const subdomainId = document.getElementById('content-discovery-subdomain')?.value;
        const method = document.getElementById('content-discovery-method')?.value;
        const crawlDepth = document.getElementById('crawl-depth')?.value;
        const maxPages = document.getElementById('max-pages')?.value;
        const jsAnalysis = document.getElementById('js-analysis')?.value === 'true';
        
        if (!targetId) {
            this.showMessage('Please select a target', 'error');
            return;
        }
        
        if (!window.API || !API.scans) {
            this.showMessage('API not available', 'error');
            return;
        }
        
        try {
            const scanTypes = ['content_discovery'];
            const config = {
                discovery_method: method,
                subdomain_id: subdomainId || null,
                max_depth: parseInt(crawlDepth),
                max_pages: parseInt(maxPages),
                javascript_execution: jsAnalysis,
                passive_mode: true // Flag to indicate passive discovery
            };
            
            this.showMessage('🕷️ Starting passive content discovery...', 'info');
            
            const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('Passive content discovery started:', data);
                
                const methodDescription = this.getMethodDescription(method);
                this.showMessage(
                    `🔍 Passive content discovery started successfully! Using ${methodDescription}. Results will appear automatically as they are discovered.`, 
                    'success'
                );
                
                // Reset form
                const subdomainSelect = document.getElementById('content-discovery-subdomain');
                const methodSelect = document.getElementById('content-discovery-method');
                if (subdomainSelect) subdomainSelect.value = '';
                if (methodSelect) methodSelect.value = 'comprehensive';
                
                // Refresh the directories list after a delay
                setTimeout(() => {
                    this.search();
                }, 3000);
                
            } else {
                const errorData = await response.json();
                this.showMessage('Failed to start passive discovery: ' + (errorData.error || errorData.message || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showMessage('Failed to start passive discovery: ' + error.message, 'error');
        }
    },

    showMessage(message, type) {
        const messagesDiv = document.getElementById('content-discovery-messages');
        if (messagesDiv && window.Utils && typeof window.Utils.showMessage === 'function') {
            Utils.showMessage(message, type, 'content-discovery-messages');
        } else {
            console.log(`[${type}] ${message}`);
        }
    },

    getMethodDescription(method) {
        const descriptions = {
            'comprehensive': 'all passive methods (robots.txt, sitemap, wayback, crawling, JS analysis)',
            'fast': 'fast methods (robots.txt, sitemap, wayback machine)',
            'crawl_only': 'web crawling only',
            'osint_only': 'OSINT methods only (no active crawling)'
        };
        return descriptions[method] || 'passive discovery methods';
    },

    // Method to refresh targets and subdomains
    async refreshFilters() {
        await this.loadTargets();
    },

    // Export functionality methods
    toggleExportMenu() {
        const menu = document.getElementById('export-directories-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    async exportDirectories(format) {
        try {
            // Hide the export menu
            const menu = document.getElementById('export-directories-menu');
            if (menu) menu.style.display = 'none';
            
            // Show loading message
            Utils.showMessage(`📤 Exporting directories as ${format.toUpperCase()}...`, 'info', 'content-discovery-messages');
            
            // Get current filter values to export filtered data
            const targetId = document.getElementById('directory-target-filter')?.value;
            const subdomainId = document.getElementById('directory-subdomain-filter')?.value;
            const sourceFilter = document.getElementById('directory-source-filter')?.value;
            const statusCode = document.getElementById('directory-status-filter')?.value;
            const search = document.getElementById('directory-search')?.value;
            
            const params = {
                page: 1,
                limit: 10000 // Get all matching directories for export
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (sourceFilter) params.source = sourceFilter;
            if (statusCode) params.status_code = statusCode;
            if (search && search.trim()) params.search = search.trim();

            const response = await API.directories.getAll(params);
            if (!response || !response.ok) {
                throw new Error('Failed to fetch directories for export');
            }
            
            const data = await response.json();
            const directories = data.success ? data.data : [];
            
            if (directories.length === 0) {
                Utils.showMessage('No directories to export with current filters', 'warning', 'content-discovery-messages');
                return;
            }
            
            // Prepare export data
            const exportData = {
                export_timestamp: new Date().toISOString(),
                total_directories: directories.length,
                filters_applied: {
                    target_id: targetId || 'all',
                    subdomain_id: subdomainId || 'all',
                    source: sourceFilter || 'all',
                    status_code: statusCode || 'all',
                    search: search || 'none'
                },
                stats: {
                    total_paths: directories.length,
                    unique_sources: new Set(directories.map(d => d.source).filter(Boolean)).size,
                    status_200: directories.filter(d => d.status_code >= 200 && d.status_code < 300).length,
                    status_300: directories.filter(d => d.status_code >= 300 && d.status_code < 400).length,
                    status_400: directories.filter(d => d.status_code >= 400 && d.status_code < 500).length,
                    status_500: directories.filter(d => d.status_code >= 500).length
                },
                directories: directories
            };
            
            // Generate and download file based on format
            switch (format.toLowerCase()) {
                case 'csv':
                    this.downloadCSV(exportData);
                    break;
                case 'json':
                    this.downloadJSON(exportData);
                    break;
                case 'xml':
                    this.downloadXML(exportData);
                    break;
                default:
                    throw new Error('Unsupported export format');
            }
            
            Utils.showMessage(`✅ Successfully exported ${directories.length} directories as ${format.toUpperCase()}!`, 'success', 'content-discovery-messages');
            
        } catch (error) {
            Utils.showMessage('❌ Failed to export directories: ' + error.message, 'error', 'content-discovery-messages');
        }
    },

    downloadCSV(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        let csvContent = 'Export Summary\n';
        csvContent += `Export Date,${data.export_timestamp}\n`;
        csvContent += `Total Directories,${data.total_directories}\n`;
        csvContent += `Unique Sources,${data.stats.unique_sources}\n`;
        csvContent += `2xx Status,${data.stats.status_200}\n`;
        csvContent += `3xx Status,${data.stats.status_300}\n`;
        csvContent += `4xx Status,${data.stats.status_400}\n`;
        csvContent += `5xx Status,${data.stats.status_500}\n\n`;
        
        csvContent += 'Path,Subdomain,Source,Status Code,Content Length,Title,URL,Created Date\n';
        
        data.directories.forEach(directory => {
            const row = [
                `"${(directory.path || directory.url || '').replace(/"/g, '""')}"`,
                `"${directory.subdomain || ''}"`,
                `"${directory.source || ''}"`,
                `"${directory.status_code || ''}"`,
                `"${directory.content_length || ''}"`,
                `"${(directory.title || '').replace(/"/g, '""')}"`,
                `"${(directory.url || '').replace(/"/g, '""')}"`,
                `"${directory.created_at || ''}"`
            ].join(',');
            csvContent += row + '\n';
        });
        
        this.downloadFile(csvContent, `directories_${timestamp}.csv`, 'text/csv');
    },

    downloadJSON(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `directories_${timestamp}.json`, 'application/json');
    },

    downloadXML(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<directories_export>\n';
        xmlContent += '  <export_info>\n';
        xmlContent += `    <timestamp>${this.escapeXml(data.export_timestamp)}</timestamp>\n`;
        xmlContent += `    <total_directories>${data.total_directories}</total_directories>\n`;
        xmlContent += '    <filters>\n';
        xmlContent += `      <target_id>${this.escapeXml(data.filters_applied.target_id)}</target_id>\n`;
        xmlContent += `      <subdomain_id>${this.escapeXml(data.filters_applied.subdomain_id)}</subdomain_id>\n`;
        xmlContent += `      <source>${this.escapeXml(data.filters_applied.source)}</source>\n`;
        xmlContent += `      <status_code>${this.escapeXml(data.filters_applied.status_code)}</status_code>\n`;
        xmlContent += `      <search>${this.escapeXml(data.filters_applied.search)}</search>\n`;
        xmlContent += '    </filters>\n';
        xmlContent += '    <stats>\n';
        xmlContent += `      <total_paths>${data.stats.total_paths}</total_paths>\n`;
        xmlContent += `      <unique_sources>${data.stats.unique_sources}</unique_sources>\n`;
        xmlContent += `      <status_200>${data.stats.status_200}</status_200>\n`;
        xmlContent += `      <status_300>${data.stats.status_300}</status_300>\n`;
        xmlContent += `      <status_400>${data.stats.status_400}</status_400>\n`;
        xmlContent += `      <status_500>${data.stats.status_500}</status_500>\n`;
        xmlContent += '    </stats>\n';
        xmlContent += '  </export_info>\n';
        xmlContent += '  <directories>\n';
        
        data.directories.forEach(directory => {
            xmlContent += '    <directory>\n';
            xmlContent += `      <path>${this.escapeXml(directory.path || directory.url || '')}</path>\n`;
            xmlContent += `      <subdomain>${this.escapeXml(directory.subdomain || '')}</subdomain>\n`;
            xmlContent += `      <source>${this.escapeXml(directory.source || '')}</source>\n`;
            xmlContent += `      <status_code>${this.escapeXml(directory.status_code || '')}</status_code>\n`;
            xmlContent += `      <content_length>${this.escapeXml(directory.content_length || '')}</content_length>\n`;
            xmlContent += `      <title>${this.escapeXml(directory.title || '')}</title>\n`;
            xmlContent += `      <url>${this.escapeXml(directory.url || '')}</url>\n`;
            xmlContent += `      <created_at>${this.escapeXml(directory.created_at || '')}</created_at>\n`;
            xmlContent += '    </directory>\n';
        });
        
        xmlContent += '  </directories>\n';
        xmlContent += '</directories_export>';
        
        this.downloadFile(xmlContent, `directories_${timestamp}.xml`, 'application/xml');
    },

    escapeXml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    },

    // Cleanup method to stop any auto-refresh
    cleanup() {
        this.stopAutoRefresh();
        this.isAutoRefreshEnabled = false;
    }
};

window.Directories = Directories;
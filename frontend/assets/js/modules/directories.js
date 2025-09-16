// frontend/assets/js/modules/directories.js - UPDATED FOR PASSIVE DISCOVERY

const Directories = {
    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets(); // Load targets first
        await this.load();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="scan-info">
                <h4>🔍 Passive Content Discovery</h4>
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
                <div style="margin-top: 20px; padding: 15px; border: 1px solid #003300; background-color: #001100;">
                    <h5 style="color: #00ff00; margin-bottom: 10px;">🛡️ Passive Discovery Methods Used:</h5>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #00cc00;">
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
                        <option value="robots.txt">robots.txt</option>
                        <option value="sitemap.xml">Sitemap</option>
                        <option value="wayback_machine">Wayback Machine</option>
                        <option value="web_crawl">Web Crawl</option>
                        <option value="javascript_analysis">JavaScript</option>
                        <option value="common_crawl">Common Crawl</option>
                        <option value="zap_spider">ZAP Spider</option>
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
                <button onclick="Directories.load()" class="btn btn-primary">🔄 Refresh</button>
            </div>

            <div class="card">
                <div class="card-title">Discovered Content & Endpoints</div>
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
                                <td colspan="7" style="text-align: center; color: #006600;">Loading discovered content...</td>
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

        // Target filter - when changed, update subdomains
        const targetFilter = document.getElementById('directory-target-filter');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
                this.load(1);
            });
        }

        // Other filters
        ['directory-subdomain-filter', 'directory-source-filter', 'directory-status-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.load(1));
            }
        });

        // Search with debounce
        const directorySearch = document.getElementById('directory-search');
        if (directorySearch) {
            directorySearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
        }
    },

    // Load targets for the target dropdown
    async loadTargets() {
        try {
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

    async load(page = 1) {
        try {
            const targetId = document.getElementById('directory-target-filter')?.value;
            const subdomainId = document.getElementById('directory-subdomain-filter')?.value;
            const sourceFilter = document.getElementById('directory-source-filter')?.value;
            const statusCode = document.getElementById('directory-status-filter')?.value;
            const search = document.getElementById('directory-search')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (sourceFilter) params.source = sourceFilter;
            if (statusCode) params.status_code = statusCode;
            if (search) params.search = search;

            const response = await API.directories.getAll(params);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success) {
                const directories = data.data;
                AppState.currentPageData.directories = { page, total: data.pagination.total };
                
                this.renderDirectoriesList(directories);
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('directories', data.pagination);
                } else {
                    document.getElementById('directories-pagination').innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Failed to load directories:', error);
            document.getElementById('directories-list').innerHTML = 
                '<tr><td colspan="7" style="text-align: center; color: #ff0000;">Failed to load directories</td></tr>';
        }
    },

    renderDirectoriesList(directories) {
        const directoriesList = document.getElementById('directories-list');
        
        if (directories.length > 0) {
            directoriesList.innerHTML = directories.map(directory => `
                <tr>
                    <td style="font-family: 'Courier New', monospace; color: #00ff00;">${directory.path}</td>
                    <td style="color: #00cc00;">${directory.subdomain}</td>
                    <td>
                        <span class="status" style="padding: 2px 6px; border: 1px solid #006600; color: #00aa00; font-size: 11px;">
                            ${this.getSourceIcon(directory.source || 'unknown')} ${directory.source || 'unknown'}
                        </span>
                    </td>
                    <td>
                        <span class="status ${Utils.getStatusColor(directory.status_code)}">${directory.status_code || '-'}</span>
                    </td>
                    <td>${Utils.formatBytes(directory.content_length)}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${directory.title || ''}">${directory.title || '-'}</td>
                    <td>
                        <button onclick="window.open('${directory.url}', '_blank')" class="btn btn-secondary btn-small">Open</button>
                    </td>
                </tr>
            `).join('');
        } else {
            directoriesList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #006600;">No content discovered yet. Run a passive content discovery scan to find directories and endpoints!</td></tr>';
        }
    },

    getSourceIcon(source) {
        const icons = {
            'robots.txt': '📋',
            'sitemap.xml': '🗺️',
            'wayback_machine': '🕐',
            'web_crawl': '🕷️',
            'javascript_analysis': '📄',
            'common_crawl': '🌐',
            'certificate_transparency': '🔒',
            'zap_spider': '🕸️',
            'unknown': '❓'
        };
        return icons[source] || '❓';
    },

    // Start passive content discovery scan
    async startPassiveDiscovery() {
        const targetId = document.getElementById('content-discovery-target').value;
        const subdomainId = document.getElementById('content-discovery-subdomain').value;
        const method = document.getElementById('content-discovery-method').value;
        const crawlDepth = document.getElementById('crawl-depth').value;
        const maxPages = document.getElementById('max-pages').value;
        const jsAnalysis = document.getElementById('js-analysis').value === 'true';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'content-discovery-messages');
            return;
        }
        
        try {
            const scanTypes = ['content_discovery'];
            const config = {
                discovery_method: method,
                subdomain_id: subdomainId || null,
                max_depth: parseInt(crawlDepth),
                max_pages: parseInt(maxPages),
                javascript_analysis: jsAnalysis,
                passive_mode: true // Flag to indicate passive discovery
            };
            
            Utils.showMessage('🕷️ Starting passive content discovery...', 'info', 'content-discovery-messages');
            
            const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('Passive content discovery started:', data);
                
                const methodDescription = this.getMethodDescription(method);
                Utils.showMessage(
                    `🔍 Passive content discovery started successfully! Using ${methodDescription}. Check the Subdomain Scans tab to monitor progress.`, 
                    'success', 
                    'content-discovery-messages'
                );
                
                // Reset form
                document.getElementById('content-discovery-subdomain').value = '';
                document.getElementById('content-discovery-method').value = 'comprehensive';
                
                // Refresh the directories list after a delay
                setTimeout(() => {
                    this.load();
                }, 5000);
                
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start passive discovery: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'content-discovery-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start passive discovery: ' + error.message, 'error', 'content-discovery-messages');
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
    }
};

window.Directories = Directories;
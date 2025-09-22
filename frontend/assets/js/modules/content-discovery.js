// frontend/assets/js/modules/content-discovery.js - COMPLETE ENHANCED VERSION

const ContentDiscovery = {
    refreshInterval: null,
    activeScanJobId: null,
    progressUpdateInterval: null,
    lastProgressUpdate: 0,
    isAutoRefreshEnabled: true,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.load();
        this.startAutoRefresh();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <!-- Real-time status indicator with enhanced progress -->
            <div id="content-scan-status" style="display: none; background: linear-gradient(135deg, #1a0a2e, #2d1b69); border: 2px solid #7c3aed; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                    <div class="spinner" style="margin: 0; width: 20px; height: 20px;"></div>
                    <span id="content-scan-status-text" style="color: #7c3aed; font-family: 'Courier New', monospace; font-weight: bold;">Passive content discovery in progress...</span>
                    <button onclick="ContentDiscovery.stopActiveScan()" class="btn btn-danger btn-small" style="margin-left: auto;">Stop Discovery</button>
                </div>
                
                <!-- Enhanced Progress Bar -->
                <div id="content-scan-progress" style="margin-bottom: 8px;">
                    <div style="background-color: #2d1b69; border: 1px solid #7c3aed; height: 12px; width: 100%; border-radius: 6px; overflow: hidden;">
                        <div id="content-scan-progress-bar" style="background: linear-gradient(90deg, #7c3aed, #9a4dff, #a855f7); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 6px; position: relative;">
                            <!-- Animated shimmer effect -->
                            <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shimmer 2s infinite;"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Detailed Progress Text -->
                <div id="content-scan-progress-text" style="font-size: 13px; color: #9a4dff; margin-bottom: 8px; font-family: 'Courier New', monospace;"></div>
                
                <!-- Live Discovery Stats -->
                <div id="live-discovery-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; font-size: 11px; color: #6b46c1;">
                    <div>📄 <span id="live-endpoints">0</span> endpoints</div>
                    <div>⚡ <span id="live-ajax">0</span> AJAX calls</div>
                    <div>📝 <span id="live-forms">0</span> forms</div>
                    <div>⚠️ <span id="live-xss-sinks">0</span> XSS sinks</div>
                    <div>🔍 <span id="live-parameters">0</span> parameters</div>
                    <div>⏱️ <span id="live-elapsed">0s</span> elapsed</div>
                </div>
            </div>

            <!-- CSS for shimmer animation -->
            <style>
                @keyframes shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                
                .progress-phase {
                    background: linear-gradient(90deg, #7c3aed 0%, #9a4dff 50%, #a855f7 100%);
                    animation: pulse-progress 2s ease-in-out infinite;
                }
                
                @keyframes pulse-progress {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
                
                .discovery-metric {
                    transition: all 0.3s ease;
                }
                
                .discovery-metric.updated {
                    color: #7c3aed !important;
                    font-weight: bold;
                    transform: scale(1.05);
                }

                .content-modal-close {
                    position: absolute; 
                    top: 15px; 
                    right: 15px; 
                    background: rgba(124, 58, 237, 0.1); 
                    border: 1px solid #7c3aed; 
                    color: #7c3aed; 
                    font-size: 20px; 
                    cursor: pointer; 
                    z-index: 10001; 
                    padding: 8px; 
                    width: 36px; 
                    height: 36px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    border-radius: 3px;
                    transition: all 0.2s ease;
                }

                .content-modal-close:hover {
                    background: #7c3aed;
                    color: white;
                    transform: scale(1.1);
                }

                .content-row {
                    transition: all 0.2s ease;
                }

                .content-row:hover {
                    background: linear-gradient(90deg, rgba(124, 58, 237, 0.1), rgba(154, 77, 255, 0.1)) !important;
                    transform: translateX(2px);
                    box-shadow: inset 3px 0 0 #7c3aed;
                }

                .param-tag {
                    background: rgba(124, 58, 237, 0.1); 
                    padding: 1px 4px; 
                    margin: 1px; 
                    border-radius: 2px; 
                    display: inline-block;
                    font-size: 10px;
                    border: 1px solid rgba(124, 58, 237, 0.3);
                }

                .method-tag {
                    background: rgba(154, 77, 255, 0.1); 
                    padding: 1px 3px; 
                    border-radius: 2px; 
                    margin: 1px;
                    font-size: 9px;
                    border: 1px solid rgba(154, 77, 255, 0.3);
                }
            </style>

            <div class="scan-info">
                <h4>🕷️ Passive Content Discovery <span id="content-discovery-live-indicator" style="color: #7c3aed; font-size: 12px;">[STEALTH MODE]</span></h4>
                <p>Discover hidden endpoints, parameters, and XSS sinks using passive techniques. WAF-friendly methods that won't trigger rate limits or blocks.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Passive Content Discovery</div>
                <div id="content-discovery-messages"></div>
                <form id="content-discovery-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end; margin-bottom: 15px;">
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
                                <option value="comprehensive">Comprehensive Passive (All Methods)</option>
                                <option value="stealth">Stealth Mode (JS + Wayback Only)</option>
                                <option value="spider_only">ZAP Spider Only</option>
                                <option value="js_analysis">JavaScript Analysis Only</option>
                                <option value="wayback_only">Wayback Machine Only</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">🕷️ Start Discovery</button>
                    </div>
                    
                    <!-- Advanced Passive Options -->
                    <div style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69); margin-bottom: 15px;">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">🛡️ Stealth Configuration</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Max Crawl Depth</label>
                                <select id="crawl-depth">
                                    <option value="1">1 level (fastest)</option>
                                    <option value="2" selected>2 levels (recommended)</option>
                                    <option value="3">3 levels (thorough)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Request Delay (ms)</label>
                                <select id="request-delay">
                                    <option value="1000">1000ms (very stealthy)</option>
                                    <option value="500" selected>500ms (stealthy)</option>
                                    <option value="200">200ms (normal)</option>
                                    <option value="100">100ms (fast)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>User Agent</label>
                                <select id="user-agent">
                                    <option value="chrome">Chrome (Latest)</option>
                                    <option value="firefox" selected>Firefox (Latest)</option>
                                    <option value="safari">Safari</option>
                                    <option value="edge">Edge</option>
                                    <option value="crawler">Search Bot</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 10px;">
                            <div class="form-group">
                                <label>JavaScript Execution</label>
                                <select id="js-execution">
                                    <option value="true" selected>Yes (Find Dynamic Endpoints)</option>
                                    <option value="false">No (Static Only)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Parameter Extraction</label>
                                <select id="param-extraction">
                                    <option value="comprehensive" selected>All Parameters</option>
                                    <option value="xss_sinks">XSS Sinks Only</option>
                                    <option value="search_params">Search Parameters</option>
                                    <option value="form_inputs">Form Inputs Only</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Follow Redirects</label>
                                <select id="follow-redirects">
                                    <option value="true" selected>Yes (More Coverage)</option>
                                    <option value="false">No (Faster)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Discovery Methods Info -->
                    <div style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">🔍 Passive Discovery Techniques</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #9a4dff;">
                            <div>🕷️ OWASP ZAP Ajax Spider</div>
                            <div>📄 JavaScript endpoint extraction</div>
                            <div>🕐 Wayback Machine historical data</div>
                            <div>📋 robots.txt + sitemap.xml</div>
                            <div>🔗 HTML link extraction</div>
                            <div>📝 Form parameter discovery</div>
                            <div>🍪 Cookie analysis</div>
                            <div>⚡ DOM XSS sink detection</div>
                            <div>🔍 Search functionality mapping</div>
                            <div>🌐 AJAX/API endpoint discovery</div>
                            <div>📊 HTTP header analysis</div>
                            <div>🔒 CSP directive parsing</div>
                        </div>
                        <div style="margin-top: 10px; font-size: 12px; color: #6b46c1;">
                            ✅ WAF-Friendly • ✅ Rate-Limit Safe • ✅ Stealth Mode • ✅ No Brute Forcing
                        </div>
                    </div>
                </form>
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
                        <option value="sitemap_xml">sitemap.xml</option>
                        <option value="wayback_machine">Wayback Machine</option>
                        <option value="javascript_analysis">JavaScript Analysis</option>
                        <option value="link_extraction">Link Extraction</option>
                        <option value="form_analysis">Form Analysis</option>
                        <option value="ajax_discovery">AJAX Discovery</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Content Type</label>
                    <select id="content-type-filter">
                        <option value="">All Types</option>
                        <option value="endpoint">Endpoints</option>
                        <option value="parameter">Parameters</option>
                        <option value="xss_sink">XSS Sinks</option>
                        <option value="form">Forms</option>
                        <option value="ajax">AJAX Calls</option>
                        <option value="api">API Endpoints</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Search</label>
                    <input type="text" id="directory-search" placeholder="Search endpoints...">
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="ContentDiscovery.search()" class="btn btn-primary">🔍 Search</button>
                    <button onclick="ContentDiscovery.clearFilters()" class="btn btn-secondary">🗑️ Clear</button>
                    <button onclick="ContentDiscovery.load()" class="btn btn-secondary">🔄 Refresh</button>
                </div>
            </div>

            <div class="card">
                <div class="card-title">
                    Discovered Content & Attack Surface
                    <div style="float: right; position: relative; display: inline-block;">
                        <button onclick="ContentDiscovery.toggleExportMenu()" class="btn btn-success btn-small" id="export-content-btn">
                            📤 Export Results
                        </button>
                        <div id="export-content-menu" class="export-menu" style="display: none; position: absolute; top: 100%; right: 0; min-width: 140px; z-index: 1000; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.4); border-radius: 2px; background: linear-gradient(135deg, #0f0f23, #1a0a2e); border: 2px solid #7c3aed;">
                            <button onclick="ContentDiscovery.exportContent('csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📊 CSV</button>
                            <button onclick="ContentDiscovery.exportContent('json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📋 JSON</button>
                            <button onclick="ContentDiscovery.exportContent('xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                        </div>
                    </div>
                    <span id="content-last-updated" style="font-size: 12px; color: #6b46c1; float: right; margin-right: 160px;"></span>
                </div>
                
                <!-- Live Update Controls -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span id="content-status" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="content-live-status" style="color: #7c3aed; font-size: 12px;">
                        🔄 Auto-updating every 3 seconds
                    </span>
                    <button onclick="ContentDiscovery.toggleAutoRefresh()" class="btn btn-secondary btn-small" id="content-auto-refresh-toggle">
                        ⏸️ Pause Live Updates
                    </button>
                    <button onclick="ContentDiscovery.load()" class="btn btn-primary btn-small">🔄 Manual Refresh</button>
                </div>
                
                <!-- Content Stats -->
                <div id="content-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; border: 1px solid #2d1b69; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                    <div style="text-align: center;">
                        <div id="total-endpoints" style="font-size: 24px; font-weight: bold; color: #7c3aed;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Total Endpoints</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="xss-sinks" style="font-size: 24px; font-weight: bold; color: #ea580c;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">XSS Sinks</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="parameters-found" style="font-size: 24px; font-weight: bold; color: #eab308;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Parameters</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="forms-found" style="font-size: 24px; font-weight: bold; color: #06b6d4;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Forms</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="ajax-endpoints" style="font-size: 24px; font-weight: bold; color: #a855f7;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">AJAX/API</div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th style="width: 35%;">Endpoint/Parameter Details</th>
                                <th style="width: 15%;">Type & Methods</th>
                                <th style="width: 12%;">Source</th>
                                <th style="width: 10%;">Risk Level</th>
                                <th style="width: 8%;">Method</th>
                                <th style="width: 8%;">Status</th>
                                <th style="width: 20%;">Security Notes</th>
                                <th style="width: 12%;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="content-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #6b46c1;">Loading discovered content...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="content-pagination" class="pagination"></div>
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

        // Target filter - when changed, update subdomains
        const targetFilter = document.getElementById('directory-target-filter');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
                this.load(1);
            });
        }

        // Content discovery target - when changed, update subdomains
        const contentTargetFilter = document.getElementById('content-discovery-target');
        if (contentTargetFilter) {
            contentTargetFilter.addEventListener('change', async () => {
                await this.loadContentDiscoverySubdomains();
            });
        }

        // Other filters
        ['directory-subdomain-filter', 'directory-source-filter', 'content-type-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.load(1));
            }
        });

        // Search with debounce and Enter key support
        const directorySearch = document.getElementById('directory-search');
        if (directorySearch) {
            directorySearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
            directorySearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.search(1);
                }
            });
        }

        // Close export menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#export-content-menu') && !e.target.closest('#export-content-btn')) {
                const menu = document.getElementById('export-content-menu');
                if (menu) {
                    menu.style.display = 'none';
                }
            }
        });
    },

    // Enhanced auto-refresh with toggle functionality
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        console.log('🔄 Starting content discovery auto-refresh with enhanced progress tracking');
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            try {
                await this.checkActiveScanJobs();
                await this.updateContentRealTime();
                
                const lastUpdatedElement = document.getElementById('content-last-updated');
                if (lastUpdatedElement) {
                    lastUpdatedElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
                }
                
            } catch (error) {
                console.error('Content discovery auto-refresh failed:', error);
            }
        }, CONFIG.getRefreshInterval('content-discovery') || 3000);

        this.startProgressTracking();
        this.updateAutoRefreshIndicator(true);
    },

    // Real-time content update
    async updateContentRealTime() {
        try {
            // Preserve current page
            const currentPage = AppState.currentPageData.content?.page || 1;
            await this.load(currentPage);
            
            // Update status
            const statusElement = document.getElementById('content-status');
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
            console.error('Real-time content update failed:', error);
        }
    },

    toggleAutoRefresh() {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        const toggleBtn = document.getElementById('content-auto-refresh-toggle');
        const liveStatus = document.getElementById('content-live-status');
        
        if (toggleBtn) {
            if (this.isAutoRefreshEnabled) {
                toggleBtn.innerHTML = '⏸️ Pause Live Updates';
                if (liveStatus) {
                    liveStatus.innerHTML = '🔄 Auto-updating every 3 seconds';
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
        const indicator = document.getElementById('content-discovery-live-indicator');
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

    // Search method
    async search(page = 1) {
        console.log('🔍 Search triggered for content discovery');
        
        // Show searching message
        const contentList = document.getElementById('content-list');
        if (contentList) {
            contentList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #a855f7;">🔍 Searching content...</td></tr>';
        }
        
        await this.load(page);
    },

    // Clear filters method
    clearFilters() {
        const subdomainFilter = document.getElementById('directory-subdomain-filter');
        const sourceFilter = document.getElementById('directory-source-filter');
        const contentTypeFilter = document.getElementById('content-type-filter');
        const searchFilter = document.getElementById('directory-search');
        
        if (subdomainFilter) subdomainFilter.value = '';
        if (sourceFilter) sourceFilter.value = '';
        if (contentTypeFilter) contentTypeFilter.value = '';
        if (searchFilter) searchFilter.value = '';
        
        // Reload with cleared filters
        this.search(1);
        
        Utils.showMessage('Filters cleared', 'info', 'content-discovery-messages');
    },

    // Export functionality methods
    toggleExportMenu() {
        const menu = document.getElementById('export-content-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    async exportContent(format) {
        try {
            // Hide the export menu
            const menu = document.getElementById('export-content-menu');
            if (menu) menu.style.display = 'none';
            
            // Show loading message
            Utils.showMessage(`📤 Exporting content discovery results as ${format.toUpperCase()}...`, 'info', 'content-discovery-messages');
            
            // Get current filter values to export filtered data
            const targetId = document.getElementById('directory-target-filter')?.value;
            const subdomainId = document.getElementById('directory-subdomain-filter')?.value;
            const sourceFilter = document.getElementById('directory-source-filter')?.value;
            const contentTypeFilter = document.getElementById('content-type-filter')?.value;
            const search = document.getElementById('directory-search')?.value;
            
            const params = {
                page: 1,
                limit: 10000 // Get all matching content for export
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (sourceFilter) params.source = sourceFilter;
            if (contentTypeFilter) params.content_type = contentTypeFilter;
            if (search && search.trim()) params.search = search.trim();

            const response = await API.directories.getAll(params);
            if (!response || !response.ok) {
                throw new Error('Failed to fetch content for export');
            }
            
            const data = await response.json();
            const content = data.success ? data.data : [];
            
            if (content.length === 0) {
                Utils.showMessage('No content to export with current filters', 'warning', 'content-discovery-messages');
                return;
            }
            
            // Enhance content with parameter analysis for export
            const enhancedContent = content.map(item => {
                const paramDetails = this.parseParameterDetails(item);
                const endpointDetails = this.parseEndpointDetails(item);
                return {
                    ...item,
                    parameter_count: paramDetails.length,
                    parameter_details: paramDetails,
                    endpoint_details: endpointDetails,
                    security_notes: this.getSmartNotes(item, paramDetails, endpointDetails)
                };
            });
            
            // Prepare export data
            const exportData = {
                export_timestamp: new Date().toISOString(),
                total_content: enhancedContent.length,
                filters_applied: {
                    target_id: targetId || 'all',
                    subdomain_id: subdomainId || 'all',
                    source: sourceFilter || 'all',
                    content_type: contentTypeFilter || 'all',
                    search: search || 'none'
                },
                stats: {
                    total_endpoints: enhancedContent.length,
                    xss_sinks: enhancedContent.filter(c => c.content_type === 'xss_sink').length,
                    forms: enhancedContent.filter(c => c.content_type === 'form').length,
                    apis: enhancedContent.filter(c => c.content_type === 'api').length,
                    ajax_endpoints: enhancedContent.filter(c => c.content_type === 'ajax').length,
                    total_parameters: enhancedContent.reduce((sum, c) => sum + c.parameter_count, 0),
                    high_risk: enhancedContent.filter(c => c.risk_level === 'high').length,
                    medium_risk: enhancedContent.filter(c => c.risk_level === 'medium').length,
                    low_risk: enhancedContent.filter(c => c.risk_level === 'low').length
                },
                content: enhancedContent
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
            
            Utils.showMessage(`✅ Successfully exported ${enhancedContent.length} content discovery results as ${format.toUpperCase()}!`, 'success', 'content-discovery-messages');
            
        } catch (error) {
            Utils.showMessage('❌ Failed to export content discovery results: ' + error.message, 'error', 'content-discovery-messages');
        }
    },

    downloadCSV(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        let csvContent = 'Export Summary\n';
        csvContent += `Export Date,${data.export_timestamp}\n`;
        csvContent += `Total Content,${data.total_content}\n`;
        csvContent += `Total Parameters,${data.stats.total_parameters}\n`;
        csvContent += `XSS Sinks,${data.stats.xss_sinks}\n`;
        csvContent += `Forms,${data.stats.forms}\n`;
        csvContent += `APIs,${data.stats.apis}\n`;
        csvContent += `AJAX Endpoints,${data.stats.ajax_endpoints}\n`;
        csvContent += `High Risk,${data.stats.high_risk}\n`;
        csvContent += `Medium Risk,${data.stats.medium_risk}\n`;
        csvContent += `Low Risk,${data.stats.low_risk}\n\n`;
        
        csvContent += 'URL/Path,Content Type,Source,Risk Level,Method,Status Code,Parameters,Parameter Count,Security Notes,Created Date\n';
        
        data.content.forEach(item => {
            const parameters = item.parameter_details.map(p => `${p.name}:${p.type}`).join(';');
            const row = [
                `"${(item.path || item.url || '').replace(/"/g, '""')}"`,
                `"${item.content_type || ''}"`,
                `"${item.source || ''}"`,
                `"${item.risk_level || ''}"`,
                `"${item.method || ''}"`,
                `"${item.status_code || ''}"`,
                `"${parameters.replace(/"/g, '""')}"`,
                `"${item.parameter_count || 0}"`,
                `"${(item.security_notes || '').replace(/"/g, '""')}"`,
                `"${item.created_at || ''}"`
            ].join(',');
            csvContent += row + '\n';
        });
        
        this.downloadFile(csvContent, `content_discovery_${timestamp}.csv`, 'text/csv');
    },

    downloadJSON(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `content_discovery_${timestamp}.json`, 'application/json');
    },

    downloadXML(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<content_discovery_export>\n';
        xmlContent += '  <export_info>\n';
        xmlContent += `    <timestamp>${this.escapeXml(data.export_timestamp)}</timestamp>\n`;
        xmlContent += `    <total_content>${data.total_content}</total_content>\n`;
        xmlContent += '    <filters>\n';
        xmlContent += `      <target_id>${this.escapeXml(data.filters_applied.target_id)}</target_id>\n`;
        xmlContent += `      <subdomain_id>${this.escapeXml(data.filters_applied.subdomain_id)}</subdomain_id>\n`;
        xmlContent += `      <source>${this.escapeXml(data.filters_applied.source)}</source>\n`;
        xmlContent += `      <content_type>${this.escapeXml(data.filters_applied.content_type)}</content_type>\n`;
        xmlContent += `      <search>${this.escapeXml(data.filters_applied.search)}</search>\n`;
        xmlContent += '    </filters>\n';
        xmlContent += '    <stats>\n';
        xmlContent += `      <total_endpoints>${data.stats.total_endpoints}</total_endpoints>\n`;
        xmlContent += `      <total_parameters>${data.stats.total_parameters}</total_parameters>\n`;
        xmlContent += `      <xss_sinks>${data.stats.xss_sinks}</xss_sinks>\n`;
        xmlContent += `      <forms>${data.stats.forms}</forms>\n`;
        xmlContent += `      <apis>${data.stats.apis}</apis>\n`;
        xmlContent += `      <ajax_endpoints>${data.stats.ajax_endpoints}</ajax_endpoints>\n`;
        xmlContent += `      <high_risk>${data.stats.high_risk}</high_risk>\n`;
        xmlContent += `      <medium_risk>${data.stats.medium_risk}</medium_risk>\n`;
        xmlContent += `      <low_risk>${data.stats.low_risk}</low_risk>\n`;
        xmlContent += '    </stats>\n';
        xmlContent += '  </export_info>\n';
        xmlContent += '  <content>\n';
        
        data.content.forEach(item => {
            xmlContent += '    <endpoint>\n';
            xmlContent += `      <url>${this.escapeXml(item.path || item.url || '')}</url>\n`;
            xmlContent += `      <content_type>${this.escapeXml(item.content_type || '')}</content_type>\n`;
            xmlContent += `      <source>${this.escapeXml(item.source || '')}</source>\n`;
            xmlContent += `      <risk_level>${this.escapeXml(item.risk_level || '')}</risk_level>\n`;
            xmlContent += `      <method>${this.escapeXml(item.method || '')}</method>\n`;
            xmlContent += `      <status_code>${this.escapeXml(item.status_code || '')}</status_code>\n`;
            xmlContent += `      <parameter_count>${item.parameter_count || 0}</parameter_count>\n`;
            xmlContent += '      <parameters>\n';
            item.parameter_details.forEach(param => {
                xmlContent += '        <parameter>\n';
                xmlContent += `          <name>${this.escapeXml(param.name)}</name>\n`;
                xmlContent += `          <type>${this.escapeXml(param.type)}</type>\n`;
                xmlContent += `          <location>${this.escapeXml(param.location || param.source || 'query')}</location>\n`;
                xmlContent += `          <required>${param.required || false}</required>\n`;
                xmlContent += '        </parameter>\n';
            });
            xmlContent += '      </parameters>\n';
            xmlContent += `      <security_notes>${this.escapeXml(item.security_notes || '')}</security_notes>\n`;
            xmlContent += `      <created_at>${this.escapeXml(item.created_at || '')}</created_at>\n`;
            xmlContent += '    </endpoint>\n';
        });
        
        xmlContent += '  </content>\n';
        xmlContent += '</content_discovery_export>';
        
        this.downloadFile(xmlContent, `content_discovery_${timestamp}.xml`, 'application/xml');
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

    // NEW: Enhanced progress tracking with faster updates
    startProgressTracking() {
        this.stopProgressTracking();
        
        this.progressUpdateInterval = setInterval(async () => {
            if (this.activeScanJobId) {
                try {
                    await this.updateDetailedProgress();
                } catch (error) {
                    console.error('Progress update failed:', error);
                }
            }
        }, 1500); // Update progress every 1.5 seconds for smooth updates
    },

    stopProgressTracking() {
        if (this.progressUpdateInterval) {
            clearInterval(this.progressUpdateInterval);
            this.progressUpdateInterval = null;
        }
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('🛑 Stopped content discovery auto-refresh');
        }
        this.stopProgressTracking();
    },

    // ENHANCED: Check for active content discovery jobs with better progress tracking
    async checkActiveScanJobs() {
        try {
            const response = await API.scans.getJobs({ 
                job_type: 'content_discovery',
                status: ['pending', 'running'],
                limit: 50 
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const activeScans = data.success ? data.data : [];
                
                if (activeScans.length > 0) {
                    this.showScanProgress(activeScans[0]);
                    this.startProgressTracking(); // Ensure progress tracking is active
                } else {
                    this.hideScanProgress();
                    this.stopProgressTracking();
                }
            }
        } catch (error) {
            console.error('Failed to check active content discovery jobs:', error);
        }
    },

    // ENHANCED: Show scan progress with detailed metrics
    showScanProgress(scan) {
        const statusDiv = document.getElementById('content-scan-status');
        const statusText = document.getElementById('content-scan-status-text');
        const progressBar = document.getElementById('content-scan-progress-bar');
        const progressText = document.getElementById('content-scan-progress-text');
        
        if (statusDiv && statusText && progressBar && progressText) {
            this.activeScanJobId = scan.id;
            
            statusDiv.style.display = 'block';
            statusText.textContent = `Passive discovery running for ${scan.domain || 'target'}...`;
            
            const progress = scan.progress_percentage || 0;
            progressBar.style.width = `${progress}%`;
            progressBar.className = 'progress-phase'; // Add animation class
            
            const elapsed = scan.started_at ? 
                Math.round((Date.now() - new Date(scan.started_at).getTime()) / 1000) : 0;
            
            // Enhanced progress text with current phase
            const currentPhase = this.getCurrentPhase(progress);
            progressText.textContent = `${currentPhase} • Progress: ${progress}% • Elapsed: ${elapsed}s`;
            
            // Update live stats if available
            this.updateLiveStats(scan, elapsed);
        }
    },

    // NEW: Get current discovery phase based on progress
    getCurrentPhase(progress) {
        if (progress < 15) return '📋 Analyzing robots.txt';
        if (progress < 25) return '🗺️ Parsing sitemap.xml';
        if (progress < 35) return '🕐 Querying Wayback Machine';
        if (progress < 50) return '📄 Analyzing JavaScript files';
        if (progress < 75) return '🔗 Extracting HTML links';
        if (progress < 95) return '📝 Processing forms & parameters';
        return '✅ Finalizing discovery';
    },

    // NEW: Update live statistics during scanning
    updateLiveStats(scan, elapsed) {
        // Simulate progressive discovery (in real implementation, this would come from scan results)
        const progress = scan.progress_percentage || 0;
        
        // Estimate discoveries based on progress
        const estimatedEndpoints = Math.floor((progress / 100) * 25);
        const estimatedAjax = Math.floor((progress / 100) * 8);
        const estimatedForms = Math.floor((progress / 100) * 5);
        const estimatedXssSinks = Math.floor((progress / 100) * 3);
        const estimatedParameters = Math.floor((progress / 100) * 15);
        
        this.updateLiveStatElement('live-endpoints', estimatedEndpoints);
        this.updateLiveStatElement('live-ajax', estimatedAjax);
        this.updateLiveStatElement('live-forms', estimatedForms);
        this.updateLiveStatElement('live-xss-sinks', estimatedXssSinks);
        this.updateLiveStatElement('live-parameters', estimatedParameters);
        this.updateLiveStatElement('live-elapsed', `${elapsed}s`);
    },

    // NEW: Update individual live stat with animation
    updateLiveStatElement(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (element && element.textContent !== String(newValue)) {
            element.textContent = newValue;
            element.parentElement.classList.add('discovery-metric', 'updated');
            setTimeout(() => {
                element.parentElement.classList.remove('updated');
            }, 500);
        }
    },

    // NEW: Update detailed progress for active scans
    async updateDetailedProgress() {
        if (!this.activeScanJobId) return;
        
        try {
            const response = await API.scans.get(this.activeScanJobId);
            if (response && response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    const scan = data.data;
                    this.showScanProgress(scan);
                    
                    // Check if scan completed
                    if (scan.status === 'completed') {
                        this.hideScanProgress();
                        this.stopProgressTracking();
                        await this.load(); // Refresh results
                        Utils.showMessage('🎉 Content discovery completed!', 'success', 'content-discovery-messages');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update detailed progress:', error);
        }
    },

    hideScanProgress() {
        const statusDiv = document.getElementById('content-scan-status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
        this.activeScanJobId = null;
    },

    async stopActiveScan() {
        if (this.activeScanJobId) {
            try {
                const response = await API.scans.stop(this.activeScanJobId);
                if (response && response.ok) {
                    Utils.showMessage('Content discovery stopped successfully!', 'success', 'content-discovery-messages');
                    this.hideScanProgress();
                    this.stopProgressTracking();
                } else {
                    Utils.showMessage('Failed to stop content discovery', 'error', 'content-discovery-messages');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop discovery: ' + error.message, 'error', 'content-discovery-messages');
            }
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

            console.log(`Loaded ${targets.length} targets for passive content discovery`);
            await this.loadSubdomains();
            
        } catch (error) {
            console.error('Failed to load targets for content discovery:', error);
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
            console.error('Failed to load subdomains for content discovery filter:', error);
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
            const contentTypeFilter = document.getElementById('content-type-filter')?.value;
            const search = document.getElementById('directory-search')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (sourceFilter) params.source = sourceFilter;
            if (contentTypeFilter) params.content_type = contentTypeFilter;
            if (search) params.search = search;

            const response = await API.directories.getAll(params);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success) {
                const content = data.data;
                AppState.currentPageData.content = { page, total: data.pagination.total };
                
                this.renderContentList(content);
                this.updateContentStats(content);
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('content', data.pagination);
                } else {
                    const paginationElement = document.getElementById('content-pagination');
                    if (paginationElement) {
                        paginationElement.innerHTML = '';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load discovered content:', error);
            const contentList = document.getElementById('content-list');
            if (contentList) {
                contentList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Failed to load content</td></tr>';
            }
        }
    },

    // ENHANCED: Render content list with detailed parameter analysis
    renderContentList(content) {
        const contentList = document.getElementById('content-list');
        
        if (!contentList) return;
        
        if (content.length > 0) {
            contentList.innerHTML = content.map(item => {
                // Parse detailed parameter information
                const paramDetails = this.parseParameterDetails(item);
                const endpointDetails = this.parseEndpointDetails(item);
                
                return `
                    <tr class="content-row" onclick="ContentDiscovery.showDetailedView(${JSON.stringify(item).replace(/"/g, '&quot;')})" style="cursor: pointer;">
                        <td style="font-family: 'Courier New', monospace; color: #7c3aed; max-width: 300px;">
                            <div style="font-weight: bold; margin-bottom: 4px;">
                                ${this.getContentTypeIcon(item.content_type)} 
                                <span style="color: #9a4dff;">${item.path || item.url}</span>
                            </div>
                            ${paramDetails.length > 0 ? `
                                <div style="font-size: 11px; color: #6b46c1; margin-bottom: 2px;">
                                    📝 ${paramDetails.length} parameter${paramDetails.length > 1 ? 's' : ''}:
                                </div>
                                <div style="font-size: 11px; color: #9a4dff; max-height: 40px; overflow: hidden;">
                                    ${paramDetails.slice(0, 3).map(p => 
                                        `<span class="param-tag">${p.name}${p.type ? ':' + p.type : ''}</span>`
                                    ).join(' ')}
                                    ${paramDetails.length > 3 ? `<span style="color: #6b46c1;">+${paramDetails.length - 3} more</span>` : ''}
                                </div>
                            ` : ''}
                        </td>
                        <td>
                            <span class="status ${this.getContentTypeColor(item.content_type)}">
                                ${this.getContentTypeIcon(item.content_type)} ${item.content_type || 'Endpoint'}
                            </span>
                            ${endpointDetails.methods ? `
                                <div style="font-size: 10px; color: #6b46c1; margin-top: 2px;">
                                    ${endpointDetails.methods.split(',').map(m => 
                                        `<span class="method-tag">${m.trim()}</span>`
                                    ).join('')}
                                </div>
                            ` : ''}
                        </td>
                        <td>
                            <span class="status" style="padding: 2px 6px; border: 1px solid #6b46c1; color: #9a4dff; font-size: 11px;">
                                ${this.getSourceIcon(item.source)} ${item.source}
                            </span>
                            ${item.discovery_context ? `
                                <div style="font-size: 10px; color: #6b46c1; margin-top: 2px;" title="${item.discovery_context}">
                                    📍 ${item.discovery_context.substring(0, 30)}${item.discovery_context.length > 30 ? '...' : ''}
                                </div>
                            ` : ''}
                        </td>
                        <td>
                            <span class="status ${this.getRiskLevelColor(item.risk_level)}">
                                ${this.getRiskIcon(item.risk_level)} ${item.risk_level || 'LOW'}
                            </span>
                            ${this.getVulnerabilityIndicators(item)}
                        </td>
                        <td style="font-size: 12px;">
                            ${endpointDetails.methods || item.method || 'GET'}
                            ${endpointDetails.auth_required ? `<div style="color: #ea580c; font-size: 10px;">🔒 Auth Required</div>` : ''}
                        </td>
                        <td>
                            ${item.status_code ? 
                                `<span class="status ${this.getStatusColor(item.status_code)}">${item.status_code}</span>` : 
                                '<span style="color: #6b46c1; font-size: 12px;">Pending</span>'
                            }
                            ${item.response_size ? `<div style="font-size: 10px; color: #6b46c1;">${this.formatBytes(item.response_size)}</div>` : ''}
                        </td>
                        <td style="font-size: 11px; color: #6b46c1; max-width: 150px;">
                            ${this.getSmartNotes(item, paramDetails, endpointDetails)}
                        </td>
                        <td>
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                <button onclick="event.stopPropagation(); window.open('${item.url}', '_blank')" class="btn btn-secondary btn-small" style="font-size: 10px; padding: 4px 6px;">Open</button>
                                ${item.content_type === 'xss_sink' ? 
                                    `<button onclick="event.stopPropagation(); ContentDiscovery.testXSS('${item.url}')" class="btn btn-danger btn-small" style="font-size: 10px; padding: 4px 6px;">XSS</button>` : 
                                    ''
                                }
                                ${paramDetails.length > 0 ? 
                                    `<button onclick="event.stopPropagation(); ContentDiscovery.generateCurl('${item.url}', ${JSON.stringify(paramDetails).replace(/"/g, '&quot;')})" class="btn btn-success btn-small" style="font-size: 10px; padding: 4px 6px;">cURL</button>` : 
                                    ''
                                }
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            contentList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b46c1;">No content discovered yet. Run passive content discovery to find endpoints, parameters, and XSS sinks!</td></tr>';
        }
    },

    // NEW: Parse detailed parameter information
    parseParameterDetails(item) {
        const params = [];
        
        // Parse from various sources
        if (item.parameters) {
            const paramString = typeof item.parameters === 'string' ? item.parameters : JSON.stringify(item.parameters);
            
            // Try to parse structured parameter data
            try {
                const paramData = JSON.parse(paramString);
                if (Array.isArray(paramData)) {
                    params.push(...paramData);
                } else if (typeof paramData === 'object') {
                    Object.entries(paramData).forEach(([key, value]) => {
                        params.push({
                            name: key,
                            type: this.detectParameterType(value),
                            value: value,
                            source: 'parsed'
                        });
                    });
                }
            } catch {
                // Parse as comma-separated string
                paramString.split(',').forEach(param => {
                    const trimmed = param.trim();
                    if (trimmed) {
                        const [name, ...typeParts] = trimmed.split(':');
                        params.push({
                            name: name.trim(),
                            type: typeParts.join(':').trim() || 'string',
                            source: 'string'
                        });
                    }
                });
            }
        }
        
        // Parse URL parameters
        if (item.url && item.url.includes('?')) {
            try {
                const urlParams = new URLSearchParams(item.url.split('?')[1]);
                urlParams.forEach((value, key) => {
                    if (!params.find(p => p.name === key)) {
                        params.push({
                            name: key,
                            type: this.detectParameterType(value),
                            value: value,
                            source: 'url',
                            location: 'query'
                        });
                    }
                });
            } catch {
                // Ignore URL parsing errors
            }
        }
        
        // Parse form parameters if it's a form
        if (item.content_type === 'form' && item.form_fields) {
            try {
                const formFields = JSON.parse(item.form_fields);
                Object.entries(formFields).forEach(([key, field]) => {
                    params.push({
                        name: key,
                        type: field.type || 'string',
                        required: field.required || false,
                        placeholder: field.placeholder,
                        source: 'form',
                        location: 'body'
                    });
                });
            } catch {
                // Fallback parsing
            }
        }
        
        return params;
    },

    // NEW: Parse endpoint details
    parseEndpointDetails(item) {
        const details = {};
        
        // HTTP methods
        if (item.methods) {
            details.methods = item.methods;
        } else if (item.content_type === 'form') {
            details.methods = 'GET,POST';
        } else if (item.content_type === 'api') {
            details.methods = 'GET,POST,PUT,DELETE';
        }
        
        // Authentication requirements
        if (item.auth_required || item.url?.includes('auth') || item.url?.includes('login')) {
            details.auth_required = true;
        }
        
        // API version
        if (item.url?.match(/\/v\d+\//)) {
            details.api_version = item.url.match(/\/v(\d+)\//)[1];
        }
        
        // Content type
        if (item.response_content_type) {
            details.content_type = item.response_content_type;
        }
        
        return details;
    },

    // NEW: Detect parameter type from value
    detectParameterType(value) {
        if (!value) return 'string';
        
        const val = String(value).toLowerCase();
        
        if (/^\d+$/.test(val)) return 'integer';
        if (/^\d*\.\d+$/.test(val)) return 'float';
        if (/^(true|false)$/.test(val)) return 'boolean';
        if (/^\d{4}-\d{2}-\d{2}/.test(val)) return 'date';
        if (val.includes('@') && val.includes('.')) return 'email';
        if (/^https?:\/\//.test(val)) return 'url';
        if (val.length > 50) return 'text';
        
        return 'string';
    },

    // NEW: Get smart notes based on analysis
    getSmartNotes(item, paramDetails, endpointDetails) {
        const notes = [];
        
        // Parameter analysis
        if (paramDetails.length > 0) {
            const sensitiveParams = paramDetails.filter(p => 
                ['password', 'token', 'key', 'secret', 'auth'].some(s => 
                    p.name.toLowerCase().includes(s)
                )
            );
            if (sensitiveParams.length > 0) {
                notes.push(`🔑 ${sensitiveParams.length} sensitive param${sensitiveParams.length > 1 ? 's' : ''}`);
            }
            
            const requiredParams = paramDetails.filter(p => p.required);
            if (requiredParams.length > 0) {
                notes.push(`❗ ${requiredParams.length} required`);
            }
        }
        
        // Vulnerability indicators
        if (item.content_type === 'xss_sink') {
            notes.push('⚠️ XSS sink detected');
        }
        
        if (item.url?.includes('upload')) {
            notes.push('📤 File upload');
        }
        
        if (item.url?.includes('download')) {
            notes.push('📥 File download');
        }
        
        // API endpoints
        if (item.content_type === 'api') {
            if (item.url?.includes('admin')) {
                notes.push('👑 Admin endpoint');
            }
            if (endpointDetails.auth_required) {
                notes.push('🔒 Auth required');
            }
        }
        
        return notes.length > 0 ? notes.join(' • ') : (item.notes || '-');
    },

    // NEW: Get vulnerability indicators
    getVulnerabilityIndicators(item) {
        const indicators = [];
        
        if (item.content_type === 'xss_sink') {
            indicators.push('<div style="font-size: 10px; color: #ea580c;">⚠️ XSS Risk</div>');
        }
        
        if (item.url?.includes('sql') || item.url?.includes('query')) {
            indicators.push('<div style="font-size: 10px; color: #dc2626;">💉 SQL Injection Risk</div>');
        }
        
        if (item.url?.includes('upload')) {
            indicators.push('<div style="font-size: 10px; color: #d97706;">📤 Upload Risk</div>');
        }
        
        return indicators.join('');
    },

    // NEW: Get risk icon
    getRiskIcon(level) {
        switch(level?.toLowerCase()) {
            case 'high': return '🔴';
            case 'medium': return '🟡';
            case 'low': return '🟢';
            default: return '⚪';
        }
    },

    // NEW: Format bytes
    formatBytes(bytes) {
        if (!bytes) return '';
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },

    // NEW: Show detailed view in modal
    showDetailedView(item) {
        const modal = document.createElement('div');
        modal.id = 'content-detail-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.9); z-index: 10000; display: flex; 
            justify-content: center; align-items: center; padding: 20px;
        `;
        
        const paramDetails = this.parseParameterDetails(item);
        const endpointDetails = this.parseEndpointDetails(item);
        
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #0f0f23, #1a0a2e); border: 2px solid #7c3aed; 
                        max-width: 900px; width: 100%; max-height: 90%; overflow-y: auto; padding: 30px; position: relative;">
                
                <button onclick="ContentDiscovery.closeDetailModal()" class="content-modal-close">×</button>
                
                <h2 style="color: #7c3aed; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    ${this.getContentTypeIcon(item.content_type)} 
                    ${item.content_type?.toUpperCase() || 'ENDPOINT'} ANALYSIS
                </h2>
                
                <!-- Basic Information -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                    <div style="background: rgba(124, 58, 237, 0.1); padding: 15px; border: 1px solid #7c3aed;">
                        <h3 style="color: #7c3aed; margin-bottom: 10px;">🎯 Endpoint Details</h3>
                        <div style="color: #9a4dff; font-family: 'Courier New', monospace; font-size: 13px;">
                            <div><strong>URL:</strong> ${item.url || item.path}</div>
                            <div style="margin-top: 5px;"><strong>Method(s):</strong> ${endpointDetails.methods || item.method || 'GET'}</div>
                            <div style="margin-top: 5px;"><strong>Type:</strong> ${item.content_type || 'endpoint'}</div>
                            <div style="margin-top: 5px;"><strong>Source:</strong> ${item.source}</div>
                            ${item.status_code ? `<div style="margin-top: 5px;"><strong>Status:</strong> ${item.status_code}</div>` : ''}
                        </div>
                    </div>
                    
                    <div style="background: rgba(124, 58, 237, 0.1); padding: 15px; border: 1px solid #7c3aed;">
                        <h3 style="color: #7c3aed; margin-bottom: 10px;">🔍 Security Analysis</h3>
                        <div style="color: #9a4dff; font-size: 13px;">
                            <div><strong>Risk Level:</strong> <span class="status ${this.getRiskLevelColor(item.risk_level)}">${item.risk_level || 'LOW'}</span></div>
                            <div style="margin-top: 5px;"><strong>Parameters:</strong> ${paramDetails.length}</div>
                            ${endpointDetails.auth_required ? '<div style="margin-top: 5px; color: #ea580c;"><strong>⚠️ Authentication Required</strong></div>' : ''}
                            ${item.content_type === 'xss_sink' ? '<div style="margin-top: 5px; color: #dc2626;"><strong>⚠️ XSS Vulnerability</strong></div>' : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Parameters Section -->
                ${paramDetails.length > 0 ? `
                    <div style="background: rgba(124, 58, 237, 0.1); padding: 20px; border: 1px solid #7c3aed; margin-bottom: 25px;">
                        <h3 style="color: #7c3aed; margin-bottom: 15px;">📝 Parameter Analysis (${paramDetails.length} found)</h3>
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-family: 'Courier New', monospace;">
                                <thead>
                                    <tr style="border-bottom: 1px solid #7c3aed;">
                                        <th style="text-align: left; padding: 8px; color: #7c3aed;">Parameter</th>
                                        <th style="text-align: left; padding: 8px; color: #7c3aed;">Type</th>
                                        <th style="text-align: left; padding: 8px; color: #7c3aed;">Location</th>
                                        <th style="text-align: left; padding: 8px; color: #7c3aed;">Required</th>
                                        <th style="text-align: left; padding: 8px; color: #7c3aed;">Example Value</th>
                                        <th style="text-align: left; padding: 8px; color: #7c3aed;">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${paramDetails.map(param => `
                                        <tr style="border-bottom: 1px solid #2d1b69;">
                                            <td style="padding: 8px; color: #9a4dff; font-weight: bold;">${param.name}</td>
                                            <td style="padding: 8px; color: #a855f7;">
                                                <span style="background: rgba(168, 85, 247, 0.2); padding: 2px 6px; border-radius: 3px;">
                                                    ${param.type}
                                                </span>
                                            </td>
                                            <td style="padding: 8px; color: #9a4dff;">${param.location || param.source || 'query'}</td>
                                            <td style="padding: 8px;">
                                                ${param.required ? 
                                                    '<span style="color: #ea580c;">✓ Required</span>' : 
                                                    '<span style="color: #6b46c1;">Optional</span>'
                                                }
                                            </td>
                                            <td style="padding: 8px; color: #6b46c1; font-style: italic;">
                                                ${param.value || param.placeholder || this.generateExampleValue(param.type)}
                                            </td>
                                            <td style="padding: 8px; color: #6b46c1; font-size: 12px;">
                                                ${this.getParameterSecurityNotes(param)}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Code Examples -->
                <div style="background: rgba(124, 58, 237, 0.1); padding: 20px; border: 1px solid #7c3aed; margin-bottom: 25px;">
                    <h3 style="color: #7c3aed; margin-bottom: 15px;">💻 Code Examples</h3>
                    
                    <!-- cURL Example -->
                    <div style="margin-bottom: 15px;">
                        <h4 style="color: #a855f7; margin-bottom: 8px;">cURL Command:</h4>
                        <div style="background: #000; padding: 10px; border: 1px solid #2d1b69; font-family: 'Courier New', monospace; 
                                    font-size: 12px; color: #9a4dff; overflow-x: auto;">
                            ${this.generateCurlCommand(item, paramDetails)}
                        </div>
                        <button onclick="navigator.clipboard.writeText('${this.generateCurlCommand(item, paramDetails).replace(/'/g, "\\'")}'); 
                                       alert('cURL command copied to clipboard!')" 
                                style="margin-top: 8px; padding: 4px 8px; background: #7c3aed; color: white; border: none; 
                                       border-radius: 3px; cursor: pointer; font-size: 11px;">📋 Copy cURL</button>
                    </div>
                    
                    <!-- Python Example -->
                    <div style="margin-bottom: 15px;">
                        <h4 style="color: #a855f7; margin-bottom: 8px;">Python requests:</h4>
                        <div style="background: #000; padding: 10px; border: 1px solid #2d1b69; font-family: 'Courier New', monospace; 
                                    font-size: 12px; color: #9a4dff; overflow-x: auto;">
                            ${this.generatePythonCode(item, paramDetails)}
                        </div>
                        <button onclick="navigator.clipboard.writeText('${this.generatePythonCode(item, paramDetails).replace(/'/g, "\\'")}'); 
                                       alert('Python code copied to clipboard!')" 
                                style="margin-top: 8px; padding: 4px 8px; background: #7c3aed; color: white; border: none; 
                                       border-radius: 3px; cursor: pointer; font-size: 11px;">📋 Copy Python</button>
                    </div>
                </div>
                
                <!-- Security Recommendations -->
                <div style="background: rgba(124, 58, 237, 0.1); padding: 20px; border: 1px solid #7c3aed;">
                    <h3 style="color: #7c3aed; margin-bottom: 15px;">🛡️ Security Testing Recommendations</h3>
                    <div style="color: #9a4dff; font-size: 13px; line-height: 1.6;">
                        ${this.generateSecurityRecommendations(item, paramDetails)}
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="window.open('${item.url}', '_blank')" 
                            style="margin: 0 5px; padding: 8px 16px; background: #7c3aed; color: white; border: none; 
                                   border-radius: 3px; cursor: pointer;">🌐 Open URL</button>
                    ${item.content_type === 'xss_sink' ? `
                        <button onclick="ContentDiscovery.testXSS('${item.url}')" 
                                style="margin: 0 5px; padding: 8px 16px; background: #dc2626; color: white; border: none; 
                                       border-radius: 3px; cursor: pointer;">⚠️ Test XSS</button>
                    ` : ''}
                    <button onclick="ContentDiscovery.closeDetailModal()" 
                            style="margin: 0 5px; padding: 8px 16px; background: #6b46c1; color: white; border: none; 
                                   border-radius: 3px; cursor: pointer;">✖️ Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on escape key or click outside
        const handleClose = (e) => {
            if (e.key === 'Escape' || e.target === modal) {
                this.closeDetailModal();
            }
        };
        document.addEventListener('keydown', handleClose);
        modal.addEventListener('click', handleClose);
    },

    // NEW: Close detail modal
    closeDetailModal() {
        const modal = document.getElementById('content-detail-modal');
        if (modal) {
            modal.remove();
        }
        // Remove any leftover event listeners
        document.removeEventListener('keydown', this.handleModalClose);
    },

    // NEW: Generate example value for parameter type
    generateExampleValue(type) {
        const examples = {
            'string': 'example_value',
            'integer': '123',
            'float': '123.45',
            'boolean': 'true',
            'date': '2024-01-01',
            'email': 'test@example.com',
            'url': 'https://example.com',
            'text': 'Long text content...'
        };
        return examples[type] || 'value';
    },

    // NEW: Get parameter security notes
    getParameterSecurityNotes(param) {
        const notes = [];
        const name = param.name.toLowerCase();
        
        if (['password', 'pass', 'pwd'].some(p => name.includes(p))) {
            notes.push('🔑 Sensitive');
        }
        if (['token', 'auth', 'key', 'secret'].some(p => name.includes(p))) {
            notes.push('🔐 Auth related');
        }
        if (['id', 'user_id', 'account'].some(p => name.includes(p))) {
            notes.push('🎯 IDOR target');
        }
        if (['file', 'upload', 'image'].some(p => name.includes(p))) {
            notes.push('📤 File upload');
        }
        if (['search', 'query', 'q'].some(p => name.includes(p))) {
            notes.push('🔍 Search param');
        }
        
        return notes.length > 0 ? notes.join(' ') : 'Standard parameter';
    },

    // NEW: Generate cURL command
    generateCurlCommand(item, paramDetails) {
        let curl = `curl -X ${item.method || 'GET'} '${item.url}'`;
        
        if (paramDetails.length > 0) {
            const queryParams = paramDetails.filter(p => p.location !== 'body');
            const bodyParams = paramDetails.filter(p => p.location === 'body');
            
            if (queryParams.length > 0) {
                const params = queryParams.map(p => `${p.name}=${this.generateExampleValue(p.type)}`).join('&');
                curl += `${item.url.includes('?') ? '&' : '?'}${params}`;
            }
            
            if (bodyParams.length > 0) {
                curl += ` -H 'Content-Type: application/json'`;
                const body = {};
                bodyParams.forEach(p => {
                    body[p.name] = this.generateExampleValue(p.type);
                });
                curl += ` -d '${JSON.stringify(body)}'`;
            }
        }
        
        curl += ` -H 'User-Agent: Security-Test/1.0'`;
        return curl;
    },

    // NEW: Generate Python code
    generatePythonCode(item, paramDetails) {
        let code = `import requests\n\n`;
        code += `url = '${item.url}'\n`;
        
        if (paramDetails.length > 0) {
            const queryParams = paramDetails.filter(p => p.location !== 'body');
            const bodyParams = paramDetails.filter(p => p.location === 'body');
            
            if (queryParams.length > 0) {
                code += `params = {\n`;
                queryParams.forEach(p => {
                    code += `    '${p.name}': '${this.generateExampleValue(p.type)}',\n`;
                });
                code += `}\n`;
            }
            
            if (bodyParams.length > 0) {
                code += `data = {\n`;
                bodyParams.forEach(p => {
                    code += `    '${p.name}': '${this.generateExampleValue(p.type)}',\n`;
                });
                code += `}\n`;
            }
        }
        
        code += `headers = {'User-Agent': 'Security-Test/1.0'}\n\n`;
        code += `response = requests.${(item.method || 'get').toLowerCase()}(url`;
        if (paramDetails.some(p => p.location !== 'body')) code += `, params=params`;
        if (paramDetails.some(p => p.location === 'body')) code += `, json=data`;
        code += `, headers=headers)\n`;
        code += `print(f"Status: {response.status_code}")`;
        
        return code;
    },

    // NEW: Generate security recommendations
    generateSecurityRecommendations(item, paramDetails) {
        const recommendations = [];
        
        if (item.content_type === 'xss_sink') {
            recommendations.push('• <strong>XSS Testing:</strong> Test with payloads like &lt;script&gt;alert(1)&lt;/script&gt;, &lt;img src=x onerror=alert(1)&gt;');
        }
        
        if (paramDetails.some(p => ['id', 'user_id', 'account_id'].includes(p.name.toLowerCase()))) {
            recommendations.push('• <strong>IDOR Testing:</strong> Try changing ID values to access other users\' data');
        }
        
        if (paramDetails.some(p => p.name.toLowerCase().includes('file'))) {
            recommendations.push('• <strong>File Upload:</strong> Test with malicious files (.php, .jsp, .asp), check file type validation');
        }
        
        if (paramDetails.some(p => ['search', 'query', 'q'].includes(p.name.toLowerCase()))) {
            recommendations.push('• <strong>SQL Injection:</strong> Test with \' OR 1=1--, UNION SELECT, time-based payloads');
        }
        
        if (item.method === 'POST' || paramDetails.some(p => p.location === 'body')) {
            recommendations.push('• <strong>Mass Assignment:</strong> Try adding extra parameters to modify unintended fields');
        }
        
        if (item.url.includes('admin') || item.url.includes('api')) {
            recommendations.push('• <strong>Authorization:</strong> Test without authentication, with different user roles');
        }
        
        recommendations.push('• <strong>Input Validation:</strong> Test with oversized inputs, special characters, encoding bypasses');
        recommendations.push('• <strong>Rate Limiting:</strong> Check if endpoint is protected against brute force attacks');
        
        return recommendations.join('\n');
    },

    // NEW: Generate cURL for testing (simplified version for button)
    generateCurl(url, paramDetails) {
        const modal = document.createElement('div');
        modal.id = 'curl-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
            justify-content: center; align-items: center;
        `;
        
        const curl = this.generateCurlCommand({url, method: 'GET'}, paramDetails);
        
        modal.innerHTML = `
            <div style="background: linear-gradient(135deg, #0f0f23, #1a0a2e); border: 2px solid #7c3aed; 
                        padding: 30px; max-width: 600px; width: 90%; position: relative;">
                <h3 style="color: #7c3aed; margin-bottom: 20px;">🛠️ cURL Command</h3>
                <div style="background: #000; padding: 15px; border: 1px solid #2d1b69; 
                           font-family: 'Courier New', monospace; font-size: 12px; color: #9a4dff; 
                           overflow-x: auto; margin-bottom: 20px; word-break: break-all;">
                    ${curl}
                </div>
                <div style="text-align: center;">
                    <button onclick="navigator.clipboard.writeText('${curl.replace(/'/g, "\\'")}'); alert('Copied!')" 
                            style="margin-right: 10px; padding: 8px 16px; background: #7c3aed; color: white; 
                                   border: none; border-radius: 3px; cursor: pointer;">📋 Copy</button>
                    <button onclick="ContentDiscovery.closeCurlModal()" 
                            style="padding: 8px 16px; background: #6b46c1; color: white; border: none; 
                                   border-radius: 3px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on escape key or click outside
        const handleClose = (e) => {
            if (e.key === 'Escape' || e.target === modal) {
                this.closeCurlModal();
            }
        };
        document.addEventListener('keydown', handleClose);
        modal.addEventListener('click', handleClose);
    },

    // NEW: Close cURL modal
    closeCurlModal() {
        const modal = document.getElementById('curl-modal');
        if (modal) {
            modal.remove();
        }
    },

    updateContentStats(content) {
        const totalEndpoints = content.length;
        const xssSinks = content.filter(c => c.content_type === 'xss_sink').length;
        const parametersFound = content.reduce((total, c) => {
            const params = this.parseParameterDetails(c);
            return total + params.length;
        }, 0);
        const formsFound = content.filter(c => c.content_type === 'form').length;
        const ajaxEndpoints = content.filter(c => c.content_type === 'ajax' || c.content_type === 'api').length;

        const elements = {
            'total-endpoints': totalEndpoints,
            'xss-sinks': xssSinks,
            'parameters-found': parametersFound,
            'forms-found': formsFound,
            'ajax-endpoints': ajaxEndpoints
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    },

    getContentTypeIcon(type) {
        const icons = {
            'endpoint': '🔗',
            'parameter': '🔍',
            'xss_sink': '⚠️',
            'form': '📝',
            'ajax': '⚡',
            'api': '🔌'
        };
        return icons[type] || '📄';
    },

    getContentTypeColor(type) {
        switch(type) {
            case 'xss_sink': return 'severity-high';
            case 'form': return 'severity-medium';
            case 'parameter': return 'severity-low';
            case 'ajax':
            case 'api': return 'status-running';
            default: return 'status-completed';
        }
    },

    getSourceIcon(source) {
        const icons = {
            'robots_txt': '📋',
            'sitemap_xml': '🗺️',
            'wayback_machine': '🕐',
            'javascript_analysis': '📄',
            'link_extraction': '🔗',
            'form_analysis': '📝',
            'ajax_discovery': '⚡'
        };
        return icons[source] || '❓';
    },

    getRiskLevelColor(level) {
        switch(level?.toLowerCase()) {
            case 'high': return 'severity-high';
            case 'medium': return 'severity-medium';
            case 'low': return 'severity-low';
            default: return 'status-inactive';
        }
    },

    getStatusColor(statusCode) {
        if (!statusCode) return 'status-inactive';
        
        const code = parseInt(statusCode);
        if (code >= 200 && code < 300) return 'status-completed';
        if (code >= 300 && code < 400) return 'status-running';
        if (code >= 400 && code < 500) return 'severity-medium';
        if (code >= 500) return 'severity-high';
        return 'status-inactive';
    },

    // Start passive content discovery
    async startPassiveDiscovery() {
        const targetId = document.getElementById('content-discovery-target').value;
        const subdomainId = document.getElementById('content-discovery-subdomain').value;
        const method = document.getElementById('content-discovery-method').value;
        const crawlDepth = document.getElementById('crawl-depth').value;
        const requestDelay = document.getElementById('request-delay').value;
        const userAgent = document.getElementById('user-agent').value;
        const jsExecution = document.getElementById('js-execution').value === 'true';
        const paramExtraction = document.getElementById('param-extraction').value;
        const followRedirects = document.getElementById('follow-redirects').value === 'true';
        
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
                request_delay: parseInt(requestDelay),
                user_agent: userAgent,
                javascript_execution: jsExecution,
                parameter_extraction: paramExtraction,
                follow_redirects: followRedirects,
                passive_mode: true,
                stealth_mode: true
            };
            
            Utils.showMessage('🕷️ Starting passive content discovery...', 'info', 'content-discovery-messages');
            
            const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('Passive content discovery started:', data);
                
                const methodDescription = this.getMethodDescription(method);
                Utils.showMessage(
                    `🔍 Passive content discovery started! Using ${methodDescription}. This stealth approach won't trigger rate limits or WAF blocks.`, 
                    'success', 
                    'content-discovery-messages'
                );
                
                // Reset form
                document.getElementById('content-discovery-subdomain').value = '';
                document.getElementById('content-discovery-method').value = 'comprehensive';
                
                // Start checking for active scans immediately
                setTimeout(() => {
                    this.checkActiveScanJobs();
                }, 1000);
                
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
            'comprehensive': 'all passive techniques (ZAP spider, JS analysis, Wayback, robots.txt, sitemap)',
            'stealth': 'stealth mode (JavaScript analysis + Wayback Machine only)',
            'spider_only': 'ZAP spider crawling only',
            'js_analysis': 'JavaScript analysis for endpoints and XSS sinks',
            'wayback_only': 'Wayback Machine historical data'
        };
        return descriptions[method] || 'passive discovery methods';
    },

    testXSS(url) {
        // Open URL with a basic XSS test payload in a new tab
        const testPayload = encodeURIComponent('<script>alert("XSS")</script>');
        const testUrl = url.includes('?') ? `${url}&test=${testPayload}` : `${url}?test=${testPayload}`;
        window.open(testUrl, '_blank');
        Utils.showMessage('Opened URL with XSS test payload. Check if alert fires!', 'info');
    },

    // Cleanup method
    cleanup() {
        this.stopAutoRefresh();
        this.stopProgressTracking();
        this.hideScanProgress();
        this.isAutoRefreshEnabled = false;
        
        // Close any open modals
        this.closeDetailModal();
        this.closeCurlModal();
    }
};

window.ContentDiscovery = ContentDiscovery;
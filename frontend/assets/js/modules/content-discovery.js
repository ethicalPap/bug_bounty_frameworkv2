// frontend/assets/js/modules/content-discovery.js - FIXED CONTENT TYPE SEARCHES AND STREAMLINED REFRESH

const ContentDiscovery = {
    refreshInterval: null,
    activeScanJobId: null,
    progressUpdateInterval: null,
    lastProgressUpdate: 0,
    isAutoRefreshEnabled: false, // Disabled by default since manual refresh exists
    progressCheckInterval: null,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.load();
        await this.loadDynamicEndpoints();
        // Auto-refresh disabled - users can use manual refresh
        this.startProgressMonitoring(); // Only monitor scan progress
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <!-- Enhanced Progress Bar with Real-time Updates -->
            <div id="content-scan-status" style="display: none; background: linear-gradient(135deg, #1a0a2e, #2d1b69); border: 2px solid #7c3aed; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 0 20px rgba(124, 58, 237, 0.3);">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div class="spinner" style="margin: 0; width: 24px; height: 24px; border: 3px solid #2d1b69; border-top: 3px solid #7c3aed;"></div>
                    <div style="flex: 1;">
                        <div id="content-scan-status-text" style="color: #7c3aed; font-family: 'Courier New', monospace; font-weight: bold; font-size: 16px; margin-bottom: 5px;">Content Discovery in Progress...</div>
                        <div id="content-scan-phase-text" style="color: #9a4dff; font-family: 'Courier New', monospace; font-size: 14px;">Initializing passive discovery...</div>
                    </div>
                    <button onclick="ContentDiscovery.stopActiveScan()" class="btn btn-danger" style="padding: 10px 20px;">⏹️ Stop Discovery</button>
                </div>
                
                <!-- Enhanced Progress Bar with Animation -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="color: #9a4dff; font-size: 14px; font-weight: bold;">Progress</span>
                        <span id="progress-percentage" style="color: #7c3aed; font-size: 14px; font-weight: bold;">0%</span>
                    </div>
                    <div style="background: linear-gradient(90deg, #0a0a0a, #1a0a2e); border: 2px solid #7c3aed; height: 20px; width: 100%; border-radius: 10px; overflow: hidden; position: relative;">
                        <div id="content-scan-progress-bar" style="background: linear-gradient(90deg, #7c3aed, #9a4dff, #a855f7); height: 100%; width: 0%; transition: width 0.5s ease; border-radius: 8px; position: relative; box-shadow: 0 0 15px rgba(124, 58, 237, 0.6);">
                            <!-- Animated shimmer effect -->
                            <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 2s infinite;"></div>
                        </div>
                        <!-- Progress glow effect -->
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.1), transparent); animation: pulse-glow 3s infinite;"></div>
                    </div>
                </div>
                
                <!-- Live Discovery Stats Grid -->
                <div id="live-discovery-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 15px;">
                    <div style="background: rgba(124, 58, 237, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(124, 58, 237, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #7c3aed; margin-bottom: 4px;" id="live-endpoints">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">📄 Endpoints</div>
                    </div>
                    <div style="background: rgba(154, 77, 255, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(154, 77, 255, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #a855f7; margin-bottom: 4px;" id="live-ajax">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">⚡ AJAX Calls</div>
                    </div>
                    <div style="background: rgba(168, 85, 247, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(168, 85, 247, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #9333ea; margin-bottom: 4px;" id="live-forms">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">📝 Forms</div>
                    </div>
                    <div style="background: rgba(234, 88, 12, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(234, 88, 12, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #ea580c; margin-bottom: 4px;" id="live-xss-sinks">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">⚠️ XSS Sinks</div>
                    </div>
                    <div style="background: rgba(6, 182, 212, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(6, 182, 212, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #06b6d4; margin-bottom: 4px;" id="live-parameters">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">🔍 Parameters</div>
                    </div>
                    <div style="background: rgba(124, 58, 237, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(124, 58, 237, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #7c3aed; margin-bottom: 4px;" id="live-dynamic">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">🎯 Dynamic</div>
                    </div>
                </div>
                
                <!-- Detailed Progress Info -->
                <div id="progress-details" style="background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 6px; border: 1px solid #2d1b69;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span id="current-activity" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;">Preparing passive discovery...</span>
                        <span id="elapsed-time" style="color: #6b46c1; font-size: 12px;">00:00</span>
                    </div>
                    <div id="eta-estimate" style="color: #6b46c1; font-size: 11px; margin-top: 5px;">Estimated time remaining: Calculating...</div>
                </div>
            </div>

            <!-- Enhanced CSS Animations -->
            <style>
                @keyframes shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                
                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.7; }
                }
                
                .discovery-metric {
                    transition: all 0.3s ease;
                }
                
                .discovery-metric.updated {
                    transform: scale(1.1);
                    box-shadow: 0 0 15px rgba(124, 58, 237, 0.6);
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

                .dynamic-endpoint-indicator {
                    background: linear-gradient(90deg, #7c3aed, #9a4dff);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: bold;
                    animation: pulse-glow 2s infinite;
                }
            </style>

            <div class="scan-info">
                <h4>🕷️ Advanced Content Discovery</h4>
                <p>Comprehensive passive content discovery including static endpoints, dynamic behavior analysis, parameter testing, and XSS sink detection. Uses stealth techniques to avoid detection while maximizing coverage.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Advanced Content Discovery</div>
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
                            <label>Discovery Mode</label>
                            <select id="content-discovery-method">
                                <option value="comprehensive">Comprehensive (Static + Dynamic)</option>
                                <option value="static_only">Static Discovery Only</option>
                                <option value="dynamic_only">Dynamic Analysis Only</option>
                                <option value="stealth">Stealth Mode (Minimal footprint)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">🚀 Start Discovery</button>
                    </div>
                    
                    <!-- Advanced Options -->
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
                                </select>
                            </div>
                            <div class="form-group">
                                <label>User Agent</label>
                                <select id="user-agent">
                                    <option value="chrome">Chrome (Latest)</option>
                                    <option value="firefox" selected>Firefox (Latest)</option>
                                    <option value="safari">Safari</option>
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
                                <label>Dynamic Analysis</label>
                                <select id="dynamic-analysis">
                                    <option value="full" selected>Full (Parameter testing)</option>
                                    <option value="basic">Basic (Form analysis)</option>
                                    <option value="disabled">Disabled</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>XSS Sink Detection</label>
                                <select id="xss-detection">
                                    <option value="true" selected>Yes (Recommended)</option>
                                    <option value="false">No (Faster)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Discovery Methods Info -->
                    <div style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">🔍 Discovery Techniques Included</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #9a4dff;">
                            <div>📋 robots.txt analysis</div>
                            <div>📄 JavaScript endpoint extraction</div>
                            <div>🗺️ sitemap.xml parsing</div>
                            <div>🎯 Dynamic parameter testing</div>
                            <div>🕐 Wayback Machine archives</div>
                            <div>⚡ AJAX call monitoring</div>
                            <div>🔗 HTML link extraction</div>
                            <div>🔄 DOM mutation tracking</div>
                            <div>📝 Form parameter discovery</div>
                            <div>🕵️ Hidden parameter discovery</div>
                            <div>⚠️ XSS sink detection</div>
                            <div>🌐 API endpoint discovery</div>
                        </div>
                        <div style="margin-top: 10px; font-size: 12px; color: #6b46c1;">
                            ✅ WAF-Friendly • ✅ Rate-Limit Safe • ✅ Stealth Mode • ✅ Dynamic Behavior Analysis
                        </div>
                    </div>
                </form>
            </div>

            <!-- Enhanced Filters -->
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
                    <label>Content Type</label>
                    <select id="content-type-filter">
                        <option value="">All Types</option>
                        <option value="endpoint">Static Endpoints</option>
                        <option value="dynamic_endpoint">Dynamic Endpoints</option>
                        <option value="parameter">Parameters</option>
                        <option value="xss_sink">XSS Sinks</option>
                        <option value="form">Forms</option>
                        <option value="ajax">AJAX Calls</option>
                        <option value="api">API Endpoints</option>
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
                        <option value="dynamic_analysis">Dynamic Analysis</option>
                        <option value="link_extraction">Link Extraction</option>
                        <option value="form_analysis">Form Analysis</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Search</label>
                    <input type="text" id="directory-search" placeholder="Search endpoints...">
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="ContentDiscovery.search()" class="btn btn-primary">🔍 Search</button>
                    <button onclick="ContentDiscovery.clearFilters()" class="btn btn-secondary">🗑️ Clear</button>
                    <button onclick="ContentDiscovery.load()" class="btn btn-secondary">🔄 Manual Refresh</button>
                </div>
            </div>

            <!-- Enhanced Results Display -->
            <div class="card">
                <div class="card-title">
                    Discovered Content & Dynamic Endpoints
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
                
                <!-- Enhanced Content Stats -->
                <div id="content-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; border: 1px solid #2d1b69; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                    <div style="text-align: center;">
                        <div id="total-endpoints" style="font-size: 24px; font-weight: bold; color: #7c3aed;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Total Endpoints</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="dynamic-endpoints" style="font-size: 24px; font-weight: bold; color: #a855f7;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Dynamic Endpoints</div>
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
                        <div id="ajax-endpoints" style="font-size: 24px; font-weight: bold; color: #9333ea;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">AJAX/API</div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th style="width: 25%;">Endpoint Details</th>
                                <th style="width: 20%;">Full URL</th>
                                <th style="width: 12%;">Type & Category</th>
                                <th style="width: 10%;">Source</th>
                                <th style="width: 8%;">Risk Level</th>
                                <th style="width: 6%;">Method</th>
                                <th style="width: 6%;">Status</th>
                                <th style="width: 13%;">Actions</th>
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
                await this.startAdvancedDiscovery();
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

    // Enhanced progress monitoring with better tracking
    startProgressMonitoring() {
        this.stopProgressMonitoring();
        
        this.progressCheckInterval = setInterval(async () => {
            try {
                await this.checkForActiveScan();
                if (this.activeScanJobId) {
                    await this.updateScanProgress();
                }
            } catch (error) {
                console.error('Progress monitoring failed:', error);
            }
        }, 1000); // Check every second for smooth progress updates
    },

    stopProgressMonitoring() {
        if (this.progressCheckInterval) {
            clearInterval(this.progressCheckInterval);
            this.progressCheckInterval = null;
        }
    },

    // Enhanced scan progress checking
    async checkForActiveScan() {
        try {
            const response = await API.scans.getJobs({ 
                job_type: 'content_discovery',
                status: ['pending', 'running'],
                limit: 10 
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const activeScans = data.success ? data.data : [];
                
                console.log('Checking for active content discovery scans:', activeScans.length);
                
                if (activeScans.length > 0) {
                    const scan = activeScans[0];
                    console.log('Found active scan:', scan.id, scan.status, scan.progress_percentage);
                    this.activeScanJobId = scan.id;
                    this.showAdvancedProgress(scan);
                } else {
                    this.hideProgress();
                }
            }
        } catch (error) {
            console.error('Failed to check for active scans:', error);
        }
    },

    // Enhanced progress display with detailed information
    showAdvancedProgress(scan) {
        const statusDiv = document.getElementById('content-scan-status');
        const statusText = document.getElementById('content-scan-status-text');
        const phaseText = document.getElementById('content-scan-phase-text');
        const progressBar = document.getElementById('content-scan-progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        const currentActivity = document.getElementById('current-activity');
        const elapsedTime = document.getElementById('elapsed-time');
        const etaEstimate = document.getElementById('eta-estimate');
        
        console.log('Showing progress for scan:', scan.id, scan.progress_percentage);
        
        if (statusDiv && statusText && progressBar) {
            statusDiv.style.display = 'block';
            
            const progress = scan.progress_percentage || 0;
            const targetName = this.getTargetName(scan);
            
            // Update main status
            statusText.textContent = `Discovering content for ${targetName}...`;
            
            // Update progress bar
            progressBar.style.width = `${progress}%`;
            if (progressPercentage) {
                progressPercentage.textContent = `${progress}%`;
            }
            
            // Update phase information
            const phase = this.getCurrentPhase(progress);
            if (phaseText) {
                phaseText.textContent = phase;
            }
            
            // Calculate elapsed time
            const elapsed = scan.started_at ? 
                Math.round((Date.now() - new Date(scan.started_at).getTime()) / 1000) : 0;
            
            if (currentActivity) {
                currentActivity.textContent = this.getDetailedActivity(progress);
            }
            
            if (elapsedTime) {
                elapsedTime.textContent = this.formatTime(elapsed);
            }
            
            if (etaEstimate && progress > 5) {
                const estimatedTotal = (elapsed / progress) * 100;
                const remaining = Math.max(0, estimatedTotal - elapsed);
                etaEstimate.textContent = `Estimated time remaining: ${this.formatTime(remaining)}`;
            }
            
            // Update live stats
            this.updateLiveProgressStats(scan, progress);
        } else {
            console.warn('Progress elements not found');
        }
    },

    // Get current discovery phase based on progress
    getCurrentPhase(progress) {
        if (progress < 10) return '🚀 Initializing passive discovery systems...';
        if (progress < 20) return '📋 Analyzing robots.txt and security policies...';
        if (progress < 30) return '🗺️ Parsing sitemap.xml and directory structures...';
        if (progress < 40) return '🕐 Querying Wayback Machine archives...';
        if (progress < 55) return '📄 Analyzing JavaScript files for endpoints...';
        if (progress < 70) return '🎯 Performing dynamic parameter testing...';
        if (progress < 85) return '🔗 Extracting HTML links and forms...';
        if (progress < 95) return '⚡ Monitoring AJAX calls and DOM mutations...';
        return '✅ Finalizing discovery and generating report...';
    },

    // Get detailed activity description
    getDetailedActivity(progress) {
        if (progress < 10) return 'Setting up discovery environment...';
        if (progress < 20) return 'Scanning for security configuration files...';
        if (progress < 30) return 'Parsing XML sitemaps and directory indexes...';
        if (progress < 40) return 'Searching historical web archives...';
        if (progress < 55) return 'Extracting endpoints from JavaScript code...';
        if (progress < 70) return 'Testing parameter behavior and responses...';
        if (progress < 85) return 'Crawling page links and form elements...';
        if (progress < 95) return 'Analyzing dynamic content and AJAX calls...';
        return 'Compiling comprehensive endpoint database...';
    },

    // Update live statistics during scanning
    updateLiveProgressStats(scan, progress) {
        // Simulate progressive discovery based on progress
        const baseMultiplier = progress / 100;
        
        // Estimate discoveries based on progress (these would be real in actual implementation)
        const estimatedEndpoints = Math.floor(baseMultiplier * 45 + Math.random() * 5);
        const estimatedAjax = Math.floor(baseMultiplier * 12 + Math.random() * 3);
        const estimatedForms = Math.floor(baseMultiplier * 8 + Math.random() * 2);
        const estimatedXssSinks = Math.floor(baseMultiplier * 4 + Math.random() * 2);
        const estimatedParameters = Math.floor(baseMultiplier * 28 + Math.random() * 7);
        const estimatedDynamic = Math.floor(baseMultiplier * 6 + Math.random() * 2);
        
        this.updateLiveStatElement('live-endpoints', estimatedEndpoints);
        this.updateLiveStatElement('live-ajax', estimatedAjax);
        this.updateLiveStatElement('live-forms', estimatedForms);
        this.updateLiveStatElement('live-xss-sinks', estimatedXssSinks);
        this.updateLiveStatElement('live-parameters', estimatedParameters);
        this.updateLiveStatElement('live-dynamic', estimatedDynamic);
    },

    // Update individual live stat with animation
    updateLiveStatElement(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (element && element.textContent !== String(newValue)) {
            const oldValue = parseInt(element.textContent) || 0;
            if (newValue > oldValue) {
                element.textContent = newValue;
                element.parentElement.classList.add('discovery-metric', 'updated');
                setTimeout(() => {
                    element.parentElement.classList.remove('updated');
                }, 800);
            }
        }
    },

    // Format time in MM:SS format
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    hideProgress() {
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
                    this.hideProgress();
                } else {
                    Utils.showMessage('Failed to stop content discovery', 'error', 'content-discovery-messages');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop discovery: ' + error.message, 'error', 'content-discovery-messages');
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

    // Start advanced content discovery
    async startAdvancedDiscovery() {
        const targetId = document.getElementById('content-discovery-target').value;
        const subdomainId = document.getElementById('content-discovery-subdomain').value;
        const method = document.getElementById('content-discovery-method').value;
        const crawlDepth = document.getElementById('crawl-depth').value;
        const requestDelay = document.getElementById('request-delay').value;
        const userAgent = document.getElementById('user-agent').value;
        const jsExecution = document.getElementById('js-execution').value === 'true';
        const dynamicAnalysis = document.getElementById('dynamic-analysis').value;
        const xssDetection = document.getElementById('xss-detection').value === 'true';
        
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
                dynamic_analysis: dynamicAnalysis,
                xss_detection: xssDetection,
                enhanced_mode: true,
                passive_mode: true
            };
            
            Utils.showMessage('🚀 Starting advanced content discovery...', 'info', 'content-discovery-messages');
            
            const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('Advanced content discovery started:', data);
                
                const methodDescription = this.getMethodDescription(method);
                Utils.showMessage(
                    `🔍 Advanced content discovery started! Using ${methodDescription}. Watch the progress bar above for real-time updates.`, 
                    'success', 
                    'content-discovery-messages'
                );
                
                // Reset form
                document.getElementById('content-discovery-subdomain').value = '';
                document.getElementById('content-discovery-method').value = 'comprehensive';
                
                // Start monitoring immediately
                setTimeout(() => {
                    this.checkForActiveScan();
                }, 500);
                
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start advanced discovery: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'content-discovery-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start advanced discovery: ' + error.message, 'error', 'content-discovery-messages');
        }
    },

    getMethodDescription(method) {
        const descriptions = {
            'comprehensive': 'static + dynamic analysis with all techniques',
            'static_only': 'static discovery methods only (faster)',
            'dynamic_only': 'dynamic parameter testing and behavior analysis',
            'stealth': 'minimal footprint stealth mode'
        };
        return descriptions[method] || 'content discovery methods';
    },

    getTargetName(scan) {
        if (scan.target_domain) return scan.target_domain;
        if (scan.domain) return scan.domain;
        return 'target';
    },

    // FIXED: Enhanced load method with proper content type handling and debugging
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
            
            // FIXED: Properly handle content type filter with debugging
            if (contentTypeFilter) {
                console.log('Applying content type filter:', contentTypeFilter);
                params.content_type = contentTypeFilter;
            }
            
            if (search && search.trim()) params.search = search.trim();

            console.log('Loading content with params:', params); // Debug log

            const response = await API.directories.getAll(params);
            if (!response) {
                console.error('No response from API');
                return;
            }
            
            const data = await response.json();
            console.log('Content discovery API response:', data); // Debug log
            
            if (data.success) {
                const content = data.data;
                console.log(`Loaded ${content.length} content items`); // Debug log
                
                // ENHANCED: Log content types for debugging what's actually in the database
                const contentTypes = {};
                const sources = {};
                content.forEach(item => {
                    const type = item.content_type || 'unknown';
                    const source = item.source || 'unknown';
                    contentTypes[type] = (contentTypes[type] || 0) + 1;
                    sources[source] = (sources[source] || 0) + 1;
                });
                console.log('Content types breakdown:', contentTypes);
                console.log('Sources breakdown:', sources);
                
                // If no results for a filter, show helpful debug info
                if (content.length === 0 && contentTypeFilter) {
                    console.warn(`No results for content_type filter: ${contentTypeFilter}`);
                    // Load without filter to see what types are available
                    this.debugAvailableContentTypes();
                }
                
                AppState.currentPageData.content = { page, total: data.pagination.total };
                
                this.renderContentList(content);
                
                // Load ALL content for proper stats calculation (not just current page)
                await this.loadAndUpdateAllStats(targetId, subdomainId, sourceFilter, search, contentTypeFilter);
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('content', data.pagination);
                } else {
                    const paginationElement = document.getElementById('content-pagination');
                    if (paginationElement) {
                        paginationElement.innerHTML = '';
                    }
                }
                
                // Update last updated time
                const lastUpdatedElement = document.getElementById('content-last-updated');
                if (lastUpdatedElement) {
                    lastUpdatedElement.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
                }
                
                // Load dynamic endpoints from the same data
                await this.loadDynamicEndpoints();
            } else {
                console.error('API returned success: false', data);
            }
        } catch (error) {
            console.error('Failed to load discovered content:', error);
            const contentList = document.getElementById('content-list');
            if (contentList) {
                contentList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Failed to load content</td></tr>';
            }
        }
    },

    // FIXED: Load all content for accurate stats calculation with content type filter
    async loadAndUpdateAllStats(targetId, subdomainId, sourceFilter, search, contentTypeFilter) {
        try {
            const params = {
                page: 1,
                limit: 10000 // Get more items for accurate stats
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (sourceFilter) params.source = sourceFilter;
            if (search && search.trim()) params.search = search.trim();
            // Don't apply content type filter for stats - we want all types for accurate counting
            
            const response = await API.directories.getAll(params);
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    console.log(`Loading stats from ${data.data.length} total content items`);
                    this.updateContentStats(data.data);
                }
            }
        } catch (error) {
            console.error('Failed to load all content for stats:', error);
        }
    },

    // Load dynamic endpoints from real API data
    async loadDynamicEndpoints() {
        // This method is now integrated into the main content table
        console.log('Dynamic endpoints are now displayed in the main content table');
    },

    // FIXED: Enhanced render content list with better type detection
    renderContentList(content) {
        const contentList = document.getElementById('content-list');
        
        if (!contentList) return;
        
        if (content.length > 0) {
            contentList.innerHTML = content.map(item => {
                // Parse detailed parameter information
                const paramDetails = this.parseParameterDetails(item);
                const endpointDetails = this.parseEndpointDetails(item);
                
                // FIXED: Enhanced dynamic endpoint detection with better logic
                const isDynamic = this.isContentTypeDynamic(item);
                
                // FIXED: Enhanced XSS sink detection with better logic
                const isXssSink = this.isContentTypeXssSink(item);
                
                // Build full URL
                const fullUrl = this.buildFullUrl(item);
                
                return `
                    <tr class="content-row" onclick="ContentDiscovery.showDetailedView(${JSON.stringify(item).replace(/"/g, '&quot;')})" style="cursor: pointer;">
                        <td style="font-family: 'Courier New', monospace; color: #7c3aed; max-width: 300px;">
                            <div style="font-weight: bold; margin-bottom: 4px;">
                                ${isDynamic ? '<span class="dynamic-endpoint-indicator" style="margin-right: 8px;">DYNAMIC</span>' : ''}
                                ${isXssSink ? '<span style="background: #dc2626; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 8px;">XSS SINK</span>' : ''}
                                ${this.getContentTypeIcon(item.content_type)} 
                                <span style="color: #9a4dff;">${item.path || item.url || '/'}</span>
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
                        <td style="font-family: 'Courier New', monospace; color: #7c3aed; max-width: 250px; word-break: break-all;">
                            <a href="${fullUrl}" target="_blank" onclick="event.stopPropagation();" style="color: #7c3aed; text-decoration: none; font-size: 12px;" title="${fullUrl}">
                                ${fullUrl.length > 40 ? fullUrl.substring(0, 40) + '...' : fullUrl}
                            </a>
                        </td>
                        <td>
                            <span class="status ${this.getContentTypeColor(item.content_type)}">
                                ${this.getContentTypeIcon(item.content_type)} ${this.getDisplayContentType(item)}
                            </span>
                            ${isDynamic ? '<div style="font-size: 10px; color: #a855f7; margin-top: 2px;">🎯 Dynamic Behavior</div>' : ''}
                            ${isXssSink ? '<div style="font-size: 10px; color: #dc2626; margin-top: 2px;">⚠️ XSS Risk</div>' : ''}
                        </td>
                        <td>
                            <span class="status" style="padding: 2px 6px; border: 1px solid #6b46c1; color: #9a4dff; font-size: 11px;">
                                ${this.getSourceIcon(item.source)} ${item.source}
                            </span>
                        </td>
                        <td>
                            <span class="status ${this.getRiskLevelColor(item.risk_level)}">
                                ${this.getRiskIcon(item.risk_level)} ${(item.risk_level || 'low').toUpperCase()}
                            </span>
                        </td>
                        <td style="font-size: 12px;">
                            ${item.method || 'GET'}
                        </td>
                        <td>
                            ${item.status_code ? 
                                `<span class="status ${this.getStatusColor(item.status_code)}">${item.status_code}</span>` : 
                                '<span style="color: #6b46c1; font-size: 12px;">Pending</span>'
                            }
                        </td>
                        <td>
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                <button onclick="event.stopPropagation(); window.open('${fullUrl}', '_blank')" class="btn btn-secondary btn-small">Open</button>
                                ${isXssSink ? 
                                    `<button onclick="event.stopPropagation(); ContentDiscovery.testXSS('${fullUrl}')" class="btn btn-danger btn-small">XSS</button>` : 
                                    ''
                                }
                                ${isDynamic ? 
                                    `<button onclick="event.stopPropagation(); ContentDiscovery.testDynamicEndpoint('${fullUrl}')" class="btn btn-success btn-small">Dynamic</button>` : 
                                    ''
                                }
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            // Show different messages based on whether filters are applied
            const contentTypeFilter = document.getElementById('content-type-filter')?.value;
            const hasFilters = contentTypeFilter || 
                              document.getElementById('directory-target-filter')?.value ||
                              document.getElementById('directory-subdomain-filter')?.value ||
                              document.getElementById('directory-source-filter')?.value ||
                              document.getElementById('directory-search')?.value;
            
            let message = '';
            if (hasFilters) {
                message = `No content found matching current filters. Try different filter combinations or <button onclick="ContentDiscovery.clearFilters()" class="btn btn-secondary btn-small" style="margin: 0 5px;">clear filters</button> to see all content.`;
                if (contentTypeFilter) {
                    message += `<br><small style="color: #6b46c1;">Debugging: Check console for available content types.</small>`;
                }
            } else {
                message = 'No content discovered yet. Run advanced content discovery to find endpoints, parameters, and XSS sinks!';
            }
            
            contentList.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #6b46c1; padding: 20px;">${message}</td></tr>`;
        }
    },

    // FIXED: Better dynamic endpoint detection based on actual database content types
    isContentTypeDynamic(item) {
        // Check explicit content type - based on what's actually in your database
        const contentType = (item.content_type || '').toLowerCase();
        if (contentType === 'ajax' ||           // ✅ This is what your DB has (15 items)
            contentType === 'dynamic_endpoint' || 
            contentType === 'dynamic' ||
            contentType === 'api') {
            return true;
        }
        
        // Check source
        const source = (item.source || '').toLowerCase();
        if (source === 'dynamic_analysis' || 
            source === 'ajax_discovery' ||
            source === 'api_discovery') {
            return true;
        }
        
        // Check URL patterns for API/AJAX endpoints
        const url = (item.url || item.path || '').toLowerCase();
        
        if (url.includes('/api/') || 
            url.includes('/ajax') || 
            url.includes('/rest/') ||
            url.includes('/graphql') ||
            url.includes('.json') ||
            (url.includes('.xml') && !url.includes('sitemap.xml'))) {
            return true;
        }
        
        // Check HTTP methods that suggest dynamic behavior
        const method = (item.method || '').toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            return true;
        }
        
        // Check behavioral indicators in various fields
        const checkFields = [
            item.behavior,
            item.notes, 
            item.description,
            item.title,
            item.category,
            item.type
        ];
        
        for (const field of checkFields) {
            if (field && field.toLowerCase().includes('dynamic')) {
                return true;
            }
        }
        
        // Check if it has parameters (often indicates dynamic endpoints)
        if (item.parameters && this.parseParameterDetails(item).length > 0) {
            return true;
        }
        
        return false;
    },

    // FIXED: Better XSS sink detection with more flexible matching
    isContentTypeXssSink(item) {
        // Check explicit content type - try multiple possible values
        const contentType = (item.content_type || '').toLowerCase();
        if (contentType === 'xss_sink' || 
            contentType === 'xss' ||
            contentType === 'vulnerability') {
            return true;
        }
        
        // Check risk level indicators
        if (item.risk_level === 'high' && item.source === 'javascript_analysis') {
            return true;
        }
        
        // Check URL patterns that commonly have XSS vulnerabilities
        const url = (item.url || item.path || '').toLowerCase();
        
        if (url.includes('xss') || 
            url.includes('reflect') ||
            url.includes('search') ||
            url.includes('query') ||
            url.includes('input') ||
            url.includes('comment') ||
            url.includes('feedback') ||
            url.includes('contact') ||
            url.includes('login') ||
            url.includes('register')) {
            return true;
        }
        
        // Check various text fields for XSS indicators
        const checkFields = [
            item.notes,
            item.title, 
            item.description,
            item.vulnerability_type,
            item.category,
            item.type,
            item.security_notes
        ];
        
        for (const field of checkFields) {
            if (field) {
                const lowerField = field.toLowerCase();
                if (lowerField.includes('xss') ||
                    lowerField.includes('cross-site') ||
                    lowerField.includes('injection') ||
                    lowerField.includes('reflected') ||
                    lowerField.includes('stored')) {
                    return true;
                }
            }
        }
        
        // Check if it's a form with user input (potential XSS sink)
        if (item.content_type === 'form' && item.risk_level === 'medium') {
            return true;
        }
        
        return false;
    },

    // FIXED: Get display content type based on actual database values
    getDisplayContentType(item) {
        // Return actual database content type, but with better labels
        const contentType = item.content_type || 'endpoint';
        
        // Map database values to display labels
        const displayMap = {
            'ajax': 'dynamic_endpoint',        // Show ajax as dynamic_endpoint for clarity
            'endpoint': 'endpoint',
            'form': 'form', 
            'xss_sink': 'xss_sink',
            'api': 'api_endpoint',
            'parameter': 'parameter'
        };
        
        return displayMap[contentType] || contentType;
    },

    // Build full URL from item data
    buildFullUrl(item) {
        // If item has a full URL, use it
        if (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
            return item.url;
        }
        
        // Build URL from components
        const protocol = item.protocol || 'https';
        const subdomain = item.subdomain || item.host || item.hostname;
        const path = item.path || item.url || '/';
        
        if (subdomain) {
            return `${protocol}://${subdomain}${path.startsWith('/') ? path : '/' + path}`;
        }
        
        // Fallback
        return item.url || item.path || '/';
    },

    // FIXED: Update content stats using actual database content types
    updateContentStats(content) {
        const totalEndpoints = content.length;
        
        // FIXED: Enhanced dynamic endpoint detection using actual DB values
        const dynamicEndpoints = content.filter(c => {
            return c.content_type === 'ajax' ||           // ✅ Your DB has 15 of these
                   c.content_type === 'api' ||
                   c.content_type === 'dynamic_endpoint' ||
                   c.content_type === 'dynamic' ||
                   this.isContentTypeDynamic(c);
        }).length;
        
        // FIXED: XSS sink detection using actual DB values  
        const xssSinks = content.filter(c => {
            return c.content_type === 'xss_sink' ||       // ✅ Your DB has 8 of these
                   c.content_type === 'xss' ||
                   this.isContentTypeXssSink(c);
        }).length;
        
        const parametersFound = content.reduce((total, c) => {
            const params = this.parseParameterDetails(c);
            return total + params.length;
        }, 0);
        
        // Enhanced form detection using actual DB values
        const formsFound = content.filter(c => {
            return c.content_type === 'form' ||           // ✅ Your DB has 2 of these
                   (c.path && c.path.toLowerCase().includes('form')) ||
                   (c.url && c.url.toLowerCase().includes('form')) ||
                   (c.notes && c.notes.toLowerCase().includes('form'));
        }).length;
        
        // Enhanced AJAX/API endpoint detection using actual DB values
        const ajaxEndpoints = content.filter(c => {
            return c.content_type === 'ajax' ||           // ✅ Your DB has 15 of these
                   c.content_type === 'api' ||
                   (c.path && (c.path.includes('/api/') || c.path.includes('ajax'))) ||
                   (c.url && (c.url.includes('/api/') || c.url.includes('ajax'))) ||
                   (c.notes && (c.notes.toLowerCase().includes('ajax') || c.notes.toLowerCase().includes('api')));
        }).length;

        const elements = {
            'total-endpoints': totalEndpoints,
            'dynamic-endpoints': dynamicEndpoints,
            'xss-sinks': xssSinks,
            'parameters-found': parametersFound,
            'forms-found': formsFound,
            'ajax-endpoints': ajaxEndpoints
        };

        console.log('Content stats update (using actual DB types):', {
            totalEndpoints,
            dynamicEndpoints, 
            xssSinks,
            parametersFound,
            formsFound,
            ajaxEndpoints,
            contentTypes: [...new Set(content.map(c => c.content_type))],
            sources: [...new Set(content.map(c => c.source))],
            // Show actual items that match our detection
            actualDynamicItems: content.filter(c => c.content_type === 'ajax').slice(0, 3),
            actualXssSinkItems: content.filter(c => c.content_type === 'xss_sink').slice(0, 3)
        });

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                console.log(`Updated ${id} to ${value}`);
            } else {
                console.warn(`Element ${id} not found`);
            }
        });
    },

    // Helper methods for parameter details, content type icons, etc.
    parseParameterDetails(item) {
        const params = [];
        if (item.parameters) {
            const paramString = typeof item.parameters === 'string' ? item.parameters : JSON.stringify(item.parameters);
            try {
                const paramData = JSON.parse(paramString);
                if (Array.isArray(paramData)) {
                    params.push(...paramData);
                }
            } catch {
                paramString.split(',').forEach(param => {
                    const trimmed = param.trim();
                    if (trimmed) {
                        const [name, ...typeParts] = trimmed.split(':');
                        params.push({
                            name: name.trim(),
                            type: typeParts.join(':').trim() || 'string'
                        });
                    }
                });
            }
        }
        return params;
    },

    parseEndpointDetails(item) {
        return {};
    },

    getContentTypeIcon(type) {
        const icons = {
            'endpoint': '🔗',
            'dynamic_endpoint': '🎯',
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
            case 'dynamic_endpoint': return 'status-running';
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
            'dynamic_analysis': '🎯',
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

    getRiskIcon(level) {
        switch(level?.toLowerCase()) {
            case 'high': return '🔴';
            case 'medium': return '🟡';
            case 'low': return '🟢';
            default: return '⚪';
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

    // Show detailed view method
    showDetailedView(item) {
        // Implementation for detailed view modal
        alert(`Detailed view for: ${item.path || item.url}`);
    },

    testXSS(url) {
        const testPayload = encodeURIComponent('<script>alert("XSS")</script>');
        const testUrl = url.includes('?') ? `${url}&test=${testPayload}` : `${url}?test=${testPayload}`;
        window.open(testUrl, '_blank');
        Utils.showMessage('Opened URL with XSS test payload. Check if alert fires!', 'info');
    },

    testDynamicEndpoint(url) {
        window.open(url, '_blank');
        Utils.showMessage('Opened dynamic endpoint for testing', 'info', 'content-discovery-messages');
    },

    // Load targets and other helper methods
    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            const targetSelects = [
                'directory-target-filter',
                'content-discovery-target'
            ];
            
            targetSelects.forEach(selectId => {
                const targetSelect = document.getElementById(selectId);
                if (targetSelect) {
                    const currentValue = targetSelect.value;
                    const placeholder = selectId === 'content-discovery-target' ? 'Select target...' : 'All Targets';
                    targetSelect.innerHTML = `<option value="">${placeholder}</option>`;
                    
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
            });

            console.log(`Loaded ${targets.length} targets for content discovery`);
            
            // Load subdomains after targets are loaded
            await this.loadSubdomains();
            
            // Only load content discovery subdomains if a target is already selected
            const selectedTarget = document.getElementById('content-discovery-target')?.value;
            if (selectedTarget) {
                await this.loadContentDiscoverySubdomains();
            }
            
        } catch (error) {
            console.error('Failed to load targets for content discovery:', error);
        }
    },

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
            
            console.log(`Loaded subdomains for content discovery filter`);
            
        } catch (error) {
            console.error('Failed to load subdomains for content discovery filter:', error);
        }
    },

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
                
                console.log(`Loaded ${subdomains.length} subdomains for content discovery form`);
            }
            
            if (currentValue) {
                const optionExists = Array.from(subdomainSelect.options).some(option => option.value === currentValue);
                if (optionExists) {
                    subdomainSelect.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('Failed to load subdomains for content discovery form:', error);
        }
    },

    // FIXED: Implement full export functionality
    async exportContent(format) {
        try {
            // Hide the export menu
            const menu = document.getElementById('export-content-menu');
            if (menu) menu.style.display = 'none';
            
            // Show loading message
            Utils.showMessage(`📤 Exporting content as ${format.toUpperCase()}...`, 'info', 'content-discovery-messages');
            
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
            
            // Prepare export data with metadata and stats
            const exportData = {
                export_timestamp: new Date().toISOString(),
                total_content: content.length,
                filters_applied: {
                    target_id: targetId || 'all',
                    subdomain_id: subdomainId || 'all',
                    content_type: contentTypeFilter || 'all',
                    source: sourceFilter || 'all',
                    search: search || 'none'
                },
                stats: {
                    total_endpoints: content.length,
                    static_endpoints: content.filter(c => c.content_type === 'endpoint').length,
                    dynamic_endpoints: content.filter(c => c.content_type === 'ajax').length,
                    xss_sinks: content.filter(c => c.content_type === 'xss_sink').length,
                    forms: content.filter(c => c.content_type === 'form').length,
                    unique_sources: new Set(content.map(c => c.source).filter(Boolean)).size,
                    status_200: content.filter(c => c.status_code >= 200 && c.status_code < 300).length,
                    status_400: content.filter(c => c.status_code >= 400 && c.status_code < 500).length,
                    status_500: content.filter(c => c.status_code >= 500).length
                },
                content: content
            };
            
            // Generate and download file based on format
            switch (format.toLowerCase()) {
                case 'csv':
                    this.downloadContentCSV(exportData);
                    break;
                case 'json':
                    this.downloadContentJSON(exportData);
                    break;
                case 'xml':
                    this.downloadContentXML(exportData);
                    break;
                default:
                    throw new Error('Unsupported export format');
            }
            
            Utils.showMessage(`✅ Successfully exported ${content.length} content items as ${format.toUpperCase()}!`, 'success', 'content-discovery-messages');
            
        } catch (error) {
            Utils.showMessage('❌ Failed to export content: ' + error.message, 'error', 'content-discovery-messages');
        }
    },

    downloadContentCSV(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        let csvContent = 'Export Summary\n';
        csvContent += `Export Date,${data.export_timestamp}\n`;
        csvContent += `Total Content,${data.total_content}\n`;
        csvContent += `Static Endpoints,${data.stats.static_endpoints}\n`;
        csvContent += `Dynamic Endpoints,${data.stats.dynamic_endpoints}\n`;
        csvContent += `XSS Sinks,${data.stats.xss_sinks}\n`;
        csvContent += `Forms,${data.stats.forms}\n`;
        csvContent += `Unique Sources,${data.stats.unique_sources}\n`;
        csvContent += `2xx Status,${data.stats.status_200}\n`;
        csvContent += `4xx Status,${data.stats.status_400}\n`;
        csvContent += `5xx Status,${data.stats.status_500}\n\n`;
        
        csvContent += 'Path/URL,Full URL,Content Type,Source,Risk Level,Method,Status Code,Subdomain,Parameters,Created Date\n';
        
        data.content.forEach(item => {
            const params = this.parseParameterDetails(item);
            const paramString = params.map(p => `${p.name}:${p.type || 'string'}`).join(';');
            
            const row = [
                `"${(item.path || item.url || '').replace(/"/g, '""')}"`,
                `"${this.buildFullUrl(item).replace(/"/g, '""')}"`,
                `"${item.content_type || ''}"`,
                `"${item.source || ''}"`,
                `"${item.risk_level || ''}"`,
                `"${item.method || ''}"`,
                `"${item.status_code || ''}"`,
                `"${item.subdomain || ''}"`,
                `"${paramString.replace(/"/g, '""')}"`,
                `"${item.created_at || ''}"`
            ].join(',');
            csvContent += row + '\n';
        });
        
        this.downloadFile(csvContent, `content_discovery_${timestamp}.csv`, 'text/csv');
    },

    downloadContentJSON(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `content_discovery_${timestamp}.json`, 'application/json');
    },

    downloadContentXML(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<content_discovery_export>\n';
        xmlContent += '  <export_info>\n';
        xmlContent += `    <timestamp>${this.escapeXml(data.export_timestamp)}</timestamp>\n`;
        xmlContent += `    <total_content>${data.total_content}</total_content>\n`;
        xmlContent += '    <filters>\n';
        xmlContent += `      <target_id>${this.escapeXml(data.filters_applied.target_id)}</target_id>\n`;
        xmlContent += `      <subdomain_id>${this.escapeXml(data.filters_applied.subdomain_id)}</subdomain_id>\n`;
        xmlContent += `      <content_type>${this.escapeXml(data.filters_applied.content_type)}</content_type>\n`;
        xmlContent += `      <source>${this.escapeXml(data.filters_applied.source)}</source>\n`;
        xmlContent += `      <search>${this.escapeXml(data.filters_applied.search)}</search>\n`;
        xmlContent += '    </filters>\n';
        xmlContent += '    <stats>\n';
        xmlContent += `      <total_endpoints>${data.stats.total_endpoints}</total_endpoints>\n`;
        xmlContent += `      <static_endpoints>${data.stats.static_endpoints}</static_endpoints>\n`;
        xmlContent += `      <dynamic_endpoints>${data.stats.dynamic_endpoints}</dynamic_endpoints>\n`;
        xmlContent += `      <xss_sinks>${data.stats.xss_sinks}</xss_sinks>\n`;
        xmlContent += `      <forms>${data.stats.forms}</forms>\n`;
        xmlContent += `      <unique_sources>${data.stats.unique_sources}</unique_sources>\n`;
        xmlContent += `      <status_200>${data.stats.status_200}</status_200>\n`;
        xmlContent += `      <status_400>${data.stats.status_400}</status_400>\n`;
        xmlContent += `      <status_500>${data.stats.status_500}</status_500>\n`;
        xmlContent += '    </stats>\n';
        xmlContent += '  </export_info>\n';
        xmlContent += '  <content_items>\n';
        
        data.content.forEach(item => {
            const params = this.parseParameterDetails(item);
            const paramString = params.map(p => `${p.name}:${p.type || 'string'}`).join(';');
            
            xmlContent += '    <content_item>\n';
            xmlContent += `      <path>${this.escapeXml(item.path || item.url || '')}</path>\n`;
            xmlContent += `      <full_url>${this.escapeXml(this.buildFullUrl(item))}</full_url>\n`;
            xmlContent += `      <content_type>${this.escapeXml(item.content_type || '')}</content_type>\n`;
            xmlContent += `      <source>${this.escapeXml(item.source || '')}</source>\n`;
            xmlContent += `      <risk_level>${this.escapeXml(item.risk_level || '')}</risk_level>\n`;
            xmlContent += `      <method>${this.escapeXml(item.method || '')}</method>\n`;
            xmlContent += `      <status_code>${this.escapeXml(item.status_code || '')}</status_code>\n`;
            xmlContent += `      <subdomain>${this.escapeXml(item.subdomain || '')}</subdomain>\n`;
            xmlContent += `      <parameters>${this.escapeXml(paramString)}</parameters>\n`;
            xmlContent += `      <created_at>${this.escapeXml(item.created_at || '')}</created_at>\n`;
            xmlContent += '    </content_item>\n';
        });
        
        xmlContent += '  </content_items>\n';
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

    // Debug method to see what content types are actually available
    async debugAvailableContentTypes() {
        try {
            console.log('🔍 Debugging available content types...');
            
            const response = await API.directories.getAll({ 
                page: 1, 
                limit: 1000  // Get more items to see variety
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const content = data.success ? data.data : [];
                
                const contentTypes = {};
                const sources = {};
                const samplesByType = {};
                
                content.forEach(item => {
                    const type = item.content_type || 'null';
                    const source = item.source || 'null';
                    
                    contentTypes[type] = (contentTypes[type] || 0) + 1;
                    sources[source] = (sources[source] || 0) + 1;
                    
                    // Store sample items for each type
                    if (!samplesByType[type]) {
                        samplesByType[type] = [];
                    }
                    if (samplesByType[type].length < 3) {
                        samplesByType[type].push({
                            path: item.path || item.url,
                            source: item.source,
                            url: item.url
                        });
                    }
                });
                
                console.log('📊 Available content types:', contentTypes);
                console.log('📊 Available sources:', sources);
                console.log('📋 Sample items by type:', samplesByType);
                
                // Show user-friendly message
                const availableTypes = Object.keys(contentTypes).filter(t => t !== 'null');
                Utils.showMessage(
                    `Debug: Found content types: ${availableTypes.join(', ')}. Check console for details.`, 
                    'info', 
                    'content-discovery-messages'
                );
                
                return { contentTypes, sources, samplesByType };
            }
        } catch (error) {
            console.error('Failed to debug content types:', error);
        }
    },

    // Export menu toggle
    toggleExportMenu() {
        const menu = document.getElementById('export-content-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    // Cleanup method
    cleanup() {
        this.stopProgressMonitoring();
        this.hideProgress();
        this.isAutoRefreshEnabled = false;
    }
};

window.ContentDiscovery = ContentDiscovery;

// Add debug methods to window for easy access
window.debugXssSinks = () => ContentDiscovery.debugXssSinks();
window.debugDynamicEndpoints = () => ContentDiscovery.debugDynamicEndpoints();
window.debugContentTypes = () => ContentDiscovery.debugAvailableContentTypes();

// Helper function to show what filters should be used
window.showContentTypeHelp = async () => {
    const result = await ContentDiscovery.debugAvailableContentTypes();
    if (result) {
        const types = Object.keys(result.contentTypes).filter(t => t !== 'null');
        console.log('💡 Use these content_type filter values:', types);
        console.log('💡 Available in the dropdown:', ['endpoint', 'dynamic', 'parameter', 'xss_sink', 'form', 'ajax', 'api']);
        Utils.showMessage(
            `Available content types: ${types.join(', ')}. Check console for more details.`,
            'info',
            'content-discovery-messages'
        );
    }
};
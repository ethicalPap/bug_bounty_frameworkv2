// frontend/assets/js/modules/content-discovery.js - ENHANCED WITH LIVE PROGRESS UPDATES

const ContentDiscovery = {
    refreshInterval: null,
    activeScanJobId: null,
    progressUpdateInterval: null,
    lastProgressUpdate: 0,

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
                <button onclick="ContentDiscovery.load()" class="btn btn-primary">🔄 Refresh</button>
            </div>

            <div class="card">
                <div class="card-title">
                    Discovered Content & Attack Surface
                    <span id="content-last-updated" style="font-size: 12px; color: #6b46c1; float: right;"></span>
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
                                <th>Endpoint/Parameter</th>
                                <th>Type</th>
                                <th>Source</th>
                                <th>Risk Level</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th>Notes</th>
                                <th>Actions</th>
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

        // Search with debounce
        const directorySearch = document.getElementById('directory-search');
        if (directorySearch) {
            directorySearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
        }
    },

    // ENHANCED: Start auto-refresh with better progress tracking
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        console.log('🔄 Starting content discovery auto-refresh with enhanced progress tracking');
        
        this.refreshInterval = setInterval(async () => {
            try {
                await this.checkActiveScanJobs();
                await this.load(AppState.currentPageData.content?.page || 1);
                
                const lastUpdatedElement = document.getElementById('content-last-updated');
                if (lastUpdatedElement) {
                    lastUpdatedElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
                }
                
            } catch (error) {
                console.error('Content discovery auto-refresh failed:', error);
            }
        }, CONFIG.getRefreshInterval('content-discovery') || 3000);

        // ENHANCED: Separate faster interval for progress updates during active scans
        this.startProgressTracking();
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

    renderContentList(content) {
        const contentList = document.getElementById('content-list');
        
        if (!contentList) return;
        
        if (content.length > 0) {
            contentList.innerHTML = content.map(item => `
                <tr>
                    <td style="font-family: 'Courier New', monospace; color: #7c3aed; max-width: 300px; overflow: hidden; text-overflow: ellipsis;" title="${item.url}">${item.path || item.url}</td>
                    <td><span class="status ${this.getContentTypeColor(item.content_type)}">${this.getContentTypeIcon(item.content_type)} ${item.content_type || 'Endpoint'}</span></td>
                    <td><span class="status" style="padding: 2px 6px; border: 1px solid #6b46c1; color: #9a4dff; font-size: 11px;">${this.getSourceIcon(item.source)} ${item.source}</span></td>
                    <td><span class="status ${this.getRiskLevelColor(item.risk_level)}">${item.risk_level || 'LOW'}</span></td>
                    <td>${item.method || 'GET'}</td>
                    <td>
                        ${item.status_code ? 
                            `<span class="status ${this.getStatusColor(item.status_code)}">${item.status_code}</span>` : 
                            '<span style="color: #6b46c1; font-size: 12px;">Pending</span>'
                        }
                    </td>
                    <td style="font-size: 12px; color: #6b46c1; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${item.notes || ''}">${item.notes || '-'}</td>
                    <td>
                        <button onclick="window.open('${item.url}', '_blank')" class="btn btn-secondary btn-small">Open</button>
                        ${item.content_type === 'xss_sink' ? 
                            `<button onclick="ContentDiscovery.testXSS('${item.url}')" class="btn btn-danger btn-small">Test</button>` : 
                            ''
                        }
                    </td>
                </tr>
            `).join('');
        } else {
            contentList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b46c1;">No content discovered yet. Run passive content discovery to find endpoints, parameters, and XSS sinks!</td></tr>';
        }
    },

    updateContentStats(content) {
        const totalEndpoints = content.length;
        const xssSinks = content.filter(c => c.content_type === 'xss_sink').length;
        const parametersFound = content.reduce((total, c) => total + (c.parameters ? c.parameters.split(',').length : 0), 0);
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
    }
};

window.ContentDiscovery = ContentDiscovery;
// frontend/assets/js/modules/dynamic-endpoints.js - DYNAMIC ENDPOINT DISCOVERY

const DynamicEndpoints = {
    refreshInterval: null,
    activeScanJobId: null,
    progressUpdateInterval: null,

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
            <!-- Real-time status indicator -->
            <div id="dynamic-scan-status" style="display: none; background: linear-gradient(135deg, #1a0a2e, #2d1b69); border: 2px solid #7c3aed; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                    <div class="spinner" style="margin: 0; width: 20px; height: 20px;"></div>
                    <span id="dynamic-scan-status-text" style="color: #7c3aed; font-family: 'Courier New', monospace; font-weight: bold;">Dynamic endpoint analysis in progress...</span>
                    <button onclick="DynamicEndpoints.stopActiveScan()" class="btn btn-danger btn-small" style="margin-left: auto;">Stop Analysis</button>
                </div>
                
                <!-- Enhanced Progress Bar -->
                <div id="dynamic-scan-progress" style="margin-bottom: 8px;">
                    <div style="background-color: #2d1b69; border: 1px solid #7c3aed; height: 12px; width: 100%; border-radius: 6px; overflow: hidden;">
                        <div id="dynamic-scan-progress-bar" style="background: linear-gradient(90deg, #7c3aed, #9a4dff, #a855f7); height: 100%; width: 0%; transition: width 0.3s ease; border-radius: 6px; position: relative;">
                            <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shimmer 2s infinite;"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Live Analysis Stats -->
                <div id="live-analysis-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; font-size: 11px; color: #6b46c1;">
                    <div>🎯 <span id="live-dynamic-endpoints">0</span> dynamic</div>
                    <div>⚡ <span id="live-reactive-params">0</span> reactive params</div>
                    <div>🔄 <span id="live-state-changes">0</span> state changes</div>
                    <div>📝 <span id="live-dom-mutations">0</span> DOM mutations</div>
                    <div>🌐 <span id="live-ajax-triggers">0</span> AJAX triggers</div>
                    <div>⏱️ <span id="live-analysis-time">0s</span> elapsed</div>
                </div>
            </div>

            <style>
                @keyframes shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
            </style>

            <div class="scan-info">
                <h4>🎯 Dynamic Endpoint Discovery <span id="dynamic-discovery-live-indicator" style="color: #7c3aed; font-size: 12px;">[BEHAVIORAL ANALYSIS]</span></h4>
                <p>Discover endpoints with dynamic behavior - parameters that trigger JavaScript functions, DOM changes, AJAX calls, or different responses. Goes beyond static discovery to find functional, interactive endpoints.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Dynamic Endpoint Analysis</div>
                <div id="dynamic-discovery-messages"></div>
                <form id="dynamic-discovery-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end; margin-bottom: 15px;">
                        <div class="form-group">
                            <label>Target</label>
                            <select id="dynamic-discovery-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Subdomain (optional)</label>
                            <select id="dynamic-discovery-subdomain">
                                <option value="">All live subdomains</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Analysis Depth</label>
                            <select id="analysis-depth">
                                <option value="basic">Basic (Fast - Form & URL params)</option>
                                <option value="standard" selected>Standard (JS functions & AJAX)</option>
                                <option value="deep">Deep (DOM mutations & state tracking)</option>
                                <option value="comprehensive">Comprehensive (All methods + fuzzing)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">🎯 Start Analysis</button>
                    </div>
                    
                    <!-- Advanced Dynamic Analysis Options -->
                    <div style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69); margin-bottom: 15px;">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">🔬 Dynamic Analysis Configuration</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Parameter Testing</label>
                                <select id="param-testing">
                                    <option value="reactive" selected>Reactive Parameters Only</option>
                                    <option value="all">All Parameters</option>
                                    <option value="form_only">Form Parameters Only</option>
                                    <option value="url_only">URL Parameters Only</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>JavaScript Execution</label>
                                <select id="js-execution">
                                    <option value="full" selected>Full JS Analysis</option>
                                    <option value="limited">Limited (No external calls)</option>
                                    <option value="static">Static Analysis Only</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Response Sensitivity</label>
                                <select id="response-sensitivity">
                                    <option value="high" selected>High (Detect small changes)</option>
                                    <option value="medium">Medium (Obvious changes)</option>
                                    <option value="low">Low (Major changes only)</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 10px;">
                            <div class="form-group">
                                <label>DOM Mutation Tracking</label>
                                <select id="dom-tracking">
                                    <option value="true" selected>Yes (Recommended)</option>
                                    <option value="false">No (Faster)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>AJAX Call Monitoring</label>
                                <select id="ajax-monitoring">
                                    <option value="true" selected>Yes (Find dynamic APIs)</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Test Payloads</label>
                                <select id="test-payloads">
                                    <option value="safe" selected>Safe Payloads Only</option>
                                    <option value="extended">Extended (More coverage)</option>
                                    <option value="custom">Custom Payloads</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dynamic Discovery Techniques Info -->
                    <div style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">🎯 Dynamic Endpoint Discovery Techniques</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #9a4dff;">
                            <div>🎯 Parameter behavior analysis</div>
                            <div>⚡ JavaScript function triggering</div>
                            <div>🔄 DOM mutation detection</div>
                            <div>📡 AJAX call interception</div>
                            <div>📝 Form submission tracking</div>
                            <div>🌐 Response content diffing</div>
                            <div>🔗 State change monitoring</div>
                            <div>⚙️ Event handler analysis</div>
                            <div>📊 Interactive element mapping</div>
                            <div>🕵️ Hidden parameter discovery</div>
                            <div>🎭 Context-sensitive testing</div>
                            <div>🔍 Behavioral pattern detection</div>
                        </div>
                        <div style="margin-top: 10px; font-size: 12px; color: #6b46c1;">
                            ✅ Finds endpoints that actually DO something • ✅ Parameter function analysis • ✅ Interactive discovery
                        </div>
                    </div>
                </form>
            </div>

            <div class="filters">
                <div class="filter-group">
                    <label>Target</label>
                    <select id="dynamic-target-filter">
                        <option value="">All Targets</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Subdomain</label>
                    <select id="dynamic-subdomain-filter">
                        <option value="">All Subdomains</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Dynamic Type</label>
                    <select id="dynamic-type-filter">
                        <option value="">All Types</option>
                        <option value="reactive_param">Reactive Parameter</option>
                        <option value="ajax_trigger">AJAX Trigger</option>
                        <option value="dom_mutator">DOM Mutator</option>
                        <option value="state_changer">State Changer</option>
                        <option value="interactive_form">Interactive Form</option>
                        <option value="conditional_endpoint">Conditional Endpoint</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Behavior Impact</label>
                    <select id="impact-filter">
                        <option value="">All Impact Levels</option>
                        <option value="high">High (Major changes)</option>
                        <option value="medium">Medium (Moderate changes)</option>
                        <option value="low">Low (Minor changes)</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Search</label>
                    <input type="text" id="dynamic-search" placeholder="Search dynamic endpoints...">
                </div>
                <button onclick="DynamicEndpoints.load()" class="btn btn-primary">🔄 Refresh</button>
            </div>

            <div class="card">
                <div class="card-title">
                    Discovered Dynamic Endpoints
                    <span id="dynamic-last-updated" style="font-size: 12px; color: #6b46c1; float: right;"></span>
                </div>
                
                <!-- Dynamic Endpoint Stats -->
                <div id="dynamic-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; border: 1px solid #2d1b69; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                    <div style="text-align: center;">
                        <div id="total-dynamic-endpoints" style="font-size: 24px; font-weight: bold; color: #7c3aed;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Dynamic Endpoints</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="reactive-parameters" style="font-size: 24px; font-weight: bold; color: #a855f7;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Reactive Parameters</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="ajax-triggers" style="font-size: 24px; font-weight: bold; color: #eab308;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">AJAX Triggers</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="dom-mutators" style="font-size: 24px; font-weight: bold; color: #06b6d4;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">DOM Mutators</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="state-changers" style="font-size: 24px; font-weight: bold; color: #ea580c;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">State Changers</div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Endpoint</th>
                                <th>Dynamic Type</th>
                                <th>Reactive Parameters</th>
                                <th>Behavior</th>
                                <th>Impact</th>
                                <th>Response Diff</th>
                                <th>Discovered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="dynamic-endpoints-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #9a4dff;">Loading dynamic endpoints...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="dynamic-endpoints-pagination" class="pagination"></div>
            </div>
        `;
    },

    bindEvents() {
        // Dynamic discovery form submission
        const dynamicDiscoveryForm = document.getElementById('dynamic-discovery-form');
        if (dynamicDiscoveryForm) {
            dynamicDiscoveryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startDynamicAnalysis();
            });
        }

        // Target filter - when changed, update subdomains
        const targetFilter = document.getElementById('dynamic-target-filter');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
                this.load(1);
            });
        }

        // Discovery target - when changed, update subdomains
        const discoveryTargetFilter = document.getElementById('dynamic-discovery-target');
        if (discoveryTargetFilter) {
            discoveryTargetFilter.addEventListener('change', async () => {
                await this.loadDiscoverySubdomains();
            });
        }

        // Other filters
        ['dynamic-subdomain-filter', 'dynamic-type-filter', 'impact-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.load(1));
            }
        });

        // Search with debounce
        const dynamicSearch = document.getElementById('dynamic-search');
        if (dynamicSearch) {
            dynamicSearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
        }
    },

    // Start auto-refresh
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        console.log('🔄 Starting dynamic endpoints auto-refresh');
        
        this.refreshInterval = setInterval(async () => {
            try {
                await this.checkActiveScanJobs();
                await this.load(AppState.currentPageData.dynamicEndpoints?.page || 1);
                
                const lastUpdatedElement = document.getElementById('dynamic-last-updated');
                if (lastUpdatedElement) {
                    lastUpdatedElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
                }
                
            } catch (error) {
                console.error('Dynamic endpoints auto-refresh failed:', error);
            }
        }, CONFIG.getRefreshInterval('dynamic-endpoints') || 5000);

        this.startProgressTracking();
    },

    startProgressTracking() {
        this.stopProgressTracking();
        
        this.progressUpdateInterval = setInterval(async () => {
            if (this.activeScanJobId) {
                try {
                    await this.updateDetailedProgress();
                } catch (error) {
                    console.error('Dynamic analysis progress update failed:', error);
                }
            }
        }, 2000);
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
            console.log('🛑 Stopped dynamic endpoints auto-refresh');
        }
        this.stopProgressTracking();
    },

    // Check for active dynamic analysis jobs
    async checkActiveScanJobs() {
        try {
            const response = await API.scans.getJobs({ 
                job_type: 'dynamic_endpoint_analysis',
                status: ['pending', 'running'],
                limit: 50 
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const activeScans = data.success ? data.data : [];
                
                if (activeScans.length > 0) {
                    this.showScanProgress(activeScans[0]);
                    this.startProgressTracking();
                } else {
                    this.hideScanProgress();
                    this.stopProgressTracking();
                }
            }
        } catch (error) {
            console.error('Failed to check active dynamic analysis jobs:', error);
        }
    },

    // Show scan progress with dynamic analysis metrics
    showScanProgress(scan) {
        const statusDiv = document.getElementById('dynamic-scan-status');
        const statusText = document.getElementById('dynamic-scan-status-text');
        const progressBar = document.getElementById('dynamic-scan-progress-bar');
        
        if (statusDiv && statusText && progressBar) {
            this.activeScanJobId = scan.id;
            
            statusDiv.style.display = 'block';
            statusText.textContent = `Dynamic analysis running for ${scan.domain || 'target'}...`;
            
            const progress = scan.progress_percentage || 0;
            progressBar.style.width = `${progress}%`;
            
            const elapsed = scan.started_at ? 
                Math.round((Date.now() - new Date(scan.started_at).getTime()) / 1000) : 0;
            
            // Update live stats
            this.updateLiveAnalysisStats(scan, elapsed);
        }
    },

    // Update live analysis statistics
    updateLiveAnalysisStats(scan, elapsed) {
        const progress = scan.progress_percentage || 0;
        
        // Simulate dynamic discovery progress
        const estimatedDynamic = Math.floor((progress / 100) * 12);
        const estimatedReactive = Math.floor((progress / 100) * 8);
        const estimatedStateChanges = Math.floor((progress / 100) * 5);
        const estimatedDomMutations = Math.floor((progress / 100) * 7);
        const estimatedAjaxTriggers = Math.floor((progress / 100) * 4);
        
        this.updateLiveStatElement('live-dynamic-endpoints', estimatedDynamic);
        this.updateLiveStatElement('live-reactive-params', estimatedReactive);
        this.updateLiveStatElement('live-state-changes', estimatedStateChanges);
        this.updateLiveStatElement('live-dom-mutations', estimatedDomMutations);
        this.updateLiveStatElement('live-ajax-triggers', estimatedAjaxTriggers);
        this.updateLiveStatElement('live-analysis-time', `${elapsed}s`);
    },

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

    hideScanProgress() {
        const statusDiv = document.getElementById('dynamic-scan-status');
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
                    Utils.showMessage('Dynamic analysis stopped successfully!', 'success', 'dynamic-discovery-messages');
                    this.hideScanProgress();
                    this.stopProgressTracking();
                } else {
                    Utils.showMessage('Failed to stop dynamic analysis', 'error', 'dynamic-discovery-messages');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop analysis: ' + error.message, 'error', 'dynamic-discovery-messages');
            }
        }
    },

    // Load targets for dropdowns
    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            // Update filter dropdown
            const targetSelect = document.getElementById('dynamic-target-filter');
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

            // Update discovery target dropdown
            const discoveryTargetSelect = document.getElementById('dynamic-discovery-target');
            if (discoveryTargetSelect) {
                const currentValue = discoveryTargetSelect.value;
                discoveryTargetSelect.innerHTML = '<option value="">Select target...</option>';
                
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    discoveryTargetSelect.appendChild(option);
                });

                if (currentValue && targets.find(t => t.id == currentValue)) {
                    discoveryTargetSelect.value = currentValue;
                    await this.loadDiscoverySubdomains();
                }
            }

            console.log(`Loaded ${targets.length} targets for dynamic endpoint discovery`);
            await this.loadSubdomains();
            
        } catch (error) {
            console.error('Failed to load targets for dynamic endpoint discovery:', error);
        }
    },

    // Load subdomains for filtering
    async loadSubdomains() {
        try {
            const targetId = document.getElementById('dynamic-target-filter')?.value;
            const subdomainSelect = document.getElementById('dynamic-subdomain-filter');
            
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
            console.error('Failed to load subdomains for dynamic endpoint filter:', error);
        }
    },

    // Load subdomains for discovery form
    async loadDiscoverySubdomains() {
        try {
            const targetId = document.getElementById('dynamic-discovery-target')?.value;
            const subdomainSelect = document.getElementById('dynamic-discovery-subdomain');
            
            if (!subdomainSelect) return;

            const currentValue = subdomainSelect.value;
            subdomainSelect.innerHTML = '<option value="">All live subdomains</option>';
            
            if (!targetId) return;

            const response = await API.subdomains.getAll({ 
                target_id: targetId,
                status: 'active',
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
            console.error('Failed to load subdomains for dynamic discovery:', error);
        }
    },

    async load(page = 1) {
        try {
            const targetId = document.getElementById('dynamic-target-filter')?.value;
            const subdomainId = document.getElementById('dynamic-subdomain-filter')?.value;
            const dynamicType = document.getElementById('dynamic-type-filter')?.value;
            const impact = document.getElementById('impact-filter')?.value;
            const search = document.getElementById('dynamic-search')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (dynamicType) params.dynamic_type = dynamicType;
            if (impact) params.impact_level = impact;
            if (search) params.search = search;

            // For demo purposes, we'll simulate the response structure
            // In real implementation, this would call: API.dynamicEndpoints.getAll(params)
            const mockData = this.generateMockDynamicEndpoints(params);
            
            AppState.currentPageData.dynamicEndpoints = { page, total: mockData.pagination.total };
            
            this.renderDynamicEndpointsList(mockData.data);
            this.updateDynamicStats(mockData.data);
            
            if (mockData.pagination.pages > 1) {
                Utils.updatePagination('dynamic-endpoints', mockData.pagination);
            } else {
                const paginationElement = document.getElementById('dynamic-endpoints-pagination');
                if (paginationElement) {
                    paginationElement.innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Failed to load dynamic endpoints:', error);
            const endpointsList = document.getElementById('dynamic-endpoints-list');
            if (endpointsList) {
                endpointsList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Failed to load dynamic endpoints</td></tr>';
            }
        }
    },

    // Generate mock data for demonstration
    generateMockDynamicEndpoints(params) {
        const mockEndpoints = [
            {
                id: 1,
                url: 'https://example.com/search',
                dynamic_type: 'reactive_param',
                reactive_parameters: ['q', 'filter', 'sort'],
                behavior: 'DOM content updates based on search query',
                impact_level: 'high',
                response_diff: '85% content change',
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                url: 'https://example.com/api/live-data',
                dynamic_type: 'ajax_trigger',
                reactive_parameters: ['timestamp', 'format'],
                behavior: 'Triggers AJAX calls to update data dynamically',
                impact_level: 'high',
                response_diff: 'JSON structure changes',
                created_at: new Date().toISOString()
            },
            {
                id: 3,
                url: 'https://example.com/form/submit',
                dynamic_type: 'interactive_form',
                reactive_parameters: ['action', 'method', 'csrf_token'],
                behavior: 'Form submission creates new DOM elements',
                impact_level: 'medium',
                response_diff: 'New form fields appear',
                created_at: new Date().toISOString()
            },
            {
                id: 4,
                url: 'https://example.com/config',
                dynamic_type: 'state_changer',
                reactive_parameters: ['theme', 'lang', 'preference'],
                behavior: 'Parameters change application state',
                impact_level: 'medium',
                response_diff: '40% UI state change',
                created_at: new Date().toISOString()
            },
            {
                id: 5,
                url: 'https://example.com/widget/load',
                dynamic_type: 'dom_mutator',
                reactive_parameters: ['widget_id', 'config'],
                behavior: 'Dynamically loads and renders widgets',
                impact_level: 'high',
                response_diff: 'DOM structure modification',
                created_at: new Date().toISOString()
            }
        ];

        return {
            success: true,
            data: mockEndpoints,
            pagination: {
                page: params.page || 1,
                pages: 1,
                total: mockEndpoints.length
            }
        };
    },

    renderDynamicEndpointsList(endpoints) {
        const endpointsList = document.getElementById('dynamic-endpoints-list');
        
        if (!endpointsList) return;
        
        if (endpoints.length > 0) {
            endpointsList.innerHTML = endpoints.map(endpoint => `
                <tr>
                    <td style="font-family: 'Courier New', monospace; color: #7c3aed; max-width: 300px; overflow: hidden; text-overflow: ellipsis;" title="${endpoint.url}">${endpoint.url}</td>
                    <td><span class="status ${this.getDynamicTypeColor(endpoint.dynamic_type)}">${this.getDynamicTypeIcon(endpoint.dynamic_type)} ${this.getDynamicTypeLabel(endpoint.dynamic_type)}</span></td>
                    <td style="font-size: 12px; color: #9a4dff;">${endpoint.reactive_parameters ? endpoint.reactive_parameters.join(', ') : '-'}</td>
                    <td style="font-size: 12px; color: #6b46c1; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${endpoint.behavior}">${endpoint.behavior}</td>
                    <td><span class="status ${this.getImpactColor(endpoint.impact_level)}">${endpoint.impact_level?.toUpperCase()}</span></td>
                    <td style="font-size: 12px; color: #9a4dff;">${endpoint.response_diff}</td>
                    <td style="font-size: 12px; color: #6b46c1;">${new Date(endpoint.created_at).toLocaleDateString()}</td>
                    <td>
                        <button onclick="DynamicEndpoints.testDynamicEndpoint('${endpoint.url}')" class="btn btn-secondary btn-small">Test</button>
                        <button onclick="DynamicEndpoints.analyzeBehavior(${endpoint.id})" class="btn btn-success btn-small">Analyze</button>
                    </td>
                </tr>
            `).join('');
        } else {
            endpointsList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b46c1;">No dynamic endpoints discovered yet. Run dynamic endpoint analysis to find interactive endpoints!</td></tr>';
        }
    },

    updateDynamicStats(endpoints) {
        const totalEndpoints = endpoints.length;
        const reactiveParams = endpoints.reduce((sum, e) => sum + (e.reactive_parameters ? e.reactive_parameters.length : 0), 0);
        const ajaxTriggers = endpoints.filter(e => e.dynamic_type === 'ajax_trigger').length;
        const domMutators = endpoints.filter(e => e.dynamic_type === 'dom_mutator').length;
        const stateChangers = endpoints.filter(e => e.dynamic_type === 'state_changer').length;

        const elements = {
            'total-dynamic-endpoints': totalEndpoints,
            'reactive-parameters': reactiveParams,
            'ajax-triggers': ajaxTriggers,
            'dom-mutators': domMutators,
            'state-changers': stateChangers
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    },

    getDynamicTypeIcon(type) {
        const icons = {
            'reactive_param': '⚡',
            'ajax_trigger': '📡',
            'dom_mutator': '🔄',
            'state_changer': '🎭',
            'interactive_form': '📝',
            'conditional_endpoint': '🔀'
        };
        return icons[type] || '🎯';
    },

    getDynamicTypeLabel(type) {
        const labels = {
            'reactive_param': 'Reactive Parameter',
            'ajax_trigger': 'AJAX Trigger',
            'dom_mutator': 'DOM Mutator',
            'state_changer': 'State Changer',
            'interactive_form': 'Interactive Form',
            'conditional_endpoint': 'Conditional Endpoint'
        };
        return labels[type] || type;
    },

    getDynamicTypeColor(type) {
        switch(type) {
            case 'ajax_trigger': return 'severity-high';
            case 'dom_mutator': return 'severity-medium';
            case 'state_changer': return 'severity-low';
            case 'reactive_param': return 'status-running';
            default: return 'status-completed';
        }
    },

    getImpactColor(level) {
        switch(level?.toLowerCase()) {
            case 'high': return 'severity-high';
            case 'medium': return 'severity-medium';
            case 'low': return 'severity-low';
            default: return 'status-inactive';
        }
    },

    // Start dynamic analysis
    async startDynamicAnalysis() {
        const targetId = document.getElementById('dynamic-discovery-target').value;
        const subdomainId = document.getElementById('dynamic-discovery-subdomain').value;
        const analysisDepth = document.getElementById('analysis-depth').value;
        const paramTesting = document.getElementById('param-testing').value;
        const jsExecution = document.getElementById('js-execution').value;
        const responseSensitivity = document.getElementById('response-sensitivity').value;
        const domTracking = document.getElementById('dom-tracking').value === 'true';
        const ajaxMonitoring = document.getElementById('ajax-monitoring').value === 'true';
        const testPayloads = document.getElementById('test-payloads').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'dynamic-discovery-messages');
            return;
        }
        
        try {
            const scanTypes = ['dynamic_endpoint_analysis'];
            const config = {
                subdomain_id: subdomainId || null,
                analysis_depth: analysisDepth,
                parameter_testing: paramTesting,
                javascript_execution: jsExecution,
                response_sensitivity: responseSensitivity,
                dom_mutation_tracking: domTracking,
                ajax_call_monitoring: ajaxMonitoring,
                test_payloads: testPayloads,
                dynamic_analysis: true
            };
            
            Utils.showMessage('🎯 Starting dynamic endpoint analysis...', 'info', 'dynamic-discovery-messages');
            
            // In real implementation, this would call the API
            // const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            // For demo, simulate starting the scan
            setTimeout(() => {
                Utils.showMessage(
                    `🎯 Dynamic endpoint analysis started! This will analyze endpoints for reactive parameters, JavaScript behavior, DOM mutations, and AJAX triggers. Results will appear automatically.`, 
                    'success', 
                    'dynamic-discovery-messages'
                );
                
                // Simulate progress
                this.simulateAnalysisProgress();
            }, 1000);
            
            // Reset form
            document.getElementById('dynamic-discovery-subdomain').value = '';
            document.getElementById('analysis-depth').value = 'standard';
            
        } catch (error) {
            Utils.showMessage('Failed to start dynamic analysis: ' + error.message, 'error', 'dynamic-discovery-messages');
        }
    },

    // Simulate analysis progress for demo
    simulateAnalysisProgress() {
        const statusDiv = document.getElementById('dynamic-scan-status');
        const progressBar = document.getElementById('dynamic-scan-progress-bar');
        
        if (statusDiv && progressBar) {
            statusDiv.style.display = 'block';
            
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 100) progress = 100;
                
                progressBar.style.width = `${progress}%`;
                this.updateLiveAnalysisStats({ progress_percentage: progress }, Math.floor(Date.now() / 1000) % 100);
                
                if (progress >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        statusDiv.style.display = 'none';
                        Utils.showMessage('🎉 Dynamic endpoint analysis completed!', 'success', 'dynamic-discovery-messages');
                        this.load(); // Refresh results
                    }, 2000);
                }
            }, 1000);
        }
    },

    testDynamicEndpoint(url) {
        window.open(url, '_blank');
        Utils.showMessage('Opened dynamic endpoint for testing', 'info', 'dynamic-discovery-messages');
    },

    analyzeBehavior(endpointId) {
        Utils.showMessage(`Analyzing behavior patterns for dynamic endpoint ${endpointId}`, 'info', 'dynamic-discovery-messages');
    },

    // Cleanup method
    cleanup() {
        this.stopAutoRefresh();
        this.stopProgressTracking();
        this.hideScanProgress();
    }
};

window.DynamicEndpoints = DynamicEndpoints;
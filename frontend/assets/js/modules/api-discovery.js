// frontend/assets/js/modules/api-discovery.js - Advanced API Discovery Frontend

const APIDiscovery = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
    targetsCache: {},
    subdomainsCache: {},

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.loadAPIScans();
        this.startRealTimeUpdates();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .api-type-card {
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border: 1px solid #00ff9f;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 0;
                }
                
                .api-endpoint {
                    background: rgba(0, 255, 159, 0.1);
                    border: 1px solid #00ff9f;
                    border-radius: 6px;
                    padding: 10px;
                    margin: 8px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                }
                
                .vulnerability-tag {
                    display: inline-block;
                    padding: 2px 6px;
                    margin: 2px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                }
                
                .vuln-critical { background: rgba(255, 0, 0, 0.2); color: #ff4444; }
                .vuln-high { background: rgba(255, 165, 0, 0.2); color: #ffa500; }
                .vuln-medium { background: rgba(255, 255, 0, 0.2); color: #ffff00; }
                .vuln-low { background: rgba(0, 255, 0, 0.2); color: #00ff00; }
                
                .api-method-tag {
                    display: inline-block;
                    padding: 2px 6px;
                    margin: 2px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                    font-family: 'Courier New', monospace;
                }
                
                .method-get { background: rgba(0, 255, 0, 0.2); color: #00ff00; }
                .method-post { background: rgba(255, 165, 0, 0.2); color: #ffa500; }
                .method-put { background: rgba(0, 191, 255, 0.2); color: #00bfff; }
                .method-delete { background: rgba(255, 0, 0, 0.2); color: #ff4444; }
                .method-patch { background: rgba(128, 0, 128, 0.2); color: #9a4dff; }
                
                .api-discovery-mode {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #00ff9f;
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin: 10px 0;
                }
                
                .api-discovery-mode:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 255, 159, 0.3);
                }
                
                .api-discovery-mode.selected {
                    border-color: #ffff00;
                    background: rgba(255, 255, 0, 0.1);
                }
                
                .collapsible-api {
                    cursor: pointer;
                    user-select: none;
                }
                
                .collapsible-api:hover {
                    color: #00ff9f;
                }
                
                .collapsible-api-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }
                
                .collapsible-api-content.expanded {
                    max-height: 2000px;
                }
                
                .documentation-link {
                    color: #00ff9f;
                    text-decoration: none;
                    font-size: 11px;
                }
                
                .documentation-link:hover {
                    color: #ffff00;
                }
            </style>

            <div class="scan-info">
                <h4>🔗 Advanced API Discovery</h4>
                <p>Discover REST APIs, GraphQL endpoints, SOAP services, and API documentation. Includes vulnerability testing for discovered APIs, authentication analysis, and business logic testing.</p>
            </div>

            <!-- API Discovery Controls -->
            <div class="card">
                <div class="card-title">Start API Discovery & Testing</div>
                <div id="api-discovery-messages"></div>
                
                <form id="api-discovery-form">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div class="api-discovery-mode selected" data-type="comprehensive" onclick="APIDiscovery.selectDiscoveryMode('comprehensive')">
                            <h4 style="color: #00ff9f; margin-bottom: 10px;">🎯 Comprehensive Discovery</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Complete API discovery and security testing</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• REST, GraphQL, SOAP discovery</div>
                                <div>• API documentation hunting</div>
                                <div>• Parameter fuzzing</div>
                                <div>• Authentication testing</div>
                                <div>• Vulnerability scanning</div>
                                <div>• Business logic testing</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 15-30 minutes</div>
                        </div>
                        
                        <div class="api-discovery-mode" data-type="discovery_only" onclick="APIDiscovery.selectDiscoveryMode('discovery_only')">
                            <h4 style="color: #00bfff; margin-bottom: 10px;">🔍 Discovery Only</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Fast API endpoint discovery</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• REST API detection</div>
                                <div>• GraphQL endpoint discovery</div>
                                <div>• API documentation search</div>
                                <div>• Basic parameter discovery</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 5-10 minutes</div>
                        </div>
                        
                        <div class="api-discovery-mode" data-type="security_focused" onclick="APIDiscovery.selectDiscoveryMode('security_focused')">
                            <h4 style="color: #ff6b6b; margin-bottom: 10px;">🛡️ Security Testing</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Focus on API vulnerability testing</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Authentication bypass testing</div>
                                <div>• IDOR vulnerability scanning</div>
                                <div>• Injection testing (SQL, NoSQL)</div>
                                <div>• Rate limiting analysis</div>
                                <div>• XXE and SSRF testing</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 10-20 minutes</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 20px; align-items: end; margin-top: 20px;">
                        <div class="form-group">
                            <label for="api-discovery-target">Target Domain</label>
                            <select id="api-discovery-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="api-discovery-subdomain">Subdomain Scope</label>
                            <select id="api-discovery-subdomain">
                                <option value="">All subdomains</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-api-discovery-btn">🔗 Start API Discovery</button>
                    </div>
                    
                    <!-- Advanced Options -->
                    <div style="border: 1px solid #00ff9f; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69); margin-top: 15px;">
                        <h5 style="color: #00ff9f; margin-bottom: 10px;">Advanced Options</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>API Testing Depth</label>
                                <select id="api-testing-depth">
                                    <option value="basic">Basic (Headers only)</option>
                                    <option value="standard" selected>Standard (Headers + Content)</option>
                                    <option value="deep">Deep (Full analysis)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Include Documentation</label>
                                <select id="include-documentation">
                                    <option value="true" selected>Yes (Swagger, OpenAPI)</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Parameter Fuzzing</label>
                                <select id="parameter-fuzzing">
                                    <option value="basic">Basic fuzzing</option>
                                    <option value="comprehensive" selected>Comprehensive</option>
                                    <option value="security_only">Security-focused</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Active API Discovery Scans -->
            <div class="card">
                <div class="card-title">
                    API Discovery Scans
                    <span id="api-auto-refresh-indicator" style="float: right; font-size: 12px; color: #00ff9f;">🔄 Auto-updating</span>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="APIDiscovery.loadAPIScans()" class="btn btn-secondary">🔄 Refresh</button>
                    <button onclick="APIDiscovery.toggleAutoRefresh()" class="btn btn-secondary" id="api-auto-refresh-toggle">⏸️ Pause Auto-refresh</button>
                    <span id="api-scan-status" style="color: #00ff9f; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="api-last-update" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <div id="api-scans-list">
                    <p style="text-align: center; color: #00ff9f; padding: 20px;">Loading API discovery scans...</p>
                </div>
            </div>

            <!-- API Dashboard -->
            <div class="card" id="api-dashboard" style="display: none;">
                <div class="card-title">🔗 API Discovery Results</div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; border: 1px solid #00ff9f; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #00ff9f;" id="total-rest-apis">0</div>
                        <div style="color: #00ff9f; font-size: 11px;">REST APIs</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #00ff9f; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #9a4dff;" id="total-graphql-apis">0</div>
                        <div style="color: #00ff9f; font-size: 11px;">GraphQL APIs</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #00ff9f; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #00bfff;" id="total-soap-apis">0</div>
                        <div style="color: #00ff9f; font-size: 11px;">SOAP APIs</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #00ff9f; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ffa500;" id="total-documentations">0</div>
                        <div style="color: #00ff9f; font-size: 11px;">Documentation</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #00ff9f; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ff4444;" id="total-api-vulns">0</div>
                        <div style="color: #00ff9f; font-size: 11px;">Vulnerabilities</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #00ff9f; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ffff00;" id="total-auth-issues">0</div>
                        <div style="color: #00ff9f; font-size: 11px;">Auth Issues</div>
                    </div>
                </div>
                
                <div id="api-results-content">
                    <!-- API results content will be rendered here -->
                </div>
            </div>
        `;
    },

    bindEvents() {
        // API discovery form submission
        const apiForm = document.getElementById('api-discovery-form');
        if (apiForm) {
            apiForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startAPIDiscovery();
            });
        }

        // Target selection change to load subdomains
        const targetSelect = document.getElementById('api-discovery-target');
        if (targetSelect) {
            targetSelect.addEventListener('change', async (e) => {
                await this.loadSubdomains(e.target.value);
            });
        }

        // Collapsible sections
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('collapsible-api')) {
                const content = e.target.nextElementSibling;
                if (content && content.classList.contains('collapsible-api-content')) {
                    content.classList.toggle('expanded');
                    e.target.textContent = content.classList.contains('expanded') ? 
                        e.target.textContent.replace('▶', '▼') : 
                        e.target.textContent.replace('▼', '▶');
                }
            }
        });
    },

    selectDiscoveryMode(mode) {
        // Update selected discovery mode
        document.querySelectorAll('.api-discovery-mode').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${mode}"]`).classList.add('selected');
        this.selectedDiscoveryMode = mode;
    },

    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            this.targetsCache = {};
            targets.forEach(target => {
                this.targetsCache[target.id] = target;
            });
            
            const targetSelect = document.getElementById('api-discovery-target');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">Select target...</option>';
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    targetSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load targets:', error);
        }
    },

    async loadSubdomains(targetId) {
        const subdomainSelect = document.getElementById('api-discovery-subdomain');
        if (!subdomainSelect) return;

        subdomainSelect.innerHTML = '<option value="">All subdomains</option>';
        
        if (!targetId) return;

        try {
            if (this.subdomainsCache[targetId]) {
                this.populateSubdomainSelect(this.subdomainsCache[targetId]);
                return;
            }

            const response = await API.subdomains.getAll({ target_id: targetId, limit: 1000 });
            if (!response) return;
            
            const data = await response.json();
            const subdomains = data.success ? data.data : [];
            
            this.subdomainsCache[targetId] = subdomains;
            this.populateSubdomainSelect(subdomains);
            
        } catch (error) {
            console.error('Failed to load subdomains:', error);
        }
    },

    populateSubdomainSelect(subdomains) {
        const subdomainSelect = document.getElementById('api-discovery-subdomain');
        if (!subdomainSelect) return;

        subdomains.forEach(subdomain => {
            const option = document.createElement('option');
            option.value = subdomain.id;
            option.textContent = subdomain.subdomain;
            
            if (subdomain.status === 'active') {
                option.textContent += ' ✅';
            }
            
            subdomainSelect.appendChild(option);
        });
    },

    async startAPIDiscovery() {
        const targetId = document.getElementById('api-discovery-target').value;
        const subdomainId = document.getElementById('api-discovery-subdomain').value;
        const discoveryMode = this.selectedDiscoveryMode || 'comprehensive';
        const testingDepth = document.getElementById('api-testing-depth').value;
        const includeDocumentation = document.getElementById('include-documentation').value === 'true';
        const parameterFuzzing = document.getElementById('parameter-fuzzing').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'api-discovery-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-api-discovery-btn', true);
            
            const config = {
                discovery_mode: discoveryMode,
                subdomain_id: subdomainId || null,
                testing_depth: testingDepth,
                include_documentation: includeDocumentation,
                parameter_fuzzing: parameterFuzzing,
                vulnerability_testing: discoveryMode !== 'discovery_only',
                authentication_testing: discoveryMode === 'comprehensive' || discoveryMode === 'security_focused',
                business_logic_testing: discoveryMode === 'comprehensive'
            };
            
            const response = await API.call('/api-discovery/start', {
                method: 'POST',
                body: JSON.stringify({
                    targetId: parseInt(targetId),
                    config: config
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    const scopeText = subdomainId ? 'single subdomain' : 'all subdomains';
                    Utils.showMessage(`${discoveryMode.charAt(0).toUpperCase() + discoveryMode.slice(1)} API discovery started for ${scopeText}!`, 'success', 'api-discovery-messages');
                    
                    // Reset form
                    document.getElementById('api-discovery-target').value = '';
                    document.getElementById('api-discovery-subdomain').innerHTML = '<option value="">All subdomains</option>';
                    
                    // Refresh scans
                    await this.loadAPIScans();
                    this.startRealTimeUpdates();
                } else {
                    throw new Error(data.message || 'Unknown error');
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start API discovery');
            }
        } catch (error) {
            Utils.showMessage('Failed to start API discovery: ' + error.message, 'error', 'api-discovery-messages');
        } finally {
            Utils.setButtonLoading('start-api-discovery-btn', false);
        }
    },

    async loadAPIScans() {
        try {
            const response = await API.call('/api-discovery/scans');
            
            if (response && response.ok) {
                const data = await response.json();
                const scans = data.success ? data.data : [];
                
                this.renderAPIScans(scans);
                this.updateAPIScanStatus(scans);
                
                // Show latest completed API results
                const latestCompleted = scans.find(scan => scan.status === 'completed');
                if (latestCompleted) {
                    await this.loadLatestAPIResults(latestCompleted);
                }
            }
        } catch (error) {
            console.error('Failed to load API scans:', error);
            document.getElementById('api-scans-list').innerHTML = 
                '<p style="text-align: center; color: #ff0000; padding: 20px;">Failed to load API discovery scans</p>';
        }
    },

    renderAPIScans(scans) {
        const container = document.getElementById('api-scans-list');
        
        if (scans.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #00ff9f; padding: 20px;">No API discovery scans yet. Start your first scan above!</p>';
            return;
        }
        
        container.innerHTML = scans.map(scan => {
            const target = this.targetsCache[scan.target_id];
            const targetName = target ? target.domain : `Target ${scan.target_id}`;
            const isRunning = scan.status === 'running' || scan.status === 'pending';
            
            return `
                <div class="api-type-card ${isRunning ? 'running' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <h4 style="color: #00ff9f; margin-bottom: 5px;">🔗 ${targetName}</h4>
                            <div style="font-size: 12px; color: #9a4dff;">
                                Scan ID: ${scan.id} | Mode: ${scan.discovery_mode || 'comprehensive'}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                Started: ${new Date(scan.started_at || scan.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="status status-${scan.status}">${scan.status.toUpperCase()}</span>
                            <div style="margin-top: 5px;">
                                ${scan.status === 'completed' ? 
                                    `<button onclick="APIDiscovery.viewAPIResults(${scan.id})" class="btn btn-primary btn-small">🔗 View APIs</button>` :
                                    scan.status === 'running' ?
                                    `<button onclick="APIDiscovery.stopScan(${scan.id})" class="btn btn-danger btn-small">⏹️ Stop</button>` :
                                    ''
                                }
                            </div>
                        </div>
                    </div>
                    
                    ${this.renderScanProgress(scan)}
                    
                    ${scan.status === 'completed' && scan.results ? 
                        this.renderAPIScanSummary(scan.results) : ''
                    }
                </div>
            `;
        }).join('');
    },

    renderScanProgress(scan) {
        const progress = scan.progress_percentage || 0;
        
        if (scan.status !== 'running' && scan.status !== 'pending') {
            return '';
        }
        
        return `
            <div style="margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span style="font-size: 12px; color: #00ff9f;">Progress: ${progress}%</span>
                    <span style="font-size: 11px; color: #666;">${scan.current_phase || 'Discovering APIs...'}</span>
                </div>
                
                <div style="background-color: #2d1b69; height: 6px; border-radius: 3px;">
                    <div style="background: linear-gradient(90deg, #00ff9f, #ffff00); height: 100%; width: ${progress}%; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    },

    renderAPIScanSummary(results) {
        const summary = typeof results === 'string' ? JSON.parse(results) : results;
        
        const apiCounts = {
            rest: summary.discovered_apis?.rest_apis?.length || 0,
            graphql: summary.discovered_apis?.graphql_apis?.length || 0,
            soap: summary.discovered_apis?.soap_apis?.length || 0,
            mobile: summary.discovered_apis?.mobile_apis?.length || 0,
            admin: summary.discovered_apis?.admin_apis?.length || 0
        };
        
        const vulnCount = summary.api_vulnerabilities?.length || 0;
        const docCount = summary.documentation_found?.length || 0;
        
        return `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #00ff9f;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                    ${apiCounts.rest > 0 ? `<span class="api-method-tag method-get">${apiCounts.rest} REST</span>` : ''}
                    ${apiCounts.graphql > 0 ? `<span class="api-method-tag method-post">${apiCounts.graphql} GraphQL</span>` : ''}
                    ${apiCounts.soap > 0 ? `<span class="api-method-tag method-put">${apiCounts.soap} SOAP</span>` : ''}
                    ${apiCounts.mobile > 0 ? `<span class="api-method-tag method-patch">${apiCounts.mobile} Mobile</span>` : ''}
                    ${apiCounts.admin > 0 ? `<span class="api-method-tag method-delete">${apiCounts.admin} Admin</span>` : ''}
                    ${docCount > 0 ? `<span style="background: rgba(255, 255, 0, 0.2); color: #ffff00; padding: 2px 6px; margin: 2px; border-radius: 4px; font-size: 10px; font-weight: bold;">${docCount} Docs</span>` : ''}
                </div>
                
                ${vulnCount > 0 ? 
                    `<div style="background: rgba(255, 0, 0, 0.2); color: #ff4444; padding: 8px; border-radius: 4px; animation: alertPulse 2s infinite;">
                        ⚠️ ${vulnCount} API vulnerabilities found!
                    </div>` : 
                    `<div style="color: #00ff9f; font-size: 12px;">✅ No critical API vulnerabilities detected</div>`
                }
            </div>
        `;
    },

    async viewAPIResults(scanId) {
        try {
            const response = await API.call(`/api-discovery/results/${scanId}`);
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.displayAPIResultsDashboard(data.data);
                }
            }
        } catch (error) {
            console.error('Failed to load API results:', error);
            Utils.showMessage('Failed to load API results data', 'error');
        }
    },

    async loadLatestAPIResults(scan) {
        if (scan.results) {
            this.displayAPIResultsDashboard(scan.results);
        }
    },

    displayAPIResultsDashboard(apiData) {
        const dashboard = document.getElementById('api-dashboard');
        const data = typeof apiData === 'string' ? JSON.parse(apiData) : apiData;
        
        // Update metrics
        const apis = data.discovered_apis || {};
        document.getElementById('total-rest-apis').textContent = apis.rest_apis?.length || 0;
        document.getElementById('total-graphql-apis').textContent = apis.graphql_apis?.length || 0;
        document.getElementById('total-soap-apis').textContent = apis.soap_apis?.length || 0;
        document.getElementById('total-documentations').textContent = data.documentation_found?.length || 0;
        document.getElementById('total-api-vulns').textContent = data.api_vulnerabilities?.length || 0;
        document.getElementById('total-auth-issues').textContent = data.authentication_mechanisms?.filter(auth => auth.auth_bypasses_possible?.length > 0).length || 0;
        
        // Render API results content
        const content = document.getElementById('api-results-content');
        content.innerHTML = this.renderAPIResultsContent(data);
        
        dashboard.style.display = 'block';
    },

    renderAPIResultsContent(data) {
        let content = '';
        
        // Critical API vulnerabilities first
        if (data.api_vulnerabilities && data.api_vulnerabilities.length > 0) {
            const criticalVulns = data.api_vulnerabilities.filter(v => v.severity === 'critical');
            if (criticalVulns.length > 0) {
                content += `
                    <div class="api-type-card" style="border-color: #ff0000;">
                        <h4 style="color: #ff0000; margin-bottom: 15px;">🚨 Critical API Vulnerabilities</h4>
                        ${criticalVulns.map(vuln => `
                            <div class="api-endpoint" style="border-color: #ff4444; background: rgba(255, 0, 0, 0.1);">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: #ff4444; font-weight: bold;">${vuln.type}</span>
                                    <span class="vulnerability-tag vuln-${vuln.severity}">${vuln.severity.toUpperCase()}</span>
                                </div>
                                <div style="margin-top: 5px; color: #ff6b6b;">📍 ${vuln.endpoint || vuln.url}</div>
                                <div style="margin-top: 5px; font-size: 11px; color: #ccc;">${vuln.description}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }
        
        // API types
        if (data.discovered_apis) {
            Object.entries(data.discovered_apis).forEach(([apiType, apis]) => {
                if (apis && apis.length > 0) {
                    content += this.renderAPITypeSection(apiType, apis, data);
                }
            });
        }
        
        // API Documentation
        if (data.documentation_found && data.documentation_found.length > 0) {
            content += this.renderAPIDocumentationSection(data.documentation_found);
        }
        
        // Authentication Analysis
        if (data.authentication_mechanisms && data.authentication_mechanisms.length > 0) {
            content += this.renderAuthenticationSection(data.authentication_mechanisms);
        }
        
        // Rate Limiting Analysis
        if (data.rate_limiting_analysis && Object.keys(data.rate_limiting_analysis).length > 0) {
            content += this.renderRateLimitingSection(data.rate_limiting_analysis);
        }
        
        return content;
    },

    renderAPITypeSection(apiType, apis, fullData) {
        const typeIcons = {
            rest_apis: '🔗',
            graphql_apis: '🔶',
            soap_apis: '🧼',
            mobile_apis: '📱',
            admin_apis: '👑',
            undocumented_apis: '🔍'
        };
        
        const typeColors = {
            rest_apis: '#00ff9f',
            graphql_apis: '#9a4dff',
            soap_apis: '#00bfff',
            mobile_apis: '#ffa500',
            admin_apis: '#ff4444',
            undocumented_apis: '#ffff00'
        };
        
        const icon = typeIcons[apiType] || '🔗';
        const color = typeColors[apiType] || '#00ff9f';
        
        return `
            <div class="api-type-card">
                <h4 class="collapsible-api" style="color: ${color}; margin-bottom: 15px;">
                    ▶ ${icon} ${apiType.replace('_', ' ').toUpperCase()} (${apis.length})
                </h4>
                <div class="collapsible-api-content">
                    ${apis.map(api => {
                        const apiVulns = fullData.api_vulnerabilities?.filter(v => v.endpoint === api.url || v.api_url === api.url) || [];
                        return `
                            <div class="api-endpoint">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <div>
                                        ${api.api_type ? `<span class="api-method-tag method-get">${api.api_type}</span>` : ''}
                                        <span style="margin-left: 8px; color: #00ff9f; font-weight: bold;">${api.filename || 'API'}</span>
                                    </div>
                                    <div>
                                        ${api.status_code ? `<span style="color: ${api.status_code === 200 ? '#00ff00' : '#ffff00'};">${api.status_code}</span>` : ''}
                                        ${apiVulns.length > 0 ? 
                                            `<span style="margin-left: 8px; color: #ff4444;">⚠️ ${apiVulns.length}</span>` : 
                                            `<span style="margin-left: 8px; color: #00ff9f;">✅</span>`
                                        }
                                    </div>
                                </div>
                                <div style="color: #9a4dff; font-size: 11px; margin-bottom: 4px;">📍 ${api.url}</div>
                                ${api.content_type ? `<div style="color: #666; font-size: 10px;">Content-Type: ${api.content_type}</div>` : ''}
                                ${api.server ? `<div style="color: #666; font-size: 10px;">Server: ${api.server}</div>` : ''}
                                ${apiVulns.length > 0 ? 
                                    `<div style="margin-top: 5px;">
                                        ${apiVulns.map(v => `<span class="vulnerability-tag vuln-${v.severity}">${v.type}</span>`).join('')}
                                    </div>` : ''
                                }
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    renderAPIDocumentationSection(documentation) {
        return `
            <div class="api-type-card">
                <h4 class="collapsible-api" style="color: #ffff00; margin-bottom: 15px;">
                    ▶ 📚 API Documentation Found (${documentation.length})
                </h4>
                <div class="collapsible-api-content">
                    ${documentation.map(doc => `
                        <div class="api-endpoint">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span style="color: #ffff00; font-weight: bold;">${doc.doc_type}</span>
                                    ${doc.contains_sensitive_info ? 
                                        `<span style="margin-left: 8px; color: #ff4444;">⚠️ Sensitive Info</span>` : 
                                        `<span style="margin-left: 8px; color: #00ff9f;">✅ Safe</span>`
                                    }
                                </div>
                                <a href="${doc.doc_url}" target="_blank" class="documentation-link">📖 View</a>
                            </div>
                            <div style="color: #9a4dff; font-size: 11px; margin-top: 4px;">📍 ${doc.doc_url}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderAuthenticationSection(authMechanisms) {
        return `
            <div class="api-type-card">
                <h4 class="collapsible-api" style="color: #9a4dff; margin-bottom: 15px;">
                    ▶ 🔐 Authentication Analysis (${authMechanisms.length})
                </h4>
                <div class="collapsible-api-content">
                    ${authMechanisms.map(auth => `
                        <div class="api-endpoint">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="color: #9a4dff; font-weight: bold;">API Endpoint</span>
                                <span style="color: ${auth.requires_auth ? '#ffa500' : '#00ff9f'};">
                                    ${auth.requires_auth ? '🔒 Auth Required' : '🔓 No Auth'}
                                </span>
                            </div>
                            <div style="color: #9a4dff; font-size: 11px; margin-bottom: 8px;">📍 ${auth.api_url}</div>
                            ${auth.auth_types_detected.length > 0 ? 
                                `<div style="margin-bottom: 8px;">
                                    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">Detected Auth Types:</div>
                                    ${auth.auth_types_detected.map(type => `<span class="api-method-tag method-get">${type}</span>`).join('')}
                                </div>` : ''
                            }
                            ${auth.auth_bypasses_possible.length > 0 ? 
                                `<div style="background: rgba(255, 0, 0, 0.1); padding: 8px; border-radius: 4px; margin-top: 8px;">
                                    <div style="color: #ff4444; font-size: 11px; font-weight: bold;">⚠️ Possible Auth Bypasses:</div>
                                    ${auth.auth_bypasses_possible.map(bypass => `
                                        <div style="font-size: 10px; color: #ff6b6b; margin-top: 2px;">• ${bypass.method}: ${bypass.description}</div>
                                    `).join('')}
                                </div>` : ''
                            }
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderRateLimitingSection(rateLimitData) {
        return `
            <div class="api-type-card">
                <h4 class="collapsible-api" style="color: #00bfff; margin-bottom: 15px;">
                    ▶ ⏱️ Rate Limiting Analysis
                </h4>
                <div class="collapsible-api-content">
                    ${Object.entries(rateLimitData).map(([apiUrl, analysis]) => `
                        <div class="api-endpoint">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="color: #00bfff; font-weight: bold;">Rate Limit Status</span>
                                <span style="color: ${analysis.has_rate_limiting ? '#00ff9f' : '#ffa500'};">
                                    ${analysis.has_rate_limiting ? '✅ Protected' : '⚠️ No Limits'}
                                </span>
                            </div>
                            <div style="color: #9a4dff; font-size: 11px; margin-bottom: 8px;">📍 ${apiUrl}</div>
                            ${analysis.has_rate_limiting ? 
                                `<div style="font-size: 11px; color: #666;">
                                    Requests before limit: ${analysis.requests_before_limit}
                                    ${analysis.rate_limit_headers.length > 0 ? 
                                        `<br>Headers: ${analysis.rate_limit_headers.join(', ')}` : ''
                                    }
                                </div>` : ''
                            }
                            ${analysis.bypass_possible ? 
                                `<div style="background: rgba(255, 165, 0, 0.1); padding: 6px; border-radius: 4px; margin-top: 6px;">
                                    <div style="color: #ffa500; font-size: 11px;">⚠️ Rate limit bypass may be possible</div>
                                </div>` : ''
                            }
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    async stopScan(scanId) {
        if (confirm('Are you sure you want to stop this API discovery scan?')) {
            try {
                const response = await API.call(`/api-discovery/stop/${scanId}`, {
                    method: 'POST'
                });
                
                if (response && response.ok) {
                    Utils.showMessage('API discovery scan stopped successfully!', 'success');
                    await this.loadAPIScans();
                }
            } catch (error) {
                Utils.showMessage('Failed to stop scan: ' + error.message, 'error');
            }
        }
    },

    // Real-time updates
    startRealTimeUpdates() {
        console.log('🔄 Starting real-time updates for API discovery');
        
        this.cleanup();
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'api-discovery') {
                try {
                    await this.loadAPIScans();
                    this.updateLastUpdateTime();
                } catch (error) {
                    console.error('Real-time API discovery update failed:', error);
                }
            }
        }, 5000); // Update every 5 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    updateAPIScanStatus(scans) {
        const statusSpan = document.getElementById('api-scan-status');
        if (!statusSpan) return;
        
        const runningScans = scans.filter(scan => scan.status === 'running' || scan.status === 'pending');
        
        if (runningScans.length > 0) {
            statusSpan.innerHTML = `🔄 ${runningScans.length} API scan${runningScans.length > 1 ? 's' : ''} running`;
            statusSpan.style.color = '#00ff9f';
        } else {
            const completedCount = scans.filter(scan => scan.status === 'completed').length;
            const totalAPIs = scans.filter(scan => scan.status === 'completed').reduce((total, scan) => {
                try {
                    const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                    return total + Object.values(results.discovered_apis || {}).flat().length;
                } catch {
                    return total;
                }
            }, 0);
            
            statusSpan.innerHTML = `✅ ${completedCount} scan${completedCount !== 1 ? 's' : ''} completed | 🔗 ${totalAPIs} APIs discovered`;
            statusSpan.style.color = '#00ff9f';
        }
    },

    updateLastUpdateTime() {
        const element = document.getElementById('api-last-update');
        if (element) {
            element.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('api-auto-refresh-indicator');
        if (indicator) {
            if (isActive) {
                indicator.innerHTML = '🔄 Auto-updating';
                indicator.style.color = '#00ff9f';
            } else {
                indicator.innerHTML = '⏸️ Paused';
                indicator.style.color = '#ffff00';
            }
        }
    },

    toggleAutoRefresh() {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        const toggleBtn = document.getElementById('api-auto-refresh-toggle');
        if (toggleBtn) {
            if (this.isAutoRefreshEnabled) {
                toggleBtn.innerHTML = '⏸️ Pause Auto-refresh';
                this.startRealTimeUpdates();
                Utils.showMessage('Auto-refresh enabled', 'success');
            } else {
                toggleBtn.innerHTML = '▶️ Resume Auto-refresh';
                this.updateAutoRefreshIndicator(false);
                Utils.showMessage('Auto-refresh paused', 'warning');
            }
        }
    },

    cleanup() {
        console.log('🧹 Cleaning up API Discovery module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
    }
};

// Make it globally available
window.APIDiscovery = APIDiscovery;
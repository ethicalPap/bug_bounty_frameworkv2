// frontend/assets/js/modules/enhanced-api-discovery.js - Advanced API Discovery & Testing

const EnhancedAPIDiscovery = {
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
                    border: 1px solid #9a4dff;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 0;
                    transition: all 0.3s;
                }
                
                .api-type-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(154, 77, 255, 0.3);
                }
                
                .api-endpoint {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 6px;
                    padding: 12px;
                    margin: 8px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                }
                
                .api-method {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: bold;
                    margin-right: 8px;
                }
                
                .method-GET { background: #00ff00; color: #000; }
                .method-POST { background: #ff6600; color: #fff; }
                .method-PUT { background: #0066ff; color: #fff; }
                .method-DELETE { background: #ff0000; color: #fff; }
                .method-PATCH { background: #9900ff; color: #fff; }
                .method-OPTIONS { background: #666; color: #fff; }
                
                .vulnerability-badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: bold;
                    margin: 2px;
                }
                
                .vuln-critical { background: #ff0000; color: #fff; }
                .vuln-high { background: #ff6600; color: #fff; }
                .vuln-medium { background: #ffaa00; color: #000; }
                .vuln-low { background: #00ff00; color: #000; }
                
                .api-documentation-card {
                    background: rgba(0, 255, 159, 0.1);
                    border: 1px solid #00ff9f;
                    border-radius: 6px;
                    padding: 10px;
                    margin: 8px 0;
                }
                
                .auth-mechanism {
                    background: rgba(255, 255, 0, 0.1);
                    border: 1px solid #ffff00;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 5px 0;
                }
                
                .rate-limit-info {
                    background: rgba(255, 107, 107, 0.1);
                    border: 1px solid #ff6b6b;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 5px 0;
                }
                
                .api-testing-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .testing-category {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .testing-category:hover {
                    border-color: #00ff9f;
                    transform: translateY(-2px);
                }
                
                .testing-category.selected {
                    border-color: #00ff9f;
                    background: rgba(0, 255, 159, 0.1);
                }
                
                .api-results-tabs {
                    display: flex;
                    border-bottom: 2px solid #9a4dff;
                    margin-bottom: 20px;
                }
                
                .api-results-tab {
                    padding: 10px 20px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: all 0.3s;
                }
                
                .api-results-tab.active {
                    border-bottom-color: #00ff9f;
                    color: #00ff9f;
                }
                
                .parameter-test {
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 5px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 11px;
                }
                
                .business-logic-test {
                    background: rgba(154, 77, 255, 0.1);
                    border: 1px solid #9a4dff;
                    border-radius: 6px;
                    padding: 10px;
                    margin: 8px 0;
                }
                
                .scrollable-api-results {
                    max-height: 500px;
                    overflow-y: auto;
                    border: 1px solid #9a4dff;
                    border-radius: 4px;
                    padding: 15px;
                    background: rgba(26, 10, 46, 0.3);
                }
            </style>

            <div class="scan-info">
                <h4>🔗 Enhanced API Discovery & Testing</h4>
                <p>Advanced API discovery including REST, GraphQL, and SOAP endpoints with comprehensive security testing. Includes authentication analysis, parameter fuzzing, vulnerability testing, rate limiting analysis, and business logic testing.</p>
            </div>

            <!-- API Discovery Controls -->
            <div class="card">
                <div class="card-title">Start Advanced API Discovery</div>
                <div id="api-discovery-messages"></div>
                
                <form id="api-discovery-form">
                    <div class="api-testing-grid">
                        <div class="testing-category selected" data-type="comprehensive" onclick="EnhancedAPIDiscovery.selectTestingType('comprehensive')">
                            <h4 style="color: #ff6b6b; margin-bottom: 10px;">🎯 Comprehensive Testing</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Complete API discovery and security testing</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• REST, GraphQL, SOAP discovery</div>
                                <div>• Authentication testing</div>
                                <div>• Parameter fuzzing</div>
                                <div>• Vulnerability assessment</div>
                                <div>• Business logic testing</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 15-30 minutes</div>
                        </div>
                        
                        <div class="testing-category" data-type="discovery_only" onclick="EnhancedAPIDiscovery.selectTestingType('discovery_only')">
                            <h4 style="color: #00ff9f; margin-bottom: 10px;">🔍 Discovery Only</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">API endpoint discovery without testing</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Endpoint enumeration</div>
                                <div>• Documentation discovery</div>
                                <div>• API type identification</div>
                                <div>• Authentication detection</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 5-10 minutes</div>
                        </div>
                        
                        <div class="testing-category" data-type="security_focused" onclick="EnhancedAPIDiscovery.selectTestingType('security_focused')">
                            <h4 style="color: #ff4444; margin-bottom: 10px;">⚠️ Security Focused</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Focus on vulnerability testing</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• SQL injection testing</div>
                                <div>• XXE vulnerability testing</div>
                                <div>• SSRF testing</div>
                                <div>• Authentication bypass</div>
                                <div>• Rate limit bypass</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 10-20 minutes</div>
                        </div>
                        
                        <div class="testing-category" data-type="business_logic" onclick="EnhancedAPIDiscovery.selectTestingType('business_logic')">
                            <h4 style="color: #9a4dff; margin-bottom: 10px;">🧠 Business Logic</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Business logic and workflow testing</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Workflow analysis</div>
                                <div>• Logic flaw detection</div>
                                <div>• Privilege escalation</div>
                                <div>• Race condition testing</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 8-15 minutes</div>
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
                </form>
            </div>

            <!-- Active API Scans -->
            <div class="card">
                <div class="card-title">
                    API Discovery Scans
                    <span id="api-auto-refresh-indicator" style="float: right; font-size: 12px; color: #9a4dff;">🔄 Auto-updating</span>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="EnhancedAPIDiscovery.loadAPIScans()" class="btn btn-secondary">🔄 Refresh</button>
                    <button onclick="EnhancedAPIDiscovery.toggleAutoRefresh()" class="btn btn-secondary" id="api-auto-refresh-toggle">⏸️ Pause Auto-refresh</button>
                    <span id="api-scan-status" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="api-last-update" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <div id="api-scans-list">
                    <p style="text-align: center; color: #9a4dff; padding: 20px;">Loading API discovery scans...</p>
                </div>
            </div>

            <!-- API Results Modal -->
            <div id="api-results-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 95%; max-width: 1400px; height: 95%; background: linear-gradient(135deg, #1a0a2e, #2d1b69); border: 2px solid #9a4dff; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 20px; border-bottom: 1px solid #9a4dff; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="color: #00ff9f;">API Discovery Results</h3>
                        <button onclick="EnhancedAPIDiscovery.closeResultsModal()" class="btn btn-secondary">✕ Close</button>
                    </div>
                    <div id="api-results-content" style="padding: 20px; height: calc(100% - 80px); overflow-y: auto;">
                        <!-- Results will be loaded here -->
                    </div>
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

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('api-results-modal');
            if (e.target === modal) {
                this.closeResultsModal();
            }
        });
    },

    selectTestingType(type) {
        // Update selected testing type
        document.querySelectorAll('.testing-category').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
        this.selectedTestingType = type;
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
        const testingType = this.selectedTestingType || 'comprehensive';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'api-discovery-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-api-discovery-btn', true);
            
            const config = {
                testing_type: testingType,
                subdomain_id: subdomainId || null,
                include_auth_testing: testingType !== 'discovery_only',
                include_vuln_testing: testingType === 'comprehensive' || testingType === 'security_focused',
                include_business_logic: testingType === 'comprehensive' || testingType === 'business_logic',
                include_rate_limiting: testingType !== 'discovery_only',
                deep_parameter_fuzzing: testingType === 'comprehensive' || testingType === 'security_focused'
            };
            
            const response = await fetch(`${CONFIG.API_BASE}/advanced-api-discovery/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetId: parseInt(targetId),
                    config: config
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    const scopeText = subdomainId ? 'single subdomain' : 'all subdomains';
                    Utils.showMessage(`${testingType.charAt(0).toUpperCase() + testingType.slice(1)} API discovery started for ${scopeText}!`, 'success', 'api-discovery-messages');
                    
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
            const response = await fetch(`${CONFIG.API_BASE}/advanced-api-discovery/scans`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const scans = data.success ? data.data : [];
                
                this.renderAPIScans(scans);
                this.updateAPIScanStatus(scans);
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
            container.innerHTML = '<p style="text-align: center; color: #9a4dff; padding: 20px;">No API discovery scans yet. Start your first API discovery above!</p>';
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
                                Scan ID: ${scan.id} | Type: ${scan.testing_type || 'comprehensive'}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                Started: ${new Date(scan.started_at || scan.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="status status-${scan.status}">${scan.status.toUpperCase()}</span>
                            <div style="margin-top: 5px;">
                                ${scan.status === 'completed' ? 
                                    `<button onclick="EnhancedAPIDiscovery.viewResults(${scan.id})" class="btn btn-primary btn-small">🔗 View APIs</button>` :
                                    scan.status === 'running' ?
                                    `<button onclick="EnhancedAPIDiscovery.stopScan(${scan.id})" class="btn btn-danger btn-small">⏹️ Stop</button>` :
                                    ''
                                }
                            </div>
                        </div>
                    </div>
                    
                    ${this.renderScanProgress(scan)}
                    
                    ${scan.status === 'completed' && scan.results ? 
                        this.renderScanSummary(scan.results) : ''
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
                    <span style="font-size: 12px; color: #9a4dff;">Progress: ${progress}%</span>
                    <span style="font-size: 11px; color: #666;">${scan.current_phase || 'Processing...'}</span>
                </div>
                
                <div style="background-color: #2d1b69; height: 6px; border-radius: 3px;">
                    <div style="background: linear-gradient(90deg, #9a4dff, #00ff9f); height: 100%; width: ${progress}%; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    },

    renderScanSummary(results) {
        const summary = typeof results === 'string' ? JSON.parse(results) : results;
        
        const restAPIs = summary.discovered_apis?.rest_apis?.length || 0;
        const graphqlAPIs = summary.discovered_apis?.graphql_apis?.length || 0;
        const soapAPIs = summary.discovered_apis?.soap_apis?.length || 0;
        const vulnCount = summary.api_vulnerabilities?.length || 0;
        const docCount = summary.documentation_found?.length || 0;
        
        return `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #9a4dff;">
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center;">
                    <div>
                        <div style="font-size: 16px; font-weight: bold; color: #00ff9f;">${restAPIs}</div>
                        <div style="font-size: 10px; color: #9a4dff;">REST APIs</div>
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: bold; color: #9a4dff;">${graphqlAPIs}</div>
                        <div style="font-size: 10px; color: #9a4dff;">GraphQL</div>
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: bold; color: #ffff00;">${soapAPIs}</div>
                        <div style="font-size: 10px; color: #9a4dff;">SOAP</div>
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: bold; color: ${vulnCount > 0 ? '#ff4444' : '#00ff9f'};">${vulnCount}</div>
                        <div style="font-size: 10px; color: #9a4dff;">Vulnerabilities</div>
                    </div>
                    <div>
                        <div style="font-size: 16px; font-weight: bold; color: #ff6b6b;">${docCount}</div>
                        <div style="font-size: 10px; color: #9a4dff;">Documentation</div>
                    </div>
                </div>
            </div>
        `;
    },

    async viewResults(scanId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/advanced-api-discovery/results/${scanId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.showResultsModal(data.data);
                }
            }
        } catch (error) {
            console.error('Failed to load API results:', error);
            Utils.showMessage('Failed to load API discovery results', 'error');
        }
    },

    showResultsModal(results) {
        const modal = document.getElementById('api-results-modal');
        const content = document.getElementById('api-results-content');
        
        content.innerHTML = this.renderDetailedAPIResults(results);
        modal.style.display = 'block';
        
        document.body.style.overflow = 'hidden';
    },

    closeResultsModal() {
        const modal = document.getElementById('api-results-modal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    },

    renderDetailedAPIResults(results) {
        const data = results.api_discovery_results || results;
        
        return `
            <div class="api-results-tabs">
                <div class="api-results-tab active" onclick="EnhancedAPIDiscovery.switchResultsTab('overview')">📊 Overview</div>
                <div class="api-results-tab" onclick="EnhancedAPIDiscovery.switchResultsTab('apis')">🔗 APIs</div>
                <div class="api-results-tab" onclick="EnhancedAPIDiscovery.switchResultsTab('vulnerabilities')">⚠️ Vulnerabilities</div>
                <div class="api-results-tab" onclick="EnhancedAPIDiscovery.switchResultsTab('authentication')">🔐 Authentication</div>
                <div class="api-results-tab" onclick="EnhancedAPIDiscovery.switchResultsTab('documentation')">📖 Documentation</div>
            </div>
            
            <div id="api-results-tab-overview" class="results-tab-content">
                ${this.renderAPIOverview(data)}
            </div>
            
            <div id="api-results-tab-apis" class="results-tab-content" style="display: none;">
                ${this.renderAPIsTab(data)}
            </div>
            
            <div id="api-results-tab-vulnerabilities" class="results-tab-content" style="display: none;">
                ${this.renderVulnerabilitiesTab(data)}
            </div>
            
            <div id="api-results-tab-authentication" class="results-tab-content" style="display: none;">
                ${this.renderAuthenticationTab(data)}
            </div>
            
            <div id="api-results-tab-documentation" class="results-tab-content" style="display: none;">
                ${this.renderDocumentationTab(data)}
            </div>
        `;
    },

    renderAPIOverview(data) {
        const apis = data.discovered_apis || {};
        const vulns = data.api_vulnerabilities || [];
        const auth = data.authentication_mechanisms || [];
        const docs = data.documentation_found || [];
        
        const totalAPIs = Object.values(apis).flat().length;
        const criticalVulns = vulns.filter(v => v.severity === 'critical').length;
        const highVulns = vulns.filter(v => v.severity === 'high').length;
        
        return `
            <div class="scrollable-api-results">
                <h4 style="color: #00ff9f; margin-bottom: 15px;">API Discovery Overview</h4>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #00ff9f;">${totalAPIs}</div>
                        <div style="color: #9a4dff; font-size: 12px;">Total APIs</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: ${vulns.length > 0 ? '#ff4444' : '#00ff9f'};">${vulns.length}</div>
                        <div style="color: #9a4dff; font-size: 12px;">Vulnerabilities</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: ${criticalVulns > 0 ? '#ff0000' : '#00ff9f'};">${criticalVulns}</div>
                        <div style="color: #9a4dff; font-size: 12px;">Critical Issues</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #ffff00;">${docs.length}</div>
                        <div style="color: #9a4dff; font-size: 12px;">Documentation</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    ${Object.entries(apis).map(([type, apiList]) => `
                        <div style="border: 1px solid #9a4dff; border-radius: 8px; padding: 15px;">
                            <h5 style="color: #9a4dff; margin-bottom: 10px;">${type.replace('_', ' ').toUpperCase()}</h5>
                            <div style="font-size: 18px; font-weight: bold; color: #00ff9f;">${apiList.length}</div>
                            <div style="font-size: 11px; color: #666;">endpoints found</div>
                        </div>
                    `).join('')}
                </div>
                
                ${data.rate_limiting_analysis ? `
                    <div style="margin-top: 20px;">
                        <h5 style="color: #ff6b6b;">Rate Limiting Analysis</h5>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px;">
                            ${Object.entries(data.rate_limiting_analysis).slice(0, 3).map(([url, analysis]) => `
                                <div class="rate-limit-info">
                                    <div style="font-size: 11px; font-family: 'Courier New', monospace;">${url}</div>
                                    <div style="font-size: 12px; margin-top: 4px;">
                                        ${analysis.has_rate_limiting ? 
                                            `✅ Rate limited (${analysis.requests_before_limit} requests)` : 
                                            '❌ No rate limiting detected'
                                        }
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderAPIsTab(data) {
        const apis = data.discovered_apis || {};
        
        return `
            <div class="scrollable-api-results">
                <h4 style="color: #00ff9f; margin-bottom: 15px;">Discovered APIs</h4>
                
                ${Object.entries(apis).map(([type, apiList]) => {
                    if (apiList.length === 0) return '';
                    
                    return `
                        <div style="margin-bottom: 20px;">
                            <h5 style="color: #9a4dff; margin-bottom: 10px;">${type.replace('_', ' ').toUpperCase()} (${apiList.length})</h5>
                            ${apiList.map(api => `
                                <div class="api-endpoint">
                                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                                        <span class="api-method method-${api.method || 'GET'}">${api.method || 'GET'}</span>
                                        <span style="color: #00ff9f; font-weight: bold;">${api.url}</span>
                                        <span style="color: #666; font-size: 10px;">${api.status_code || 'N/A'}</span>
                                    </div>
                                    
                                    ${api.content_type ? `<div style="font-size: 10px; color: #9a4dff;">Content-Type: ${api.content_type}</div>` : ''}
                                    ${api.server ? `<div style="font-size: 10px; color: #9a4dff;">Server: ${api.server}</div>` : ''}
                                    
                                    ${api.parameters ? `
                                        <div style="margin-top: 5px;">
                                            <strong style="font-size: 10px; color: #ffff00;">Parameters:</strong>
                                            ${api.parameters.map(param => `<span class="tech-tag">${param.name} (${param.type})</span>`).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderVulnerabilitiesTab(data) {
        const vulns = data.api_vulnerabilities || [];
        
        if (vulns.length === 0) {
            return '<div class="scrollable-api-results"><p style="text-align: center; color: #00ff9f; padding: 40px;">🎉 No API vulnerabilities found!</p></div>';
        }
        
        return `
            <div class="scrollable-api-results">
                <h4 style="color: #ff4444; margin-bottom: 15px;">API Vulnerabilities (${vulns.length})</h4>
                
                ${vulns.map(vuln => `
                    <div style="border: 1px solid #9a4dff; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <h5 style="color: #00ff9f; margin: 0;">${vuln.type}</h5>
                            <span class="vulnerability-badge vuln-${vuln.severity}">${vuln.severity?.toUpperCase()}</span>
                        </div>
                        
                        <div style="font-size: 12px; color: #9a4dff; margin-bottom: 8px;">
                            API: ${vuln.api_url} ${vuln.parameter ? `| Parameter: ${vuln.parameter}` : ''}
                        </div>
                        
                        <div style="font-size: 13px; margin-bottom: 10px;">${vuln.description || 'No description available'}</div>
                        
                        ${vuln.payload ? `
                            <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 11px; margin-top: 8px;">
                                <strong>Payload:</strong> ${vuln.payload}
                            </div>
                        ` : ''}
                        
                        ${vuln.evidence ? `
                            <div style="background: rgba(255,0,0,0.1); padding: 8px; border-radius: 4px; font-size: 11px; margin-top: 8px;">
                                <strong>Evidence:</strong> ${vuln.evidence}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderAuthenticationTab(data) {
        const auth = data.authentication_mechanisms || [];
        
        return `
            <div class="scrollable-api-results">
                <h4 style="color: #ffff00; margin-bottom: 15px;">Authentication Analysis</h4>
                
                ${auth.length === 0 ? 
                    '<p style="text-align: center; color: #9a4dff; padding: 20px;">No authentication mechanisms detected</p>' :
                    auth.map(authMech => `
                        <div class="auth-mechanism">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <strong style="color: #ffff00;">${authMech.api_url}</strong>
                                <span style="font-size: 11px; color: ${authMech.requires_auth ? '#ff4444' : '#00ff9f'};">
                                    ${authMech.requires_auth ? '🔒 Auth Required' : '🔓 No Auth'}
                                </span>
                            </div>
                            
                            ${authMech.auth_types_detected?.length > 0 ? `
                                <div style="margin: 5px 0;">
                                    <strong style="font-size: 12px;">Detected Auth Types:</strong>
                                    ${authMech.auth_types_detected.map(type => `<span class="tech-tag">${type}</span>`).join('')}
                                </div>
                            ` : ''}
                            
                            ${authMech.auth_bypasses_possible?.length > 0 ? `
                                <div style="margin: 5px 0;">
                                    <strong style="font-size: 12px; color: #ff4444;">⚠️ Possible Bypasses:</strong>
                                    ${authMech.auth_bypasses_possible.map(bypass => `
                                        <div style="font-size: 11px; margin: 2px 0; color: #ff6b6b;">
                                            ${bypass.method}: ${bypass.description}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            
                            ${authMech.security_issues?.length > 0 ? `
                                <div style="margin: 5px 0;">
                                    <strong style="font-size: 12px; color: #ff0000;">🚨 Security Issues:</strong>
                                    ${authMech.security_issues.map(issue => `
                                        <div style="font-size: 11px; margin: 2px 0; color: #ff4444;">${issue}</div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')
                }
            </div>
        `;
    },

    renderDocumentationTab(data) {
        const docs = data.documentation_found || [];
        
        return `
            <div class="scrollable-api-results">
                <h4 style="color: #00ff9f; margin-bottom: 15px;">API Documentation</h4>
                
                ${docs.length === 0 ? 
                    '<p style="text-align: center; color: #9a4dff; padding: 20px;">No API documentation found</p>' :
                    docs.map(doc => `
                        <div class="api-documentation-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <strong style="color: #00ff9f;">${doc.doc_type}</strong>
                                <span style="font-size: 11px; color: ${doc.accessible ? '#00ff9f' : '#ff4444'};">
                                    ${doc.accessible ? '✅ Accessible' : '❌ Not Accessible'}
                                </span>
                            </div>
                            
                            <div style="font-family: 'Courier New', monospace; font-size: 11px; color: #9a4dff; margin-bottom: 5px;">
                                ${doc.doc_url}
                            </div>
                            
                            <div style="font-size: 12px; color: #666;">
                                Related API: ${doc.api_url}
                            </div>
                            
                            ${doc.contains_sensitive_info ? `
                                <div style="margin-top: 5px; padding: 4px 8px; background: rgba(255,0,0,0.2); border-radius: 4px; font-size: 11px; color: #ff4444;">
                                    ⚠️ Contains potentially sensitive information
                                </div>
                            ` : ''}
                        </div>
                    `).join('')
                }
            </div>
        `;
    },

    switchResultsTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.api-results-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.results-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`api-results-tab-${tabName}`).style.display = 'block';
    },

    async stopScan(scanId) {
        if (confirm('Are you sure you want to stop this API discovery scan?')) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/advanced-api-discovery/stop/${scanId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
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
            if (activeTab === 'enhanced-api-discovery') {
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
            statusSpan.style.color = '#9a4dff';
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
                indicator.style.color = '#9a4dff';
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
        console.log('🧹 Cleaning up Enhanced API Discovery module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
    }
};

// Make it globally available
window.EnhancedAPIDiscovery = EnhancedAPIDiscovery;
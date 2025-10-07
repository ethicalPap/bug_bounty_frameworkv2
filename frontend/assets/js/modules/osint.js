// frontend/assets/js/modules/osint.js - Open Source Intelligence Gathering Frontend

const OSINT = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
    targetsCache: {},

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.loadOSINTScans();
        this.startRealTimeUpdates();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .osint-category-card {
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border: 1px solid #32cd32;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 0;
                }
                
                .osint-finding {
                    background: rgba(50, 205, 50, 0.1);
                    border: 1px solid #32cd32;
                    border-radius: 6px;
                    padding: 10px;
                    margin: 8px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                }
                
                .osint-alert {
                    background: rgba(255, 0, 0, 0.2);
                    border: 1px solid #ff4444;
                    border-radius: 6px;
                    padding: 10px;
                    margin: 8px 0;
                    animation: alertPulse 2s infinite;
                }
                
                .osint-safe {
                    background: rgba(0, 255, 0, 0.1);
                    border: 1px solid #00ff00;
                    border-radius: 6px;
                    padding: 8px;
                    margin: 8px 0;
                }
                
                .osint-mode-card {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #32cd32;
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin: 10px 0;
                }
                
                .osint-mode-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(50, 205, 50, 0.3);
                }
                
                .osint-mode-card.selected {
                    border-color: #ffff00;
                    background: rgba(255, 255, 0, 0.1);
                }
                
                .intelligence-source {
                    display: inline-block;
                    padding: 2px 6px;
                    margin: 2px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                }
                
                .source-emails { background: rgba(0, 191, 255, 0.2); color: #00bfff; }
                .source-social { background: rgba(255, 20, 147, 0.2); color: #ff1493; }
                .source-breaches { background: rgba(255, 0, 0, 0.2); color: #ff4444; }
                .source-tech { background: rgba(138, 43, 226, 0.2); color: #8a2be2; }
                .source-dns { background: rgba(50, 205, 50, 0.2); color: #32cd32; }
                .source-certificates { background: rgba(255, 165, 0, 0.2); color: #ffa500; }
                
                .collapsible-osint {
                    cursor: pointer;
                    user-select: none;
                }
                
                .collapsible-osint:hover {
                    color: #32cd32;
                }
                
                .collapsible-osint-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }
                
                .collapsible-osint-content.expanded {
                    max-height: 2000px;
                }
                
                .breach-alert {
                    background: linear-gradient(135deg, #ff0000, #cc0000);
                    color: white;
                    padding: 12px;
                    border-radius: 6px;
                    margin: 10px 0;
                    animation: breachAlert 3s infinite;
                }
                
                @keyframes breachAlert {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                
                .timeline-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin: 12px 0;
                    padding: 8px;
                    border-left: 3px solid #32cd32;
                    background: rgba(50, 205, 50, 0.05);
                }
                
                .timeline-icon {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: #32cd32;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    color: #000;
                    font-weight: bold;
                    flex-shrink: 0;
                }
                
                .social-platform {
                    display: inline-block;
                    padding: 4px 8px;
                    margin: 2px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: bold;
                    text-decoration: none;
                }
                
                .platform-linkedin { background: #0077b5; color: white; }
                .platform-twitter { background: #1da1f2; color: white; }
                .platform-github { background: #333; color: white; }
                .platform-facebook { background: #1877f2; color: white; }
                
                .credentials-warning {
                    background: linear-gradient(135deg, #ff4500, #ff6347);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 15px 0;
                    border: 2px solid #ff0000;
                    animation: credentialsAlert 2s infinite;
                }
                
                @keyframes credentialsAlert {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }
            </style>

            <div class="scan-info">
                <h4>🔍 Open Source Intelligence (OSINT)</h4>
                <p>Comprehensive intelligence gathering from public sources including social media, breach databases, DNS records, certificate transparency, and more. Identifies potential security exposures and attack vectors.</p>
            </div>

            <!-- OSINT Controls -->
            <div class="card">
                <div class="card-title">Start OSINT Intelligence Gathering</div>
                <div id="osint-messages"></div>
                
                <form id="osint-form">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div class="osint-mode-card selected" data-type="comprehensive" onclick="OSINT.selectOSINTMode('comprehensive')">
                            <h4 style="color: #32cd32; margin-bottom: 10px;">🌐 Comprehensive OSINT</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Complete intelligence gathering</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Subdomain intelligence</div>
                                <div>• Email & employee discovery</div>
                                <div>• Social media reconnaissance</div>
                                <div>• Breach & credential intelligence</div>
                                <div>• Technology fingerprinting</div>
                                <div>• Third-party exposure analysis</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 20-45 minutes</div>
                        </div>
                        
                        <div class="osint-mode-card" data-type="breach_focused" onclick="OSINT.selectOSINTMode('breach_focused')">
                            <h4 style="color: #ff4444; margin-bottom: 10px;">💀 Breach Intelligence</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Focus on breaches and credentials</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Data breach checking</div>
                                <div>• Leaked credential search</div>
                                <div>• Paste site monitoring</div>
                                <div>• Dark web mentions</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 8-15 minutes</div>
                        </div>
                        
                        <div class="osint-mode-card" data-type="social_recon" onclick="OSINT.selectOSINTMode('social_recon')">
                            <h4 style="color: #ff1493; margin-bottom: 10px;">📱 Social Media Recon</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Social media intelligence gathering</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Employee social accounts</div>
                                <div>• Company social presence</div>
                                <div>• Social media mentions</div>
                                <div>• Leaked information discovery</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 10-20 minutes</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end; margin-top: 20px;">
                        <div class="form-group">
                            <label for="osint-target">Target Domain</label>
                            <select id="osint-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-osint-btn">🔍 Start OSINT Gathering</button>
                    </div>
                    
                    <!-- Advanced Options -->
                    <div style="border: 1px solid #32cd32; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69); margin-top: 15px;">
                        <h5 style="color: #32cd32; margin-bottom: 10px;">Intelligence Options</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Social Media Depth</label>
                                <select id="social-media-depth">
                                    <option value="basic">Basic profiles</option>
                                    <option value="standard" selected>Standard search</option>
                                    <option value="deep">Deep investigation</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Breach Databases</label>
                                <select id="breach-databases">
                                    <option value="public" selected>Public databases</option>
                                    <option value="extended">Extended sources</option>
                                    <option value="comprehensive">All available</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Historical Analysis</label>
                                <select id="historical-analysis">
                                    <option value="6months">Last 6 months</option>
                                    <option value="1year" selected>Last year</option>
                                    <option value="5years">Last 5 years</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Active OSINT Operations -->
            <div class="card">
                <div class="card-title">
                    OSINT Operations
                    <span id="osint-auto-refresh-indicator" style="float: right; font-size: 12px; color: #32cd32;">🔄 Auto-updating</span>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="OSINT.loadOSINTScans()" class="btn btn-secondary">🔄 Refresh</button>
                    <button onclick="OSINT.toggleAutoRefresh()" class="btn btn-secondary" id="osint-auto-refresh-toggle">⏸️ Pause Auto-refresh</button>
                    <span id="osint-status" style="color: #32cd32; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="osint-last-update" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <div id="osint-operations-list">
                    <p style="text-align: center; color: #32cd32; padding: 20px;">Loading OSINT operations...</p>
                </div>
            </div>

            <!-- Intelligence Dashboard -->
            <div class="card" id="intelligence-dashboard" style="display: none;">
                <div class="card-title">🔍 Intelligence Dashboard</div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; border: 1px solid #32cd32; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #32cd32;" id="total-subdomains-found">0</div>
                        <div style="color: #32cd32; font-size: 11px;">Subdomains</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #32cd32; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #00bfff;" id="total-emails-found">0</div>
                        <div style="color: #32cd32; font-size: 11px;">Email Addresses</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #32cd32; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ff1493;" id="total-employees-found">0</div>
                        <div style="color: #32cd32; font-size: 11px;">Employees</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #32cd32; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ff4444;" id="total-breaches-found">0</div>
                        <div style="color: #32cd32; font-size: 11px;">Data Breaches</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #32cd32; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ffa500;" id="total-social-accounts">0</div>
                        <div style="color: #32cd32; font-size: 11px;">Social Accounts</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #32cd32; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ffff00;" id="total-exposures">0</div>
                        <div style="color: #32cd32; font-size: 11px;">Exposures</div>
                    </div>
                </div>
                
                <div id="intelligence-content">
                    <!-- Intelligence content will be rendered here -->
                </div>
            </div>
        `;
    },

    bindEvents() {
        // OSINT form submission
        const osintForm = document.getElementById('osint-form');
        if (osintForm) {
            osintForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startOSINTGathering();
            });
        }

        // Collapsible sections
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('collapsible-osint')) {
                const content = e.target.nextElementSibling;
                if (content && content.classList.contains('collapsible-osint-content')) {
                    content.classList.toggle('expanded');
                    e.target.textContent = content.classList.contains('expanded') ? 
                        e.target.textContent.replace('▶', '▼') : 
                        e.target.textContent.replace('▼', '▶');
                }
            }
        });
    },

    selectOSINTMode(mode) {
        // Update selected OSINT mode
        document.querySelectorAll('.osint-mode-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${mode}"]`).classList.add('selected');
        this.selectedOSINTMode = mode;
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
            
            const targetSelect = document.getElementById('osint-target');
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

    async startOSINTGathering() {
        const targetId = document.getElementById('osint-target').value;
        const osintMode = this.selectedOSINTMode || 'comprehensive';
        const socialDepth = document.getElementById('social-media-depth').value;
        const breachDatabases = document.getElementById('breach-databases').value;
        const historicalAnalysis = document.getElementById('historical-analysis').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'osint-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-osint-btn', true);
            
            const config = {
                osint_mode: osintMode,
                social_media_depth: socialDepth,
                breach_databases: breachDatabases,
                historical_analysis: historicalAnalysis,
                include_email_harvesting: osintMode !== 'social_recon',
                include_social_media: osintMode !== 'breach_focused',
                include_breach_intelligence: osintMode !== 'social_recon',
                include_third_party_exposure: osintMode === 'comprehensive'
            };
            
            const response = await API.call('/osint/start-comprehensive-intelligence', {
                method: 'POST',
                body: JSON.stringify({
                    targetId: parseInt(targetId),
                    config: config
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    Utils.showMessage(`${osintMode.charAt(0).toUpperCase() + osintMode.slice(1)} OSINT gathering started successfully!`, 'success', 'osint-messages');
                    
                    // Reset form
                    document.getElementById('osint-target').value = '';
                    
                    // Refresh operations
                    await this.loadOSINTScans();
                    this.startRealTimeUpdates();
                } else {
                    throw new Error(data.message || 'Unknown error');
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start OSINT gathering');
            }
        } catch (error) {
            Utils.showMessage('Failed to start OSINT gathering: ' + error.message, 'error', 'osint-messages');
        } finally {
            Utils.setButtonLoading('start-osint-btn', false);
        }
    },

    async loadOSINTScans() {
        try {
            const response = await API.call('/osint/operations');
            
            if (response && response.ok) {
                const data = await response.json();
                const operations = data.success ? data.data : [];
                
                this.renderOSINTOperations(operations);
                this.updateOSINTStatus(operations);
                
                // Show latest completed intelligence
                const latestCompleted = operations.find(op => op.status === 'completed');
                if (latestCompleted) {
                    await this.loadLatestIntelligence(latestCompleted);
                }
            }
        } catch (error) {
            console.error('Failed to load OSINT operations:', error);
            document.getElementById('osint-operations-list').innerHTML = 
                '<p style="text-align: center; color: #ff0000; padding: 20px;">Failed to load OSINT operations</p>';
        }
    },

    renderOSINTOperations(operations) {
        const container = document.getElementById('osint-operations-list');
        
        if (operations.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #32cd32; padding: 20px;">No OSINT operations yet. Start your first intelligence gathering above!</p>';
            return;
        }
        
        container.innerHTML = operations.map(operation => {
            const target = this.targetsCache[operation.target_id];
            const targetName = target ? target.domain : `Target ${operation.target_id}`;
            const isRunning = operation.status === 'running' || operation.status === 'pending';
            
            return `
                <div class="osint-category-card ${isRunning ? 'running' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <h4 style="color: #32cd32; margin-bottom: 5px;">🔍 ${targetName}</h4>
                            <div style="font-size: 12px; color: #9a4dff;">
                                Operation ID: ${operation.id} | Mode: ${operation.osint_mode || 'comprehensive'}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                Started: ${new Date(operation.started_at || operation.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="status status-${operation.status}">${operation.status.toUpperCase()}</span>
                            <div style="margin-top: 5px;">
                                ${operation.status === 'completed' ? 
                                    `<button onclick="OSINT.viewIntelligence(${operation.id})" class="btn btn-primary btn-small">🔍 View Intelligence</button>` :
                                    operation.status === 'running' ?
                                    `<button onclick="OSINT.stopOperation(${operation.id})" class="btn btn-danger btn-small">⏹️ Stop</button>` :
                                    ''
                                }
                            </div>
                        </div>
                    </div>
                    
                    ${this.renderOperationProgress(operation)}
                    
                    ${operation.status === 'completed' && operation.results_summary ? 
                        this.renderOperationSummary(operation.results_summary) : ''
                    }
                </div>
            `;
        }).join('');
    },

    renderOperationProgress(operation) {
        const progress = operation.progress_percentage || 0;
        
        if (operation.status !== 'running' && operation.status !== 'pending') {
            return '';
        }
        
        return `
            <div style="margin: 10px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <span style="font-size: 12px; color: #32cd32;">Progress: ${progress}%</span>
                    <span style="font-size: 11px; color: #666;">${operation.current_phase || 'Gathering intelligence...'}</span>
                </div>
                
                <div style="background-color: #2d1b69; height: 6px; border-radius: 3px;">
                    <div style="background: linear-gradient(90deg, #32cd32, #00ff00); height: 100%; width: ${progress}%; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    },

    renderOperationSummary(summary) {
        const data = typeof summary === 'string' ? JSON.parse(summary) : summary;
        
        const counts = {
            subdomains: data.subdomain_intelligence?.total_found || 0,
            emails: data.email_intelligence?.discovered_emails?.length || 0,
            employees: data.employee_intelligence?.total_employees || 0,
            breaches: data.breach_intelligence?.known_breaches?.length || 0,
            social_accounts: data.social_media_intelligence?.official_accounts?.length || 0
        };
        
        const hasBreaches = counts.breaches > 0;
        const hasCredentials = data.breach_intelligence?.leaked_credentials?.length > 0;
        
        return `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #32cd32;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                    ${counts.subdomains > 0 ? `<span class="intelligence-source source-dns">${counts.subdomains} Subdomains</span>` : ''}
                    ${counts.emails > 0 ? `<span class="intelligence-source source-emails">${counts.emails} Emails</span>` : ''}
                    ${counts.employees > 0 ? `<span class="intelligence-source source-social">${counts.employees} Employees</span>` : ''}
                    ${counts.breaches > 0 ? `<span class="intelligence-source source-breaches">${counts.breaches} Breaches</span>` : ''}
                    ${counts.social_accounts > 0 ? `<span class="intelligence-source source-social">${counts.social_accounts} Social</span>` : ''}
                </div>
                
                ${hasBreaches || hasCredentials ? 
                    `<div class="breach-alert">
                        🚨 ${hasBreaches ? counts.breaches + ' data breaches' : ''} ${hasCredentials ? 'and leaked credentials' : ''} found!
                    </div>` : 
                    `<div style="color: #32cd32; font-size: 12px;">✅ No major security exposures detected</div>`
                }
            </div>
        `;
    },

    async viewIntelligence(operationId) {
        try {
            const response = await API.call(`/osint/intelligence/${operationId}`);
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.displayIntelligenceDashboard(data.data);
                }
            }
        } catch (error) {
            console.error('Failed to load intelligence:', error);
            Utils.showMessage('Failed to load intelligence data', 'error');
        }
    },

    async loadLatestIntelligence(operation) {
        if (operation.results) {
            this.displayIntelligenceDashboard(operation.results);
        }
    },

    displayIntelligenceDashboard(intelligenceData) {
        const dashboard = document.getElementById('intelligence-dashboard');
        const data = typeof intelligenceData === 'string' ? JSON.parse(intelligenceData) : intelligenceData;
        
        // Update metrics
        document.getElementById('total-subdomains-found').textContent = 
            data.subdomain_intelligence?.total_found || 0;
        document.getElementById('total-emails-found').textContent = 
            data.email_intelligence?.discovered_emails?.length || 0;
        document.getElementById('total-employees-found').textContent = 
            data.employee_intelligence?.total_employees || 0;
        document.getElementById('total-breaches-found').textContent = 
            data.breach_intelligence?.known_breaches?.length || 0;
        document.getElementById('total-social-accounts').textContent = 
            data.social_media_intelligence?.official_accounts?.length || 0;
        document.getElementById('total-exposures').textContent = 
            data.third_party_exposure?.total_exposures || 0;
        
        // Render intelligence content
        const content = document.getElementById('intelligence-content');
        content.innerHTML = this.renderIntelligenceContent(data);
        
        dashboard.style.display = 'block';
    },

    renderIntelligenceContent(data) {
        let content = '';
        
        // Critical security alerts first
        if (data.breach_intelligence?.leaked_credentials?.length > 0) {
            content += this.renderCredentialsAlert(data.breach_intelligence.leaked_credentials);
        }
        
        // Data breaches
        if (data.breach_intelligence?.known_breaches?.length > 0) {
            content += this.renderDataBreaches(data.breach_intelligence.known_breaches);
        }
        
        // Subdomain intelligence
        if (data.subdomain_intelligence) {
            content += this.renderSubdomainIntelligence(data.subdomain_intelligence);
        }
        
        // Email intelligence
        if (data.email_intelligence) {
            content += this.renderEmailIntelligence(data.email_intelligence);
        }
        
        // Employee intelligence
        if (data.employee_intelligence) {
            content += this.renderEmployeeIntelligence(data.employee_intelligence);
        }
        
        // Social media intelligence
        if (data.social_media_intelligence) {
            content += this.renderSocialMediaIntelligence(data.social_media_intelligence);
        }
        
        // Third-party exposure
        if (data.third_party_exposure) {
            content += this.renderThirdPartyExposure(data.third_party_exposure);
        }
        
        // Technology intelligence
        if (data.technology_intelligence) {
            content += this.renderTechnologyIntelligence(data.technology_intelligence);
        }
        
        // Recommendations
        if (data.recommendations?.length > 0) {
            content += this.renderIntelligenceRecommendations(data.recommendations);
        }
        
        return content;
    },

    renderCredentialsAlert(credentials) {
        return `
            <div class="credentials-warning">
                <h4 style="color: white; margin-bottom: 10px;">🚨 CRITICAL: Leaked Credentials Found</h4>
                <div style="font-size: 14px; margin-bottom: 10px;">
                    ${credentials.length} leaked credential${credentials.length > 1 ? 's' : ''} discovered in data breaches!
                </div>
                <div style="font-size: 12px; color: #ffcccc;">
                    <strong>Immediate Actions Required:</strong>
                    <ul style="margin: 8px 0 0 20px;">
                        <li>Force password reset for all affected accounts</li>
                        <li>Enable multi-factor authentication</li>
                        <li>Review account access logs</li>
                        <li>Notify affected users immediately</li>
                    </ul>
                </div>
            </div>
        `;
    },

    renderDataBreaches(breaches) {
        return `
            <div class="osint-category-card" style="border-color: #ff4444;">
                <h4 class="collapsible-osint" style="color: #ff4444; margin-bottom: 15px;">
                    ▶ 💀 Data Breaches Found (${breaches.length})
                </h4>
                <div class="collapsible-osint-content">
                    ${breaches.map(breach => `
                        <div class="osint-alert">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="color: #ff4444; font-weight: bold;">${breach.breach_name || 'Unknown Breach'}</span>
                                <span style="color: #ffcccc; font-size: 11px;">${breach.date || 'Date Unknown'}</span>
                            </div>
                            <div style="color: #ffcccc; font-size: 11px; margin-bottom: 4px;">
                                Affected Records: ${breach.records_affected || 'Unknown'}
                            </div>
                            <div style="color: #ffcccc; font-size: 10px;">
                                Data Types: ${breach.data_types?.join(', ') || 'Email addresses, passwords'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderSubdomainIntelligence(subdomainIntel) {
        return `
            <div class="osint-category-card">
                <h4 class="collapsible-osint" style="color: #32cd32; margin-bottom: 15px;">
                    ▶ 🌐 Subdomain Intelligence (${subdomainIntel.total_found || 0} found)
                </h4>
                <div class="collapsible-osint-content">
                    ${subdomainIntel.certificate_transparency?.map(source => `
                        <div class="osint-finding">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="color: #ffa500; font-weight: bold;">Certificate Transparency</span>
                                <span style="color: #32cd32;">${source.count} subdomains</span>
                            </div>
                            <div style="color: #ccc; font-size: 10px;">Source: ${source.source}</div>
                        </div>
                    `).join('') || '<div class="osint-safe">No certificate transparency data found</div>'}
                    
                    ${subdomainIntel.dns_aggregators?.map(source => `
                        <div class="osint-finding">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #32cd32; font-weight: bold;">DNS Aggregator</span>
                                <span style="color: #32cd32;">${source.count} subdomains</span>
                            </div>
                            <div style="color: #ccc; font-size: 10px;">Source: ${source.source}</div>
                        </div>
                    `).join('') || ''}
                </div>
            </div>
        `;
    },

    renderEmailIntelligence(emailIntel) {
        return `
            <div class="osint-category-card">
                <h4 class="collapsible-osint" style="color: #00bfff; margin-bottom: 15px;">
                    ▶ 📧 Email Intelligence (${emailIntel.discovered_emails?.length || 0} found)
                </h4>
                <div class="collapsible-osint-content">
                    ${emailIntel.email_patterns?.length > 0 ? `
                        <div class="osint-finding">
                            <div style="color: #00bfff; font-weight: bold; margin-bottom: 4px;">Email Patterns</div>
                            ${emailIntel.email_patterns.map(pattern => `
                                <div style="color: #ccc; font-size: 10px;">• ${pattern}</div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${emailIntel.discovered_emails?.slice(0, 10).map(email => `
                        <div class="osint-finding">
                            <span style="color: #00bfff; font-weight: bold;">${email}</span>
                        </div>
                    `).join('') || '<div class="osint-safe">No email addresses discovered</div>'}
                    
                    ${emailIntel.email_security ? `
                        <div class="osint-finding">
                            <div style="color: #00bfff; font-weight: bold; margin-bottom: 4px;">Email Security</div>
                            <div style="color: #ccc; font-size: 10px;">
                                SPF: ${emailIntel.email_security.spf ? '✅ Configured' : '❌ Missing'}<br>
                                DMARC: ${emailIntel.email_security.dmarc ? '✅ Configured' : '❌ Missing'}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderEmployeeIntelligence(employeeIntel) {
        return `
            <div class="osint-category-card">
                <h4 class="collapsible-osint" style="color: #ff1493; margin-bottom: 15px;">
                    ▶ 👥 Employee Intelligence (${employeeIntel.total_employees || 0} found)
                </h4>
                <div class="collapsible-osint-content">
                    ${employeeIntel.linkedin_employees?.slice(0, 8).map(employee => `
                        <div class="osint-finding">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #ff1493; font-weight: bold;">${employee.name || 'Unknown'}</span>
                                <span style="color: #666; font-size: 10px;">${employee.position || 'Unknown Position'}</span>
                            </div>
                            <div style="color: #ccc; font-size: 10px;">Source: LinkedIn</div>
                        </div>
                    `).join('') || '<div class="osint-safe">No employee information found</div>'}
                    
                    ${employeeIntel.github_developers?.slice(0, 5).map(dev => `
                        <div class="osint-finding">
                            <span style="color: #333; background: #fff; padding: 2px 6px; border-radius: 3px; font-size: 10px;">GitHub: ${dev.username}</span>
                        </div>
                    `).join('') || ''}
                </div>
            </div>
        `;
    },

    renderSocialMediaIntelligence(socialIntel) {
        return `
            <div class="osint-category-card">
                <h4 class="collapsible-osint" style="color: #ff1493; margin-bottom: 15px;">
                    ▶ 📱 Social Media Intelligence
                </h4>
                <div class="collapsible-osint-content">
                    ${socialIntel.official_accounts?.map(account => `
                        <div class="osint-finding">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #ff1493; font-weight: bold;">Official Account</span>
                                <a href="${account.url}" target="_blank" class="social-platform platform-${account.platform.toLowerCase()}">
                                    ${account.platform}
                                </a>
                            </div>
                            <div style="color: #ccc; font-size: 10px;">@${account.username} - ${account.followers} followers</div>
                        </div>
                    `).join('') || '<div class="osint-safe">No official social media accounts found</div>'}
                    
                    ${socialIntel.leaked_information?.length > 0 ? `
                        <div class="osint-alert">
                            <div style="color: #ff4444; font-weight: bold; margin-bottom: 4px;">🚨 Leaked Information Found</div>
                            ${socialIntel.leaked_information.slice(0, 3).map(leak => `
                                <div style="color: #ffcccc; font-size: 10px;">• ${leak.type}: ${leak.description}</div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderThirdPartyExposure(thirdPartyExposure) {
        return `
            <div class="osint-category-card">
                <h4 class="collapsible-osint" style="color: #ffa500; margin-bottom: 15px;">
                    ▶ 🌐 Third-party Exposure Analysis
                </h4>
                <div class="collapsible-osint-content">
                    ${thirdPartyExposure.code_repositories?.map(repo => `
                        <div class="osint-finding">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #ffa500; font-weight: bold;">Code Repository</span>
                                <span style="color: ${repo.sensitive_data ? '#ff4444' : '#32cd32'};">
                                    ${repo.sensitive_data ? '⚠️ Sensitive' : '✅ Safe'}
                                </span>
                            </div>
                            <div style="color: #ccc; font-size: 10px;">Platform: ${repo.platform} | Repo: ${repo.name}</div>
                        </div>
                    `).join('') || '<div class="osint-safe">No exposed code repositories found</div>'}
                    
                    ${thirdPartyExposure.cloud_storage?.map(storage => `
                        <div class="osint-finding">
                            <div style="color: #ffa500; font-weight: bold;">Cloud Storage Exposure</div>
                            <div style="color: #ccc; font-size: 10px;">Provider: ${storage.provider} | Access: ${storage.access_level}</div>
                        </div>
                    `).join('') || ''}
                </div>
            </div>
        `;
    },

    renderTechnologyIntelligence(techIntel) {
        return `
            <div class="osint-category-card">
                <h4 class="collapsible-osint" style="color: #8a2be2; margin-bottom: 15px;">
                    ▶ 🔧 Technology Intelligence
                </h4>
                <div class="collapsible-osint-content">
                    ${techIntel.web_technologies ? `
                        <div class="osint-finding">
                            <div style="color: #8a2be2; font-weight: bold; margin-bottom: 4px;">Web Technologies</div>
                            ${Object.entries(techIntel.web_technologies).map(([category, techs]) => `
                                <div style="color: #ccc; font-size: 10px; margin-bottom: 2px;">
                                    ${category}: ${Array.isArray(techs) ? techs.join(', ') : techs}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${techIntel.cloud_services?.map(service => `
                        <div class="osint-finding">
                            <div style="color: #8a2be2; font-weight: bold;">Cloud Service</div>
                            <div style="color: #ccc; font-size: 10px;">Provider: ${service.provider} | Service: ${service.service}</div>
                        </div>
                    `).join('') || '<div class="osint-safe">No cloud services detected</div>'}
                </div>
            </div>
        `;
    },

    renderIntelligenceRecommendations(recommendations) {
        return `
            <div class="osint-category-card">
                <h4 style="color: #00ff9f; margin-bottom: 15px;">💡 Intelligence-Based Recommendations</h4>
                ${recommendations.map(rec => `
                    <div style="background: rgba(0, 255, 159, 0.1); border: 1px solid #00ff9f; border-radius: 6px; padding: 12px; margin: 8px 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="color: #00ff9f; font-weight: bold;">${rec.type}</span>
                            <span style="color: ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ffa500' : '#ffff00'}; font-size: 11px; font-weight: bold;">
                                ${rec.priority.toUpperCase()}
                            </span>
                        </div>
                        <div style="color: #ccc; font-size: 12px; margin-bottom: 6px;">${rec.recommendation}</div>
                        ${rec.evidence ? `<div style="color: #666; font-size: 10px;">Evidence: ${rec.evidence}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },

    async stopOperation(operationId) {
        if (confirm('Are you sure you want to stop this OSINT operation?')) {
            try {
                const response = await API.call(`/osint/stop/${operationId}`, {
                    method: 'POST'
                });
                
                if (response && response.ok) {
                    Utils.showMessage('OSINT operation stopped successfully!', 'success');
                    await this.loadOSINTScans();
                }
            } catch (error) {
                Utils.showMessage('Failed to stop operation: ' + error.message, 'error');
            }
        }
    },

    // Real-time updates
    startRealTimeUpdates() {
        console.log('🔄 Starting real-time updates for OSINT');
        
        this.cleanup();
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'osint') {
                try {
                    await this.loadOSINTScans();
                    this.updateLastUpdateTime();
                } catch (error) {
                    console.error('Real-time OSINT update failed:', error);
                }
            }
        }, 5000); // Update every 5 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    updateOSINTStatus(operations) {
        const statusSpan = document.getElementById('osint-status');
        if (!statusSpan) return;
        
        const runningOps = operations.filter(op => op.status === 'running' || op.status === 'pending');
        
        if (runningOps.length > 0) {
            statusSpan.innerHTML = `🔄 ${runningOps.length} OSINT operation${runningOps.length > 1 ? 's' : ''} running`;
            statusSpan.style.color = '#32cd32';
        } else {
            const completedCount = operations.filter(op => op.status === 'completed').length;
            const totalIntel = operations.filter(op => op.status === 'completed').reduce((total, op) => {
                try {
                    const summary = op.results_summary;
                    if (summary) {
                        const data = typeof summary === 'string' ? JSON.parse(summary) : summary;
                        return total + (data.total_intelligence_points || 10);
                    }
                    return total;
                } catch {
                    return total;
                }
            }, 0);
            
            statusSpan.innerHTML = `✅ ${completedCount} operation${completedCount !== 1 ? 's' : ''} completed | 🔍 ${totalIntel} intelligence points gathered`;
            statusSpan.style.color = '#32cd32';
        }
    },

    updateLastUpdateTime() {
        const element = document.getElementById('osint-last-update');
        if (element) {
            element.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('osint-auto-refresh-indicator');
        if (indicator) {
            if (isActive) {
                indicator.innerHTML = '🔄 Auto-updating';
                indicator.style.color = '#32cd32';
            } else {
                indicator.innerHTML = '⏸️ Paused';
                indicator.style.color = '#ffff00';
            }
        }
    },

    toggleAutoRefresh() {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        const toggleBtn = document.getElementById('osint-auto-refresh-toggle');
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
        console.log('🧹 Cleaning up OSINT module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
    }
};

// Make it globally available
window.OSINT = OSINT;
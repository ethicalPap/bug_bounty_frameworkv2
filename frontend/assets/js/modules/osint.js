// frontend/assets/js/modules/osint.js - OSINT Intelligence Gathering

const OSINT = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
    targetsCache: {},
    currentIntelligence: null,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.loadIntelligenceGathering();
        this.startRealTimeUpdates();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .intelligence-category {
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border: 1px solid #9a4dff;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                
                .intelligence-category.critical {
                    border-color: #ff0000;
                    background: linear-gradient(135deg, #2d0000, #4d0000);
                }
                
                .intelligence-category.warning {
                    border-color: #ffff00;
                    background: linear-gradient(135deg, #2d2d00, #4d4d00);
                }
                
                .intelligence-metric {
                    display: inline-block;
                    padding: 4px 8px;
                    margin: 2px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                }
                
                .metric-emails { background: rgba(0, 255, 159, 0.2); color: #00ff9f; }
                .metric-breaches { background: rgba(255, 0, 0, 0.2); color: #ff4444; }
                .metric-subdomains { background: rgba(154, 77, 255, 0.2); color: #9a4dff; }
                .metric-social { background: rgba(255, 255, 0, 0.2); color: #ffff00; }
                .metric-repos { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
                
                .intelligence-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .intel-source-card {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 8px;
                    padding: 15px;
                    transition: all 0.3s;
                    cursor: pointer;
                }
                
                .intel-source-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(154, 77, 255, 0.3);
                }
                
                .intel-source-card.selected {
                    border-color: #00ff9f;
                    background: rgba(0, 255, 159, 0.1);
                }
                
                .breach-alert {
                    background: linear-gradient(135deg, #ff0000, #cc0000);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 10px 0;
                    animation: alertPulse 2s infinite;
                }
                
                @keyframes alertPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
                
                .timeline-item {
                    border-left: 2px solid #9a4dff;
                    padding-left: 15px;
                    margin-bottom: 15px;
                    position: relative;
                }
                
                .timeline-item::before {
                    content: '';
                    position: absolute;
                    left: -6px;
                    top: 0;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #9a4dff;
                }
                
                .timeline-item.critical::before {
                    background: #ff0000;
                }
                
                .timeline-item.warning::before {
                    background: #ffff00;
                }
                
                .collapsible {
                    cursor: pointer;
                    user-select: none;
                }
                
                .collapsible:hover {
                    color: #00ff9f;
                }
                
                .collapsible-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }
                
                .collapsible-content.expanded {
                    max-height: 500px;
                }
                
                .dork-result {
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 5px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                }
                
                .leaked-credential {
                    background: rgba(255, 0, 0, 0.1);
                    border: 1px solid #ff4444;
                    border-radius: 4px;
                    padding: 10px;
                    margin: 5px 0;
                }
                
                .social-account {
                    background: rgba(255, 255, 0, 0.1);
                    border: 1px solid #ffff00;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 5px 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .tech-tag {
                    display: inline-block;
                    padding: 2px 6px;
                    margin: 2px;
                    background: rgba(154, 77, 255, 0.2);
                    border: 1px solid #9a4dff;
                    border-radius: 4px;
                    font-size: 10px;
                }
            </style>

            <div class="scan-info">
                <h4>🕵️ OSINT Intelligence Gathering</h4>
                <p>Comprehensive Open Source Intelligence (OSINT) gathering including email harvesting, breach data analysis, social media reconnaissance, technology detection, and threat intelligence. Gather actionable intelligence about your targets from public sources.</p>
            </div>

            <!-- Intelligence Gathering Controls -->
            <div class="card">
                <div class="card-title">Start Intelligence Gathering</div>
                <div id="osint-messages"></div>
                
                <form id="osint-form">
                    <div class="intelligence-grid">
                        <div class="intel-source-card selected" data-type="comprehensive" onclick="OSINT.selectIntelligenceType('comprehensive')">
                            <h4 style="color: #ff6b6b; margin-bottom: 10px;">🔍 Comprehensive Intelligence</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Complete OSINT gathering across all sources</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Email & Employee Intelligence</div>
                                <div>• Breach & Credential Data</div>
                                <div>• Social Media Reconnaissance</div>
                                <div>• Technology & Infrastructure</div>
                                <div>• Threat Intelligence</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 15-30 minutes</div>
                        </div>
                        
                        <div class="intel-source-card" data-type="breach_analysis" onclick="OSINT.selectIntelligenceType('breach_analysis')">
                            <h4 style="color: #ff0000; margin-bottom: 10px;">💀 Breach Analysis</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Focus on data breaches and credential leaks</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Known data breaches</div>
                                <div>• Leaked credentials</div>
                                <div>• Paste site monitoring</div>
                                <div>• Dark web mentions</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 5-10 minutes</div>
                        </div>
                        
                        <div class="intel-source-card" data-type="social_media" onclick="OSINT.selectIntelligenceType('social_media')">
                            <h4 style="color: #ffff00; margin-bottom: 10px;">📱 Social Media Intel</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Social media and employee reconnaissance</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• LinkedIn employees</div>
                                <div>• Social media accounts</div>
                                <div>• Public mentions</div>
                                <div>• Job postings analysis</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 8-15 minutes</div>
                        </div>
                        
                        <div class="intel-source-card" data-type="technology" onclick="OSINT.selectIntelligenceType('technology')">
                            <h4 style="color: #00ff9f; margin-bottom: 10px;">🔧 Technology Intelligence</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Technology stack and infrastructure analysis</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Technology detection</div>
                                <div>• Cloud services</div>
                                <div>• Third-party integrations</div>
                                <div>• Historical changes</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 5-12 minutes</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end; margin-top: 20px;">
                        <div class="form-group">
                            <label for="osint-target">Target Domain</label>
                            <select id="osint-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-osint-btn">🕵️ Start Intelligence Gathering</button>
                    </div>
                </form>
            </div>

            <!-- Active Intelligence Gathering -->
            <div class="card">
                <div class="card-title">
                    Intelligence Gathering Status
                    <span id="osint-auto-refresh-indicator" style="float: right; font-size: 12px; color: #9a4dff;">🔄 Auto-updating</span>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="OSINT.loadIntelligenceGathering()" class="btn btn-secondary">🔄 Refresh</button>
                    <button onclick="OSINT.toggleAutoRefresh()" class="btn btn-secondary" id="osint-auto-refresh-toggle">⏸️ Pause Auto-refresh</button>
                    <span id="osint-status" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="osint-last-update" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <div id="osint-operations-list">
                    <p style="text-align: center; color: #9a4dff; padding: 20px;">Loading intelligence operations...</p>
                </div>
            </div>

            <!-- Intelligence Dashboard -->
            <div class="card" id="intelligence-dashboard" style="display: none;">
                <div class="card-title">🧠 Intelligence Dashboard</div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #00ff9f;" id="total-emails">0</div>
                        <div style="color: #9a4dff; font-size: 12px;">Emails Found</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #ff4444;" id="total-breaches">0</div>
                        <div style="color: #9a4dff; font-size: 12px;">Data Breaches</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #ffff00;" id="total-employees">0</div>
                        <div style="color: #9a4dff; font-size: 12px;">Employees Found</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #9a4dff;" id="total-technologies">0</div>
                        <div style="color: #9a4dff; font-size: 12px;">Technologies</div>
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
                await this.startIntelligenceGathering();
            });
        }

        // Collapsible sections
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('collapsible')) {
                const content = e.target.nextElementSibling;
                if (content && content.classList.contains('collapsible-content')) {
                    content.classList.toggle('expanded');
                    e.target.textContent = content.classList.contains('expanded') ? 
                        e.target.textContent.replace('▶', '▼') : 
                        e.target.textContent.replace('▼', '▶');
                }
            }
        });
    },

    selectIntelligenceType(type) {
        // Update selected intelligence type
        document.querySelectorAll('.intel-source-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
        this.selectedIntelligenceType = type;
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

    async startIntelligenceGathering() {
        const targetId = document.getElementById('osint-target').value;
        const intelligenceType = this.selectedIntelligenceType || 'comprehensive';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'osint-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-osint-btn', true);
            
            const response = await fetch(`${CONFIG.API_BASE}/osint/gather`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetId: parseInt(targetId),
                    intelligenceType: intelligenceType,
                    enabledSources: this.getEnabledSources(intelligenceType)
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    Utils.showMessage(`${intelligenceType.charAt(0).toUpperCase() + intelligenceType.slice(1)} intelligence gathering started!`, 'success', 'osint-messages');
                    
                    // Reset form
                    document.getElementById('osint-target').value = '';
                    
                    // Refresh operations
                    await this.loadIntelligenceGathering();
                    this.startRealTimeUpdates();
                } else {
                    throw new Error(data.message || 'Unknown error');
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start intelligence gathering');
            }
        } catch (error) {
            Utils.showMessage('Failed to start intelligence gathering: ' + error.message, 'error', 'osint-messages');
        } finally {
            Utils.setButtonLoading('start-osint-btn', false);
        }
    },

    getEnabledSources(intelligenceType) {
        const sourceMap = {
            'comprehensive': ['email', 'breach', 'social_media', 'technology', 'threat_intel'],
            'breach_analysis': ['breach', 'paste_sites', 'dark_web'],
            'social_media': ['social_media', 'employees', 'linkedin'],
            'technology': ['technology', 'cloud_services', 'third_party']
        };
        
        return sourceMap[intelligenceType] || sourceMap['comprehensive'];
    },

    async loadIntelligenceGathering() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/osint/operations`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const operations = data.success ? data.data : [];
                
                this.renderOperations(operations);
                this.updateOSINTStatus(operations);
                
                // Show latest completed intelligence
                const latestCompleted = operations.find(op => op.status === 'completed');
                if (latestCompleted) {
                    await this.loadLatestIntelligence(latestCompleted);
                }
            }
        } catch (error) {
            console.error('Failed to load intelligence operations:', error);
            document.getElementById('osint-operations-list').innerHTML = 
                '<p style="text-align: center; color: #ff0000; padding: 20px;">Failed to load intelligence operations</p>';
        }
    },

    renderOperations(operations) {
        const container = document.getElementById('osint-operations-list');
        
        if (operations.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #9a4dff; padding: 20px;">No intelligence gathering operations yet. Start your first intelligence gathering above!</p>';
            return;
        }
        
        container.innerHTML = operations.map(operation => {
            const target = this.targetsCache[operation.target_id];
            const targetName = target ? target.domain : `Target ${operation.target_id}`;
            const isRunning = operation.status === 'running' || operation.status === 'pending';
            
            return `
                <div class="intelligence-category ${isRunning ? 'running' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <h4 style="color: #00ff9f; margin-bottom: 5px;">🕵️ ${targetName}</h4>
                            <div style="font-size: 12px; color: #9a4dff;">
                                Operation ID: ${operation.id} | Type: ${operation.intelligence_type || 'comprehensive'}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                Started: ${new Date(operation.started_at || operation.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="status status-${operation.status}">${operation.status.toUpperCase()}</span>
                            <div style="margin-top: 5px;">
                                ${operation.status === 'completed' ? 
                                    `<button onclick="OSINT.viewIntelligence(${operation.id})" class="btn btn-primary btn-small">🧠 View Intelligence</button>` :
                                    operation.status === 'running' ?
                                    `<button onclick="OSINT.stopOperation(${operation.id})" class="btn btn-danger btn-small">⏹️ Stop</button>` :
                                    ''
                                }
                            </div>
                        </div>
                    </div>
                    
                    ${this.renderOperationProgress(operation)}
                    
                    ${operation.status === 'completed' && operation.results ? 
                        this.renderOperationSummary(operation.results) : ''
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
                    <span style="font-size: 12px; color: #9a4dff;">Progress: ${progress}%</span>
                    <span style="font-size: 11px; color: #666;">${operation.current_phase || 'Processing...'}</span>
                </div>
                
                <div style="background-color: #2d1b69; height: 6px; border-radius: 3px;">
                    <div style="background: linear-gradient(90deg, #9a4dff, #00ff9f); height: 100%; width: ${progress}%; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    },

    renderOperationSummary(results) {
        const summary = typeof results === 'string' ? JSON.parse(results) : results;
        
        const emailCount = summary.email_intelligence?.discovered_emails?.length || 0;
        const breachCount = summary.breach_intelligence?.known_breaches?.length || 0;
        const employeeCount = summary.employee_intelligence?.linkedin_employees?.length || 0;
        const techCount = Object.keys(summary.technology_intelligence?.technologies || {}).length;
        
        return `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #9a4dff;">
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${emailCount > 0 ? `<span class="intelligence-metric metric-emails">${emailCount} Emails</span>` : ''}
                    ${breachCount > 0 ? `<span class="intelligence-metric metric-breaches">${breachCount} Breaches</span>` : ''}
                    ${employeeCount > 0 ? `<span class="intelligence-metric metric-social">${employeeCount} Employees</span>` : ''}
                    ${techCount > 0 ? `<span class="intelligence-metric metric-subdomains">${techCount} Technologies</span>` : ''}
                </div>
                
                ${summary.breach_intelligence?.leaked_credentials?.length > 0 ? 
                    `<div class="breach-alert" style="margin-top: 10px;">
                        🚨 CRITICAL: ${summary.breach_intelligence.leaked_credentials.length} leaked credentials found!
                    </div>` : ''
                }
            </div>
        `;
    },

    async viewIntelligence(operationId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/osint/intelligence/${operationId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
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

    displayIntelligenceDashboard(intelligence) {
        const dashboard = document.getElementById('intelligence-dashboard');
        const data = typeof intelligence === 'string' ? JSON.parse(intelligence) : intelligence;
        
        // Update metrics
        document.getElementById('total-emails').textContent = data.email_intelligence?.discovered_emails?.length || 0;
        document.getElementById('total-breaches').textContent = data.breach_intelligence?.known_breaches?.length || 0;
        document.getElementById('total-employees').textContent = data.employee_intelligence?.linkedin_employees?.length || 0;
        document.getElementById('total-technologies').textContent = Object.keys(data.technology_intelligence?.technologies || {}).length;
        
        // Render intelligence content
        const content = document.getElementById('intelligence-content');
        content.innerHTML = this.renderIntelligenceContent(data);
        
        dashboard.style.display = 'block';
    },

    renderIntelligenceContent(data) {
        let content = '';
        
        // Critical findings first
        const criticalFindings = this.extractCriticalFindings(data);
        if (criticalFindings.length > 0) {
            content += `
                <div class="intelligence-category critical">
                    <h4 style="color: #ff0000; margin-bottom: 15px;">🚨 Critical Intelligence Findings</h4>
                    ${criticalFindings.map(finding => `
                        <div style="margin-bottom: 10px;">
                            <strong style="color: #ff4444;">${finding.type}:</strong> ${finding.description}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Breach Intelligence
        if (data.breach_intelligence) {
            content += this.renderBreachIntelligence(data.breach_intelligence);
        }
        
        // Email Intelligence
        if (data.email_intelligence) {
            content += this.renderEmailIntelligence(data.email_intelligence);
        }
        
        // Employee Intelligence
        if (data.employee_intelligence) {
            content += this.renderEmployeeIntelligence(data.employee_intelligence);
        }
        
        // Technology Intelligence
        if (data.technology_intelligence) {
            content += this.renderTechnologyIntelligence(data.technology_intelligence);
        }
        
        // Social Media Intelligence
        if (data.social_media_intelligence) {
            content += this.renderSocialMediaIntelligence(data.social_media_intelligence);
        }
        
        return content;
    },

    extractCriticalFindings(data) {
        const findings = [];
        
        // Check for leaked credentials
        if (data.breach_intelligence?.leaked_credentials?.length > 0) {
            findings.push({
                type: 'Credential Leaks',
                description: `${data.breach_intelligence.leaked_credentials.length} leaked credentials found in data breaches`
            });
        }
        
        // Check for exposed repositories
        if (data.third_party_exposure?.code_repositories?.length > 0) {
            findings.push({
                type: 'Code Exposure',
                description: `${data.third_party_exposure.code_repositories.length} potentially sensitive code repositories found`
            });
        }
        
        // Check for Google dorking results with credentials
        if (data.google_dorking_results?.credentials?.length > 0) {
            findings.push({
                type: 'Exposed Credentials',
                description: `Sensitive information found via Google dorking including potential credentials`
            });
        }
        
        return findings;
    },

    renderBreachIntelligence(breachData) {
        let content = `
            <div class="intelligence-category">
                <h4 class="collapsible" style="color: #ff4444; cursor: pointer;">▶ 💀 Data Breach Intelligence</h4>
                <div class="collapsible-content">
        `;
        
        if (breachData.known_breaches?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #ff6b6b;">Known Data Breaches (${breachData.known_breaches.length})</h5>
                    ${breachData.known_breaches.map(breach => `
                        <div class="timeline-item critical">
                            <strong>${breach.name || 'Unknown Breach'}</strong><br>
                            <small style="color: #9a4dff;">Date: ${breach.date || 'Unknown'} | Records: ${breach.records || 'Unknown'}</small>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (breachData.leaked_credentials?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #ff0000;">⚠️ Leaked Credentials (${breachData.leaked_credentials.length})</h5>
                    ${breachData.leaked_credentials.slice(0, 5).map(cred => `
                        <div class="leaked-credential">
                            <div style="font-family: 'Courier New', monospace; font-size: 12px;">
                                ${cred.email || cred.username || 'Unknown User'}
                            </div>
                            <div style="font-size: 11px; color: #9a4dff; margin-top: 2px;">
                                Source: ${cred.source || 'Unknown'} | Date: ${cred.date || 'Unknown'}
                            </div>
                        </div>
                    `).join('')}
                    ${breachData.leaked_credentials.length > 5 ? `<div style="text-align: center; color: #9a4dff; margin-top: 10px;">... and ${breachData.leaked_credentials.length - 5} more</div>` : ''}
                </div>
            `;
        }
        
        content += '</div></div>';
        return content;
    },

    renderEmailIntelligence(emailData) {
        let content = `
            <div class="intelligence-category">
                <h4 class="collapsible" style="color: #00ff9f; cursor: pointer;">▶ 📧 Email Intelligence</h4>
                <div class="collapsible-content">
        `;
        
        if (emailData.email_patterns?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #00ff9f;">Email Patterns</h5>
                    ${emailData.email_patterns.map(pattern => `
                        <div class="tech-tag">${pattern}</div>
                    `).join('')}
                </div>
            `;
        }
        
        if (emailData.discovered_emails?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #00ff9f;">Discovered Emails (${emailData.discovered_emails.length})</h5>
                    ${emailData.discovered_emails.slice(0, 10).map(email => `
                        <div style="font-family: 'Courier New', monospace; font-size: 12px; margin: 2px 0; color: #9a4dff;">
                            ${email}
                        </div>
                    `).join('')}
                    ${emailData.discovered_emails.length > 10 ? `<div style="text-align: center; color: #9a4dff; margin-top: 10px;">... and ${emailData.discovered_emails.length - 10} more</div>` : ''}
                </div>
            `;
        }
        
        if (emailData.domain_mx_records?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #00ff9f;">MX Records</h5>
                    ${emailData.domain_mx_records.map(mx => `
                        <div style="font-family: 'Courier New', monospace; font-size: 12px; margin: 2px 0;">
                            ${mx.priority}: ${mx.server}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        content += '</div></div>';
        return content;
    },

    renderEmployeeIntelligence(employeeData) {
        let content = `
            <div class="intelligence-category">
                <h4 class="collapsible" style="color: #ffff00; cursor: pointer;">▶ 👥 Employee Intelligence</h4>
                <div class="collapsible-content">
        `;
        
        if (employeeData.linkedin_employees?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #ffff00;">LinkedIn Employees (${employeeData.linkedin_employees.length})</h5>
                    ${employeeData.linkedin_employees.slice(0, 5).map(employee => `
                        <div class="social-account">
                            <div>💼</div>
                            <div>
                                <div style="font-weight: bold;">${employee.name || 'Unknown'}</div>
                                <div style="font-size: 11px; color: #9a4dff;">${employee.position || 'Unknown Position'}</div>
                            </div>
                        </div>
                    `).join('')}
                    ${employeeData.linkedin_employees.length > 5 ? `<div style="text-align: center; color: #9a4dff; margin-top: 10px;">... and ${employeeData.linkedin_employees.length - 5} more</div>` : ''}
                </div>
            `;
        }
        
        if (employeeData.github_developers?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #ffff00;">GitHub Developers (${employeeData.github_developers.length})</h5>
                    ${employeeData.github_developers.slice(0, 5).map(dev => `
                        <div class="social-account">
                            <div>💻</div>
                            <div>
                                <div style="font-weight: bold;">${dev.username || 'Unknown'}</div>
                                <div style="font-size: 11px; color: #9a4dff;">Repositories: ${dev.repositories || 0}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        content += '</div></div>';
        return content;
    },

    renderTechnologyIntelligence(techData) {
        let content = `
            <div class="intelligence-category">
                <h4 class="collapsible" style="color: #9a4dff; cursor: pointer;">▶ 🔧 Technology Intelligence</h4>
                <div class="collapsible-content">
        `;
        
        if (techData.technologies) {
            Object.entries(techData.technologies).forEach(([category, techs]) => {
                if (techs && techs.length > 0) {
                    content += `
                        <div style="margin: 10px 0;">
                            <h5 style="color: #9a4dff;">${category.charAt(0).toUpperCase() + category.slice(1)} (${techs.length})</h5>
                            ${techs.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                        </div>
                    `;
                }
            });
        }
        
        if (techData.cloud_services?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #9a4dff;">Cloud Services</h5>
                    ${techData.cloud_services.map(service => `<span class="tech-tag">☁️ ${service}</span>`).join('')}
                </div>
            `;
        }
        
        content += '</div></div>';
        return content;
    },

    renderSocialMediaIntelligence(socialData) {
        let content = `
            <div class="intelligence-category">
                <h4 class="collapsible" style="color: #ff6b6b; cursor: pointer;">▶ 📱 Social Media Intelligence</h4>
                <div class="collapsible-content">
        `;
        
        if (socialData.official_accounts?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #ff6b6b;">Official Social Media Accounts</h5>
                    ${socialData.official_accounts.map(account => `
                        <div class="social-account">
                            <div>🔗</div>
                            <div>
                                <div style="font-weight: bold;">${account.platform}</div>
                                <div style="font-size: 11px; color: #9a4dff;">${account.url || account.username}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (socialData.mentions?.length > 0) {
            content += `
                <div style="margin: 10px 0;">
                    <h5 style="color: #ff6b6b;">Recent Mentions (${socialData.mentions.length})</h5>
                    ${socialData.mentions.slice(0, 3).map(mention => `
                        <div class="timeline-item">
                            <div style="font-size: 13px;">${mention.content || mention.text}</div>
                            <div style="font-size: 11px; color: #9a4dff; margin-top: 2px;">
                                ${mention.platform} | ${mention.date || 'Unknown date'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        content += '</div></div>';
        return content;
    },

    async stopOperation(operationId) {
        if (confirm('Are you sure you want to stop this intelligence gathering operation?')) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/osint/stop/${operationId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response && response.ok) {
                    Utils.showMessage('Intelligence gathering stopped successfully!', 'success');
                    await this.loadIntelligenceGathering();
                }
            } catch (error) {
                Utils.showMessage('Failed to stop operation: ' + error.message, 'error');
            }
        }
    },

    // Real-time updates
    startRealTimeUpdates() {
        console.log('🔄 Starting real-time updates for OSINT operations');
        
        this.cleanup();
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'osint') {
                try {
                    await this.loadIntelligenceGathering();
                    this.updateLastUpdateTime();
                } catch (error) {
                    console.error('Real-time OSINT update failed:', error);
                }
            }
        }, 10000); // Update every 10 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    updateOSINTStatus(operations) {
        const statusSpan = document.getElementById('osint-status');
        if (!statusSpan) return;
        
        const runningOperations = operations.filter(op => op.status === 'running' || op.status === 'pending');
        
        if (runningOperations.length > 0) {
            statusSpan.innerHTML = `🔄 ${runningOperations.length} intelligence operation${runningOperations.length > 1 ? 's' : ''} running`;
            statusSpan.style.color = '#00ff9f';
        } else {
            const completedCount = operations.filter(op => op.status === 'completed').length;
            statusSpan.innerHTML = `✅ ${completedCount} operation${completedCount !== 1 ? 's' : ''} completed`;
            statusSpan.style.color = '#9a4dff';
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
                indicator.style.color = '#9a4dff';
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
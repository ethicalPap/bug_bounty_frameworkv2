// frontend/assets/js/modules/technology-detection.js - Advanced Technology Stack Detection

const TechnologyDetection = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
    targetsCache: {},
    subdomainsCache: {},

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.loadTechnologyScans();
        this.startRealTimeUpdates();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .tech-category-card {
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border: 1px solid #9a4dff;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                
                .tech-item {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 6px;
                    padding: 10px;
                    margin: 8px 0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                .tech-tag {
                    display: inline-block;
                    padding: 2px 6px;
                    margin: 2px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                }
                
                .tech-frameworks { background: rgba(154, 77, 255, 0.2); color: #9a4dff; }
                .tech-cms { background: rgba(0, 255, 159, 0.2); color: #00ff9f; }
                .tech-databases { background: rgba(255, 107, 107, 0.2); color: #ff6b6b; }
                .tech-security { background: rgba(255, 255, 0, 0.2); color: #ffff00; }
                .tech-languages { background: rgba(255, 165, 0, 0.2); color: #ffa500; }
                .tech-servers { background: rgba(0, 191, 255, 0.2); color: #00bfff; }
                .tech-cdn { background: rgba(50, 205, 50, 0.2); color: #32cd32; }
                
                .vulnerability-alert {
                    background: linear-gradient(135deg, #ff0000, #cc0000);
                    color: white;
                    padding: 10px;
                    border-radius: 6px;
                    margin: 8px 0;
                    animation: alertPulse 2s infinite;
                }
                
                @keyframes alertPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.8; }
                }
                
                .tech-recommendation {
                    background: rgba(0, 255, 159, 0.1);
                    border: 1px solid #00ff9f;
                    border-radius: 6px;
                    padding: 12px;
                    margin: 8px 0;
                }
                
                .subdomain-tech-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .subdomain-card {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 8px;
                    padding: 15px;
                }
                
                .tech-detection-mode {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin: 10px 0;
                }
                
                .tech-detection-mode:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(154, 77, 255, 0.3);
                }
                
                .tech-detection-mode.selected {
                    border-color: #00ff9f;
                    background: rgba(0, 255, 159, 0.1);
                }
                
                .tech-version-info {
                    font-size: 10px;
                    color: #9a4dff;
                    margin-top: 2px;
                }
                
                .security-concern {
                    background: rgba(255, 165, 0, 0.1);
                    border: 1px solid #ffa500;
                    border-radius: 4px;
                    padding: 8px;
                    margin: 5px 0;
                    font-size: 12px;
                }
                
                .cve-reference {
                    background: rgba(255, 0, 0, 0.1);
                    border: 1px solid #ff4444;
                    border-radius: 4px;
                    padding: 6px;
                    margin: 4px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 11px;
                }
                
                .collapsible-tech {
                    cursor: pointer;
                    user-select: none;
                }
                
                .collapsible-tech:hover {
                    color: #00ff9f;
                }
                
                .collapsible-tech-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                }
                
                .collapsible-tech-content.expanded {
                    max-height: 1000px;
                }
            </style>

            <div class="scan-info">
                <h4>🔧 Technology Stack Detection</h4>
                <p>Advanced technology detection and fingerprinting to identify web frameworks, CMS platforms, databases, security products, and more. Includes vulnerability analysis for detected technologies and security recommendations.</p>
            </div>

            <!-- Technology Detection Controls -->
            <div class="card">
                <div class="card-title">Start Technology Detection</div>
                <div id="tech-detection-messages"></div>
                
                <form id="tech-detection-form">
                    <div class="subdomain-tech-grid">
                        <div class="tech-detection-mode selected" data-type="comprehensive" onclick="TechnologyDetection.selectDetectionMode('comprehensive')">
                            <h4 style="color: #ff6b6b; margin-bottom: 10px;">🎯 Comprehensive Detection</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Complete technology stack analysis</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• All subdomains analysis</div>
                                <div>• Framework & CMS detection</div>
                                <div>• Database fingerprinting</div>
                                <div>• Security product identification</div>
                                <div>• Vulnerability analysis</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 10-20 minutes</div>
                        </div>
                        
                        <div class="tech-detection-mode" data-type="quick" onclick="TechnologyDetection.selectDetectionMode('quick')">
                            <h4 style="color: #00ff9f; margin-bottom: 10px;">⚡ Quick Detection</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Fast technology identification</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Header-based detection</div>
                                <div>• Common frameworks</div>
                                <div>• Basic CMS identification</div>
                                <div>• Server detection</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 3-8 minutes</div>
                        </div>
                        
                        <div class="tech-detection-mode" data-type="security_focused" onclick="TechnologyDetection.selectDetectionMode('security_focused')">
                            <h4 style="color: #ffff00; margin-bottom: 10px;">🛡️ Security Focused</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Focus on security-related technologies</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• WAF detection</div>
                                <div>• CDN identification</div>
                                <div>• Security headers analysis</div>
                                <div>• Vulnerability scanning</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 5-12 minutes</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 20px; align-items: end; margin-top: 20px;">
                        <div class="form-group">
                            <label for="tech-detection-target">Target Domain</label>
                            <select id="tech-detection-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="tech-detection-subdomain">Subdomain Scope</label>
                            <select id="tech-detection-subdomain">
                                <option value="">All subdomains</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-tech-detection-btn">🔧 Start Detection</button>
                    </div>
                </form>
            </div>

            <!-- Active Technology Scans -->
            <div class="card">
                <div class="card-title">
                    Technology Detection Scans
                    <span id="tech-auto-refresh-indicator" style="float: right; font-size: 12px; color: #9a4dff;">🔄 Auto-updating</span>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="TechnologyDetection.loadTechnologyScans()" class="btn btn-secondary">🔄 Refresh</button>
                    <button onclick="TechnologyDetection.toggleAutoRefresh()" class="btn btn-secondary" id="tech-auto-refresh-toggle">⏸️ Pause Auto-refresh</button>
                    <span id="tech-scan-status" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="tech-last-update" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <div id="tech-scans-list">
                    <p style="text-align: center; color: #9a4dff; padding: 20px;">Loading technology detection scans...</p>
                </div>
            </div>

            <!-- Technology Stack Dashboard -->
            <div class="card" id="tech-stack-dashboard" style="display: none;">
                <div class="card-title">🔧 Technology Stack Analysis</div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #9a4dff;" id="total-frameworks">0</div>
                        <div style="color: #9a4dff; font-size: 11px;">Frameworks</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #00ff9f;" id="total-cms">0</div>
                        <div style="color: #9a4dff; font-size: 11px;">CMS Platforms</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ff6b6b;" id="total-databases">0</div>
                        <div style="color: #9a4dff; font-size: 11px;">Databases</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ffff00;" id="total-security">0</div>
                        <div style="color: #9a4dff; font-size: 11px;">Security Products</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ffa500;" id="total-languages">0</div>
                        <div style="color: #9a4dff; font-size: 11px;">Languages</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #ff4444;" id="total-vulnerabilities">0</div>
                        <div style="color: #9a4dff; font-size: 11px;">CVEs Found</div>
                    </div>
                </div>
                
                <div id="tech-stack-content">
                    <!-- Technology stack content will be rendered here -->
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Technology detection form submission
        const techForm = document.getElementById('tech-detection-form');
        if (techForm) {
            techForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startTechnologyDetection();
            });
        }

        // Target selection change to load subdomains
        const targetSelect = document.getElementById('tech-detection-target');
        if (targetSelect) {
            targetSelect.addEventListener('change', async (e) => {
                await this.loadSubdomains(e.target.value);
            });
        }

        // Collapsible sections
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('collapsible-tech')) {
                const content = e.target.nextElementSibling;
                if (content && content.classList.contains('collapsible-tech-content')) {
                    content.classList.toggle('expanded');
                    e.target.textContent = content.classList.contains('expanded') ? 
                        e.target.textContent.replace('▶', '▼') : 
                        e.target.textContent.replace('▼', '▶');
                }
            }
        });
    },

    selectDetectionMode(mode) {
        // Update selected detection mode
        document.querySelectorAll('.tech-detection-mode').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${mode}"]`).classList.add('selected');
        this.selectedDetectionMode = mode;
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
            
            const targetSelect = document.getElementById('tech-detection-target');
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
        const subdomainSelect = document.getElementById('tech-detection-subdomain');
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
        const subdomainSelect = document.getElementById('tech-detection-subdomain');
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

    async startTechnologyDetection() {
        const targetId = document.getElementById('tech-detection-target').value;
        const subdomainId = document.getElementById('tech-detection-subdomain').value;
        const detectionMode = this.selectedDetectionMode || 'comprehensive';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'tech-detection-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-tech-detection-btn', true);
            
            const config = {
                detection_mode: detectionMode,
                subdomain_id: subdomainId || null,
                include_vulnerability_analysis: detectionMode !== 'quick',
                include_version_detection: detectionMode === 'comprehensive',
                include_security_analysis: detectionMode === 'comprehensive' || detectionMode === 'security_focused',
                deep_fingerprinting: detectionMode === 'comprehensive'
            };
            
            const response = await fetch(`${CONFIG.API_BASE}/technology-detection/start`, {
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
                    Utils.showMessage(`${detectionMode.charAt(0).toUpperCase() + detectionMode.slice(1)} technology detection started for ${scopeText}!`, 'success', 'tech-detection-messages');
                    
                    // Reset form
                    document.getElementById('tech-detection-target').value = '';
                    document.getElementById('tech-detection-subdomain').innerHTML = '<option value="">All subdomains</option>';
                    
                    // Refresh scans
                    await this.loadTechnologyScans();
                    this.startRealTimeUpdates();
                } else {
                    throw new Error(data.message || 'Unknown error');
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start technology detection');
            }
        } catch (error) {
            Utils.showMessage('Failed to start technology detection: ' + error.message, 'error', 'tech-detection-messages');
        } finally {
            Utils.setButtonLoading('start-tech-detection-btn', false);
        }
    },

    async loadTechnologyScans() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/technology-detection/scans`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const scans = data.success ? data.data : [];
                
                this.renderTechnologyScans(scans);
                this.updateTechScanStatus(scans);
                
                // Show latest completed technology stack
                const latestCompleted = scans.find(scan => scan.status === 'completed');
                if (latestCompleted) {
                    await this.loadLatestTechStack(latestCompleted);
                }
            }
        } catch (error) {
            console.error('Failed to load technology scans:', error);
            document.getElementById('tech-scans-list').innerHTML = 
                '<p style="text-align: center; color: #ff0000; padding: 20px;">Failed to load technology detection scans</p>';
        }
    },

    renderTechnologyScans(scans) {
        const container = document.getElementById('tech-scans-list');
        
        if (scans.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #9a4dff; padding: 20px;">No technology detection scans yet. Start your first scan above!</p>';
            return;
        }
        
        container.innerHTML = scans.map(scan => {
            const target = this.targetsCache[scan.target_id];
            const targetName = target ? target.domain : `Target ${scan.target_id}`;
            const isRunning = scan.status === 'running' || scan.status === 'pending';
            
            return `
                <div class="tech-category-card ${isRunning ? 'running' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <h4 style="color: #00ff9f; margin-bottom: 5px;">🔧 ${targetName}</h4>
                            <div style="font-size: 12px; color: #9a4dff;">
                                Scan ID: ${scan.id} | Mode: ${scan.detection_mode || 'comprehensive'}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                Started: ${new Date(scan.started_at || scan.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="status status-${scan.status}">${scan.status.toUpperCase()}</span>
                            <div style="margin-top: 5px;">
                                ${scan.status === 'completed' ? 
                                    `<button onclick="TechnologyDetection.viewTechStack(${scan.id})" class="btn btn-primary btn-small">🔧 View Tech Stack</button>` :
                                    scan.status === 'running' ?
                                    `<button onclick="TechnologyDetection.stopScan(${scan.id})" class="btn btn-danger btn-small">⏹️ Stop</button>` :
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
                    <span style="font-size: 11px; color: #666;">${scan.current_phase || 'Analyzing technologies...'}</span>
                </div>
                
                <div style="background-color: #2d1b69; height: 6px; border-radius: 3px;">
                    <div style="background: linear-gradient(90deg, #9a4dff, #00ff9f); height: 100%; width: ${progress}%; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    },

    renderScanSummary(results) {
        const summary = typeof results === 'string' ? JSON.parse(results) : results;
        
        const techCounts = {
            frameworks: summary.technologies?.frameworks?.length || 0,
            cms: summary.technologies?.cms?.length || 0,
            databases: summary.technologies?.databases?.length || 0,
            security: summary.technologies?.security?.length || 0,
            languages: summary.technologies?.languages?.length || 0
        };
        
        const vulnCount = summary.vulnerabilities?.length || 0;
        
        return `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #9a4dff;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                    ${techCounts.frameworks > 0 ? `<span class="tech-tag tech-frameworks">${techCounts.frameworks} Frameworks</span>` : ''}
                    ${techCounts.cms > 0 ? `<span class="tech-tag tech-cms">${techCounts.cms} CMS</span>` : ''}
                    ${techCounts.databases > 0 ? `<span class="tech-tag tech-databases">${techCounts.databases} Databases</span>` : ''}
                    ${techCounts.security > 0 ? `<span class="tech-tag tech-security">${techCounts.security} Security</span>` : ''}
                    ${techCounts.languages > 0 ? `<span class="tech-tag tech-languages">${techCounts.languages} Languages</span>` : ''}
                </div>
                
                ${vulnCount > 0 ? 
                    `<div class="vulnerability-alert">
                        ⚠️ ${vulnCount} potential vulnerabilities found in detected technologies!
                    </div>` : 
                    `<div style="color: #00ff9f; font-size: 12px;">✅ No known vulnerabilities detected</div>`
                }
            </div>
        `;
    },

    async viewTechStack(scanId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/technology-detection/results/${scanId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.displayTechStackDashboard(data.data);
                }
            }
        } catch (error) {
            console.error('Failed to load tech stack:', error);
            Utils.showMessage('Failed to load technology stack data', 'error');
        }
    },

    async loadLatestTechStack(scan) {
        if (scan.results) {
            this.displayTechStackDashboard(scan.results);
        }
    },

    displayTechStackDashboard(techData) {
        const dashboard = document.getElementById('tech-stack-dashboard');
        const data = typeof techData === 'string' ? JSON.parse(techData) : techData;
        
        // Update metrics
        const technologies = data.technologies || {};
        document.getElementById('total-frameworks').textContent = technologies.frameworks?.length || 0;
        document.getElementById('total-cms').textContent = technologies.cms?.length || 0;
        document.getElementById('total-databases').textContent = technologies.databases?.length || 0;
        document.getElementById('total-security').textContent = technologies.security?.length || 0;
        document.getElementById('total-languages').textContent = technologies.languages?.length || 0;
        document.getElementById('total-vulnerabilities').textContent = data.vulnerabilities?.length || 0;
        
        // Render tech stack content
        const content = document.getElementById('tech-stack-content');
        content.innerHTML = this.renderTechStackContent(data);
        
        dashboard.style.display = 'block';
    },

    renderTechStackContent(data) {
        let content = '';
        
        // Critical vulnerabilities first
        if (data.vulnerabilities && data.vulnerabilities.length > 0) {
            const criticalVulns = data.vulnerabilities.filter(v => v.severity === 'critical');
            if (criticalVulns.length > 0) {
                content += `
                    <div class="tech-category-card" style="border-color: #ff0000;">
                        <h4 style="color: #ff0000; margin-bottom: 15px;">🚨 Critical Technology Vulnerabilities</h4>
                        ${criticalVulns.map(vuln => `
                            <div class="vulnerability-alert">
                                <strong>${vuln.technology}:</strong> ${vuln.vulnerability}
                                <div style="font-size: 11px; margin-top: 4px;">
                                    ${vuln.cve_references?.map(cve => `<span class="cve-reference">${cve}</span>`).join(' ') || ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
        }
        
        // Technology categories
        if (data.technologies) {
            Object.entries(data.technologies).forEach(([category, techs]) => {
                if (techs && techs.length > 0) {
                    content += this.renderTechnologyCategory(category, techs, data);
                }
            });
        }
        
        // Subdomain-specific tech
        if (data.subdomain_tech) {
            content += this.renderSubdomainTech(data.subdomain_tech);
        }
        
        // Security recommendations
        if (data.recommendations && data.recommendations.length > 0) {
            content += this.renderSecurityRecommendations(data.recommendations);
        }
        
        return content;
    },

    renderTechnologyCategory(category, technologies, fullData) {
        const categoryIcons = {
            frameworks: '🏗️',
            cms: '📝',
            databases: '🗄️',
            security: '🛡️',
            languages: '💻',
            servers: '🖥️',
            cdn: '🌐'
        };
        
        const categoryColors = {
            frameworks: '#9a4dff',
            cms: '#00ff9f',
            databases: '#ff6b6b',
            security: '#ffff00',
            languages: '#ffa500',
            servers: '#00bfff',
            cdn: '#32cd32'
        };
        
        const icon = categoryIcons[category] || '🔧';
        const color = categoryColors[category] || '#9a4dff';
        
        return `
            <div class="tech-category-card">
                <h4 class="collapsible-tech" style="color: ${color}; margin-bottom: 15px;">
                    ▶ ${icon} ${category.charAt(0).toUpperCase() + category.slice(1)} (${technologies.length})
                </h4>
                <div class="collapsible-tech-content">
                    ${technologies.map(tech => {
                        const techVulns = fullData.vulnerabilities?.filter(v => v.technology === tech) || [];
                        return `
                            <div class="tech-item">
                                <div>
                                    <span class="tech-tag tech-${category}">${tech}</span>
                                    ${techVulns.length > 0 ? 
                                        `<span style="margin-left: 8px; color: #ff4444; font-size: 11px;">⚠️ ${techVulns.length} issue${techVulns.length > 1 ? 's' : ''}</span>` : 
                                        `<span style="margin-left: 8px; color: #00ff9f; font-size: 11px;">✅ No issues</span>`
                                    }
                                    ${this.getTechVersionInfo(tech, category)}
                                </div>
                                ${techVulns.length > 0 ? 
                                    `<div style="font-size: 11px; color: #ff4444;">
                                        ${techVulns.map(v => v.vulnerability).join(', ')}
                                    </div>` : ''
                                }
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    getTechVersionInfo(tech, category) {
        // This would be populated from actual version detection
        const versionMap = {
            'WordPress': 'v6.3.1',
            'Laravel': 'v10.x',
            'React': 'v18.x',
            'jQuery': 'v3.6.0',
            'PHP': 'v8.1',
            'MySQL': 'v8.0'
        };
        
        const version = versionMap[tech];
        return version ? `<div class="tech-version-info">Version: ${version}</div>` : '';
    },

    renderSubdomainTech(subdomainTech) {
        return `
            <div class="tech-category-card">
                <h4 class="collapsible-tech" style="color: #9a4dff; margin-bottom: 15px;">
                    ▶ 🌐 Subdomain Technology Breakdown
                </h4>
                <div class="collapsible-tech-content">
                    <div class="subdomain-tech-grid">
                        ${Object.entries(subdomainTech).slice(0, 6).map(([subdomain, techStack]) => `
                            <div class="subdomain-card">
                                <h5 style="color: #00ff9f; margin-bottom: 10px;">${subdomain}</h5>
                                ${Object.entries(techStack).map(([category, techs]) => {
                                    if (techs.length === 0) return '';
                                    return `
                                        <div style="margin: 5px 0;">
                                            <div style="font-size: 11px; color: #9a4dff; margin-bottom: 2px;">${category}:</div>
                                            ${techs.map(tech => `<span class="tech-tag tech-${category}">${tech}</span>`).join('')}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    renderSecurityRecommendations(recommendations) {
        return `
            <div class="tech-category-card">
                <h4 style="color: #00ff9f; margin-bottom: 15px;">💡 Security Recommendations</h4>
                ${recommendations.map(rec => `
                    <div class="tech-recommendation">
                        <h5 style="color: #00ff9f; margin-bottom: 8px;">${rec.type}</h5>
                        <div style="font-size: 12px; color: #9a4dff; margin-bottom: 5px;">Priority: ${rec.priority}</div>
                        <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
                            ${rec.recommendations.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        `;
    },

    async stopScan(scanId) {
        if (confirm('Are you sure you want to stop this technology detection scan?')) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/technology-detection/stop/${scanId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response && response.ok) {
                    Utils.showMessage('Technology detection scan stopped successfully!', 'success');
                    await this.loadTechnologyScans();
                }
            } catch (error) {
                Utils.showMessage('Failed to stop scan: ' + error.message, 'error');
            }
        }
    },

    // Real-time updates
    startRealTimeUpdates() {
        console.log('🔄 Starting real-time updates for technology detection');
        
        this.cleanup();
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'technology-detection') {
                try {
                    await this.loadTechnologyScans();
                    this.updateLastUpdateTime();
                } catch (error) {
                    console.error('Real-time technology detection update failed:', error);
                }
            }
        }, 5000); // Update every 5 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    updateTechScanStatus(scans) {
        const statusSpan = document.getElementById('tech-scan-status');
        if (!statusSpan) return;
        
        const runningScans = scans.filter(scan => scan.status === 'running' || scan.status === 'pending');
        
        if (runningScans.length > 0) {
            statusSpan.innerHTML = `🔄 ${runningScans.length} tech scan${runningScans.length > 1 ? 's' : ''} running`;
            statusSpan.style.color = '#00ff9f';
        } else {
            const completedCount = scans.filter(scan => scan.status === 'completed').length;
            const totalTech = scans.filter(scan => scan.status === 'completed').reduce((total, scan) => {
                try {
                    const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                    return total + Object.values(results.technologies || {}).flat().length;
                } catch {
                    return total;
                }
            }, 0);
            
            statusSpan.innerHTML = `✅ ${completedCount} scan${completedCount !== 1 ? 's' : ''} completed | 🔧 ${totalTech} technologies detected`;
            statusSpan.style.color = '#9a4dff';
        }
    },

    updateLastUpdateTime() {
        const element = document.getElementById('tech-last-update');
        if (element) {
            element.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('tech-auto-refresh-indicator');
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
        
        const toggleBtn = document.getElementById('tech-auto-refresh-toggle');
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
        console.log('🧹 Cleaning up Technology Detection module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
    }
};

// Make it globally available
window.TechnologyDetection = TechnologyDetection;
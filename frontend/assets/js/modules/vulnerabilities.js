// frontend/assets/js/modules/vulnerabilities.js - PRODUCTION-READY VERSION

const Vulnerabilities = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
    targetsCache: {},
    subdomainsCache: {},
    scanJobsRefreshInterval: null,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.loadVulnScans();
        
        // Start real-time updates
        this.startRealTimeUpdates();
    },

    // Load subdomains for selected target
    async loadSubdomains(targetId) {
        const subdomainSelect = document.getElementById('vuln-scan-subdomain');
        if (!subdomainSelect) return;

        // Reset subdomain dropdown
        subdomainSelect.innerHTML = '<option value="">All subdomains</option>';
        
        if (!targetId) {
            return;
        }

        try {
            // Check cache first
            if (this.subdomainsCache[targetId]) {
                this.populateSubdomainSelect(this.subdomainsCache[targetId]);
                return;
            }

            // Fetch subdomains from API
            const response = await API.subdomains.getAll({ target_id: targetId, limit: 1000 });
            if (!response) return;
            
            const data = await response.json();
            const subdomains = data.success ? data.data : [];
            
            // Cache the subdomains
            this.subdomainsCache[targetId] = subdomains;
            
            // Populate dropdown
            this.populateSubdomainSelect(subdomains);
            
            console.log(`Loaded ${subdomains.length} subdomains for target ${targetId}`);
        } catch (error) {
            console.error('Failed to load subdomains for vulnerability scanning:', error);
            subdomainSelect.innerHTML = '<option value="">Error loading subdomains</option>';
        }
    },

    // Populate subdomain select dropdown
    populateSubdomainSelect(subdomains) {
        const subdomainSelect = document.getElementById('vuln-scan-subdomain');
        if (!subdomainSelect) return;

        // Keep "All subdomains" option and add individual subdomains
        subdomains.forEach(subdomain => {
            const option = document.createElement('option');
            option.value = subdomain.id;
            option.textContent = subdomain.subdomain;
            
            // Add status indicator
            if (subdomain.status === 'active') {
                option.textContent += ' ✅';
            } else if (subdomain.status === 'inactive') {
                option.textContent += ' ❌';
            }
            
            subdomainSelect.appendChild(option);
        });
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .export-menu {
                    box-shadow: 0 4px 6px rgba(255, 0, 0, 0.2);
                    border-radius: 2px;
                }
                .export-menu button:hover {
                    background-color: #110000 !important;
                }
                .scrollable-table-container {
                    max-height: 500px;
                    overflow-y: auto;
                    overflow-x: auto;
                    border: 2px solid #ff4444;
                    background-color: #000000;
                }
                .scrollable-table-container::-webkit-scrollbar {
                    width: 12px;
                    height: 12px;
                }
                .scrollable-table-container::-webkit-scrollbar-track {
                    background: #000000;
                    border: 1px solid #330000;
                }
                .scrollable-table-container::-webkit-scrollbar-thumb {
                    background: #ff4444;
                    border: 1px solid #330000;
                }
                .scrollable-table-container::-webkit-scrollbar-thumb:hover {
                    background: #cc0000;
                }
                .scrollable-table-container::-webkit-scrollbar-corner {
                    background: #000000;
                }
                
                .spinner {
                    border: 2px solid #330000;
                    border-top: 2px solid #ff4444;
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    animation: spin 1s linear infinite;
                    display: inline-block;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .progress-row {
                    background-color: #110000 !important;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { background-color: #110000; }
                    50% { background-color: #220000; }
                    100% { background-color: #110000; }
                }
                
                .status-updating {
                    animation: blink 1s infinite;
                }
                
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.5; }
                }

                .severity-critical { background-color: #ff0000; color: white; }
                .severity-high { background-color: #ff6600; color: white; }
                .severity-medium { background-color: #ffaa00; color: black; }
                .severity-low { background-color: #00ff00; color: black; }
                .severity-info { background-color: #0088ff; color: white; }

                .vuln-card {
                    border: 1px solid #ff4444;
                    margin-bottom: 10px;
                    padding: 15px;
                    background: linear-gradient(135deg, #1a0000, #2d0000);
                }
            </style>
            
            <div class="scan-info">
                <h4>⚠️ Vulnerability Scanning</h4>
                <p>Automated security vulnerability scanning to identify common security issues like OWASP Top 10 vulnerabilities, misconfigurations, and security headers. Uses multiple scanning techniques to ensure comprehensive coverage.</p>
            </div>

            <!-- Vulnerability Scanning Content -->
            <div id="vuln-scans-content">
                <div class="card">
                    <div class="card-title">Start Vulnerability Scan</div>
                    <div id="vuln-scan-messages"></div>
                    <form id="vuln-scan-form">
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 20px; align-items: end;">
                            <div class="form-group">
                                <label for="vuln-scan-target">Target Domain</label>
                                <select id="vuln-scan-target" required>
                                    <option value="">Select target...</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="vuln-scan-subdomain">Subdomain Scope</label>
                                <select id="vuln-scan-subdomain">
                                    <option value="">All subdomains</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="vuln-scan-profile">Scan Profile</label>
                                <select id="vuln-scan-profile">
                                    <option value="basic">Basic Security Headers</option>
                                    <option value="owasp">OWASP Top 10</option>
                                    <option value="comprehensive">Comprehensive</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary" id="start-vuln-scan-btn">⚠️ Start Vuln Scan</button>
                        </div>
                    </form>
                </div>

                <div class="card">
                    <div class="card-title">
                        Vulnerability Scan Jobs
                        <span id="vuln-auto-refresh-indicator" style="float: right; font-size: 12px; color: #ff4444;">
                            🔄 Auto-updating
                        </span>
                    </div>
                    
                    <!-- Controls -->
                    <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <button onclick="Vulnerabilities.loadVulnScans()" class="btn btn-secondary">🔄 Manual Refresh</button>
                        <button onclick="Vulnerabilities.toggleScanAutoRefresh()" class="btn btn-secondary" id="vuln-auto-refresh-toggle">
                            ⏸️ Pause Auto-refresh
                        </button>
                        <span id="vuln-scan-status" style="color: #ff6666; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                        <span id="vuln-last-update-time" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                    </div>
                    
                    <!-- Real-time progress indicator -->
                    <div id="vuln-realtime-progress" style="display: none; margin-bottom: 15px; padding: 10px; border: 1px solid #ff4444; background-color: #110000;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="spinner" style="width: 16px; height: 16px;"></span>
                            <span id="vuln-progress-text" style="color: #ff4444; font-family: 'Courier New', monospace; font-size: 12px;"></span>
                        </div>
                    </div>
                    
                    <div class="scrollable-table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Target</th>
                                    <th>Profile</th>
                                    <th>Scope</th>
                                    <th>Status</th>
                                    <th>Progress</th>
                                    <th>Vulnerabilities Found</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="vuln-scans-list">
                                <tr>
                                    <td colspan="9" style="text-align: center; color: #ff6666;">Loading vulnerability scans...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Vulnerability scan form submission
        const vulnScanForm = document.getElementById('vuln-scan-form');
        if (vulnScanForm) {
            vulnScanForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startVulnScan();
            });
        }

        // Filter change events
        // Target selection change to load subdomains
        const targetSelect = document.getElementById('vuln-scan-target');
        if (targetSelect) {
            targetSelect.addEventListener('change', async (e) => {
                await this.loadSubdomains(e.target.value);
            });
        }

        // Close export menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.export-menu') && !e.target.closest('[id^="export-btn-"]')) {
                document.querySelectorAll('.export-menu').forEach(menu => {
                    menu.style.display = 'none';
                });
            }
        });
    },

    // Enhanced real-time updates
    startRealTimeUpdates() {
        console.log('🔄 Starting real-time updates for vulnerability scans');
        
        // Clear any existing intervals
        this.cleanup();
        
        // Start aggressive refresh during active scans
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'vuln-scanning') {
                try {
                    await this.updateVulnScansRealTime();
                } catch (error) {
                    console.error('Real-time vulnerability updates failed:', error);
                }
            }
        }, 3000); // Update every 3 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    // Real-time vulnerability scans update
    async updateVulnScansRealTime() {
        try {
            const response = await API.scans.getJobs({ job_type: 'vulnerability_scan' });
            if (!response || !response.ok) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            // Check for running scans
            const runningScans = scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            );
            
            // Update scans table
            this.renderVulnScansList(scans);
            
            // Update status indicators
            this.updateVulnScanStatus(scans, runningScans);
            
            // Update last update time
            this.updateLastUpdateTime();
            
            // Show/hide real-time progress
            if (runningScans.length > 0) {
                this.showVulnRealTimeProgress(runningScans);
            } else {
                this.hideVulnRealTimeProgress();
            }
            
        } catch (error) {
            console.error('Real-time vulnerability scans update failed:', error);
        }
    },

    updateVulnScanStatus(scans, runningScans) {
        const statusSpan = document.getElementById('vuln-scan-status');
        if (!statusSpan) return;
        
        if (runningScans.length > 0) {
            const totalProgress = runningScans.reduce((sum, scan) => sum + (scan.progress_percentage || 0), 0);
            const avgProgress = Math.round(totalProgress / runningScans.length);
            
            statusSpan.innerHTML = `🔄 ${runningScans.length} vuln scan${runningScans.length > 1 ? 's' : ''} running (${avgProgress}% avg)`;
            statusSpan.style.color = '#ffff00';
            statusSpan.classList.add('status-updating');
        } else {
            const completedScans = scans.filter(scan => scan.status === 'completed').length;
            const totalVulns = scans
                .filter(scan => scan.status === 'completed')
                .reduce((total, scan) => {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        return total + (results?.total_vulnerabilities || 0);
                    } catch {
                        return total;
                    }
                }, 0);
            
            const totalSubdomainsScanned = scans
                .filter(scan => scan.status === 'completed')
                .reduce((total, scan) => {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        return total + (results?.total_subdomains_scanned || 0);
                    } catch {
                        return total;
                    }
                }, 0);
            
            if (completedScans > 0) {
                statusSpan.innerHTML = `✅ ${completedScans} scan${completedScans > 1 ? 's' : ''} completed | ⚠️ ${totalVulns} vulnerabilities found across ${totalSubdomainsScanned} subdomains`;
                statusSpan.style.color = '#ff4444';
            } else {
                statusSpan.textContent = '💤 No vulnerability scans running';
                statusSpan.style.color = '#666';
            }
            statusSpan.classList.remove('status-updating');
        }
    },

    showVulnRealTimeProgress(runningScans) {
        const progressDiv = document.getElementById('vuln-realtime-progress');
        const progressText = document.getElementById('vuln-progress-text');
        
        if (progressDiv && progressText) {
            const activeScan = runningScans[0];
            const progress = activeScan.progress_percentage || 0;
            const targetName = this.getTargetName(activeScan);
            
            progressText.textContent = `${targetName} - ${activeScan.status} (${progress}%)`;
            progressDiv.style.display = 'block';
        }
    },

    hideVulnRealTimeProgress() {
        const progressDiv = document.getElementById('vuln-realtime-progress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
    },

    updateLastUpdateTime() {
        const element = document.getElementById('vuln-last-update-time');
        if (element) {
            const now = new Date();
            element.textContent = `Updated: ${now.toLocaleTimeString()}`;
            this.lastUpdate = now;
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('vuln-auto-refresh-indicator');
        if (indicator) {
            if (isActive) {
                indicator.innerHTML = '🔄 Auto-updating';
                indicator.style.color = '#ff4444';
            } else {
                indicator.innerHTML = '⏸️ Paused';
                indicator.style.color = '#ffff00';
            }
        }
    },

    toggleScanAutoRefresh() {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        const toggleBtn = document.getElementById('vuln-auto-refresh-toggle');
        if (toggleBtn) {
            if (this.isAutoRefreshEnabled) {
                toggleBtn.innerHTML = '⏸️ Pause Auto-refresh';
                this.startRealTimeUpdates();
                Utils.showMessage('Vulnerability scan auto-refresh enabled', 'success');
            } else {
                toggleBtn.innerHTML = '▶️ Resume Auto-refresh';
                this.updateAutoRefreshIndicator(false);
                Utils.showMessage('Vulnerability scan auto-refresh paused', 'warning');
            }
        }
    },

    // Enhanced target name resolution
    getTargetName(scan) {
        if (scan.target_domain) return scan.target_domain;
        if (scan.domain) return scan.domain;
        if (scan.target?.domain) return scan.target.domain;
        
        if (scan.target_id && this.targetsCache[scan.target_id]) {
            return this.targetsCache[scan.target_id].domain;
        }
        
        if (scan.target_id) return `Target ID: ${scan.target_id}`;
        return 'Unknown Target';
    },

    // Load targets and build cache
    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            // Build targets cache
            this.targetsCache = {};
            targets.forEach(target => {
                this.targetsCache[target.id] = target;
            });
            
            // Update target selects
            const targetSelect = document.getElementById('vuln-scan-target');
            if (targetSelect) {
                const currentValue = targetSelect.value;
                
                targetSelect.innerHTML = '<option value="">Select target...</option>';
                
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    targetSelect.appendChild(option);
                });

                if (currentValue) targetSelect.value = currentValue;
            }

            console.log(`Loaded ${targets.length} targets for vulnerability scanning`);
        } catch (error) {
            console.error('Failed to load targets for vulnerability scanning:', error);
        }
    },

    // Load vulnerability scan jobs
    async loadVulnScans() {
        try {
            const response = await API.scans.getJobs({ job_type: 'vulnerability_scan' });
            if (!response) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            this.renderVulnScansList(scans);
            this.updateVulnScanStatus(scans, scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            ));
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('Failed to load vulnerability scans:', error);
            document.getElementById('vuln-scans-list').innerHTML = 
                '<tr><td colspan="9" style="text-align: center; color: #ff0000;">Failed to load vulnerability scans</td></tr>';
        }
    },

    renderVulnScansList(scans) {
        const scansList = document.getElementById('vuln-scans-list');
        
        if (scans.length > 0) {
            scansList.innerHTML = scans.map(scan => {
                const targetName = this.getTargetName(scan);
                const isRunning = scan.status === 'running' || scan.status === 'pending';
                
                // Extract vulnerability count and details from results
                let vulnCount = '-';
                let vulnDetails = '';
                if (scan.status === 'completed' && scan.results) {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        const totalVulns = results.total_vulnerabilities || 0;
                        const subdomainsScanned = results.total_subdomains_scanned || 0;
                        
                        if (totalVulns > 0) {
                            vulnCount = totalVulns;
                            vulnDetails = `${subdomainsScanned} subdomain${subdomainsScanned !== 1 ? 's' : ''} scanned`;
                            
                            // Add severity breakdown if available
                            if (results.severity_breakdown) {
                                const breakdown = results.severity_breakdown;
                                const criticalHigh = (breakdown.critical || 0) + (breakdown.high || 0);
                                if (criticalHigh > 0) {
                                    vulnDetails += ` | ${criticalHigh} critical/high`;
                                }
                            }
                        } else {
                            vulnCount = `0 (${subdomainsScanned} scanned)`;
                        }
                    } catch (error) {
                        console.warn('Failed to parse vulnerability scan results:', error);
                        vulnCount = 'Parse Error';
                    }
                } else if (isRunning) {
                    vulnCount = '🔄 Scanning...';
                }

                // Get scan profile and scope from config
                let profile = 'Basic';
                let scope = 'All subdomains';
                try {
                    const config = typeof scan.config === 'string' ? JSON.parse(scan.config) : scan.config;
                    profile = config.profile || 'basic';
                    profile = profile.charAt(0).toUpperCase() + profile.slice(1);
                    
                    if (config.subdomain_id) {
                        scope = 'Single subdomain';
                    } else if (config.scan_scope === 'single_subdomain') {
                        scope = 'Single subdomain';
                    }
                } catch {
                    profile = 'Basic';
                }
                
                return `
                    <tr class="${isRunning ? 'progress-row' : ''}">
                        <td style="font-family: 'Courier New', monospace;">${scan.id}</td>
                        <td style="color: #ff4444; font-weight: bold;" title="Target ID: ${scan.target_id}">${targetName}</td>
                        <td>${profile}</td>
                        <td style="font-size: 12px; color: #ff6666;">${scope}</td>
                        <td><span class="status status-${scan.status} ${isRunning ? 'status-updating' : ''}">${scan.status.toUpperCase()}</span></td>
                        <td>
                            <div style="background-color: #330000; border: 1px solid #ff4444; height: 8px; width: 100px;">
                                <div style="background-color: #ff4444; height: 100%; width: ${scan.progress_percentage || 0}%; transition: width 0.3s ease;"></div>
                            </div>
                            <span style="font-size: 13px; color: #ff6666;">${scan.progress_percentage || 0}%</span>
                        </td>
                        <td style="font-weight: bold; color: ${scan.status === 'completed' ? '#ff4444' : '#666'};">
                            ${vulnCount}
                            ${vulnDetails ? `<br><small style="color: #888; font-size: 11px;">${vulnDetails}</small>` : ''}
                        </td>
                        <td style="font-size: 12px; color: #666;">${new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>
                            ${scan.status === 'completed' ? 
                                `<div style="position: relative; display: inline-block;">
                                    <button onclick="Vulnerabilities.toggleExportMenu(${scan.id})" class="btn btn-secondary btn-small" id="export-btn-${scan.id}">📤 Export Results</button>
                                    <div id="export-menu-${scan.id}" class="export-menu" style="display: none; position: absolute; top: 100%; left: 0; background: #000; border: 2px solid #ff4444; min-width: 120px; z-index: 1000;">
                                        <button onclick="Vulnerabilities.exportScanResults(${scan.id}, 'csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #330000;">📊 CSV</button>
                                        <button onclick="Vulnerabilities.exportScanResults(${scan.id}, 'json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #330000;">📋 JSON</button>
                                        <button onclick="Vulnerabilities.exportScanResults(${scan.id}, 'xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                                    </div>
                                </div>` :
                                scan.status === 'running' ? 
                                `<button onclick="Vulnerabilities.stopVulnScan(${scan.id})" class="btn btn-danger btn-small">Stop</button>` :
                                '-'
                            }
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            scansList.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #ff6666;">No vulnerability scans yet. Start your first scan above!</td></tr>';
        }
    },

    // Start vulnerability scan
    async startVulnScan() {
        const targetId = document.getElementById('vuln-scan-target').value;
        const subdomainId = document.getElementById('vuln-scan-subdomain').value;
        const profile = document.getElementById('vuln-scan-profile').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'vuln-scan-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-vuln-scan-btn', true);
            
            const config = {
                profile: profile,
                subdomain_id: subdomainId || null, // null means scan all subdomains
                include_headers_check: true,
                include_ssl_check: true,
                include_xss_check: profile !== 'basic',
                include_sqli_check: profile === 'comprehensive',
                include_directory_traversal: profile === 'comprehensive',
                scan_scope: subdomainId ? 'single_subdomain' : 'all_subdomains'
            };
            
            const response = await API.scans.start(targetId, ['vulnerability_scan'], 'medium', config);
            
            if (response && response.ok) {
                const scopeText = subdomainId ? 'single subdomain' : 'all subdomains';
                Utils.showMessage(`Vulnerability scan started successfully for ${scopeText}!`, 'success', 'vuln-scan-messages');
                
                // Reset the form
                document.getElementById('vuln-scan-target').value = '';
                document.getElementById('vuln-scan-subdomain').innerHTML = '<option value="">All subdomains</option>';
                document.getElementById('vuln-scan-profile').value = 'basic';
                
                // Immediately refresh and enable aggressive updates
                await this.loadVulnScans();
                this.startRealTimeUpdates();
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start vulnerability scan: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'vuln-scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start vulnerability scan: ' + error.message, 'error', 'vuln-scan-messages');
        } finally {
            Utils.setButtonLoading('start-vuln-scan-btn', false);
        }
    },

    // Export functions
    toggleExportMenu(scanId) {
        document.querySelectorAll('.export-menu').forEach(menu => {
            if (menu.id !== `export-menu-${scanId}`) {
                menu.style.display = 'none';
            }
        });
        
        const menu = document.getElementById(`export-menu-${scanId}`);
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    async exportScanResults(scanId, format) {
        try {
            const menu = document.getElementById(`export-menu-${scanId}`);
            if (menu) menu.style.display = 'none';
            
            Utils.showMessage(`Exporting vulnerability scan results as ${format.toUpperCase()}...`, 'info', 'vuln-scan-messages');
            
            const response = await API.scans.get(scanId);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success && data.data) {
                const scanData = data.data;
                const results = scanData.results || {};
                const targetName = this.getTargetName(scanData);
                
                // Enhanced export data with more comprehensive information
                const exportData = {
                    scan_id: scanId,
                    target: targetName,
                    scan_type: 'Vulnerability Scan',
                    scan_profile: results.profile || 'Unknown',
                    scan_scope: results.scan_scope || 'Unknown',
                    subdomains_scanned: results.subdomains_scanned || [],
                    total_subdomains_scanned: results.total_subdomains_scanned || 0,
                    status: scanData.status,
                    created_at: scanData.created_at,
                    completed_at: scanData.completed_at,
                    scan_duration_seconds: results.scan_duration_seconds || 0,
                    severity_breakdown: results.severity_breakdown || {},
                    total_vulnerabilities: results.total_vulnerabilities || 0,
                    vulnerabilities: results.vulnerabilities || [],
                    scan_config: results.scan_config || {},
                    results: results
                };
                
                switch (format.toLowerCase()) {
                    case 'csv':
                        this.downloadVulnCSV(exportData, scanId);
                        break;
                    case 'json':
                        this.downloadVulnJSON(exportData, scanId);
                        break;
                    case 'xml':
                        this.downloadVulnXML(exportData, scanId);
                        break;
                }
                
                Utils.showMessage(`Vulnerability scan results exported successfully as ${format.toUpperCase()}!`, 'success', 'vuln-scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to export results: ' + error.message, 'error', 'vuln-scan-messages');
        }
    },

    downloadVulnCSV(data, scanId) {
        let csvContent = 'Scan Summary\n';
        csvContent += 'Scan ID,Target,Scan Type,Profile,Scope,Status,Created,Completed,Duration (seconds),Total Subdomains,Total Vulnerabilities\n';
        csvContent += `${data.scan_id},"${data.target}","${data.scan_type}","${data.scan_profile}","${data.scan_scope}","${data.status}","${data.created_at}","${data.completed_at || 'N/A'}","${data.scan_duration_seconds}","${data.total_subdomains_scanned}","${data.total_vulnerabilities}"\n\n`;
        
        // Add severity breakdown
        if (data.severity_breakdown) {
            csvContent += 'Severity Breakdown\n';
            csvContent += 'Severity,Count\n';
            Object.entries(data.severity_breakdown).forEach(([severity, count]) => {
                csvContent += `"${severity.charAt(0).toUpperCase() + severity.slice(1)}","${count}"\n`;
            });
            csvContent += '\n';
        }
        
        // Add scanned subdomains list
        if (data.subdomains_scanned && data.subdomains_scanned.length > 0) {
            csvContent += 'Scanned Subdomains\n';
            csvContent += 'Subdomain\n';
            data.subdomains_scanned.forEach(subdomain => {
                csvContent += `"${subdomain}"\n`;
            });
            csvContent += '\n';
        }
        
        // Add detailed vulnerabilities
        if (data.vulnerabilities && data.vulnerabilities.length > 0) {
            csvContent += 'Detailed Vulnerabilities\n';
            csvContent += 'Title,Severity,Subdomain,URL,Method,Status,Description,Proof of Concept\n';
            data.vulnerabilities.forEach(vuln => {
                const description = (vuln.description || '').replace(/"/g, '""');
                const poc = (vuln.proof_of_concept || '').replace(/"/g, '""');
                csvContent += `"${vuln.title}","${vuln.severity}","${vuln.subdomain || 'N/A'}","${vuln.url || 'N/A'}","${vuln.method || 'GET'}","${vuln.status || 'open'}","${description}","${poc}"\n`;
            });
        }
        
        this.downloadFile(csvContent, `vulnerability_scan_${scanId}_comprehensive_results.csv`, 'text/csv');
    },

    downloadVulnJSON(data, scanId) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `vulnerability_scan_${scanId}_results.json`, 'application/json');
    },

    downloadVulnXML(data, scanId) {
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<vulnerability_scan_results>\n';
        xmlContent += `  <scan_id>${data.scan_id}</scan_id>\n`;
        xmlContent += `  <target>${this.escapeXml(data.target)}</target>\n`;
        xmlContent += `  <scan_type>${this.escapeXml(data.scan_type)}</scan_type>\n`;
        xmlContent += `  <scan_profile>${this.escapeXml(data.scan_profile)}</scan_profile>\n`;
        xmlContent += `  <scan_scope>${this.escapeXml(data.scan_scope)}</scan_scope>\n`;
        xmlContent += `  <status>${this.escapeXml(data.status)}</status>\n`;
        xmlContent += `  <created_at>${this.escapeXml(data.created_at)}</created_at>\n`;
        xmlContent += `  <completed_at>${this.escapeXml(data.completed_at || 'N/A')}</completed_at>\n`;
        xmlContent += `  <scan_duration_seconds>${data.scan_duration_seconds}</scan_duration_seconds>\n`;
        xmlContent += `  <total_subdomains_scanned>${data.total_subdomains_scanned}</total_subdomains_scanned>\n`;
        xmlContent += `  <total_vulnerabilities>${data.total_vulnerabilities}</total_vulnerabilities>\n`;
        
        // Add severity breakdown
        if (data.severity_breakdown) {
            xmlContent += '  <severity_breakdown>\n';
            Object.entries(data.severity_breakdown).forEach(([severity, count]) => {
                xmlContent += `    <${severity}>${count}</${severity}>\n`;
            });
            xmlContent += '  </severity_breakdown>\n';
        }
        
        // Add scanned subdomains
        if (data.subdomains_scanned && data.subdomains_scanned.length > 0) {
            xmlContent += '  <scanned_subdomains>\n';
            data.subdomains_scanned.forEach(subdomain => {
                xmlContent += `    <subdomain>${this.escapeXml(subdomain)}</subdomain>\n`;
            });
            xmlContent += '  </scanned_subdomains>\n';
        }
        
        // Add vulnerabilities
        xmlContent += '  <vulnerabilities>\n';
        if (data.vulnerabilities && data.vulnerabilities.length > 0) {
            data.vulnerabilities.forEach(vuln => {
                xmlContent += '    <vulnerability>\n';
                xmlContent += `      <title>${this.escapeXml(vuln.title)}</title>\n`;
                xmlContent += `      <severity>${this.escapeXml(vuln.severity)}</severity>\n`;
                xmlContent += `      <subdomain>${this.escapeXml(vuln.subdomain || 'N/A')}</subdomain>\n`;
                xmlContent += `      <url>${this.escapeXml(vuln.url || 'N/A')}</url>\n`;
                xmlContent += `      <method>${this.escapeXml(vuln.method || 'GET')}</method>\n`;
                xmlContent += `      <status>${this.escapeXml(vuln.status || 'open')}</status>\n`;
                xmlContent += `      <description>${this.escapeXml(vuln.description || '')}</description>\n`;
                xmlContent += `      <proof_of_concept>${this.escapeXml(vuln.proof_of_concept || '')}</proof_of_concept>\n`;
                xmlContent += '    </vulnerability>\n';
            });
        }
        xmlContent += '  </vulnerabilities>\n';
        xmlContent += '</vulnerability_scan_results>';
        
        this.downloadFile(xmlContent, `vulnerability_scan_${scanId}_comprehensive_results.xml`, 'application/xml');
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

    // Stop vulnerability scan
    async stopVulnScan(scanId) {
        if (confirm('Are you sure you want to stop this vulnerability scan?')) {
            try {
                const response = await API.scans.stop(scanId);
                if (response && response.ok) {
                    await this.loadVulnScans();
                    Utils.showMessage('Vulnerability scan stopped successfully!', 'success');
                } else {
                    Utils.showMessage('Failed to stop vulnerability scan', 'error');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop vulnerability scan: ' + error.message, 'error');
            }
        }
    },

    // Cleanup method for tab switching
    cleanup() {
        console.log('🧹 Cleaning up vulnerability scanning module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        if (this.scanJobsRefreshInterval) {
            clearInterval(this.scanJobsRefreshInterval);
            this.scanJobsRefreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
    },

    // Method to refresh targets (useful when called from other modules)
    async refreshTargets() {
        // Clear subdomain cache when refreshing targets
        this.subdomainsCache = {};
        await this.loadTargets();
    }
};

// Make it globally available
window.Vulnerabilities = Vulnerabilities;
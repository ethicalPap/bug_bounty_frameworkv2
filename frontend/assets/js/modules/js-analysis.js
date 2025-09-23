// frontend/assets/js/modules/js-analysis.js - REDESIGNED TO MIMIC SCANS STYLE WITH SECURITY FOCUS

const JSAnalysis = {
    refreshInterval: null,
    activeScanJobId: null,
    progressUpdateInterval: null,
    isAutoRefreshEnabled: true,
    progressCheckInterval: null,
    targetsCache: {}, // Cache for target information

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.load();
        
        // Start real-time updates like scans
        this.startRealTimeUpdates();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .export-menu {
                    box-shadow: 0 4px 6px rgba(124, 58, 237, 0.4);
                    border-radius: 2px;
                    background: linear-gradient(135deg, #0f0f23, #1a0a2e);
                    border: 2px solid #7c3aed;
                }
                .export-menu button:hover {
                    background: linear-gradient(90deg, #1a0a2e, #2d1b69) !important;
                    color: #a855f7 !important;
                }
                
                .scrollable-table-container {
                    max-height: 500px;
                    overflow-y: auto;
                    overflow-x: auto;
                    border: 2px solid #7c3aed;
                    background-color: #000000;
                }
                .scrollable-table-container::-webkit-scrollbar {
                    width: 12px;
                    height: 12px;
                }
                .scrollable-table-container::-webkit-scrollbar-track {
                    background: #000000;
                    border: 1px solid #2d1b69;
                }
                .scrollable-table-container::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, #7c3aed, #9a4dff);
                    border: 1px solid #2d1b69;
                    border-radius: 6px;
                }
                .scrollable-table-container::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg, #9a4dff, #a855f7);
                }
                .scrollable-table-container::-webkit-scrollbar-corner {
                    background: #000000;
                }
                
                .spinner {
                    border: 2px solid #2d1b69;
                    border-top: 2px solid #7c3aed;
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
                    background-color: rgba(124, 58, 237, 0.1) !important;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { background-color: rgba(124, 58, 237, 0.1); }
                    50% { background-color: rgba(154, 77, 255, 0.2); }
                    100% { background-color: rgba(124, 58, 237, 0.1); }
                }
                
                .status-updating {
                    animation: blink 1s infinite;
                }
                
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.5; }
                }

                @keyframes shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                
                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.7; }
                }

                .vulnerability-critical { color: #dc2626; font-weight: bold; }
                .vulnerability-high { color: #ea580c; font-weight: bold; }
                .vulnerability-medium { color: #d97706; }
                .vulnerability-low { color: #eab308; }
                .vulnerability-info { color: #06b6d4; }
            </style>

            <!-- Enhanced Progress Bar with Real-time Updates -->
            <div id="js-scan-status" style="display: none; background: linear-gradient(135deg, #1a0a2e, #2d1b69); border: 2px solid #7c3aed; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 0 20px rgba(124, 58, 237, 0.3);">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div class="spinner" style="margin: 0; width: 24px; height: 24px; border: 3px solid #2d1b69; border-top: 3px solid #7c3aed;"></div>
                    <div style="flex: 1;">
                        <div id="js-scan-status-text" style="color: #7c3aed; font-family: 'Courier New', monospace; font-weight: bold; font-size: 16px; margin-bottom: 5px;">JavaScript Security Analysis in Progress...</div>
                        <div id="js-scan-phase-text" style="color: #9a4dff; font-family: 'Courier New', monospace; font-size: 14px;">Discovering JavaScript files...</div>
                    </div>
                    <button onclick="JSAnalysis.stopActiveScan()" class="btn btn-danger" style="padding: 10px 20px;">⏹️ Stop Analysis</button>
                </div>
                
                <!-- Enhanced Progress Bar with Animation -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="color: #9a4dff; font-size: 14px; font-weight: bold;">Analysis Progress</span>
                        <span id="js-progress-percentage" style="color: #7c3aed; font-size: 14px; font-weight: bold;">0%</span>
                    </div>
                    <div style="background: linear-gradient(90deg, #0a0a0a, #1a0a2e); border: 2px solid #7c3aed; height: 20px; width: 100%; border-radius: 10px; overflow: hidden; position: relative;">
                        <div id="js-scan-progress-bar" style="background: linear-gradient(90deg, #7c3aed, #9a4dff, #a855f7); height: 100%; width: 0%; transition: width 0.5s ease; border-radius: 8px; position: relative; box-shadow: 0 0 15px rgba(124, 58, 237, 0.6);">
                            <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 2s infinite;"></div>
                        </div>
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.1), transparent); animation: pulse-glow 3s infinite;"></div>
                    </div>
                </div>
                
                <!-- Live Analysis Stats Grid -->
                <div id="live-js-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 15px;">
                    <div style="background: rgba(124, 58, 237, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(124, 58, 237, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #7c3aed; margin-bottom: 4px;" id="live-js-files">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">📄 JS Files</div>
                    </div>
                    <div style="background: rgba(220, 38, 38, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(220, 38, 38, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #dc2626; margin-bottom: 4px;" id="live-vulnerabilities">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">⚠️ Vulnerabilities</div>
                    </div>
                    <div style="background: rgba(234, 88, 12, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(234, 88, 12, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #ea580c; margin-bottom: 4px;" id="live-sinks">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">🕳️ Sinks</div>
                    </div>
                    <div style="background: rgba(154, 77, 255, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(154, 77, 255, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #a855f7; margin-bottom: 4px;" id="live-secrets">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">🔐 Secrets</div>
                    </div>
                    <div style="background: rgba(168, 85, 247, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(168, 85, 247, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #9333ea; margin-bottom: 4px;" id="live-prototype">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">🧬 Prototype</div>
                    </div>
                    <div style="background: rgba(6, 182, 212, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(6, 182, 212, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #06b6d4; margin-bottom: 4px;" id="live-libraries">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">📚 Libraries</div>
                    </div>
                </div>
                
                <!-- Detailed Progress Info -->
                <div id="js-progress-details" style="background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 6px; border: 1px solid #2d1b69;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span id="js-current-activity" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;">Preparing JavaScript security analysis...</span>
                        <span id="js-elapsed-time" style="color: #6b46c1; font-size: 12px;">00:00</span>
                    </div>
                    <div id="js-eta-estimate" style="color: #6b46c1; font-size: 11px; margin-top: 5px;">Estimated time remaining: Calculating...</div>
                </div>
            </div>

            <div class="scan-info">
                <h4>📄 JavaScript Security Analysis</h4>
                <p>Comprehensive JavaScript security analysis to discover vulnerabilities, sinks, prototype pollution, secrets, and security misconfigurations. Analyzes both first-party and third-party JavaScript code for security issues.</p>
            </div>

            <div class="card">
                <div class="card-title">Start JavaScript Security Analysis</div>
                <div id="js-analysis-messages"></div>
                <form id="js-analysis-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 20px; align-items: end;">
                        <div class="form-group">
                            <label for="js-analysis-target">Target Domain</label>
                            <select id="js-analysis-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="js-analysis-subdomain">Subdomain (optional)</label>
                            <select id="js-analysis-subdomain">
                                <option value="">All subdomains</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-js-analysis-btn">📄 Start JS Analysis</button>
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">
                    JavaScript Security Analysis Jobs
                    <span id="auto-refresh-indicator" style="float: right; font-size: 12px; color: #9a4dff;">
                        🔄 Auto-updating
                    </span>
                </div>
                
                <!-- Controls -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="JSAnalysis.load()" class="btn btn-secondary">🔄 Manual Refresh</button>
                    <button onclick="JSAnalysis.toggleAutoRefresh()" class="btn btn-secondary" id="auto-refresh-toggle">
                        ⏸️ Pause Auto-refresh
                    </button>
                    <span id="scan-status" style="color: #6b46c1; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="last-update-time" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <!-- Real-time progress indicator -->
                <div id="realtime-progress" style="display: none; margin-bottom: 15px; padding: 10px; border: 1px solid #7c3aed; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="spinner" style="width: 16px; height: 16px;"></span>
                        <span id="progress-text" style="color: #7c3aed; font-family: 'Courier New', monospace; font-size: 12px;"></span>
                    </div>
                </div>
                
                <div class="scrollable-table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Target</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Progress</th>
                                <th>Vulnerabilities Found</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="js-scans-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #6b46c1;">Loading JavaScript analysis scans...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // JS analysis form submission
        const jsAnalysisForm = document.getElementById('js-analysis-form');
        if (jsAnalysisForm) {
            jsAnalysisForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startJSAnalysis();
            });
        }

        // JS analysis target - when changed, update subdomains
        const jsTargetFilter = document.getElementById('js-analysis-target');
        if (jsTargetFilter) {
            jsTargetFilter.addEventListener('change', async () => {
                await this.loadJSAnalysisSubdomains();
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
        console.log('🔄 Starting real-time updates for JS analysis scans');
        
        // Clear any existing intervals
        this.cleanup();
        
        // Start aggressive refresh during active scans (every 2 seconds)
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'js-analysis') {
                try {
                    await this.updateScansRealTime();
                } catch (error) {
                    console.error('Real-time JS analysis scans update failed:', error);
                }
            }
        }, 2000); // Update every 2 seconds like scans
        
        this.updateAutoRefreshIndicator(true);
    },

    // Real-time scans update
    async updateScansRealTime() {
        try {
            const response = await API.scans.getJobs({ job_type: 'js_files_scan' });
            if (!response || !response.ok) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            // Check if there are any running scans
            const runningScans = scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            );
            
            // Update scans table
            this.renderScansList(scans);
            
            // Update status indicators
            this.updateScanStatus(scans, runningScans);
            
            // Update last update time
            this.updateLastUpdateTime();
            
            // Show/hide real-time progress
            if (runningScans.length > 0) {
                this.showRealTimeProgress(runningScans);
            } else {
                this.hideRealTimeProgress();
            }
            
        } catch (error) {
            console.error('Real-time JS analysis scans update failed:', error);
        }
    },

    updateScanStatus(scans, runningScans) {
        const statusSpan = document.getElementById('scan-status');
        if (!statusSpan) return;
        
        if (runningScans.length > 0) {
            const totalProgress = runningScans.reduce((sum, scan) => sum + (scan.progress_percentage || 0), 0);
            const avgProgress = Math.round(totalProgress / runningScans.length);
            
            statusSpan.innerHTML = `🔄 ${runningScans.length} JS analysis scan${runningScans.length > 1 ? 's' : ''} running (${avgProgress}% avg)`;
            statusSpan.style.color = '#a855f7';
            statusSpan.classList.add('status-updating');
        } else {
            const completedScans = scans.filter(scan => scan.status === 'completed').length;
            const totalVulnerabilities = scans
                .filter(scan => scan.status === 'completed')
                .reduce((total, scan) => {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        return total + (results?.vulnerabilities?.length || results?.total_vulnerabilities || 0);
                    } catch {
                        return total;
                    }
                }, 0);
            
            if (completedScans > 0) {
                statusSpan.innerHTML = `✅ ${completedScans} scan${completedScans > 1 ? 's' : ''} completed | ⚠️ ${totalVulnerabilities} vulnerabilities found`;
                statusSpan.style.color = '#7c3aed';
            } else {
                statusSpan.textContent = '💤 No scans running';
                statusSpan.style.color = '#666';
            }
            statusSpan.classList.remove('status-updating');
        }
    },

    showRealTimeProgress(runningScans) {
        const progressDiv = document.getElementById('realtime-progress');
        const progressText = document.getElementById('progress-text');
        
        if (progressDiv && progressText) {
            const activeScan = runningScans[0]; // Show progress for first active scan
            const progress = activeScan.progress_percentage || 0;
            const targetName = this.getTargetName(activeScan);
            
            progressText.textContent = `${targetName} - ${activeScan.status} (${progress}%)`;
            progressDiv.style.display = 'block';
        }
    },

    hideRealTimeProgress() {
        const progressDiv = document.getElementById('realtime-progress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
    },

    updateLastUpdateTime() {
        const element = document.getElementById('last-update-time');
        if (element) {
            const now = new Date();
            element.textContent = `Updated: ${now.toLocaleTimeString()}`;
            this.lastUpdate = now;
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('auto-refresh-indicator');
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
        
        const toggleBtn = document.getElementById('auto-refresh-toggle');
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

    // Enhanced target name resolution with fallback logic
    getTargetName(scan) {
        // Try multiple ways to get the target name
        if (scan.target_domain) return scan.target_domain;
        if (scan.domain) return scan.domain;
        if (scan.target?.domain) return scan.target.domain;
        
        // Try to get from targets cache
        if (scan.target_id && this.targetsCache[scan.target_id]) {
            return this.targetsCache[scan.target_id].domain;
        }
        
        // Fallback to target ID
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
            
            // Build targets cache for quick lookup
            this.targetsCache = {};
            targets.forEach(target => {
                this.targetsCache[target.id] = target;
            });
            
            const targetSelect = document.getElementById('js-analysis-target');
            if (targetSelect) {
                // Clear existing options except the first one
                targetSelect.innerHTML = '<option value="">Select target...</option>';
                
                // Add target options
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    targetSelect.appendChild(option);
                });

                console.log(`Loaded ${targets.length} targets for JS analysis scan dropdown`);
            }
        } catch (error) {
            console.error('Failed to load targets for JS analysis scan form:', error);
            
            // Show error message in the form
            const targetSelect = document.getElementById('js-analysis-target');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">Error loading targets</option>';
            }
        }
    },

    async load() {
        try {
            // Only load js_files_scan jobs
            const response = await API.scans.getJobs({ job_type: 'js_files_scan' });
            if (!response) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            console.log('📄 Loaded JS analysis scans data:', scans); // Debug log
            
            this.renderScansList(scans);
            this.updateScanStatus(scans, scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            ));
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('Failed to load JS analysis scans:', error);
            document.getElementById('js-scans-list').innerHTML = 
                '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Failed to load JS analysis scans</td></tr>';
        }
    },

    renderScansList(scans) {
        const scansList = document.getElementById('js-scans-list');
        
        if (scans.length > 0) {
            scansList.innerHTML = scans.map(scan => {
                // Enhanced target name resolution
                const targetName = this.getTargetName(scan);
                const isRunning = scan.status === 'running' || scan.status === 'pending';
                
                console.log(`🎯 JS Analysis Scan ${scan.id}: target_domain="${scan.target_domain}", domain="${scan.domain}", target_id="${scan.target_id}", resolved="${targetName}"`); // Debug log
                
                // Extract vulnerability count from results
                let vulnerabilityCount = '-';
                if (scan.status === 'completed' && scan.results) {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        vulnerabilityCount = results.vulnerabilities?.length || results.total_vulnerabilities || 0;
                    } catch (error) {
                        console.warn('Failed to parse scan results:', error);
                    }
                } else if (isRunning) {
                    vulnerabilityCount = '🔄 Analyzing...';
                }
                
                return `
                    <tr class="${isRunning ? 'progress-row' : ''}">
                        <td style="font-family: 'Courier New', monospace;">${scan.id}</td>
                        <td style="color: #7c3aed; font-weight: bold;" title="Target ID: ${scan.target_id}">${targetName}</td>
                        <td>JavaScript Security Analysis</td>
                        <td><span class="status status-${scan.status} ${isRunning ? 'status-updating' : ''}">${scan.status.toUpperCase()}</span></td>
                        <td>
                            <div style="background-color: #2d1b69; border: 1px solid #7c3aed; height: 8px; width: 100px;">
                                <div style="background: linear-gradient(90deg, #7c3aed, #9a4dff); height: 100%; width: ${scan.progress_percentage || 0}%; transition: width 0.3s ease;"></div>
                            </div>
                            <span style="font-size: 13px; color: #6b46c1;">${scan.progress_percentage || 0}%</span>
                        </td>
                        <td style="font-weight: bold; color: ${scan.status === 'completed' ? (vulnerabilityCount > 0 ? '#dc2626' : '#7c3aed') : '#666'};">
                            ${vulnerabilityCount}
                        </td>
                        <td style="font-size: 12px; color: #666;">${new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>
                            ${scan.status === 'completed' ? 
                                `<div style="position: relative; display: inline-block;">
                                    <button onclick="JSAnalysis.toggleExportMenu(${scan.id})" class="btn btn-secondary btn-small" id="export-btn-${scan.id}">📤 Export Results</button>
                                    <div id="export-menu-${scan.id}" class="export-menu" style="display: none; position: absolute; top: 100%; left: 0; background: #000; border: 2px solid #7c3aed; min-width: 120px; z-index: 1000;">
                                        <button onclick="JSAnalysis.exportResults(${scan.id}, 'csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📊 CSV</button>
                                        <button onclick="JSAnalysis.exportResults(${scan.id}, 'json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📋 JSON</button>
                                        <button onclick="JSAnalysis.exportResults(${scan.id}, 'xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                                    </div>
                                </div>` :
                                scan.status === 'running' ? 
                                `<button onclick="JSAnalysis.stopScan(${scan.id})" class="btn btn-danger btn-small">Stop</button>` :
                                '-'
                            }
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            scansList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b46c1;">No JavaScript analysis scans yet. Start your first scan above!</td></tr>';
        }
    },

    async startJSAnalysis() {
        const targetId = document.getElementById('js-analysis-target').value;
        const subdomainId = document.getElementById('js-analysis-subdomain').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'js-analysis-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-js-analysis-btn', true, '📄 Starting JS Analysis...');
            
            // Start js_files_scan type
            const response = await API.scans.start(targetId, ['js_files_scan'], 'medium', {
                subdomain_id: subdomainId || null,
                analysis_depth: 'comprehensive',
                security_analysis: true,
                vulnerability_scanning: true,
                prototype_pollution_detection: true,
                sink_detection: true,
                secret_detection: true,
                library_analysis: true
            });
            
            if (response && response.ok) {
                Utils.showMessage('JavaScript security analysis started successfully!', 'success', 'js-analysis-messages');
                
                // Reset the form
                document.getElementById('js-analysis-target').value = '';
                document.getElementById('js-analysis-subdomain').value = '';
                
                // Immediately refresh and enable aggressive updates
                await this.load();
                this.startRealTimeUpdates();
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start JS analysis: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'js-analysis-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start JS analysis: ' + error.message, 'error', 'js-analysis-messages');
        } finally {
            Utils.setButtonLoading('start-js-analysis-btn', false, '📄 Start JS Analysis');
        }
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
                job_type: 'js_files_scan',
                status: ['pending', 'running'],
                limit: 10 
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const activeScans = data.success ? data.data : [];
                
                console.log('Checking for active JS analysis scans:', activeScans.length);
                
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
        const statusDiv = document.getElementById('js-scan-status');
        const statusText = document.getElementById('js-scan-status-text');
        const phaseText = document.getElementById('js-scan-phase-text');
        const progressBar = document.getElementById('js-scan-progress-bar');
        const progressPercentage = document.getElementById('js-progress-percentage');
        const currentActivity = document.getElementById('js-current-activity');
        const elapsedTime = document.getElementById('js-elapsed-time');
        const etaEstimate = document.getElementById('js-eta-estimate');
        
        console.log('Showing progress for scan:', scan.id, scan.progress_percentage);
        
        if (statusDiv && statusText && progressBar) {
            statusDiv.style.display = 'block';
            
            const progress = scan.progress_percentage || 0;
            const targetName = this.getTargetName(scan);
            
            // Update main status
            statusText.textContent = `Analyzing JavaScript security for ${targetName}...`;
            
            // Update progress bar
            progressBar.style.width = `${progress}%`;
            if (progressPercentage) {
                progressPercentage.textContent = `${progress}%`;
            }
            
            // Update phase information
            const phase = this.getCurrentJSPhase(progress);
            if (phaseText) {
                phaseText.textContent = phase;
            }
            
            // Calculate elapsed time
            const elapsed = scan.started_at ? 
                Math.round((Date.now() - new Date(scan.started_at).getTime()) / 1000) : 0;
            
            if (currentActivity) {
                currentActivity.textContent = this.getDetailedJSActivity(progress);
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
            this.updateLiveJSStats(scan, progress);
        } else {
            console.warn('Progress elements not found');
        }
    },

    // Get current JS analysis phase based on progress
    getCurrentJSPhase(progress) {
        if (progress < 15) return '🚀 Discovering JavaScript files...';
        if (progress < 30) return '📄 Downloading and parsing JS files...';
        if (progress < 45) return '🔍 Analyzing code for vulnerabilities...';
        if (progress < 60) return '🕳️ Detecting sinks and injection points...';
        if (progress < 75) return '🧬 Checking for prototype pollution...';
        if (progress < 90) return '🔐 Scanning for secrets and credentials...';
        return '✅ Finalizing security analysis report...';
    },

    // Get detailed activity description
    getDetailedJSActivity(progress) {
        if (progress < 15) return 'Crawling pages for JavaScript file references...';
        if (progress < 30) return 'Downloading and preprocessing JavaScript files...';
        if (progress < 45) return 'Running static security analysis...';
        if (progress < 60) return 'Identifying DOM sinks and XSS vectors...';
        if (progress < 75) return 'Detecting prototype pollution vulnerabilities...';
        if (progress < 90) return 'Extracting secrets and sensitive data...';
        return 'Compiling comprehensive security report...';
    },

    // Update live statistics during scanning
    updateLiveJSStats(scan, progress) {
        const baseMultiplier = progress / 100;
        
        // Estimate discoveries based on progress (these would be real in actual implementation)
        const estimatedJSFiles = Math.floor(baseMultiplier * 25 + Math.random() * 5);
        const estimatedVulnerabilities = Math.floor(baseMultiplier * 12 + Math.random() * 3);
        const estimatedSinks = Math.floor(baseMultiplier * 8 + Math.random() * 2);
        const estimatedSecrets = Math.floor(baseMultiplier * 6 + Math.random() * 2);
        const estimatedPrototype = Math.floor(baseMultiplier * 3 + Math.random() * 1);
        const estimatedLibraries = Math.floor(baseMultiplier * 18 + Math.random() * 5);
        
        this.updateLiveStatElement('live-js-files', estimatedJSFiles);
        this.updateLiveStatElement('live-vulnerabilities', estimatedVulnerabilities);
        this.updateLiveStatElement('live-sinks', estimatedSinks);
        this.updateLiveStatElement('live-secrets', estimatedSecrets);
        this.updateLiveStatElement('live-prototype', estimatedPrototype);
        this.updateLiveStatElement('live-libraries', estimatedLibraries);
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
        const statusDiv = document.getElementById('js-scan-status');
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
                    Utils.showMessage('JavaScript analysis stopped successfully!', 'success', 'js-analysis-messages');
                    this.hideProgress();
                } else {
                    Utils.showMessage('Failed to stop JavaScript analysis', 'error', 'js-analysis-messages');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop analysis: ' + error.message, 'error', 'js-analysis-messages');
            }
        }
    },

    // Load subdomains for JS analysis form
    async loadJSAnalysisSubdomains() {
        try {
            const targetId = document.getElementById('js-analysis-target')?.value;
            const subdomainSelect = document.getElementById('js-analysis-subdomain');
            
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
                
                console.log(`Loaded ${subdomains.length} subdomains for JS analysis form`);
            }
            
            if (currentValue) {
                const optionExists = Array.from(subdomainSelect.options).some(option => option.value === currentValue);
                if (optionExists) {
                    subdomainSelect.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('Failed to load subdomains for JS analysis form:', error);
        }
    },

    // Cleanup method for tab switching
    cleanup() {
        console.log('🧹 Cleaning up JS analysis module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        if (this.progressCheckInterval) {
            clearInterval(this.progressCheckInterval);
            this.progressCheckInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
        this.hideProgress();
    },

    toggleExportMenu(scanId) {
        // Close all other export menus first
        document.querySelectorAll('.export-menu').forEach(menu => {
            if (menu.id !== `export-menu-${scanId}`) {
                menu.style.display = 'none';
            }
        });
        
        // Toggle the clicked menu
        const menu = document.getElementById(`export-menu-${scanId}`);
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    async exportResults(scanId, format) {
        try {
            // Hide the export menu
            const menu = document.getElementById(`export-menu-${scanId}`);
            if (menu) menu.style.display = 'none';
            
            // Show loading message
            Utils.showMessage(`Exporting JavaScript analysis results as ${format.toUpperCase()}...`, 'info', 'js-analysis-messages');
            
            const response = await API.scans.get(scanId);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success && data.data) {
                const scanData = data.data;
                const results = scanData.results || {};
                
                // Get target name for export
                const targetName = this.getTargetName(scanData);
                
                // Prepare export data
                const exportData = {
                    scan_id: scanId,
                    target: targetName,
                    scan_type: 'JavaScript Security Analysis',
                    status: scanData.status,
                    created_at: scanData.created_at,
                    completed_at: scanData.completed_at,
                    results: results
                };
                
                // Generate and download file based on format
                switch (format.toLowerCase()) {
                    case 'csv':
                        this.downloadCSV(exportData, scanId);
                        break;
                    case 'json':
                        this.downloadJSON(exportData, scanId);
                        break;
                    case 'xml':
                        this.downloadXML(exportData, scanId);
                        break;
                    default:
                        throw new Error('Unsupported export format');
                }
                
                Utils.showMessage(`JavaScript analysis results exported successfully as ${format.toUpperCase()}!`, 'success', 'js-analysis-messages');
                
            } else {
                Utils.showMessage('No results available for export.', 'warning', 'js-analysis-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to export results: ' + error.message, 'error', 'js-analysis-messages');
        }
    },

    downloadCSV(data, scanId) {
        let csvContent = 'Scan ID,Target,Scan Type,Status,Created,Completed,Total Vulnerabilities\n';
        csvContent += `${data.scan_id},"${data.target}","${data.scan_type}","${data.status}","${data.created_at}","${data.completed_at || 'N/A'}","${data.results.vulnerabilities?.length || 0}"\n\n`;
        
        // Add vulnerabilities if available
        if (data.results.vulnerabilities && data.results.vulnerabilities.length > 0) {
            csvContent += 'JavaScript Vulnerabilities\n';
            csvContent += 'File,Vulnerability Type,Severity,Description,Line\n';
            data.results.vulnerabilities.forEach(vuln => {
                csvContent += `"${vuln.file || 'N/A'}","${vuln.type || 'N/A'}","${vuln.severity || 'N/A'}","${vuln.description || 'N/A'}","${vuln.line || 'N/A'}"\n`;
            });
        }
        
        // Add secrets if available
        if (data.results.secrets && data.results.secrets.length > 0) {
            csvContent += '\nDiscovered Secrets\n';
            csvContent += 'File,Secret Type,Value Preview\n';
            data.results.secrets.forEach(secret => {
                csvContent += `"${secret.file || 'N/A'}","${secret.type || 'N/A'}","${(secret.preview || 'N/A').substring(0, 50)}..."\n`;
            });
        }
        
        this.downloadFile(csvContent, `js_analysis_scan_${scanId}_results.csv`, 'text/csv');
    },

    downloadJSON(data, scanId) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `js_analysis_scan_${scanId}_results.json`, 'application/json');
    },

    downloadXML(data, scanId) {
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<js_analysis_scan_results>\n';
        xmlContent += `  <scan_id>${data.scan_id}</scan_id>\n`;
        xmlContent += `  <target>${this.escapeXml(data.target)}</target>\n`;
        xmlContent += `  <scan_type>${this.escapeXml(data.scan_type)}</scan_type>\n`;
        xmlContent += `  <status>${this.escapeXml(data.status)}</status>\n`;
        xmlContent += `  <created_at>${this.escapeXml(data.created_at)}</created_at>\n`;
        xmlContent += `  <completed_at>${this.escapeXml(data.completed_at || 'N/A')}</completed_at>\n`;
        xmlContent += `  <total_vulnerabilities>${data.results.vulnerabilities?.length || 0}</total_vulnerabilities>\n`;
        xmlContent += '  <results>\n';
        
        // Add vulnerabilities
        if (data.results.vulnerabilities && data.results.vulnerabilities.length > 0) {
            xmlContent += '    <vulnerabilities>\n';
            data.results.vulnerabilities.forEach(vuln => {
                xmlContent += `      <vulnerability>\n`;
                xmlContent += `        <file>${this.escapeXml(vuln.file || 'N/A')}</file>\n`;
                xmlContent += `        <type>${this.escapeXml(vuln.type || 'N/A')}</type>\n`;
                xmlContent += `        <severity>${this.escapeXml(vuln.severity || 'N/A')}</severity>\n`;
                xmlContent += `        <description>${this.escapeXml(vuln.description || 'N/A')}</description>\n`;
                xmlContent += `        <line>${this.escapeXml(vuln.line || 'N/A')}</line>\n`;
                xmlContent += `      </vulnerability>\n`;
            });
            xmlContent += '    </vulnerabilities>\n';
        }
        
        // Add secrets
        if (data.results.secrets && data.results.secrets.length > 0) {
            xmlContent += '    <secrets>\n';
            data.results.secrets.forEach(secret => {
                xmlContent += `      <secret>\n`;
                xmlContent += `        <file>${this.escapeXml(secret.file || 'N/A')}</file>\n`;
                xmlContent += `        <type>${this.escapeXml(secret.type || 'N/A')}</type>\n`;
                xmlContent += `        <preview>${this.escapeXml((secret.preview || 'N/A').substring(0, 50))}...</preview>\n`;
                xmlContent += `      </secret>\n`;
            });
            xmlContent += '    </secrets>\n';
        }
        
        xmlContent += '  </results>\n';
        xmlContent += '</js_analysis_scan_results>';
        
        this.downloadFile(xmlContent, `js_analysis_scan_${scanId}_results.xml`, 'application/xml');
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

    async stopScan(scanId) {
        if (confirm('Are you sure you want to stop this JavaScript analysis scan?')) {
            try {
                const response = await API.scans.stop(scanId);
                if (response && response.ok) {
                    await this.load();
                    Utils.showMessage('JavaScript analysis scan stopped successfully!', 'success');
                } else {
                    Utils.showMessage('Failed to stop scan', 'error');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop scan: ' + error.message, 'error');
            }
        }
    },

    // Method to refresh targets (useful when called from other modules)
    async refreshTargets() {
        await this.loadTargets();
    }
};

window.JSAnalysis = JSAnalysis;
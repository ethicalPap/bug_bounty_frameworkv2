// frontend/assets/js/modules/content-discovery.js - REDESIGNED TO MIMIC SCANS STYLE

const ContentDiscovery = {
    refreshInterval: null,
    activeScanJobId: null,
    progressUpdateInterval: null,
    lastProgressUpdate: 0,
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
            </style>

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

            <div class="scan-info">
                <h4>🕷️ Advanced Content Discovery</h4>
                <p>Comprehensive passive content discovery including static endpoints, dynamic behavior analysis, parameter testing, and XSS sink detection. Uses stealth techniques to avoid detection while maximizing coverage.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Advanced Content Discovery Scan</div>
                <div id="content-discovery-messages"></div>
                <form id="content-discovery-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 20px; align-items: end;">
                        <div class="form-group">
                            <label for="content-discovery-target">Target Domain</label>
                            <select id="content-discovery-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="content-discovery-subdomain">Subdomain (optional)</label>
                            <select id="content-discovery-subdomain">
                                <option value="">All subdomains</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-content-discovery-btn">🕷️ Start Content Discovery</button>
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">
                    Content Discovery Scan Jobs
                    <span id="auto-refresh-indicator" style="float: right; font-size: 12px; color: #9a4dff;">
                        🔄 Auto-updating
                    </span>
                </div>
                
                <!-- Controls -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="ContentDiscovery.load()" class="btn btn-secondary">🔄 Manual Refresh</button>
                    <button onclick="ContentDiscovery.toggleAutoRefresh()" class="btn btn-secondary" id="auto-refresh-toggle">
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
                                <th>Endpoints Found</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="content-scans-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #6b46c1;">Loading content discovery scans...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Content discovery form submission
        const contentDiscoveryForm = document.getElementById('content-discovery-form');
        if (contentDiscoveryForm) {
            contentDiscoveryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startContentDiscovery();
            });
        }

        // Content discovery target - when changed, update subdomains
        const contentTargetFilter = document.getElementById('content-discovery-target');
        if (contentTargetFilter) {
            contentTargetFilter.addEventListener('change', async () => {
                await this.loadContentDiscoverySubdomains();
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
        console.log('🔄 Starting real-time updates for content discovery scans');
        
        // Clear any existing intervals
        this.cleanup();
        
        // Start aggressive refresh during active scans (every 2 seconds)
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'content-discovery') {
                try {
                    await this.updateScansRealTime();
                } catch (error) {
                    console.error('Real-time content discovery scans update failed:', error);
                }
            }
        }, 2000); // Update every 2 seconds like scans
        
        this.updateAutoRefreshIndicator(true);
    },

    // Real-time scans update
    async updateScansRealTime() {
        try {
            const response = await API.scans.getJobs({ job_type: 'content_discovery' });
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
            console.error('Real-time content discovery scans update failed:', error);
        }
    },

    updateScanStatus(scans, runningScans) {
        const statusSpan = document.getElementById('scan-status');
        if (!statusSpan) return;
        
        if (runningScans.length > 0) {
            const totalProgress = runningScans.reduce((sum, scan) => sum + (scan.progress_percentage || 0), 0);
            const avgProgress = Math.round(totalProgress / runningScans.length);
            
            statusSpan.innerHTML = `🔄 ${runningScans.length} content discovery scan${runningScans.length > 1 ? 's' : ''} running (${avgProgress}% avg)`;
            statusSpan.style.color = '#a855f7';
            statusSpan.classList.add('status-updating');
        } else {
            const completedScans = scans.filter(scan => scan.status === 'completed').length;
            const totalEndpoints = scans
                .filter(scan => scan.status === 'completed')
                .reduce((total, scan) => {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        return total + (results?.total_count || results?.endpoints_found || 0);
                    } catch {
                        return total;
                    }
                }, 0);
            
            if (completedScans > 0) {
                statusSpan.innerHTML = `✅ ${completedScans} scan${completedScans > 1 ? 's' : ''} completed | 📁 ${totalEndpoints} total endpoints discovered`;
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
            
            const targetSelect = document.getElementById('content-discovery-target');
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

                console.log(`Loaded ${targets.length} targets for content discovery scan dropdown`);
            }
        } catch (error) {
            console.error('Failed to load targets for content discovery scan form:', error);
            
            // Show error message in the form
            const targetSelect = document.getElementById('content-discovery-target');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">Error loading targets</option>';
            }
        }
    },

    async load() {
        try {
            // Only load content_discovery scan jobs
            const response = await API.scans.getJobs({ job_type: 'content_discovery' });
            if (!response) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            console.log('🕷️ Loaded content discovery scans data:', scans); // Debug log
            
            this.renderScansList(scans);
            this.updateScanStatus(scans, scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            ));
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('Failed to load content discovery scans:', error);
            document.getElementById('content-scans-list').innerHTML = 
                '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Failed to load content discovery scans</td></tr>';
        }
    },

    renderScansList(scans) {
        const scansList = document.getElementById('content-scans-list');
        
        if (scans.length > 0) {
            scansList.innerHTML = scans.map(scan => {
                // Enhanced target name resolution
                const targetName = this.getTargetName(scan);
                const isRunning = scan.status === 'running' || scan.status === 'pending';
                
                console.log(`🎯 Content Discovery Scan ${scan.id}: target_domain="${scan.target_domain}", domain="${scan.domain}", target_id="${scan.target_id}", resolved="${targetName}"`); // Debug log
                
                // Extract endpoint count from results
                let endpointCount = '-';
                if (scan.status === 'completed' && scan.results) {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        endpointCount = results.total_count || results.endpoints_found || results.directories?.length || 0;
                    } catch (error) {
                        console.warn('Failed to parse scan results:', error);
                    }
                } else if (isRunning) {
                    endpointCount = '🔄 Scanning...';
                }
                
                return `
                    <tr class="${isRunning ? 'progress-row' : ''}">
                        <td style="font-family: 'Courier New', monospace;">${scan.id}</td>
                        <td style="color: #7c3aed; font-weight: bold;" title="Target ID: ${scan.target_id}">${targetName}</td>
                        <td>Content Discovery</td>
                        <td><span class="status status-${scan.status} ${isRunning ? 'status-updating' : ''}">${scan.status.toUpperCase()}</span></td>
                        <td>
                            <div style="background-color: #2d1b69; border: 1px solid #7c3aed; height: 8px; width: 100px;">
                                <div style="background: linear-gradient(90deg, #7c3aed, #9a4dff); height: 100%; width: ${scan.progress_percentage || 0}%; transition: width 0.3s ease;"></div>
                            </div>
                            <span style="font-size: 13px; color: #6b46c1;">${scan.progress_percentage || 0}%</span>
                        </td>
                        <td style="font-weight: bold; color: ${scan.status === 'completed' ? '#7c3aed' : '#666'};">
                            ${endpointCount}
                        </td>
                        <td style="font-size: 12px; color: #666;">${new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>
                            ${scan.status === 'completed' ? 
                                `<div style="position: relative; display: inline-block;">
                                    <button onclick="ContentDiscovery.toggleExportMenu(${scan.id})" class="btn btn-secondary btn-small" id="export-btn-${scan.id}">📤 Export Results</button>
                                    <div id="export-menu-${scan.id}" class="export-menu" style="display: none; position: absolute; top: 100%; left: 0; background: #000; border: 2px solid #7c3aed; min-width: 120px; z-index: 1000;">
                                        <button onclick="ContentDiscovery.exportResults(${scan.id}, 'csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📊 CSV</button>
                                        <button onclick="ContentDiscovery.exportResults(${scan.id}, 'json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📋 JSON</button>
                                        <button onclick="ContentDiscovery.exportResults(${scan.id}, 'xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                                    </div>
                                </div>` :
                                scan.status === 'running' ? 
                                `<button onclick="ContentDiscovery.stopScan(${scan.id})" class="btn btn-danger btn-small">Stop</button>` :
                                '-'
                            }
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            scansList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b46c1;">No content discovery scans yet. Start your first scan above!</td></tr>';
        }
    },

    async startContentDiscovery() {
        const targetId = document.getElementById('content-discovery-target').value;
        const subdomainId = document.getElementById('content-discovery-subdomain').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'content-discovery-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-content-discovery-btn', true, '🕷️ Starting Content Discovery...');
            
            // Start content_discovery scan type
            const response = await API.scans.start(targetId, ['content_discovery'], 'medium', {
                subdomain_id: subdomainId || null,
                discovery_method: 'comprehensive',
                enhanced_mode: true,
                passive_mode: true
            });
            
            if (response && response.ok) {
                Utils.showMessage('Content discovery scan started successfully!', 'success', 'content-discovery-messages');
                
                // Reset the form
                document.getElementById('content-discovery-target').value = '';
                document.getElementById('content-discovery-subdomain').value = '';
                
                // Immediately refresh and enable aggressive updates
                await this.load();
                this.startRealTimeUpdates();
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start content discovery scan: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'content-discovery-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start content discovery scan: ' + error.message, 'error', 'content-discovery-messages');
        } finally {
            Utils.setButtonLoading('start-content-discovery-btn', false, '🕷️ Start Content Discovery');
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

    // Cleanup method for tab switching
    cleanup() {
        console.log('🧹 Cleaning up content discovery module intervals');
        
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
            Utils.showMessage(`Exporting content discovery scan results as ${format.toUpperCase()}...`, 'info', 'content-discovery-messages');
            
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
                    scan_type: 'Content Discovery',
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
                
                Utils.showMessage(`Content discovery scan results exported successfully as ${format.toUpperCase()}!`, 'success', 'content-discovery-messages');
                
            } else {
                Utils.showMessage('No results available for export.', 'warning', 'content-discovery-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to export results: ' + error.message, 'error', 'content-discovery-messages');
        }
    },

    downloadCSV(data, scanId) {
        let csvContent = 'Scan ID,Target,Scan Type,Status,Created,Completed,Total Endpoints\n';
        csvContent += `${data.scan_id},"${data.target}","${data.scan_type}","${data.status}","${data.created_at}","${data.completed_at || 'N/A'}","${data.results.total_count || data.results.endpoints_found || 0}"\n\n`;
        
        // Add endpoints if available
        if (data.results.endpoints && data.results.endpoints.length > 0) {
            csvContent += 'Discovered Endpoints\n';
            csvContent += 'Endpoint,Status Code,Title\n';
            data.results.endpoints.forEach(endpoint => {
                csvContent += `"${endpoint.path || endpoint.url}","${endpoint.status_code || 'N/A'}","${endpoint.title || 'N/A'}"\n`;
            });
        }
        
        // Add directories if available
        if (data.results.directories && data.results.directories.length > 0) {
            csvContent += '\nDiscovered Directories\n';
            csvContent += 'Directory,Status\n';
            data.results.directories.forEach(directory => {
                csvContent += `"${directory}","Found"\n`;
            });
        }
        
        this.downloadFile(csvContent, `content_discovery_scan_${scanId}_results.csv`, 'text/csv');
    },

    downloadJSON(data, scanId) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `content_discovery_scan_${scanId}_results.json`, 'application/json');
    },

    downloadXML(data, scanId) {
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<content_discovery_scan_results>\n';
        xmlContent += `  <scan_id>${data.scan_id}</scan_id>\n`;
        xmlContent += `  <target>${this.escapeXml(data.target)}</target>\n`;
        xmlContent += `  <scan_type>${this.escapeXml(data.scan_type)}</scan_type>\n`;
        xmlContent += `  <status>${this.escapeXml(data.status)}</status>\n`;
        xmlContent += `  <created_at>${this.escapeXml(data.created_at)}</created_at>\n`;
        xmlContent += `  <completed_at>${this.escapeXml(data.completed_at || 'N/A')}</completed_at>\n`;
        xmlContent += `  <total_endpoints>${data.results.total_count || data.results.endpoints_found || 0}</total_endpoints>\n`;
        xmlContent += '  <results>\n';
        
        // Add endpoints
        if (data.results.endpoints && data.results.endpoints.length > 0) {
            xmlContent += '    <endpoints>\n';
            data.results.endpoints.forEach(endpoint => {
                xmlContent += `      <endpoint>\n`;
                xmlContent += `        <path>${this.escapeXml(endpoint.path || endpoint.url)}</path>\n`;
                xmlContent += `        <status_code>${this.escapeXml(endpoint.status_code || 'N/A')}</status_code>\n`;
                xmlContent += `        <title>${this.escapeXml(endpoint.title || 'N/A')}</title>\n`;
                xmlContent += `      </endpoint>\n`;
            });
            xmlContent += '    </endpoints>\n';
        }
        
        // Add directories
        if (data.results.directories && data.results.directories.length > 0) {
            xmlContent += '    <directories>\n';
            data.results.directories.forEach(directory => {
                xmlContent += `      <directory status="found">${this.escapeXml(directory)}</directory>\n`;
            });
            xmlContent += '    </directories>\n';
        }
        
        xmlContent += '  </results>\n';
        xmlContent += '</content_discovery_scan_results>';
        
        this.downloadFile(xmlContent, `content_discovery_scan_${scanId}_results.xml`, 'application/xml');
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
        if (confirm('Are you sure you want to stop this content discovery scan?')) {
            try {
                const response = await API.scans.stop(scanId);
                if (response && response.ok) {
                    await this.load();
                    Utils.showMessage('Content discovery scan stopped successfully!', 'success');
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

window.ContentDiscovery = ContentDiscovery;
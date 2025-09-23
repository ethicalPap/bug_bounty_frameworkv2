// frontend/assets/js/modules/subdomains.js - REDESIGNED TO MIMIC SCANS STYLE

const Subdomains = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
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
            </style>
            
            <div class="scan-info">
                <h4>🌐 Live Host Discovery</h4>
                <p>Check which discovered subdomains are live and responding. This verifies HTTP/HTTPS accessibility, gathers response codes, and identifies active targets for further testing.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Live Host Discovery Scan</div>
                <div id="live-host-messages"></div>
                <form id="live-host-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 20px; align-items: end; margin-bottom: 15px;">
                        <div class="form-group">
                            <label for="live-host-target">Target Domain</label>
                            <select id="live-host-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="live-host-subdomain">Subdomain Filter (optional)</label>
                            <select id="live-host-subdomain">
                                <option value="">Check all subdomains</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-live-host-btn">🌐 Start Live Host Check</button>
                    </div>
                    
                    <!-- Advanced Options -->
                    <div style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">Check Options</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>HTTP Methods</label>
                                <select id="http-methods">
                                    <option value="get">GET only (fastest)</option>
                                    <option value="head">HEAD only</option>
                                    <option value="both" selected>GET + HEAD (recommended)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Protocols</label>
                                <select id="protocols">
                                    <option value="both" selected>HTTP + HTTPS</option>
                                    <option value="https">HTTPS only</option>
                                    <option value="http">HTTP only</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Timeout (seconds)</label>
                                <select id="request-timeout">
                                    <option value="5">5 seconds</option>
                                    <option value="10" selected>10 seconds</option>
                                    <option value="15">15 seconds</option>
                                    <option value="30">30 seconds</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 10px;">
                            <div class="form-group">
                                <label>Follow Redirects</label>
                                <select id="follow-redirects">
                                    <option value="true" selected>Yes (recommended)</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Concurrent Requests</label>
                                <select id="concurrent-requests">
                                    <option value="5">5 (conservative)</option>
                                    <option value="10" selected>10 (balanced)</option>
                                    <option value="20">20 (aggressive)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Check Screenshots</label>
                                <select id="take-screenshots">
                                    <option value="false" selected>No (faster)</option>
                                    <option value="true">Yes (slower)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">
                    Live Host Discovery Scan Jobs
                    <span id="auto-refresh-indicator" style="float: right; font-size: 12px; color: #9a4dff;">
                        🔄 Auto-updating
                    </span>
                </div>
                
                <!-- Controls -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="Subdomains.load()" class="btn btn-secondary">🔄 Manual Refresh</button>
                    <button onclick="Subdomains.toggleAutoRefresh()" class="btn btn-secondary" id="auto-refresh-toggle">
                        ⏸️ Pause Auto-refresh
                    </button>
                    <span id="live-host-status" style="color: #6b46c1; font-size: 13px; font-family: 'Courier New', monospace;"></span>
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
                                <th>Live Hosts Found</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="live-host-scans-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #6b46c1;">Loading live host discovery scans...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Live host scan form submission
        const liveHostForm = document.getElementById('live-host-form');
        if (liveHostForm) {
            liveHostForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startLiveHostScan();
            });
        }

        // Target filter - when changed, update subdomains
        const targetFilter = document.getElementById('live-host-target');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
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
        console.log('🔄 Starting real-time updates for live host discovery scans');
        
        // Clear any existing intervals
        this.cleanup();
        
        // Start aggressive refresh during active scans (every 2 seconds)
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'subdomains') {
                try {
                    await this.updateScansRealTime();
                } catch (error) {
                    console.error('Real-time live host scans update failed:', error);
                }
            }
        }, 2000); // Update every 2 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    // Real-time scans update
    async updateScansRealTime() {
        try {
            const response = await API.scans.getJobs({ job_type: 'live_host_check' });
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
            console.error('Real-time live host scans update failed:', error);
        }
    },

    updateScanStatus(scans, runningScans) {
        const statusSpan = document.getElementById('live-host-status');
        if (!statusSpan) return;
        
        if (runningScans.length > 0) {
            const totalProgress = runningScans.reduce((sum, scan) => sum + (scan.progress_percentage || 0), 0);
            const avgProgress = Math.round(totalProgress / runningScans.length);
            
            statusSpan.innerHTML = `🔄 ${runningScans.length} live host check${runningScans.length > 1 ? 's' : ''} running (${avgProgress}% avg)`;
            statusSpan.style.color = '#a855f7';
            statusSpan.classList.add('status-updating');
        } else {
            const completedScans = scans.filter(scan => scan.status === 'completed').length;
            const totalLiveHosts = scans
                .filter(scan => scan.status === 'completed')
                .reduce((total, scan) => {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        return total + (results?.live_hosts_count || results?.total_live || 0);
                    } catch {
                        return total;
                    }
                }, 0);
            
            if (completedScans > 0) {
                statusSpan.innerHTML = `✅ ${completedScans} scan${completedScans > 1 ? 's' : ''} completed | 🌐 ${totalLiveHosts} total live hosts found`;
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
            
            const targetSelect = document.getElementById('live-host-target');
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

                console.log(`Loaded ${targets.length} targets for live host scan dropdown`);
            }
        } catch (error) {
            console.error('Failed to load targets for live host scan form:', error);
            
            // Show error message in the form
            const targetSelect = document.getElementById('live-host-target');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">Error loading targets</option>';
            }
        }
    },

    async loadSubdomains() {
        try {
            const targetId = document.getElementById('live-host-target')?.value;
            const subdomainSelect = document.getElementById('live-host-subdomain');
            
            if (!subdomainSelect) return;

            const currentValue = subdomainSelect.value;
            subdomainSelect.innerHTML = '<option value="">Check all subdomains</option>';
            
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
            console.error('Failed to load subdomains for live host scan:', error);
        }
    },

    async load() {
        try {
            // Only load live_host_check jobs
            const response = await API.scans.getJobs({ job_type: 'live_host_check' });
            if (!response) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            console.log('🌐 Loaded live host scans data:', scans); // Debug log
            
            this.renderScansList(scans);
            this.updateScanStatus(scans, scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            ));
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('Failed to load live host scans:', error);
            document.getElementById('live-host-scans-list').innerHTML = 
                '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Failed to load live host scans</td></tr>';
        }
    },

    renderScansList(scans) {
        const scansList = document.getElementById('live-host-scans-list');
        
        if (scans.length > 0) {
            scansList.innerHTML = scans.map(scan => {
                // Enhanced target name resolution
                const targetName = this.getTargetName(scan);
                const isRunning = scan.status === 'running' || scan.status === 'pending';
                
                console.log(`🎯 Live Host Scan ${scan.id}: target_domain="${scan.target_domain}", domain="${scan.domain}", target_id="${scan.target_id}", resolved="${targetName}"`); // Debug log
                
                // Extract live hosts count from results
                let liveHostsCount = '-';
                if (scan.status === 'completed' && scan.results) {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        liveHostsCount = results.live_hosts_count || results.total_live || results.live_hosts?.length || 0;
                    } catch (error) {
                        console.warn('Failed to parse scan results:', error);
                    }
                } else if (isRunning) {
                    liveHostsCount = '🔄 Checking...';
                }
                
                return `
                    <tr class="${isRunning ? 'progress-row' : ''}">
                        <td style="font-family: 'Courier New', monospace;">${scan.id}</td>
                        <td style="color: #7c3aed; font-weight: bold;" title="Target ID: ${scan.target_id}">${targetName}</td>
                        <td>Live Host Check</td>
                        <td><span class="status status-${scan.status} ${isRunning ? 'status-updating' : ''}">${scan.status.toUpperCase()}</span></td>
                        <td>
                            <div style="background-color: #2d1b69; border: 1px solid #7c3aed; height: 8px; width: 100px;">
                                <div style="background: linear-gradient(90deg, #7c3aed, #9a4dff); height: 100%; width: ${scan.progress_percentage || 0}%; transition: width 0.3s ease;"></div>
                            </div>
                            <span style="font-size: 13px; color: #6b46c1;">${scan.progress_percentage || 0}%</span>
                        </td>
                        <td style="font-weight: bold; color: ${scan.status === 'completed' ? '#7c3aed' : '#666'};">
                            ${liveHostsCount}
                        </td>
                        <td style="font-size: 12px; color: #666;">${new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>
                            ${scan.status === 'completed' ? 
                                `<div style="position: relative; display: inline-block;">
                                    <button onclick="Subdomains.toggleExportMenu(${scan.id})" class="btn btn-secondary btn-small" id="export-btn-${scan.id}">📤 Export Live Hosts</button>
                                    <div id="export-menu-${scan.id}" class="export-menu" style="display: none; position: absolute; top: 100%; left: 0; background: #000; border: 2px solid #7c3aed; min-width: 140px; z-index: 1000;">
                                        <button onclick="Subdomains.exportResults(${scan.id}, 'csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📊 CSV</button>
                                        <button onclick="Subdomains.exportResults(${scan.id}, 'json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📋 JSON</button>
                                        <button onclick="Subdomains.exportResults(${scan.id}, 'xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                                    </div>
                                </div>` :
                                scan.status === 'running' ? 
                                `<button onclick="Subdomains.stopScan(${scan.id})" class="btn btn-danger btn-small">Stop</button>` :
                                '-'
                            }
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            scansList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b46c1;">No live host scans yet. Start your first scan above!</td></tr>';
        }
    },

    async startLiveHostScan() {
        const targetId = document.getElementById('live-host-target').value;
        const subdomainId = document.getElementById('live-host-subdomain').value;
        const httpMethods = document.getElementById('http-methods').value;
        const protocols = document.getElementById('protocols').value;
        const timeout = document.getElementById('request-timeout').value;
        const followRedirects = document.getElementById('follow-redirects').value === 'true';
        const concurrentRequests = document.getElementById('concurrent-requests').value;
        const takeScreenshots = document.getElementById('take-screenshots').value === 'true';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'live-host-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-live-host-btn', true, '🌐 Starting Live Host Check...');
            
            const scanTypes = ['live_host_check'];
            const config = {
                subdomain_id: subdomainId || null,
                http_methods: httpMethods,
                protocols: protocols,
                timeout: parseInt(timeout),
                follow_redirects: followRedirects,
                concurrent_requests: parseInt(concurrentRequests),
                take_screenshots: takeScreenshots
            };
            
            Utils.showMessage('🌐 Starting live host discovery scan...', 'info', 'live-host-messages');
            
            const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('Live host scan started:', data);
                
                const successMessage = `🌐 Live host discovery scan started successfully! ${subdomainId ? 'Checking selected subdomain' : 'Checking all subdomains for live hosts'}. Results will appear below as they are discovered.`;
                Utils.showMessage(successMessage, 'success', 'live-host-messages');
                
                // Reset form
                document.getElementById('live-host-subdomain').value = '';
                
                // Immediately refresh and enable aggressive updates
                await this.load();
                this.startRealTimeUpdates();
                
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start live host scan: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'live-host-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start live host scan: ' + error.message, 'error', 'live-host-messages');
        } finally {
            Utils.setButtonLoading('start-live-host-btn', false, '🌐 Start Live Host Check');
        }
    },

    // Cleanup method for tab switching
    cleanup() {
        console.log('🧹 Cleaning up live host scans module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
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
            Utils.showMessage(`Exporting live host scan results as ${format.toUpperCase()}...`, 'info', 'live-host-messages');
            
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
                    scan_type: 'Live Host Discovery',
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
                
                Utils.showMessage(`Live host scan results exported successfully as ${format.toUpperCase()}!`, 'success', 'live-host-messages');
                
            } else {
                Utils.showMessage('No results available for export.', 'warning', 'live-host-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to export results: ' + error.message, 'error', 'live-host-messages');
        }
    },

    downloadCSV(data, scanId) {
        let csvContent = 'Scan ID,Target,Scan Type,Status,Created,Completed,Live Hosts Count\n';
        csvContent += `${data.scan_id},"${data.target}","${data.scan_type}","${data.status}","${data.created_at}","${data.completed_at || 'N/A'}","${data.results.live_hosts_count || data.results.total_live || 0}"\n\n`;
        
        // Add live hosts if available
        if (data.results.live_hosts && data.results.live_hosts.length > 0) {
            csvContent += 'Live Hosts Found\n';
            csvContent += 'Subdomain,HTTP Status,IP Address,Title,Response Time\n';
            data.results.live_hosts.forEach(host => {
                csvContent += `"${host.subdomain || host.url}","${host.status_code || 'N/A'}","${host.ip_address || 'N/A'}","${host.title || 'N/A'}","${host.response_time || 'N/A'}"\n`;
            });
        }
        
        this.downloadFile(csvContent, `live_host_scan_${scanId}_results.csv`, 'text/csv');
    },

    downloadJSON(data, scanId) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `live_host_scan_${scanId}_results.json`, 'application/json');
    },

    downloadXML(data, scanId) {
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<live_host_scan_results>\n';
        xmlContent += `  <scan_id>${data.scan_id}</scan_id>\n`;
        xmlContent += `  <target>${this.escapeXml(data.target)}</target>\n`;
        xmlContent += `  <scan_type>${this.escapeXml(data.scan_type)}</scan_type>\n`;
        xmlContent += `  <status>${this.escapeXml(data.status)}</status>\n`;
        xmlContent += `  <created_at>${this.escapeXml(data.created_at)}</created_at>\n`;
        xmlContent += `  <completed_at>${this.escapeXml(data.completed_at || 'N/A')}</completed_at>\n`;
        xmlContent += `  <live_hosts_count>${data.results.live_hosts_count || data.results.total_live || 0}</live_hosts_count>\n`;
        xmlContent += '  <results>\n';
        
        // Add live hosts
        if (data.results.live_hosts && data.results.live_hosts.length > 0) {
            xmlContent += '    <live_hosts>\n';
            data.results.live_hosts.forEach(host => {
                xmlContent += `      <host>\n`;
                xmlContent += `        <subdomain>${this.escapeXml(host.subdomain || host.url)}</subdomain>\n`;
                xmlContent += `        <status_code>${this.escapeXml(host.status_code || 'N/A')}</status_code>\n`;
                xmlContent += `        <ip_address>${this.escapeXml(host.ip_address || 'N/A')}</ip_address>\n`;
                xmlContent += `        <title>${this.escapeXml(host.title || 'N/A')}</title>\n`;
                xmlContent += `        <response_time>${this.escapeXml(host.response_time || 'N/A')}</response_time>\n`;
                xmlContent += `      </host>\n`;
            });
            xmlContent += '    </live_hosts>\n';
        }
        
        xmlContent += '  </results>\n';
        xmlContent += '</live_host_scan_results>';
        
        this.downloadFile(xmlContent, `live_host_scan_${scanId}_results.xml`, 'application/xml');
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
        if (confirm('Are you sure you want to stop this live host discovery scan?')) {
            try {
                const response = await API.scans.stop(scanId);
                if (response && response.ok) {
                    await this.load();
                    Utils.showMessage('Live host scan stopped successfully!', 'success');
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

// Make it globally available
window.Subdomains = Subdomains;
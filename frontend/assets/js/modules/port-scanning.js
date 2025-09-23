// frontend/assets/js/modules/port-scanning.js - FIXED RESULT PARSING

const PortScanning = {
    refreshInterval: null,
    activeScanJobId: null,
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
                <h4>🔌 Port Scanning <span id="port-scan-live-indicator" style="color: #7c3aed; font-size: 12px;">[LIVE]</span></h4>
                <p>Discover open ports and services on your targets using nmap. Identifies running services, versions, and potential attack vectors on discovered hosts.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Port Scan</div>
                <div id="port-scan-messages"></div>
                <form id="port-scan-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end; margin-bottom: 15px;">
                        <div class="form-group">
                            <label>Target</label>
                            <select id="port-scan-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Subdomain (optional)</label>
                            <select id="port-scan-subdomain">
                                <option value="">All active subdomains</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Scan Profile</label>
                            <select id="port-scan-profile">
                                <option value="top-100">Top 100 Ports (Fast - ~1-2 min)</option>
                                <option value="top-1000" selected>Top 1000 Ports (Recommended - ~5-10 min)</option>
                                <option value="common-tcp">Common TCP Ports (1-1024 - ~2-5 min)</option>
                                <option value="common-udp">Common UDP Ports (~3-8 min)</option>
                                <option value="all-tcp">All TCP Ports (Slow - ~30+ min)</option>
                                <option value="custom">Custom Port Range (Variable time)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="port-scan-btn">🔌 Start Port Scan</button>
                    </div>
                    
                    <!-- Advanced Options -->
                    <div id="advanced-options" style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">Advanced Scan Options</h5>
                        
                        <!-- Profile Information -->
                        <div id="profile-info" style="margin-bottom: 15px; padding: 10px; border: 1px solid #6b46c1; background: rgba(124, 58, 237, 0.1); border-radius: 3px; font-size: 12px; color: #9a4dff;">
                            <strong>Top 1000 Ports:</strong> Scans the 1000 most commonly used ports. Recommended for balanced speed and coverage.
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Custom Ports</label>
                                <input type="text" id="custom-ports" placeholder="e.g., 22,80,443,8080-8090,9000-9100" disabled style="background-color: #1a0a2e; color: #666; border-color: #2d1b69;">
                                <small style="color: #666; font-size: 11px;">
                                    Comma-separated ports/ranges. Examples:<br>
                                    • Single ports: 22,80,443<br>
                                    • Port ranges: 8000-8100<br>
                                    • Mixed: 22,80,443,8080-8090
                                </small>
                            </div>
                            <div class="form-group">
                                <label>Scan Technique</label>
                                <select id="scan-technique">
                                    <option value="syn">SYN Scan (Default)</option>
                                    <option value="connect">TCP Connect</option>
                                    <option value="udp">UDP Scan</option>
                                    <option value="comprehensive">Comprehensive</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Service Detection</label>
                                <select id="service-detection">
                                    <option value="basic">Basic</option>
                                    <option value="version" selected>Version Detection</option>
                                    <option value="aggressive">Aggressive (Scripts)</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 10px;">
                            <div class="form-group">
                                <label>Timing Template</label>
                                <select id="timing-template">
                                    <option value="T2">T2 - Polite</option>
                                    <option value="T3">T3 - Normal</option>
                                    <option value="T4" selected>T4 - Aggressive</option>
                                    <option value="T5">T5 - Insane</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Max Parallel Scans</label>
                                <select id="max-parallel">
                                    <option value="1">1 (Serial)</option>
                                    <option value="3" selected>3 (Balanced)</option>
                                    <option value="5">5 (Fast)</option>
                                    <option value="10">10 (Very Fast)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Only Scan Live Hosts</label>
                                <select id="live-hosts-only">
                                    <option value="true" selected>Yes (Recommended)</option>
                                    <option value="false">No (Scan All)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">
                    Port Scanning Scan Jobs
                    <span id="auto-refresh-indicator" style="float: right; font-size: 12px; color: #9a4dff;">
                        🔄 Auto-updating
                    </span>
                </div>
                
                <!-- Controls -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="PortScanning.load()" class="btn btn-secondary">🔄 Manual Refresh</button>
                    <button onclick="PortScanning.toggleAutoRefresh()" class="btn btn-secondary" id="auto-refresh-toggle">
                        ⏸️ Pause Auto-refresh
                    </button>
                    <span id="port-scan-status" style="color: #6b46c1; font-size: 13px; font-family: 'Courier New', monospace;"></span>
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
                                <th>Ports Found</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="port-scans-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #6b46c1;">Loading port scanning jobs...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Port scan form submission
        const portScanForm = document.getElementById('port-scan-form');
        if (portScanForm) {
            portScanForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startPortScan();
            });
        }

        // Custom ports toggle
        const profileSelect = document.getElementById('port-scan-profile');
        const customPortsInput = document.getElementById('custom-ports');
        const profileInfo = document.getElementById('profile-info');
        
        if (profileSelect && customPortsInput) {
            // Update profile info on change
            const updateProfileInfo = (profile) => {
                const profileDescriptions = {
                    'top-100': '<strong>Top 100 Ports:</strong> Fast scan of the 100 most common ports. Good for quick reconnaissance.',
                    'top-1000': '<strong>Top 1000 Ports:</strong> Scans the 1000 most commonly used ports. Recommended for balanced speed and coverage.',
                    'common-tcp': '<strong>Common TCP Ports:</strong> Scans TCP ports 1-1024 which cover most standard services.',
                    'common-udp': '<strong>Common UDP Ports:</strong> Scans common UDP ports like DNS (53), DHCP (67,68), SNMP (161), etc.',
                    'all-tcp': '<strong>All TCP Ports:</strong> Comprehensive scan of all 65535 TCP ports. Very thorough but slow.',
                    'custom': '<strong>Custom Ports:</strong> Specify your own ports or ranges to scan. Use comma-separated values like: 22,80,443 or ranges like: 8000-8100'
                };
                
                if (profileInfo && profileDescriptions[profile]) {
                    profileInfo.innerHTML = profileDescriptions[profile];
                }
            };
            
            profileSelect.addEventListener('change', (e) => {
                const profile = e.target.value;
                updateProfileInfo(profile);
                
                if (profile === 'custom') {
                    customPortsInput.disabled = false;
                    customPortsInput.required = true;
                    customPortsInput.style.backgroundColor = '#0a0a0a';
                    customPortsInput.style.color = '#9a4dff';
                    customPortsInput.style.borderColor = '#7c3aed';
                    customPortsInput.focus();
                    
                    // Show helpful message
                    Utils.showMessage('💡 Enter custom ports. Examples: 22,80,443 or 8000-8100 or 22,80,443,8080-8090', 'info', 'port-scan-messages');
                } else {
                    customPortsInput.disabled = true;
                    customPortsInput.required = false;
                    customPortsInput.value = '';
                    customPortsInput.style.backgroundColor = '#1a0a2e';
                    customPortsInput.style.color = '#666';
                    customPortsInput.style.borderColor = '#2d1b69';
                    customPortsInput.style.boxShadow = 'none';
                }
            });
            
            // Add validation for custom ports input
            customPortsInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                if (value) {
                    const isValid = PortScanning.validateCustomPorts(value);
                    if (isValid) {
                        customPortsInput.style.borderColor = '#7c3aed';
                        customPortsInput.style.boxShadow = '0 0 5px rgba(124, 58, 237, 0.3)';
                        
                        // Show port count
                        const count = PortScanning.countCustomPorts(value);
                        Utils.showMessage(`✅ Valid format - ${count} ports will be scanned`, 'success', 'port-scan-messages');
                    } else {
                        customPortsInput.style.borderColor = '#dc2626';
                        customPortsInput.style.boxShadow = '0 0 5px rgba(220, 38, 38, 0.3)';
                        Utils.showMessage('❌ Invalid format. Use: 22,80,443 or 8000-8100', 'error', 'port-scan-messages');
                    }
                } else {
                    customPortsInput.style.borderColor = '#7c3aed';
                    customPortsInput.style.boxShadow = '0 0 5px rgba(124, 58, 237, 0.3)';
                }
            });
        }

        // Scan target - update scan subdomains when target changes
        const scanTargetSelect = document.getElementById('port-scan-target');
        if (scanTargetSelect) {
            scanTargetSelect.addEventListener('change', async () => {
                await this.loadScanSubdomains();
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
        console.log('🔄 Starting real-time updates for port scanning jobs');
        
        // Clear any existing intervals
        this.cleanup();
        
        // Start aggressive refresh during active scans (every 2 seconds)
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'port-scanning') {
                try {
                    await this.updateScansRealTime();
                } catch (error) {
                    console.error('Real-time port scanning jobs update failed:', error);
                }
            }
        }, 2000); // Update every 2 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    // Real-time scans update
    async updateScansRealTime() {
        try {
            const response = await API.scans.getJobs({ job_type: 'port_scan' });
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
            console.error('Real-time port scanning jobs update failed:', error);
        }
    },

    updateScanStatus(scans, runningScans) {
        const statusSpan = document.getElementById('port-scan-status');
        if (!statusSpan) return;
        
        if (runningScans.length > 0) {
            const totalProgress = runningScans.reduce((sum, scan) => sum + (scan.progress_percentage || 0), 0);
            const avgProgress = Math.round(totalProgress / runningScans.length);
            
            statusSpan.innerHTML = `🔄 ${runningScans.length} port scan${runningScans.length > 1 ? 's' : ''} running (${avgProgress}% avg)`;
            statusSpan.style.color = '#a855f7';
            statusSpan.classList.add('status-updating');
        } else {
            const completedScans = scans.filter(scan => scan.status === 'completed').length;
            
            // FIXED: Use correct property names to calculate total open ports
            const totalPorts = scans
                .filter(scan => scan.status === 'completed')
                .reduce((total, scan) => {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        
                        // FIXED: Look for the correct property names from the backend
                        return total + (
                            results?.open_ports ||          // Primary field from backend (number)
                            results?.total_ports ||         // Secondary field
                            results?.open_ports_count ||    // Legacy field  
                            results?.ports_found ||         // Legacy field
                            results?.open_ports?.length ||  // If it's an array
                            0
                        );
                    } catch (error) {
                        console.warn('Failed to parse port scan results:', error);
                        return total;
                    }
                }, 0);
            
            if (completedScans > 0) {
                statusSpan.innerHTML = `✅ ${completedScans} scan${completedScans > 1 ? 's' : ''} completed | 🔌 ${totalPorts} total open ports found`;
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

            // Update scan target dropdown
            const scanTargetSelect = document.getElementById('port-scan-target');
            if (scanTargetSelect) {
                const currentValue = scanTargetSelect.value;
                scanTargetSelect.innerHTML = '<option value="">Select target...</option>';
                
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    scanTargetSelect.appendChild(option);
                });

                if (currentValue && targets.find(t => t.id == currentValue)) {
                    scanTargetSelect.value = currentValue;
                    await this.loadScanSubdomains();
                }
            }

            console.log(`Loaded ${targets.length} targets for port scanning`);
            
        } catch (error) {
            console.error('Failed to load targets for port scanning:', error);
        }
    },

    // Load subdomains for scan form
    async loadScanSubdomains() {
        try {
            const targetId = document.getElementById('port-scan-target')?.value;
            const subdomainSelect = document.getElementById('port-scan-subdomain');
            
            if (!subdomainSelect) return;

            const currentValue = subdomainSelect.value;
            subdomainSelect.innerHTML = '<option value="">All active subdomains</option>';
            
            if (!targetId) return;

            const response = await API.subdomains.getAll({ 
                target_id: targetId,
                status: 'active', // Only load active subdomains for scanning
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
            console.error('Failed to load subdomains for port scan:', error);
        }
    },

    async load() {
        try {
            // Only load port_scan jobs
            const response = await API.scans.getJobs({ job_type: 'port_scan' });
            if (!response) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            console.log('🔌 Loaded port scanning jobs data:', scans); // Debug log
            
            this.renderScansList(scans);
            this.updateScanStatus(scans, scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            ));
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('Failed to load port scanning jobs:', error);
            document.getElementById('port-scans-list').innerHTML = 
                '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Failed to load port scanning jobs</td></tr>';
        }
    },

    renderScansList(scans) {
        const scansList = document.getElementById('port-scans-list');
        
        if (scans.length > 0) {
            scansList.innerHTML = scans.map(scan => {
                // Enhanced target name resolution
                const targetName = this.getTargetName(scan);
                const isRunning = scan.status === 'running' || scan.status === 'pending';
                
                console.log(`🎯 Port Scan ${scan.id}: target_domain="${scan.target_domain}", domain="${scan.domain}", target_id="${scan.target_id}", resolved="${targetName}"`); // Debug log
                
                // FIXED: Extract ports count from results using correct property names
                let portsCount = '-';
                if (scan.status === 'completed' && scan.results) {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        
                        // FIXED: Look for the actual property names the backend returns
                        portsCount = (
                            results.open_ports ||          // Primary field from backend (number)
                            results.total_ports ||         // Secondary field
                            results.open_ports_count ||    // Legacy field  
                            results.ports_found ||         // Legacy field
                            results.open_ports?.length ||  // If it's an array
                            0
                        );
                        
                        console.log(`📊 Scan ${scan.id} ports count: ${portsCount}`, results); // Debug log
                        
                    } catch (error) {
                        console.warn('Failed to parse scan results for scan', scan.id, ':', error);
                        portsCount = 'Parse Error';
                    }
                } else if (isRunning) {
                    portsCount = '🔄 Scanning...';
                }
                
                return `
                    <tr class="${isRunning ? 'progress-row' : ''}">
                        <td style="font-family: 'Courier New', monospace;">${scan.id}</td>
                        <td style="color: #7c3aed; font-weight: bold;" title="Target ID: ${scan.target_id}">${targetName}</td>
                        <td>Port Scan</td>
                        <td><span class="status status-${scan.status} ${isRunning ? 'status-updating' : ''}">${scan.status.toUpperCase()}</span></td>
                        <td>
                            <div style="background-color: #2d1b69; border: 1px solid #7c3aed; height: 8px; width: 100px;">
                                <div style="background: linear-gradient(90deg, #7c3aed, #9a4dff); height: 100%; width: ${scan.progress_percentage || 0}%; transition: width 0.3s ease;"></div>
                            </div>
                            <span style="font-size: 13px; color: #6b46c1;">${scan.progress_percentage || 0}%</span>
                        </td>
                        <td style="font-weight: bold; color: ${scan.status === 'completed' ? '#7c3aed' : '#666'};">
                            ${portsCount}
                        </td>
                        <td style="font-size: 12px; color: #666;">${new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>
                            ${scan.status === 'completed' ? 
                                `<div style="position: relative; display: inline-block;">
                                    <button onclick="PortScanning.toggleExportMenu(${scan.id})" class="btn btn-secondary btn-small" id="export-btn-${scan.id}">📤 Export Ports</button>
                                    <div id="export-menu-${scan.id}" class="export-menu" style="display: none; position: absolute; top: 100%; left: 0; background: #000; border: 2px solid #7c3aed; min-width: 120px; z-index: 1000;">
                                        <button onclick="PortScanning.exportResults(${scan.id}, 'csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📊 CSV</button>
                                        <button onclick="PortScanning.exportResults(${scan.id}, 'json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📋 JSON</button>
                                        <button onclick="PortScanning.exportResults(${scan.id}, 'xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                                    </div>
                                </div>` :
                                scan.status === 'running' ? 
                                `<button onclick="PortScanning.stopScan(${scan.id})" class="btn btn-danger btn-small">Stop</button>` :
                                '-'
                            }
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            scansList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b46c1;">No port scans yet. Start your first scan above!</td></tr>';
        }
    },

    async startPortScan() {
        const targetId = document.getElementById('port-scan-target').value;
        const subdomainId = document.getElementById('port-scan-subdomain').value;
        const profile = document.getElementById('port-scan-profile').value;
        const customPorts = document.getElementById('custom-ports').value.trim();
        const technique = document.getElementById('scan-technique').value;
        const serviceDetection = document.getElementById('service-detection').value;
        const timing = document.getElementById('timing-template').value;
        const maxParallel = document.getElementById('max-parallel').value;
        const liveHostsOnly = document.getElementById('live-hosts-only').value === 'true';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'port-scan-messages');
            return;
        }
        
        // Enhanced custom ports validation
        if (profile === 'custom') {
            if (!customPorts) {
                Utils.showMessage('Please specify custom ports for custom scan', 'error', 'port-scan-messages');
                document.getElementById('custom-ports').focus();
                return;
            }
            
            if (!this.validateCustomPorts(customPorts)) {
                Utils.showMessage('Invalid port format. Use: 22,80,443 or 8000-8100 or combinations like 22,80,443,8080-8090', 'error', 'port-scan-messages');
                document.getElementById('custom-ports').focus();
                return;
            }
            
            // Count total ports for estimation
            const portCount = this.countCustomPorts(customPorts);
            if (portCount > 1000) {
                if (!confirm(`You specified ${portCount} ports. This may take a long time. Continue?`)) {
                    return;
                }
            }
            
            Utils.showMessage(`✅ Custom ports validated: ${portCount} ports to scan`, 'success', 'port-scan-messages');
        }
        
        try {
            // Set button loading state
            const scanBtn = document.getElementById('port-scan-btn');
            if (scanBtn) {
                scanBtn.disabled = true;
                scanBtn.innerHTML = '<span class="spinner"></span>Starting Scan...';
            }
            
            const scanTypes = ['port_scan'];
            const config = {
                subdomain_id: subdomainId || null,
                port_profile: profile,
                custom_ports: profile === 'custom' ? customPorts : null,
                scan_technique: technique,
                service_detection: serviceDetection,
                timing_template: timing,
                max_parallel: parseInt(maxParallel),
                live_hosts_only: liveHostsOnly
            };
            
            // Show appropriate scanning message
            let scanMessage = '🔌 Starting port scan...';
            if (profile === 'custom') {
                const portCount = this.countCustomPorts(customPorts);
                scanMessage = `🔌 Starting custom port scan on ${portCount} ports...`;
            } else {
                scanMessage = `🔌 Starting ${profile} port scan...`;
            }
            
            Utils.showMessage(scanMessage, 'info', 'port-scan-messages');
            
            const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('Port scan started:', data);
                
                let successMessage = '';
                if (profile === 'custom') {
                    const portCount = this.countCustomPorts(customPorts);
                    successMessage = `🔌 Custom port scan started! Scanning ${portCount} custom ports (${customPorts})${subdomainId ? ' on selected subdomain' : ' on all active subdomains'}.`;
                } else {
                    successMessage = `🔌 Port scan started successfully! Scanning ${profile} ports${subdomainId ? ' on selected subdomain' : ' on all active subdomains'}.`;
                }
                successMessage += ' Results will appear below as they are discovered.';
                
                Utils.showMessage(successMessage, 'success', 'port-scan-messages');
                
                // Reset form (but preserve custom ports if they were valid)
                document.getElementById('port-scan-subdomain').value = '';
                if (profile !== 'custom') {
                    document.getElementById('port-scan-profile').value = 'top-1000';
                }
                
                // Immediately refresh and enable aggressive updates
                await this.load();
                this.startRealTimeUpdates();
                
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start port scan: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'port-scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start port scan: ' + error.message, 'error', 'port-scan-messages');
        } finally {
            // Reset button
            const scanBtn = document.getElementById('port-scan-btn');
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.innerHTML = '🔌 Start Port Scan';
            }
        }
    },

    // Count total ports in custom ports string
    countCustomPorts(portsString) {
        let total = 0;
        const parts = portsString.split(',');
        
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(p => parseInt(p.trim()));
                total += (end - start + 1);
            } else {
                total += 1;
            }
        }
        
        return total;
    },

    // Validate custom ports input
    validateCustomPorts(portsString) {
        if (!portsString || !portsString.trim()) {
            return false;
        }
        
        const portPattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;
        if (!portPattern.test(portsString.trim())) {
            return false;
        }
        
        // Check individual ports and ranges
        const parts = portsString.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(p => parseInt(p.trim()));
                if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0 || start > 65535 || end > 65535 || start >= end) {
                    return false;
                }
            } else {
                const port = parseInt(trimmed);
                if (isNaN(port) || port <= 0 || port > 65535) {
                    return false;
                }
            }
        }
        
        return true;
    },

    // Cleanup method for tab switching
    cleanup() {
        console.log('🧹 Cleaning up port scanning module intervals');
        
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

    // Fixed Port Scanning Export Functions - Replace these methods in port-scanning.js

    async exportResults(scanId, format) {
        try {
            // Hide the export menu
            const menu = document.getElementById(`export-menu-${scanId}`);
            if (menu) menu.style.display = 'none';
            
            // Show loading message
            Utils.showMessage(`Exporting port scan results as ${format.toUpperCase()}...`, 'info', 'port-scan-messages');
            
            const response = await API.scans.get(scanId);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success && data.data) {
                const scanData = data.data;
                const results = scanData.results || {};
                
                // DEBUG: Log the actual results structure to see what we have
                console.log('🔍 Port Scan Export Debug:');
                console.log('Results object:', results);
                console.log('Results keys:', Object.keys(results));
                console.log('Full results JSON:', JSON.stringify(results, null, 2));
                
                // Get target name for export
                const targetName = this.getTargetName(scanData);
                
                // Prepare export data
                const exportData = {
                    scan_id: scanId,
                    target: targetName,
                    scan_type: 'Port Scan',
                    status: scanData.status,
                    created_at: scanData.created_at,
                    completed_at: scanData.completed_at,
                    results: results
                };
                
                // Generate and download file based on format
                switch (format.toLowerCase()) {
                    case 'csv':
                        this.downloadPortScanCSV(exportData, scanId);
                        break;
                    case 'json':
                        this.downloadPortScanJSON(exportData, scanId);
                        break;
                    case 'xml':
                        this.downloadPortScanXML(exportData, scanId);
                        break;
                    default:
                        throw new Error('Unsupported export format');
                }
                
                Utils.showMessage(`Port scan results exported successfully as ${format.toUpperCase()}!`, 'success', 'port-scan-messages');
                
            } else {
                Utils.showMessage('No results available for export.', 'warning', 'port-scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to export results: ' + error.message, 'error', 'port-scan-messages');
        }
    },

    // ENHANCED: Look for all possible port data structures
    findPortData(results) {
        // Try multiple possible locations for port data
        const possiblePortSources = [
            results.open_ports_data,     // Detailed port info
            results.port_details,        // Detailed port info
            results.ports_found,         // Array of port objects
            results.discovered_ports,    // Array of port objects
            results.ports,              // Array of port objects
            results.nmap_results,       // nmap specific results
            results.scan_results,       // Generic scan results
            results.host_results,       // Host-based results
            results.port_scan_results   // Port scan specific results
        ];
        
        for (const source of possiblePortSources) {
            if (Array.isArray(source) && source.length > 0) {
                console.log('✅ Found port data in:', source);
                return source;
            }
        }
        
        // If no array found, check if we have individual port data scattered in results
        if (results.open_ports && typeof results.open_ports === 'number' && results.open_ports > 0) {
            // We have a count but no details - create summary entries
            console.log('⚠️ Only port count found, no detailed port data');
            return this.createPortSummaryData(results);
        }
        
        console.log('❌ No port data found in any expected location');
        return [];
    },

    // Create summary data when only counts are available
    createPortSummaryData(results) {
        const portCount = results.open_ports || results.total_ports || 0;
        const summaryData = [];
        
        if (portCount > 0) {
            // Create a summary entry since we don't have detailed port info
            summaryData.push({
                summary: true,
                port_count: portCount,
                note: 'Detailed port information not available in scan results',
                scan_summary: `${portCount} open ports detected`,
                target_info: results.target_summary || 'Target information not available'
            });
        }
        
        return summaryData;
    },

    downloadPortScanCSV(data, scanId) {
        let csvContent = 'Scan ID,Target,Scan Type,Status,Created,Completed,Open Ports Count\n';
        
        // Get the actual port count
        const portsCount = data.results.open_ports || data.results.total_ports || data.results.open_ports_count || data.results.ports_found || 0;
        csvContent += `${data.scan_id},"${data.target}","${data.scan_type}","${data.status}","${data.created_at}","${data.completed_at || 'N/A'}","${portsCount}"\n\n`;
        
        // Try to find actual port data
        const portData = this.findPortData(data.results);
        
        if (portData.length > 0) {
            if (portData[0].summary) {
                // Summary data only
                csvContent += 'SCAN SUMMARY\n';
                csvContent += 'Total Open Ports,Note\n';
                portData.forEach(item => {
                    csvContent += `"${item.port_count}","${item.note}"\n`;
                });
            } else {
                // Detailed port data
                csvContent += 'DETAILED PORT INFORMATION\n';
                csvContent += 'Port,Protocol,Service,Version,State,Banner,Host\n';
                portData.forEach(port => {
                    csvContent += `"${port.port || port.port_number || 'N/A'}","${port.protocol || 'TCP'}","${port.service || port.service_name || 'N/A'}","${port.version || port.service_version || 'N/A'}","${port.state || 'open'}","${port.banner || port.service_banner || 'N/A'}","${port.host || port.hostname || port.ip || 'N/A'}"\n`;
                });
            }
        } else {
            // No data found at all
            csvContent += 'SCAN RESULTS\n';
            csvContent += 'Status,Message\n';
            csvContent += `"No detailed port data","Port scan completed but detailed results not available in export. Total ports found: ${portsCount}"\n`;
            
            // Add all available result properties for debugging
            csvContent += '\nAVAILABLE RESULT PROPERTIES\n';
            csvContent += 'Property,Value\n';
            Object.entries(data.results).forEach(([key, value]) => {
                const valueStr = typeof value === 'object' ? JSON.stringify(value).substring(0, 200) : String(value);
                csvContent += `"${key}","${valueStr.replace(/"/g, '""')}"\n`;
            });
        }
        
        this.downloadFile(csvContent, `port_scan_${scanId}_results.csv`, 'text/csv');
    },

    downloadPortScanJSON(data, scanId) {
        // Add port data analysis to JSON export
        const portData = this.findPortData(data.results);
        
        const enhancedData = {
            ...data,
            port_analysis: {
                ports_found: portData,
                port_count: data.results.open_ports || data.results.total_ports || 0,
                has_detailed_data: portData.length > 0 && !portData[0]?.summary,
                export_note: portData.length === 0 ? 'No detailed port data found in scan results' : 'Port data included'
            }
        };
        
        const jsonContent = JSON.stringify(enhancedData, null, 2);
        this.downloadFile(jsonContent, `port_scan_${scanId}_results.json`, 'application/json');
    },

    downloadPortScanXML(data, scanId) {
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<port_scan_results>\n';
        xmlContent += `  <scan_id>${data.scan_id}</scan_id>\n`;
        xmlContent += `  <target>${this.escapeXml(data.target)}</target>\n`;
        xmlContent += `  <scan_type>${this.escapeXml(data.scan_type)}</scan_type>\n`;
        xmlContent += `  <status>${this.escapeXml(data.status)}</status>\n`;
        xmlContent += `  <created_at>${this.escapeXml(data.created_at)}</created_at>\n`;
        xmlContent += `  <completed_at>${this.escapeXml(data.completed_at || 'N/A')}</completed_at>\n`;
        
        const portsCount = data.results.open_ports || data.results.total_ports || data.results.open_ports_count || data.results.ports_found || 0;
        xmlContent += `  <open_ports_count>${portsCount}</open_ports_count>\n`;
        
        xmlContent += '  <results>\n';
        
        // Try to find actual port data
        const portData = this.findPortData(data.results);
        
        if (portData.length > 0) {
            if (portData[0].summary) {
                // Summary data only
                xmlContent += '    <scan_summary>\n';
                portData.forEach(item => {
                    xmlContent += `      <summary>\n`;
                    xmlContent += `        <port_count>${item.port_count}</port_count>\n`;
                    xmlContent += `        <note>${this.escapeXml(item.note)}</note>\n`;
                    xmlContent += `      </summary>\n`;
                });
                xmlContent += '    </scan_summary>\n';
            } else {
                // Detailed port data
                xmlContent += '    <open_ports>\n';
                portData.forEach(port => {
                    xmlContent += `      <port>\n`;
                    xmlContent += `        <port_number>${this.escapeXml(port.port || port.port_number || 'N/A')}</port_number>\n`;
                    xmlContent += `        <protocol>${this.escapeXml(port.protocol || 'TCP')}</protocol>\n`;
                    xmlContent += `        <service>${this.escapeXml(port.service || port.service_name || 'N/A')}</service>\n`;
                    xmlContent += `        <version>${this.escapeXml(port.version || port.service_version || 'N/A')}</version>\n`;
                    xmlContent += `        <state>${this.escapeXml(port.state || 'open')}</state>\n`;
                    xmlContent += `        <banner>${this.escapeXml(port.banner || port.service_banner || 'N/A')}</banner>\n`;
                    xmlContent += `        <host>${this.escapeXml(port.host || port.hostname || port.ip || 'N/A')}</host>\n`;
                    xmlContent += `      </port>\n`;
                });
                xmlContent += '    </open_ports>\n';
            }
        } else {
            // No detailed data available
            xmlContent += '    <scan_info>\n';
            xmlContent += `      <message>Port scan completed but detailed results not available in export</message>\n`;
            xmlContent += `      <total_ports_found>${portsCount}</total_ports_found>\n`;
            xmlContent += '    </scan_info>\n';
            
            // Add available properties for debugging
            xmlContent += '    <available_properties>\n';
            Object.entries(data.results).forEach(([key, value]) => {
                const valueStr = typeof value === 'object' ? JSON.stringify(value).substring(0, 200) : String(value);
                xmlContent += `      <property name="${this.escapeXml(key)}">${this.escapeXml(valueStr)}</property>\n`;
            });
            xmlContent += '    </available_properties>\n';
        }
        
        xmlContent += '  </results>\n';
        xmlContent += '</port_scan_results>';
        
        this.downloadFile(xmlContent, `port_scan_${scanId}_results.xml`, 'application/xml');
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
        if (confirm('Are you sure you want to stop this port scan?')) {
            try {
                const response = await API.scans.stop(scanId);
                if (response && response.ok) {
                    await this.load();
                    Utils.showMessage('Port scan stopped successfully!', 'success');
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

window.PortScanning = PortScanning;
// frontend/assets/js/modules/port-scanning.js - ENHANCED WITH SERVICE LOADING INDICATORS

const PortScanning = {
    refreshInterval: null,
    activeScanJobId: null,
    isScanning: false,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.load();
        this.startAutoRefresh(); // Start real-time updates
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
            </style>

            <!-- Real-time status indicator -->
            <div id="port-scan-status" style="display: none; background: linear-gradient(135deg, #1a0a2e, #2d1b69); border: 2px solid #7c3aed; padding: 12px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="spinner" style="margin: 0;"></div>
                    <span id="port-scan-status-text" style="color: #7c3aed; font-family: 'Courier New', monospace;">Port scan in progress...</span>
                    <button onclick="PortScanning.stopActiveScan()" class="btn btn-danger btn-small" style="margin-left: auto;">Stop Scan</button>
                </div>
                <div id="port-scan-progress" style="margin-top: 8px;">
                    <div style="background-color: #2d1b69; border: 1px solid #7c3aed; height: 8px; width: 100%;">
                        <div id="port-scan-progress-bar" style="background: linear-gradient(90deg, #7c3aed, #9a4dff); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                    </div>
                    <div id="port-scan-progress-text" style="font-size: 12px; color: #9a4dff; margin-top: 4px;"></div>
                </div>
            </div>

            <div class="scan-info">
                <h4>🔌 Port Scanning <span id="port-scan-live-indicator" style="color: #7c3aed; font-size: 12px;">[LIVE]</span></h4>
                <p>Discover open ports and services on your targets using nmap. Scans update automatically in real-time.</p>
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

            <div class="filters">
                <div class="filter-group">
                    <label>Target</label>
                    <select id="port-target-filter">
                        <option value="">All Targets</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Subdomain</label>
                    <select id="port-subdomain-filter">
                        <option value="">All Subdomains</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Subdomain Status</label>
                    <select id="subdomain-status-filter">
                        <option value="">All Status</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Port State</label>
                    <select id="port-state-filter">
                        <option value="">All States</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="filtered">Filtered</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Service</label>
                    <input type="text" id="service-search" placeholder="Search services...">
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="PortScanning.search()" class="btn btn-primary">🔍 Search</button>
                    <button onclick="PortScanning.toggleAutoRefresh()" class="btn btn-secondary" id="port-auto-refresh-toggle">
                        ⏸️ Pause Live Updates
                    </button>
                </div>
            </div>

            <div class="card">
                <div class="card-title">
                    Discovered Ports & Services
                    <div style="float: right; position: relative; display: inline-block;">
                        <button onclick="PortScanning.toggleExportMenu()" class="btn btn-success btn-small" id="export-ports-btn">
                            📤 Export Services
                        </button>
                        <div id="export-ports-menu" class="export-menu" style="display: none; position: absolute; top: 100%; right: 0; min-width: 140px; z-index: 1000;">
                            <button onclick="PortScanning.exportPorts('csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📊 CSV</button>
                            <button onclick="PortScanning.exportPorts('json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📋 JSON</button>
                            <button onclick="PortScanning.exportPorts('xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                        </div>
                    </div>
                    <span id="last-updated" style="font-size: 12px; color: #666; float: right; margin-right: 160px;"></span>
                </div>
                
                <!-- Port Stats -->
                <div id="port-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; border: 1px solid #2d1b69; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                    <div style="text-align: center;">
                        <div id="total-ports" style="font-size: 24px; font-weight: bold; color: #7c3aed;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Total Ports</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="open-ports" style="font-size: 24px; font-weight: bold; color: #7c3aed;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Open Ports</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="unique-services" style="font-size: 24px; font-weight: bold; color: #eab308;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Unique Services</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="high-risk-ports" style="font-size: 24px; font-weight: bold; color: #ea580c;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">High Risk Ports</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="scanning-status" style="font-size: 14px; font-weight: bold; color: #9a4dff;">
                            ${this.isScanning ? '🔄 Scanning...' : '💤 Idle'}
                        </div>
                        <div style="font-size: 12px; color: #6b46c1;">Scan Status</div>
                    </div>
                </div>

                <!-- Service Loading Indicator -->
                <div id="services-loading" style="display: none; margin-bottom: 15px; padding: 12px; border: 1px solid #7c3aed; background: linear-gradient(135deg, #1a0a2e, #2d1b69); text-align: center;">
                    <div style="display: inline-flex; align-items: center; gap: 10px;">
                        <div class="spinner" style="margin: 0;"></div>
                        <span style="color: #7c3aed; font-family: 'Courier New', monospace; font-size: 14px;">
                            🔍 Discovering services and ports...
                        </span>
                    </div>
                    <div style="margin-top: 8px; font-size: 12px; color: #9a4dff;">
                        Services will appear here as they are discovered
                    </div>
                </div>

                <!-- Port Details Modal -->
                <div id="port-details-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 10000; justify-content: center; align-items: center;">
                    <div style="background: linear-gradient(135deg, #0f0f23, #1a0a2e); border: 2px solid #7c3aed; padding: 30px; max-width: 600px; width: 90%; max-height: 80%; overflow-y: auto; position: relative;">
                        <button onclick="PortScanning.closePortDetails()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: #7c3aed; font-size: 24px; cursor: pointer;">×</button>
                        
                        <div id="port-details-content">
                            <!-- Content will be populated dynamically -->
                        </div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Subdomain</th>
                                <th>Port</th>
                                <th>Protocol</th>
                                <th>State</th>
                                <th>Service</th>
                                <th>Version</th>
                                <th>Risk</th>
                                <th>Discovered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="ports-list">
                            <tr>
                                <td colspan="9" style="text-align: center; color: #9a4dff;">Loading ports...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="ports-pagination" class="pagination"></div>
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

        // Target filter - update subdomains when target changes
        const targetFilter = document.getElementById('port-target-filter');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
                this.search(1);
            });
        }

        // Scan target - update scan subdomains when target changes
        const scanTargetSelect = document.getElementById('port-scan-target');
        if (scanTargetSelect) {
            scanTargetSelect.addEventListener('change', async () => {
                await this.loadScanSubdomains();
            });
        }

        // Other filters
        ['port-subdomain-filter', 'subdomain-status-filter', 'port-state-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.search(1));
            }
        });

        // Service search with debounce and Enter key support
        const serviceSearch = document.getElementById('service-search');
        if (serviceSearch) {
            serviceSearch.addEventListener('input', Utils.debounce(() => this.search(1), 500));
            serviceSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.search(1);
                }
            });
        }

        // Close export menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#export-ports-menu') && !e.target.closest('#export-ports-btn')) {
                const menu = document.getElementById('export-ports-menu');
                if (menu) {
                    menu.style.display = 'none';
                }
            }
            
            // Close port details modal when clicking outside
            if (e.target.id === 'port-details-modal') {
                this.closePortDetails();
            }
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePortDetails();
            }
        });
    },

    // Search method
    async search(page = 1) {
        console.log('🔍 Search triggered for port scanning');
        
        // Show searching message in services table
        const portsList = document.getElementById('ports-list');
        if (portsList) {
            portsList.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #a855f7;">🔍 Searching ports and services...</td></tr>';
        }
        
        await this.load(page);
    },

    // NEW: Start auto-refresh functionality
    startAutoRefresh() {
        // Stop any existing refresh
        this.stopAutoRefresh();
        
        console.log('🔄 Starting port scanning auto-refresh');
        
        this.refreshInterval = setInterval(async () => {
            try {
                // Check for active port scans
                await this.checkActiveScanJobs();
                
                // Refresh port data
                await this.load(AppState.currentPageData.ports?.page || 1);
                
                // Update last updated time
                document.getElementById('last-updated').textContent = 
                    `Last updated: ${new Date().toLocaleTimeString()}`;
                
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, 3000); // Refresh every 3 seconds
    },

    // NEW: Stop auto-refresh
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('🛑 Stopped port scanning auto-refresh');
        }
    },

    // Toggle auto-refresh
    toggleAutoRefresh() {
        if (this.refreshInterval) {
            this.stopAutoRefresh();
            const toggleBtn = document.getElementById('port-auto-refresh-toggle');
            if (toggleBtn) {
                toggleBtn.innerHTML = '▶️ Resume Live Updates';
            }
            Utils.showMessage('Live updates paused', 'warning', 'port-scan-messages');
        } else {
            this.startAutoRefresh();
            const toggleBtn = document.getElementById('port-auto-refresh-toggle');
            if (toggleBtn) {
                toggleBtn.innerHTML = '⏸️ Pause Live Updates';
            }
            Utils.showMessage('Live updates resumed', 'success', 'port-scan-messages');
        }
    },

    // NEW: Check for active port scan jobs
    async checkActiveScanJobs() {
        try {
            const response = await API.scans.getJobs({ 
                job_type: 'port_scan',
                status: ['pending', 'running'],
                limit: 50 
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const activeScans = data.success ? data.data : [];
                
                if (activeScans.length > 0) {
                    this.showScanProgress(activeScans[0]); // Show the most recent active scan
                    this.showServicesLoading(true);
                    this.isScanning = true;
                } else {
                    this.hideScanProgress();
                    this.showServicesLoading(false);
                    this.isScanning = false;
                }
                
                // Update scanning status in stats
                this.updateScanningStatus();
            }
        } catch (error) {
            console.error('Failed to check active scan jobs:', error);
        }
    },

    // NEW: Show/hide services loading indicator
    showServicesLoading(show) {
        const loadingDiv = document.getElementById('services-loading');
        if (loadingDiv) {
            loadingDiv.style.display = show ? 'block' : 'none';
        }
    },

    // NEW: Update scanning status in stats
    updateScanningStatus() {
        const statusElement = document.getElementById('scanning-status');
        if (statusElement) {
            if (this.isScanning) {
                statusElement.innerHTML = '🔄 Scanning...';
                statusElement.style.color = '#a855f7';
                statusElement.style.animation = 'pulse 2s infinite';
            } else {
                statusElement.innerHTML = '💤 Idle';
                statusElement.style.color = '#6b46c1';
                statusElement.style.animation = 'none';
            }
        }
    },

    // NEW: Show scan progress
    showScanProgress(scan) {
        const statusDiv = document.getElementById('port-scan-status');
        const statusText = document.getElementById('port-scan-status-text');
        const progressBar = document.getElementById('port-scan-progress-bar');
        const progressText = document.getElementById('port-scan-progress-text');
        
        if (statusDiv && statusText && progressBar && progressText) {
            this.activeScanJobId = scan.id;
            
            statusDiv.style.display = 'block';
            statusText.textContent = `Port scan in progress for ${scan.domain || 'target'}...`;
            
            const progress = scan.progress_percentage || 0;
            progressBar.style.width = `${progress}%`;
            
            const elapsed = scan.started_at ? 
                Math.round((Date.now() - new Date(scan.started_at).getTime()) / 1000) : 0;
            
            progressText.textContent = `Progress: ${progress}% • Elapsed: ${elapsed}s • Type: ${scan.job_type}`;
        }
    },

    // NEW: Hide scan progress
    hideScanProgress() {
        const statusDiv = document.getElementById('port-scan-status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
        this.activeScanJobId = null;
    },

    // NEW: Stop active scan
    async stopActiveScan() {
        if (this.activeScanJobId) {
            try {
                const response = await API.scans.stop(this.activeScanJobId);
                if (response && response.ok) {
                    Utils.showMessage('Port scan stopped successfully!', 'success', 'port-scan-messages');
                    this.hideScanProgress();
                    this.showServicesLoading(false);
                    this.isScanning = false;
                    this.updateScanningStatus();
                } else {
                    Utils.showMessage('Failed to stop port scan', 'error', 'port-scan-messages');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop scan: ' + error.message, 'error', 'port-scan-messages');
            }
        }
    },

    // Load targets for dropdowns
    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            // Update filter dropdown
            const targetSelect = document.getElementById('port-target-filter');
            if (targetSelect) {
                const currentValue = targetSelect.value;
                targetSelect.innerHTML = '<option value="">All Targets</option>';
                
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    targetSelect.appendChild(option);
                });

                if (currentValue && targets.find(t => t.id == currentValue)) {
                    targetSelect.value = currentValue;
                }
            }

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
            await this.loadSubdomains();
            
        } catch (error) {
            console.error('Failed to load targets for port scanning:', error);
        }
    },

    // Load subdomains for filtering
    async loadSubdomains() {
        try {
            const targetId = document.getElementById('port-target-filter')?.value;
            const subdomainSelect = document.getElementById('port-subdomain-filter');
            
            if (!subdomainSelect) return;

            const currentValue = subdomainSelect.value;
            subdomainSelect.innerHTML = '<option value="">All Subdomains</option>';
            
            if (!targetId) {
                const response = await API.subdomains.getAll({ limit: 1000 });
                if (response && response.ok) {
                    const data = await response.json();
                    const subdomains = data.success ? data.data : [];
                    
                    subdomains.forEach(subdomain => {
                        const option = document.createElement('option');
                        option.value = subdomain.id;
                        option.textContent = `${subdomain.subdomain} (${subdomain.target_domain})`;
                        subdomainSelect.appendChild(option);
                    });
                }
            } else {
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
            }
            
            if (currentValue) {
                const optionExists = Array.from(subdomainSelect.options).some(option => option.value === currentValue);
                if (optionExists) {
                    subdomainSelect.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('Failed to load subdomains for port filter:', error);
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

    async load(page = 1) {
        try {
            const targetId = document.getElementById('port-target-filter')?.value;
            const subdomainId = document.getElementById('port-subdomain-filter')?.value;
            const subdomainStatus = document.getElementById('subdomain-status-filter')?.value;
            const portState = document.getElementById('port-state-filter')?.value;
            const serviceSearch = document.getElementById('service-search')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (subdomainStatus) params.subdomain_status = subdomainStatus;
            if (portState) params.state = portState;
            if (serviceSearch && serviceSearch.trim()) params.service_search = serviceSearch.trim();

            const response = await API.ports.getAll(params);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success) {
                const ports = data.data;
                AppState.currentPageData.ports = { page, total: data.pagination.total };
                
                this.renderPortsList(ports);
                this.updatePortStats(ports);
                
                // Show search result messages
                if (serviceSearch && serviceSearch.trim()) {
                    const resultMessage = `Found ${ports.length} ports with service "${serviceSearch.trim()}"`;
                    if (ports.length === 0) {
                        Utils.showMessage('No ports found matching your search criteria', 'warning', 'port-scan-messages');
                    } else {
                        Utils.showMessage(resultMessage, 'success', 'port-scan-messages');
                    }
                }
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('ports', data.pagination);
                } else {
                    document.getElementById('ports-pagination').innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Failed to load ports:', error);
            document.getElementById('ports-list').innerHTML = 
                '<tr><td colspan="9" style="text-align: center; color: #dc2626;">Failed to load ports</td></tr>';
        }
    },

    renderPortsList(ports) {
        const portsList = document.getElementById('ports-list');
        
        if (ports.length > 0) {
            portsList.innerHTML = ports.map(port => `
                <tr>
                    <td style="font-weight: 600; color: #7c3aed;">${port.subdomain || port.hostname}</td>
                    <td style="font-family: 'Courier New', monospace; color: #9a4dff; font-weight: bold;">${port.port}</td>
                    <td>${port.protocol?.toUpperCase() || 'TCP'}</td>
                    <td><span class="status ${this.getStateColor(port.state)}">${port.state?.toUpperCase()}</span></td>
                    <td style="color: #9a4dff;">${port.service || '-'}</td>
                    <td style="font-size: 12px; color: #666;">${port.version || '-'}</td>
                    <td><span class="status ${this.getRiskColor(port.port, port.service)}">${this.getRiskLevel(port.port, port.service)}</span></td>
                    <td style="font-size: 12px; color: #666;">${new Date(port.created_at).toLocaleDateString()}</td>
                    <td>
                        <button onclick="PortScanning.viewPortDetails(${port.id})" class="btn btn-secondary btn-small">Details</button>
                        ${port.service && port.service !== 'unknown' ? 
                            `<button onclick="PortScanning.testService('${port.subdomain}', ${port.port}, '${port.service}')" class="btn btn-success btn-small">Test</button>` : 
                            ''
                        }
                    </td>
                </tr>
            `).join('');
        } else if (this.isScanning) {
            portsList.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; color: #a855f7; padding: 20px;">
                        <div style="display: inline-flex; align-items: center; gap: 10px;">
                            <div class="spinner" style="margin: 0;"></div>
                            <span>🔍 Port scan in progress... Services will appear here as they are discovered.</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            portsList.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #6b46c1;">No ports discovered yet. Run a port scan to discover open ports and services!</td></tr>';
        }
    },

    updatePortStats(ports) {
        const totalPorts = ports.length;
        const openPorts = ports.filter(p => p.state === 'open').length;
        const uniqueServices = new Set(ports.filter(p => p.service && p.service !== 'unknown').map(p => p.service)).size;
        const highRiskPorts = ports.filter(p => this.getRiskLevel(p.port, p.service) === 'HIGH').length;

        document.getElementById('total-ports').textContent = totalPorts;
        document.getElementById('open-ports').textContent = openPorts;
        document.getElementById('unique-services').textContent = uniqueServices;
        document.getElementById('high-risk-ports').textContent = highRiskPorts;
    },

    getStateColor(state) {
        switch(state?.toLowerCase()) {
            case 'open': return 'status-completed';
            case 'closed': return 'status-failed';
            case 'filtered': return 'status-pending';
            default: return 'status-inactive';
        }
    },

    getRiskLevel(port, service) {
        const highRiskPorts = [21, 22, 23, 25, 53, 135, 139, 445, 1433, 1521, 3389, 5432, 5900, 6379];
        const mediumRiskPorts = [80, 443, 993, 995, 110, 143, 993, 995, 8080, 8443];
        
        if (highRiskPorts.includes(parseInt(port))) return 'HIGH';
        if (mediumRiskPorts.includes(parseInt(port))) return 'MEDIUM';
        
        // Service-based risk assessment
        if (service) {
            const highRiskServices = ['ssh', 'telnet', 'ftp', 'smb', 'rdp', 'mysql', 'postgresql', 'redis'];
            const mediumRiskServices = ['http', 'https', 'smtp', 'imap', 'pop3'];
            
            if (highRiskServices.some(s => service.toLowerCase().includes(s))) return 'HIGH';
            if (mediumRiskServices.some(s => service.toLowerCase().includes(s))) return 'MEDIUM';
        }
        
        return 'LOW';
    },

    getRiskColor(port, service) {
        const risk = this.getRiskLevel(port, service);
        switch(risk) {
            case 'HIGH': return 'severity-high';
            case 'MEDIUM': return 'severity-medium';
            case 'LOW': return 'severity-low';
            default: return 'status-inactive';
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
                
                // Show services loading immediately
                this.showServicesLoading(true);
                this.isScanning = true;
                this.updateScanningStatus();
                
                let successMessage = '';
                if (profile === 'custom') {
                    const portCount = this.countCustomPorts(customPorts);
                    successMessage = `🔌 Custom port scan started! Scanning ${portCount} custom ports (${customPorts})${subdomainId ? ' on selected subdomain' : ' on all active subdomains'}.`;
                } else {
                    successMessage = `🔌 Port scan started successfully! Scanning ${profile} ports${subdomainId ? ' on selected subdomain' : ' on all active subdomains'}.`;
                }
                successMessage += ' Services will appear below as they are discovered.';
                
                Utils.showMessage(successMessage, 'success', 'port-scan-messages');
                
                // Reset form (but preserve custom ports if they were valid)
                document.getElementById('port-scan-subdomain').value = '';
                if (profile !== 'custom') {
                    document.getElementById('port-scan-profile').value = 'top-1000';
                }
                
                // Start checking for active scans immediately
                setTimeout(() => {
                    this.checkActiveScanJobs();
                }, 1000);
                
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

    async viewPortDetails(portId) {
        try {
            // Show loading in modal
            const modal = document.getElementById('port-details-modal');
            const content = document.getElementById('port-details-content');
            
            if (!modal || !content) return;
            
            content.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div class="spinner" style="margin: 0 auto 15px;"></div>
                    <div style="color: #7c3aed; font-family: 'Courier New', monospace;">Loading port details...</div>
                </div>
            `;
            
            modal.style.display = 'flex';
            
            // Fetch port details
            const response = await API.ports.get(portId);
            if (!response || !response.ok) {
                throw new Error('Failed to fetch port details');
            }
            
            const data = await response.json();
            const port = data.success ? data.data : null;
            
            if (!port) {
                throw new Error('Port not found');
            }
            
            // Render port details
            this.renderPortDetails(port);
            
        } catch (error) {
            console.error('Failed to load port details:', error);
            
            const content = document.getElementById('port-details-content');
            if (content) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div style="color: #dc2626; font-size: 18px; margin-bottom: 10px;">❌ Error</div>
                        <div style="color: #9a4dff;">Failed to load port details: ${error.message}</div>
                        <button onclick="PortScanning.closePortDetails()" class="btn btn-secondary" style="margin-top: 20px;">Close</button>
                    </div>
                `;
            }
        }
    },

    renderPortDetails(port) {
        const content = document.getElementById('port-details-content');
        if (!content) return;
        
        const riskLevel = this.getRiskLevel(port.port, port.service);
        const riskColor = this.getRiskColor(port.port, port.service);
        
        // Get service recommendations and security notes
        const serviceInfo = this.getServiceInfo(port.service, port.port);
        
        content.innerHTML = `
            <h2 style="color: #7c3aed; margin-bottom: 20px; text-align: center; text-transform: uppercase; letter-spacing: 2px;">
                🔌 Port ${port.port} Details
            </h2>
            
            <!-- Basic Information -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 15px; border: 1px solid #7c3aed;">
                    <h3 style="color: #7c3aed; margin-bottom: 10px; font-size: 14px;">🎯 Target Information</h3>
                    <div style="color: #9a4dff; font-family: 'Courier New', monospace; font-size: 13px;">
                        <div><strong>Hostname:</strong> ${port.subdomain || port.hostname || 'N/A'}</div>
                        <div style="margin-top: 5px;"><strong>IP Address:</strong> ${port.ip_address || 'N/A'}</div>
                        <div style="margin-top: 5px;"><strong>Target Domain:</strong> ${port.target_domain || 'N/A'}</div>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 15px; border: 1px solid #7c3aed;">
                    <h3 style="color: #7c3aed; margin-bottom: 10px; font-size: 14px;">🔌 Port Information</h3>
                    <div style="color: #9a4dff; font-family: 'Courier New', monospace; font-size: 13px;">
                        <div><strong>Port:</strong> ${port.port}</div>
                        <div style="margin-top: 5px;"><strong>Protocol:</strong> ${(port.protocol || 'TCP').toUpperCase()}</div>
                        <div style="margin-top: 5px;"><strong>State:</strong> <span class="status ${this.getStateColor(port.state)}" style="margin-left: 5px;">${(port.state || '').toUpperCase()}</span></div>
                    </div>
                </div>
            </div>
            
            <!-- Service Information -->
            <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 20px; border: 1px solid #7c3aed; margin-bottom: 25px;">
                <h3 style="color: #7c3aed; margin-bottom: 15px; font-size: 16px;">🛠️ Service Details</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                    <div>
                        <div style="color: #6b46c1; font-size: 12px; margin-bottom: 5px;">SERVICE</div>
                        <div style="color: #9a4dff; font-weight: bold;">${port.service || 'Unknown'}</div>
                    </div>
                    <div>
                        <div style="color: #6b46c1; font-size: 12px; margin-bottom: 5px;">VERSION</div>
                        <div style="color: #9a4dff; font-weight: bold;">${port.version || 'Not detected'}</div>
                    </div>
                    <div>
                        <div style="color: #6b46c1; font-size: 12px; margin-bottom: 5px;">RISK LEVEL</div>
                        <div><span class="status ${riskColor}" style="font-weight: bold;">${riskLevel}</span></div>
                    </div>
                </div>
                
                ${port.service_fingerprint ? `
                    <div style="margin-top: 15px;">
                        <div style="color: #6b46c1; font-size: 12px; margin-bottom: 5px;">SERVICE FINGERPRINT</div>
                        <div style="color: #9a4dff; font-family: 'Courier New', monospace; font-size: 12px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 3px;">
                            ${port.service_fingerprint}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Security Assessment -->
            <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 20px; border: 1px solid #7c3aed; margin-bottom: 25px;">
                <h3 style="color: #7c3aed; margin-bottom: 15px; font-size: 16px;">🔒 Security Assessment</h3>
                
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #a855f7; margin-bottom: 8px; font-size: 14px;">Risk Analysis:</h4>
                    <div style="color: #9a4dff; font-size: 13px; line-height: 1.5;">
                        ${this.getRiskAnalysis(port.port, port.service)}
                    </div>
                </div>
                
                ${serviceInfo.recommendations ? `
                    <div style="margin-bottom: 15px;">
                        <h4 style="color: #a855f7; margin-bottom: 8px; font-size: 14px;">Security Recommendations:</h4>
                        <ul style="color: #9a4dff; font-size: 13px; line-height: 1.5; margin-left: 20px;">
                            ${serviceInfo.recommendations.map(rec => `<li style="margin-bottom: 5px;">${rec}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${serviceInfo.common_vulnerabilities ? `
                    <div>
                        <h4 style="color: #ea580c; margin-bottom: 8px; font-size: 14px;">Common Vulnerabilities:</h4>
                        <div style="color: #9a4dff; font-size: 13px; line-height: 1.5;">
                            ${serviceInfo.common_vulnerabilities}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Discovery Information -->
            <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 20px; border: 1px solid #7c3aed; margin-bottom: 25px;">
                <h3 style="color: #7c3aed; margin-bottom: 15px; font-size: 16px;">📊 Discovery Information</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <div style="color: #6b46c1; font-size: 12px; margin-bottom: 5px;">DISCOVERED</div>
                        <div style="color: #9a4dff;">${new Date(port.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: #6b46c1; font-size: 12px; margin-bottom: 5px;">LAST UPDATED</div>
                        <div style="color: #9a4dff;">${new Date(port.updated_at || port.created_at).toLocaleString()}</div>
                    </div>
                </div>
                
                ${port.scan_method ? `
                    <div style="margin-top: 15px;">
                        <div style="color: #6b46c1; font-size: 12px; margin-bottom: 5px;">SCAN METHOD</div>
                        <div style="color: #9a4dff;">${port.scan_method}</div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Actions -->
            <div style="text-align: center; margin-top: 30px;">
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    ${port.service && this.buildServiceUrl(port.subdomain || port.hostname, port.port, port.service) ? 
                        `<button onclick="window.open('${this.buildServiceUrl(port.subdomain || port.hostname, port.port, port.service)}', '_blank')" class="btn btn-primary">🌐 Open Service</button>` : 
                        ''
                    }
                    <button onclick="PortScanning.copyPortInfo(${port.id})" class="btn btn-secondary">📋 Copy Info</button>
                    <button onclick="PortScanning.closePortDetails()" class="btn btn-secondary">✖️ Close</button>
                </div>
            </div>
        `;
    },

    getServiceInfo(service, port) {
        const serviceDB = {
            'ssh': {
                recommendations: [
                    'Disable root login',
                    'Use key-based authentication',
                    'Change default port if possible',
                    'Implement fail2ban or similar protection',
                    'Use strong passwords or disable password auth'
                ],
                common_vulnerabilities: 'SSH brute force attacks, weak credentials, outdated SSH versions with known CVEs'
            },
            'http': {
                recommendations: [
                    'Implement HTTPS instead of HTTP',
                    'Use security headers (HSTS, CSP, etc.)',
                    'Keep web server updated',
                    'Implement proper access controls',
                    'Disable server signature/version disclosure'
                ],
                common_vulnerabilities: 'Unencrypted traffic, web application vulnerabilities, information disclosure'
            },
            'https': {
                recommendations: [
                    'Use strong SSL/TLS configuration',
                    'Implement security headers',
                    'Keep certificates updated',
                    'Use proper cipher suites',
                    'Implement HSTS'
                ],
                common_vulnerabilities: 'Weak SSL/TLS configuration, certificate issues, web application vulnerabilities'
            },
            'ftp': {
                recommendations: [
                    'Use SFTP or FTPS instead',
                    'Disable anonymous access',
                    'Use strong authentication',
                    'Restrict access by IP',
                    'Consider removing if not needed'
                ],
                common_vulnerabilities: 'Unencrypted credentials, anonymous access, brute force attacks'
            },
            'mysql': {
                recommendations: [
                    'Bind to localhost only if possible',
                    'Use strong passwords',
                    'Disable remote root access',
                    'Keep MySQL updated',
                    'Use SSL connections'
                ],
                common_vulnerabilities: 'Weak credentials, remote access abuse, SQL injection through applications'
            },
            'rdp': {
                recommendations: [
                    'Use Network Level Authentication',
                    'Implement account lockout policies',
                    'Use VPN for remote access',
                    'Change default port',
                    'Use strong passwords'
                ],
                common_vulnerabilities: 'BlueKeep and related CVEs, brute force attacks, weak credentials'
            }
        };
        
        const lowerService = service?.toLowerCase() || '';
        for (const [key, info] of Object.entries(serviceDB)) {
            if (lowerService.includes(key)) {
                return info;
            }
        }
        
        return {
            recommendations: [
                'Keep service updated to latest version',
                'Implement proper access controls',
                'Monitor for unusual activity',
                'Use strong authentication',
                'Consider if service is necessary'
            ]
        };
    },

    getRiskAnalysis(port, service) {
        const portNum = parseInt(port);
        const riskLevel = this.getRiskLevel(port, service);
        
        let analysis = '';
        
        if (riskLevel === 'HIGH') {
            analysis = `⚠️ <strong>High Risk:</strong> Port ${port} running ${service || 'unknown service'} is considered high risk. `;
        } else if (riskLevel === 'MEDIUM') {
            analysis = `⚡ <strong>Medium Risk:</strong> Port ${port} running ${service || 'unknown service'} requires attention. `;
        } else {
            analysis = `✅ <strong>Low Risk:</strong> Port ${port} running ${service || 'unknown service'} is relatively safe. `;
        }
        
        // Add specific port analysis
        if (portNum === 22) {
            analysis += 'SSH access should be properly secured with key-based authentication and restricted access.';
        } else if (portNum === 80) {
            analysis += 'HTTP traffic is unencrypted. Consider redirecting to HTTPS.';
        } else if (portNum === 443) {
            analysis += 'HTTPS is good for security. Ensure proper SSL/TLS configuration.';
        } else if (portNum === 21) {
            analysis += 'FTP transmits credentials in plaintext. Consider using SFTP or FTPS.';
        } else if (portNum === 3389) {
            analysis += 'RDP is often targeted for attacks. Ensure strong authentication and consider VPN access.';
        } else if ([3306, 5432, 1433].includes(portNum)) {
            analysis += 'Database port exposed. Should only be accessible from authorized sources.';
        } else {
            analysis += 'Review if this service needs to be publicly accessible.';
        }
        
        return analysis;
    },

    copyPortInfo(portId) {
        const content = document.getElementById('port-details-content');
        if (!content) return;
        
        // Extract text content for copying
        const textContent = content.innerText;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textContent).then(() => {
                Utils.showMessage('Port details copied to clipboard!', 'success', 'port-scan-messages');
            }).catch(() => {
                this.fallbackCopyText(textContent);
            });
        } else {
            this.fallbackCopyText(textContent);
        }
    },

    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            Utils.showMessage('Port details copied to clipboard!', 'success', 'port-scan-messages');
        } catch (err) {
            Utils.showMessage('Failed to copy to clipboard', 'error', 'port-scan-messages');
        }
        document.body.removeChild(textArea);
    },

    closePortDetails() {
        const modal = document.getElementById('port-details-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    testService(hostname, port, service) {
        // This would test connectivity to the service
        const url = this.buildServiceUrl(hostname, port, service);
        if (url) {
            window.open(url, '_blank');
        } else {
            Utils.showMessage(`Testing connectivity to ${service} on ${hostname}:${port}`, 'info');
        }
    },

    buildServiceUrl(hostname, port, service) {
        const serviceLower = service.toLowerCase();
        
        if (serviceLower.includes('http') && !serviceLower.includes('https')) {
            return `http://${hostname}:${port}`;
        } else if (serviceLower.includes('https') || port == 443) {
            return `https://${hostname}:${port}`;
        } else if (port == 80) {
            return `http://${hostname}`;
        }
        
        return null; // For non-web services, we can't build a URL
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

    // Get example ports for different profiles
    getPortExamples(profile) {
        const examples = {
            'top-100': 'Top 100 most common ports',
            'top-1000': 'Top 1000 most common ports', 
            'common-tcp': 'TCP ports 1-1024',
            'common-udp': 'Common UDP ports (53,67,68,69,123,161,162)',
            'all-tcp': 'All TCP ports 1-65535',
            'custom': 'Examples: 22,80,443 or 8000-8100 or 22,80,443,8080-8090,9000-9100'
        };
        return examples[profile] || '';
    },

    // Export functionality methods
    toggleExportMenu() {
        const menu = document.getElementById('export-ports-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    async exportPorts(format) {
        try {
            // Hide the export menu
            const menu = document.getElementById('export-ports-menu');
            if (menu) menu.style.display = 'none';
            
            // Show loading message
            Utils.showMessage(`📤 Exporting port scan results as ${format.toUpperCase()}...`, 'info', 'port-scan-messages');
            
            // Get current filter values to export filtered data
            const targetId = document.getElementById('port-target-filter')?.value;
            const subdomainId = document.getElementById('port-subdomain-filter')?.value;
            const subdomainStatus = document.getElementById('subdomain-status-filter')?.value;
            const portState = document.getElementById('port-state-filter')?.value;
            const serviceSearch = document.getElementById('service-search')?.value;
            
            const params = {
                page: 1,
                limit: 10000 // Get all matching ports for export
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (subdomainStatus) params.subdomain_status = subdomainStatus;
            if (portState) params.state = portState;
            if (serviceSearch && serviceSearch.trim()) params.service_search = serviceSearch.trim();

            const response = await API.ports.getAll(params);
            if (!response || !response.ok) {
                throw new Error('Failed to fetch ports for export');
            }
            
            const data = await response.json();
            const ports = data.success ? data.data : [];
            
            if (ports.length === 0) {
                Utils.showMessage('No ports to export with current filters', 'warning', 'port-scan-messages');
                return;
            }
            
            // Prepare export data
            const exportData = {
                export_timestamp: new Date().toISOString(),
                total_ports: ports.length,
                filters_applied: {
                    target_id: targetId || 'all',
                    subdomain_id: subdomainId || 'all',
                    subdomain_status: subdomainStatus || 'all',
                    port_state: portState || 'all',
                    service_search: serviceSearch || 'none'
                },
                stats: {
                    total_ports: ports.length,
                    open_ports: ports.filter(p => p.state === 'open').length,
                    closed_ports: ports.filter(p => p.state === 'closed').length,
                    filtered_ports: ports.filter(p => p.state === 'filtered').length,
                    unique_services: new Set(ports.filter(p => p.service && p.service !== 'unknown').map(p => p.service)).size,
                    high_risk_ports: ports.filter(p => this.getRiskLevel(p.port, p.service) === 'HIGH').length,
                    medium_risk_ports: ports.filter(p => this.getRiskLevel(p.port, p.service) === 'MEDIUM').length,
                    low_risk_ports: ports.filter(p => this.getRiskLevel(p.port, p.service) === 'LOW').length
                },
                ports: ports
            };
            
            // Generate and download file based on format
            switch (format.toLowerCase()) {
                case 'csv':
                    this.downloadCSV(exportData);
                    break;
                case 'json':
                    this.downloadJSON(exportData);
                    break;
                case 'xml':
                    this.downloadXML(exportData);
                    break;
                default:
                    throw new Error('Unsupported export format');
            }
            
            Utils.showMessage(`✅ Successfully exported ${ports.length} port scan results as ${format.toUpperCase()}!`, 'success', 'port-scan-messages');
            
        } catch (error) {
            Utils.showMessage('❌ Failed to export port scan results: ' + error.message, 'error', 'port-scan-messages');
        }
    },

    downloadCSV(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        let csvContent = 'Export Summary\n';
        csvContent += `Export Date,${data.export_timestamp}\n`;
        csvContent += `Total Ports,${data.total_ports}\n`;
        csvContent += `Open Ports,${data.stats.open_ports}\n`;
        csvContent += `Closed Ports,${data.stats.closed_ports}\n`;
        csvContent += `Filtered Ports,${data.stats.filtered_ports}\n`;
        csvContent += `Unique Services,${data.stats.unique_services}\n`;
        csvContent += `High Risk Ports,${data.stats.high_risk_ports}\n`;
        csvContent += `Medium Risk Ports,${data.stats.medium_risk_ports}\n`;
        csvContent += `Low Risk Ports,${data.stats.low_risk_ports}\n\n`;
        
        csvContent += 'Subdomain,Port,Protocol,State,Service,Version,Risk Level,Discovered Date,Hostname/IP\n';
        
        data.ports.forEach(port => {
            const row = [
                `"${port.subdomain || port.hostname || ''}"`,
                `"${port.port || ''}"`,
                `"${(port.protocol || 'TCP').toUpperCase()}"`,
                `"${(port.state || '').toUpperCase()}"`,
                `"${port.service || ''}"`,
                `"${port.version || ''}"`,
                `"${this.getRiskLevel(port.port, port.service)}"`,
                `"${port.created_at || ''}"`,
                `"${port.ip_address || port.hostname || ''}"`
            ].join(',');
            csvContent += row + '\n';
        });
        
        this.downloadFile(csvContent, `port_scan_${timestamp}.csv`, 'text/csv');
    },

    downloadJSON(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `port_scan_${timestamp}.json`, 'application/json');
    },

    downloadXML(data) {
        const timestamp = new Date().toISOString().split('T')[0];
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<port_scan_export>\n';
        xmlContent += '  <export_info>\n';
        xmlContent += `    <timestamp>${this.escapeXml(data.export_timestamp)}</timestamp>\n`;
        xmlContent += `    <total_ports>${data.total_ports}</total_ports>\n`;
        xmlContent += '    <filters>\n';
        xmlContent += `      <target_id>${this.escapeXml(data.filters_applied.target_id)}</target_id>\n`;
        xmlContent += `      <subdomain_id>${this.escapeXml(data.filters_applied.subdomain_id)}</subdomain_id>\n`;
        xmlContent += `      <subdomain_status>${this.escapeXml(data.filters_applied.subdomain_status)}</subdomain_status>\n`;
        xmlContent += `      <port_state>${this.escapeXml(data.filters_applied.port_state)}</port_state>\n`;
        xmlContent += `      <service_search>${this.escapeXml(data.filters_applied.service_search)}</service_search>\n`;
        xmlContent += '    </filters>\n';
        xmlContent += '    <stats>\n';
        xmlContent += `      <total_ports>${data.stats.total_ports}</total_ports>\n`;
        xmlContent += `      <open_ports>${data.stats.open_ports}</open_ports>\n`;
        xmlContent += `      <closed_ports>${data.stats.closed_ports}</closed_ports>\n`;
        xmlContent += `      <filtered_ports>${data.stats.filtered_ports}</filtered_ports>\n`;
        xmlContent += `      <unique_services>${data.stats.unique_services}</unique_services>\n`;
        xmlContent += `      <high_risk_ports>${data.stats.high_risk_ports}</high_risk_ports>\n`;
        xmlContent += `      <medium_risk_ports>${data.stats.medium_risk_ports}</medium_risk_ports>\n`;
        xmlContent += `      <low_risk_ports>${data.stats.low_risk_ports}</low_risk_ports>\n`;
        xmlContent += '    </stats>\n';
        xmlContent += '  </export_info>\n';
        xmlContent += '  <ports>\n';
        
        data.ports.forEach(port => {
            xmlContent += '    <port>\n';
            xmlContent += `      <subdomain>${this.escapeXml(port.subdomain || port.hostname || '')}</subdomain>\n`;
            xmlContent += `      <port_number>${this.escapeXml(port.port || '')}</port_number>\n`;
            xmlContent += `      <protocol>${this.escapeXml((port.protocol || 'TCP').toUpperCase())}</protocol>\n`;
            xmlContent += `      <state>${this.escapeXml((port.state || '').toUpperCase())}</state>\n`;
            xmlContent += `      <service>${this.escapeXml(port.service || '')}</service>\n`;
            xmlContent += `      <version>${this.escapeXml(port.version || '')}</version>\n`;
            xmlContent += `      <risk_level>${this.escapeXml(this.getRiskLevel(port.port, port.service))}</risk_level>\n`;
            xmlContent += `      <discovered_date>${this.escapeXml(port.created_at || '')}</discovered_date>\n`;
            xmlContent += `      <ip_address>${this.escapeXml(port.ip_address || port.hostname || '')}</ip_address>\n`;
            xmlContent += '    </port>\n';
        });
        
        xmlContent += '  </ports>\n';
        xmlContent += '</port_scan_export>';
        
        this.downloadFile(xmlContent, `port_scan_${timestamp}.xml`, 'application/xml');
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

    // Cleanup method
    cleanup() {
        this.stopAutoRefresh();
        this.hideScanProgress();
        this.showServicesLoading(false);
        this.isScanning = false;
    }
};

window.PortScanning = PortScanning;
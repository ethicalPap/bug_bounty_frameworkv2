// frontend/assets/js/modules/port-scanning.js - ENHANCED WITH REAL-TIME UPDATES

const PortScanning = {
    refreshInterval: null,
    activeScanJobId: null,

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
            <!-- Real-time status indicator -->
            <div id="port-scan-status" style="display: none; background-color: #001100; border: 2px solid #00ff00; padding: 12px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="spinner" style="margin: 0;"></div>
                    <span id="port-scan-status-text" style="color: #00ff00; font-family: 'Courier New', monospace;">Port scan in progress...</span>
                    <button onclick="PortScanning.stopActiveScan()" class="btn btn-danger btn-small" style="margin-left: auto;">Stop Scan</button>
                </div>
                <div id="port-scan-progress" style="margin-top: 8px;">
                    <div style="background-color: #003300; border: 1px solid #00ff00; height: 8px; width: 100%;">
                        <div id="port-scan-progress-bar" style="background-color: #00ff00; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                    </div>
                    <div id="port-scan-progress-text" style="font-size: 12px; color: #00cc00; margin-top: 4px;"></div>
                </div>
            </div>

            <div class="scan-info">
                <h4>🔌 Port Scanning <span id="port-scan-live-indicator" style="color: #00ff00; font-size: 12px;">[LIVE]</span></h4>
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
                                <option value="top-100">Top 100 Ports (Fast)</option>
                                <option value="top-1000" selected>Top 1000 Ports (Recommended)</option>
                                <option value="common-tcp">Common TCP Ports</option>
                                <option value="common-udp">Common UDP Ports</option>
                                <option value="all-tcp">All TCP Ports (Slow)</option>
                                <option value="custom">Custom Port Range</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="port-scan-btn">🔌 Start Port Scan</button>
                    </div>
                    
                    <!-- Advanced Options -->
                    <div id="advanced-options" style="border: 1px solid #003300; padding: 15px; background-color: #001100;">
                        <h5 style="color: #00ff00; margin-bottom: 10px;">Advanced Scan Options</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Custom Ports</label>
                                <input type="text" id="custom-ports" placeholder="22,80,443,8080-8090" disabled>
                                <small style="color: #666; font-size: 11px;">Comma-separated ports/ranges</small>
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
                <button onclick="PortScanning.load()" class="btn btn-primary">🔄 Refresh</button>
            </div>

            <div class="card">
                <div class="card-title">
                    Discovered Ports & Services
                    <span id="last-updated" style="font-size: 12px; color: #666; float: right;"></span>
                </div>
                
                <!-- Port Stats -->
                <div id="port-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; border: 1px solid #003300; background-color: #001100;">
                    <div style="text-align: center;">
                        <div id="total-ports" style="font-size: 24px; font-weight: bold; color: #00ff00;">0</div>
                        <div style="font-size: 12px; color: #006600;">Total Ports</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="open-ports" style="font-size: 24px; font-weight: bold; color: #00ff00;">0</div>
                        <div style="font-size: 12px; color: #006600;">Open Ports</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="unique-services" style="font-size: 24px; font-weight: bold; color: #ffff00;">0</div>
                        <div style="font-size: 12px; color: #006600;">Unique Services</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="high-risk-ports" style="font-size: 24px; font-weight: bold; color: #ff8800;">0</div>
                        <div style="font-size: 12px; color: #006600;">High Risk Ports</div>
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
                                <td colspan="9" style="text-align: center; color: #006600;">Loading ports...</td>
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
        if (profileSelect && customPortsInput) {
            profileSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customPortsInput.disabled = false;
                    customPortsInput.required = true;
                    customPortsInput.focus();
                } else {
                    customPortsInput.disabled = true;
                    customPortsInput.required = false;
                    customPortsInput.value = '';
                }
            });
        }

        // Target filter - update subdomains when target changes
        const targetFilter = document.getElementById('port-target-filter');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
                this.load(1);
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
                element.addEventListener('change', () => this.load(1));
            }
        });

        // Service search with debounce
        const serviceSearch = document.getElementById('service-search');
        if (serviceSearch) {
            serviceSearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
        }
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
                } else {
                    this.hideScanProgress();
                }
            }
        } catch (error) {
            console.error('Failed to check active scan jobs:', error);
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
            if (serviceSearch) params.service_search = serviceSearch;

            const response = await API.ports.getAll(params);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success) {
                const ports = data.data;
                AppState.currentPageData.ports = { page, total: data.pagination.total };
                
                this.renderPortsList(ports);
                this.updatePortStats(ports);
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('ports', data.pagination);
                } else {
                    document.getElementById('ports-pagination').innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Failed to load ports:', error);
            document.getElementById('ports-list').innerHTML = 
                '<tr><td colspan="9" style="text-align: center; color: #ff0000;">Failed to load ports</td></tr>';
        }
    },

    renderPortsList(ports) {
        const portsList = document.getElementById('ports-list');
        
        if (ports.length > 0) {
            portsList.innerHTML = ports.map(port => `
                <tr>
                    <td style="font-weight: 600; color: #00ff00;">${port.subdomain || port.hostname}</td>
                    <td style="font-family: 'Courier New', monospace; color: #00cc00; font-weight: bold;">${port.port}</td>
                    <td>${port.protocol?.toUpperCase() || 'TCP'}</td>
                    <td><span class="status ${this.getStateColor(port.state)}">${port.state?.toUpperCase()}</span></td>
                    <td style="color: #00cc00;">${port.service || '-'}</td>
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
        } else {
            portsList.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #006600;">No ports discovered yet. Run a port scan to discover open ports and services!</td></tr>';
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
        const customPorts = document.getElementById('custom-ports').value;
        const technique = document.getElementById('scan-technique').value;
        const serviceDetection = document.getElementById('service-detection').value;
        const timing = document.getElementById('timing-template').value;
        const maxParallel = document.getElementById('max-parallel').value;
        const liveHostsOnly = document.getElementById('live-hosts-only').value === 'true';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'port-scan-messages');
            return;
        }
        
        if (profile === 'custom' && !customPorts) {
            Utils.showMessage('Please specify custom ports', 'error', 'port-scan-messages');
            return;
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
            
            Utils.showMessage('🔌 Starting port scan...', 'info', 'port-scan-messages');
            
            const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            if (response && response.ok) {
                const data = await response.json();
                console.log('Port scan started:', data);
                
                Utils.showMessage(
                    `🔌 Port scan started successfully! Scanning ${profile} ports${subdomainId ? ' on selected subdomain' : ' on all active subdomains'}. Progress will update automatically below.`, 
                    'success', 
                    'port-scan-messages'
                );
                
                // Reset form
                document.getElementById('port-scan-subdomain').value = '';
                document.getElementById('port-scan-profile').value = 'top-1000';
                
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

    viewPortDetails(portId) {
        // This would show detailed information about the port
        Utils.showMessage(`Detailed port information for port ID ${portId} would be shown here`, 'info');
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

    // Cleanup method
    cleanup() {
        this.stopAutoRefresh();
        this.hideScanProgress();
    }
};

window.PortScanning = PortScanning;
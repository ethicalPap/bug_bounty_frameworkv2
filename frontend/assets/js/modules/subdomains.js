// frontend/assets/js/modules/subdomains.js - Enhanced with real-time updates

const Subdomains = {
    refreshInterval: null,
    scanJobsRefreshInterval: null,
    isAutoRefreshEnabled: true,
    lastScanJobsUpdate: null,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.load();
        await this.loadScanJobs();
        
        // Start real-time updates
        this.startRealTimeUpdates();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="scan-info">
                <h4>🌐 Live Host Verification</h4>
                <p>Verify which discovered subdomains are live and responsive. This checks DNS resolution, HTTP/HTTPS status, and extracts page titles for active subdomains.</p>
            </div>

            <!-- Scan Section -->
            <div class="card">
                <div class="card-title">Start Live Host Scan</div>
                <div id="scan-messages"></div>
                <form id="live-scan-form">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end;">
                        <div class="form-group">
                            <label for="live-scan-target">Target Domain</label>
                            <select id="live-scan-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-success" id="start-live-scan-btn">🌐 Start Live Host Scan</button>
                    </div>
                </form>
            </div>

            <!-- Real-time Scan Jobs Section -->
            <div class="card">
                <div class="card-title">
                    Live Host Scan Jobs
                    <span id="auto-refresh-indicator" style="float: right; font-size: 12px; color: #00cc00;">
                        🔄 Auto-updating
                    </span>
                </div>
                
                <!-- Controls -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="Subdomains.loadScanJobs()" class="btn btn-secondary">🔄 Manual Refresh</button>
                    <button onclick="Subdomains.toggleAutoRefresh()" class="btn btn-secondary" id="auto-refresh-toggle">
                        ⏸️ Pause Auto-refresh
                    </button>
                    <span id="scan-jobs-status" style="color: #006600; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="last-update-time" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>

                <!-- Real-time scan jobs table -->
                <div style="max-height: 400px; overflow-y: auto; border: 2px solid #00ff00; background-color: #000000;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Target</th>
                                <th>Status</th>
                                <th>Progress</th>
                                <th>Hosts Found</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="live-scan-jobs-list">
                            <tr>
                                <td colspan="7" style="text-align: center; color: #006600;">No live host scans yet</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <!-- Real-time progress indicator -->
                <div id="realtime-progress" style="display: none; margin-top: 10px; padding: 10px; border: 1px solid #00ff00; background-color: #001100;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="spinner" style="width: 16px; height: 16px;"></span>
                        <span id="progress-text" style="color: #00ff00; font-family: 'Courier New', monospace; font-size: 12px;"></span>
                    </div>
                </div>
            </div>

            <!-- Filters Section -->
            <div class="filters">
                <div class="filter-group">
                    <label>Target</label>
                    <select id="subdomain-target-filter">
                        <option value="">All Targets</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Status</label>
                    <select id="subdomain-status-filter">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>HTTP Status Code</label>
                    <input type="text" id="subdomain-http-status-filter" placeholder="200, 404, etc." style="width: 120px;">
                </div>
                <div class="filter-group">
                    <label>Search Subdomain</label>
                    <input type="text" id="subdomain-search" placeholder="Search subdomains...">
                </div>
                <div class="filter-group">
                    <label>&nbsp;</label>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="Subdomains.search()" class="btn btn-primary">🔍 Search</button>
                        <button onclick="Subdomains.clearFilters()" class="btn btn-secondary">🗑️ Clear</button>
                    </div>
                </div>
            </div>

            <!-- Results Section with real-time updates -->
            <div class="card">
                <div class="card-title">
                    Live Hosts Results
                    <span id="results-last-update" style="float: right; font-size: 11px; color: #666;"></span>
                </div>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Subdomain</th>
                                <th>Target</th>
                                <th>Status</th>
                                <th>HTTP Status</th>
                                <th>IP Address</th>
                                <th>Title</th>
                                <th>Last Seen</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="subdomains-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #006600;">Loading subdomains...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="subdomains-pagination" class="pagination"></div>
            </div>

            <style>
                .spinner {
                    border: 2px solid #003300;
                    border-top: 2px solid #00ff00;
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
                    background-color: #001100 !important;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { background-color: #001100; }
                    50% { background-color: #002200; }
                    100% { background-color: #001100; }
                }
                
                .status-updating {
                    animation: blink 1s infinite;
                }
                
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.5; }
                }
            </style>
        `;
    },

    bindEvents() {
        // Live scan form submission
        const liveScanForm = document.getElementById('live-scan-form');
        if (liveScanForm) {
            liveScanForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startLiveHostScan();
            });
        }

        // Filter events
        ['subdomain-target-filter', 'subdomain-status-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.search());
            }
        });

        // Enter key support for input fields
        ['subdomain-http-status-filter', 'subdomain-search'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.search();
                    }
                });
            }
        });
    },

    // Enhanced real-time updates
    startRealTimeUpdates() {
        console.log('🔄 Starting real-time updates for live host scans');
        
        // Clear any existing intervals
        this.cleanup();
        
        // Start aggressive refresh for scan jobs (every 2 seconds)
        this.scanJobsRefreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'subdomains') {
                try {
                    await this.updateScanJobsRealTime();
                } catch (error) {
                    console.error('Real-time scan jobs update failed:', error);
                }
            }
        }, 2000); // Update every 2 seconds
        
        // Start moderate refresh for subdomain results (every 10 seconds)
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'subdomains') {
                try {
                    await this.updateSubdomainResultsQuietly();
                } catch (error) {
                    console.error('Real-time subdomain results update failed:', error);
                }
            }
        }, 10000); // Update every 10 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    // Real-time scan jobs update (lightweight)
    async updateScanJobsRealTime() {
        try {
            const response = await API.scans.getJobs({ job_type: 'live_hosts_scan' });
            if (!response || !response.ok) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            // Check if there are any running scans
            const runningScans = scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            );
            
            // Update scan jobs table
            this.renderScanJobsList(scans);
            
            // Update status indicators
            this.updateScanJobsStatus(scans, runningScans);
            
            // Update last update time
            this.updateLastUpdateTime('scan-jobs');
            
            // Show/hide real-time progress
            if (runningScans.length > 0) {
                this.showRealTimeProgress(runningScans);
            } else {
                this.hideRealTimeProgress();
            }
            
        } catch (error) {
            console.error('Real-time scan jobs update failed:', error);
        }
    },

    // Quiet subdomain results update (doesn't show loading messages)
    async updateSubdomainResultsQuietly() {
        try {
            const targetId = document.getElementById('subdomain-target-filter')?.value;
            const status = document.getElementById('subdomain-status-filter')?.value;
            const httpStatus = document.getElementById('subdomain-http-status-filter')?.value;
            const search = document.getElementById('subdomain-search')?.value;
            
            const params = {
                page: AppState.currentPageData?.subdomains?.page || 1,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (status) params.status = status;
            if (httpStatus && httpStatus.trim()) params.http_status = httpStatus.trim();
            if (search && search.trim()) params.search = search.trim();

            const response = await API.subdomains.getAll(params);
            if (!response || !response.ok) return;
            
            const data = await response.json();
            
            if (data.success) {
                const subdomains = data.data;
                this.renderSubdomainsList(subdomains);
                this.updateLastUpdateTime('results');
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('subdomains', data.pagination);
                }
            }
        } catch (error) {
            console.error('Quiet subdomain results update failed:', error);
        }
    },

    updateScanJobsStatus(scans, runningScans) {
        const statusSpan = document.getElementById('scan-jobs-status');
        if (!statusSpan) return;
        
        if (runningScans.length > 0) {
            const totalProgress = runningScans.reduce((sum, scan) => sum + (scan.progress_percentage || 0), 0);
            const avgProgress = Math.round(totalProgress / runningScans.length);
            
            statusSpan.innerHTML = `🔄 ${runningScans.length} scan${runningScans.length > 1 ? 's' : ''} running (${avgProgress}% avg)`;
            statusSpan.style.color = '#ffff00';
            statusSpan.classList.add('status-updating');
        } else {
            const completedScans = scans.filter(scan => scan.status === 'completed').length;
            if (completedScans > 0) {
                statusSpan.textContent = `✅ ${completedScans} scan${completedScans > 1 ? 's' : ''} completed`;
                statusSpan.style.color = '#00ff00';
            } else {
                statusSpan.textContent = '💤 No active scans';
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
            
            progressText.textContent = `${activeScan.domain || 'Unknown'} - ${activeScan.status} (${progress}%)`;
            progressDiv.style.display = 'block';
        }
    },

    hideRealTimeProgress() {
        const progressDiv = document.getElementById('realtime-progress');
        if (progressDiv) {
            progressDiv.style.display = 'none';
        }
    },

    updateLastUpdateTime(type) {
        const elementId = type === 'scan-jobs' ? 'last-update-time' : 'results-last-update';
        const element = document.getElementById(elementId);
        if (element) {
            const now = new Date();
            element.textContent = `Updated: ${now.toLocaleTimeString()}`;
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('auto-refresh-indicator');
        if (indicator) {
            if (isActive) {
                indicator.innerHTML = '🔄 Auto-updating';
                indicator.style.color = '#00cc00';
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

    // Load targets for both dropdowns
    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            // Update both target selectors
            ['live-scan-target', 'subdomain-target-filter'].forEach(selectId => {
                const targetSelect = document.getElementById(selectId);
                if (targetSelect) {
                    const currentValue = targetSelect.value;
                    const isLiveScanTarget = selectId === 'live-scan-target';
                    
                    targetSelect.innerHTML = isLiveScanTarget ? 
                        '<option value="">Select target...</option>' : 
                        '<option value="">All Targets</option>';
                    
                    targets.forEach(target => {
                        const option = document.createElement('option');
                        option.value = target.id;
                        option.textContent = target.domain;
                        targetSelect.appendChild(option);
                    });

                    // Restore previous selection if it still exists
                    if (currentValue && targets.find(t => t.id == currentValue)) {
                        targetSelect.value = currentValue;
                    }
                }
            });

            console.log(`Loaded ${targets.length} targets for live host scanning`);
        } catch (error) {
            console.error('Failed to load targets:', error);
        }
    },

    // Start live host scan (creates a scan job)
    async startLiveHostScan() {
        const targetId = document.getElementById('live-scan-target').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'scan-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-live-scan-btn', true);
            
            const response = await API.scans.start(targetId, ['live_hosts_scan'], 'medium');
            
            if (response && response.ok) {
                Utils.showMessage('Live host scan started successfully!', 'success', 'scan-messages');
                
                // Reset the form
                document.getElementById('live-scan-target').value = '';
                
                // Immediately refresh scan jobs and enable aggressive updates
                await this.loadScanJobs();
                this.startRealTimeUpdates();
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start live host scan: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start live host scan: ' + error.message, 'error', 'scan-messages');
        } finally {
            Utils.setButtonLoading('start-live-scan-btn', false);
        }
    },

    // Load scan jobs (filtered for live host scans only)
    async loadScanJobs() {
        try {
            const response = await API.scans.getJobs({ job_type: 'live_hosts_scan' });
            if (!response) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            this.renderScanJobsList(scans);
            this.updateLastUpdateTime('scan-jobs');
        } catch (error) {
            console.error('Failed to load live host scan jobs:', error);
            document.getElementById('live-scan-jobs-list').innerHTML = 
                '<tr><td colspan="7" style="text-align: center; color: #ff0000;">Failed to load scan jobs</td></tr>';
        }
    },

    renderScanJobsList(scans) {
        const scansList = document.getElementById('live-scan-jobs-list');
        
        if (scans.length > 0) {
            scansList.innerHTML = scans.map(scan => {
                const targetName = scan.domain || scan.target_domain || 'Unknown Target';
                const isRunning = scan.status === 'running' || scan.status === 'pending';
                
                // Extract hosts found from results
                let hostsFound = '-';
                if (scan.status === 'completed' && scan.results) {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        hostsFound = results.live_hosts || 0;
                    } catch (error) {
                        console.warn('Failed to parse scan results:', error);
                    }
                } else if (isRunning) {
                    hostsFound = '🔄 Scanning...';
                }
                
                return `
                    <tr class="${isRunning ? 'progress-row' : ''}">
                        <td style="font-family: 'Courier New', monospace;">${scan.id}</td>
                        <td style="color: #00ff00; font-weight: bold;">${targetName}</td>
                        <td><span class="status status-${scan.status} ${isRunning ? 'status-updating' : ''}">${scan.status.toUpperCase()}</span></td>
                        <td>
                            <div style="background-color: #003300; border: 1px solid #00ff00; height: 8px; width: 100px;">
                                <div style="background-color: #00ff00; height: 100%; width: ${scan.progress_percentage || 0}%; transition: width 0.3s ease;"></div>
                            </div>
                            <span style="font-size: 13px; color: #006600;">${scan.progress_percentage || 0}%</span>
                        </td>
                        <td style="font-weight: bold; color: ${scan.status === 'completed' ? '#00ff00' : '#666'};">
                            ${hostsFound}
                        </td>
                        <td style="font-size: 12px; color: #666;">${new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>
                            ${scan.status === 'completed' ? 
                                `<button onclick="Subdomains.viewScanResults(${scan.id})" class="btn btn-secondary btn-small">📊 View Results</button>` :
                                scan.status === 'running' ? 
                                `<button onclick="Subdomains.stopScan(${scan.id})" class="btn btn-danger btn-small">Stop</button>` :
                                '-'
                            }
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            scansList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #006600;">No live host scans yet. Start your first scan above!</td></tr>';
        }
    },

    async viewScanResults(scanId) {
        try {
            const response = await API.scans.get(scanId);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success && data.data && data.data.results) {
                const results = data.data.results;
                let message = `Live Host Scan Results:\n\n`;
                message += `Target: ${data.data.domain || data.data.target_domain || 'Unknown'}\n`;
                message += `Duration: ${results.scan_duration_seconds || 0}s\n\n`;
                message += `Total Subdomains Checked: ${results.total_checked || 0}\n`;
                message += `Live Hosts Found: ${results.live_hosts || 0}\n`;
                message += `Success Rate: ${results.success_rate || 0}%\n`;
                
                if (results.newly_discovered && results.newly_discovered.length > 0) {
                    message += `\nNewly Discovered Live Hosts: ${results.newly_discovered.length}\n`;
                    message += `${results.newly_discovered.slice(0, 5).join(', ')}`;
                    if (results.newly_discovered.length > 5) {
                        message += ` (and ${results.newly_discovered.length - 5} more)`;
                    }
                }
                
                alert(message);
                
                // Refresh the subdomains list to show updated data
                await this.updateSubdomainResultsQuietly();
            } else {
                Utils.showMessage('No results available for this scan.', 'warning');
            }
        } catch (error) {
            Utils.showMessage('Failed to load scan results: ' + error.message, 'error');
        }
    },

    async stopScan(scanId) {
        if (confirm('Are you sure you want to stop this live host scan?')) {
            try {
                const response = await API.scans.stop(scanId);
                if (response && response.ok) {
                    await this.loadScanJobs();
                    Utils.showMessage('Live host scan stopped successfully!', 'success');
                } else {
                    Utils.showMessage('Failed to stop scan', 'error');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop scan: ' + error.message, 'error');
            }
        }
    },

    // Cleanup method for tab switching
    cleanup() {
        console.log('🧹 Cleaning up live hosts module intervals');
        
        if (this.scanJobsRefreshInterval) {
            clearInterval(this.scanJobsRefreshInterval);
            this.scanJobsRefreshInterval = null;
        }
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
    },

    async load(page = 1) {
        try {
            // Show loading message
            document.getElementById('subdomains-list').innerHTML = 
                '<tr><td colspan="8" style="text-align: center; color: #ffff00;">🔍 Searching subdomains...</td></tr>';
            
            const targetId = document.getElementById('subdomain-target-filter')?.value;
            const status = document.getElementById('subdomain-status-filter')?.value;
            const httpStatus = document.getElementById('subdomain-http-status-filter')?.value;
            const search = document.getElementById('subdomain-search')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (status) params.status = status;
            if (httpStatus && httpStatus.trim()) params.http_status = httpStatus.trim();
            if (search && search.trim()) params.search = search.trim();

            const response = await API.subdomains.getAll(params);
            if (!response) {
                console.error('❌ No response from API');
                return;
            }
            
            if (!response.ok) {
                console.error('Failed to fetch subdomains:', response.status);
                document.getElementById('subdomains-list').innerHTML = 
                    '<tr><td colspan="8" style="text-align: center; color: #ff0000;">Failed to load subdomains - check if backend is running</td></tr>';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                const subdomains = data.data;
                
                AppState.currentPageData.subdomains = { page, total: data.pagination.total };
                
                this.renderSubdomainsList(subdomains);
                this.updateLastUpdateTime('results');
                
                // Show result count message
                const resultMessage = httpStatus && httpStatus.trim() ? 
                    `Found ${subdomains.length} subdomains with HTTP status ${httpStatus.trim()}` :
                    `Found ${subdomains.length} subdomains`;
                
                if (subdomains.length === 0 && (httpStatus?.trim() || search?.trim())) {
                    Utils.showMessage('No subdomains found matching your search criteria', 'warning');
                } else if (httpStatus?.trim() || search?.trim()) {
                    Utils.showMessage(resultMessage, 'success');
                }
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('subdomains', data.pagination);
                } else {
                    const paginationEl = document.getElementById('subdomains-pagination');
                    if (paginationEl) paginationEl.innerHTML = '';
                }
            } else {
                console.error('❌ API returned success: false', data);
                document.getElementById('subdomains-list').innerHTML = 
                    '<tr><td colspan="8" style="text-align: center; color: #ff0000;">API error: ' + (data.error || 'Unknown error') + '</td></tr>';
            }
        } catch (error) {
            console.error('Failed to load subdomains:', error);
            document.getElementById('subdomains-list').innerHTML = 
                '<tr><td colspan="8" style="text-align: center; color: #ff0000;">Error loading subdomains: ' + error.message + '</td></tr>';
        }
    },

    // Search method that's called by the search button
    async search(page = 1) {
        await this.load(page);
    },

    // Clear all filters
    clearFilters() {
        const statusFilter = document.getElementById('subdomain-status-filter');
        const httpStatusFilter = document.getElementById('subdomain-http-status-filter');
        const searchFilter = document.getElementById('subdomain-search');
        
        if (statusFilter) statusFilter.value = '';
        if (httpStatusFilter) httpStatusFilter.value = '';
        if (searchFilter) searchFilter.value = '';
        
        this.load(1);
        Utils.showMessage('Filters cleared', 'info');
    },

    renderSubdomainsList(subdomains) {
        const subdomainsList = document.getElementById('subdomains-list');
        
        if (subdomains.length > 0) {
            subdomainsList.innerHTML = subdomains.map(subdomain => `
                <tr>
                    <td style="font-weight: 600; color: #00ff00;">${subdomain.subdomain}</td>
                    <td>${subdomain.target_domain}</td>
                    <td><span class="status status-${subdomain.status}">${subdomain.status}</span></td>
                    <td>
                        ${subdomain.http_status ? 
                            `<span class="status ${this.getHttpStatusColor(subdomain.http_status)}">${subdomain.http_status}</span>` : 
                            '-'
                        }
                    </td>
                    <td style="font-family: 'Courier New', monospace; color: #00cc00;">${subdomain.ip_address || '-'}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${subdomain.title || ''}">${subdomain.title || '-'}</td>
                    <td style="font-size: 12px; color: #006600;">${subdomain.last_seen ? new Date(subdomain.last_seen).toLocaleDateString() : '-'}</td>
                    <td>
                        <button onclick="Subdomains.checkLive(${subdomain.id})" class="btn btn-secondary btn-small">Check Live</button>
                        ${subdomain.http_status && (subdomain.http_status === 200 || subdomain.http_status === 301 || subdomain.http_status === 302) ? 
                            `<button onclick="window.open('https://${subdomain.subdomain}', '_blank')" class="btn btn-success btn-small">Open</button>` : 
                            ''
                        }
                    </td>
                </tr>
            `).join('');
        } else {
            subdomainsList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #006600;">No subdomains found. Run a subdomain scan to discover subdomains!</td></tr>';
        }
    },

    // Get HTTP status color
    getHttpStatusColor(statusCode) {
        if (!statusCode) return 'status-inactive';
        
        const code = parseInt(statusCode);
        if (code >= 200 && code < 300) return 'status-completed'; // Green for success
        if (code >= 300 && code < 400) return 'status-running';   // Yellow for redirects
        if (code >= 400 && code < 500) return 'severity-medium'; // Orange for client errors
        if (code >= 500) return 'severity-high';                 // Red for server errors
        return 'status-inactive';
    },

    async checkLive(id) {
        try {
            const response = await API.subdomains.checkLive(id);
            if (response && response.ok) {
                // Immediately update the results
                await this.updateSubdomainResultsQuietly();
                Utils.showMessage('Live status check completed!', 'success');
            } else {
                Utils.showMessage('Failed to check live status', 'error');
            }
        } catch (error) {
            Utils.showMessage('Failed to check live status: ' + error.message, 'error');
        }
    },

    // Method to refresh targets (useful when called from other modules)
    async refreshTargets() {
        await this.loadTargets();
    }
};

// Make it globally available
window.Subdomains = Subdomains;
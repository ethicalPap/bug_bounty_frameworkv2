// frontend/assets/js/modules/scans.js - Enhanced with better target domain handling

const Scans = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
    targetsCache: {}, // Cache for target information

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.load();
        
        // Start real-time updates
        this.startRealTimeUpdates();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .export-menu {
                    box-shadow: 0 4px 6px rgba(0, 255, 0, 0.2);
                    border-radius: 2px;
                }
                .export-menu button:hover {
                    background-color: #001100 !important;
                }
                .scrollable-table-container {
                    max-height: 500px;
                    overflow-y: auto;
                    overflow-x: auto;
                    border: 2px solid #00ff00;
                    background-color: #000000;
                }
                .scrollable-table-container::-webkit-scrollbar {
                    width: 12px;
                    height: 12px;
                }
                .scrollable-table-container::-webkit-scrollbar-track {
                    background: #000000;
                    border: 1px solid #003300;
                }
                .scrollable-table-container::-webkit-scrollbar-thumb {
                    background: #00ff00;
                    border: 1px solid #003300;
                }
                .scrollable-table-container::-webkit-scrollbar-thumb:hover {
                    background: #00cc00;
                }
                .scrollable-table-container::-webkit-scrollbar-corner {
                    background: #000000;
                }
                
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
            
            <div class="scan-info">
                <h4>🔍 Subdomain Enumeration</h4>
                <p>Discover subdomains using tools like subfinder and basic DNS enumeration. This is the first step in reconnaissance to map your target's attack surface and find all subdomains associated with the target domain.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Subdomain Enumeration Scan</div>
                <div id="scan-messages"></div>
                <form id="scan-form">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end;">
                        <div class="form-group">
                            <label for="scan-target">Target Domain</label>
                            <select id="scan-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-scan-btn">🚀 Start Subdomain Scan</button>
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">
                    Subdomain Enumeration Scan Jobs
                    <span id="auto-refresh-indicator" style="float: right; font-size: 12px; color: #00cc00;">
                        🔄 Auto-updating
                    </span>
                </div>
                
                <!-- Controls -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="Scans.load()" class="btn btn-secondary">🔄 Manual Refresh</button>
                    <button onclick="Scans.toggleAutoRefresh()" class="btn btn-secondary" id="auto-refresh-toggle">
                        ⏸️ Pause Auto-refresh
                    </button>
                    <span id="scan-status" style="color: #006600; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="last-update-time" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <!-- Real-time progress indicator -->
                <div id="realtime-progress" style="display: none; margin-bottom: 15px; padding: 10px; border: 1px solid #00ff00; background-color: #001100;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="spinner" style="width: 16px; height: 16px;"></span>
                        <span id="progress-text" style="color: #00ff00; font-family: 'Courier New', monospace; font-size: 12px;"></span>
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
                                <th>Subdomains Found</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="scans-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #006600;">Loading subdomain scans...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Scan form submission
        const scanForm = document.getElementById('scan-form');
        if (scanForm) {
            scanForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startScan();
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
        console.log('🔄 Starting real-time updates for subdomain scans');
        
        // Clear any existing intervals
        this.cleanup();
        
        // Start aggressive refresh during active scans (every 2 seconds)
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'scans') {
                try {
                    await this.updateScansRealTime();
                } catch (error) {
                    console.error('Real-time scans update failed:', error);
                }
            }
        }, 2000); // Update every 2 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    // Real-time scans update
    async updateScansRealTime() {
        try {
            const response = await API.scans.getJobs({ job_type: 'subdomain_scan' });
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
            console.error('Real-time scans update failed:', error);
        }
    },

    updateScanStatus(scans, runningScans) {
        const statusSpan = document.getElementById('scan-status');
        if (!statusSpan) return;
        
        if (runningScans.length > 0) {
            const totalProgress = runningScans.reduce((sum, scan) => sum + (scan.progress_percentage || 0), 0);
            const avgProgress = Math.round(totalProgress / runningScans.length);
            
            statusSpan.innerHTML = `🔄 ${runningScans.length} scan${runningScans.length > 1 ? 's' : ''} running (${avgProgress}% avg)`;
            statusSpan.style.color = '#ffff00';
            statusSpan.classList.add('status-updating');
        } else {
            const completedScans = scans.filter(scan => scan.status === 'completed').length;
            const totalSubdomains = scans
                .filter(scan => scan.status === 'completed')
                .reduce((total, scan) => {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        return total + (results?.total_count || 0);
                    } catch {
                        return total;
                    }
                }, 0);
            
            if (completedScans > 0) {
                statusSpan.innerHTML = `✅ ${completedScans} scan${completedScans > 1 ? 's' : ''} completed | 🌐 ${totalSubdomains} total subdomains discovered`;
                statusSpan.style.color = '#00ff00';
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
            
            const targetSelect = document.getElementById('scan-target');
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

                console.log(`Loaded ${targets.length} targets for subdomain scan dropdown`);
            }
        } catch (error) {
            console.error('Failed to load targets for subdomain scan form:', error);
            
            // Show error message in the form
            const targetSelect = document.getElementById('scan-target');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">Error loading targets</option>';
            }
        }
    },

    async load() {
        try {
            // Only load subdomain_scan jobs
            const response = await API.scans.getJobs({ job_type: 'subdomain_scan' });
            if (!response) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            console.log('🔍 Loaded scans data:', scans); // Debug log
            
            this.renderScansList(scans);
            this.updateScanStatus(scans, scans.filter(scan => 
                scan.status === 'running' || scan.status === 'pending'
            ));
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('Failed to load subdomain scans:', error);
            document.getElementById('scans-list').innerHTML = 
                '<tr><td colspan="8" style="text-align: center; color: #ff0000;">Failed to load subdomain scans</td></tr>';
        }
    },

    renderScansList(scans) {
        const scansList = document.getElementById('scans-list');
        
        if (scans.length > 0) {
            scansList.innerHTML = scans.map(scan => {
                // Enhanced target name resolution
                const targetName = this.getTargetName(scan);
                const isRunning = scan.status === 'running' || scan.status === 'pending';
                
                console.log(`🎯 Scan ${scan.id}: target_domain="${scan.target_domain}", domain="${scan.domain}", target_id="${scan.target_id}", resolved="${targetName}"`); // Debug log
                
                // Extract subdomain count from results
                let subdomainCount = '-';
                if (scan.status === 'completed' && scan.results) {
                    try {
                        const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                        subdomainCount = results.total_count || results.subdomains?.length || 0;
                    } catch (error) {
                        console.warn('Failed to parse scan results:', error);
                    }
                } else if (isRunning) {
                    subdomainCount = '🔄 Scanning...';
                }
                
                return `
                    <tr class="${isRunning ? 'progress-row' : ''}">
                        <td style="font-family: 'Courier New', monospace;">${scan.id}</td>
                        <td style="color: #00ff00; font-weight: bold;" title="Target ID: ${scan.target_id}">${targetName}</td>
                        <td>Subdomain Enumeration</td>
                        <td><span class="status status-${scan.status} ${isRunning ? 'status-updating' : ''}">${scan.status.toUpperCase()}</span></td>
                        <td>
                            <div style="background-color: #003300; border: 1px solid #00ff00; height: 8px; width: 100px;">
                                <div style="background-color: #00ff00; height: 100%; width: ${scan.progress_percentage || 0}%; transition: width 0.3s ease;"></div>
                            </div>
                            <span style="font-size: 13px; color: #006600;">${scan.progress_percentage || 0}%</span>
                        </td>
                        <td style="font-weight: bold; color: ${scan.status === 'completed' ? '#00ff00' : '#666'};">
                            ${subdomainCount}
                        </td>
                        <td style="font-size: 12px; color: #666;">${new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>
                            ${scan.status === 'completed' ? 
                                `<div style="position: relative; display: inline-block;">
                                    <button onclick="Scans.toggleExportMenu(${scan.id})" class="btn btn-secondary btn-small" id="export-btn-${scan.id}">📤 Export Results</button>
                                    <div id="export-menu-${scan.id}" class="export-menu" style="display: none; position: absolute; top: 100%; left: 0; background: #000; border: 2px solid #00ff00; min-width: 120px; z-index: 1000;">
                                        <button onclick="Scans.exportResults(${scan.id}, 'csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #003300;">📊 CSV</button>
                                        <button onclick="Scans.exportResults(${scan.id}, 'json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #003300;">📋 JSON</button>
                                        <button onclick="Scans.exportResults(${scan.id}, 'xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                                    </div>
                                </div>` :
                                scan.status === 'running' ? 
                                `<button onclick="Scans.stopScan(${scan.id})" class="btn btn-danger btn-small">Stop</button>` :
                                '-'
                            }
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            scansList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #006600;">No subdomain scans yet. Start your first scan above!</td></tr>';
        }
    },

    async startScan() {
        const targetId = document.getElementById('scan-target').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'scan-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-scan-btn', true);
            
            // Only start subdomain_scan type
            const response = await API.scans.start(targetId, ['subdomain_scan'], 'medium');
            
            if (response && response.ok) {
                Utils.showMessage('Subdomain enumeration scan started successfully!', 'success', 'scan-messages');
                
                // Reset the form
                document.getElementById('scan-target').value = '';
                
                // Immediately refresh and enable aggressive updates
                await this.load();
                this.startRealTimeUpdates();
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start subdomain scan: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start subdomain scan: ' + error.message, 'error', 'scan-messages');
        } finally {
            Utils.setButtonLoading('start-scan-btn', false);
        }
    },

    // Cleanup method for tab switching
    cleanup() {
        console.log('🧹 Cleaning up subdomain scans module intervals');
        
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
            Utils.showMessage(`Exporting subdomain scan results as ${format.toUpperCase()}...`, 'info', 'scan-messages');
            
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
                    scan_type: 'Subdomain Enumeration',
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
                
                Utils.showMessage(`Subdomain scan results exported successfully as ${format.toUpperCase()}!`, 'success', 'scan-messages');
                
            } else {
                Utils.showMessage('No results available for export.', 'warning', 'scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to export results: ' + error.message, 'error', 'scan-messages');
        }
    },

    downloadCSV(data, scanId) {
        let csvContent = 'Scan ID,Target,Scan Type,Status,Created,Completed,Total Subdomains\n';
        csvContent += `${data.scan_id},"${data.target}","${data.scan_type}","${data.status}","${data.created_at}","${data.completed_at || 'N/A'}","${data.results.total_count || 0}"\n\n`;
        
        // Add subdomains if available
        if (data.results.subdomains && data.results.subdomains.length > 0) {
            csvContent += 'Discovered Subdomains\n';
            csvContent += 'Subdomain,Status\n';
            data.results.subdomains.forEach(subdomain => {
                csvContent += `"${subdomain}","Found"\n`;
            });
        }
        
        // Add alive subdomains if available
        if (data.results.alive_subdomains && data.results.alive_subdomains.length > 0) {
            csvContent += '\nLive Subdomains\n';
            csvContent += 'Subdomain,Status\n';
            data.results.alive_subdomains.forEach(subdomain => {
                csvContent += `"${subdomain}","Live"\n`;
            });
        }
        
        this.downloadFile(csvContent, `subdomain_scan_${scanId}_results.csv`, 'text/csv');
    },

    downloadJSON(data, scanId) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `subdomain_scan_${scanId}_results.json`, 'application/json');
    },

    downloadXML(data, scanId) {
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<subdomain_scan_results>\n';
        xmlContent += `  <scan_id>${data.scan_id}</scan_id>\n`;
        xmlContent += `  <target>${this.escapeXml(data.target)}</target>\n`;
        xmlContent += `  <scan_type>${this.escapeXml(data.scan_type)}</scan_type>\n`;
        xmlContent += `  <status>${this.escapeXml(data.status)}</status>\n`;
        xmlContent += `  <created_at>${this.escapeXml(data.created_at)}</created_at>\n`;
        xmlContent += `  <completed_at>${this.escapeXml(data.completed_at || 'N/A')}</completed_at>\n`;
        xmlContent += `  <total_subdomains>${data.results.total_count || 0}</total_subdomains>\n`;
        xmlContent += '  <results>\n';
        
        // Add subdomains
        if (data.results.subdomains && data.results.subdomains.length > 0) {
            xmlContent += '    <subdomains>\n';
            data.results.subdomains.forEach(subdomain => {
                xmlContent += `      <subdomain status="found">${this.escapeXml(subdomain)}</subdomain>\n`;
            });
            xmlContent += '    </subdomains>\n';
        }
        
        // Add alive subdomains
        if (data.results.alive_subdomains && data.results.alive_subdomains.length > 0) {
            xmlContent += '    <alive_subdomains>\n';
            data.results.alive_subdomains.forEach(subdomain => {
                xmlContent += `      <subdomain status="live">${this.escapeXml(subdomain)}</subdomain>\n`;
            });
            xmlContent += '    </alive_subdomains>\n';
        }
        
        xmlContent += '  </results>\n';
        xmlContent += '</subdomain_scan_results>';
        
        this.downloadFile(xmlContent, `subdomain_scan_${scanId}_results.xml`, 'application/xml');
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
        if (confirm('Are you sure you want to stop this subdomain scan?')) {
            try {
                const response = await API.scans.stop(scanId);
                if (response && response.ok) {
                    await this.load();
                    Utils.showMessage('Subdomain scan stopped successfully!', 'success');
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
window.Scans = Scans;
// frontend/assets/js/modules/scans.js - SIMPLIFIED WITHOUT PRIORITY

const Scans = {
    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.load();
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
            </style>
            
            <div class="scan-info">
                <h4>🔍 Subdomain Enumeration</h4>
                <p>Discover subdomains using tools like subfinder and basic DNS enumeration. This is the first step in reconnaissance to map your target's attack surface.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Subdomain Scan</div>
                <div id="scan-messages"></div>
                <form id="scan-form">
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end;">
                        <div class="form-group">
                            <label for="scan-target">Target Domain</label>
                            <select id="scan-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-scan-btn">🚀 Start Scan</button>
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">Scan Jobs</div>
                <button onclick="Scans.load()" class="btn btn-secondary mb-4">🔄 Refresh</button>
                <div class="scrollable-table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Target</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Progress</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="scans-list">
                            <tr>
                                <td colspan="7" style="text-align: center; color: #006600;">Loading scans...</td>
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

    // Load targets for the dropdown
    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
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

                // Log for debugging
                console.log(`Loaded ${targets.length} targets for scan dropdown`);
            }
        } catch (error) {
            console.error('Failed to load targets for scan form:', error);
            
            // Show error message in the form
            const targetSelect = document.getElementById('scan-target');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">Error loading targets</option>';
            }
        }
    },

    async load() {
        try {
            const response = await API.scans.getJobs();
            if (!response) return;
            
            const data = await response.json();
            const scans = data.success ? data.data : [];
            
            this.renderScansList(scans);
        } catch (error) {
            console.error('Failed to load scans:', error);
            document.getElementById('scans-list').innerHTML = 
                '<tr><td colspan="7" style="text-align: center; color: #ff0000;">Failed to load scans</td></tr>';
        }
    },

    renderScansList(scans) {
        const scansList = document.getElementById('scans-list');
        
        if (scans.length > 0) {
            scansList.innerHTML = scans.map(scan => {
                // Better target name resolution
                const targetName = scan.domain || scan.target_domain || 'Unknown Target';
                
                // Better scan type display
                const scanTypeMap = {
                    'subdomain_scan': 'Subdomain Discovery',
                    'port_scan': 'Port Scanning',
                    'content_discovery': 'Content Discovery',
                    'vulnerability_scan': 'Vulnerability Scan',
                    'js_files_scan': 'JavaScript Analysis',
                    'api_discovery': 'API Discovery'
                };
                const scanType = scanTypeMap[scan.job_type] || scan.job_type || 'Unknown';
                
                return `
                    <tr>
                        <td style="font-family: 'Courier New', monospace;">${scan.id}</td>
                        <td style="color: #00ff00; font-weight: bold;">${targetName}</td>
                        <td>${scanType}</td>
                        <td><span class="status status-${scan.status}">${scan.status.toUpperCase()}</span></td>
                        <td>
                            <div style="background-color: #003300; border: 1px solid #00ff00; height: 8px; width: 100px;">
                                <div style="background-color: #00ff00; height: 100%; width: ${scan.progress_percentage || 0}%;"></div>
                            </div>
                            <span style="font-size: 13px; color: #006600;">${scan.progress_percentage || 0}%</span>
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
            scansList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #006600;">No scans yet. Start your first scan above!</td></tr>';
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
            
            // Use default medium priority since we removed the priority field
            const response = await API.scans.start(targetId, ['subdomain_scan'], 'medium');
            
            if (response && response.ok) {
                Utils.showMessage('Subdomain scan started successfully!', 'success', 'scan-messages');
                
                // Reset the form
                document.getElementById('scan-target').value = '';
                
                // Refresh the scan list
                await this.load();
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start scan: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start scan: ' + error.message, 'error', 'scan-messages');
        } finally {
            Utils.setButtonLoading('start-scan-btn', false);
        }
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
            Utils.showMessage(`Exporting results as ${format.toUpperCase()}...`, 'info', 'scan-messages');
            
            const response = await API.scans.get(scanId);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success && data.data) {
                const scanData = data.data;
                const results = scanData.results || {};
                
                // Prepare export data
                const exportData = {
                    scan_id: scanId,
                    target: scanData.domain || scanData.target_domain || 'Unknown',
                    scan_type: scanData.job_type || 'unknown',
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
                
                Utils.showMessage(`Results exported successfully as ${format.toUpperCase()}!`, 'success', 'scan-messages');
                
            } else {
                Utils.showMessage('No results available for export.', 'warning', 'scan-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to export results: ' + error.message, 'error', 'scan-messages');
        }
    },

    downloadCSV(data, scanId) {
        let csvContent = 'Scan ID,Target,Scan Type,Status,Created,Completed\n';
        csvContent += `${data.scan_id},"${data.target}","${data.scan_type}","${data.status}","${data.created_at}","${data.completed_at || 'N/A'}"\n\n`;
        
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
        
        this.downloadFile(csvContent, `scan_${scanId}_results.csv`, 'text/csv');
    },

    downloadJSON(data, scanId) {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadFile(jsonContent, `scan_${scanId}_results.json`, 'application/json');
    },

    downloadXML(data, scanId) {
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += '<scan_results>\n';
        xmlContent += `  <scan_id>${data.scan_id}</scan_id>\n`;
        xmlContent += `  <target>${this.escapeXml(data.target)}</target>\n`;
        xmlContent += `  <scan_type>${this.escapeXml(data.scan_type)}</scan_type>\n`;
        xmlContent += `  <status>${this.escapeXml(data.status)}</status>\n`;
        xmlContent += `  <created_at>${this.escapeXml(data.created_at)}</created_at>\n`;
        xmlContent += `  <completed_at>${this.escapeXml(data.completed_at || 'N/A')}</completed_at>\n`;
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
        xmlContent += '</scan_results>';
        
        this.downloadFile(xmlContent, `scan_${scanId}_results.xml`, 'application/xml');
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
        if (confirm('Are you sure you want to stop this scan?')) {
            try {
                const response = await API.scans.stop(scanId);
                if (response && response.ok) {
                    await this.load();
                    Utils.showMessage('Scan stopped successfully!', 'success');
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
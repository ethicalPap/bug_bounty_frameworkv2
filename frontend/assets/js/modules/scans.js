// frontend/assets/js/modules/scans.js

const Scans = {
    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets(); // Add this line to load targets
        await this.load();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="scan-info">
                <h4>🔍 Subdomain Enumeration</h4>
                <p>Discover subdomains using tools like subfinder and basic DNS enumeration. This is the first step in reconnaissance to map your target's attack surface.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Subdomain Scan</div>
                <div id="scan-messages"></div>
                <form id="scan-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 20px; align-items: end;">
                        <div class="form-group">
                            <label for="scan-target">Target Domain</label>
                            <select id="scan-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="scan-priority">Priority</label>
                            <select id="scan-priority">
                                <option value="low">Low</option>
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-scan-btn">🚀 Start Scan</button>
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">Scan Jobs</div>
                <button onclick="Scans.load()" class="btn btn-secondary mb-4">🔄 Refresh</button>
                <div class="table-container">
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
    },

    // New method to load targets for the dropdown
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
            scansList.innerHTML = scans.map(scan => `
                <tr>
                    <td>${scan.id}</td>
                    <td>${scan.domain || 'Unknown'}</td>
                    <td>${scan.job_type || 'Unknown'}</td>
                    <td><span class="status status-${scan.status}">${scan.status}</span></td>
                    <td>
                        <div style="background-color: #003300; border: 1px solid #00ff00; height: 8px; width: 100px;">
                            <div style="background-color: #00ff00; height: 100%; width: ${scan.progress_percentage || 0}%;"></div>
                        </div>
                        <span style="font-size: 13px; color: #006600;">${scan.progress_percentage || 0}%</span>
                    </td>
                    <td>${new Date(scan.created_at).toLocaleDateString()}</td>
                    <td>
                        ${scan.status === 'completed' ? 
                            `<button onclick="Scans.viewResults(${scan.id})" class="btn btn-secondary btn-small">View Results</button>` :
                            scan.status === 'running' ? 
                            `<button onclick="Scans.stopScan(${scan.id})" class="btn btn-danger btn-small">Stop</button>` :
                            '-'
                        }
                    </td>
                </tr>
            `).join('');
        } else {
            scansList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #006600;">No scans yet. Start your first scan above!</td></tr>';
        }
    },

    async startScan() {
        const targetId = document.getElementById('scan-target').value;
        const priority = document.getElementById('scan-priority').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'scan-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-scan-btn', true);
            
            const response = await API.scans.start(targetId, ['subdomain_scan'], priority);
            
            if (response && response.ok) {
                Utils.showMessage('Subdomain scan started successfully!', 'success', 'scan-messages');
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

    async viewResults(scanId) {
        try {
            const response = await API.scans.get(scanId);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success && data.data) {
                const results = data.data.results || {};
                
                // Format the results in a more readable way
                let resultsText = 'Scan Results:\n\n';
                
                if (results.subdomains && results.subdomains.length > 0) {
                    resultsText += `Found ${results.subdomains.length} subdomains:\n`;
                    results.subdomains.slice(0, 10).forEach(sub => {
                        resultsText += `- ${sub}\n`;
                    });
                    if (results.subdomains.length > 10) {
                        resultsText += `... and ${results.subdomains.length - 10} more\n`;
                    }
                } else {
                    resultsText += 'No subdomains found or scan still processing.\n';
                }
                
                if (results.alive_subdomains && results.alive_subdomains.length > 0) {
                    resultsText += `\nLive subdomains: ${results.alive_subdomains.length}\n`;
                }
                
                alert(resultsText);
            } else {
                Utils.showMessage('No results available for this scan.', 'warning');
            }
        } catch (error) {
            Utils.showMessage('Failed to load scan results: ' + error.message, 'error');
        }
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
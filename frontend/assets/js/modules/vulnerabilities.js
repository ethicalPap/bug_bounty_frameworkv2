// assets/js/modules/vulnerabilities.js

const Vulnerabilities = {
    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.load();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="scan-info">
                <h4>⚠️ Vulnerability Scanning</h4>
                <p>Run automated vulnerability scans using tools like nuclei. Identifies common security issues like OWASP Top 10 vulnerabilities.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Vulnerability Scan</div>
                <div id="vuln-scan-messages"></div>
                <form id="vuln-scan-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end;">
                        <div class="form-group">
                            <label>Target</label>
                            <select id="vuln-scan-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Subdomain</label>
                            <select id="vuln-scan-subdomain">
                                <option value="">All subdomains</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Scan Profile</label>
                            <select id="vuln-scan-profile">
                                <option value="basic">Basic Security Headers</option>
                                <option value="owasp">OWASP Top 10</option>
                                <option value="comprehensive">Comprehensive</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">⚠️ Start Vuln Scan</button>
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">Vulnerabilities</div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Target</th>
                                <th>Severity</th>
                                <th>Status</th>
                                <th>URL</th>
                                <th>Found</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="vulnerabilities-list">
                            <tr>
                                <td colspan="7" style="text-align: center; color: #006600;">Loading vulnerabilities...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="vulnerabilities-pagination" class="pagination"></div>
            </div>
        `;
    },

    bindEvents() {
        // Vuln scan form submission (placeholder)
        document.getElementById('vuln-scan-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            Utils.showMessage('Vulnerability scanning will be implemented in future versions', 'warning', 'vuln-scan-messages');
        });
    },

    async load(page = 1) {
        try {
            const targetId = document.getElementById('vuln-scan-target')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;

            const response = await API.vulnerabilities.getAll(params);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success) {
                const vulnerabilities = data.data;
                AppState.currentPageData.vulnerabilities = { page, total: data.pagination.total };
                
                this.renderVulnerabilitiesList(vulnerabilities);
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('vulnerabilities', data.pagination);
                } else {
                    document.getElementById('vulnerabilities-pagination').innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Failed to load vulnerabilities:', error);
            document.getElementById('vulnerabilities-list').innerHTML = 
                '<tr><td colspan="7" style="text-align: center; color: #ff0000;">Failed to load vulnerabilities</td></tr>';
        }
    },

    renderVulnerabilitiesList(vulnerabilities) {
        const vulnerabilitiesList = document.getElementById('vulnerabilities-list');
        
        if (vulnerabilities.length > 0) {
            vulnerabilitiesList.innerHTML = vulnerabilities.map(vuln => `
                <tr>
                    <td style="font-weight: 600;">${vuln.title}</td>
                    <td>${vuln.target_domain}</td>
                    <td><span class="status severity-${vuln.severity}">${vuln.severity.toUpperCase()}</span></td>
                    <td><span class="status status-${vuln.status}">${vuln.status.replace('_', ' ')}</span></td>
                    <td style="font-family: 'Courier New', monospace; font-size: 14px;">
                        ${vuln.url ? `<a href="${vuln.url}" target="_blank" style="color: #00ff00;">${vuln.url.substring(0, 50)}...</a>` : '-'}
                    </td>
                    <td>${new Date(vuln.created_at).toLocaleDateString()}</td>
                    <td>
                        <button onclick="Vulnerabilities.view(${vuln.id})" class="btn btn-secondary btn-small">View</button>
                    </td>
                </tr>
            `).join('');
        } else {
            vulnerabilitiesList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #006600;">No vulnerabilities found. Run a vulnerability scan to discover issues!</td></tr>';
        }
    },

    view(id) {
        Utils.showMessage(`Vulnerability details for ${id} would be shown here`, 'info');
    }
};

window.Vulnerabilities = Vulnerabilities;
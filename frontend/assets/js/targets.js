// assets/js/modules/targets.js

const Targets = {
    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.load();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="card">
                <div class="card-title">Add New Target</div>
                <div id="target-messages"></div>
                <form id="target-form" style="display: grid; grid-template-columns: 1fr 2fr auto; gap: 16px; align-items: end;">
                    <div class="form-group">
                        <label for="target-domain">Domain</label>
                        <input type="text" id="target-domain" placeholder="example.com" required>
                    </div>
                    <div class="form-group">
                        <label for="target-description">Description</label>
                        <input type="text" id="target-description" placeholder="Target description">
                    </div>
                    <button type="submit" class="btn btn-primary" id="add-target-btn">Add Target</button>
                </form>
            </div>

            <div class="card">
                <div class="card-title">Your Targets</div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Domain</th>
                                <th>Description</th>
                                <th>Subdomains</th>
                                <th>Vulnerabilities</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="targets-list">
                            <tr>
                                <td colspan="6" style="text-align: center; color: #006600;">Loading targets...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Target form submission
        document.getElementById('target-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            Utils.setButtonLoading('add-target-btn', true);
            
            const domain = document.getElementById('target-domain').value;
            const description = document.getElementById('target-description').value;
            
            try {
                const response = await API.targets.create(domain, description);
                
                if (response && response.ok) {
                    document.getElementById('target-form').reset();
                    await this.load();
                    Utils.showMessage('Target added successfully!', 'success', 'target-messages');
                } else {
                    const errorData = await response.json();
                    Utils.showMessage('Failed to add target: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'target-messages');
                }
            } catch (error) {
                Utils.showMessage('Failed to add target: ' + error.message, 'error', 'target-messages');
            } finally {
                Utils.setButtonLoading('add-target-btn', false);
            }
        });
    },

    async load() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            this.renderTargetsList(targets);
            this.updateTargetDropdowns(targets);
        } catch (error) {
            console.error('Failed to load targets:', error);
            document.getElementById('targets-list').innerHTML = 
                '<tr><td colspan="6" style="text-align: center; color: #ff0000;">Failed to load targets</td></tr>';
        }
    },

    renderTargetsList(targets) {
        const targetsList = document.getElementById('targets-list');
        
        if (targets.length > 0) {
            targetsList.innerHTML = targets.map(target => {
                const stats = Utils.safeJsonParse(target.stats, {});
                return `
                    <tr>
                        <td style="font-weight: 600; color: #00ff00;">${target.domain}</td>
                        <td>${target.description || '-'}</td>
                        <td>${stats.subdomains || 0}</td>
                        <td>
                            <span class="status ${stats.vulnerabilities > 0 ? 'severity-high' : 'status-inactive'}" style="padding: 4px 8px;">
                                ${stats.vulnerabilities || 0}
                            </span>
                        </td>
                        <td>${new Date(target.created_at).toLocaleDateString()}</td>
                        <td>
                            <button onclick="Targets.delete(${target.id})" class="btn btn-danger btn-small">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            targetsList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #006600;">No targets yet. Add your first target above!</td></tr>';
        }
    },

    updateTargetDropdowns(targets) {
        const dropdowns = [
            'scan-target',
            'global-target-filter',
            'subdomain-target-filter',
            'directory-target-filter',
            'vuln-scan-target',
            'port-scan-target',
            'content-discovery-target',
            'js-analysis-target',
            'api-discovery-target'
        ];

        dropdowns.forEach(dropdownId => {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                const currentValue = dropdown.value;
                const isFilterDropdown = dropdownId.includes('filter');
                
                dropdown.innerHTML = (isFilterDropdown ? '<option value="">All Targets</option>' : '<option value="">Select target...</option>') +
                    targets.map(target => `<option value="${target.id}">${target.domain}</option>`).join('');
                
                // Restore previous selection if it still exists
                if (currentValue && targets.find(t => t.id == currentValue)) {
                    dropdown.value = currentValue;
                }
            }
        });
    },

    async delete(id) {
        if (confirm('Are you sure you want to delete this target?')) {
            try {
                const response = await API.targets.delete(id);
                if (response && response.ok) {
                    await this.load();
                    Utils.showMessage('Target deleted successfully!', 'success', 'target-messages');
                } else {
                    Utils.showMessage('Failed to delete target', 'error', 'target-messages');
                }
            } catch (error) {
                Utils.showMessage('Failed to delete target: ' + error.message, 'error', 'target-messages');
            }
        }
    }
};

// Make it globally available for onclick handlers
window.Targets = Targets;
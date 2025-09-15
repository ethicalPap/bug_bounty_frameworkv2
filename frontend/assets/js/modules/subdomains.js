// frontend/assets/js/modules/subdomains.js

const Subdomains = {
    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.load();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
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
                    <label>Search</label>
                    <input type="text" id="subdomain-search" placeholder="Search subdomains...">
                </div>
                <button onclick="Subdomains.load()" class="btn btn-primary">🔄 Refresh</button>
            </div>

            <div class="card">
                <div class="card-title">Discovered Subdomains</div>
                
                <!-- Check All Live Button Section -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px;">
                    <button onclick="Subdomains.checkAllLive()" class="btn btn-success btn-small" id="check-all-btn">
                        🌐 Check All Live
                    </button>
                    <span id="check-all-status" style="color: #006600; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                </div>
                
                <!-- Progress Bar for Bulk Checking -->
                <div id="check-all-progress" style="display: none; margin-bottom: 15px; padding: 15px; border: 2px solid #00ff00; background-color: #001100;">
                    <div style="margin-bottom: 8px;">
                        <div style="background-color: #003300; border: 1px solid #00ff00; height: 12px; width: 100%;">
                            <div id="progress-bar" style="background-color: #00ff00; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                    <div id="progress-text" style="font-size: 13px; color: #00cc00; font-family: 'Courier New', monospace;"></div>
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
        `;
    },

    bindEvents() {
        // Filter events
        ['subdomain-target-filter', 'subdomain-status-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.load(1));
            }
        });

        // Search with debounce
        const subdomainSearch = document.getElementById('subdomain-search');
        if (subdomainSearch) {
            subdomainSearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
        }
    },

    async load(page = 1) {
        try {
            const targetId = document.getElementById('subdomain-target-filter')?.value;
            const status = document.getElementById('subdomain-status-filter')?.value;
            const search = document.getElementById('subdomain-search')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (status) params.status = status;
            if (search) params.search = search;

            const response = await API.subdomains.getAll(params);
            if (!response) return;
            
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
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('subdomains', data.pagination);
                } else {
                    const paginationEl = document.getElementById('subdomains-pagination');
                    if (paginationEl) paginationEl.innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Failed to load subdomains:', error);
            document.getElementById('subdomains-list').innerHTML = 
                '<tr><td colspan="8" style="text-align: center; color: #ff0000;">Error loading subdomains</td></tr>';
        }
    },

    renderSubdomainsList(subdomains) {
        const subdomainsList = document.getElementById('subdomains-list');
        
        if (subdomains.length > 0) {
            subdomainsList.innerHTML = subdomains.map(subdomain => `
                <tr>
                    <td style="font-weight: 600; color: #00ff00;">${subdomain.subdomain}</td>
                    <td>${subdomain.target_domain}</td>
                    <td><span class="status status-${subdomain.status}">${subdomain.status}</span></td>
                    <td>${subdomain.http_status || '-'}</td>
                    <td style="font-family: 'Courier New', monospace; color: #00cc00;">${subdomain.ip_address || '-'}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${subdomain.title || ''}">${subdomain.title || '-'}</td>
                    <td style="font-size: 12px; color: #006600;">${subdomain.last_seen ? new Date(subdomain.last_seen).toLocaleDateString() : '-'}</td>
                    <td>
                        <button onclick="Subdomains.checkLive(${subdomain.id})" class="btn btn-secondary btn-small">Check Live</button>
                    </td>
                </tr>
            `).join('');
        } else {
            subdomainsList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #006600;">No subdomains found. Run a subdomain scan to discover subdomains!</td></tr>';
        }
    },

    async checkLive(id) {
        try {
            const response = await API.subdomains.checkLive(id);
            if (response && response.ok) {
                await this.load(AppState.currentPageData.subdomains.page);
                Utils.showMessage('Live status check completed!', 'success');
            } else {
                Utils.showMessage('Failed to check live status', 'error');
            }
        } catch (error) {
            Utils.showMessage('Failed to check live status: ' + error.message, 'error');
        }
    },

    async checkAllLive() {
        const checkAllBtn = document.getElementById('check-all-btn');
        const statusSpan = document.getElementById('check-all-status');
        const progressContainer = document.getElementById('check-all-progress');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        
        try {
            // Disable button and show loading state
            checkAllBtn.disabled = true;
            checkAllBtn.innerHTML = '<span class="spinner"></span>Checking All Domains...';
            statusSpan.textContent = 'Preparing bulk live check...';
            statusSpan.style.color = '#ffff00';
            progressContainer.style.display = 'block';
            progressBar.style.width = '0%';
            
            // Get current filters to determine which subdomains to check
            const targetId = document.getElementById('subdomain-target-filter')?.value;
            const status = document.getElementById('subdomain-status-filter')?.value;
            const search = document.getElementById('subdomain-search')?.value;
            
            const params = {
                page: 1,
                limit: 1000 // Get more subdomains for bulk checking
            };
            
            if (targetId) params.target_id = targetId;
            if (status) params.status = status;
            if (search) params.search = search;

            // Get all subdomains that match current filters
            const response = await API.subdomains.getAll(params);
            if (!response || !response.ok) {
                throw new Error('Failed to fetch subdomains');
            }
            
            const data = await response.json();
            const subdomains = data.success ? data.data : [];
            
            if (subdomains.length === 0) {
                statusSpan.textContent = 'No subdomains found to check';
                statusSpan.style.color = '#ffff00';
                return;
            }
            
            statusSpan.textContent = `Found ${subdomains.length} subdomains to check`;
            statusSpan.style.color = '#00ff00';
            
            // Check subdomains in batches to avoid overwhelming the server
            let checkedCount = 0;
            let successCount = 0;
            let failedCount = 0;
            const startTime = Date.now();
            const BATCH_SIZE = CONFIG.BULK_CHECK_BATCH_SIZE || 5;
            const BATCH_DELAY = CONFIG.BULK_CHECK_DELAY || 1000;
            
            for (let i = 0; i < subdomains.length; i += BATCH_SIZE) {
                const batch = subdomains.slice(i, i + BATCH_SIZE);
                
                // Process batch in parallel
                const batchPromises = batch.map(async (subdomain) => {
                    try {
                        const checkResponse = await API.subdomains.checkLive(subdomain.id);
                        
                        if (checkResponse && checkResponse.ok) {
                            successCount++;
                        } else {
                            failedCount++;
                        }
                        checkedCount++;
                        
                        // Update progress
                        const percentage = Math.round((checkedCount / subdomains.length) * 100);
                        progressBar.style.width = `${percentage}%`;
                        
                        const elapsed = Math.round((Date.now() - startTime) / 1000);
                        const eta = checkedCount > 0 ? Math.round((elapsed / checkedCount) * (subdomains.length - checkedCount)) : 0;
                        
                        statusSpan.textContent = `Checking subdomains... ${checkedCount}/${subdomains.length} (${percentage}%)`;
                        progressText.textContent = `✅ ${successCount} success • ❌ ${failedCount} failed • ⏱️ ${eta}s remaining`;
                        
                    } catch (error) {
                        console.error(`Failed to check subdomain ${subdomain.subdomain}:`, error);
                        failedCount++;
                        checkedCount++;
                    }
                });
                
                await Promise.all(batchPromises);
                
                // Small delay between batches to be respectful to the server
                if (i + BATCH_SIZE < subdomains.length) {
                    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                }
            }
            
            // Show completion status
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            statusSpan.textContent = `✅ Bulk check completed in ${totalTime}s`;
            statusSpan.style.color = '#00ff00';
            progressText.textContent = `Final: ✅ ${successCount} successful • ❌ ${failedCount} failed • 📊 ${subdomains.length} total`;
            progressBar.style.width = '100%';
            
            // Refresh the subdomains list to show updated statuses
            await this.load(AppState.currentPageData.subdomains.page);
            
            const message = `Bulk live check completed! ${successCount}/${subdomains.length} checks successful`;
            Utils.showMessage(message, successCount > 0 ? 'success' : 'warning');
            
        } catch (error) {
            console.error('Bulk live check failed:', error);
            statusSpan.textContent = '❌ Bulk check failed';
            statusSpan.style.color = '#ff0000';
            progressText.textContent = 'Error occurred during bulk checking';
            Utils.showMessage('Failed to perform bulk live check: ' + error.message, 'error');
        } finally {
            // Re-enable button
            checkAllBtn.disabled = false;
            checkAllBtn.innerHTML = '🌐 Check All Live';
            
            // Hide progress after delay
            setTimeout(() => {
                progressContainer.style.display = 'none';
                statusSpan.textContent = '';
                statusSpan.style.color = '#00cc00';
            }, 10000); // Keep visible for 10 seconds
        }
    }
};

// Make it globally available
window.Subdomains = Subdomains;
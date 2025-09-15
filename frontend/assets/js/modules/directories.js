// assets/js/modules/directories.js

const Directories = {
    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets(); // Load targets first
        await this.load();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="scan-info">
                <h4>📁 Content Discovery</h4>
                <p>Discover hidden files, directories, and endpoints using content discovery techniques. Finds admin panels, backup files, configuration files, and other interesting resources.</p>
            </div>

            <div class="card">
                <div class="card-title">Start Content Discovery</div>
                <div id="content-discovery-messages"></div>
                <form id="content-discovery-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end;">
                        <div class="form-group">
                            <label>Target</label>
                            <select id="content-discovery-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Subdomain (optional)</label>
                            <select id="content-discovery-subdomain">
                                <option value="">All subdomains</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Wordlist</label>
                            <select id="content-discovery-wordlist">
                                <option value="common">Common Paths</option>
                                <option value="big">Big Wordlist</option>
                                <option value="medium">Medium Wordlist</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">📁 Start Discovery</button>
                    </div>
                </form>
            </div>

            <div class="filters">
                <div class="filter-group">
                    <label>Target</label>
                    <select id="directory-target-filter">
                        <option value="">All Targets</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Subdomain</label>
                    <select id="directory-subdomain-filter">
                        <option value="">All Subdomains</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Status Code</label>
                    <select id="directory-status-filter">
                        <option value="">All Status</option>
                        <option value="200">200 OK</option>
                        <option value="403">403 Forbidden</option>
                        <option value="404">404 Not Found</option>
                        <option value="500">500 Error</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Search</label>
                    <input type="text" id="directory-search" placeholder="Search paths...">
                </div>
                <button onclick="Directories.load()" class="btn btn-primary">🔄 Refresh</button>
            </div>

            <div class="card">
                <div class="card-title">Discovered Directories & Files</div>
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Path</th>
                                <th>Subdomain</th>
                                <th>Status</th>
                                <th>Size</th>
                                <th>Title</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="directories-list">
                            <tr>
                                <td colspan="6" style="text-align: center; color: #006600;">Loading directories...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="directories-pagination" class="pagination"></div>
            </div>
        `;
    },

    bindEvents() {
        // Content discovery form submission
        const contentDiscoveryForm = document.getElementById('content-discovery-form');
        if (contentDiscoveryForm) {
            contentDiscoveryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startContentDiscovery();
            });
        }

        // Content discovery target filter - when changed, update subdomains
        const contentTargetFilter = document.getElementById('content-discovery-target');
        if (contentTargetFilter) {
            contentTargetFilter.addEventListener('change', async () => {
                await this.loadContentDiscoverySubdomains();
            });
        }

        // Target filter - when changed, update subdomains
        const targetFilter = document.getElementById('directory-target-filter');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
                this.load(1);
            });
        }

        // Other filters
        ['directory-subdomain-filter', 'directory-status-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.load(1));
            }
        });

        // Search with debounce
        const directorySearch = document.getElementById('directory-search');
        if (directorySearch) {
            directorySearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
        }
    },

    // Load targets for the target dropdown
    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            // Update directory filter dropdown
            const targetSelect = document.getElementById('directory-target-filter');
            if (targetSelect) {
                const currentValue = targetSelect.value;
                targetSelect.innerHTML = '<option value="">All Targets</option>';
                
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    targetSelect.appendChild(option);
                });

                // Restore previous selection
                if (currentValue && targets.find(t => t.id == currentValue)) {
                    targetSelect.value = currentValue;
                }
            }

            // Update content discovery target dropdown
            const contentTargetSelect = document.getElementById('content-discovery-target');
            if (contentTargetSelect) {
                const currentValue = contentTargetSelect.value;
                contentTargetSelect.innerHTML = '<option value="">Select target...</option>';
                
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    contentTargetSelect.appendChild(option);
                });

                // Restore previous selection
                if (currentValue && targets.find(t => t.id == currentValue)) {
                    contentTargetSelect.value = currentValue;
                    // Reload subdomains for the restored target
                    await this.loadContentDiscoverySubdomains();
                }
            }

            console.log(`Loaded ${targets.length} targets for directory filter`);
            
            // Load subdomains for the initially selected target (if any)
            await this.loadSubdomains();
            
        } catch (error) {
            console.error('Failed to load targets for directory filter:', error);
        }
    },

    // Load subdomains based on selected target
    async loadSubdomains() {
        try {
            const targetId = document.getElementById('directory-target-filter')?.value;
            const subdomainSelect = document.getElementById('directory-subdomain-filter');
            
            if (!subdomainSelect) return;

            // Store current selection
            const currentValue = subdomainSelect.value;
            
            // Reset subdomain dropdown
            subdomainSelect.innerHTML = '<option value="">All Subdomains</option>';
            
            if (!targetId) {
                // If no target selected, load all subdomains
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
                    
                    console.log(`Loaded ${subdomains.length} subdomains (all targets)`);
                }
            } else {
                // Load subdomains for specific target
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
                    
                    console.log(`Loaded ${subdomains.length} subdomains for target ${targetId}`);
                }
            }
            
            // Restore previous selection if it still exists
            if (currentValue) {
                const optionExists = Array.from(subdomainSelect.options).some(option => option.value === currentValue);
                if (optionExists) {
                    subdomainSelect.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('Failed to load subdomains for directory filter:', error);
        }
    },

    // Load subdomains for content discovery form
    async loadContentDiscoverySubdomains() {
        try {
            const targetId = document.getElementById('content-discovery-target')?.value;
            const subdomainSelect = document.getElementById('content-discovery-subdomain');
            
            if (!subdomainSelect) return;

            // Store current selection
            const currentValue = subdomainSelect.value;
            
            // Reset subdomain dropdown
            subdomainSelect.innerHTML = '<option value="">All subdomains</option>';
            
            if (!targetId) {
                return;
            }

            // Load subdomains for specific target
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
                
                console.log(`Loaded ${subdomains.length} subdomains for content discovery`);
            }
            
            // Restore previous selection if it still exists
            if (currentValue) {
                const optionExists = Array.from(subdomainSelect.options).some(option => option.value === currentValue);
                if (optionExists) {
                    subdomainSelect.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('Failed to load subdomains for content discovery:', error);
        }
    },

    async load(page = 1) {
        try {
            const targetId = document.getElementById('directory-target-filter')?.value;
            const subdomainId = document.getElementById('directory-subdomain-filter')?.value;
            const subdomainStatus = document.getElementById('directory-subdomain-status-filter')?.value;
            const statusCode = document.getElementById('directory-status-filter')?.value;
            const search = document.getElementById('directory-search')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
            if (subdomainStatus) params.subdomain_status = subdomainStatus;
            if (statusCode) params.status_code = statusCode;
            if (search) params.search = search;

            const response = await API.directories.getAll(params);
            if (!response) return;
            
            const data = await response.json();
            
            if (data.success) {
                const directories = data.data;
                AppState.currentPageData.directories = { page, total: data.pagination.total };
                
                this.renderDirectoriesList(directories);
                
                if (data.pagination.pages > 1) {
                    Utils.updatePagination('directories', data.pagination);
                } else {
                    document.getElementById('directories-pagination').innerHTML = '';
                }
            }
        } catch (error) {
            console.error('Failed to load directories:', error);
            document.getElementById('directories-list').innerHTML = 
                '<tr><td colspan="6" style="text-align: center; color: #ff0000;">Failed to load directories</td></tr>';
        }
    },

    renderDirectoriesList(directories) {
        const directoriesList = document.getElementById('directories-list');
        
        if (directories.length > 0) {
            directoriesList.innerHTML = directories.map(directory => `
                <tr>
                    <td style="font-family: 'Courier New', monospace; color: #00ff00;">${directory.path}</td>
                    <td style="color: #00cc00;">${directory.subdomain}</td>
                    <td>
                        <span class="status ${Utils.getStatusColor(directory.status_code)}">${directory.status_code}</span>
                    </td>
                    <td>${Utils.formatBytes(directory.content_length)}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${directory.title || ''}">${directory.title || '-'}</td>
                    <td>
                        <button onclick="window.open('${directory.url}', '_blank')" class="btn btn-secondary btn-small">Open</button>
                    </td>
                </tr>
            `).join('');
        } else {
            directoriesList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #006600;">No directories found. Run a content discovery scan to find directories!</td></tr>';
        }
    },

    // Start content discovery scan
    async startContentDiscovery() {
        const targetId = document.getElementById('content-discovery-target').value;
        const subdomainId = document.getElementById('content-discovery-subdomain').value;
        const wordlist = document.getElementById('content-discovery-wordlist').value;
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'content-discovery-messages');
            return;
        }
        
        try {
            const scanTypes = ['content_discovery'];
            const config = {
                wordlist: wordlist,
                subdomain_id: subdomainId || null
            };
            
            const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            if (response && response.ok) {
                Utils.showMessage('Content discovery scan started successfully! Check the Subdomain Scans tab to monitor progress.', 'success', 'content-discovery-messages');
                
                // Reset form
                document.getElementById('content-discovery-subdomain').value = '';
                document.getElementById('content-discovery-wordlist').value = 'common';
            } else {
                const errorData = await response.json();
                Utils.showMessage('Failed to start content discovery: ' + (errorData.error || errorData.message || 'Unknown error'), 'error', 'content-discovery-messages');
            }
        } catch (error) {
            Utils.showMessage('Failed to start content discovery: ' + error.message, 'error', 'content-discovery-messages');
        }
    },

    // Method to refresh targets and subdomains (useful when called from other modules)
    async refreshFilters() {
        await this.loadTargets();
    }
};

window.Directories = Directories;
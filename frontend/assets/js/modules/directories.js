// assets/js/modules/directories.js

const Directories = {
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
                <div class="card-title">Directories & Files</div>
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
        ['directory-target-filter', 'directory-subdomain-filter', 'directory-status-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.load(1));
            }
        });

        const directorySearch = document.getElementById('directory-search');
        if (directorySearch) {
            directorySearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
        }
    },

    async load(page = 1) {
        try {
            const targetId = document.getElementById('directory-target-filter')?.value;
            const subdomainId = document.getElementById('directory-subdomain-filter')?.value;
            const statusCode = document.getElementById('directory-status-filter')?.value;
            const search = document.getElementById('directory-search')?.value;
            
            const params = {
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE
            };
            
            if (targetId) params.target_id = targetId;
            if (subdomainId) params.subdomain_id = subdomainId;
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
                    <td>${directory.subdomain}</td>
                    <td>
                        <span class="status ${Utils.getStatusColor(directory.status_code)}">${directory.status_code}</span>
                    </td>
                    <td>${Utils.formatBytes(directory.content_length)}</td>
                    <td>${directory.title || '-'}</td>
                    <td>
                        <button onclick="window.open('${directory.url}', '_blank')" class="btn btn-secondary btn-small">Open</button>
                    </td>
                </tr>
            `).join('');
        } else {
            directoriesList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #006600;">No directories found. Run a content discovery scan to find directories!</td></tr>';
        }
    }
};

window.Directories = Directories;
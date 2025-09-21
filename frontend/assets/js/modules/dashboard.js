// assets/js/modules/dashboard.js - FIXED RECENT ACTIVITY

const Dashboard = {
    async init() {
        this.renderHTML();
        await this.loadData();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value" id="total-targets">0</div>
                    <div class="stat-label">Total Targets</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="total-subdomains">0</div>
                    <div class="stat-label">Total Subdomains</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" id="total-directories">0</div>
                    <div class="stat-label">Total Directories</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: #ff0000;" id="total-vulnerabilities">0</div>
                    <div class="stat-label">Total Vulnerabilities</div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">Target Overview</div>
                <div id="target-overview">
                    <p style="color: #006600;">Loading target overview...</p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">Recent Activity</div>
                <div id="recent-activity">
                    <p style="color: #006600;">Loading recent activity...</p>
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            await Promise.all([
                this.loadStats(),
                this.loadTargetOverview(),
                this.loadRecentActivity()
            ]);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    },

    async loadStats() {
        try {
            const targetsResponse = await API.targets.getAll();
            if (!targetsResponse) return;
            
            const targetsData = await targetsResponse.json();
            const targets = targetsData.success ? targetsData.data : [];
            
            // Update basic stats
            document.getElementById('total-targets').textContent = targets.length;
            
            // Calculate totals from target stats
            let totalSubdomains = 0;
            let totalDirectories = 0; 
            let totalVulnerabilities = 0;

            targets.forEach(target => {
                const targetStats = Utils.safeJsonParse(target.stats, {});
                totalSubdomains += targetStats.subdomains || 0;
                totalDirectories += targetStats.discovered_paths || 0;
                totalVulnerabilities += targetStats.vulnerabilities || 0;
            });

            document.getElementById('total-subdomains').textContent = totalSubdomains;
            document.getElementById('total-directories').textContent = totalDirectories;
            document.getElementById('total-vulnerabilities').textContent = totalVulnerabilities;
                
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    },

    async loadTargetOverview() {
        try {
            const targetsResponse = await API.targets.getAll();
            if (!targetsResponse) return;
            
            const targetsData = await targetsResponse.json();
            const targets = targetsData.success ? targetsData.data : [];

            const targetOverviewHtml = targets.map(target => {
                const targetStats = Utils.safeJsonParse(target.stats, {});

                return `
                    <div class="target-stat">
                        <div style="font-weight: bold; color: #00ff00; margin-bottom: 8px;">${target.domain}</div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                            <div style="text-align: center;">
                                <div style="font-size: 22px; font-weight: bold; color: #00ff00;">${targetStats.subdomains || 0}</div>
                                <div style="font-size: 14px; color: #006600;">Subdomains</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 22px; font-weight: bold; color: #ffff00;">${targetStats.discovered_paths || 0}</div>
                                <div style="font-size: 14px; color: #006600;">Directories</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 22px; font-weight: bold; color: #ff0000;">${targetStats.vulnerabilities || 0}</div>
                                <div style="font-size: 14px; color: #006600;">Vulnerabilities</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            if (targetOverviewHtml) {
                document.getElementById('target-overview').innerHTML = 
                    '<div style="display: grid; gap: 20px;">' + targetOverviewHtml + '</div>';
            } else {
                document.getElementById('target-overview').innerHTML = 
                    '<p style="color: #006600;">No targets configured yet. Add a target to get started!</p>';
            }
        } catch (error) {
            console.error('Failed to load target overview:', error);
            document.getElementById('target-overview').innerHTML = 
                '<p style="color: #ff0000;">Failed to load target overview</p>';
        }
    },

    async loadRecentActivity() {
        try {
            // Load both scans and targets to properly map target names
            const [scansResponse, targetsResponse] = await Promise.all([
                API.scans.getJobs({ limit: 10 }),
                API.targets.getAll()
            ]);
            
            if (!scansResponse || !scansResponse.ok || !targetsResponse || !targetsResponse.ok) {
                throw new Error('Failed to fetch data');
            }
            
            const scansData = await scansResponse.json();
            const targetsData = await targetsResponse.json();
            
            const recentScans = scansData.success ? scansData.data : [];
            const targets = targetsData.success ? targetsData.data : [];
            
            // Create a target lookup map
            const targetMap = new Map();
            targets.forEach(target => {
                targetMap.set(target.id, target.domain);
            });
            
            const recentActivity = document.getElementById('recent-activity');
            if (recentScans.length > 0) {
                recentActivity.innerHTML = recentScans.map(scan => {
                    // Try multiple field names to get the target domain
                    let targetDomain = scan.domain || 
                                     scan.target_domain || 
                                     (scan.target_id ? targetMap.get(scan.target_id) : null) ||
                                     'Unknown Target';
                    
                    // Clean up the job type display
                    let jobType = scan.job_type || 'Unknown Scan';
                    const jobTypeMap = {
                        'subdomain_scan': 'Subdomain Discovery',
                        'port_scan': 'Port Scanning',
                        'content_discovery': 'Content Discovery', 
                        'vulnerability_scan': 'Vulnerability Scan',
                        'js_files_scan': 'JavaScript Analysis',
                        'api_discovery': 'API Discovery'
                    };
                    jobType = jobTypeMap[jobType] || jobType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    
                    // Format the time
                    const timeAgo = this.getTimeAgo(scan.created_at);
                    
                    return `
                        <div style="padding: 12px 0; border-bottom: 1px solid #003300; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="color: #00ff00;">${targetDomain}</strong>
                                <span style="color: #006600;"> - ${jobType}</span>
                                <div style="font-size: 11px; color: #666; margin-top: 2px;">${timeAgo}</div>
                            </div>
                            <span class="status status-${scan.status}">${scan.status.toUpperCase()}</span>
                        </div>
                    `;
                }).join('');
            } else {
                recentActivity.innerHTML = '<p style="color: #006600;">No recent scan activity</p>';
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
            document.getElementById('recent-activity').innerHTML = `
                <p style="color: #ff0000;">Failed to load recent activity</p>
                <p style="font-size: 12px; color: #666;">Check console for details</p>
            `;
        }
    },

    // Helper function to format time ago
    getTimeAgo(dateString) {
        if (!dateString) return 'Unknown time';
        
        const now = new Date();
        const past = new Date(dateString);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return past.toLocaleDateString();
    }
};

window.Dashboard = Dashboard;
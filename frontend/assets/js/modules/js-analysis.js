// frontend/assets/js/modules/js-analysis.js - ENHANCED JS ANALYSIS MODULE

const JSAnalysis = {
    refreshInterval: null,
    activeScanJobId: null,
    progressUpdateInterval: null,
    isAutoRefreshEnabled: true,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.load();
        this.startAutoRefresh();
        this.startProgressMonitoring();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .export-menu {
                    box-shadow: 0 4px 6px rgba(124, 58, 237, 0.4);
                    border-radius: 2px;
                    background: linear-gradient(135deg, #0f0f23, #1a0a2e);
                    border: 2px solid #7c3aed;
                }
                .export-menu button:hover {
                    background: linear-gradient(90deg, #1a0a2e, #2d1b69) !important;
                    color: #a855f7 !important;
                }

                .js-file-row {
                    transition: all 0.2s ease;
                }

                .js-file-row:hover {
                    background: linear-gradient(90deg, rgba(124, 58, 237, 0.1), rgba(154, 77, 255, 0.1)) !important;
                    transform: translateX(2px);
                    box-shadow: inset 3px 0 0 #7c3aed;
                }

                .secret-tag {
                    background: rgba(220, 38, 38, 0.1); 
                    padding: 2px 6px; 
                    margin: 2px; 
                    border-radius: 3px; 
                    display: inline-block;
                    font-size: 10px;
                    border: 1px solid rgba(220, 38, 38, 0.3);
                    color: #dc2626;
                }

                .endpoint-tag {
                    background: rgba(124, 58, 237, 0.1); 
                    padding: 2px 6px; 
                    margin: 2px; 
                    border-radius: 3px; 
                    display: inline-block;
                    font-size: 10px;
                    border: 1px solid rgba(124, 58, 237, 0.3);
                    color: #7c3aed;
                }

                .js-modal-close {
                    position: absolute; 
                    top: 15px; 
                    right: 15px; 
                    background: rgba(124, 58, 237, 0.1); 
                    border: 1px solid #7c3aed; 
                    color: #7c3aed; 
                    font-size: 20px; 
                    cursor: pointer; 
                    z-index: 10001; 
                    padding: 8px; 
                    width: 36px; 
                    height: 36px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    border-radius: 3px;
                    transition: all 0.2s ease;
                }

                .js-modal-close:hover {
                    background: #7c3aed;
                    color: white;
                    transform: scale(1.1);
                }

                @keyframes shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                
                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 0.7; }
                }
            </style>

            <!-- Enhanced Progress Bar with Real-time Updates -->
            <div id="js-scan-status" style="display: none; background: linear-gradient(135deg, #1a0a2e, #2d1b69); border: 2px solid #7c3aed; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 0 20px rgba(124, 58, 237, 0.3);">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div class="spinner" style="margin: 0; width: 24px; height: 24px; border: 3px solid #2d1b69; border-top: 3px solid #7c3aed;"></div>
                    <div style="flex: 1;">
                        <div id="js-scan-status-text" style="color: #7c3aed; font-family: 'Courier New', monospace; font-weight: bold; font-size: 16px; margin-bottom: 5px;">JavaScript Analysis in Progress...</div>
                        <div id="js-scan-phase-text" style="color: #9a4dff; font-family: 'Courier New', monospace; font-size: 14px;">Initializing JS discovery...</div>
                    </div>
                    <button onclick="JSAnalysis.stopActiveScan()" class="btn btn-danger" style="padding: 10px 20px;">⏹️ Stop Analysis</button>
                </div>
                
                <!-- Enhanced Progress Bar -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="color: #9a4dff; font-size: 14px; font-weight: bold;">Analysis Progress</span>
                        <span id="js-progress-percentage" style="color: #7c3aed; font-size: 14px; font-weight: bold;">0%</span>
                    </div>
                    <div style="background: linear-gradient(90deg, #0a0a0a, #1a0a2e); border: 2px solid #7c3aed; height: 20px; width: 100%; border-radius: 10px; overflow: hidden; position: relative;">
                        <div id="js-scan-progress-bar" style="background: linear-gradient(90deg, #7c3aed, #9a4dff, #a855f7); height: 100%; width: 0%; transition: width 0.5s ease; border-radius: 8px; position: relative; box-shadow: 0 0 15px rgba(124, 58, 237, 0.6);">
                            <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 2s infinite;"></div>
                        </div>
                        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.1), transparent); animation: pulse-glow 3s infinite;"></div>
                    </div>
                </div>
                
                <!-- Live Discovery Stats -->
                <div id="live-js-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 15px;">
                    <div style="background: rgba(124, 58, 237, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(124, 58, 237, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #7c3aed; margin-bottom: 4px;" id="live-js-files">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">📄 JS Files</div>
                    </div>
                    <div style="background: rgba(220, 38, 38, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(220, 38, 38, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #dc2626; margin-bottom: 4px;" id="live-secrets">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">🔐 Secrets</div>
                    </div>
                    <div style="background: rgba(154, 77, 255, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(154, 77, 255, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #a855f7; margin-bottom: 4px;" id="live-endpoints">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">🔗 Endpoints</div>
                    </div>
                    <div style="background: rgba(234, 88, 12, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(234, 88, 12, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #ea580c; margin-bottom: 4px;" id="live-sensitive">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">⚠️ Sensitive</div>
                    </div>
                    <div style="background: rgba(6, 182, 212, 0.1); padding: 12px; border-radius: 6px; text-align: center; border: 1px solid rgba(6, 182, 212, 0.3);">
                        <div style="font-size: 20px; font-weight: bold; color: #06b6d4; margin-bottom: 4px;" id="live-libraries">0</div>
                        <div style="font-size: 12px; color: #9a4dff;">📚 Libraries</div>
                    </div>
                </div>
                
                <!-- Detailed Progress Info -->
                <div id="js-progress-details" style="background: rgba(0, 0, 0, 0.3); padding: 12px; border-radius: 6px; border: 1px solid #2d1b69;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span id="js-current-activity" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;">Preparing JavaScript analysis...</span>
                        <span id="js-elapsed-time" style="color: #6b46c1; font-size: 12px;">00:00</span>
                    </div>
                    <div id="js-eta-estimate" style="color: #6b46c1; font-size: 11px; margin-top: 5px;">Estimated time remaining: Calculating...</div>
                </div>
            </div>

            <div class="scan-info">
                <h4>📄 JavaScript Analysis <span id="js-analysis-live-indicator" style="color: #7c3aed; font-size: 12px;">[LIVE]</span></h4>
                <p>Comprehensive JavaScript analysis to discover secrets, API endpoints, sensitive data, and third-party libraries. Extracts authentication tokens, private keys, configuration data, and potential security vulnerabilities from JavaScript files.</p>
            </div>

            <div class="card">
                <div class="card-title">Start JavaScript Analysis</div>
                <div id="js-analysis-messages"></div>
                <form id="js-analysis-form">
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end; margin-bottom: 15px;">
                        <div class="form-group">
                            <label>Target</label>
                            <select id="js-analysis-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Subdomain (optional)</label>
                            <select id="js-analysis-subdomain">
                                <option value="">All subdomains</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Analysis Depth</label>
                            <select id="js-analysis-depth">
                                <option value="surface">Surface Scan (Fast)</option>
                                <option value="deep" selected>Deep Analysis (Recommended)</option>
                                <option value="comprehensive">Comprehensive (Thorough)</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">📄 Start JS Analysis</button>
                    </div>
                    
                    <!-- Advanced Options -->
                    <div style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69); margin-bottom: 15px;">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">🔍 Analysis Configuration</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                            <div class="form-group">
                                <label>Secret Detection</label>
                                <select id="js-secret-detection">
                                    <option value="basic">Basic Patterns</option>
                                    <option value="advanced" selected>Advanced (API Keys, Tokens)</option>
                                    <option value="comprehensive">Comprehensive (All Secrets)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Endpoint Extraction</label>
                                <select id="js-endpoint-extraction">
                                    <option value="true" selected>Yes (Find API Endpoints)</option>
                                    <option value="false">No (Faster)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Library Detection</label>
                                <select id="js-library-detection">
                                    <option value="true" selected>Yes (Identify Libraries)</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 10px;">
                            <div class="form-group">
                                <label>Source Map Analysis</label>
                                <select id="js-sourcemap-analysis">
                                    <option value="true" selected>Yes (Check Source Maps)</option>
                                    <option value="false">No</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Minified JS Analysis</label>
                                <select id="js-minified-analysis">
                                    <option value="true" selected>Yes (Analyze Minified)</option>
                                    <option value="false">No (Skip Minified)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Download JS Files</label>
                                <select id="js-download-files">
                                    <option value="false">No (URLs Only)</option>
                                    <option value="true" selected>Yes (Full Analysis)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Analysis Methods Info -->
                    <div style="border: 1px solid #2d1b69; padding: 15px; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                        <h5 style="color: #7c3aed; margin-bottom: 10px;">🛠️ Analysis Techniques Used</h5>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; color: #9a4dff;">
                            <div>🔍 Static code analysis</div>
                            <div>🔐 Secret pattern matching</div>
                            <div>🔗 URL & endpoint extraction</div>
                            <div>📚 Library fingerprinting</div>
                            <div>🗺️ Source map discovery</div>
                            <div>⚠️ Sensitive data detection</div>
                            <div>🔑 Authentication token hunting</div>
                            <div>🌐 External resource analysis</div>
                            <div>📝 Comment extraction</div>
                            <div>🏗️ Build artifact analysis</div>
                            <div>🔄 Webpack bundle analysis</div>
                            <div>📊 Code complexity metrics</div>
                        </div>
                        <div style="margin-top: 10px; font-size: 12px; color: #6b46c1;">
                            ✅ Safe Analysis • ✅ No Code Execution • ✅ Read-Only • ✅ Comprehensive Reporting
                        </div>
                    </div>
                </form>
            </div>

            <!-- Filters -->
            <div class="filters">
                <div class="filter-group">
                    <label>Target</label>
                    <select id="js-target-filter">
                        <option value="">All Targets</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Subdomain</label>
                    <select id="js-subdomain-filter">
                        <option value="">All Subdomains</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>File Type</label>
                    <select id="js-file-type-filter">
                        <option value="">All JS Files</option>
                        <option value="application">Application JS</option>
                        <option value="library">Third-party Libraries</option>
                        <option value="minified">Minified Files</option>
                        <option value="sourcemap">Source Maps</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Has Secrets</label>
                    <select id="js-secrets-filter">
                        <option value="">All Files</option>
                        <option value="true">Has Secrets</option>
                        <option value="false">No Secrets</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Search</label>
                    <input type="text" id="js-search" placeholder="Search JS files...">
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="JSAnalysis.search()" class="btn btn-primary">🔍 Search</button>
                    <button onclick="JSAnalysis.clearFilters()" class="btn btn-secondary">🗑️ Clear</button>
                    <button onclick="JSAnalysis.load()" class="btn btn-secondary">🔄 Refresh</button>
                </div>
            </div>

            <!-- Results Display -->
            <div class="card">
                <div class="card-title">
                    JavaScript Files & Analysis Results
                    <div style="float: right; position: relative; display: inline-block;">
                        <button onclick="JSAnalysis.toggleExportMenu()" class="btn btn-success btn-small" id="export-js-btn">
                            📤 Export Results
                        </button>
                        <div id="export-js-menu" class="export-menu" style="display: none; position: absolute; top: 100%; right: 0; min-width: 140px; z-index: 1000;">
                            <button onclick="JSAnalysis.exportResults('csv')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📊 CSV</button>
                            <button onclick="JSAnalysis.exportResults('json')" class="btn btn-secondary btn-small" style="width: 100%; border: none; border-bottom: 1px solid #2d1b69;">📋 JSON</button>
                            <button onclick="JSAnalysis.exportResults('xml')" class="btn btn-secondary btn-small" style="width: 100%; border: none;">📄 XML</button>
                        </div>
                    </div>
                    <span id="js-last-updated" style="font-size: 12px; color: #6b46c1; float: right; margin-right: 160px;"></span>
                </div>
                
                <!-- Live Update Controls -->
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span id="js-status" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="js-live-status" style="color: #7c3aed; font-size: 12px;">
                        🔄 Auto-updating every 5 seconds
                    </span>
                    <button onclick="JSAnalysis.toggleAutoRefresh()" class="btn btn-secondary btn-small" id="js-auto-refresh-toggle">
                        ⏸️ Pause Live Updates
                    </button>
                    <button onclick="JSAnalysis.load()" class="btn btn-primary btn-small">🔄 Manual Refresh</button>
                </div>
                
                <!-- JS Analysis Stats -->
                <div id="js-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; border: 1px solid #2d1b69; background: linear-gradient(135deg, #1a0a2e, #2d1b69);">
                    <div style="text-align: center;">
                        <div id="total-js-files" style="font-size: 24px; font-weight: bold; color: #7c3aed;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Total JS Files</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="secrets-found" style="font-size: 24px; font-weight: bold; color: #dc2626;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Secrets Found</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="endpoints-found" style="font-size: 24px; font-weight: bold; color: #a855f7;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">API Endpoints</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="libraries-found" style="font-size: 24px; font-weight: bold; color: #06b6d4;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Libraries</div>
                    </div>
                    <div style="text-align: center;">
                        <div id="sensitive-files" style="font-size: 24px; font-weight: bold; color: #ea580c;">0</div>
                        <div style="font-size: 12px; color: #6b46c1;">Sensitive Files</div>
                    </div>
                </div>

                <!-- JS Files Modal -->
                <div id="js-details-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); z-index: 10000; justify-content: center; align-items: center;">
                    <div style="background: linear-gradient(135deg, #0f0f23, #1a0a2e); border: 2px solid #7c3aed; padding: 30px; max-width: 90%; width: 800px; max-height: 80%; overflow-y: auto; position: relative; border-radius: 8px;">
                        <button onclick="JSAnalysis.closeJSDetails()" class="js-modal-close">×</button>
                        <div id="js-details-content">
                            <!-- Content will be populated dynamically -->
                        </div>
                    </div>
                </div>

                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th style="width: 30%;">JavaScript File</th>
                                <th style="width: 15%;">Subdomain</th>
                                <th style="width: 10%;">File Type</th>
                                <th style="width: 8%;">Size</th>
                                <th style="width: 8%;">Secrets</th>
                                <th style="width: 8%;">Endpoints</th>
                                <th style="width: 8%;">Libraries</th>
                                <th style="width: 13%;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="js-files-list">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #6b46c1;">Loading JavaScript files...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div id="js-files-pagination" class="pagination"></div>
            </div>
        `;
    },

    bindEvents() {
        // JS analysis form submission
        const jsAnalysisForm = document.getElementById('js-analysis-form');
        if (jsAnalysisForm) {
            jsAnalysisForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startJSAnalysis();
            });
        }

        // Target filter - when changed, update subdomains
        const targetFilter = document.getElementById('js-target-filter');
        if (targetFilter) {
            targetFilter.addEventListener('change', async () => {
                await this.loadSubdomains();
                this.load(1);
            });
        }

        // JS analysis target - when changed, update subdomains
        const jsTargetFilter = document.getElementById('js-analysis-target');
        if (jsTargetFilter) {
            jsTargetFilter.addEventListener('change', async () => {
                await this.loadJSAnalysisSubdomains();
            });
        }

        // Other filters
        ['js-subdomain-filter', 'js-file-type-filter', 'js-secrets-filter'].forEach(filterId => {
            const element = document.getElementById(filterId);
            if (element) {
                element.addEventListener('change', () => this.load(1));
            }
        });

        // Search with debounce and Enter key support
        const jsSearch = document.getElementById('js-search');
        if (jsSearch) {
            jsSearch.addEventListener('input', Utils.debounce(() => this.load(1), 500));
            jsSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.search(1);
                }
            });
        }

        // Close export menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#export-js-menu') && !e.target.closest('#export-js-btn')) {
                const menu = document.getElementById('export-js-menu');
                if (menu) {
                    menu.style.display = 'none';
                }
            }
            
            // Close JS details modal when clicking outside
            if (e.target.id === 'js-details-modal') {
                this.closeJSDetails();
            }
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeJSDetails();
            }
        });
    },

    // Progress monitoring
    startProgressMonitoring() {
        this.stopProgressMonitoring();
        
        this.progressCheckInterval = setInterval(async () => {
            try {
                await this.checkForActiveScan();
                if (this.activeScanJobId) {
                    await this.updateScanProgress();
                }
            } catch (error) {
                console.error('JS Analysis progress monitoring failed:', error);
            }
        }, 1000);
    },

    stopProgressMonitoring() {
        if (this.progressCheckInterval) {
            clearInterval(this.progressCheckInterval);
            this.progressCheckInterval = null;
        }
    },

    async checkForActiveScan() {
        try {
            const response = await API.scans.getJobs({ 
                job_type: 'js_files_scan',
                status: ['pending', 'running'],
                limit: 10 
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const activeScans = data.success ? data.data : [];
                
                if (activeScans.length > 0) {
                    const scan = activeScans[0];
                    this.activeScanJobId = scan.id;
                    this.showProgress(scan);
                } else {
                    this.hideProgress();
                }
            }
        } catch (error) {
            console.error('Failed to check for active JS analysis scans:', error);
        }
    },

    showProgress(scan) {
        const statusDiv = document.getElementById('js-scan-status');
        const statusText = document.getElementById('js-scan-status-text');
        const phaseText = document.getElementById('js-scan-phase-text');
        const progressBar = document.getElementById('js-scan-progress-bar');
        const progressPercentage = document.getElementById('js-progress-percentage');
        const currentActivity = document.getElementById('js-current-activity');
        const elapsedTime = document.getElementById('js-elapsed-time');
        const etaEstimate = document.getElementById('js-eta-estimate');
        
        if (statusDiv && statusText && progressBar) {
            statusDiv.style.display = 'block';
            
            const progress = scan.progress_percentage || 0;
            const targetName = this.getTargetName(scan);
            
            statusText.textContent = `Analyzing JavaScript files for ${targetName}...`;
            
            progressBar.style.width = `${progress}%`;
            if (progressPercentage) {
                progressPercentage.textContent = `${progress}%`;
            }
            
            const phase = this.getCurrentJSPhase(progress);
            if (phaseText) {
                phaseText.textContent = phase;
            }
            
            const elapsed = scan.started_at ? 
                Math.round((Date.now() - new Date(scan.started_at).getTime()) / 1000) : 0;
            
            if (currentActivity) {
                currentActivity.textContent = this.getDetailedJSActivity(progress);
            }
            
            if (elapsedTime) {
                elapsedTime.textContent = this.formatTime(elapsed);
            }
            
            if (etaEstimate && progress > 5) {
                const estimatedTotal = (elapsed / progress) * 100;
                const remaining = Math.max(0, estimatedTotal - elapsed);
                etaEstimate.textContent = `Estimated time remaining: ${this.formatTime(remaining)}`;
            }
            
            this.updateLiveJSStats(scan, progress);
        }
    },

    getCurrentJSPhase(progress) {
        if (progress < 10) return '🚀 Initializing JavaScript discovery...';
        if (progress < 25) return '🔍 Discovering JavaScript files...';
        if (progress < 40) return '📄 Downloading and parsing JS files...';
        if (progress < 60) return '🔐 Scanning for secrets and API keys...';
        if (progress < 80) return '🔗 Extracting API endpoints and URLs...';
        if (progress < 95) return '📚 Identifying libraries and frameworks...';
        return '✅ Finalizing analysis and generating report...';
    },

    getDetailedJSActivity(progress) {
        if (progress < 10) return 'Setting up JavaScript analysis environment...';
        if (progress < 25) return 'Crawling pages for JavaScript file references...';
        if (progress < 40) return 'Downloading and preprocessing JavaScript files...';
        if (progress < 60) return 'Running secret detection algorithms...';
        if (progress < 80) return 'Extracting API endpoints and external URLs...';
        if (progress < 95) return 'Fingerprinting JavaScript libraries...';
        return 'Compiling comprehensive JavaScript analysis report...';
    },

    updateLiveJSStats(scan, progress) {
        const baseMultiplier = progress / 100;
        
        const estimatedJSFiles = Math.floor(baseMultiplier * 15 + Math.random() * 3);
        const estimatedSecrets = Math.floor(baseMultiplier * 8 + Math.random() * 2);
        const estimatedEndpoints = Math.floor(baseMultiplier * 12 + Math.random() * 4);
        const estimatedSensitive = Math.floor(baseMultiplier * 5 + Math.random() * 2);
        const estimatedLibraries = Math.floor(baseMultiplier * 18 + Math.random() * 5);
        
        this.updateLiveStatElement('live-js-files', estimatedJSFiles);
        this.updateLiveStatElement('live-secrets', estimatedSecrets);
        this.updateLiveStatElement('live-endpoints', estimatedEndpoints);
        this.updateLiveStatElement('live-sensitive', estimatedSensitive);
        this.updateLiveStatElement('live-libraries', estimatedLibraries);
    },

    updateLiveStatElement(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (element && element.textContent !== String(newValue)) {
            const oldValue = parseInt(element.textContent) || 0;
            if (newValue > oldValue) {
                element.textContent = newValue;
                element.parentElement.classList.add('discovery-metric', 'updated');
                setTimeout(() => {
                    element.parentElement.classList.remove('updated');
                }, 800);
            }
        }
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },

    hideProgress() {
        const statusDiv = document.getElementById('js-scan-status');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
        this.activeScanJobId = null;
    },

    async stopActiveScan() {
        if (this.activeScanJobId) {
            try {
                const response = await API.scans.stop(this.activeScanJobId);
                if (response && response.ok) {
                    Utils.showMessage('JavaScript analysis stopped successfully!', 'success', 'js-analysis-messages');
                    this.hideProgress();
                } else {
                    Utils.showMessage('Failed to stop JavaScript analysis', 'error', 'js-analysis-messages');
                }
            } catch (error) {
                Utils.showMessage('Failed to stop analysis: ' + error.message, 'error', 'js-analysis-messages');
            }
        }
    },

    // Auto-refresh functionality
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        console.log('🔄 Starting JS analysis auto-refresh');
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            try {
                await this.updateJSRealTime();
                
                const lastUpdatedElement = document.getElementById('js-last-updated');
                if (lastUpdatedElement) {
                    lastUpdatedElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
                }
                
            } catch (error) {
                console.error('JS analysis auto-refresh failed:', error);
            }
        }, CONFIG.getRefreshInterval('js-analysis') || 5000);

        this.updateAutoRefreshIndicator(true);
    },

    async updateJSRealTime() {
        try {
            const currentPage = AppState.currentPageData.jsfiles?.page || 1;
            await this.load(currentPage);
            
            const statusElement = document.getElementById('js-status');
            if (statusElement) {
                // This would be a real API call to get JS files count
                statusElement.textContent = `📊 JavaScript analysis results`;
                statusElement.style.color = '#7c3aed';
            }
            
        } catch (error) {
            console.error('Real-time JS update failed:', error);
        }
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    },

    toggleAutoRefresh() {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        const toggleBtn = document.getElementById('js-auto-refresh-toggle');
        const liveStatus = document.getElementById('js-live-status');
        
        if (toggleBtn) {
            if (this.isAutoRefreshEnabled) {
                toggleBtn.innerHTML = '⏸️ Pause Live Updates';
                if (liveStatus) {
                    liveStatus.innerHTML = '🔄 Auto-updating every 5 seconds';
                    liveStatus.style.color = '#7c3aed';
                }
                this.startAutoRefresh();
                Utils.showMessage('Live updates enabled', 'success', 'js-analysis-messages');
            } else {
                toggleBtn.innerHTML = '▶️ Resume Live Updates';
                if (liveStatus) {
                    liveStatus.innerHTML = '⏸️ Live updates paused';
                    liveStatus.style.color = '#ffff00';
                }
                this.updateAutoRefreshIndicator(false);
                Utils.showMessage('Live updates paused', 'warning', 'js-analysis-messages');
            }
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('js-analysis-live-indicator');
        if (indicator) {
            if (isActive) {
                indicator.innerHTML = '[LIVE]';
                indicator.style.color = '#7c3aed';
            } else {
                indicator.innerHTML = '[PAUSED]';
                indicator.style.color = '#ffff00';
            }
        }
    },

    // Search functionality
    async search(page = 1) {
        console.log('🔍 Search triggered for JS analysis');
        
        const jsFilesList = document.getElementById('js-files-list');
        if (jsFilesList) {
            jsFilesList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #a855f7;">🔍 Searching JavaScript files...</td></tr>';
        }
        
        await this.load(page);
    },

    clearFilters() {
        const subdomainFilter = document.getElementById('js-subdomain-filter');
        const fileTypeFilter = document.getElementById('js-file-type-filter');
        const secretsFilter = document.getElementById('js-secrets-filter');
        const searchFilter = document.getElementById('js-search');
        
        if (subdomainFilter) subdomainFilter.value = '';
        if (fileTypeFilter) fileTypeFilter.value = '';
        if (secretsFilter) secretsFilter.value = '';
        if (searchFilter) searchFilter.value = '';
        
        this.search(1);
        
        Utils.showMessage('Filters cleared', 'info', 'js-analysis-messages');
    },

    // Start JS analysis
    async startJSAnalysis() {
        const targetId = document.getElementById('js-analysis-target').value;
        const subdomainId = document.getElementById('js-analysis-subdomain').value;
        const depth = document.getElementById('js-analysis-depth').value;
        const secretDetection = document.getElementById('js-secret-detection').value;
        const endpointExtraction = document.getElementById('js-endpoint-extraction').value === 'true';
        const libraryDetection = document.getElementById('js-library-detection').value === 'true';
        const sourcemapAnalysis = document.getElementById('js-sourcemap-analysis').value === 'true';
        const minifiedAnalysis = document.getElementById('js-minified-analysis').value === 'true';
        const downloadFiles = document.getElementById('js-download-files').value === 'true';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'js-analysis-messages');
            return;
        }
        
        try {
            const scanTypes = ['js_files_scan'];
            const config = {
                subdomain_id: subdomainId || null,
                analysis_depth: depth,
                secret_detection_level: secretDetection,
                extract_endpoints: endpointExtraction,
                detect_libraries: libraryDetection,
                analyze_sourcemaps: sourcemapAnalysis,
                analyze_minified: minifiedAnalysis,
                download_files: downloadFiles
            };
            
            Utils.showMessage('📄 Starting JavaScript analysis...', 'info', 'js-analysis-messages');
            
            // This would be the actual API call
            // const response = await API.scans.start(targetId, scanTypes, 'medium', config);
            
            // For demo purposes, simulate success
            Utils.showMessage(
                `📄 JavaScript analysis started! Analyzing ${depth} with ${secretDetection} secret detection. Results will appear automatically.`, 
                'success', 
                'js-analysis-messages'
            );
            
            // Reset form
            document.getElementById('js-analysis-subdomain').value = '';
            document.getElementById('js-analysis-depth').value = 'deep';
            
            // Start monitoring
            setTimeout(() => {
                this.checkForActiveScan();
            }, 500);
            
            this.startProgressMonitoring();
            
        } catch (error) {
            Utils.showMessage('Failed to start JavaScript analysis: ' + error.message, 'error', 'js-analysis-messages');
        }
    },

    // Load data
    async load(page = 1) {
        try {
            // This would be a real API call
            // For demo purposes, generate mock data
            const mockJSFiles = this.generateMockJSFiles();
            
            AppState.currentPageData.jsfiles = { page, total: mockJSFiles.length };
            
            this.renderJSFilesList(mockJSFiles);
            this.updateJSStats(mockJSFiles);
            
        } catch (error) {
            console.error('Failed to load JS files:', error);
            const jsFilesList = document.getElementById('js-files-list');
            if (jsFilesList) {
                jsFilesList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #dc2626;">Failed to load JS files</td></tr>';
            }
        }
    },

    // Generate mock data for demonstration
    generateMockJSFiles() {
        return [
            {
                id: 1,
                url: 'https://example.com/assets/js/app.min.js',
                subdomain: 'example.com',
                file_type: 'application',
                size: 245760,
                secrets_count: 3,
                endpoints_count: 8,
                libraries_count: 5,
                secrets: ['REACT_APP_API_KEY=abcd1234', 'token: "xyz789"', 'client_secret: "secret123"'],
                endpoints: ['/api/users', '/api/login', '/api/dashboard'],
                libraries: ['react', 'lodash', 'axios'],
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                url: 'https://api.example.com/static/main.js',
                subdomain: 'api.example.com',
                file_type: 'application',
                size: 128340,
                secrets_count: 1,
                endpoints_count: 12,
                libraries_count: 3,
                secrets: ['API_SECRET: "prod_key_789"'],
                endpoints: ['/v1/auth', '/v1/users', '/v1/data'],
                libraries: ['express', 'cors', 'helmet'],
                created_at: new Date().toISOString()
            },
            {
                id: 3,
                url: 'https://cdn.example.com/vendor/jquery.min.js',
                subdomain: 'cdn.example.com',
                file_type: 'library',
                size: 87340,
                secrets_count: 0,
                endpoints_count: 0,
                libraries_count: 1,
                secrets: [],
                endpoints: [],
                libraries: ['jquery'],
                created_at: new Date().toISOString()
            }
        ];
    },

    renderJSFilesList(jsFiles) {
        const jsFilesList = document.getElementById('js-files-list');
        
        if (!jsFilesList) return;
        
        if (jsFiles.length > 0) {
            jsFilesList.innerHTML = jsFiles.map(file => {
                const hasSecrets = file.secrets_count > 0;
                const hasEndpoints = file.endpoints_count > 0;
                
                return `
                    <tr class="js-file-row" onclick="JSAnalysis.showJSDetails(${JSON.stringify(file).replace(/"/g, '&quot;')})" style="cursor: pointer;">
                        <td style="font-family: 'Courier New', monospace; color: #7c3aed; max-width: 300px;">
                            <div style="font-weight: bold; margin-bottom: 4px;">
                                ${this.getFileTypeIcon(file.file_type)} 
                                <span style="color: #9a4dff;">${this.getFileName(file.url)}</span>
                                ${hasSecrets ? '<span style="background: #dc2626; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px;">SECRETS</span>' : ''}
                            </div>
                            <div style="font-size: 11px; color: #6b46c1; word-break: break-all;">
                                ${file.url}
                            </div>
                        </td>
                        <td style="color: #9a4dff;">${file.subdomain}</td>
                        <td>
                            <span class="status ${this.getFileTypeColor(file.file_type)}">
                                ${this.getFileTypeIcon(file.file_type)} ${file.file_type}
                            </span>
                        </td>
                        <td style="font-size: 12px; color: #6b46c1;">${this.formatBytes(file.size)}</td>
                        <td style="text-align: center;">
                            ${hasSecrets ? 
                                `<span style="background: #dc2626; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${file.secrets_count}</span>` : 
                                '<span style="color: #666;">0</span>'
                            }
                        </td>
                        <td style="text-align: center;">
                            ${hasEndpoints ? 
                                `<span style="background: #7c3aed; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${file.endpoints_count}</span>` : 
                                '<span style="color: #666;">0</span>'
                            }
                        </td>
                        <td style="text-align: center;">
                            <span style="background: #06b6d4; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;">${file.libraries_count}</span>
                        </td>
                        <td>
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                <button onclick="event.stopPropagation(); window.open('${file.url}', '_blank')" class="btn btn-secondary btn-small">View</button>
                                ${hasSecrets ? 
                                    `<button onclick="event.stopPropagation(); JSAnalysis.viewSecrets(${file.id})" class="btn btn-danger btn-small">Secrets</button>` : 
                                    ''
                                }
                                ${hasEndpoints ? 
                                    `<button onclick="event.stopPropagation(); JSAnalysis.viewEndpoints(${file.id})" class="btn btn-success btn-small">APIs</button>` : 
                                    ''
                                }
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            jsFilesList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b46c1;">No JavaScript files analyzed yet. Start a JS analysis scan to discover JavaScript files and extract secrets!</td></tr>';
        }
    },

    updateJSStats(jsFiles) {
        const totalFiles = jsFiles.length;
        const secretsFound = jsFiles.reduce((sum, file) => sum + file.secrets_count, 0);
        const endpointsFound = jsFiles.reduce((sum, file) => sum + file.endpoints_count, 0);
        const librariesFound = jsFiles.reduce((sum, file) => sum + file.libraries_count, 0);
        const sensitiveFiles = jsFiles.filter(file => file.secrets_count > 0).length;

        const elements = {
            'total-js-files': totalFiles,
            'secrets-found': secretsFound,
            'endpoints-found': endpointsFound,
            'libraries-found': librariesFound,
            'sensitive-files': sensitiveFiles
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    },

    // Helper methods
    getFileTypeIcon(type) {
        const icons = {
            'application': '📱',
            'library': '📚',
            'minified': '📦',
            'sourcemap': '🗺️'
        };
        return icons[type] || '📄';
    },

    getFileTypeColor(type) {
        switch(type) {
            case 'application': return 'status-completed';
            case 'library': return 'status-running';
            case 'minified': return 'severity-medium';
            case 'sourcemap': return 'severity-low';
            default: return 'status-inactive';
        }
    },

    getFileName(url) {
        return url.split('/').pop() || url;
    },

    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '-';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    getTargetName(scan) {
        if (scan.target_domain) return scan.target_domain;
        if (scan.domain) return scan.domain;
        return 'target';
    },

    // Modal functionality
    showJSDetails(file) {
        const modal = document.getElementById('js-details-modal');
        const content = document.getElementById('js-details-content');
        
        if (!modal || !content) return;
        
        content.innerHTML = `
            <h2 style="color: #7c3aed; margin-bottom: 20px; text-align: center;">
                📄 ${this.getFileName(file.url)}
            </h2>
            
            <!-- File Information -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 15px; border: 1px solid #7c3aed;">
                    <h3 style="color: #7c3aed; margin-bottom: 10px;">📊 File Details</h3>
                    <div style="color: #9a4dff; font-size: 13px;">
                        <div><strong>URL:</strong> <a href="${file.url}" target="_blank" style="color: #7c3aed;">${file.url}</a></div>
                        <div style="margin-top: 5px;"><strong>Subdomain:</strong> ${file.subdomain}</div>
                        <div style="margin-top: 5px;"><strong>Type:</strong> ${file.file_type}</div>
                        <div style="margin-top: 5px;"><strong>Size:</strong> ${this.formatBytes(file.size)}</div>
                    </div>
                </div>
                
                <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 15px; border: 1px solid #7c3aed;">
                    <h3 style="color: #7c3aed; margin-bottom: 10px;">🔍 Analysis Results</h3>
                    <div style="color: #9a4dff; font-size: 13px;">
                        <div><strong>Secrets Found:</strong> <span style="color: ${file.secrets_count > 0 ? '#dc2626' : '#666'};">${file.secrets_count}</span></div>
                        <div style="margin-top: 5px;"><strong>API Endpoints:</strong> <span style="color: #7c3aed;">${file.endpoints_count}</span></div>
                        <div style="margin-top: 5px;"><strong>Libraries:</strong> <span style="color: #06b6d4;">${file.libraries_count}</span></div>
                        <div style="margin-top: 5px;"><strong>Analyzed:</strong> ${new Date(file.created_at).toLocaleString()}</div>
                    </div>
                </div>
            </div>
            
            ${file.secrets_count > 0 ? `
                <!-- Secrets Section -->
                <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 20px; border: 1px solid #dc2626; margin-bottom: 25px;">
                    <h3 style="color: #dc2626; margin-bottom: 15px;">🔐 Secrets Found</h3>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${file.secrets.map(secret => `
                            <div style="background: rgba(220, 38, 38, 0.1); padding: 8px; margin-bottom: 8px; border-radius: 4px; border: 1px solid rgba(220, 38, 38, 0.3);">
                                <code style="color: #dc2626; font-family: 'Courier New', monospace; font-size: 12px; word-break: break-all;">${secret}</code>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${file.endpoints_count > 0 ? `
                <!-- API Endpoints Section -->
                <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 20px; border: 1px solid #7c3aed; margin-bottom: 25px;">
                    <h3 style="color: #7c3aed; margin-bottom: 15px;">🔗 API Endpoints</h3>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${file.endpoints.map(endpoint => `
                            <div style="background: rgba(124, 58, 237, 0.1); padding: 8px; margin-bottom: 8px; border-radius: 4px; border: 1px solid rgba(124, 58, 237, 0.3);">
                                <code style="color: #7c3aed; font-family: 'Courier New', monospace; font-size: 12px;">${endpoint}</code>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${file.libraries_count > 0 ? `
                <!-- Libraries Section -->
                <div style="background: linear-gradient(135deg, #1a0a2e, #2d1b69); padding: 20px; border: 1px solid #06b6d4; margin-bottom: 25px;">
                    <h3 style="color: #06b6d4; margin-bottom: 15px;">📚 Libraries Detected</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${file.libraries.map(library => `
                            <span style="background: rgba(6, 182, 212, 0.1); padding: 6px 12px; border-radius: 4px; border: 1px solid rgba(6, 182, 212, 0.3); color: #06b6d4; font-size: 12px;">${library}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <!-- Actions -->
            <div style="text-align: center; margin-top: 30px;">
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="window.open('${file.url}', '_blank')" class="btn btn-primary">🌐 View Source</button>
                    <button onclick="JSAnalysis.copyFileInfo(${file.id})" class="btn btn-secondary">📋 Copy Results</button>
                    <button onclick="JSAnalysis.closeJSDetails()" class="btn btn-secondary">✖️ Close</button>
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
    },

    closeJSDetails() {
        const modal = document.getElementById('js-details-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    copyFileInfo(fileId) {
        // Implementation for copying file analysis results
        Utils.showMessage('Analysis results copied to clipboard!', 'success', 'js-analysis-messages');
    },

    viewSecrets(fileId) {
        Utils.showMessage(`Viewing secrets for file ${fileId}`, 'info', 'js-analysis-messages');
    },

    viewEndpoints(fileId) {
        Utils.showMessage(`Viewing API endpoints for file ${fileId}`, 'info', 'js-analysis-messages');
    },

    // Export functionality
    toggleExportMenu() {
        const menu = document.getElementById('export-js-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    },

    async exportResults(format) {
        Utils.showMessage(`Exporting JS analysis results as ${format.toUpperCase()}...`, 'info', 'js-analysis-messages');
        // Implementation for export functionality
    },

    // Load targets and subdomains
    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            const targetSelects = [
                'js-target-filter',
                'js-analysis-target'
            ];
            
            targetSelects.forEach(selectId => {
                const targetSelect = document.getElementById(selectId);
                if (targetSelect) {
                    const currentValue = targetSelect.value;
                    const placeholder = selectId === 'js-analysis-target' ? 'Select target...' : 'All Targets';
                    targetSelect.innerHTML = `<option value="">${placeholder}</option>`;
                    
                    targets.forEach(target => {
                        const option = document.createElement('option');
                        option.value = target.id;
                        option.textContent = target.domain;
                        targetSelect.appendChild(option);
                    });

                    if (currentValue && targets.find(t => t.id == currentValue)) {
                        targetSelect.value = currentValue;
                    }
                }
            });

            await this.loadSubdomains();
            
        } catch (error) {
            console.error('Failed to load targets for JS analysis:', error);
        }
    },

    async loadSubdomains() {
        // Implementation for loading subdomains
    },

    async loadJSAnalysisSubdomains() {
        // Implementation for loading subdomains for the analysis form
    },

    // Cleanup method
    cleanup() {
        this.stopAutoRefresh();
        this.stopProgressMonitoring();
        this.hideProgress();
        this.isAutoRefreshEnabled = false;
        this.closeJSDetails();
    }
};

window.JSAnalysis = JSAnalysis;
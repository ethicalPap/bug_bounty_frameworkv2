// frontend/assets/js/modules/enhanced-bugbounty.js - Comprehensive Bug Bounty Workflows

const EnhancedBugBounty = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
    targetsCache: {},
    currentAssessment: null,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadTargets();
        await this.loadAssessments();
        this.startRealTimeUpdates();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .workflow-progress {
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border: 2px solid #9a4dff;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                
                .phase-timeline {
                    display: flex;
                    justify-content: space-between;
                    margin: 20px 0;
                    position: relative;
                }
                
                .phase-timeline::before {
                    content: '';
                    position: absolute;
                    top: 20px;
                    left: 40px;
                    right: 40px;
                    height: 2px;
                    background: #2d1b69;
                    z-index: 1;
                }
                
                .phase-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    z-index: 2;
                    min-width: 100px;
                }
                
                .phase-circle {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    font-weight: bold;
                    border: 3px solid;
                    background: rgba(26, 10, 46, 0.9);
                }
                
                .phase-circle.completed {
                    border-color: #00ff9f;
                    background: linear-gradient(135deg, #00ff9f, #00cc7e);
                    color: #000;
                }
                
                .phase-circle.active {
                    border-color: #9a4dff;
                    background: linear-gradient(135deg, #9a4dff, #7b2cbf);
                    animation: pulse 2s infinite;
                }
                
                .phase-circle.pending {
                    border-color: #555;
                    color: #999;
                }
                
                .phase-label {
                    margin-top: 8px;
                    font-size: 11px;
                    text-align: center;
                    max-width: 80px;
                }
                
                .assessment-card {
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border: 2px solid #9a4dff;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 15px;
                    position: relative;
                }
                
                .assessment-card.running {
                    border-color: #00ff9f;
                    animation: glow 2s ease-in-out infinite alternate;
                }
                
                @keyframes glow {
                    from { box-shadow: 0 0 5px rgba(154, 77, 255, 0.5); }
                    to { box-shadow: 0 0 20px rgba(154, 77, 255, 0.8); }
                }
                
                .finding-severity-critical { background: linear-gradient(135deg, #ff0000, #cc0000); }
                .finding-severity-high { background: linear-gradient(135deg, #ff6600, #cc4400); }
                .finding-severity-medium { background: linear-gradient(135deg, #ffaa00, #cc8800); }
                .finding-severity-low { background: linear-gradient(135deg, #00ff00, #00cc00); }
                
                .attack-chain {
                    background: rgba(255, 68, 68, 0.1);
                    border: 1px solid #ff4444;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 0;
                }
                
                .methodology-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .methodology-card {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #9a4dff;
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .methodology-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(154, 77, 255, 0.3);
                }
                
                .methodology-card.selected {
                    border-color: #00ff9f;
                    background: rgba(0, 255, 159, 0.1);
                }
                
                .results-tabs {
                    display: flex;
                    border-bottom: 2px solid #9a4dff;
                    margin-bottom: 20px;
                }
                
                .results-tab {
                    padding: 10px 20px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: all 0.3s;
                }
                
                .results-tab.active {
                    border-bottom-color: #00ff9f;
                    color: #00ff9f;
                }
                
                .results-tab:hover {
                    background: rgba(154, 77, 255, 0.1);
                }
                
                .scrollable-results {
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid #9a4dff;
                    border-radius: 4px;
                    padding: 15px;
                    background: rgba(26, 10, 46, 0.3);
                }
            </style>

            <div class="scan-info">
                <h4>🎯 Enhanced Bug Bounty Workflows</h4>
                <p>Comprehensive automated bug bounty assessments using systematic methodologies. Includes reconnaissance, attack surface analysis, vulnerability assessment, and systematic exploitation with detailed reporting.</p>
            </div>

            <!-- Start Assessment Section -->
            <div class="card">
                <div class="card-title">Start Comprehensive Bug Bounty Assessment</div>
                <div id="assessment-messages"></div>
                
                <form id="assessment-form">
                    <div class="methodology-grid">
                        <div class="methodology-card" data-type="quick" onclick="EnhancedBugBounty.selectMethodology('quick')">
                            <h4 style="color: #00ff9f; margin-bottom: 10px;">⚡ Quick Assessment</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Fast reconnaissance and basic vulnerability scanning</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Subdomain enumeration</div>
                                <div>• Live host detection</div>
                                <div>• Basic port scanning</div>
                                <div>• Security headers check</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 30-60 minutes</div>
                        </div>
                        
                        <div class="methodology-card" data-type="standard" onclick="EnhancedBugBounty.selectMethodology('standard')">
                            <h4 style="color: #9a4dff; margin-bottom: 10px;">🔍 Standard Assessment</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Comprehensive reconnaissance with vulnerability testing</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Full reconnaissance</div>
                                <div>• Technology detection</div>
                                <div>• API discovery</div>
                                <div>• OWASP Top 10 testing</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 2-4 hours</div>
                        </div>
                        
                        <div class="methodology-card selected" data-type="comprehensive" onclick="EnhancedBugBounty.selectMethodology('comprehensive')">
                            <h4 style="color: #ff6b6b; margin-bottom: 10px;">🎯 Comprehensive Assessment</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Full bug bounty methodology with exploitation</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Complete reconnaissance</div>
                                <div>• Systematic exploitation</div>
                                <div>• Business logic testing</div>
                                <div>• Attack chain generation</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 4-8 hours</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end; margin-top: 20px;">
                        <div class="form-group">
                            <label for="assessment-target">Target Domain</label>
                            <select id="assessment-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-assessment-btn">🚀 Start Assessment</button>
                    </div>
                </form>
            </div>

            <!-- Active Assessments -->
            <div class="card">
                <div class="card-title">
                    Active Bug Bounty Assessments
                    <span id="assessment-auto-refresh-indicator" style="float: right; font-size: 12px; color: #9a4dff;">🔄 Auto-updating</span>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="EnhancedBugBounty.loadAssessments()" class="btn btn-secondary">🔄 Refresh</button>
                    <button onclick="EnhancedBugBounty.toggleAutoRefresh()" class="btn btn-secondary" id="assessment-auto-refresh-toggle">⏸️ Pause Auto-refresh</button>
                    <span id="assessment-status" style="color: #9a4dff; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="assessment-last-update" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <div id="assessments-list">
                    <p style="text-align: center; color: #9a4dff; padding: 20px;">Loading assessments...</p>
                </div>
            </div>

            <!-- Assessment Results Modal (for completed assessments) -->
            <div id="results-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 1200px; height: 90%; background: linear-gradient(135deg, #1a0a2e, #2d1b69); border: 2px solid #9a4dff; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 20px; border-bottom: 1px solid #9a4dff; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="color: #00ff9f;">Assessment Results</h3>
                        <button onclick="EnhancedBugBounty.closeResultsModal()" class="btn btn-secondary">✕ Close</button>
                    </div>
                    <div id="results-content" style="padding: 20px; height: calc(100% - 80px); overflow-y: auto;">
                        <!-- Results will be loaded here -->
                    </div>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Assessment form submission
        const assessmentForm = document.getElementById('assessment-form');
        if (assessmentForm) {
            assessmentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startAssessment();
            });
        }

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('results-modal');
            if (e.target === modal) {
                this.closeResultsModal();
            }
        });
    },

    selectMethodology(type) {
        // Update selected methodology
        document.querySelectorAll('.methodology-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
        this.selectedMethodology = type;
    },

    async loadTargets() {
        try {
            const response = await API.targets.getAll();
            if (!response) return;
            
            const data = await response.json();
            const targets = data.success ? data.data : [];
            
            this.targetsCache = {};
            targets.forEach(target => {
                this.targetsCache[target.id] = target;
            });
            
            const targetSelect = document.getElementById('assessment-target');
            if (targetSelect) {
                targetSelect.innerHTML = '<option value="">Select target...</option>';
                targets.forEach(target => {
                    const option = document.createElement('option');
                    option.value = target.id;
                    option.textContent = target.domain;
                    targetSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load targets:', error);
        }
    },

    async startAssessment() {
        const targetId = document.getElementById('assessment-target').value;
        const methodology = this.selectedMethodology || 'comprehensive';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'assessment-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-assessment-btn', true);
            
            const response = await fetch(`${CONFIG.API_BASE}/enhanced-bugbounty/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetId: parseInt(targetId),
                    assessmentType: methodology,
                    customConfig: {}
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    Utils.showMessage(`${methodology.charAt(0).toUpperCase() + methodology.slice(1)} assessment started successfully!`, 'success', 'assessment-messages');
                    
                    // Reset form
                    document.getElementById('assessment-target').value = '';
                    
                    // Refresh assessments
                    await this.loadAssessments();
                    this.startRealTimeUpdates();
                } else {
                    throw new Error(data.message || 'Unknown error');
                }
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start assessment');
            }
        } catch (error) {
            Utils.showMessage('Failed to start assessment: ' + error.message, 'error', 'assessment-messages');
        } finally {
            Utils.setButtonLoading('start-assessment-btn', false);
        }
    },

    async loadAssessments() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/enhanced-bugbounty/assessments`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response && response.ok) {
                const data = await response.json();
                const assessments = data.success ? data.data : [];
                
                this.renderAssessments(assessments);
                this.updateAssessmentStatus(assessments);
            }
        } catch (error) {
            console.error('Failed to load assessments:', error);
            document.getElementById('assessments-list').innerHTML = 
                '<p style="text-align: center; color: #ff0000; padding: 20px;">Failed to load assessments</p>';
        }
    },

    renderAssessments(assessments) {
        const container = document.getElementById('assessments-list');
        
        if (assessments.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #9a4dff; padding: 20px;">No assessments yet. Start your first comprehensive assessment above!</p>';
            return;
        }
        
        container.innerHTML = assessments.map(assessment => {
            const target = this.targetsCache[assessment.target_id];
            const targetName = target ? target.domain : `Target ${assessment.target_id}`;
            const isRunning = assessment.status === 'running' || assessment.status === 'pending';
            
            return `
                <div class="assessment-card ${isRunning ? 'running' : ''}">
                    <div style="display: flex; justify-content: between; align-items: flex-start; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <h4 style="color: #00ff9f; margin-bottom: 5px;">${targetName}</h4>
                            <div style="font-size: 12px; color: #9a4dff;">
                                Assessment ID: ${assessment.id} | Type: ${assessment.assessment_type || 'comprehensive'}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                Started: ${new Date(assessment.started_at || assessment.created_at).toLocaleString()}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="status status-${assessment.status}">${assessment.status.toUpperCase()}</span>
                            <div style="margin-top: 5px;">
                                ${assessment.status === 'completed' ? 
                                    `<button onclick="EnhancedBugBounty.viewResults(${assessment.id})" class="btn btn-primary btn-small">📊 View Results</button>` :
                                    assessment.status === 'running' ?
                                    `<button onclick="EnhancedBugBounty.stopAssessment(${assessment.id})" class="btn btn-danger btn-small">⏹️ Stop</button>` :
                                    ''
                                }
                            </div>
                        </div>
                    </div>
                    
                    ${this.renderAssessmentProgress(assessment)}
                    
                    ${assessment.status === 'completed' && assessment.results ? 
                        this.renderAssessmentSummary(assessment.results) : ''
                    }
                </div>
            `;
        }).join('');
    },

    renderAssessmentProgress(assessment) {
        const phases = [
            { key: 'reconnaissance', name: 'Recon', icon: '🔍' },
            { key: 'attack_surface', name: 'Attack Surface', icon: '🎯' },
            { key: 'vulnerability_assessment', name: 'Vuln Assessment', icon: '⚠️' },
            { key: 'exploitation', name: 'Exploitation', icon: '💥' }
        ];
        
        const progress = assessment.progress_percentage || 0;
        const currentPhase = assessment.current_phase || 'reconnaissance';
        
        return `
            <div class="workflow-progress">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <span style="font-weight: bold; color: #00ff9f;">Progress: ${progress}%</span>
                    <span style="font-size: 12px; color: #9a4dff;">${assessment.estimated_completion ? 
                        'ETA: ' + new Date(assessment.estimated_completion).toLocaleTimeString() : ''}</span>
                </div>
                
                <div style="background-color: #2d1b69; height: 8px; border-radius: 4px; margin-bottom: 15px;">
                    <div style="background: linear-gradient(90deg, #9a4dff, #00ff9f); height: 100%; width: ${progress}%; border-radius: 4px; transition: width 0.5s ease;"></div>
                </div>
                
                <div class="phase-timeline">
                    ${phases.map(phase => {
                        let status = 'pending';
                        if (assessment.completed_phases && assessment.completed_phases.includes(phase.key)) {
                            status = 'completed';
                        } else if (currentPhase === phase.key) {
                            status = 'active';
                        }
                        
                        return `
                            <div class="phase-item">
                                <div class="phase-circle ${status}">${phase.icon}</div>
                                <div class="phase-label" style="color: ${status === 'completed' ? '#00ff9f' : status === 'active' ? '#9a4dff' : '#666'};">
                                    ${phase.name}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                ${assessment.phase_details ? `
                    <div style="margin-top: 15px; font-size: 12px; color: #9a4dff;">
                        Current: ${assessment.phase_details.current_phase_name || 'Processing...'}
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderAssessmentSummary(results) {
        const summary = typeof results === 'string' ? JSON.parse(results) : results;
        
        const vulnCount = summary.consolidated_findings?.vulnerabilities?.length || 0;
        const criticalCount = summary.consolidated_findings?.vulnerabilities?.filter(v => v.severity === 'critical').length || 0;
        const highValueTargets = summary.high_value_targets?.length || 0;
        const attackChains = summary.attack_chains?.length || 0;
        
        return `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #9a4dff;">
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; text-align: center;">
                    <div>
                        <div style="font-size: 18px; font-weight: bold; color: ${vulnCount > 0 ? '#ff6b6b' : '#00ff9f'};">${vulnCount}</div>
                        <div style="font-size: 11px; color: #9a4dff;">Vulnerabilities</div>
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: bold; color: ${criticalCount > 0 ? '#ff0000' : '#00ff9f'};">${criticalCount}</div>
                        <div style="font-size: 11px; color: #9a4dff;">Critical Issues</div>
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: bold; color: #ffff00;">${highValueTargets}</div>
                        <div style="font-size: 11px; color: #9a4dff;">High-Value Targets</div>
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: bold; color: #ff6b6b;">${attackChains}</div>
                        <div style="font-size: 11px; color: #9a4dff;">Attack Chains</div>
                    </div>
                </div>
            </div>
        `;
    },

    async viewResults(assessmentId) {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/enhanced-bugbounty/results/${assessmentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.showResultsModal(data.data);
                }
            }
        } catch (error) {
            console.error('Failed to load results:', error);
            Utils.showMessage('Failed to load assessment results', 'error');
        }
    },

    showResultsModal(results) {
        const modal = document.getElementById('results-modal');
        const content = document.getElementById('results-content');
        
        content.innerHTML = this.renderDetailedResults(results);
        modal.style.display = 'block';
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    },

    closeResultsModal() {
        const modal = document.getElementById('results-modal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    },

    renderDetailedResults(results) {
        const data = results.workflow_results || results;
        
        return `
            <div class="results-tabs">
                <div class="results-tab active" onclick="EnhancedBugBounty.switchResultsTab('summary')">📊 Summary</div>
                <div class="results-tab" onclick="EnhancedBugBounty.switchResultsTab('vulnerabilities')">⚠️ Vulnerabilities</div>
                <div class="results-tab" onclick="EnhancedBugBounty.switchResultsTab('attack-surface')">🎯 Attack Surface</div>
                <div class="results-tab" onclick="EnhancedBugBounty.switchResultsTab('recommendations')">💡 Recommendations</div>
            </div>
            
            <div id="results-tab-summary" class="results-tab-content">
                ${this.renderResultsSummary(data)}
            </div>
            
            <div id="results-tab-vulnerabilities" class="results-tab-content" style="display: none;">
                ${this.renderVulnerabilitiesTab(data)}
            </div>
            
            <div id="results-tab-attack-surface" class="results-tab-content" style="display: none;">
                ${this.renderAttackSurfaceTab(data)}
            </div>
            
            <div id="results-tab-recommendations" class="results-tab-content" style="display: none;">
                ${this.renderRecommendationsTab(data)}
            </div>
        `;
    },

    renderResultsSummary(data) {
        const vulns = data.consolidated_findings?.vulnerabilities || [];
        const highValueTargets = data.high_value_targets || [];
        const attackChains = data.attack_chains || [];
        
        return `
            <div class="scrollable-results">
                <h4 style="color: #00ff9f; margin-bottom: 15px;">Assessment Summary</h4>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #ff6b6b;">${vulns.length}</div>
                        <div style="color: #9a4dff;">Total Vulnerabilities</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #ff0000;">${vulns.filter(v => v.severity === 'critical').length}</div>
                        <div style="color: #9a4dff;">Critical Issues</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #ffff00;">${highValueTargets.length}</div>
                        <div style="color: #9a4dff;">High-Value Targets</div>
                    </div>
                    <div style="text-align: center; padding: 15px; border: 1px solid #9a4dff; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #ff6b6b;">${attackChains.length}</div>
                        <div style="color: #9a4dff;">Attack Chains</div>
                    </div>
                </div>
                
                ${attackChains.length > 0 ? `
                    <h5 style="color: #ff6b6b; margin: 20px 0 10px 0;">🔗 Identified Attack Chains</h5>
                    ${attackChains.map(chain => `
                        <div class="attack-chain">
                            <div style="font-weight: bold; color: #ff6b6b; margin-bottom: 8px;">${chain.name}</div>
                            <div style="font-size: 12px; color: #9a4dff; margin-bottom: 5px;">
                                Entry Point: ${chain.entry_point} | Severity: ${chain.severity} | Likelihood: ${chain.likelihood}
                            </div>
                            <div style="font-size: 13px;">Impact: ${chain.impact}</div>
                            <div style="margin-top: 8px;">
                                <strong>Steps:</strong>
                                <ol style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
                                    ${chain.steps.map(step => `<li>${step}</li>`).join('')}
                                </ol>
                            </div>
                        </div>
                    `).join('')}
                ` : ''}
                
                ${data.final_recommendations?.immediate_actions?.length > 0 ? `
                    <h5 style="color: #00ff9f; margin: 20px 0 10px 0;">⚡ Immediate Actions Required</h5>
                    <ul style="margin: 0; padding-left: 20px;">
                        ${data.final_recommendations.immediate_actions.map(action => `<li style="margin-bottom: 5px;">${action}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    },

    renderVulnerabilitiesTab(data) {
        const vulns = data.consolidated_findings?.vulnerabilities || [];
        
        if (vulns.length === 0) {
            return '<div class="scrollable-results"><p style="text-align: center; color: #00ff9f; padding: 40px;">🎉 No vulnerabilities found!</p></div>';
        }
        
        return `
            <div class="scrollable-results">
                <h4 style="color: #ff6b6b; margin-bottom: 15px;">Vulnerabilities Found (${vulns.length})</h4>
                
                ${vulns.map(vuln => `
                    <div style="border: 1px solid #9a4dff; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                            <h5 style="color: #00ff9f; margin: 0;">${vuln.title || vuln.type}</h5>
                            <span class="finding-severity-${vuln.severity}" style="padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white;">
                                ${vuln.severity?.toUpperCase()}
                            </span>
                        </div>
                        
                        <div style="font-size: 12px; color: #9a4dff; margin-bottom: 8px;">
                            ${vuln.endpoint || vuln.url || 'N/A'} ${vuln.method ? `(${vuln.method})` : ''}
                        </div>
                        
                        <div style="font-size: 13px; margin-bottom: 10px;">${vuln.description || 'No description available'}</div>
                        
                        ${vuln.proof_of_concept || vuln.evidence ? `
                            <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 11px; margin-top: 8px;">
                                ${vuln.proof_of_concept || vuln.evidence}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderAttackSurfaceTab(data) {
        const surface = data.consolidated_findings || {};
        
        return `
            <div class="scrollable-results">
                <h4 style="color: #9a4dff; margin-bottom: 15px;">Attack Surface Analysis</h4>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                    <div style="text-align: center; padding: 10px; border: 1px solid #9a4dff; border-radius: 4px;">
                        <div style="font-size: 18px; font-weight: bold; color: #00ff9f;">${surface.live_hosts?.length || 0}</div>
                        <div style="font-size: 11px; color: #9a4dff;">Live Hosts</div>
                    </div>
                    <div style="text-align: center; padding: 10px; border: 1px solid #9a4dff; border-radius: 4px;">
                        <div style="font-size: 18px; font-weight: bold; color: #ffff00;">${surface.open_ports?.length || 0}</div>
                        <div style="font-size: 11px; color: #9a4dff;">Open Ports</div>
                    </div>
                    <div style="text-align: center; padding: 10px; border: 1px solid #9a4dff; border-radius: 4px;">
                        <div style="font-size: 18px; font-weight: bold; color: #ff6b6b;">${surface.apis?.length || 0}</div>
                        <div style="font-size: 11px; color: #9a4dff;">API Endpoints</div>
                    </div>
                    <div style="text-align: center; padding: 10px; border: 1px solid #9a4dff; border-radius: 4px;">
                        <div style="font-size: 18px; font-weight: bold; color: #9a4dff;">${surface.discovered_content?.length || 0}</div>
                        <div style="font-size: 11px; color: #9a4dff;">Content Items</div>
                    </div>
                </div>
                
                ${data.high_value_targets?.length > 0 ? `
                    <h5 style="color: #ffff00; margin: 20px 0 10px 0;">🎯 High-Value Targets</h5>
                    ${data.high_value_targets.map(target => `
                        <div style="border: 1px solid #ffff00; border-radius: 4px; padding: 10px; margin-bottom: 8px;">
                            <div style="font-weight: bold; color: #ffff00;">${target.reason}</div>
                            <div style="font-size: 12px; color: #9a4dff; margin-top: 4px;">
                                Priority: ${target.priority} | Action: ${target.recommended_action}
                            </div>
                        </div>
                    `).join('')}
                ` : ''}
            </div>
        `;
    },

    renderRecommendationsTab(data) {
        const recommendations = data.final_recommendations || {};
        
        return `
            <div class="scrollable-results">
                <h4 style="color: #00ff9f; margin-bottom: 15px;">Security Recommendations</h4>
                
                ${recommendations.immediate_actions?.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h5 style="color: #ff0000;">🚨 Immediate Actions (Critical)</h5>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            ${recommendations.immediate_actions.map(action => `<li style="margin-bottom: 5px; color: #ff6b6b;">${action}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${recommendations.short_term_improvements?.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h5 style="color: #ffff00;">⚡ Short-term Improvements</h5>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            ${recommendations.short_term_improvements.map(action => `<li style="margin-bottom: 5px;">${action}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${recommendations.long_term_strategy?.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h5 style="color: #00ff9f;">🎯 Long-term Strategy</h5>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            ${recommendations.long_term_strategy.map(action => `<li style="margin-bottom: 5px;">${action}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${recommendations.priority_vulnerabilities?.length > 0 ? `
                    <div>
                        <h5 style="color: #9a4dff;">🎯 Priority Vulnerability Fixes</h5>
                        ${recommendations.priority_vulnerabilities.slice(0, 5).map(vuln => `
                            <div style="border: 1px solid #9a4dff; border-radius: 4px; padding: 8px; margin-bottom: 5px;">
                                <span class="finding-severity-${vuln.severity}" style="padding: 1px 4px; border-radius: 2px; font-size: 10px; margin-right: 8px;">
                                    ${vuln.severity?.toUpperCase()}
                                </span>
                                ${vuln.title || vuln.type}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    switchResultsTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.results-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.results-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`results-tab-${tabName}`).style.display = 'block';
    },

    async stopAssessment(assessmentId) {
        if (confirm('Are you sure you want to stop this assessment?')) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/enhanced-bugbounty/stop/${assessmentId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response && response.ok) {
                    Utils.showMessage('Assessment stopped successfully!', 'success');
                    await this.loadAssessments();
                }
            } catch (error) {
                Utils.showMessage('Failed to stop assessment: ' + error.message, 'error');
            }
        }
    },

    // Real-time updates
    startRealTimeUpdates() {
        console.log('🔄 Starting real-time updates for enhanced bug bounty assessments');
        
        this.cleanup();
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'enhanced-bugbounty') {
                try {
                    await this.loadAssessments();
                    this.updateLastUpdateTime();
                } catch (error) {
                    console.error('Real-time assessment update failed:', error);
                }
            }
        }, 5000); // Update every 5 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    updateAssessmentStatus(assessments) {
        const statusSpan = document.getElementById('assessment-status');
        if (!statusSpan) return;
        
        const runningAssessments = assessments.filter(a => a.status === 'running' || a.status === 'pending');
        
        if (runningAssessments.length > 0) {
            statusSpan.innerHTML = `🔄 ${runningAssessments.length} assessment${runningAssessments.length > 1 ? 's' : ''} running`;
            statusSpan.style.color = '#00ff9f';
        } else {
            const completedCount = assessments.filter(a => a.status === 'completed').length;
            statusSpan.innerHTML = `✅ ${completedCount} assessment${completedCount !== 1 ? 's' : ''} completed`;
            statusSpan.style.color = '#9a4dff';
        }
    },

    updateLastUpdateTime() {
        const element = document.getElementById('assessment-last-update');
        if (element) {
            element.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('assessment-auto-refresh-indicator');
        if (indicator) {
            if (isActive) {
                indicator.innerHTML = '🔄 Auto-updating';
                indicator.style.color = '#9a4dff';
            } else {
                indicator.innerHTML = '⏸️ Paused';
                indicator.style.color = '#ffff00';
            }
        }
    },

    toggleAutoRefresh() {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        const toggleBtn = document.getElementById('assessment-auto-refresh-toggle');
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

    cleanup() {
        console.log('🧹 Cleaning up Enhanced Bug Bounty module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
    }
};

// Make it globally available
window.EnhancedBugBounty = EnhancedBugBounty;
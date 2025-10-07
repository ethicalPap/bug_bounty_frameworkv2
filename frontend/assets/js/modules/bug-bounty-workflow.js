// frontend/assets/js/modules/bug-bounty-workflow.js - Comprehensive Bug Bounty Workflow Frontend

const BugBountyWorkflow = {
    refreshInterval: null,
    isAutoRefreshEnabled: true,
    lastUpdate: null,
    targetsCache: {},
    activeAssessment: null,

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
                .workflow-phase-card {
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border: 1px solid #ffff00;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 0;
                    position: relative;
                }
                
                .phase-completed {
                    border-color: #00ff00;
                    background: linear-gradient(135deg, rgba(0, 255, 0, 0.1), rgba(0, 255, 0, 0.05));
                }
                
                .phase-running {
                    border-color: #ffff00;
                    background: linear-gradient(135deg, rgba(255, 255, 0, 0.1), rgba(255, 255, 0, 0.05));
                    animation: phaseRunning 2s infinite;
                }
                
                .phase-pending {
                    border-color: #666;
                    opacity: 0.6;
                }
                
                @keyframes phaseRunning {
                    0%, 100% { box-shadow: 0 0 10px rgba(255, 255, 0, 0.3); }
                    50% { box-shadow: 0 0 20px rgba(255, 255, 0, 0.6); }
                }
                
                .assessment-type-card {
                    background: rgba(45, 27, 105, 0.3);
                    border: 1px solid #ffff00;
                    border-radius: 8px;
                    padding: 15px;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin: 10px 0;
                }
                
                .assessment-type-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(255, 255, 0, 0.3);
                }
                
                .assessment-type-card.selected {
                    border-color: #00ff00;
                    background: rgba(0, 255, 0, 0.1);
                }
                
                .finding-card {
                    background: rgba(45, 27, 105, 0.2);
                    border: 1px solid #9a4dff;
                    border-radius: 6px;
                    padding: 12px;
                    margin: 8px 0;
                }
                
                .finding-critical {
                    border-color: #ff0000;
                    background: rgba(255, 0, 0, 0.1);
                }
                
                .finding-high {
                    border-color: #ffa500;
                    background: rgba(255, 165, 0, 0.1);
                }
                
                .finding-medium {
                    border-color: #ffff00;
                    background: rgba(255, 255, 0, 0.1);
                }
                
                .attack-chain {
                    background: linear-gradient(135deg, #2d1b69, #1a0a2e);
                    border: 1px solid #ff6b6b;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 10px 0;
                }
                
                .high-value-target {
                    background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.05));
                    border: 1px solid #ffd700;
                    border-radius: 6px;
                    padding: 10px;
                    margin: 8px 0;
                }
                
                .recommendation-card {
                    background: rgba(0, 255, 159, 0.1);
                    border: 1px solid #00ff9f;
                    border-radius: 6px;
                    padding: 12px;
                    margin: 8px 0;
                }
                
                .progress-timeline {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .timeline-step {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    position: relative;
                }
                
                .timeline-step::after {
                    content: '';
                    position: absolute;
                    left: 15px;
                    top: 30px;
                    height: 30px;
                    width: 2px;
                    background: #666;
                }
                
                .timeline-step:last-child::after {
                    display: none;
                }
                
                .timeline-icon {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    flex-shrink: 0;
                }
                
                .timeline-completed {
                    background: #00ff00;
                    color: #000;
                }
                
                .timeline-running {
                    background: #ffff00;
                    color: #000;
                    animation: pulse 1s infinite;
                }
                
                .timeline-pending {
                    background: #666;
                    color: #fff;
                }
                
                .workflow-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 15px;
                    margin: 20px 0;
                }
                
                .workflow-stat {
                    text-align: center;
                    padding: 15px;
                    border: 1px solid #ffff00;
                    border-radius: 8px;
                    background: rgba(255, 255, 0, 0.05);
                }
                
                .export-btn-workflow {
                    background: linear-gradient(135deg, #9a4dff, #6b46c1);
                    border: 1px solid #9a4dff;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .export-btn-workflow:hover {
                    background: linear-gradient(135deg, #6b46c1, #9a4dff);
                    transform: translateY(-1px);
                }
            </style>

            <div class="scan-info">
                <h4>🎯 Comprehensive Bug Bounty Workflow</h4>
                <p>Execute a complete bug bounty assessment workflow including reconnaissance, attack surface analysis, vulnerability assessment, and systematic exploitation. Generates high-value targets, attack chains, and actionable recommendations.</p>
            </div>

            <!-- Assessment Controls -->
            <div class="card">
                <div class="card-title">Start Comprehensive Bug Bounty Assessment</div>
                <div id="workflow-messages"></div>
                
                <form id="workflow-form">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div class="assessment-type-card selected" data-type="full" onclick="BugBountyWorkflow.selectAssessmentType('full')">
                            <h4 style="color: #ff6b6b; margin-bottom: 10px;">🎯 Full Assessment</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Complete 4-phase bug bounty workflow</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Reconnaissance & OSINT</div>
                                <div>• Attack Surface Analysis</div>
                                <div>• Vulnerability Assessment</div>
                                <div>• Systematic Exploitation</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 4-8 hours</div>
                        </div>
                        
                        <div class="assessment-type-card" data-type="standard" onclick="BugBountyWorkflow.selectAssessmentType('standard')">
                            <h4 style="color: #00ff9f; margin-bottom: 10px;">⚡ Standard Assessment</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Core vulnerability assessment</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Basic reconnaissance</div>
                                <div>• Attack surface mapping</div>
                                <div>• Vulnerability scanning</div>
                                <div>• Basic exploitation</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 2-4 hours</div>
                        </div>
                        
                        <div class="assessment-type-card" data-type="quick" onclick="BugBountyWorkflow.selectAssessmentType('quick')">
                            <h4 style="color: #00bfff; margin-bottom: 10px;">🚀 Quick Assessment</h4>
                            <p style="font-size: 13px; margin-bottom: 8px;">Fast vulnerability discovery</p>
                            <div style="font-size: 11px; color: #9a4dff;">
                                <div>• Quick reconnaissance</div>
                                <div>• Common vulnerabilities</div>
                                <div>• Basic reporting</div>
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; color: #ffff00;">Estimated: 30-60 minutes</div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end; margin-top: 20px;">
                        <div class="form-group">
                            <label for="workflow-target">Target Domain</label>
                            <select id="workflow-target" required>
                                <option value="">Select target...</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary" id="start-workflow-btn">🎯 Start Assessment</button>
                    </div>
                </form>
            </div>

            <!-- Active Assessments -->
            <div class="card">
                <div class="card-title">
                    Bug Bounty Assessments
                    <span id="workflow-auto-refresh-indicator" style="float: right; font-size: 12px; color: #ffff00;">🔄 Auto-updating</span>
                </div>
                
                <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <button onclick="BugBountyWorkflow.loadAssessments()" class="btn btn-secondary">🔄 Refresh</button>
                    <button onclick="BugBountyWorkflow.toggleAutoRefresh()" class="btn btn-secondary" id="workflow-auto-refresh-toggle">⏸️ Pause Auto-refresh</button>
                    <span id="workflow-status" style="color: #ffff00; font-size: 13px; font-family: 'Courier New', monospace;"></span>
                    <span id="workflow-last-update" style="color: #666; font-size: 11px; margin-left: auto;"></span>
                </div>
                
                <div id="assessments-list">
                    <p style="text-align: center; color: #ffff00; padding: 20px;">Loading bug bounty assessments...</p>
                </div>
            </div>

            <!-- Assessment Results Dashboard -->
            <div class="card" id="assessment-dashboard" style="display: none;">
                <div class="card-title">🎯 Assessment Results Dashboard</div>
                
                <div class="workflow-stats">
                    <div class="workflow-stat">
                        <div style="font-size: 20px; font-weight: bold; color: #ffff00;" id="total-phases">0</div>
                        <div style="color: #ffff00; font-size: 11px;">Phases Completed</div>
                    </div>
                    <div class="workflow-stat">
                        <div style="font-size: 20px; font-weight: bold; color: #ffd700;" id="high-value-targets">0</div>
                        <div style="color: #ffff00; font-size: 11px;">High-Value Targets</div>
                    </div>
                    <div class="workflow-stat">
                        <div style="font-size: 20px; font-weight: bold; color: #ff6b6b;" id="attack-chains">0</div>
                        <div style="color: #ffff00; font-size: 11px;">Attack Chains</div>
                    </div>
                    <div class="workflow-stat">
                        <div style="font-size: 20px; font-weight: bold; color: #ff4444;" id="critical-findings">0</div>
                        <div style="color: #ffff00; font-size: 11px;">Critical Findings</div>
                    </div>
                    <div class="workflow-stat">
                        <div style="font-size: 20px; font-weight: bold; color: #ffa500;" id="total-vulnerabilities">0</div>
                        <div style="color: #ffff00; font-size: 11px;">Total Vulnerabilities</div>
                    </div>
                    <div class="workflow-stat">
                        <div style="font-size: 20px; font-weight: bold; color: #00ff9f;" id="recommendations">0</div>
                        <div style="color: #ffff00; font-size: 11px;">Recommendations</div>
                    </div>
                </div>
                
                <div id="assessment-results-content">
                    <!-- Assessment results content will be rendered here -->
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Workflow form submission
        const workflowForm = document.getElementById('workflow-form');
        if (workflowForm) {
            workflowForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.startAssessment();
            });
        }
    },

    selectAssessmentType(type) {
        // Update selected assessment type
        document.querySelectorAll('.assessment-type-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
        this.selectedAssessmentType = type;
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
            
            const targetSelect = document.getElementById('workflow-target');
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
        const targetId = document.getElementById('workflow-target').value;
        const assessmentType = this.selectedAssessmentType || 'full';
        
        if (!targetId) {
            Utils.showMessage('Please select a target', 'error', 'workflow-messages');
            return;
        }
        
        try {
            Utils.setButtonLoading('start-workflow-btn', true);
            
            const customConfig = {
                assessment_type: assessmentType,
                include_exploitation: assessmentType === 'full',
                deep_reconnaissance: assessmentType === 'full',
                advanced_techniques: assessmentType !== 'quick'
            };
            
            const response = await API.call('/enhanced-bug-bounty/start-comprehensive-assessment', {
                method: 'POST',
                body: JSON.stringify({
                    targetId: parseInt(targetId),
                    assessmentType: assessmentType,
                    customConfig: customConfig
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    Utils.showMessage(`${assessmentType.charAt(0).toUpperCase() + assessmentType.slice(1)} bug bounty assessment started successfully!`, 'success', 'workflow-messages');
                    
                    // Track the active assessment
                    this.activeAssessment = data.data.assessment_id;
                    
                    // Reset form
                    document.getElementById('workflow-target').value = '';
                    
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
            Utils.showMessage('Failed to start assessment: ' + error.message, 'error', 'workflow-messages');
        } finally {
            Utils.setButtonLoading('start-workflow-btn', false);
        }
    },

    async loadAssessments() {
        try {
            const response = await API.call('/enhanced-bug-bounty/assessments');
            
            if (response && response.ok) {
                const data = await response.json();
                const assessments = data.success ? data.data : [];
                
                this.renderAssessments(assessments);
                this.updateWorkflowStatus(assessments);
                
                // Show latest completed assessment results
                const latestCompleted = assessments.find(assessment => assessment.status === 'completed');
                if (latestCompleted) {
                    await this.loadLatestAssessmentResults(latestCompleted);
                }
            }
        } catch (error) {
            console.error('Failed to load assessments:', error);
            document.getElementById('assessments-list').innerHTML = 
                '<p style="text-align: center; color: #ff0000; padding: 20px;">Failed to load bug bounty assessments</p>';
        }
    },

    renderAssessments(assessments) {
        const container = document.getElementById('assessments-list');
        
        if (assessments.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #ffff00; padding: 20px;">No bug bounty assessments yet. Start your first assessment above!</p>';
            return;
        }
        
        container.innerHTML = assessments.map(assessment => {
            const target = this.targetsCache[assessment.target_id];
            const targetName = target ? target.domain : `Target ${assessment.target_id}`;
            const isRunning = assessment.status === 'running' || assessment.status === 'pending';
            
            return `
                <div class="workflow-phase-card ${isRunning ? 'phase-running' : assessment.status === 'completed' ? 'phase-completed' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div style="flex: 1;">
                            <h4 style="color: #ffff00; margin-bottom: 5px;">🎯 ${targetName}</h4>
                            <div style="font-size: 12px; color: #9a4dff;">
                                Assessment ID: ${assessment.id} | Type: ${assessment.assessment_type || 'full'}
                            </div>
                            <div style="font-size: 11px; color: #666; margin-top: 2px;">
                                Started: ${new Date(assessment.started_at || assessment.created_at).toLocaleString()}
                            </div>
                            ${assessment.estimated_completion ? 
                                `<div style="font-size: 11px; color: #ffa500; margin-top: 2px;">
                                    ETA: ${new Date(assessment.estimated_completion).toLocaleTimeString()}
                                </div>` : ''
                            }
                        </div>
                        <div style="text-align: right;">
                            <span class="status status-${assessment.status}">${assessment.status.toUpperCase()}</span>
                            <div style="margin-top: 5px;">
                                ${assessment.status === 'completed' ? 
                                    `<div style="display: flex; gap: 8px;">
                                        <button onclick="BugBountyWorkflow.viewAssessmentResults(${assessment.id})" class="btn btn-primary btn-small">🎯 View Results</button>
                                        <button onclick="BugBountyWorkflow.generateReport(${assessment.id})" class="export-btn-workflow">📊 Generate Report</button>
                                    </div>` :
                                    assessment.status === 'running' ?
                                    `<button onclick="BugBountyWorkflow.stopAssessment(${assessment.id})" class="btn btn-danger btn-small">⏹️ Stop</button>` :
                                    ''
                                }
                            </div>
                        </div>
                    </div>
                    
                    ${this.renderAssessmentProgress(assessment)}
                    
                    ${assessment.status === 'completed' && assessment.results_summary ? 
                        this.renderAssessmentSummary(assessment.results_summary) : ''
                    }
                </div>
            `;
        }).join('');
    },

    renderAssessmentProgress(assessment) {
        const progress = assessment.progress_percentage || 0;
        
        if (assessment.status !== 'running' && assessment.status !== 'pending') {
            return '';
        }
        
        const phases = ['reconnaissance', 'attack_surface', 'vulnerability_assessment', 'exploitation'];
        const currentPhaseIndex = Math.floor((progress / 100) * phases.length);
        const currentPhase = phases[currentPhaseIndex] || 'starting';
        
        return `
            <div style="margin: 15px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 12px; color: #ffff00;">Progress: ${progress}%</span>
                    <span style="font-size: 11px; color: #666;">${assessment.current_phase || currentPhase.replace('_', ' ')}</span>
                </div>
                
                <div style="background-color: #2d1b69; height: 8px; border-radius: 4px; margin-bottom: 15px;">
                    <div style="background: linear-gradient(90deg, #ffff00, #ffd700); height: 100%; width: ${progress}%; border-radius: 4px; transition: width 0.5s ease;"></div>
                </div>
                
                <!-- Phase Timeline -->
                <div class="progress-timeline">
                    ${phases.map((phase, index) => {
                        let status = 'pending';
                        if (index < currentPhaseIndex) status = 'completed';
                        else if (index === currentPhaseIndex) status = 'running';
                        
                        return `
                            <div class="timeline-step">
                                <div class="timeline-icon timeline-${status}">
                                    ${status === 'completed' ? '✓' : status === 'running' ? '⚡' : index + 1}
                                </div>
                                <div style="flex: 1;">
                                    <div style="color: ${status === 'completed' ? '#00ff00' : status === 'running' ? '#ffff00' : '#666'}; font-weight: bold; font-size: 12px;">
                                        ${phase.replace('_', ' ').toUpperCase()}
                                    </div>
                                    <div style="color: #666; font-size: 10px;">
                                        ${this.getPhaseDescription(phase)}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    getPhaseDescription(phase) {
        const descriptions = {
            reconnaissance: 'Subdomain discovery, technology detection, OSINT',
            attack_surface: 'Port scanning, API discovery, content enumeration',
            vulnerability_assessment: 'Security testing, authentication analysis',
            exploitation: 'Systematic exploitation, attack chain generation'
        };
        return descriptions[phase] || 'Assessment phase';
    },

    renderAssessmentSummary(summary) {
        const data = typeof summary === 'string' ? JSON.parse(summary) : summary;
        
        return `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ffff00;">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 10px;">
                    <div style="text-align: center; padding: 8px; border: 1px solid #ffd700; border-radius: 4px;">
                        <div style="font-size: 16px; font-weight: bold; color: #ffd700;">${data.high_value_targets || 0}</div>
                        <div style="font-size: 10px; color: #ffff00;">High-Value</div>
                    </div>
                    <div style="text-align: center; padding: 8px; border: 1px solid #ff6b6b; border-radius: 4px;">
                        <div style="font-size: 16px; font-weight: bold; color: #ff6b6b;">${data.attack_chains || 0}</div>
                        <div style="font-size: 10px; color: #ffff00;">Attack Chains</div>
                    </div>
                    <div style="text-align: center; padding: 8px; border: 1px solid #ff4444; border-radius: 4px;">
                        <div style="font-size: 16px; font-weight: bold; color: #ff4444;">${data.critical_vulnerabilities || 0}</div>
                        <div style="font-size: 10px; color: #ffff00;">Critical</div>
                    </div>
                    <div style="text-align: center; padding: 8px; border: 1px solid #ffa500; border-radius: 4px;">
                        <div style="font-size: 16px; font-weight: bold; color: #ffa500;">${data.total_vulnerabilities || 0}</div>
                        <div style="font-size: 10px; color: #ffff00;">Total Vulns</div>
                    </div>
                </div>
                
                ${data.critical_vulnerabilities > 0 ? 
                    `<div style="background: rgba(255, 0, 0, 0.2); color: #ff4444; padding: 8px; border-radius: 4px; font-size: 11px; animation: alertPulse 2s infinite;">
                        🚨 ${data.critical_vulnerabilities} critical vulnerabilities require immediate attention!
                    </div>` : 
                    `<div style="color: #00ff9f; font-size: 11px;">✅ Assessment completed successfully</div>`
                }
            </div>
        `;
    },

    async viewAssessmentResults(assessmentId) {
        try {
            const response = await API.call(`/enhanced-bug-bounty/assessment-results/${assessmentId}`);
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.displayAssessmentDashboard(data.data);
                }
            }
        } catch (error) {
            console.error('Failed to load assessment results:', error);
            Utils.showMessage('Failed to load assessment results', 'error');
        }
    },

    async loadLatestAssessmentResults(assessment) {
        if (assessment.results) {
            this.displayAssessmentDashboard(assessment.results);
        }
    },

    displayAssessmentDashboard(assessmentData) {
        const dashboard = document.getElementById('assessment-dashboard');
        const data = typeof assessmentData === 'string' ? JSON.parse(assessmentData) : assessmentData;
        
        // Update metrics
        document.getElementById('total-phases').textContent = Object.keys(data.phases || {}).length;
        document.getElementById('high-value-targets').textContent = data.high_value_targets?.length || 0;
        document.getElementById('attack-chains').textContent = data.attack_chains?.length || 0;
        document.getElementById('critical-findings').textContent = 
            data.consolidated_findings?.vulnerabilities?.filter(v => v.severity === 'critical').length || 0;
        document.getElementById('total-vulnerabilities').textContent = 
            data.consolidated_findings?.vulnerabilities?.length || 0;
        document.getElementById('recommendations').textContent = 
            data.final_recommendations?.immediate_actions?.length || 0;
        
        // Render assessment results content
        const content = document.getElementById('assessment-results-content');
        content.innerHTML = this.renderAssessmentResultsContent(data);
        
        dashboard.style.display = 'block';
    },

    renderAssessmentResultsContent(data) {
        let content = '';
        
        // High-Value Targets
        if (data.high_value_targets && data.high_value_targets.length > 0) {
            content += this.renderHighValueTargets(data.high_value_targets);
        }
        
        // Attack Chains
        if (data.attack_chains && data.attack_chains.length > 0) {
            content += this.renderAttackChains(data.attack_chains);
        }
        
        // Critical Findings
        if (data.consolidated_findings?.vulnerabilities) {
            const criticalFindings = data.consolidated_findings.vulnerabilities.filter(v => v.severity === 'critical');
            if (criticalFindings.length > 0) {
                content += this.renderCriticalFindings(criticalFindings);
            }
        }
        
        // Final Recommendations
        if (data.final_recommendations) {
            content += this.renderFinalRecommendations(data.final_recommendations);
        }
        
        // Phase Results Summary
        if (data.phases) {
            content += this.renderPhaseResults(data.phases);
        }
        
        return content;
    },

    renderHighValueTargets(targets) {
        return `
            <div class="workflow-phase-card">
                <h4 style="color: #ffd700; margin-bottom: 15px;">🎯 High-Value Targets (${targets.length})</h4>
                ${targets.map(target => `
                    <div class="high-value-target">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="color: #ffd700; font-weight: bold;">${target.reason}</span>
                            <span style="color: ${target.priority === 'critical' ? '#ff4444' : target.priority === 'high' ? '#ffa500' : '#ffff00'}; font-size: 11px; font-weight: bold;">
                                ${target.priority.toUpperCase()}
                            </span>
                        </div>
                        <div style="color: #9a4dff; font-size: 11px; margin-bottom: 4px;">
                            📍 ${target.target?.url || target.target?.subdomain || 'Unknown location'}
                        </div>
                        <div style="color: #666; font-size: 10px;">
                            💡 ${target.recommended_action}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderAttackChains(chains) {
        return `
            <div class="workflow-phase-card">
                <h4 style="color: #ff6b6b; margin-bottom: 15px;">⚔️ Attack Chains (${chains.length})</h4>
                ${chains.map(chain => `
                    <div class="attack-chain">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="color: #ff6b6b; font-weight: bold;">${chain.name}</span>
                            <div>
                                <span style="color: ${chain.severity === 'critical' ? '#ff4444' : '#ffa500'}; font-size: 11px; margin-right: 8px;">
                                    ${chain.severity?.toUpperCase() || 'HIGH'}
                                </span>
                                <span style="color: #666; font-size: 10px;">
                                    Likelihood: ${chain.likelihood || 'Medium'}
                                </span>
                            </div>
                        </div>
                        <div style="color: #9a4dff; font-size: 11px; margin-bottom: 8px;">
                            🎯 Entry Point: ${chain.entry_point}
                        </div>
                        <div style="color: #666; font-size: 10px; margin-bottom: 8px;">
                            💥 Impact: ${chain.impact}
                        </div>
                        <div style="margin-top: 8px;">
                            <div style="color: #ffff00; font-size: 11px; margin-bottom: 4px;">Attack Steps:</div>
                            <ol style="margin: 0; padding-left: 16px; font-size: 10px; color: #ccc;">
                                ${chain.steps?.map(step => `<li>${step}</li>`).join('') || '<li>Attack chain details not available</li>'}
                            </ol>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderCriticalFindings(findings) {
        return `
            <div class="workflow-phase-card finding-critical">
                <h4 style="color: #ff4444; margin-bottom: 15px;">🚨 Critical Findings (${findings.length})</h4>
                ${findings.map(finding => `
                    <div class="finding-card finding-critical">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="color: #ff4444; font-weight: bold;">${finding.title || finding.type}</span>
                            <span style="color: #ff4444; font-size: 11px; font-weight: bold;">CRITICAL</span>
                        </div>
                        <div style="color: #9a4dff; font-size: 11px; margin-bottom: 4px;">
                            📍 ${finding.endpoint || finding.url || finding.location || 'Unknown location'}
                        </div>
                        <div style="color: #ccc; font-size: 10px; margin-bottom: 6px;">
                            ${finding.description}
                        </div>
                        ${finding.proof_of_concept || finding.evidence ? 
                            `<div style="background: rgba(255, 0, 0, 0.1); padding: 6px; border-radius: 3px; margin-top: 6px;">
                                <div style="color: #ff6b6b; font-size: 10px;">
                                    💥 Evidence: ${finding.proof_of_concept || finding.evidence}
                                </div>
                            </div>` : ''
                        }
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderFinalRecommendations(recommendations) {
        return `
            <div class="workflow-phase-card">
                <h4 style="color: #00ff9f; margin-bottom: 15px;">💡 Final Recommendations</h4>
                
                ${recommendations.immediate_actions && recommendations.immediate_actions.length > 0 ? `
                    <div class="recommendation-card">
                        <h5 style="color: #ff4444; margin-bottom: 8px;">🚨 Immediate Actions (Critical)</h5>
                        <ul style="margin: 0; padding-left: 16px; font-size: 12px;">
                            ${recommendations.immediate_actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${recommendations.short_term_improvements && recommendations.short_term_improvements.length > 0 ? `
                    <div class="recommendation-card">
                        <h5 style="color: #ffa500; margin-bottom: 8px;">⚡ Short-term Improvements</h5>
                        <ul style="margin: 0; padding-left: 16px; font-size: 12px;">
                            ${recommendations.short_term_improvements.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${recommendations.long_term_strategy && recommendations.long_term_strategy.length > 0 ? `
                    <div class="recommendation-card">
                        <h5 style="color: #00ff9f; margin-bottom: 8px;">🎯 Long-term Strategy</h5>
                        <ul style="margin: 0; padding-left: 16px; font-size: 12px;">
                            ${recommendations.long_term_strategy.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderPhaseResults(phases) {
        return `
            <div class="workflow-phase-card">
                <h4 style="color: #9a4dff; margin-bottom: 15px;">📊 Phase Results Summary</h4>
                ${Object.entries(phases).map(([phaseKey, phaseData]) => `
                    <div style="margin-bottom: 12px; padding: 8px; border: 1px solid #9a4dff; border-radius: 4px;">
                        <div style="color: #9a4dff; font-weight: bold; font-size: 12px; margin-bottom: 4px;">
                            ${phaseData.phase_name || phaseKey.replace('_', ' ').toUpperCase()}
                        </div>
                        <div style="font-size: 10px; color: #666; margin-bottom: 4px;">
                            Duration: ${phaseData.duration_seconds ? Math.round(phaseData.duration_seconds / 60) + ' minutes' : 'N/A'}
                        </div>
                        <div style="font-size: 10px; color: #ccc;">
                            Key Findings: ${Object.keys(phaseData.scan_results || {}).length} scan types completed
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    async generateReport(assessmentId) {
        try {
            Utils.showMessage('Generating comprehensive bug bounty report...', 'info', 'workflow-messages');
            
            const response = await API.call(`/enhanced-bug-bounty/generate-report/${assessmentId}`, {
                method: 'POST',
                body: JSON.stringify({
                    reportType: 'bug_bounty_findings',
                    formats: ['html', 'json']
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                if (data.success) {
                    Utils.showMessage('Bug bounty report generated successfully!', 'success', 'workflow-messages');
                    
                    // Show download options
                    if (data.data.export_urls) {
                        this.showReportDownloadOptions(data.data.export_urls);
                    }
                } else {
                    throw new Error(data.message || 'Report generation failed');
                }
            } else {
                throw new Error('Failed to generate report');
            }
        } catch (error) {
            Utils.showMessage('Failed to generate report: ' + error.message, 'error', 'workflow-messages');
        }
    },

    showReportDownloadOptions(exportUrls) {
        const downloadHTML = `
            <div style="margin-top: 15px; padding: 15px; border: 1px solid #00ff9f; border-radius: 8px; background: rgba(0, 255, 159, 0.1);">
                <h5 style="color: #00ff9f; margin-bottom: 10px;">📊 Report Download Options</h5>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${exportUrls.html ? `<a href="${exportUrls.html}" target="_blank" class="export-btn-workflow">📄 HTML Report</a>` : ''}
                    ${exportUrls.json ? `<a href="${exportUrls.json}" target="_blank" class="export-btn-workflow">📋 JSON Data</a>` : ''}
                    ${exportUrls.pdf ? `<a href="${exportUrls.pdf}" target="_blank" class="export-btn-workflow">📑 PDF Report</a>` : ''}
                </div>
            </div>
        `;
        
        // Append to workflow messages
        const messagesDiv = document.getElementById('workflow-messages');
        if (messagesDiv) {
            messagesDiv.innerHTML += downloadHTML;
        }
    },

    async stopAssessment(assessmentId) {
        if (confirm('Are you sure you want to stop this bug bounty assessment?')) {
            try {
                const response = await API.call(`/enhanced-bug-bounty/stop-assessment/${assessmentId}`, {
                    method: 'POST'
                });
                
                if (response && response.ok) {
                    Utils.showMessage('Bug bounty assessment stopped successfully!', 'success');
                    await this.loadAssessments();
                }
            } catch (error) {
                Utils.showMessage('Failed to stop assessment: ' + error.message, 'error');
            }
        }
    },

    // Real-time updates
    startRealTimeUpdates() {
        console.log('🔄 Starting real-time updates for bug bounty workflow');
        
        this.cleanup();
        
        this.refreshInterval = setInterval(async () => {
            if (!this.isAutoRefreshEnabled) return;
            
            const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
            if (activeTab === 'bug-bounty-workflow') {
                try {
                    await this.loadAssessments();
                    this.updateLastUpdateTime();
                } catch (error) {
                    console.error('Real-time workflow update failed:', error);
                }
            }
        }, 3000); // Update every 3 seconds
        
        this.updateAutoRefreshIndicator(true);
    },

    updateWorkflowStatus(assessments) {
        const statusSpan = document.getElementById('workflow-status');
        if (!statusSpan) return;
        
        const runningAssessments = assessments.filter(assessment => 
            assessment.status === 'running' || assessment.status === 'pending'
        );
        
        if (runningAssessments.length > 0) {
            const totalProgress = runningAssessments.reduce((sum, assessment) => 
                sum + (assessment.progress_percentage || 0), 0
            );
            const avgProgress = Math.round(totalProgress / runningAssessments.length);
            
            statusSpan.innerHTML = `🔄 ${runningAssessments.length} assessment${runningAssessments.length > 1 ? 's' : ''} running (${avgProgress}% avg)`;
            statusSpan.style.color = '#ffff00';
        } else {
            const completedCount = assessments.filter(assessment => assessment.status === 'completed').length;
            const totalVulns = assessments.filter(assessment => assessment.status === 'completed').reduce((total, assessment) => {
                try {
                    const summary = assessment.results_summary;
                    if (summary) {
                        const data = typeof summary === 'string' ? JSON.parse(summary) : summary;
                        return total + (data.total_vulnerabilities || 0);
                    }
                    return total;
                } catch {
                    return total;
                }
            }, 0);
            
            statusSpan.innerHTML = `✅ ${completedCount} assessment${completedCount !== 1 ? 's' : ''} completed | 🎯 ${totalVulns} vulnerabilities found`;
            statusSpan.style.color = '#ffff00';
        }
    },

    updateLastUpdateTime() {
        const element = document.getElementById('workflow-last-update');
        if (element) {
            element.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
        }
    },

    updateAutoRefreshIndicator(isActive) {
        const indicator = document.getElementById('workflow-auto-refresh-indicator');
        if (indicator) {
            if (isActive) {
                indicator.innerHTML = '🔄 Auto-updating';
                indicator.style.color = '#ffff00';
            } else {
                indicator.innerHTML = '⏸️ Paused';
                indicator.style.color = '#ffa500';
            }
        }
    },

    toggleAutoRefresh() {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        const toggleBtn = document.getElementById('workflow-auto-refresh-toggle');
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
        console.log('🧹 Cleaning up Bug Bounty Workflow module intervals');
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.isAutoRefreshEnabled = false;
    }
};

// Make it globally available
window.BugBountyWorkflow = BugBountyWorkflow;
// backend/src/controllers/enhancedBugBountyController.js
const Target = require('../models/Target');
const ScanJob = require('../models/ScanJob');
const { validationResult, body } = require('express-validator');

// Import enhanced services
const workflowOrchestrator = require('../services/workflowOrchestrator');
const technologyDetectionService = require('../services/technologyDetectionService');
const exploitationService = require('../services/exploitationService');
const advancedAPIService = require('../services/advancedAPIService');
const reportingAnalyticsService = require('../services/reportingAnalyticsService');

class EnhancedBugBountyController {
  
  // Start comprehensive bug bounty assessment
  async startComprehensiveAssessment(req, res) {
    try {
      const { targetId, assessmentType = 'full', customConfig = {} } = req.body;
      const { user } = req;

      // Validate target
      const target = await Target.findById(targetId, user.organization_id);
      if (!target) {
        return res.status(404).json({
          success: false,
          message: 'Target not found'
        });
      }

      // Check for running assessments
      const runningAssessments = await ScanJob.findByTargetAndStatus(targetId, ['pending', 'running']);
      if (runningAssessments.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Assessment already running for this target',
          data: { running_jobs: runningAssessments }
        });
      }

      // Create comprehensive assessment job
      const assessmentJob = await ScanJob.create({
        target_id: targetId,
        job_type: 'comprehensive_bug_bounty',
        scan_types: JSON.stringify(['full_workflow']),
        priority: 'high',
        config: JSON.stringify({
          assessment_type: assessmentType,
          custom_config: customConfig,
          include_exploitation: true,
          generate_reports: true
        }),
        created_by: user.id,
        organization_id: user.organization_id,
        status: 'pending'
      });

      // Start comprehensive workflow
      console.log(`🚀 Starting comprehensive bug bounty assessment for: ${target.domain}`);
      
      // Execute asynchronously
      this.executeComprehensiveWorkflow(assessmentJob, target).catch(error => {
        console.error('Comprehensive assessment failed:', error);
        ScanJob.markAsFailed(assessmentJob.id, error.message);
      });

      res.status(201).json({
        success: true,
        message: 'Comprehensive bug bounty assessment started',
        data: {
          assessment_id: assessmentJob.id,
          target_domain: target.domain,
          assessment_type: assessmentType,
          estimated_duration: this.estimateAssessmentDuration(assessmentType),
          phases: Object.keys(workflowOrchestrator.workflowPhases)
        }
      });

    } catch (error) {
      console.error('Error starting comprehensive assessment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start comprehensive assessment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get assessment status and progress
  async getAssessmentStatus(req, res) {
    try {
      const { assessmentId } = req.params;
      const { user } = req;

      const assessment = await ScanJob.findById(assessmentId, user.organization_id);
      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      // Get detailed progress information
      const progressDetails = await this.getDetailedProgress(assessment);

      res.json({
        success: true,
        data: {
          assessment_id: assessment.id,
          status: assessment.status,
          progress_percentage: assessment.progress_percentage,
          started_at: assessment.started_at,
          estimated_completion: progressDetails.estimated_completion,
          current_phase: progressDetails.current_phase,
          completed_phases: progressDetails.completed_phases,
          phase_details: progressDetails.phase_details,
          results_available: assessment.status === 'completed'
        }
      });

    } catch (error) {
      console.error('Error getting assessment status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get assessment status',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get comprehensive assessment results
  async getAssessmentResults(req, res) {
    try {
      const { assessmentId } = req.params;
      const { format = 'summary' } = req.query;
      const { user } = req;

      const assessment = await ScanJob.findById(assessmentId, user.organization_id);
      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      if (assessment.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Assessment not completed yet',
          current_status: assessment.status,
          progress: assessment.progress_percentage
        });
      }

      // Parse results
      const results = typeof assessment.results === 'string' ? 
        JSON.parse(assessment.results) : assessment.results;

      let responseData = {};

      switch (format) {
        case 'summary':
          responseData = this.formatSummaryResults(results);
          break;
        case 'detailed':
          responseData = this.formatDetailedResults(results);
          break;
        case 'vulnerabilities':
          responseData = this.formatVulnerabilityResults(results);
          break;
        case 'attack_surface':
          responseData = this.formatAttackSurfaceResults(results);
          break;
        case 'recommendations':
          responseData = this.formatRecommendationResults(results);
          break;
        default:
          responseData = results;
      }

      res.json({
        success: true,
        data: responseData,
        metadata: {
          assessment_id: assessment.id,
          target_domain: results.target_domain,
          completed_at: assessment.completed_at,
          total_duration: results.total_duration,
          format: format
        }
      });

    } catch (error) {
      console.error('Error getting assessment results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get assessment results',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Generate comprehensive report
  async generateReport(req, res) {
    try {
      const { assessmentId } = req.params;
      const { reportType = 'technical_detailed', formats = ['html', 'json'] } = req.body;
      const { user } = req;

      const assessment = await ScanJob.findById(assessmentId, user.organization_id);
      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      if (assessment.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Cannot generate report for incomplete assessment'
        });
      }

      // Get target information
      const target = await Target.findById(assessment.target_id, user.organization_id);
      const results = typeof assessment.results === 'string' ? 
        JSON.parse(assessment.results) : assessment.results;

      // Generate comprehensive report
      const report = await reportingAnalyticsService.generateComprehensiveReport(
        target,
        results,
        reportType
      );

      res.json({
        success: true,
        message: 'Report generated successfully',
        data: {
          report_id: report.metadata.report_id,
          report_type: reportType,
          target_domain: target.domain,
          generated_at: report.metadata.generated_at,
          export_urls: report.export_urls,
          charts_data: report.charts_data
        }
      });

    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get technology detection results
  async getTechnologyDetection(req, res) {
    try {
      const { targetId } = req.params;
      const { user } = req;

      const target = await Target.findById(targetId, user.organization_id);
      if (!target) {
        return res.status(404).json({
          success: false,
          message: 'Target not found'
        });
      }

      // Get subdomains for technology detection
      const subdomains = await this.getTargetSubdomains(targetId);
      
      // Run technology detection
      const techResults = await technologyDetectionService.detectTechnologies(target, subdomains);

      res.json({
        success: true,
        data: techResults
      });

    } catch (error) {
      console.error('Error in technology detection:', error);
      res.status(500).json({
        success: false,
        message: 'Technology detection failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get advanced API discovery results
  async getAdvancedAPIDiscovery(req, res) {
    try {
      const { targetId } = req.params;
      const { user } = req;

      const target = await Target.findById(targetId, user.organization_id);
      if (!target) {
        return res.status(404).json({
          success: false,
          message: 'Target not found'
        });
      }

      const subdomains = await this.getTargetSubdomains(targetId);
      
      // Create a mock scan for API discovery
      const mockScan = { id: `api-discovery-${Date.now()}` };
      
      const apiResults = await advancedAPIService.discoverAndTestAPIs(mockScan, target, subdomains);

      res.json({
        success: true,
        data: apiResults
      });

    } catch (error) {
      console.error('Error in API discovery:', error);
      res.status(500).json({
        success: false,
        message: 'API discovery failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get bug bounty specific analysis
  async getBugBountyAnalysis(req, res) {
    try {
      const { assessmentId } = req.params;
      const { user } = req;

      const assessment = await ScanJob.findById(assessmentId, user.organization_id);
      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      const target = await Target.findById(assessment.target_id, user.organization_id);
      const results = typeof assessment.results === 'string' ? 
        JSON.parse(assessment.results) : assessment.results;

      // Generate bug bounty specific analysis
      const bugBountyAnalysis = await reportingAnalyticsService.generateBugBountyFindings(target, results);

      res.json({
        success: true,
        data: bugBountyAnalysis
      });

    } catch (error) {
      console.error('Error in bug bounty analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Bug bounty analysis failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get dashboard analytics
  async getDashboardAnalytics(req, res) {
    try {
      const { user } = req;
      const { timeframe = '30d' } = req.query;

      const analytics = await this.generateDashboardAnalytics(user.organization_id, timeframe);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Error getting dashboard analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Stop assessment
  async stopAssessment(req, res) {
    try {
      const { assessmentId } = req.params;
      const { user } = req;

      const assessment = await ScanJob.findById(assessmentId, user.organization_id);
      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found'
        });
      }

      if (!['pending', 'running'].includes(assessment.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot stop assessment with status: ${assessment.status}`
        });
      }

      // Stop the assessment
      await ScanJob.update(assessmentId, user.organization_id, {
        status: 'cancelled',
        completed_at: new Date()
      });

      res.json({
        success: true,
        message: 'Assessment stopped successfully'
      });

    } catch (error) {
      console.error('Error stopping assessment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stop assessment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Private helper methods
  async executeComprehensiveWorkflow(assessmentJob, target) {
    try {
      await ScanJob.markAsStarted(assessmentJob.id);
      
      const results = await workflowOrchestrator.executeComprehensiveBugBounty(assessmentJob, target);
      
      await ScanJob.markAsCompleted(assessmentJob.id, results);
      
      console.log(`✅ Comprehensive assessment completed for: ${target.domain}`);
      
    } catch (error) {
      console.error(`❌ Comprehensive assessment failed for ${target.domain}:`, error);
      await ScanJob.markAsFailed(assessmentJob.id, error.message);
    }
  }

  estimateAssessmentDuration(assessmentType) {
    const durations = {
      'quick': '30-60 minutes',
      'standard': '2-4 hours',
      'full': '4-8 hours',
      'comprehensive': '8-24 hours'
    };
    
    return durations[assessmentType] || durations['standard'];
  }

  async getDetailedProgress(assessment) {
    // Parse current results to determine progress details
    let results = {};
    if (assessment.results) {
      try {
        results = typeof assessment.results === 'string' ? 
          JSON.parse(assessment.results) : assessment.results;
      } catch (error) {
        console.warn('Failed to parse assessment results:', error);
      }
    }

    const phases = workflowOrchestrator.workflowPhases;
    const completedPhases = Object.keys(results.phases || {});
    const totalPhases = Object.keys(phases).length;
    
    let currentPhase = 'Starting...';
    if (completedPhases.length < totalPhases) {
      const phaseKeys = Object.keys(phases);
      currentPhase = phases[phaseKeys[completedPhases.length]]?.name || 'Unknown';
    } else if (assessment.status === 'completed') {
      currentPhase = 'Completed';
    }

    return {
      current_phase: currentPhase,
      completed_phases: completedPhases,
      total_phases: totalPhases,
      phase_details: completedPhases.map(phaseKey => ({
        name: phases[phaseKey]?.name,
        completed: true,
        duration: results.phases[phaseKey]?.duration_seconds
      })),
      estimated_completion: this.calculateEstimatedCompletion(assessment, completedPhases.length, totalPhases)
    };
  }

  calculateEstimatedCompletion(assessment, completedPhases, totalPhases) {
    if (!assessment.started_at) return null;
    
    const startTime = new Date(assessment.started_at);
    const now = new Date();
    const elapsedMs = now - startTime;
    
    if (completedPhases === 0) return null;
    
    const avgPhaseTime = elapsedMs / completedPhases;
    const remainingPhases = totalPhases - completedPhases;
    const estimatedRemainingMs = avgPhaseTime * remainingPhases;
    
    return new Date(now.getTime() + estimatedRemainingMs).toISOString();
  }

  formatSummaryResults(results) {
    return {
      target_domain: results.target_domain,
      assessment_duration: results.total_duration,
      phases_completed: Object.keys(results.phases || {}).length,
      high_value_targets: results.high_value_targets?.length || 0,
      attack_chains: results.attack_chains?.length || 0,
      total_vulnerabilities: results.consolidated_findings?.vulnerabilities?.length || 0,
      critical_vulnerabilities: results.consolidated_findings?.vulnerabilities?.filter(v => v.severity === 'critical').length || 0,
      recommendations_count: results.final_recommendations?.immediate_actions?.length || 0
    };
  }

  formatDetailedResults(results) {
    return {
      workflow_results: results,
      execution_timeline: this.extractExecutionTimeline(results),
      phase_breakdown: this.extractPhaseBreakdown(results),
      finding_distribution: this.extractFindingDistribution(results)
    };
  }

  formatVulnerabilityResults(results) {
    const vulnerabilities = results.consolidated_findings?.vulnerabilities || [];
    
    return {
      total_vulnerabilities: vulnerabilities.length,
      severity_breakdown: this.getVulnerabilitySeverityBreakdown(vulnerabilities),
      vulnerabilities: vulnerabilities,
      exploitation_evidence: results.phases?.phase4_exploitation?.scan_results || {},
      remediation_priorities: this.prioritizeRemediation(vulnerabilities)
    };
  }

  formatAttackSurfaceResults(results) {
    return {
      attack_surface: results.consolidated_findings || {},
      high_value_targets: results.high_value_targets || [],
      entry_points: this.extractEntryPoints(results),
      exposed_services: this.extractExposedServices(results)
    };
  }

  formatRecommendationResults(results) {
    return {
      final_recommendations: results.final_recommendations || {},
      phase_recommendations: this.extractPhaseRecommendations(results),
      priority_actions: this.extractPriorityActions(results),
      compliance_guidance: this.extractComplianceGuidance(results)
    };
  }

  async getTargetSubdomains(targetId) {
    try {
      const knex = require('../config/database');
      return await knex('subdomains')
        .where('target_id', targetId)
        .where('status', 'active')
        .select('*');
    } catch (error) {
      console.error('Failed to get target subdomains:', error);
      return [];
    }
  }

  async generateDashboardAnalytics(organizationId, timeframe) {
    // This would generate comprehensive dashboard analytics
    return {
      overview: {
        total_targets: 0,
        active_assessments: 0,
        total_vulnerabilities: 0,
        security_score_average: 0
      },
      trends: {
        vulnerability_discovery: [],
        security_improvements: [],
        assessment_frequency: []
      },
      top_findings: [],
      recent_activity: []
    };
  }

  // Additional helper methods
  extractExecutionTimeline(results) { return []; }
  extractPhaseBreakdown(results) { return {}; }
  extractFindingDistribution(results) { return {}; }
  getVulnerabilitySeverityBreakdown(vulnerabilities) { 
    const breakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    vulnerabilities.forEach(v => {
      if (breakdown.hasOwnProperty(v.severity)) {
        breakdown[v.severity]++;
      }
    });
    return breakdown;
  }
  prioritizeRemediation(vulnerabilities) { return []; }
  extractEntryPoints(results) { return []; }
  extractExposedServices(results) { return []; }
  extractPhaseRecommendations(results) { return []; }
  extractPriorityActions(results) { return []; }
  extractComplianceGuidance(results) { return []; }
}

module.exports = new EnhancedBugBountyController();
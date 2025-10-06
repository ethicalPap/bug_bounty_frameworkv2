// backend/src/services/reportingAnalyticsService.js
const fs = require('fs').promises;
const path = require('path');
const knex = require('../config/database');

class ReportingAnalyticsService {
  constructor() {
    this.reportTemplates = {
      executive_summary: 'Executive Summary Report',
      technical_detailed: 'Technical Detailed Report',
      vulnerability_assessment: 'Vulnerability Assessment Report',
      compliance_audit: 'Compliance Audit Report',
      penetration_test: 'Penetration Test Report',
      bug_bounty_findings: 'Bug Bounty Findings Report'
    };

    // OWASP Top 10 mapping for compliance
    this.owaspTop10Mapping = {
      'Broken Access Control': ['IDOR', 'Authentication Bypass', 'Authorization Issues'],
      'Cryptographic Failures': ['Weak Encryption', 'SSL Issues'],
      'Injection': ['SQL Injection', 'XXE', 'Command Injection', 'LDAP Injection'],
      'Insecure Design': ['Business Logic Flaws', 'Workflow Bypass'],
      'Security Misconfiguration': ['Default Credentials', 'Directory Listing', 'Debug Mode'],
      'Vulnerable Components': ['Outdated Software', 'Known CVEs'],
      'Authentication Failures': ['Weak Passwords', 'Session Issues', 'MFA Bypass'],
      'Software Integrity Failures': ['Unsigned Updates', 'CI/CD Issues'],
      'Logging Failures': ['Insufficient Logging', 'Log Injection'],
      'SSRF': ['Server-Side Request Forgery']
    };
  }

  async generateComprehensiveReport(target, scanResults, reportType = 'technical_detailed') {
    console.log(`📊 Generating ${reportType} report for: ${target.domain}`);
    
    const report = {
      metadata: {
        report_type: reportType,
        target_domain: target.domain,
        target_id: target.id,
        organization_id: target.organization_id,
        generated_at: new Date().toISOString(),
        report_id: `RPT-${Date.now()}`,
        version: '1.0'
      },
      executive_summary: {},
      technical_findings: {},
      risk_assessment: {},
      compliance_analysis: {},
      recommendations: {},
      appendices: {}
    };

    try {
      // Generate different sections based on report type
      switch (reportType) {
        case 'executive_summary':
          report.executive_summary = await this.generateExecutiveSummary(target, scanResults);
          break;
          
        case 'technical_detailed':
          report.technical_findings = await this.generateTechnicalFindings(target, scanResults);
          report.risk_assessment = await this.generateRiskAssessment(scanResults);
          report.recommendations = await this.generateRecommendations(scanResults);
          break;
          
        case 'bug_bounty_findings':
          report.bug_bounty_findings = await this.generateBugBountyFindings(target, scanResults);
          break;
          
        case 'compliance_audit':
          report.compliance_analysis = await this.generateComplianceAnalysis(scanResults);
          break;
      }

      // Generate common sections for all reports
      report.attack_surface_analysis = await this.generateAttackSurfaceAnalysis(scanResults);
      report.timeline_analysis = await this.generateTimelineAnalysis(target);
      report.trend_analysis = await this.generateTrendAnalysis(target);
      
      // Generate visual charts data
      report.charts_data = await this.generateChartsData(scanResults);
      
      // Export in multiple formats
      const exports = await this.exportReport(report, ['json', 'html', 'pdf']);
      report.export_urls = exports;

      console.log(`✅ Report generated successfully: ${report.metadata.report_id}`);
      return report;

    } catch (error) {
      console.error(`❌ Report generation failed:`, error);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  async generateExecutiveSummary(target, scanResults) {
    const summary = {
      target_overview: {
        domain: target.domain,
        organization: target.organization_id,
        scan_date: new Date().toISOString(),
        scope: this.determineScanScope(scanResults)
      },
      key_findings: {
        total_vulnerabilities: 0,
        critical_vulnerabilities: 0,
        high_vulnerabilities: 0,
        exposed_services: 0,
        security_score: 0
      },
      risk_overview: {
        overall_risk_level: 'unknown',
        business_impact: 'unknown',
        likelihood: 'unknown'
      },
      immediate_actions: [],
      business_recommendations: []
    };

    // Extract key metrics from scan results
    if (scanResults.consolidated_findings) {
      const vulns = scanResults.consolidated_findings.vulnerabilities || [];
      summary.key_findings.total_vulnerabilities = vulns.length;
      summary.key_findings.critical_vulnerabilities = vulns.filter(v => v.severity === 'critical').length;
      summary.key_findings.high_vulnerabilities = vulns.filter(v => v.severity === 'high').length;
      summary.key_findings.exposed_services = scanResults.consolidated_findings.open_ports?.length || 0;
    }

    // Calculate security score (0-100)
    summary.key_findings.security_score = this.calculateSecurityScore(scanResults);
    
    // Determine overall risk level
    summary.risk_overview.overall_risk_level = this.calculateOverallRisk(summary.key_findings);
    
    // Generate business-focused recommendations
    summary.immediate_actions = this.generateImmediateActions(summary.key_findings);
    summary.business_recommendations = this.generateBusinessRecommendations(summary);

    return summary;
  }

  async generateTechnicalFindings(target, scanResults) {
    const findings = {
      reconnaissance_results: {},
      vulnerability_details: [],
      attack_surface_mapping: {},
      exploitation_evidence: {},
      technical_recommendations: []
    };

    // Process reconnaissance results
    if (scanResults.phases?.phase1_reconnaissance) {
      findings.reconnaissance_results = {
        subdomains_discovered: scanResults.phases.phase1_reconnaissance.scan_results.subdomain_scan?.total_count || 0,
        live_hosts: scanResults.phases.phase1_reconnaissance.scan_results.live_hosts_scan?.live_hosts || 0,
        technologies_identified: scanResults.phases.phase1_reconnaissance.scan_results.technology_detection?.technologies || {},
        content_discovered: scanResults.phases.phase1_reconnaissance.scan_results.content_discovery?.total_items || 0
      };
    }

    // Process vulnerability details
    if (scanResults.consolidated_findings?.vulnerabilities) {
      findings.vulnerability_details = scanResults.consolidated_findings.vulnerabilities.map(vuln => ({
        id: vuln.id || `VULN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: vuln.title || vuln.type,
        severity: vuln.severity,
        cvss_score: vuln.cvss_score || this.calculateCVSS(vuln),
        description: vuln.description,
        affected_component: vuln.endpoint || vuln.url,
        exploitation_complexity: this.assessExploitationComplexity(vuln),
        proof_of_concept: vuln.proof_of_concept || vuln.evidence,
        remediation_steps: this.generateRemediationSteps(vuln),
        references: vuln.references || []
      }));
    }

    // Generate attack surface mapping
    findings.attack_surface_mapping = this.generateAttackSurfaceMapping(scanResults);
    
    // Process exploitation evidence
    if (scanResults.phases?.phase4_exploitation) {
      findings.exploitation_evidence = scanResults.phases.phase4_exploitation.scan_results.systematic_exploitation || {};
    }

    // Generate technical recommendations
    findings.technical_recommendations = this.generateTechnicalRecommendations(findings);

    return findings;
  }

  async generateBugBountyFindings(target, scanResults) {
    const findings = {
      summary: {
        total_findings: 0,
        potential_bounty_value: 0,
        submission_ready_findings: 0
      },
      high_value_findings: [],
      submission_templates: {},
      platform_specific_guidance: {}
    };

    const vulnerabilities = scanResults.consolidated_findings?.vulnerabilities || [];
    findings.summary.total_findings = vulnerabilities.length;

    // Identify high-value findings for bug bounty
    findings.high_value_findings = vulnerabilities
      .filter(vuln => this.isHighValueForBugBounty(vuln))
      .map(vuln => ({
        ...vuln,
        estimated_bounty_range: this.estimateBountyValue(vuln),
        submission_readiness: this.assessSubmissionReadiness(vuln),
        platform_recommendations: this.getPlatformRecommendations(vuln)
      }))
      .sort((a, b) => b.estimated_bounty_range.max - a.estimated_bounty_range.max);

    findings.summary.submission_ready_findings = findings.high_value_findings
      .filter(f => f.submission_readiness.ready).length;

    findings.summary.potential_bounty_value = findings.high_value_findings
      .reduce((total, finding) => total + finding.estimated_bounty_range.max, 0);

    // Generate submission templates
    findings.submission_templates = this.generateSubmissionTemplates(findings.high_value_findings);

    // Platform-specific guidance
    findings.platform_specific_guidance = this.generatePlatformGuidance(target);

    return findings;
  }

  async generateComplianceAnalysis(scanResults) {
    const analysis = {
      owasp_top10_coverage: {},
      nist_framework_alignment: {},
      iso27001_compliance: {},
      compliance_gaps: [],
      remediation_priorities: []
    };

    // Map findings to OWASP Top 10
    const vulnerabilities = scanResults.consolidated_findings?.vulnerabilities || [];
    
    Object.keys(this.owaspTop10Mapping).forEach(owaspCategory => {
      const relatedVulns = vulnerabilities.filter(vuln => 
        this.owaspTop10Mapping[owaspCategory].some(vulnType => 
          vuln.type?.includes(vulnType) || vuln.title?.includes(vulnType)
        )
      );

      analysis.owasp_top10_coverage[owaspCategory] = {
        vulnerabilities_found: relatedVulns.length,
        severity_breakdown: this.getVulnerabilitySeverityBreakdown(relatedVulns),
        compliance_status: relatedVulns.length === 0 ? 'compliant' : 'non-compliant',
        risk_level: this.calculateCategoryRisk(relatedVulns)
      };
    });

    // Identify compliance gaps
    analysis.compliance_gaps = Object.entries(analysis.owasp_top10_coverage)
      .filter(([category, data]) => data.compliance_status === 'non-compliant')
      .map(([category, data]) => ({
        framework: 'OWASP Top 10',
        category: category,
        gap_severity: data.risk_level,
        required_actions: this.getRequiredActions(category, data.vulnerabilities_found)
      }));

    return analysis;
  }

  async generateAttackSurfaceAnalysis(scanResults) {
    const analysis = {
      exposed_services: {},
      entry_points: {},
      attack_vectors: {},
      surface_reduction_recommendations: []
    };

    if (scanResults.consolidated_findings) {
      // Analyze exposed services
      analysis.exposed_services = {
        web_applications: scanResults.consolidated_findings.live_hosts?.length || 0,
        open_ports: scanResults.consolidated_findings.open_ports?.length || 0,
        api_endpoints: scanResults.consolidated_findings.apis?.length || 0,
        admin_interfaces: this.countAdminInterfaces(scanResults.consolidated_findings)
      };

      // Identify entry points
      analysis.entry_points = {
        web_forms: this.countWebForms(scanResults.consolidated_findings),
        file_uploads: this.countFileUploads(scanResults.consolidated_findings),
        api_endpoints: scanResults.consolidated_findings.apis?.length || 0,
        authentication_points: this.countAuthenticationPoints(scanResults.consolidated_findings)
      };

      // Map attack vectors
      analysis.attack_vectors = this.mapAttackVectors(scanResults);
    }

    // Generate surface reduction recommendations
    analysis.surface_reduction_recommendations = this.generateSurfaceReductionRecommendations(analysis);

    return analysis;
  }

  async generateTimelineAnalysis(target) {
    try {
      // Fetch historical scan data
      const historicalScans = await knex('scan_jobs')
        .where('target_id', target.id)
        .where('status', 'completed')
        .orderBy('completed_at', 'desc')
        .limit(30);

      const timeline = {
        scan_frequency: this.calculateScanFrequency(historicalScans),
        vulnerability_trends: await this.analyzeVulnerabilityTrends(target.id),
        improvement_metrics: await this.calculateImprovementMetrics(target.id),
        security_posture_timeline: this.generateSecurityPostureTimeline(historicalScans)
      };

      return timeline;
    } catch (error) {
      console.error('Timeline analysis failed:', error);
      return { error: 'Timeline analysis unavailable' };
    }
  }

  async generateTrendAnalysis(target) {
    try {
      const trends = {
        vulnerability_discovery_rate: await this.calculateDiscoveryRate(target.id),
        fix_rate: await this.calculateFixRate(target.id),
        security_score_trend: await this.calculateSecurityScoreTrend(target.id),
        attack_surface_changes: await this.analyzeAttackSurfaceChanges(target.id),
        technology_evolution: await this.analyzeTechnologyEvolution(target.id)
      };

      return trends;
    } catch (error) {
      console.error('Trend analysis failed:', error);
      return { error: 'Trend analysis unavailable' };
    }
  }

  async generateChartsData(scanResults) {
    return {
      vulnerability_severity_pie: this.generateVulnerabilitySeverityChart(scanResults),
      attack_surface_timeline: this.generateAttackSurfaceTimelineChart(scanResults),
      owasp_compliance_radar: this.generateOWASPComplianceChart(scanResults),
      risk_heatmap: this.generateRiskHeatmapData(scanResults),
      technology_stack_bar: this.generateTechnologyStackChart(scanResults)
    };
  }

  // Helper methods for calculations and analysis
  calculateSecurityScore(scanResults) {
    let score = 100; // Start with perfect score
    
    const vulnerabilities = scanResults.consolidated_findings?.vulnerabilities || [];
    
    // Deduct points based on vulnerability severity
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical': score -= 20; break;
        case 'high': score -= 10; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 1; break;
      }
    });

    // Additional deductions for security misconfigurations
    const openPorts = scanResults.consolidated_findings?.open_ports?.length || 0;
    if (openPorts > 10) score -= 5;

    const adminInterfaces = this.countAdminInterfaces(scanResults.consolidated_findings);
    if (adminInterfaces > 0) score -= 10;

    return Math.max(0, score);
  }

  calculateOverallRisk(keyFindings) {
    if (keyFindings.critical_vulnerabilities > 0) return 'Critical';
    if (keyFindings.high_vulnerabilities > 3) return 'High';
    if (keyFindings.high_vulnerabilities > 0) return 'Medium';
    if (keyFindings.total_vulnerabilities > 0) return 'Low';
    return 'Minimal';
  }

  isHighValueForBugBounty(vulnerability) {
    const highValueTypes = [
      'SQL Injection', 'Authentication Bypass', 'Remote Code Execution',
      'XXE', 'SSRF', 'Privilege Escalation', 'IDOR'
    ];
    
    return vulnerability.severity === 'critical' || 
           vulnerability.severity === 'high' ||
           highValueTypes.some(type => vulnerability.type?.includes(type));
  }

  estimateBountyValue(vulnerability) {
    const bountyRanges = {
      'critical': { min: 1000, max: 10000 },
      'high': { min: 500, max: 5000 },
      'medium': { min: 100, max: 1000 },
      'low': { min: 25, max: 250 }
    };
    
    return bountyRanges[vulnerability.severity] || { min: 0, max: 100 };
  }

  assessSubmissionReadiness(vulnerability) {
    const hasProofOfConcept = !!(vulnerability.proof_of_concept || vulnerability.evidence);
    const hasDescription = !!vulnerability.description;
    const hasReproduction = !!(vulnerability.request || vulnerability.payload);
    
    const readinessScore = [hasProofOfConcept, hasDescription, hasReproduction]
      .filter(Boolean).length;
    
    return {
      ready: readinessScore >= 2,
      score: readinessScore,
      missing_elements: [
        !hasProofOfConcept && 'proof_of_concept',
        !hasDescription && 'detailed_description',
        !hasReproduction && 'reproduction_steps'
      ].filter(Boolean)
    };
  }

  // Additional helper methods would go here...
  determineScanScope(scanResults) { return 'Full Application Assessment'; }
  generateImmediateActions(keyFindings) { return ['Fix critical vulnerabilities', 'Review access controls']; }
  generateBusinessRecommendations(summary) { return ['Implement security training', 'Regular security assessments']; }
  assessExploitationComplexity(vuln) { return 'Medium'; }
  generateRemediationSteps(vuln) { return ['Validate input', 'Implement proper authentication']; }
  generateAttackSurfaceMapping(scanResults) { return {}; }
  generateTechnicalRecommendations(findings) { return []; }
  getPlatformRecommendations(vuln) { return ['HackerOne', 'Bugcrowd']; }
  generateSubmissionTemplates(findings) { return {}; }
  generatePlatformGuidance(target) { return {}; }
  getVulnerabilitySeverityBreakdown(vulns) { return {}; }
  calculateCategoryRisk(vulns) { return 'medium'; }
  getRequiredActions(category, count) { return []; }
  countAdminInterfaces(findings) { return 0; }
  countWebForms(findings) { return 0; }
  countFileUploads(findings) { return 0; }
  countAuthenticationPoints(findings) { return 0; }
  mapAttackVectors(scanResults) { return {}; }
  generateSurfaceReductionRecommendations(analysis) { return []; }
  calculateScanFrequency(scans) { return 'weekly'; }
  async analyzeVulnerabilityTrends(targetId) { return {}; }
  async calculateImprovementMetrics(targetId) { return {}; }
  generateSecurityPostureTimeline(scans) { return {}; }
  async calculateDiscoveryRate(targetId) { return 0; }
  async calculateFixRate(targetId) { return 0; }
  async calculateSecurityScoreTrend(targetId) { return []; }
  async analyzeAttackSurfaceChanges(targetId) { return {}; }
  async analyzeTechnologyEvolution(targetId) { return {}; }
  generateVulnerabilitySeverityChart(scanResults) { return {}; }
  generateAttackSurfaceTimelineChart(scanResults) { return {}; }
  generateOWASPComplianceChart(scanResults) { return {}; }
  generateRiskHeatmapData(scanResults) { return {}; }
  generateTechnologyStackChart(scanResults) { return {}; }
  calculateCVSS(vuln) { return 7.5; }

  async exportReport(report, formats) {
    const exports = {};
    
    for (const format of formats) {
      try {
        switch (format) {
          case 'json':
            exports.json = await this.exportJSON(report);
            break;
          case 'html':
            exports.html = await this.exportHTML(report);
            break;
          case 'pdf':
            exports.pdf = await this.exportPDF(report);
            break;
        }
      } catch (error) {
        console.error(`Failed to export ${format}:`, error);
      }
    }
    
    return exports;
  }

  async exportJSON(report) {
    const filename = `report_${report.metadata.report_id}.json`;
    const filepath = path.join('/tmp', filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    return {
      format: 'json',
      filename: filename,
      filepath: filepath,
      size: JSON.stringify(report).length
    };
  }

  async exportHTML(report) {
    // Generate HTML report template
    const htmlTemplate = this.generateHTMLTemplate(report);
    const filename = `report_${report.metadata.report_id}.html`;
    const filepath = path.join('/tmp', filename);
    
    await fs.writeFile(filepath, htmlTemplate);
    
    return {
      format: 'html',
      filename: filename,
      filepath: filepath,
      size: htmlTemplate.length
    };
  }

  async exportPDF(report) {
    // This would use a PDF generation library like puppeteer
    const filename = `report_${report.metadata.report_id}.pdf`;
    const filepath = path.join('/tmp', filename);
    
    // Placeholder - would implement actual PDF generation
    await fs.writeFile(filepath, 'PDF report content placeholder');
    
    return {
      format: 'pdf',
      filename: filename,
      filepath: filepath,
      size: 0
    };
  }

  generateHTMLTemplate(report) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Security Assessment Report - ${report.metadata.target_domain}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; }
        .section { margin: 30px 0; }
        .vulnerability { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
        .critical { border-left: 5px solid #d32f2f; }
        .high { border-left: 5px solid #f57c00; }
        .medium { border-left: 5px solid #fbc02d; }
        .low { border-left: 5px solid #388e3c; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Security Assessment Report</h1>
        <p><strong>Target:</strong> ${report.metadata.target_domain}</p>
        <p><strong>Generated:</strong> ${report.metadata.generated_at}</p>
        <p><strong>Report ID:</strong> ${report.metadata.report_id}</p>
      </div>
      
      ${report.executive_summary ? this.generateExecutiveSummaryHTML(report.executive_summary) : ''}
      ${report.technical_findings ? this.generateTechnicalFindingsHTML(report.technical_findings) : ''}
      ${report.recommendations ? this.generateRecommendationsHTML(report.recommendations) : ''}
    </body>
    </html>`;
  }

  generateExecutiveSummaryHTML(summary) {
    return `
    <div class="section">
      <h2>Executive Summary</h2>
      <p><strong>Security Score:</strong> ${summary.key_findings?.security_score || 'N/A'}</p>
      <p><strong>Total Vulnerabilities:</strong> ${summary.key_findings?.total_vulnerabilities || 0}</p>
      <p><strong>Critical Issues:</strong> ${summary.key_findings?.critical_vulnerabilities || 0}</p>
      <p><strong>Overall Risk:</strong> ${summary.risk_overview?.overall_risk_level || 'Unknown'}</p>
    </div>`;
  }

  generateTechnicalFindingsHTML(findings) {
    let html = '<div class="section"><h2>Technical Findings</h2>';
    
    if (findings.vulnerability_details) {
      findings.vulnerability_details.forEach(vuln => {
        html += `
        <div class="vulnerability ${vuln.severity}">
          <h3>${vuln.title}</h3>
          <p><strong>Severity:</strong> ${vuln.severity.toUpperCase()}</p>
          <p><strong>Affected Component:</strong> ${vuln.affected_component}</p>
          <p><strong>Description:</strong> ${vuln.description}</p>
          ${vuln.proof_of_concept ? `<p><strong>Proof of Concept:</strong> ${vuln.proof_of_concept}</p>` : ''}
        </div>`;
      });
    }
    
    html += '</div>';
    return html;
  }

  generateRecommendationsHTML(recommendations) {
    return `
    <div class="section">
      <h2>Recommendations</h2>
      <h3>Immediate Actions</h3>
      <ul>
        ${recommendations.immediate_actions?.map(action => `<li>${action}</li>`).join('') || ''}
      </ul>
      <h3>Short-term Improvements</h3>
      <ul>
        ${recommendations.short_term_improvements?.map(action => `<li>${action}</li>`).join('') || ''}
      </ul>
    </div>`;
  }
}

module.exports = new ReportingAnalyticsService();
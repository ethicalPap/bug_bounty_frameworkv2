// backend/src/services/workflowOrchestrator.js
const ScanJob = require('../models/ScanJob');
const Target = require('../models/Target');

// Import enhanced services
const technologyDetectionService = require('./technologyDetectionService');
const exploitationService = require('./exploitationService');
const advancedAPIService = require('./advancedAPIService');

class WorkflowOrchestrator {
  constructor() {
    // Define the systematic bug bounty workflow based on your checklists
    this.workflowPhases = {
      phase1_reconnaissance: {
        name: 'Reconnaissance & Information Gathering',
        order: 1,
        scans: [
          'subdomain_scan',
          'live_hosts_scan',
          'technology_detection',
          'content_discovery'
        ],
        dependencies: []
      },
      
      phase2_attack_surface: {
        name: 'Attack Surface Analysis',
        order: 2,
        scans: [
          'port_scan',
          'js_files_scan',
          'api_discovery_advanced',
          'parameter_discovery'
        ],
        dependencies: ['phase1_reconnaissance']
      },
      
      phase3_vulnerability_assessment: {
        name: 'Vulnerability Assessment',
        order: 3,
        scans: [
          'vulnerability_scan',
          'authentication_testing',
          'authorization_testing'
        ],
        dependencies: ['phase2_attack_surface']
      },
      
      phase4_exploitation: {
        name: 'Systematic Exploitation',
        order: 4,
        scans: [
          'systematic_exploitation',
          'business_logic_testing',
          'privilege_escalation'
        ],
        dependencies: ['phase3_vulnerability_assessment']
      }
    };

    // Intelligence gathering configuration
    this.intelligenceConfig = {
      email_harvesting: true,
      credential_hunting: true,
      social_media_recon: true,
      third_party_exposure: true,
      historical_data_analysis: true
    };
  }

  async executeComprehensiveBugBounty(scan, target) {
    console.log(`🚀 Executing comprehensive bug bounty workflow for: ${target.domain}`);
    
    const workflowResults = {
      target_domain: target.domain,
      workflow_id: scan.id,
      phases: {},
      consolidated_findings: {},
      high_value_targets: [],
      attack_chains: [],
      final_recommendations: [],
      scan_timestamp: new Date().toISOString(),
      total_duration: 0
    };

    const startTime = Date.now();

    try {
      // Execute phases in order
      for (const [phaseKey, phaseConfig] of Object.entries(this.workflowPhases)) {
        console.log(`📋 Starting ${phaseConfig.name}...`);
        
        // Check dependencies
        if (!this.checkPhaseDependencies(phaseConfig.dependencies, workflowResults.phases)) {
          throw new Error(`Dependencies not met for ${phaseConfig.name}`);
        }

        const phaseResults = await this.executePhase(phaseKey, phaseConfig, target, scan, workflowResults);
        workflowResults.phases[phaseKey] = phaseResults;

        // Update overall progress
        const phaseProgress = (phaseConfig.order / Object.keys(this.workflowPhases).length) * 80;
        await ScanJob.updateProgress(scan.id, Math.round(phaseProgress));
      }

      // Phase 5: Consolidation and Analysis
      console.log(`🔍 Consolidating findings and generating attack chains...`);
      await ScanJob.updateProgress(scan.id, 85);
      
      workflowResults.consolidated_findings = this.consolidateFindings(workflowResults.phases);
      workflowResults.high_value_targets = this.identifyHighValueTargets(workflowResults.consolidated_findings);
      workflowResults.attack_chains = this.generateAttackChains(workflowResults.consolidated_findings);
      
      // Phase 6: Final Recommendations
      console.log(`📊 Generating final recommendations...`);
      await ScanJob.updateProgress(scan.id, 95);
      
      workflowResults.final_recommendations = this.generateFinalRecommendations(workflowResults);
      workflowResults.total_duration = Math.round((Date.now() - startTime) / 1000);

      console.log(`✅ Comprehensive bug bounty workflow completed for ${target.domain}`);
      console.log(`   Total duration: ${workflowResults.total_duration}s`);
      console.log(`   High-value targets: ${workflowResults.high_value_targets.length}`);
      console.log(`   Attack chains: ${workflowResults.attack_chains.length}`);

      await ScanJob.updateProgress(scan.id, 100);
      return workflowResults;

    } catch (error) {
      console.error(`❌ Comprehensive workflow failed for ${target.domain}:`, error);
      throw new Error(`Comprehensive workflow failed: ${error.message}`);
    }
  }

  async executePhase(phaseKey, phaseConfig, target, scan, workflowResults) {
    const phaseResults = {
      phase_name: phaseConfig.name,
      started_at: new Date().toISOString(),
      scan_results: {},
      findings_summary: {},
      phase_recommendations: [],
      completed_at: null,
      duration_seconds: 0
    };

    const phaseStartTime = Date.now();

    try {
      // Execute scans in this phase
      for (const scanType of phaseConfig.scans) {
        console.log(`  🔄 Executing ${scanType}...`);
        
        try {
          const scanResult = await this.executeScanType(scanType, target, scan, workflowResults);
          phaseResults.scan_results[scanType] = scanResult;
          
          // Extract key findings for phase summary
          phaseResults.findings_summary[scanType] = this.extractKeyFindings(scanType, scanResult);
          
        } catch (scanError) {
          console.error(`  ❌ ${scanType} failed:`, scanError.message);
          phaseResults.scan_results[scanType] = {
            status: 'failed',
            error: scanError.message,
            timestamp: new Date().toISOString()
          };
        }
      }

      // Generate phase-specific recommendations
      phaseResults.phase_recommendations = this.generatePhaseRecommendations(phaseKey, phaseResults);
      
      phaseResults.completed_at = new Date().toISOString();
      phaseResults.duration_seconds = Math.round((Date.now() - phaseStartTime) / 1000);

      console.log(`  ✅ ${phaseConfig.name} completed in ${phaseResults.duration_seconds}s`);
      
      return phaseResults;

    } catch (error) {
      console.error(`  ❌ Phase ${phaseKey} failed:`, error.message);
      throw error;
    }
  }

  async executeScanType(scanType, target, scan, workflowResults) {
    switch (scanType) {
      case 'subdomain_scan':
        return await this.executeSubdomainScan(target, scan);
        
      case 'live_hosts_scan':
        return await this.executeLiveHostsScan(target, scan);
        
      case 'technology_detection':
        return await this.executeTechnologyDetection(target, workflowResults);
        
      case 'content_discovery':
        return await this.executeContentDiscovery(target, scan);
        
      case 'port_scan':
        return await this.executePortScan(target, scan, workflowResults);
        
      case 'js_files_scan':
        return await this.executeJSScan(target, scan);
        
      case 'api_discovery_advanced':
        return await this.executeAdvancedAPIDiscovery(target, scan, workflowResults);
        
      case 'parameter_discovery':
        return await this.executeParameterDiscovery(target, workflowResults);
        
      case 'vulnerability_scan':
        return await this.executeVulnerabilityScan(target, scan);
        
      case 'authentication_testing':
        return await this.executeAuthenticationTesting(target, workflowResults);
        
      case 'authorization_testing':
        return await this.executeAuthorizationTesting(target, workflowResults);
        
      case 'systematic_exploitation':
        return await this.executeSystematicExploitation(target, scan, workflowResults);
        
      case 'business_logic_testing':
        return await this.executeBusinessLogicTesting(target, workflowResults);
        
      case 'privilege_escalation':
        return await this.executePrivilegeEscalation(target, workflowResults);
        
      default:
        throw new Error(`Unknown scan type: ${scanType}`);
    }
  }

  // Individual scan implementations
  async executeSubdomainScan(target, scan) {
    // Use existing subdomain scan from scanService
    const scanService = require('./scanService');
    return await scanService.runSubdomainScan(scan, target);
  }

  async executeLiveHostsScan(target, scan) {
    // Use existing live hosts scan
    const scanService = require('./scanService');
    return await scanService.runLiveHostsScan(scan, target);
  }

  async executeTechnologyDetection(target, workflowResults) {
    // Get subdomains from previous phase
    const subdomains = this.extractSubdomainsFromResults(workflowResults);
    return await technologyDetectionService.detectTechnologies(target, subdomains);
  }

  async executeContentDiscovery(target, scan) {
    // Use enhanced content discovery
    const { runEnhancedContentDiscovery } = require('./contentDiscoveryService');
    return await runEnhancedContentDiscovery(scan, target);
  }

  async executePortScan(target, scan, workflowResults) {
    // Use enhanced port scanning with live hosts context
    const { runEnhancedPortScan } = require('./portScanningService');
    return await runEnhancedPortScan(scan, target);
  }

  async executeJSScan(target, scan) {
    // Use comprehensive JS analysis
    const jsAnalysisService = require('./jsService');
    const updateProgress = async (scanId, percentage) => {
      // Progress update implementation
    };
    return await jsAnalysisService.runJavaScriptSecurityAnalysis(scan, target, updateProgress);
  }

  async executeAdvancedAPIDiscovery(target, scan, workflowResults) {
    // Get subdomains from previous phase
    const subdomains = this.extractSubdomainsFromResults(workflowResults);
    return await advancedAPIService.discoverAndTestAPIs(scan, target, subdomains);
  }

  async executeParameterDiscovery(target, workflowResults) {
    // Extract discovered content and APIs for parameter fuzzing
    const discoveredContent = this.extractDiscoveredContent(workflowResults);
    
    return {
      method: 'Parameter Discovery',
      discovered_parameters: [], // Would implement parameter discovery
      fuzzed_endpoints: discoveredContent.length,
      vulnerable_parameters: [],
      recommendations: ['Implement input validation', 'Use parameterized queries']
    };
  }

  async executeVulnerabilityScan(target, scan) {
    // Use existing vulnerability scan
    const scanService = require('./scanService');
    return await scanService.runVulnerabilityScan(scan, target);
  }

  async executeAuthenticationTesting(target, workflowResults) {
    // Extract authentication endpoints from API discovery
    const apiResults = workflowResults.phases?.phase2_attack_surface?.scan_results?.api_discovery_advanced;
    
    return {
      method: 'Authentication Testing',
      tested_endpoints: apiResults?.authentication_mechanisms?.length || 0,
      bypass_attempts: [],
      weak_implementations: [],
      recommendations: [
        'Implement multi-factor authentication',
        'Use secure session management',
        'Implement proper password policies'
      ]
    };
  }

  async executeAuthorizationTesting(target, workflowResults) {
    return {
      method: 'Authorization Testing',
      tested_endpoints: 0,
      privilege_escalation_attempts: [],
      horizontal_access_violations: [],
      vertical_access_violations: [],
      recommendations: [
        'Implement role-based access control',
        'Validate user permissions on every request',
        'Use principle of least privilege'
      ]
    };
  }

  async executeSystematicExploitation(target, scan, workflowResults) {
    // Consolidate all findings for exploitation
    const consolidatedFindings = this.consolidateFindings(workflowResults.phases);
    return await exploitationService.runSystematicExploitation(scan, target, consolidatedFindings);
  }

  async executeBusinessLogicTesting(target, workflowResults) {
    return {
      method: 'Business Logic Testing',
      tested_workflows: [],
      logic_flaws: [],
      bypass_attempts: [],
      recommendations: [
        'Review business logic implementation',
        'Implement proper workflow validation',
        'Add business rule enforcement'
      ]
    };
  }

  async executePrivilegeEscalation(target, workflowResults) {
    return {
      method: 'Privilege Escalation Testing',
      tested_vectors: [],
      escalation_paths: [],
      successful_escalations: [],
      recommendations: [
        'Review user permission model',
        'Implement proper access controls',
        'Regular privilege auditing'
      ]
    };
  }

  // Helper methods
  checkPhaseDependencies(dependencies, completedPhases) {
    return dependencies.every(dep => completedPhases[dep]);
  }

  extractKeyFindings(scanType, scanResult) {
    switch (scanType) {
      case 'subdomain_scan':
        return {
          total_subdomains: scanResult.total_count || 0,
          alive_subdomains: scanResult.alive_count || 0,
          tools_used: scanResult.tools_used || []
        };
        
      case 'live_hosts_scan':
        return {
          live_hosts: scanResult.live_hosts || 0,
          total_checked: scanResult.total_checked || 0,
          success_rate: scanResult.success_rate || 0
        };
        
      case 'technology_detection':
        return {
          frameworks: scanResult.technologies?.frameworks || [],
          cms: scanResult.technologies?.cms || [],
          security_products: scanResult.security_products || []
        };
        
      case 'port_scan':
        return {
          total_ports: scanResult.total_ports || 0,
          open_ports: scanResult.open_ports || 0,
          scan_targets: scanResult.scan_targets || 0
        };
        
      case 'api_discovery_advanced':
        return {
          rest_apis: scanResult.discovered_apis?.rest_apis?.length || 0,
          graphql_apis: scanResult.discovered_apis?.graphql_apis?.length || 0,
          vulnerabilities: scanResult.api_vulnerabilities?.length || 0
        };
        
      default:
        return scanResult;
    }
  }

  extractSubdomainsFromResults(workflowResults) {
    const recon = workflowResults.phases?.phase1_reconnaissance;
    const liveHosts = recon?.scan_results?.live_hosts_scan;
    
    if (liveHosts?.live_host_details) {
      return liveHosts.live_host_details.map(host => ({
        subdomain: host.subdomain,
        id: host.subdomain_id
      }));
    }
    
    return [];
  }

  extractDiscoveredContent(workflowResults) {
    const recon = workflowResults.phases?.phase1_reconnaissance;
    const content = recon?.scan_results?.content_discovery;
    
    return content?.discovered_content || [];
  }

  consolidateFindings(phases) {
    const consolidated = {
      subdomains: [],
      live_hosts: [],
      open_ports: [],
      discovered_content: [],
      apis: [],
      vulnerabilities: [],
      technologies: {},
      attack_surface: {}
    };

    // Extract and consolidate findings from all phases
    Object.values(phases).forEach(phase => {
      Object.values(phase.scan_results).forEach(result => {
        // Consolidate based on result type
        if (result.subdomains) {
          consolidated.subdomains.push(...result.subdomains);
        }
        if (result.live_host_details) {
          consolidated.live_hosts.push(...result.live_host_details);
        }
        if (result.discovered_ports) {
          consolidated.open_ports.push(...result.discovered_ports);
        }
        if (result.discovered_content) {
          consolidated.discovered_content.push(...result.discovered_content);
        }
        if (result.discovered_apis) {
          Object.values(result.discovered_apis).flat().forEach(api => {
            consolidated.apis.push(api);
          });
        }
        if (result.vulnerabilities_found) {
          consolidated.vulnerabilities.push(...result.vulnerabilities_found);
        }
        if (result.api_vulnerabilities) {
          consolidated.vulnerabilities.push(...result.api_vulnerabilities);
        }
        if (result.technologies) {
          Object.assign(consolidated.technologies, result.technologies);
        }
      });
    });

    return consolidated;
  }

  identifyHighValueTargets(consolidatedFindings) {
    const highValueTargets = [];
    
    // Identify high-value targets based on multiple criteria
    const criteria = [
      {
        name: 'Admin Interfaces',
        check: (item) => item.path?.includes('admin') || item.title?.toLowerCase().includes('admin'),
        priority: 'critical'
      },
      {
        name: 'API Endpoints with Vulnerabilities',
        check: (item) => item.api_vulnerabilities?.length > 0,
        priority: 'high'
      },
      {
        name: 'Exposed Development/Staging',
        check: (item) => item.subdomain?.includes('dev') || item.subdomain?.includes('staging'),
        priority: 'high'
      },
      {
        name: 'Database Interfaces',
        check: (item) => item.path?.includes('phpmyadmin') || item.path?.includes('adminer'),
        priority: 'critical'
      },
      {
        name: 'Authentication Bypass Opportunities',
        check: (item) => item.auth_bypasses_possible?.length > 0,
        priority: 'critical'
      }
    ];

    // Check all findings against criteria
    const allItems = [
      ...consolidatedFindings.live_hosts,
      ...consolidatedFindings.discovered_content,
      ...consolidatedFindings.apis,
      ...consolidatedFindings.vulnerabilities
    ];

    allItems.forEach(item => {
      criteria.forEach(criterion => {
        if (criterion.check(item)) {
          highValueTargets.push({
            target: item,
            reason: criterion.name,
            priority: criterion.priority,
            recommended_action: this.getRecommendedAction(criterion.name)
          });
        }
      });
    });

    return highValueTargets;
  }

  generateAttackChains(consolidatedFindings) {
    const attackChains = [];
    
    // Generate potential attack chains based on findings
    // This is a simplified implementation - would be more sophisticated in practice
    
    if (consolidatedFindings.vulnerabilities.length > 0) {
      const criticalVulns = consolidatedFindings.vulnerabilities.filter(v => v.severity === 'critical');
      
      criticalVulns.forEach(vuln => {
        attackChains.push({
          id: `chain_${attackChains.length + 1}`,
          name: `${vuln.type} Attack Chain`,
          steps: [
            'Initial reconnaissance',
            `Exploit ${vuln.type} vulnerability`,
            'Gain unauthorized access',
            'Privilege escalation',
            'Data exfiltration'
          ],
          entry_point: vuln.endpoint || vuln.url,
          severity: vuln.severity,
          impact: this.calculateAttackImpact(vuln),
          likelihood: this.calculateAttackLikelihood(vuln, consolidatedFindings)
        });
      });
    }

    return attackChains;
  }

  getRecommendedAction(criterionName) {
    const actions = {
      'Admin Interfaces': 'Restrict access to admin interfaces, implement IP whitelisting',
      'API Endpoints with Vulnerabilities': 'Patch API vulnerabilities immediately',
      'Exposed Development/Staging': 'Remove or secure development/staging environments',
      'Database Interfaces': 'Restrict database interface access, implement authentication',
      'Authentication Bypass Opportunities': 'Fix authentication mechanisms immediately'
    };
    
    return actions[criterionName] || 'Review and secure this target';
  }

  calculateAttackImpact(vulnerability) {
    const impactMap = {
      'SQL Injection': 'Data breach, system compromise',
      'XXE': 'Local file disclosure, SSRF',
      'SSRF': 'Internal network access',
      'Authentication Bypass': 'Unauthorized access',
      'IDOR': 'Data exposure'
    };
    
    return impactMap[vulnerability.type] || 'Potential security compromise';
  }

  calculateAttackLikelihood(vulnerability, findings) {
    // Simple likelihood calculation based on various factors
    let score = 0;
    
    if (vulnerability.severity === 'critical') score += 3;
    if (vulnerability.severity === 'high') score += 2;
    if (findings.technologies.security?.length === 0) score += 1; // No security products
    if (findings.live_hosts.length > 10) score += 1; // Large attack surface
    
    const likelihoods = ['Low', 'Medium', 'High', 'Very High'];
    return likelihoods[Math.min(score, 3)];
  }

  generatePhaseRecommendations(phaseKey, phaseResults) {
    const recommendations = [];
    
    switch (phaseKey) {
      case 'phase1_reconnaissance':
        recommendations.push(
          'Minimize exposed subdomains and services',
          'Implement proper subdomain management',
          'Regular monitoring of public-facing assets'
        );
        break;
        
      case 'phase2_attack_surface':
        recommendations.push(
          'Secure all open ports and services',
          'Implement API authentication and rate limiting',
          'Regular security scanning of web applications'
        );
        break;
        
      case 'phase3_vulnerability_assessment':
        recommendations.push(
          'Implement a vulnerability management program',
          'Regular penetration testing',
          'Security code reviews'
        );
        break;
        
      case 'phase4_exploitation':
        recommendations.push(
          'Implement defense in depth',
          'Regular security training for developers',
          'Incident response planning'
        );
        break;
    }
    
    return recommendations;
  }

  generateFinalRecommendations(workflowResults) {
    const recommendations = {
      immediate_actions: [],
      short_term_improvements: [],
      long_term_strategy: [],
      priority_vulnerabilities: []
    };

    // Analyze all findings to generate comprehensive recommendations
    const allVulnerabilities = workflowResults.consolidated_findings.vulnerabilities || [];
    const criticalVulns = allVulnerabilities.filter(v => v.severity === 'critical');
    const highVulns = allVulnerabilities.filter(v => v.severity === 'high');

    // Immediate actions for critical issues
    if (criticalVulns.length > 0) {
      recommendations.immediate_actions.push(
        'Address all critical vulnerabilities within 24 hours',
        'Implement emergency patches for SQL injection and authentication bypasses',
        'Review and lock down admin interfaces'
      );
    }

    // Short-term improvements
    if (highVulns.length > 0) {
      recommendations.short_term_improvements.push(
        'Implement comprehensive input validation',
        'Add security headers to all web applications',
        'Enable rate limiting on all APIs',
        'Conduct security code review'
      );
    }

    // Long-term strategy
    recommendations.long_term_strategy.push(
      'Implement a secure development lifecycle (SDLC)',
      'Regular penetration testing and vulnerability assessments',
      'Security awareness training for development teams',
      'Implement continuous security monitoring'
    );

    // Priority vulnerabilities
    recommendations.priority_vulnerabilities = allVulnerabilities
      .filter(v => v.severity === 'critical' || v.severity === 'high')
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, 10); // Top 10 priority vulnerabilities

    return recommendations;
  }
}

module.exports = new WorkflowOrchestrator();
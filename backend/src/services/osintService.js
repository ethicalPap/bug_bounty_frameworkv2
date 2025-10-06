// backend/src/services/osintService.js
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const cheerio = require('cheerio');

class OSINTService {
  constructor() {
    // OSINT data sources and APIs
    this.dataSources = {
      // Certificate Transparency
      crt_sh: 'https://crt.sh/?q=%DOMAIN%&output=json',
      censys: 'https://search.censys.io/api/v2/certificates/search',
      
      // DNS/Network
      virustotal: 'https://www.virustotal.com/vtapi/v2/domain/report',
      shodan: 'https://api.shodan.io/shodan/host/search',
      
      // Social/Business
      hunter_io: 'https://api.hunter.io/v2/domain-search',
      clearbit: 'https://company.clearbit.com/v1/domains/find',
      
      // Code repositories
      github: 'https://api.github.com/search/repositories',
      gitlab: 'https://gitlab.com/api/v4/projects',
      
      // Dark web/Breach data
      dehashed: 'https://api.dehashed.com/search',
      breach_directory: 'https://breachdirectory.tk/api'
    };

    // Google dork patterns for different types of intelligence
    this.googleDorks = {
      sensitive_files: [
        'site:%DOMAIN% filetype:pdf',
        'site:%DOMAIN% filetype:doc',
        'site:%DOMAIN% filetype:xls',
        'site:%DOMAIN% filetype:txt',
        'site:%DOMAIN% filetype:xml',
        'site:%DOMAIN% filetype:conf',
        'site:%DOMAIN% filetype:env',
        'site:%DOMAIN% filetype:log'
      ],
      admin_panels: [
        'site:%DOMAIN% "admin login"',
        'site:%DOMAIN% "administrator"',
        'site:%DOMAIN% "login" | "sign in"',
        'site:%DOMAIN% inurl:admin',
        'site:%DOMAIN% inurl:wp-admin',
        'site:%DOMAIN% inurl:phpmyadmin'
      ],
      error_pages: [
        'site:%DOMAIN% "error" | "exception"',
        'site:%DOMAIN% "warning" | "mysql_connect"',
        'site:%DOMAIN% "stack trace"',
        'site:%DOMAIN% "debug"'
      ],
      directory_listings: [
        'site:%DOMAIN% "index of"',
        'site:%DOMAIN% "parent directory"',
        'site:%DOMAIN% intitle:"index of"'
      ],
      credentials: [
        'site:%DOMAIN% "password" filetype:txt',
        'site:%DOMAIN% "password" filetype:log',
        'site:%DOMAIN% "username" "password"',
        'site:%DOMAIN% "api key" | "secret"'
      ]
    };

    // Social media platforms for reconnaissance
    this.socialPlatforms = [
      'linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com',
      'github.com', 'gitlab.com', 'stackoverflow.com', 'reddit.com'
    ];
  }

  async gatherComprehensiveIntelligence(target, scan) {
    console.log(`🔍 Gathering comprehensive intelligence for: ${target.domain}`);
    
    const intelligence = {
      target_domain: target.domain,
      intelligence_timestamp: new Date().toISOString(),
      subdomain_intelligence: {},
      email_intelligence: {},
      employee_intelligence: {},
      technology_intelligence: {},
      social_media_intelligence: {},
      breach_intelligence: {},
      google_dorking_results: {},
      third_party_exposure: {},
      historical_data: {},
      threat_intelligence: {},
      recommendations: []
    };

    try {
      // Phase 1: Subdomain Intelligence
      console.log('📋 Phase 1: Subdomain Intelligence Collection');
      intelligence.subdomain_intelligence = await this.gatherSubdomainIntelligence(target);

      // Phase 2: Email & Employee Intelligence
      console.log('👥 Phase 2: Email & Employee Intelligence');
      intelligence.email_intelligence = await this.gatherEmailIntelligence(target);
      intelligence.employee_intelligence = await this.gatherEmployeeIntelligence(target);

      // Phase 3: Technology Intelligence
      console.log('🔧 Phase 3: Technology Stack Intelligence');
      intelligence.technology_intelligence = await this.gatherTechnologyIntelligence(target);

      // Phase 4: Social Media Intelligence
      console.log('📱 Phase 4: Social Media Intelligence');
      intelligence.social_media_intelligence = await this.gatherSocialMediaIntelligence(target);

      // Phase 5: Breach & Credential Intelligence
      console.log('🔐 Phase 5: Breach & Credential Intelligence');
      intelligence.breach_intelligence = await this.gatherBreachIntelligence(target);

      // Phase 6: Google Dorking
      console.log('🔍 Phase 6: Google Dorking Intelligence');
      intelligence.google_dorking_results = await this.performGoogleDorking(target);

      // Phase 7: Third-party Exposure
      console.log('🌐 Phase 7: Third-party Service Exposure');
      intelligence.third_party_exposure = await this.gatherThirdPartyExposure(target);

      // Phase 8: Historical Data Analysis
      console.log('📚 Phase 8: Historical Data Analysis');
      intelligence.historical_data = await this.gatherHistoricalData(target);

      // Phase 9: Threat Intelligence
      console.log('⚠️ Phase 9: Threat Intelligence');
      intelligence.threat_intelligence = await this.gatherThreatIntelligence(target);

      // Generate actionable recommendations
      intelligence.recommendations = this.generateIntelligenceRecommendations(intelligence);

      console.log(`✅ Comprehensive intelligence gathering completed for: ${target.domain}`);
      return intelligence;

    } catch (error) {
      console.error(`❌ Intelligence gathering failed for ${target.domain}:`, error);
      throw new Error(`Intelligence gathering failed: ${error.message}`);
    }
  }

  async gatherSubdomainIntelligence(target) {
    const subdomainIntel = {
      certificate_transparency: [],
      dns_aggregators: [],
      search_engines: [],
      third_party_services: [],
      historical_subdomains: []
    };

    try {
      // Certificate Transparency Logs
      console.log('📜 Gathering certificate transparency data...');
      subdomainIntel.certificate_transparency = await this.queryCertificateTransparency(target.domain);

      // DNS Aggregators
      console.log('🔍 Querying DNS aggregators...');
      subdomainIntel.dns_aggregators = await this.queryDNSAggregators(target.domain);

      // Search Engine Results
      console.log('🔍 Search engine reconnaissance...');
      subdomainIntel.search_engines = await this.searchEngineRecon(target.domain);

      // Third-party Services
      console.log('🌐 Checking third-party services...');
      subdomainIntel.third_party_services = await this.checkThirdPartyServices(target.domain);

    } catch (error) {
      console.error('Subdomain intelligence gathering failed:', error);
    }

    return subdomainIntel;
  }

  async queryCertificateTransparency(domain) {
    const results = [];
    
    try {
      // Query crt.sh
      const crtUrl = this.dataSources.crt_sh.replace('%DOMAIN%', domain);
      const response = await axios.get(crtUrl, { timeout: 15000 });
      
      if (Array.isArray(response.data)) {
        const subdomains = new Set();
        response.data.forEach(cert => {
          if (cert.name_value) {
            cert.name_value.split('\n').forEach(name => {
              if (name.includes(domain) && !name.startsWith('*.')) {
                subdomains.add(name.trim());
              }
            });
          }
        });
        
        results.push({
          source: 'crt.sh',
          subdomains: Array.from(subdomains),
          count: subdomains.size
        });
      }
    } catch (error) {
      console.error('Certificate transparency query failed:', error.message);
    }

    return results;
  }

  async queryDNSAggregators(domain) {
    const results = [];
    
    try {
      // Use various DNS reconnaissance techniques
      const dnsReconSources = [
        { name: 'DNSDumpster', method: 'dnsdumpster' },
        { name: 'Netcraft', method: 'netcraft' },
        { name: 'ThreatCrowd', method: 'threatcrowd' }
      ];

      for (const source of dnsReconSources) {
        try {
          const sourceResults = await this.queryDNSSource(domain, source);
          if (sourceResults.length > 0) {
            results.push({
              source: source.name,
              subdomains: sourceResults,
              count: sourceResults.length
            });
          }
        } catch (sourceError) {
          console.error(`${source.name} query failed:`, sourceError.message);
        }
      }
    } catch (error) {
      console.error('DNS aggregator queries failed:', error.message);
    }

    return results;
  }

  async gatherEmailIntelligence(target) {
    const emailIntel = {
      email_patterns: [],
      discovered_emails: [],
      email_verification: {},
      domain_mx_records: [],
      email_security: {}
    };

    try {
      // Discover email patterns
      console.log('📧 Discovering email patterns...');
      emailIntel.email_patterns = await this.discoverEmailPatterns(target.domain);

      // Find emails from various sources
      console.log('🔍 Searching for email addresses...');
      emailIntel.discovered_emails = await this.searchForEmails(target.domain);

      // Check MX records
      console.log('📮 Analyzing MX records...');
      emailIntel.domain_mx_records = await this.analyzeMXRecords(target.domain);

      // Email security analysis
      console.log('🔒 Analyzing email security...');
      emailIntel.email_security = await this.analyzeEmailSecurity(target.domain);

    } catch (error) {
      console.error('Email intelligence gathering failed:', error);
    }

    return emailIntel;
  }

  async gatherEmployeeIntelligence(target) {
    const employeeIntel = {
      linkedin_employees: [],
      github_developers: [],
      social_media_presence: [],
      job_postings: [],
      organizational_structure: {}
    };

    try {
      // LinkedIn reconnaissance
      console.log('💼 LinkedIn reconnaissance...');
      employeeIntel.linkedin_employees = await this.linkedinReconnaissance(target.domain);

      // GitHub developers
      console.log('💻 GitHub developer search...');
      employeeIntel.github_developers = await this.searchGitHubDevelopers(target.domain);

      // Social media presence
      console.log('📱 Social media reconnaissance...');
      employeeIntel.social_media_presence = await this.socialMediaRecon(target.domain);

      // Job postings analysis
      console.log('💼 Job posting analysis...');
      employeeIntel.job_postings = await this.analyzeJobPostings(target.domain);

    } catch (error) {
      console.error('Employee intelligence gathering failed:', error);
    }

    return employeeIntel;
  }

  async gatherTechnologyIntelligence(target) {
    const techIntel = {
      web_technologies: {},
      cloud_services: [],
      third_party_integrations: [],
      mobile_applications: [],
      infrastructure_analysis: {}
    };

    try {
      // Web technology analysis
      console.log('🔧 Web technology analysis...');
      techIntel.web_technologies = await this.analyzeWebTechnologies(target.domain);

      // Cloud service detection
      console.log('☁️ Cloud service detection...');
      techIntel.cloud_services = await this.detectCloudServices(target.domain);

      // Third-party integrations
      console.log('🔗 Third-party integration analysis...');
      techIntel.third_party_integrations = await this.analyzeThirdPartyIntegrations(target.domain);

      // Mobile application discovery
      console.log('📱 Mobile application discovery...');
      techIntel.mobile_applications = await this.discoverMobileApps(target.domain);

    } catch (error) {
      console.error('Technology intelligence gathering failed:', error);
    }

    return techIntel;
  }

  async gatherSocialMediaIntelligence(target) {
    const socialIntel = {
      official_accounts: [],
      employee_accounts: [],
      mentions: [],
      sentiment_analysis: {},
      leaked_information: []
    };

    try {
      // Find official social media accounts
      console.log('🏢 Finding official social media accounts...');
      socialIntel.official_accounts = await this.findOfficialSocialAccounts(target.domain);

      // Employee social media accounts
      console.log('👥 Employee social media reconnaissance...');
      socialIntel.employee_accounts = await this.findEmployeeSocialAccounts(target.domain);

      // Social media mentions
      console.log('💬 Social media mention analysis...');
      socialIntel.mentions = await this.analyzeSocialMentions(target.domain);

      // Look for leaked information
      console.log('🔍 Searching for leaked information...');
      socialIntel.leaked_information = await this.searchLeakedInformation(target.domain);

    } catch (error) {
      console.error('Social media intelligence gathering failed:', error);
    }

    return socialIntel;
  }

  async gatherBreachIntelligence(target) {
    const breachIntel = {
      known_breaches: [],
      leaked_credentials: [],
      exposed_databases: [],
      paste_sites: [],
      dark_web_mentions: []
    };

    try {
      // Check for known breaches
      console.log('💀 Checking for known data breaches...');
      breachIntel.known_breaches = await this.checkKnownBreaches(target.domain);

      // Search for leaked credentials
      console.log('🔑 Searching for leaked credentials...');
      breachIntel.leaked_credentials = await this.searchLeakedCredentials(target.domain);

      // Check paste sites
      console.log('📋 Checking paste sites...');
      breachIntel.paste_sites = await this.checkPasteSites(target.domain);

      // Dark web monitoring (limited)
      console.log('🕷️ Dark web mention analysis...');
      breachIntel.dark_web_mentions = await this.analyzeDarkWebMentions(target.domain);

    } catch (error) {
      console.error('Breach intelligence gathering failed:', error);
    }

    return breachIntel;
  }

  async performGoogleDorking(target) {
    const dorkingResults = {};

    try {
      for (const [category, dorks] of Object.entries(this.googleDorks)) {
        console.log(`🔍 Google dorking: ${category}...`);
        dorkingResults[category] = [];

        for (const dork of dorks.slice(0, 3)) { // Limit to avoid rate limiting
          try {
            const query = dork.replace('%DOMAIN%', target.domain);
            const results = await this.performGoogleSearch(query);
            
            if (results.length > 0) {
              dorkingResults[category].push({
                query: query,
                results: results,
                count: results.length
              });
            }
          } catch (dorkError) {
            console.error(`Google dork failed for ${dork}:`, dorkError.message);
          }
        }
      }
    } catch (error) {
      console.error('Google dorking failed:', error);
    }

    return dorkingResults;
  }

  async gatherThirdPartyExposure(target) {
    const thirdPartyExposure = {
      code_repositories: [],
      cloud_storage: [],
      cdn_exposure: [],
      saas_platforms: [],
      api_keys_exposure: []
    };

    try {
      // Code repository exposure
      console.log('💻 Checking code repository exposure...');
      thirdPartyExposure.code_repositories = await this.checkCodeRepositoryExposure(target.domain);

      // Cloud storage exposure
      console.log('☁️ Checking cloud storage exposure...');
      thirdPartyExposure.cloud_storage = await this.checkCloudStorageExposure(target.domain);

      // CDN exposure analysis
      console.log('🌐 CDN exposure analysis...');
      thirdPartyExposure.cdn_exposure = await this.analyzeCDNExposure(target.domain);

      // SaaS platform exposure
      console.log('🔧 SaaS platform exposure...');
      thirdPartyExposure.saas_platforms = await this.checkSaaSExposure(target.domain);

    } catch (error) {
      console.error('Third-party exposure analysis failed:', error);
    }

    return thirdPartyExposure;
  }

  async gatherHistoricalData(target) {
    const historicalData = {
      wayback_machine: [],
      dns_history: [],
      whois_history: [],
      ssl_certificate_history: [],
      technology_changes: []
    };

    try {
      // Wayback Machine analysis
      console.log('📚 Wayback Machine analysis...');
      historicalData.wayback_machine = await this.analyzeWaybackMachine(target.domain);

      // DNS history
      console.log('🔍 DNS history analysis...');
      historicalData.dns_history = await this.analyzeDNSHistory(target.domain);

      // WHOIS history
      console.log('📋 WHOIS history analysis...');
      historicalData.whois_history = await this.analyzeWHOISHistory(target.domain);

    } catch (error) {
      console.error('Historical data analysis failed:', error);
    }

    return historicalData;
  }

  async gatherThreatIntelligence(target) {
    const threatIntel = {
      reputation_analysis: {},
      malware_associations: [],
      phishing_reports: [],
      threat_actor_mentions: [],
      vulnerability_reports: []
    };

    try {
      // Domain reputation analysis
      console.log('🛡️ Domain reputation analysis...');
      threatIntel.reputation_analysis = await this.analyzeDomainReputation(target.domain);

      // Malware associations
      console.log('🦠 Malware association check...');
      threatIntel.malware_associations = await this.checkMalwareAssociations(target.domain);

      // Phishing reports
      console.log('🎣 Phishing report check...');
      threatIntel.phishing_reports = await this.checkPhishingReports(target.domain);

    } catch (error) {
      console.error('Threat intelligence gathering failed:', error);
    }

    return threatIntel;
  }

  // Helper methods (simplified implementations)
  async queryDNSSource(domain, source) {
    // Placeholder - would implement actual API calls
    return [];
  }

  async discoverEmailPatterns(domain) {
    // Common email patterns for the domain
    return [
      `firstname.lastname@${domain}`,
      `firstname@${domain}`,
      `f.lastname@${domain}`,
      `firstnamelastname@${domain}`
    ];
  }

  async searchForEmails(domain) {
    // Search for emails in various sources
    return [];
  }

  async analyzeMXRecords(domain) {
    try {
      const { stdout } = await execAsync(`dig +short MX ${domain}`);
      return stdout.split('\n').filter(line => line.trim()).map(line => {
        const parts = line.trim().split(' ');
        return {
          priority: parseInt(parts[0]),
          server: parts[1]
        };
      });
    } catch (error) {
      return [];
    }
  }

  async analyzeEmailSecurity(domain) {
    const security = {
      spf: null,
      dkim: null,
      dmarc: null
    };

    try {
      // Check SPF record
      const { stdout: spf } = await execAsync(`dig +short TXT ${domain} | grep -i spf`);
      security.spf = spf.trim() || null;

      // Check DMARC record
      const { stdout: dmarc } = await execAsync(`dig +short TXT _dmarc.${domain}`);
      security.dmarc = dmarc.trim() || null;
    } catch (error) {
      console.error('Email security analysis failed:', error);
    }

    return security;
  }

  async linkedinReconnaissance(domain) {
    // Placeholder - would use LinkedIn search techniques
    return [];
  }

  async searchGitHubDevelopers(domain) {
    // Search GitHub for developers associated with the domain
    return [];
  }

  async socialMediaRecon(domain) {
    // Social media reconnaissance
    return [];
  }

  async analyzeJobPostings(domain) {
    // Analyze job postings to understand technology stack
    return [];
  }

  async analyzeWebTechnologies(domain) {
    // Technology stack analysis
    return {};
  }

  async detectCloudServices(domain) {
    // Detect cloud service usage
    return [];
  }

  async analyzeThirdPartyIntegrations(domain) {
    // Analyze third-party service integrations
    return [];
  }

  async discoverMobileApps(domain) {
    // Discover mobile applications
    return [];
  }

  async findOfficialSocialAccounts(domain) {
    // Find official social media accounts
    return [];
  }

  async findEmployeeSocialAccounts(domain) {
    // Find employee social media accounts
    return [];
  }

  async analyzeSocialMentions(domain) {
    // Analyze social media mentions
    return [];
  }

  async searchLeakedInformation(domain) {
    // Search for leaked information
    return [];
  }

  async checkKnownBreaches(domain) {
    // Check known data breaches
    return [];
  }

  async searchLeakedCredentials(domain) {
    // Search for leaked credentials
    return [];
  }

  async checkPasteSites(domain) {
    // Check paste sites for domain mentions
    return [];
  }

  async analyzeDarkWebMentions(domain) {
    // Dark web monitoring (limited)
    return [];
  }

  async performGoogleSearch(query) {
    // Perform Google search (would need to implement with proper API)
    return [];
  }

  async checkCodeRepositoryExposure(domain) {
    // Check code repository exposure
    return [];
  }

  async checkCloudStorageExposure(domain) {
    // Check cloud storage exposure
    return [];
  }

  async analyzeCDNExposure(domain) {
    // Analyze CDN exposure
    return [];
  }

  async checkSaaSExposure(domain) {
    // Check SaaS platform exposure
    return [];
  }

  async analyzeWaybackMachine(domain) {
    // Wayback Machine analysis
    return [];
  }

  async analyzeDNSHistory(domain) {
    // DNS history analysis
    return [];
  }

  async analyzeWHOISHistory(domain) {
    // WHOIS history analysis
    return [];
  }

  async analyzeDomainReputation(domain) {
    // Domain reputation analysis
    return {};
  }

  async checkMalwareAssociations(domain) {
    // Check malware associations
    return [];
  }

  async checkPhishingReports(domain) {
    // Check phishing reports
    return [];
  }

  generateIntelligenceRecommendations(intelligence) {
    const recommendations = [];

    // Analyze findings and generate recommendations
    if (intelligence.breach_intelligence.leaked_credentials.length > 0) {
      recommendations.push({
        type: 'Critical Security Issue',
        priority: 'critical',
        recommendation: 'Leaked credentials found - implement immediate password reset and 2FA',
        evidence: 'Credentials discovered in breach databases'
      });
    }

    if (intelligence.google_dorking_results.credentials?.length > 0) {
      recommendations.push({
        type: 'Information Exposure',
        priority: 'high',
        recommendation: 'Sensitive information exposed via search engines',
        evidence: 'Credentials or sensitive files found through Google dorking'
      });
    }

    if (intelligence.third_party_exposure.code_repositories.length > 0) {
      recommendations.push({
        type: 'Code Exposure',
        priority: 'medium',
        recommendation: 'Review and secure code repositories',
        evidence: 'Code repositories found that may contain sensitive information'
      });
    }

    return recommendations;
  }
}

module.exports = new OSINTService();
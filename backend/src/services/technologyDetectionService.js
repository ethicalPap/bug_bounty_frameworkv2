// backend/src/services/technologyDetectionService.js
const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class TechnologyDetectionService {
  constructor() {
    // Technology fingerprints from your checklist
    this.techSignatures = {
      // Web Frameworks
      frameworks: {
        'Laravel': [
          { type: 'header', key: 'set-cookie', value: /laravel_session/i },
          { type: 'html', pattern: /csrf-token.*content="[^"]+"/i },
          { type: 'path', value: '/vendor/laravel/' }
        ],
        'Django': [
          { type: 'header', key: 'server', value: /django/i },
          { type: 'html', pattern: /csrfmiddlewaretoken/i },
          { type: 'error', pattern: /Django.*Debug/i }
        ],
        'Rails': [
          { type: 'header', key: 'x-powered-by', value: /Ruby/i },
          { type: 'html', pattern: /authenticity_token/i },
          { type: 'path', value: '/assets/application-' }
        ],
        'Spring Boot': [
          { type: 'header', key: 'x-application-context', value: /.+/i },
          { type: 'path', value: '/actuator/' },
          { type: 'error', pattern: /Whitelabel Error Page/i }
        ],
        'Express.js': [
          { type: 'header', key: 'x-powered-by', value: /Express/i },
          { type: 'header', key: 'etag', value: /W\//i }
        ]
      },
      
      // Content Management Systems
      cms: {
        'WordPress': [
          { type: 'html', pattern: /wp-content|wp-includes/i },
          { type: 'path', value: '/wp-admin/' },
          { type: 'html', pattern: /name="generator".*WordPress/i }
        ],
        'Joomla': [
          { type: 'html', pattern: /Joomla!/i },
          { type: 'path', value: '/administrator/' },
          { type: 'html', pattern: /name="generator".*Joomla/i }
        ],
        'Drupal': [
          { type: 'html', pattern: /sites\/default\/files/i },
          { type: 'path', value: '/user/login' },
          { type: 'header', key: 'x-drupal-cache', value: /.+/i }
        ]
      },
      
      // Databases & Services (from error messages)
      databases: {
        'MySQL': [
          { type: 'error', pattern: /mysql_fetch_array|MySQL.*error/i }
        ],
        'PostgreSQL': [
          { type: 'error', pattern: /PostgreSQL.*ERROR|pg_connect/i }
        ],
        'MongoDB': [
          { type: 'error', pattern: /MongoError|mongodb:\/\//i }
        ],
        'Redis': [
          { type: 'error', pattern: /redis.*connection|WRONGTYPE.*Redis/i }
        ]
      },
      
      // Security Products
      security: {
        'Cloudflare': [
          { type: 'header', key: 'server', value: /cloudflare/i },
          { type: 'header', key: 'cf-ray', value: /.+/i }
        ],
        'AWS WAF': [
          { type: 'header', key: 'server', value: /awselb/i },
          { type: 'error', pattern: /The request could not be satisfied/i }
        ],
        'Akamai': [
          { type: 'header', key: 'server', value: /AkamaiGHost/i }
        ]
      }
    };
  }

  async detectTechnologies(target, subdomains) {
    console.log(`🔧 Detecting technologies for: ${target.domain}`);
    
    const results = {
      target_domain: target.domain,
      technologies: {},
      subdomain_tech: {},
      security_products: [],
      vulnerabilities: [],
      recommendations: [],
      scan_timestamp: new Date().toISOString()
    };

    // Scan each subdomain for tech stack
    for (const subdomain of subdomains.slice(0, 10)) { // Limit for performance
      try {
        const techStack = await this.scanSubdomainTech(subdomain.subdomain);
        results.subdomain_tech[subdomain.subdomain] = techStack;
        
        // Aggregate technologies
        Object.keys(techStack).forEach(category => {
          if (!results.technologies[category]) {
            results.technologies[category] = new Set();
          }
          techStack[category].forEach(tech => results.technologies[category].add(tech));
        });
        
      } catch (error) {
        console.error(`Failed to scan ${subdomain.subdomain}:`, error.message);
      }
    }

    // Convert Sets to Arrays
    Object.keys(results.technologies).forEach(category => {
      results.technologies[category] = Array.from(results.technologies[category]);
    });

    // Generate security recommendations based on detected tech
    results.recommendations = this.generateSecurityRecommendations(results.technologies);
    
    // Check for known vulnerabilities in detected technologies
    results.vulnerabilities = await this.checkTechVulnerabilities(results.technologies);

    return results;
  }

  async scanSubdomainTech(hostname) {
    const techStack = {
      frameworks: [],
      cms: [],
      databases: [],
      security: [],
      languages: [],
      servers: [],
      cdn: []
    };

    try {
      // Get HTTP response with headers
      const response = await axios.get(`https://${hostname}`, {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TechDetector/1.0)'
        }
      });

      const headers = response.headers;
      const html = response.data;

      // Analyze headers
      this.analyzeHeaders(headers, techStack);
      
      // Analyze HTML content
      if (typeof html === 'string') {
        this.analyzeHTML(html, techStack);
      }

      // Test specific paths for technology detection
      await this.testTechPaths(hostname, techStack);

    } catch (error) {
      console.log(`Technology detection failed for ${hostname}: ${error.message}`);
    }

    return techStack;
  }

  analyzeHeaders(headers, techStack) {
    Object.keys(this.techSignatures).forEach(category => {
      Object.keys(this.techSignatures[category]).forEach(tech => {
        this.techSignatures[category][tech].forEach(signature => {
          if (signature.type === 'header') {
            const headerValue = headers[signature.key];
            if (headerValue && signature.value.test(headerValue)) {
              if (!techStack[category].includes(tech)) {
                techStack[category].push(tech);
              }
            }
          }
        });
      });
    });

    // Extract server information
    if (headers.server) {
      const serverInfo = headers.server.toLowerCase();
      if (serverInfo.includes('nginx')) techStack.servers.push('Nginx');
      if (serverInfo.includes('apache')) techStack.servers.push('Apache');
      if (serverInfo.includes('iis')) techStack.servers.push('IIS');
      if (serverInfo.includes('cloudflare')) techStack.cdn.push('Cloudflare');
    }

    // Extract language information
    if (headers['x-powered-by']) {
      const poweredBy = headers['x-powered-by'].toLowerCase();
      if (poweredBy.includes('php')) techStack.languages.push('PHP');
      if (poweredBy.includes('asp.net')) techStack.languages.push('ASP.NET');
      if (poweredBy.includes('express')) techStack.frameworks.push('Express.js');
    }
  }

  analyzeHTML(html, techStack) {
    const $ = cheerio.load(html);
    
    Object.keys(this.techSignatures).forEach(category => {
      Object.keys(this.techSignatures[category]).forEach(tech => {
        this.techSignatures[category][tech].forEach(signature => {
          if (signature.type === 'html') {
            if (signature.pattern.test(html)) {
              if (!techStack[category].includes(tech)) {
                techStack[category].push(tech);
              }
            }
          }
        });
      });
    });

    // Extract JavaScript frameworks
    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        if (src.includes('react')) techStack.frameworks.push('React');
        if (src.includes('angular')) techStack.frameworks.push('Angular');
        if (src.includes('vue')) techStack.frameworks.push('Vue.js');
        if (src.includes('jquery')) techStack.frameworks.push('jQuery');
      }
    });

    // Check for meta generators
    $('meta[name="generator"]').each((i, elem) => {
      const content = $(elem).attr('content');
      if (content) {
        if (content.includes('WordPress')) techStack.cms.push('WordPress');
        if (content.includes('Joomla')) techStack.cms.push('Joomla');
        if (content.includes('Drupal')) techStack.cms.push('Drupal');
      }
    });
  }

  async testTechPaths(hostname, techStack) {
    const techPaths = [
      { path: '/wp-content/', tech: 'WordPress', category: 'cms' },
      { path: '/admin/', tech: 'Admin Panel', category: 'cms' },
      { path: '/phpmyadmin/', tech: 'phpMyAdmin', category: 'databases' },
      { path: '/solr/', tech: 'Apache Solr', category: 'databases' },
      { path: '/.env', tech: 'Laravel Environment', category: 'frameworks' },
      { path: '/debug/', tech: 'Debug Mode', category: 'security' },
      { path: '/actuator/', tech: 'Spring Boot Actuator', category: 'frameworks' }
    ];

    for (const test of techPaths) {
      try {
        const { stdout } = await execAsync(
          `curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://${hostname}${test.path}"`,
          { timeout: 8000 }
        );
        
        const statusCode = parseInt(stdout.trim());
        if (statusCode === 200 || statusCode === 403) {
          if (!techStack[test.category].includes(test.tech)) {
            techStack[test.category].push(test.tech);
          }
        }
      } catch (error) {
        // Path not accessible, continue
      }
    }
  }

  generateSecurityRecommendations(technologies) {
    const recommendations = [];

    // WordPress specific recommendations
    if (technologies.cms && technologies.cms.includes('WordPress')) {
      recommendations.push({
        type: 'WordPress Security',
        priority: 'high',
        recommendations: [
          'Check for outdated WordPress core, themes, and plugins',
          'Test for wp-config.php exposure',
          'Enumerate users via wp-json/wp/v2/users',
          'Test for XML-RPC abuse',
          'Check for directory listing in wp-content/'
        ]
      });
    }

    // Spring Boot recommendations
    if (technologies.frameworks && technologies.frameworks.includes('Spring Boot')) {
      recommendations.push({
        type: 'Spring Boot Security',
        priority: 'high',
        recommendations: [
          'Check /actuator/ endpoints for information disclosure',
          'Test for Spring Boot actuator exposure',
          'Look for h2-console if H2 database is used',
          'Check for Spring Cloud Config exposure'
        ]
      });
    }

    // Laravel recommendations
    if (technologies.frameworks && technologies.frameworks.includes('Laravel')) {
      recommendations.push({
        type: 'Laravel Security',
        priority: 'medium',
        recommendations: [
          'Check for .env file exposure',
          'Test for debug mode information disclosure',
          'Look for Laravel Telescope in production',
          'Check storage/logs/ directory for sensitive information'
        ]
      });
    }

    return recommendations;
  }

  async checkTechVulnerabilities(technologies) {
    const vulnerabilities = [];

    // This would integrate with CVE databases
    // For now, return common vulnerability patterns based on tech stack
    
    if (technologies.cms && technologies.cms.includes('WordPress')) {
      vulnerabilities.push({
        technology: 'WordPress',
        vulnerability: 'Potential plugin vulnerabilities',
        severity: 'medium',
        description: 'WordPress installations should be regularly updated and audited for vulnerable plugins',
        cve_references: ['CVE-2021-24145', 'CVE-2021-24499'] // Example CVEs
      });
    }

    return vulnerabilities;
  }
}

module.exports = new TechnologyDetectionService();
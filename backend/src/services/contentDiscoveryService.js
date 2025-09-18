// backend/src/services/contentDiscoveryService.js - PASSIVE STEALTH DISCOVERY

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');
const cheerio = require('cheerio');
const ScanJob = require('../models/ScanJob');
const knex = require('../config/database');

// Import models with error handling
let Directory;
try {
  Directory = require('../models/Directory');
  console.log('✅ Directory model loaded for content discovery');
} catch (error) {
  console.warn('⚠️ Directory model not available:', error.message);
}

/**
 * Enhanced Content Discovery using passive techniques
 * NO brute forcing, WAF-friendly, stealth mode
 */
async function runEnhancedContentDiscovery(scan, target) {
  console.log(`🕷️ Running passive content discovery for: ${target.domain}`);
  
  await ScanJob.updateProgress(scan.id, 5);
  
  try {
    // Parse scan config
    const config = typeof scan.config === 'string' ? JSON.parse(scan.config) : scan.config || {};
    const {
      subdomain_id,
      discovery_method = 'comprehensive',
      max_depth = 2,
      request_delay = 500,
      user_agent = 'firefox',
      javascript_execution = true,
      parameter_extraction = 'comprehensive',
      follow_redirects = true,
      passive_mode = true
    } = config;

    console.log('Passive content discovery config:', config);

    // Get targets to scan
    let scanTargets = [];
    
    if (subdomain_id) {
      // Scan specific subdomain
      try {
        const subdomain = await knex('subdomains')
          .where('id', subdomain_id)
          .first();
        
        if (subdomain) {
          scanTargets.push({
            subdomain_id: subdomain.id,
            hostname: subdomain.subdomain,
            base_url: `https://${subdomain.subdomain}`
          });
          console.log(`Scanning specific subdomain: ${subdomain.subdomain}`);
        }
      } catch (error) {
        console.error('Failed to fetch selected subdomain:', error);
      }
    } else {
      // Scan all active subdomains for this target
      try {
        const subdomains = await knex('subdomains')
          .where('target_id', target.id)
          .where('status', 'active')
          .limit(10); // Reasonable limit
        
        scanTargets = subdomains.map(sub => ({
          subdomain_id: sub.id,
          hostname: sub.subdomain,
          base_url: `https://${sub.subdomain}`
        }));
        
        console.log(`Found ${scanTargets.length} active subdomains to scan`);
        
        // If no subdomains, scan root domain
        if (scanTargets.length === 0) {
          scanTargets.push({
            subdomain_id: null,
            hostname: target.domain,
            base_url: `https://${target.domain}`
          });
          console.log(`No subdomains found, scanning root domain: ${target.domain}`);
        }
      } catch (error) {
        console.error('Failed to fetch subdomains:', error);
        scanTargets.push({
          subdomain_id: null,
          hostname: target.domain,
          base_url: `https://${target.domain}`
        });
      }
    }

    if (scanTargets.length === 0) {
      throw new Error('No targets available for content discovery');
    }

    await ScanJob.updateProgress(scan.id, 15);

    let allDiscoveredContent = [];
    let totalProcessed = 0;

    // Process targets sequentially for stealth
    for (const scanTarget of scanTargets) {
      console.log(`🔍 Passive discovery for: ${scanTarget.hostname}`);
      
      let targetContent = [];
      
      // Phase 1: robots.txt analysis
      await ScanJob.updateProgress(scan.id, 20 + (totalProcessed / scanTargets.length) * 15);
      const robotsContent = await analyzeRobotsTxt(scanTarget);
      targetContent = targetContent.concat(robotsContent);
      
      // Phase 2: sitemap.xml analysis
      await ScanJob.updateProgress(scan.id, 25 + (totalProcessed / scanTargets.length) * 15);
      const sitemapContent = await analyzeSitemap(scanTarget);
      targetContent = targetContent.concat(sitemapContent);
      
      // Phase 3: Wayback Machine analysis
      if (discovery_method === 'comprehensive' || discovery_method === 'stealth') {
        await ScanJob.updateProgress(scan.id, 35 + (totalProcessed / scanTargets.length) * 15);
        const waybackContent = await analyzeWaybackMachine(scanTarget);
        targetContent = targetContent.concat(waybackContent);
      }
      
      // Phase 4: JavaScript analysis for endpoints and XSS sinks
      if (javascript_execution && (discovery_method === 'comprehensive' || discovery_method === 'js_analysis')) {
        await ScanJob.updateProgress(scan.id, 50 + (totalProcessed / scanTargets.length) * 15);
        const jsContent = await analyzeJavaScript(scanTarget, parameter_extraction);
        targetContent = targetContent.concat(jsContent);
      }
      
      // Phase 5: ZAP Ajax Spider (if available)
      if (discovery_method === 'comprehensive' || discovery_method === 'spider_only') {
        await ScanJob.updateProgress(scan.id, 65 + (totalProcessed / scanTargets.length) * 15);
        const zapContent = await runZapAjaxSpider(scanTarget, max_depth);
        targetContent = targetContent.concat(zapContent);
      }
      
      // Phase 6: HTML analysis for forms, parameters, AJAX calls
      await ScanJob.updateProgress(scan.id, 75 + (totalProcessed / scanTargets.length) * 10);
      const htmlContent = await analyzeHTMLContent(scanTarget, parameter_extraction);
      targetContent = targetContent.concat(htmlContent);
      
      // Add scan metadata to each discovered item
      targetContent.forEach(item => {
        item.subdomain_id = scanTarget.subdomain_id;
        item.scan_job_id = scan.id;
        item.discovered_at = new Date();
      });
      
      allDiscoveredContent = allDiscoveredContent.concat(targetContent);
      totalProcessed++;
      
      // Stealth delay between targets
      if (totalProcessed < scanTargets.length) {
        await new Promise(resolve => setTimeout(resolve, request_delay));
      }
    }

    console.log(`🎯 Found ${allDiscoveredContent.length} total content items`);

    // Store results in database if Directory model is available
    if (Directory && allDiscoveredContent.length > 0) {
      try {
        const contentRecords = allDiscoveredContent.map(item => ({
          subdomain_id: item.subdomain_id,
          path: item.path,
          url: item.url,
          status_code: item.status_code || null,
          content_length: item.content_length || null,
          response_time: item.response_time || null,
          title: item.title || null,
          headers: item.headers ? JSON.stringify(item.headers) : null,
          body_preview: item.body_preview || null,
          method: item.method || 'GET',
          source: item.source,
          scan_job_id: scan.id,
          content_type: item.content_type || 'endpoint',
          risk_level: item.risk_level || 'low',
          parameters: item.parameters ? item.parameters.join(',') : null,
          notes: item.notes || null
        }));

        console.log(`Storing ${contentRecords.length} content items in database`);
        const createdRecords = await Directory.bulkCreate(contentRecords);
        console.log(`✅ Successfully stored ${createdRecords.length} content items`);
      } catch (dbError) {
        console.error('❌ Failed to store content items:', dbError.message);
      }
    }

    await ScanJob.updateProgress(scan.id, 95);

    const results = {
      discovered_content: allDiscoveredContent,
      total_items: allDiscoveredContent.length,
      endpoints: allDiscoveredContent.filter(c => c.content_type === 'endpoint').length,
      parameters: allDiscoveredContent.filter(c => c.content_type === 'parameter').length,
      xss_sinks: allDiscoveredContent.filter(c => c.content_type === 'xss_sink').length,
      forms: allDiscoveredContent.filter(c => c.content_type === 'form').length,
      ajax_endpoints: allDiscoveredContent.filter(c => c.content_type === 'ajax').length,
      scan_targets: scanTargets.length,
      discovery_methods: [
        'robots.txt analysis',
        'sitemap.xml parsing', 
        javascript_execution ? 'JavaScript analysis' : null,
        discovery_method.includes('wayback') ? 'Wayback Machine' : null,
        discovery_method.includes('spider') ? 'ZAP Ajax Spider' : null,
        'HTML content analysis'
      ].filter(Boolean),
      scan_timestamp: new Date().toISOString(),
      target_domain: target.domain,
      config: config
    };

    console.log(`✅ Passive content discovery completed for ${target.domain}: found ${allDiscoveredContent.length} items using stealth methods`);
    
    await ScanJob.updateProgress(scan.id, 100);
    return results;

  } catch (error) {
    console.error(`❌ Passive content discovery failed for ${target.domain}:`, error);
    throw new Error(`Content discovery failed: ${error.message}`);
  }
}

/**
 * Analyze robots.txt for disallowed paths and endpoints
 */
async function analyzeRobotsTxt(scanTarget) {
  try {
    console.log(`📋 Analyzing robots.txt for ${scanTarget.hostname}`);
    
    const response = await axios.get(`${scanTarget.base_url}/robots.txt`, {
      timeout: 10000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
      }
    });

    if (response.status === 200 && response.data) {
      const content = [];
      const lines = response.data.split('\n');
      
      lines.forEach(line => {
        const disallowMatch = line.match(/^Disallow:\s*(.+)$/i);
        const allowMatch = line.match(/^Allow:\s*(.+)$/i);
        const sitemapMatch = line.match(/^Sitemap:\s*(.+)$/i);
        
        if (disallowMatch) {
          const path = disallowMatch[1].trim();
          if (path && path !== '/' && !path.includes('*')) {
            content.push({
              path: path,
              url: `${scanTarget.base_url}${path}`,
              source: 'robots.txt',
              content_type: 'endpoint',
              risk_level: 'medium',
              notes: 'Disallowed in robots.txt'
            });
          }
        }
        
        if (allowMatch) {
          const path = allowMatch[1].trim();
          if (path && path !== '/') {
            content.push({
              path: path,
              url: `${scanTarget.base_url}${path}`,
              source: 'robots.txt',
              content_type: 'endpoint',
              risk_level: 'low',
              notes: 'Explicitly allowed in robots.txt'
            });
          }
        }
        
        if (sitemapMatch) {
          const sitemapUrl = sitemapMatch[1].trim();
          content.push({
            path: new URL(sitemapUrl).pathname,
            url: sitemapUrl,
            source: 'robots.txt',
            content_type: 'endpoint',
            risk_level: 'low',
            notes: 'Sitemap reference from robots.txt'
          });
        }
      });
      
      console.log(`Found ${content.length} entries from robots.txt`);
      return content;
    }
  } catch (error) {
    console.log(`robots.txt not found or accessible for ${scanTarget.hostname}`);
  }
  
  return [];
}

/**
 * Analyze sitemap.xml for endpoints
 */
async function analyzeSitemap(scanTarget) {
  try {
    console.log(`🗺️ Analyzing sitemap.xml for ${scanTarget.hostname}`);
    
    const sitemapUrls = [
      `${scanTarget.base_url}/sitemap.xml`,
      `${scanTarget.base_url}/sitemap_index.xml`,
      `${scanTarget.base_url}/sitemaps.xml`
    ];
    
    const content = [];
    
    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await axios.get(sitemapUrl, {
          timeout: 10000,
          validateStatus: () => true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
          }
        });

        if (response.status === 200 && response.data) {
          const urlMatches = response.data.match(/<loc>(.*?)<\/loc>/g);
          
          if (urlMatches) {
            urlMatches.forEach(match => {
              const url = match.replace(/<\/?loc>/g, '');
              try {
                const urlObj = new URL(url);
                if (urlObj.hostname === scanTarget.hostname) {
                  content.push({
                    path: urlObj.pathname + urlObj.search,
                    url: url,
                    source: 'sitemap.xml',
                    content_type: 'endpoint',
                    risk_level: 'low',
                    notes: 'Found in sitemap'
                  });
                }
              } catch (urlError) {
                // Invalid URL, skip
              }
            });
          }
          
          break; // Found a working sitemap
        }
      } catch (error) {
        continue; // Try next sitemap URL
      }
    }
    
    console.log(`Found ${content.length} entries from sitemap`);
    return content;
  } catch (error) {
    console.log(`Sitemap not found or accessible for ${scanTarget.hostname}`);
  }
  
  return [];
}

/**
 * Analyze Wayback Machine for historical endpoints
 */
async function analyzeWaybackMachine(scanTarget) {
  try {
    console.log(`🕐 Analyzing Wayback Machine for ${scanTarget.hostname}`);
    
    const waybackUrl = `http://web.archive.org/cdx/search/cdx?url=${scanTarget.hostname}/*&output=json&collapse=urlkey&limit=1000`;
    
    const response = await axios.get(waybackUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
      }
    });

    if (response.status === 200 && response.data) {
      const content = [];
      const data = Array.isArray(response.data) ? response.data : [];
      
      // Skip header row
      data.slice(1).forEach(entry => {
        if (entry.length >= 3) {
          const originalUrl = entry[2];
          try {
            const urlObj = new URL(originalUrl);
            if (urlObj.hostname === scanTarget.hostname) {
              content.push({
                path: urlObj.pathname + urlObj.search,
                url: originalUrl,
                source: 'wayback_machine',
                content_type: 'endpoint',
                risk_level: 'low',
                notes: 'Historical endpoint from Wayback Machine'
              });
            }
          } catch (urlError) {
            // Invalid URL, skip
          }
        }
      });
      
      console.log(`Found ${content.length} historical entries from Wayback Machine`);
      return content;
    }
  } catch (error) {
    console.log(`Wayback Machine analysis failed for ${scanTarget.hostname}: ${error.message}`);
  }
  
  return [];
}

/**
 * Analyze JavaScript files for endpoints and XSS sinks
 */
async function analyzeJavaScript(scanTarget, parameterExtraction) {
  try {
    console.log(`📄 Analyzing JavaScript for ${scanTarget.hostname}`);
    
    const content = [];
    
    // First, get the main page to find JS files
    const response = await axios.get(scanTarget.base_url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.status !== 200) return [];
    
    const $ = cheerio.load(response.data);
    const jsUrls = [];
    
    // Find script tags
    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        try {
          const absoluteUrl = new URL(src, scanTarget.base_url).href;
          jsUrls.push(absoluteUrl);
        } catch (error) {
          // Invalid URL
        }
      }
    });
    
    // Analyze each JS file
    for (const jsUrl of jsUrls.slice(0, 10)) { // Limit to 10 JS files
      try {
        const jsResponse = await axios.get(jsUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (jsResponse.status === 200 && jsResponse.data) {
          const jsContent = jsResponse.data;
          
          // Extract API endpoints
          const apiPatterns = [
            /['"`]\/api\/[^'"`\s]+['"`]/g,
            /['"`]\/v\d+\/[^'"`\s]+['"`]/g,
            /['"`]https?:\/\/[^'"`\s]+\/api\/[^'"`\s]+['"`]/g,
            /fetch\(['"`]([^'"`]+)['"`]\)/g,
            /axios\.[a-z]+\(['"`]([^'"`]+)['"`]/g,
            /\$\.ajax\(\s*\{\s*url:\s*['"`]([^'"`]+)['"`]/g
          ];
          
          apiPatterns.forEach(pattern => {
            const matches = jsContent.match(pattern);
            if (matches) {
              matches.forEach(match => {
                const cleaned = match.replace(/['"`]/g, '').replace(/fetch\(|axios\.[a-z]+\(|\$\.ajax\(\s*\{\s*url:\s*/, '');
                if (cleaned.startsWith('/') || cleaned.includes(scanTarget.hostname)) {
                  const url = cleaned.startsWith('/') ? `${scanTarget.base_url}${cleaned}` : cleaned;
                  content.push({
                    path: new URL(url, scanTarget.base_url).pathname,
                    url: url,
                    source: 'javascript_analysis',
                    content_type: 'ajax',
                    risk_level: 'medium',
                    notes: 'API endpoint found in JavaScript'
                  });
                }
              });
            }
          });
          
          // Extract potential XSS sinks
          const xssSinks = [
            /\.innerHTML\s*=/g,
            /\.outerHTML\s*=/g,
            /document\.write\(/g,
            /document\.writeln\(/g,
            /eval\(/g,
            /Function\(/g,
            /\.insertAdjacentHTML\(/g,
            /\$\([^)]+\)\.html\(/g
          ];
          
          xssSinks.forEach(pattern => {
            if (pattern.test(jsContent)) {
              content.push({
                path: new URL(jsUrl).pathname,
                url: jsUrl,
                source: 'javascript_analysis',
                content_type: 'xss_sink',
                risk_level: 'high',
                notes: 'Potential XSS sink detected in JavaScript'
              });
            }
          });
          
          // Extract parameters from JavaScript
          if (parameterExtraction === 'comprehensive' || parameterExtraction === 'search_params') {
            const paramPatterns = [
              /['"`]([a-zA-Z_][a-zA-Z0-9_]*)\s*[=:]\s*[^'"`\s&]+['"`]/g,
              /\?([a-zA-Z_][a-zA-Z0-9_]*)=/g,
              /&([a-zA-Z_][a-zA-Z0-9_]*)=/g
            ];
            
            paramPatterns.forEach(pattern => {
              const matches = jsContent.match(pattern);
              if (matches) {
                matches.forEach(match => {
                  const paramMatch = match.match(/([a-zA-Z_][a-zA-Z0-9_]*)/);
                  if (paramMatch) {
                    content.push({
                      path: `?${paramMatch[1]}=`,
                      url: `${scanTarget.base_url}?${paramMatch[1]}=value`,
                      source: 'javascript_analysis',
                      content_type: 'parameter',
                      risk_level: 'low',
                      parameters: [paramMatch[1]],
                      notes: 'Parameter found in JavaScript'
                    });
                  }
                });
              }
            });
          }
        }
      } catch (jsError) {
        console.log(`Failed to analyze JS file ${jsUrl}: ${jsError.message}`);
      }
    }
    
    console.log(`Found ${content.length} items from JavaScript analysis`);
    return content;
  } catch (error) {
    console.log(`JavaScript analysis failed for ${scanTarget.hostname}: ${error.message}`);
  }
  
  return [];
}

/**
 * Run ZAP Ajax Spider for dynamic content discovery
 */
async function runZapAjaxSpider(scanTarget, maxDepth) {
  try {
    console.log(`🕸️ Attempting ZAP Ajax Spider for ${scanTarget.hostname}`);
    
    // Check if ZAP is available
    try {
      await execAsync('which zap-cli', { timeout: 5000 });
    } catch (error) {
      console.log('ZAP not available, skipping Ajax Spider');
      return [];
    }
    
    const content = [];
    
    // Start ZAP daemon
    const zapPort = 8080 + Math.floor(Math.random() * 1000);
    
    try {
      // Start ZAP in daemon mode
      const zapStart = `zap-cli start --start-options '-daemon -port ${zapPort}' &`;
      await execAsync(zapStart, { timeout: 30000 });
      
      // Wait for ZAP to start
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Run Ajax Spider
      const spiderCmd = `zap-cli -p ${zapPort} ajax-spider ${scanTarget.base_url} --max-duration 2`;
      await execAsync(spiderCmd, { timeout: 120000 });
      
      // Get results
      const resultsCmd = `zap-cli -p ${zapPort} report -o json`;
      const { stdout: results } = await execAsync(resultsCmd, { timeout: 30000 });
      
      if (results) {
        const zapResults = JSON.parse(results);
        
        if (zapResults.site && zapResults.site[0] && zapResults.site[0].alerts) {
          zapResults.site[0].alerts.forEach(alert => {
            if (alert.instances) {
              alert.instances.forEach(instance => {
                if (instance.uri) {
                  try {
                    const urlObj = new URL(instance.uri);
                    content.push({
                      path: urlObj.pathname + urlObj.search,
                      url: instance.uri,
                      source: 'zap_spider',
                      content_type: 'endpoint',
                      risk_level: alert.riskdesc?.toLowerCase() || 'low',
                      notes: `ZAP Spider: ${alert.name || 'Dynamic endpoint'}`
                    });
                  } catch (urlError) {
                    // Invalid URL
                  }
                }
              });
            }
          });
        }
      }
      
      // Stop ZAP
      await execAsync(`zap-cli -p ${zapPort} shutdown`, { timeout: 10000 });
      
    } catch (zapError) {
      console.log(`ZAP Ajax Spider failed: ${zapError.message}`);
    }
    
    console.log(`Found ${content.length} items from ZAP Ajax Spider`);
    return content;
  } catch (error) {
    console.log(`ZAP Ajax Spider not available for ${scanTarget.hostname}`);
  }
  
  return [];
}

/**
 * Analyze HTML content for forms, parameters, and AJAX calls
 */
async function analyzeHTMLContent(scanTarget, parameterExtraction) {
  try {
    console.log(`🌐 Analyzing HTML content for ${scanTarget.hostname}`);
    
    const content = [];
    
    const response = await axios.get(scanTarget.base_url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.status !== 200) return [];
    
    const $ = cheerio.load(response.data);
    
    // Analyze forms
    $('form').each((i, form) => {
      const $form = $(form);
      const action = $form.attr('action') || '';
      const method = $form.attr('method') || 'GET';
      
      const formUrl = action.startsWith('/') ? 
        `${scanTarget.base_url}${action}` : 
        new URL(action || '', scanTarget.base_url).href;
      
      const inputs = [];
      $form.find('input, select, textarea').each((j, input) => {
        const name = $(input).attr('name');
        if (name) inputs.push(name);
      });
      
      content.push({
        path: new URL(formUrl).pathname,
        url: formUrl,
        source: 'form_analysis',
        content_type: 'form',
        method: method.toUpperCase(),
        risk_level: inputs.some(inp => ['password', 'email', 'username'].includes(inp.toLowerCase())) ? 'medium' : 'low',
        parameters: inputs,
        notes: `Form with ${inputs.length} inputs`
      });
    });
    
    // Extract links
    $('a[href]').each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        content.push({
          path: href,
          url: `${scanTarget.base_url}${href}`,
          source: 'link_extraction',
          content_type: 'endpoint',
          risk_level: 'low',
          notes: 'Link found in HTML'
        });
      }
    });
    
    // Look for AJAX calls in inline scripts
    $('script:not([src])').each((i, script) => {
      const scriptContent = $(script).html();
      if (scriptContent) {
        const ajaxPatterns = [
          /fetch\(['"`]([^'"`]+)['"`]\)/g,
          /\$\.get\(['"`]([^'"`]+)['"`]/g,
          /\$\.post\(['"`]([^'"`]+)['"`]/g,
          /axios\.[a-z]+\(['"`]([^'"`]+)['"`]/g
        ];
        
        ajaxPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(scriptContent)) !== null) {
            const url = match[1];
            if (url.startsWith('/') || url.includes(scanTarget.hostname)) {
              const fullUrl = url.startsWith('/') ? `${scanTarget.base_url}${url}` : url;
              content.push({
                path: new URL(fullUrl, scanTarget.base_url).pathname,
                url: fullUrl,
                source: 'ajax_discovery',
                content_type: 'ajax',
                risk_level: 'medium',
                notes: 'AJAX call found in inline script'
              });
            }
          }
        });
      }
    });
    
    console.log(`Found ${content.length} items from HTML analysis`);
    return content;
  } catch (error) {
    console.log(`HTML analysis failed for ${scanTarget.hostname}: ${error.message}`);
  }
  
  return [];
}

module.exports = {
  runEnhancedContentDiscovery,
  analyzeRobotsTxt,
  analyzeSitemap,
  analyzeWaybackMachine,
  analyzeJavaScript,
  runZapAjaxSpider,
  analyzeHTMLContent
};
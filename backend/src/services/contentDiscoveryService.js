// backend/src/services/contentDiscoveryService.js - FIXED VERSION

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
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
      try {
        const subdomains = await knex('subdomains')
          .where('target_id', target.id)
          .where('status', 'active')
          .limit(10);
        
        scanTargets = subdomains.map(sub => ({
          subdomain_id: sub.id,
          hostname: sub.subdomain,
          base_url: `https://${sub.subdomain}`
        }));
        
        console.log(`Found ${scanTargets.length} active subdomains to scan`);
        
        if (scanTargets.length === 0) {
          // Create a subdomain record for the root domain if none exists
          const rootSubdomainId = await ensureRootSubdomain(target);
          
          scanTargets.push({
            subdomain_id: rootSubdomainId,
            hostname: target.domain,
            base_url: `https://${target.domain}`
          });
          console.log(`No subdomains found, created root domain entry: ${target.domain}`);
        }
      } catch (error) {
        console.error('Failed to fetch subdomains:', error);
        
        // Create a subdomain record for the root domain as fallback
        const rootSubdomainId = await ensureRootSubdomain(target);
        
        scanTargets.push({
          subdomain_id: rootSubdomainId,
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
      
      // Phase 5: HTML analysis for forms, parameters, AJAX calls
      await ScanJob.updateProgress(scan.id, 75 + (totalProcessed / scanTargets.length) * 10);
      const htmlContent = await analyzeHTMLContent(scanTarget, parameter_extraction);
      targetContent = targetContent.concat(htmlContent);
      
      // Add scan metadata to each discovered item
      targetContent.forEach(item => {
        item.subdomain_id = scanTarget.subdomain_id; // This is now guaranteed to be non-null
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
          subdomain_id: item.subdomain_id, // Now guaranteed to be non-null
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
 * Ensure a subdomain record exists for the root domain
 * Returns the subdomain_id for the root domain
 */
async function ensureRootSubdomain(target) {
  try {
    // Check if root domain subdomain already exists
    let rootSubdomain = await knex('subdomains')
      .where('target_id', target.id)
      .where('subdomain', target.domain)
      .first();
    
    if (!rootSubdomain) {
      // Create root domain subdomain record
      console.log(`Creating root subdomain record for: ${target.domain}`);
      
      const [newSubdomain] = await knex('subdomains')
        .insert({
          target_id: target.id,
          subdomain: target.domain,
          status: 'active',
          first_discovered: new Date(),
          last_seen: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');
      
      rootSubdomain = newSubdomain;
      console.log(`✅ Created root subdomain record with ID: ${rootSubdomain.id}`);
    }
    
    return rootSubdomain.id;
  } catch (error) {
    console.error('Failed to ensure root subdomain:', error);
    throw new Error(`Cannot create root subdomain: ${error.message}`);
  }
}

/**
 * Analyze robots.txt for disallowed paths and endpoints
 */
async function analyzeRobotsTxt(scanTarget) {
  try {
    console.log(`📋 Analyzing robots.txt for ${scanTarget.hostname}`);
    
    const response = await fetch(`${scanTarget.base_url}/robots.txt`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
      }
    });

    if (response.ok) {
      const data = await response.text();
      const content = [];
      const lines = data.split('\n');
      
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
        const response = await fetch(sitemapUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
          }
        });

        if (response.ok) {
          const data = await response.text();
          const urlMatches = data.match(/<loc>(.*?)<\/loc>/g);
          
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
    
    const response = await fetch(waybackUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const content = [];
      
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
    const response = await fetch(scanTarget.base_url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return [];
    
    const html = await response.text();
    const $ = cheerio.load(html);
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
        const jsResponse = await fetch(jsUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (jsResponse.ok) {
          const jsContent = await jsResponse.text();
          
          // Extract API endpoints
          const apiPatterns = [
            /['"`]\/api\/[^'"`\s]+['"`]/g,
            /['"`]\/v\d+\/[^'"`\s]+['"`]/g,
            /['"`]https?:\/\/[^'"`\s]+\/api\/[^'"`\s]+['"`]/g,
            /fetch\(['"`]([^'"`]+)['"`]\)/g
          ];
          
          apiPatterns.forEach(pattern => {
            const matches = jsContent.match(pattern);
            if (matches) {
              matches.forEach(match => {
                const cleaned = match.replace(/['"`]/g, '').replace(/fetch\(/, '');
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
            /eval\(/g
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
 * Analyze HTML content for forms, parameters, and AJAX calls
 * Optionally fetch HTTP status codes for discovered links
 */
async function analyzeHTMLContent(scanTarget, parameterExtraction) {
  try {
    console.log(`🌐 Analyzing HTML content for ${scanTarget.hostname}`);
    
    const content = [];
    
    const response = await fetch(scanTarget.base_url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return [];
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
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
    
    // Extract links (limit to reasonable number for passive discovery)
    const discoveredLinks = [];
    $('a[href]').each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        discoveredLinks.push({
          path: href,
          url: `${scanTarget.base_url}${href}`,
          source: 'link_extraction',
          content_type: 'endpoint',
          risk_level: 'low',
          notes: 'Link found in HTML'
        });
      }
    });
    
    // Limit the number of links to avoid overwhelming the scan
    const limitedLinks = discoveredLinks.slice(0, 50);
    content.push(...limitedLinks);
    
    // Optional: Quick HTTP check for a few important links (limit to avoid being too aggressive)
    const importantLinks = limitedLinks.filter(link => 
      link.path.includes('admin') || 
      link.path.includes('api') || 
      link.path.includes('login') ||
      link.path.includes('config')
    ).slice(0, 5); // Only check 5 important links
    
    for (const link of importantLinks) {
      try {
        const linkResponse = await fetch(link.url, {
          method: 'HEAD', // Use HEAD request to avoid downloading full content
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
          }
        });
        
        // Update the link with status code
        link.status_code = linkResponse.status;
        link.notes += ` (HTTP ${linkResponse.status})`;
        
      } catch (linkError) {
        // Don't fail the scan if we can't check individual links
        console.log(`Could not check status for ${link.url}: ${linkError.message}`);
      }
    }
    
    console.log(`Found ${content.length} items from HTML analysis (${importantLinks.length} with status codes)`);
    return content;
  } catch (error) {
    console.log(`HTML analysis failed for ${scanTarget.hostname}: ${error.message}`);
  }
  
  return [];
}

module.exports = {
  runEnhancedContentDiscovery,
  ensureRootSubdomain,
  analyzeRobotsTxt,
  analyzeSitemap,
  analyzeWaybackMachine,
  analyzeJavaScript,
  analyzeHTMLContent
};
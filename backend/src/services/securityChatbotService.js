// backend/src/services/securityChatbotService.js - PURE OFFENSIVE VERSION
const axios = require('axios');

class SecurityChatbotService {
  constructor() {
    this.aiProvider = process.env.AI_PROVIDER || 'local';
    this.apiKey = process.env.AI_API_KEY;
    this.ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://ollama:11434';
    this.model = process.env.SECURITY_AI_MODEL || 'codellama:13b-instruct';
    this.conversationHistory = new Map();
    this.maxHistoryLength = 4;
    this.modelCheckCache = null;
    this.lastCheckTime = 0;
    // Force fallback mode for now since AI keeps giving defensive advice
    this.forceOffensiveMode = true;
  }

  async analyzeFindings(organizationId, findingsContext, userMessage, userId) {
    try {
      console.log(`🤖 Processing security analysis with AI provider: ${this.aiProvider}`);
      
      const sanitizedContext = this.sanitizeFindingsData(findingsContext);
      const context = await this.buildComprehensiveSecurityContext(organizationId, sanitizedContext);
      
      let aiResponse;
      
      // TEMPORARY: Force fallback mode since AI models keep giving defensive advice
      if (this.forceOffensiveMode || this.aiProvider !== 'local') {
        console.log('🎯 Using pure offensive fallback responses');
        aiResponse = this.getPureOffensiveAdvice(userMessage, context);
      } else {
        try {
          aiResponse = await this.getLocalAIResponse(context, userMessage, userId);
        } catch (aiError) {
          console.warn(`AI failed, using fallback: ${aiError.message}`);
          aiResponse = this.getPureOffensiveAdvice(userMessage, context);
        }
      }
      
      this.updateConversationHistory(userId, userMessage, aiResponse);
      await this.logInteraction(organizationId, userId, userMessage, 'offensive_hunter');
      
      return {
        success: true,
        response: aiResponse,
        provider: 'offensive_hunter',
        model: 'bug_bounty_specialist',
        cost: 0,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Security chatbot analysis failed:', error);
      return {
        success: true,
        response: this.getPureOffensiveAdvice(userMessage, findingsContext),
        provider: 'offensive_hunter',
        cost: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  async buildComprehensiveSecurityContext(organizationId, frontendContext) {
    const context = {
      organization_id: organizationId,
      targets: [],
      subdomains: [],
      vulnerabilities: [],
      summary: {
        total_targets: 0,
        total_subdomains: 0,
        live_subdomains: 0,
        total_vulnerabilities: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0
      }
    };
    
    try {
      const knex = require('../config/database');
      
      const targets = await knex('targets')
        .where('organization_id', organizationId)
        .select('*');
      
      context.targets = targets;
      context.summary.total_targets = targets.length;
      
      if (targets.length > 0) {
        const targetIds = targets.map(t => t.id);
        
        const subdomains = await knex('subdomains')
          .whereIn('target_id', targetIds)
          .select('*');
        
        context.subdomains = subdomains;
        context.summary.total_subdomains = subdomains.length;
        context.summary.live_subdomains = subdomains.filter(s => s.status === 'active').length;
        
        const vulnerabilities = await knex('vulnerabilities')
          .whereIn('target_id', targetIds)
          .select('*');
        
        context.vulnerabilities = vulnerabilities;
        context.summary.total_vulnerabilities = vulnerabilities.length;
        context.summary.critical_count = vulnerabilities.filter(v => v.severity === 'critical').length;
        context.summary.high_count = vulnerabilities.filter(v => v.severity === 'high').length;
        context.summary.medium_count = vulnerabilities.filter(v => v.severity === 'medium').length;
        context.summary.low_count = vulnerabilities.filter(v => v.severity === 'low').length;
      }
      
    } catch (dbError) {
      console.warn('Database context building failed:', dbError.message);
    }
    
    return context;
  }

  getPureOffensiveAdvice(userMessage, context) {
    const message = userMessage.toLowerCase();
    const summary = context.summary || {};
    const subdomains = context.subdomains || [];
    const liveHosts = subdomains.filter(s => s.status === 'active');
    
    // Identify high-value targets
    const apiEndpoints = liveHosts.filter(s => 
      s.subdomain.includes('api') || s.subdomain.includes('rest') || s.subdomain.includes('graphql')
    );
    const adminPanels = liveHosts.filter(s => 
      s.subdomain.includes('admin') || s.subdomain.includes('manage') || s.subdomain.includes('panel')
    );
    const devEnvs = liveHosts.filter(s => 
      s.subdomain.includes('dev') || s.subdomain.includes('stage') || s.subdomain.includes('test') || s.subdomain.includes('beta')
    );
    const glideApps = liveHosts.filter(s => s.subdomain.includes('glide'));
    
    console.log(`🎯 Live hosts: ${liveHosts.length}, APIs: ${apiEndpoints.length}, Admin: ${adminPanels.length}, Dev: ${devEnvs.length}`);

    if (message.includes('start testing') || message.includes('how to start') || message.includes('what should') || message.includes('next')) {
      
      // Handle your specific case - compass.com with API and Glide endpoints
      if (apiEndpoints.length > 0) {
        const targetAPI = apiEndpoints[0].subdomain;
        return `**HIGH-VALUE TARGET IDENTIFIED: ${targetAPI}**

**Immediate attack vectors:**

1. **IDOR Testing on API:**
\`\`\`bash
# Find API endpoints first
ffuf -w /usr/share/seclists/Discovery/Web-Content/api/api-endpoints.txt \\
     -u https://${targetAPI}/FUZZ -mc 200,201,202,403

# Test object ID manipulation  
# Look for patterns like /api/users/123, /api/orders/456
curl -H "Authorization: Bearer TOKEN" https://${targetAPI}/users/1
curl -H "Authorization: Bearer TOKEN" https://${targetAPI}/users/2
\`\`\`

2. **SQLi Testing:**
\`\`\`bash
sqlmap -u "https://${targetAPI}/login" --data="user=test&pass=test" --batch --dbs
\`\`\`

3. **JWT Manipulation:**
- Intercept requests in Burp
- Check for JWT tokens in Authorization headers
- Try algorithm confusion attacks at jwt.io

4. **GraphQL Testing (if present):**
\`\`\`bash
curl -X POST https://${targetAPI}/graphql \\
  -H "Content-Type: application/json" \\
  -d '{"query":"query{__schema{types{name}}}"}'
\`\`\`

**Priority: Start with IDOR testing - APIs are goldmines for this.**`;
      }
      
      if (glideApps.length > 0) {
        const targetGlide = glideApps[0].subdomain;
        return `**GLIDE APP DETECTED: ${targetGlide}**

**Glide-specific attack vectors:**

1. **Glide Database Exposure:**
\`\`\`bash
# Check for exposed Glide sheets/data
curl -s "https://${targetGlide}/" | grep -i "glide\|sheet\|airtable"

# Look for API endpoints
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \\
     -u https://${targetGlide}/FUZZ -fs 0
\`\`\`

2. **Authentication Bypass:**
\`\`\`bash
# Try bypassing auth with common Glide paths
curl -s "https://${targetGlide}/api/tables"
curl -s "https://${targetGlide}/api/data"
curl -s "https://${targetGlide}/.well-known/manifest.json"
\`\`\`

3. **Data Enumeration:**
- Glide apps often expose underlying data structures
- Look for user data, internal records
- Check for CSV export functions

4. **Parameter Testing:**
\`\`\`bash
arjun -u https://${targetGlide} -m GET POST
\`\`\`

**Glide apps frequently have weak access controls - check for data exposure first.**`;
      }
      
      if (liveHosts.length > 0 && apiEndpoints.length === 0) {
        const firstHost = liveHosts[0].subdomain;
        return `**START WITH HOST: ${firstHost}**

**Essential first steps:**

1. **Directory Bruteforcing:**
\`\`\`bash
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \\
     -u https://${firstHost}/FUZZ -mc 200,301,302,403 -fs 0

# Also try:
gobuster dir -u https://${firstHost} -w /usr/share/wordlists/dirb/common.txt
\`\`\`

2. **Technology Stack Detection:**
\`\`\`bash
whatweb ${firstHost}
curl -I https://${firstHost}
\`\`\`

3. **Parameter Discovery:**
\`\`\`bash
arjun -u https://${firstHost} -m GET -t 20
\`\`\`

4. **Common Files Check:**
\`\`\`bash
curl -s https://${firstHost}/robots.txt
curl -s https://${firstHost}/sitemap.xml  
curl -s https://${firstHost}/.git/config
curl -s https://${firstHost}/.env
\`\`\`

5. **Subdomain Takeover Check:**
\`\`\`bash
subjack -w subdomains.txt -t 100 -timeout 30 -o takeover.txt
\`\`\`

**Focus on directory brute forcing first - find the attack surface.**`;
      }
      
      return `**No live hosts found yet!**

**Essential recon steps:**

1. **Aggressive Subdomain Enumeration:**
\`\`\`bash
# Multiple tools for maximum coverage
subfinder -d compass.com | tee subs.txt
amass enum -d compass.com >> subs.txt  
assetfinder compass.com >> subs.txt

# Remove duplicates and check live
cat subs.txt | sort -u | httpx -probe > live_hosts.txt
\`\`\`

2. **DNS Brute Force:**
\`\`\`bash
dnsrecon -d compass.com -t brt -D /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt
\`\`\`

3. **Certificate Transparency:**
\`\`\`bash
curl -s "https://crt.sh/?q=%25.compass.com&output=json" | jq -r '.[].name_value' | sort -u
\`\`\`

**Get your attack surface mapped before testing individual hosts.**`;
    }
    
    if (message.includes('analyze') || message.includes('found')) {
      let analysis = `**ATTACK SURFACE ANALYSIS:**

Target: compass.com  
- Total subdomains: ${summary.total_subdomains}
- Live hosts: ${summary.live_subdomains}
- High-value targets: ${apiEndpoints.length} APIs, ${adminPanels.length} admin panels, ${devEnvs.length} dev envs, ${glideApps.length} Glide apps

`;

      if (apiEndpoints.length > 0) {
        analysis += `**CRITICAL: API Endpoints Found**
${apiEndpoints.slice(0, 3).map(s => `- ${s.subdomain} → IDOR, SQLi, Auth bypass testing`).join('\n')}

`;
      }

      if (glideApps.length > 0) {
        analysis += `**HIGH-VALUE: Glide Apps**
${glideApps.slice(0, 2).map(s => `- ${s.subdomain} → Data exposure, auth bypass`).join('\n')}

`;
      }

      if (adminPanels.length > 0) {
        analysis += `**ADMIN PANELS:**
${adminPanels.slice(0, 2).map(s => `- ${s.subdomain} → Default creds, brute force`).join('\n')}

`;
      }

      analysis += `**IMMEDIATE ACTIONS:**
1. ${apiEndpoints.length > 0 ? 'IDOR testing on APIs (highest priority)' : 'Directory bruteforcing on live hosts'}
2. ${glideApps.length > 0 ? 'Glide app data enumeration' : 'Parameter fuzzing'}
3. Authentication testing on forms
4. File inclusion/traversal testing
5. Input validation testing

**Most likely to find bugs: ${apiEndpoints.length > 0 ? 'API endpoints' : liveHosts.length > 0 ? 'Web applications' : 'Need more recon'}**`;

      return analysis;
    }
    
    if (message.includes('tools') || message.includes('commands') || message.includes('how to test')) {
      return `**BUG BOUNTY TESTING ARSENAL:**

**Discovery & Recon:**
\`\`\`bash
# Subdomain enumeration
subfinder -d target.com | httpx -probe

# Directory brute forcing  
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt -u https://target.com/FUZZ

# Parameter discovery
arjun -u https://target.com -m GET POST -t 20
\`\`\`

**Vulnerability Testing:**
\`\`\`bash
# SQL injection
sqlmap -u "https://target.com/login" --data="user=1&pass=1" --batch

# XSS testing
XSStrike -u https://target.com/?param=test

# IDOR testing
# Manual: Change IDs in requests
curl https://api.target.com/users/1 vs /users/2

# Directory traversal
ffuf -w /usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt -u https://target.com/file?f=FUZZ
\`\`\`

**Manual Testing Checklist:**
- [ ] Test all forms for SQLi/XSS
- [ ] Check for IDOR in all ID parameters  
- [ ] Try default credentials on login forms
- [ ] Test file upload functionality
- [ ] Check for CSRF tokens
- [ ] Test API authentication bypass
- [ ] Look for information disclosure

**Your current targets: ${liveHosts.length} live hosts ready for testing.**`;
    }
    
    // Specific guidance based on their actual data
    const currentTargets = liveHosts.slice(0, 3).map(s => s.subdomain).join(', ');
    
    return `**COMPASS.COM BUG BOUNTY STATUS:**

**Live targets ready for testing:** ${summary.live_subdomains}/${summary.total_subdomains}
**High-value assets:** ${apiEndpoints.length + adminPanels.length + glideApps.length} critical targets found

**Next testing commands:**
\`\`\`bash
# Quick wins on your best targets
${liveHosts.length > 0 ? `ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt -u https://${liveHosts[0].subdomain}/FUZZ` : 'Need to find live hosts first'}

${apiEndpoints.length > 0 ? `# Test your API endpoint
arjun -u https://${apiEndpoints[0].subdomain} -m GET POST` : ''}

${glideApps.length > 0 ? `# Check Glide app for data exposure  
curl -s https://${glideApps[0].subdomain}/api/tables` : ''}
\`\`\`

**Most promising targets:** ${currentTargets || 'Run subdomain enumeration first'}

What specific host do you want to attack?`;
  }

  // Enhanced filter for defensive advice
  isDefensiveAdvice(text) {
    const defensivePatterns = [
      /implement/i, /patch/i, /update/i, /secure/i, /harden/i, /protect/i,
      /prevent/i, /mitigate/i, /defend/i, /monitor/i, /audit/i, /compliance/i,
      /encrypt/i, /firewall/i, /2fa/i, /two.factor/i, /backup/i, /recovery/i,
      /IT department/i, /security team/i, /administrator/i, /network admin/i,
      /security policy/i, /access control/i, /authentication mechanism/i,
      /security measure/i, /preventive/i, /protective/i, /safeguard/i
    ];
    
    return defensivePatterns.some(pattern => pattern.test(text));
  }

  async getLocalAIResponse(context, userMessage, userId) {
    try {
      const isAvailable = await this.checkOllamaAvailabilityWithRetry();
      if (!isAvailable) {
        throw new Error('Model not available after retries');
      }
      
      const conversation = this.getConversationHistory(userId);
      const contextSummary = this.buildOffensiveContext(context);
      
      const systemPrompt = `You are a bug bounty hunter. Give ONLY offensive testing commands and techniques. 

NEVER EVER suggest:
- Implementing anything
- Patching
- Monitoring
- Security audits  
- Contacting IT
- Defensive measures

ONLY suggest:
- Specific commands to run
- Tools like ffuf, sqlmap, Burp
- Testing techniques
- Exploitation methods

TARGET DATA:
${contextSummary}

USER: ${userMessage}

Respond with specific commands and testing techniques only:`;

      const response = await axios.post(`${this.ollamaEndpoint}/api/generate`, {
        model: this.model,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.6,
          top_k: 15,
          num_predict: 80,
          repeat_penalty: 1.3
        }
      }, {
        timeout: 20000
      });
      
      const aiResponse = response.data.response.trim();
      
      // Aggressive filtering
      if (this.isDefensiveAdvice(aiResponse)) {
        console.warn('AI gave defensive advice, using offensive fallback');
        throw new Error('AI gave defensive advice instead of offensive techniques');
      }
      
      return aiResponse;
      
    } catch (error) {
      console.error('AI request failed:', error.message);
      throw error;
    }
  }

  buildOffensiveContext(context) {
    const { summary, subdomains } = context;
    
    let contextText = `Attack Surface: ${summary.total_subdomains} subdomains (${summary.live_subdomains} live)\n`;
    
    if (subdomains.length > 0) {
      const liveHosts = subdomains.filter(s => s.status === 'active').slice(0, 5);
      contextText += `Live Targets: ${liveHosts.map(s => s.subdomain).join(', ')}\n`;
      
      const apis = liveHosts.filter(s => s.subdomain.includes('api'));
      if (apis.length > 0) {
        contextText += `API Endpoints: ${apis.map(s => s.subdomain).join(', ')}\n`;
      }
    }

    return contextText;
  }

  // ... [Keep all existing utility methods]

  sanitizeFindingsData(findings) {
    const sanitized = JSON.parse(JSON.stringify(findings));
    
    const sensitivePatterns = [
      { pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, replacement: 'X.X.X.X' },
      { pattern: /https?:\/\/[^\s/$.?#].[^\s]*/gi, replacement: 'https://example.com' },
      { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: 'user@example.com' },
      { pattern: /\b[A-Za-z0-9]{32,}\b/g, replacement: '[API_KEY_REDACTED]' }
    ];
    
    function sanitizeRecursively(obj) {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          let sanitizedValue = value;
          sensitivePatterns.forEach(({ pattern, replacement }) => {
            sanitizedValue = sanitizedValue.replace(pattern, replacement);
          });
          obj[key] = sanitizedValue;
        } else if (typeof value === 'object' && value !== null) {
          sanitizeRecursively(value);
        }
      }
    }
    
    sanitizeRecursively(sanitized);
    return sanitized;
  }

  async checkOllamaAvailabilityWithRetry(maxRetries = 3) {
    const now = Date.now();
    if (this.modelCheckCache && (now - this.lastCheckTime) < 60000) {
      return this.modelCheckCache;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const healthResponse = await axios.get(`${this.ollamaEndpoint}/api/tags`, {
          timeout: 5000
        });
        
        const models = healthResponse.data.models || [];
        const modelAvailable = models.some(model => 
          model.name.includes('mistral') ||
          model.name.includes('codellama') ||
          model.name.includes('tinyllama') ||
          model.name.includes('phi3')
        );
        
        if (!modelAvailable) {
          throw new Error(`No suitable model found. Available: ${models.map(m => m.name).join(', ')}`);
        }
        
        this.modelCheckCache = true;
        this.lastCheckTime = now;
        return true;
        
      } catch (error) {
        if (attempt < maxRetries) {
          const delay = attempt * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.modelCheckCache = false;
    this.lastCheckTime = now;
    return false;
  }

  async checkOllamaAvailability() {
    return this.checkOllamaAvailabilityWithRetry(1);
  }

  getConversationHistory(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  updateConversationHistory(userId, userMessage, aiResponse) {
    let history = this.conversationHistory.get(userId) || [];
    
    history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    );
    
    if (history.length > this.maxHistoryLength * 2) {
      history = history.slice(-this.maxHistoryLength * 2);
    }
    
    this.conversationHistory.set(userId, history);
  }

  async logInteraction(organizationId, userId, userMessage, provider) {
    try {
      console.log(`Chatbot interaction: User ${userId}, Provider: ${provider}`);
    } catch (error) {
      console.warn('Interaction logging failed:', error.message);
    }
  }

  async setupLocalAI() {
    try {
      const isAvailable = await this.checkOllamaAvailabilityWithRetry();
      if (isAvailable) {
        console.log('✅ Local AI is ready to use!');
        return true;
      } else {
        console.log('❌ Setup needed: Models not available');
        return false;
      }
    } catch (error) {
      console.log(`❌ Setup failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = new SecurityChatbotService();
// backend/src/services/securityChatbotService.js - CLEAN VERSION (SERVICE ONLY)
const axios = require('axios');

class SecurityChatbotService {
  constructor() {
    this.aiProvider = process.env.AI_PROVIDER || 'local';
    this.apiKey = process.env.AI_API_KEY;
    this.ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    this.model = process.env.SECURITY_AI_MODEL || 'codellama:7b-instruct';
    this.conversationHistory = new Map();
    this.maxHistoryLength = 8;
  }

  async analyzeFindings(organizationId, findingsContext, userMessage, userId) {
    try {
      console.log(`🤖 Processing security analysis with AI provider: ${this.aiProvider}`);
      
      const sanitizedContext = this.sanitizeFindingsData(findingsContext);
      const context = await this.buildSecurityContext(organizationId, sanitizedContext);
      
      let aiResponse;
      if (this.aiProvider === 'local') {
        aiResponse = await this.getLocalAIResponse(context, userMessage, userId);
      } else {
        aiResponse = this.getIntelligentFallback(userMessage, findingsContext);
      }
      
      this.updateConversationHistory(userId, userMessage, aiResponse);
      await this.logInteraction(organizationId, userId, userMessage, this.aiProvider);
      
      return {
        success: true,
        response: aiResponse,
        provider: this.aiProvider,
        model: this.aiProvider === 'local' ? this.model : 'fallback_rules',
        cost: 0,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Security chatbot analysis failed:', error);
      return {
        success: true,
        response: this.getIntelligentFallback(userMessage, findingsContext),
        provider: 'fallback_rules',
        cost: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

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

  async buildSecurityContext(organizationId, findings) {
    const context = {
      findings: findings,
      summary: {
        total_vulnerabilities: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0
      }
    };
    
    try {
      if (findings.vulnerabilities && Array.isArray(findings.vulnerabilities)) {
        context.summary.total_vulnerabilities = findings.vulnerabilities.length;
        context.summary.critical_count = findings.vulnerabilities.filter(v => v.severity === 'critical').length;
        context.summary.high_count = findings.vulnerabilities.filter(v => v.severity === 'high').length;
        context.summary.medium_count = findings.vulnerabilities.filter(v => v.severity === 'medium').length;
        context.summary.low_count = findings.vulnerabilities.filter(v => v.severity === 'low').length;
      }
      
      // Database context building (optional - might not have knex available)
      try {
        const knex = require('../config/database');
        const recentScans = await knex('scan_jobs')
          .where('organization_id', organizationId)
          .where('created_at', '>=', knex.raw("NOW() - INTERVAL '24 hours'"))
          .count('* as count')
          .first();
          
        context.recent_activity = {
          scans_last_24h: parseInt(recentScans?.count || 0)
        };
      } catch (dbError) {
        console.warn('Could not build database context:', dbError.message);
      }
      
    } catch (error) {
      console.warn('Context building partially failed:', error.message);
    }
    
    return context;
  }

  async getLocalAIResponse(context, userMessage, userId) {
    try {
      await this.checkOllamaAvailability();
      
      const conversation = this.getConversationHistory(userId);
      
      const systemPrompt = `You are an expert cybersecurity analyst and penetration tester. You help analyze security findings and provide actionable guidance.

CURRENT SECURITY CONTEXT:
${JSON.stringify(context, null, 2)}

CONVERSATION HISTORY:
${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

GUIDELINES:
- Be precise and technical but accessible
- Focus on business impact and risk prioritization
- Suggest specific tools and methodologies when relevant
- Provide step-by-step guidance for complex issues
- Reference OWASP standards when applicable
- Keep responses concise but comprehensive (under 500 words)
- If asked about next steps, provide a prioritized action list

USER QUESTION: ${userMessage}

EXPERT RESPONSE:`;

      console.log(`🤖 Sending request to local AI model: ${this.model}`);
      
      const response = await axios.post(`${this.ollamaEndpoint}/api/generate`, {
        model: this.model,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_predict: 500
        }
      }, {
        timeout: 60000
      });
      
      const aiResponse = response.data.response.trim();
      console.log(`✅ Local AI response generated (${aiResponse.length} chars)`);
      
      return aiResponse;
      
    } catch (error) {
      console.error('Local AI request failed:', error.message);
      throw error;
    }
  }

  async checkOllamaAvailability() {
    try {
      const healthResponse = await axios.get(`${this.ollamaEndpoint}/api/tags`, {
        timeout: 5000
      });
      
      const models = healthResponse.data.models || [];
      const modelAvailable = models.some(model => model.name.includes(this.model.split(':')[0]));
      
      if (!modelAvailable) {
        throw new Error(`Model ${this.model} not found. Please run: ollama pull ${this.model}`);
      }
      
      console.log(`✅ Ollama available with model: ${this.model}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Ollama not available: ${error.message}`);
      throw new Error('Local AI not available. Please ensure Ollama is installed and running.');
    }
  }

  getIntelligentFallback(userMessage, findings) {
    const message = userMessage.toLowerCase();
    const vulnCount = findings?.vulnerabilities?.length || 0;
    const criticalCount = findings?.vulnerabilities?.filter(v => v.severity === 'critical').length || 0;
    const highCount = findings?.vulnerabilities?.filter(v => v.severity === 'high').length || 0;
    
    if (message.includes('analyze') || message.includes('what') && message.includes('found')) {
      if (vulnCount === 0) {
        return `No vulnerabilities detected in current scan results. Consider:

🔍 **Next Steps:**
1. Run additional scan types (subdomain enumeration, port scanning)
2. Perform manual testing of discovered endpoints  
3. Check for business logic vulnerabilities
4. Review authentication and authorization mechanisms

The absence of automated findings doesn't mean the target is secure - manual testing often reveals critical issues.`;
      }
      
      return `**Analysis Summary:**

📊 **Findings Overview:**
- Total vulnerabilities: ${vulnCount}
- Critical: ${criticalCount} | High: ${highCount}
- Risk level: ${criticalCount > 0 ? 'CRITICAL' : highCount > 0 ? 'HIGH' : 'MEDIUM'}

🎯 **Immediate Priorities:**
${criticalCount > 0 ? '1. Address critical vulnerabilities first - these pose immediate risk\n' : ''}
${highCount > 0 ? `${criticalCount > 0 ? '2' : '1'}. Review high-severity findings for exploitation potential\n` : ''}
${criticalCount + highCount > 0 ? `${criticalCount + highCount > 1 ? '3' : '2'}. Document findings with proof-of-concept\n` : '1. Document current findings\n'}

💡 **Recommendation:** Focus on ${criticalCount > 0 ? 'critical' : 'high-severity'} vulnerabilities as they typically have the highest business impact.`;
    }
    
    if (message.includes('prioritize') || message.includes('priority')) {
      return `**Risk-Based Prioritization Framework:**

🔴 **Critical Priority (Fix Immediately):**
- SQL Injection, RCE, Authentication Bypass
- Anything allowing system compromise

🟠 **High Priority (Fix This Week):**  
- XSS, CSRF, Privilege Escalation
- Sensitive data exposure

🟡 **Medium Priority (Fix This Month):**
- Information disclosure, weak configurations
- Missing security headers

🟢 **Low Priority (Fix When Possible):**
- Informational findings, minor misconfigurations

**Your current findings:** ${criticalCount} critical, ${highCount} high priority issues detected.`;
    }
    
    return `I'm here to help with security analysis! I can assist with:

🔍 **Analysis:** "Analyze my findings" - Get risk assessment and impact analysis
📊 **Prioritization:** "Help prioritize these vulnerabilities" - Risk-based ordering  
➡️ **Next Steps:** "What should I test next?" - Methodology guidance
🛠️ **Remediation:** "How do I fix this?" - Specific remediation steps
📄 **Reporting:** "Help write a report" - Professional documentation

**Current Status:** ${vulnCount > 0 ? `${vulnCount} vulnerabilities found (${criticalCount} critical, ${highCount} high)` : 'No vulnerabilities detected yet'}

What would you like help with?`;
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
      // Optional: Log to database if you want analytics
      console.log(`Chatbot interaction: User ${userId}, Provider: ${provider}`);
    } catch (error) {
      console.warn('Interaction logging failed:', error.message);
    }
  }

  async setupLocalAI() {
    try {
      await this.checkOllamaAvailability();
      console.log('✅ Local AI is ready to use!');
      return true;
    } catch (error) {
      console.log(`❌ Setup needed: ${error.message}`);
      return false;
    }
  }
}

module.exports = new SecurityChatbotService();
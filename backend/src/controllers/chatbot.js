// backend/src/controllers/chatbot.js
const knex = require('../config/database');

class AISecurityAssistant {
  constructor() {
    // Initialize with security knowledge base
    this.securityKnowledgeBase = {
      vulnerabilities: {
        'sql injection': {
          severity: 'critical',
          description: 'SQL injection allows attackers to execute malicious SQL statements',
          exploitation: 'Test with payloads like \' OR 1=1-- and UNION SELECT',
          remediation: 'Use parameterized queries and input validation',
          owasp_category: 'A03:2021 – Injection'
        },
        'xss': {
          severity: 'high',
          description: 'Cross-site scripting allows execution of malicious scripts',
          exploitation: 'Test with <script>alert(1)</script> and DOM manipulation',
          remediation: 'Implement proper output encoding and CSP headers',
          owasp_category: 'A07:2021 – Identification and Authentication Failures'
        },
        'idor': {
          severity: 'high',
          description: 'Insecure Direct Object References allow unauthorized access',
          exploitation: 'Manipulate ID parameters to access other users\' data',
          remediation: 'Implement proper authorization checks',
          owasp_category: 'A01:2021 – Broken Access Control'
        },
        'ssrf': {
          severity: 'high',
          description: 'Server-Side Request Forgery allows internal network access',
          exploitation: 'Use URLs like http://169.254.169.254/latest/meta-data/',
          remediation: 'Validate and whitelist allowed destinations',
          owasp_category: 'A10:2021 – Server-Side Request Forgery'
        }
      },

      techniques: {
        'subdomain enumeration': {
          tools: ['subfinder', 'amass', 'assetfinder'],
          techniques: ['DNS brute force', 'Certificate transparency', 'Search engine dorking'],
          passive_methods: ['VirusTotal', 'crt.sh', 'DNSdumpster']
        },
        'directory brute forcing': {
          tools: ['gobuster', 'ffuf', 'dirb'],
          wordlists: ['common.txt', 'directory-list-2.3-medium.txt'],
          techniques: ['Recursive scanning', 'Extension fuzzing', 'Status code analysis']
        },
        'parameter discovery': {
          tools: ['param-miner', 'arjun', 'ffuf'],
          techniques: ['GET parameter fuzzing', 'POST parameter discovery', 'JSON parameter testing'],
          sources: ['JavaScript analysis', 'HTML form parsing', 'API documentation']
        }
      },

      payloads: {
        sql_injection: [
          "' OR '1'='1",
          "1' AND 1=1--",
          "' UNION SELECT null,null,null--",
          "1'; DROP TABLE users--",
          "' OR 1=1#"
        ],
        xss: [
          '<script>alert(1)</script>',
          '<img src="x" onerror="alert(1)">',
          '<svg onload="alert(1)">',
          'javascript:alert(1)',
          '"><script>alert(String.fromCharCode(88,83,83))</script>'
        ],
        lfi: [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
          '....//....//....//etc/passwd',
          'php://filter/convert.base64-encode/resource=index.php'
        ]
      },

      methodologies: {
        'bug bounty workflow': [
          '1. Reconnaissance - Gather information about the target',
          '2. Asset Discovery - Find subdomains, ports, and services',
          '3. Technology Detection - Identify frameworks and versions',
          '4. Attack Surface Analysis - Map entry points and endpoints',
          '5. Vulnerability Assessment - Test for security flaws',
          '6. Exploitation - Prove impact and develop proof-of-concepts',
          '7. Documentation - Write comprehensive reports',
          '8. Submission - Submit findings to bug bounty platforms'
        ],
        'web application testing': [
          'Authentication and Session Management',
          'Input Validation Testing',
          'Error Handling',
          'Cryptography',
          'Business Logic Testing',
          'Client Side Testing',
          'Configuration and Deployment Management Testing'
        ]
      }
    };

    this.conversationHistory = new Map();
  }

  async chatWithBot(req, res) {
    try {
      const { message, conversation_id, context } = req.body;
      const { user } = req;

      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'Message is required'
        });
      }

      // Get or create conversation
      const conversationId = conversation_id || `conv_${Date.now()}_${user.id}`;
      
      // Analyze the message and generate response
      const botResponse = await this.generateSecurityResponse(message, conversationId, context, user);

      // Store conversation in database
      await this.storeChatMessage(conversationId, user.id, message, botResponse.message);

      res.json({
        success: true,
        data: {
          conversation_id: conversationId,
          bot_response: botResponse,
          suggestions: this.generateSuggestions(message, context),
          related_resources: this.getRelatedResources(message)
        }
      });

    } catch (error) {
      console.error('Chatbot error:', error);
      res.status(500).json({
        success: false,
        message: 'AI assistant temporarily unavailable',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async generateSecurityResponse(message, conversationId, context, user) {
    const lowerMessage = message.toLowerCase();
    
    // Get conversation history for context
    const history = this.conversationHistory.get(conversationId) || [];
    
    let response = {
      message: '',
      type: 'text',
      confidence: 0.8,
      sources: [],
      actionable_items: [],
      code_examples: [],
      related_vulnerabilities: []
    };

    try {
      // Analyze message intent and generate appropriate response
      if (this.isVulnerabilityQuestion(lowerMessage)) {
        response = await this.handleVulnerabilityQuestion(lowerMessage, context);
      } else if (this.isToolQuestion(lowerMessage)) {
        response = await this.handleToolQuestion(lowerMessage, context);
      } else if (this.isMethodologyQuestion(lowerMessage)) {
        response = await this.handleMethodologyQuestion(lowerMessage, context);
      } else if (this.isExploitationQuestion(lowerMessage)) {
        response = await this.handleExploitationQuestion(lowerMessage, context);
      } else if (this.isReportQuestion(lowerMessage)) {
        response = await this.handleReportQuestion(lowerMessage, context, user);
      } else if (this.isSpecificTargetQuestion(lowerMessage, context)) {
        response = await this.handleTargetSpecificQuestion(lowerMessage, context, user);
      } else {
        response = await this.handleGeneralSecurityQuestion(lowerMessage, context);
      }

      // Update conversation history
      history.push({ user: message, bot: response.message, timestamp: new Date() });
      this.conversationHistory.set(conversationId, history.slice(-10)); // Keep last 10 exchanges

      return response;

    } catch (error) {
      console.error('Error generating security response:', error);
      return {
        message: 'I apologize, but I encountered an error processing your question. Please try rephrasing your question or ask about specific security topics like vulnerabilities, tools, or methodologies.',
        type: 'error',
        confidence: 0.1
      };
    }
  }

  async handleVulnerabilityQuestion(message, context) {
    const vulnType = this.detectVulnerabilityType(message);
    
    if (vulnType && this.securityKnowledgeBase.vulnerabilities[vulnType]) {
      const vuln = this.securityKnowledgeBase.vulnerabilities[vulnType];
      
      return {
        message: `**${vulnType.toUpperCase()} Vulnerability**\n\n` +
                `**Description:** ${vuln.description}\n\n` +
                `**Severity:** ${vuln.severity}\n\n` +
                `**OWASP Category:** ${vuln.owasp_category}\n\n` +
                `**Exploitation Techniques:**\n${vuln.exploitation}\n\n` +
                `**Remediation:**\n${vuln.remediation}`,
        type: 'vulnerability_info',
        confidence: 0.95,
        actionable_items: [
          `Test for ${vulnType} vulnerabilities`,
          'Implement recommended remediation',
          'Verify fix effectiveness'
        ],
        code_examples: this.getCodeExamples(vulnType),
        related_vulnerabilities: this.getRelatedVulnerabilities(vulnType)
      };
    }

    return {
      message: 'I can help you with information about common vulnerabilities like SQL injection, XSS, IDOR, SSRF, XXE, and more. What specific vulnerability would you like to learn about?',
      type: 'text',
      confidence: 0.7,
      actionable_items: ['Ask about a specific vulnerability type']
    };
  }

  async handleToolQuestion(message, context) {
    if (message.includes('subdomain') || message.includes('enumeration')) {
      const tools = this.securityKnowledgeBase.techniques['subdomain enumeration'];
      
      return {
        message: `**Subdomain Enumeration Tools & Techniques**\n\n` +
                `**Recommended Tools:**\n${tools.tools.map(t => `• ${t}`).join('\n')}\n\n` +
                `**Techniques:**\n${tools.techniques.map(t => `• ${t}`).join('\n')}\n\n` +
                `**Passive Methods:**\n${tools.passive_methods.map(t => `• ${t}`).join('\n')}`,
        type: 'tool_recommendation',
        confidence: 0.9,
        actionable_items: [
          'Install and configure recommended tools',
          'Start with passive reconnaissance',
          'Use multiple tools for comprehensive coverage'
        ],
        code_examples: [
          'subfinder -d target.com -all -silent',
          'amass enum -d target.com',
          'assetfinder target.com'
        ]
      };
    }

    if (message.includes('directory') || message.includes('brute force')) {
      const tools = this.securityKnowledgeBase.techniques['directory brute forcing'];
      
      return {
        message: `**Directory Brute Forcing Tools**\n\n` +
                `**Tools:** ${tools.tools.join(', ')}\n\n` +
                `**Techniques:** ${tools.techniques.join(', ')}\n\n` +
                `**Wordlists:** ${tools.wordlists.join(', ')}`,
        type: 'tool_recommendation',
        confidence: 0.9,
        code_examples: [
          'gobuster dir -u https://target.com -w /usr/share/wordlists/dirb/common.txt',
          'ffuf -w wordlist.txt -u https://target.com/FUZZ'
        ]
      };
    }

    return {
      message: 'I can recommend tools for various security testing activities like subdomain enumeration, directory brute forcing, parameter discovery, vulnerability scanning, and more. What specific testing activity do you need tools for?',
      type: 'text',
      confidence: 0.6
    };
  }

  async handleMethodologyQuestion(message, context) {
    if (message.includes('bug bounty') || message.includes('workflow')) {
      const workflow = this.securityKnowledgeBase.methodologies['bug bounty workflow'];
      
      return {
        message: `**Bug Bounty Testing Methodology**\n\n` +
                workflow.map(step => `${step}`).join('\n\n'),
        type: 'methodology',
        confidence: 0.95,
        actionable_items: [
          'Follow systematic approach',
          'Document all findings',
          'Verify vulnerabilities before reporting',
          'Provide clear proof-of-concepts'
        ]
      };
    }

    if (message.includes('web app') || message.includes('application testing')) {
      const testing = this.securityKnowledgeBase.methodologies['web application testing'];
      
      return {
        message: `**Web Application Testing Areas**\n\n` +
                testing.map(area => `• ${area}`).join('\n'),
        type: 'methodology',
        confidence: 0.9
      };
    }

    return {
      message: 'I can guide you through various security testing methodologies including bug bounty workflows, web application testing, API security testing, and more. What specific methodology would you like to learn about?',
      type: 'text',
      confidence: 0.6
    };
  }

  async handleExploitationQuestion(message, context) {
    const vulnType = this.detectVulnerabilityType(message);
    
    if (vulnType && this.securityKnowledgeBase.payloads[vulnType]) {
      const payloads = this.securityKnowledgeBase.payloads[vulnType];
      
      return {
        message: `**${vulnType.toUpperCase()} Exploitation Payloads**\n\n` +
                `**Common Payloads:**\n${payloads.map(p => `\`${p}\``).join('\n')}\n\n` +
                `**⚠️ Important:** Only use these payloads on systems you own or have explicit permission to test.`,
        type: 'exploitation',
        confidence: 0.9,
        actionable_items: [
          'Test payloads in a controlled environment first',
          'Modify payloads based on application context',
          'Document successful exploitation attempts',
          'Ensure you have proper authorization'
        ],
        code_examples: payloads.slice(0, 3) // Show first 3 examples
      };
    }

    return {
      message: 'I can provide exploitation guidance for various vulnerability types including SQL injection, XSS, LFI, and more. Please specify which vulnerability you\'d like exploitation help with.\n\n**⚠️ Remember:** Only test on systems you own or have explicit permission to test.',
      type: 'text',
      confidence: 0.7
    };
  }

  async handleReportQuestion(message, context, user) {
    if (message.includes('write') || message.includes('report') || message.includes('document')) {
      return {
        message: `**Bug Bounty Report Writing Guide**\n\n` +
                `**Essential Report Sections:**\n` +
                `• **Title:** Clear, descriptive vulnerability title\n` +
                `• **Summary:** Brief overview of the issue\n` +
                `• **Description:** Detailed explanation of the vulnerability\n` +
                `• **Steps to Reproduce:** Clear, numbered steps\n` +
                `• **Proof of Concept:** Screenshots, code, or video\n` +
                `• **Impact:** Business and technical impact\n` +
                `• **Remediation:** Suggested fixes\n\n` +
                `**Writing Tips:**\n` +
                `• Be clear and concise\n` +
                `• Provide complete reproduction steps\n` +
                `• Include visual evidence\n` +
                `• Explain the business impact\n` +
                `• Be professional and respectful`,
        type: 'guidance',
        confidence: 0.95,
        actionable_items: [
          'Use our built-in report templates',
          'Include comprehensive proof-of-concept',
          'Test reproduction steps before submitting',
          'Review report for clarity and completeness'
        ]
      };
    }

    return {
      message: 'I can help you with report writing, documentation best practices, and submission guidelines for bug bounty platforms. What specific aspect of reporting would you like help with?',
      type: 'text',
      confidence: 0.6
    };
  }

  async handleTargetSpecificQuestion(message, context, user) {
    if (context && context.target_id) {
      try {
        // Get target information and recent scan results
        const target = await knex('targets')
          .where('id', context.target_id)
          .where('organization_id', user.organization_id)
          .first();

        if (!target) {
          return {
            message: 'I don\'t have access to that target information.',
            type: 'error',
            confidence: 0.3
          };
        }

        // Get recent vulnerabilities for this target
        const recentVulns = await knex('vulnerabilities')
          .where('target_id', context.target_id)
          .orderBy('created_at', 'desc')
          .limit(5)
          .select('title', 'severity', 'status', 'created_at');

        let response = `**Analysis for ${target.domain}**\n\n`;
        
        if (message.includes('vulnerabilities') || message.includes('findings')) {
          if (recentVulns.length > 0) {
            response += `**Recent Vulnerabilities Found:**\n`;
            recentVulns.forEach(vuln => {
              response += `• **${vuln.title}** (${vuln.severity}) - ${vuln.status}\n`;
            });
            response += `\n**Recommendations:**\n`;
            response += `• Prioritize fixing ${recentVulns.filter(v => v.severity === 'critical').length} critical vulnerabilities\n`;
            response += `• Review high-severity findings for quick wins\n`;
            response += `• Implement systematic remediation process`;
          } else {
            response += `No recent vulnerabilities found for this target. Consider running a comprehensive assessment.`;
          }
        } else if (message.includes('next steps') || message.includes('recommend')) {
          response += `**Recommended Next Steps:**\n`;
          response += `• Run comprehensive bug bounty assessment\n`;
          response += `• Focus on API endpoint discovery\n`;
          response += `• Test for authentication bypasses\n`;
          response += `• Perform business logic testing\n`;
          response += `• Generate detailed security report`;
        }

        return {
          message: response,
          type: 'target_analysis',
          confidence: 0.85,
          actionable_items: [
            'Run targeted vulnerability scan',
            'Focus on recent finding types',
            'Generate updated security report'
          ]
        };

      } catch (error) {
        console.error('Error handling target-specific question:', error);
        return {
          message: 'I encountered an error analyzing the target information. Please try again.',
          type: 'error',
          confidence: 0.2
        };
      }
    }

    return {
      message: 'I can provide target-specific analysis and recommendations when you\'re viewing a specific target. Navigate to a target to get customized advice.',
      type: 'text',
      confidence: 0.5
    };
  }

  async handleGeneralSecurityQuestion(message, context) {
    // Handle general security questions with AI-like responses
    const responses = {
      getting_started: `**Getting Started with Bug Bounty Hunting**\n\n` +
                     `1. **Learn the Basics:** Understand common vulnerabilities (OWASP Top 10)\n` +
                     `2. **Set up Tools:** Install essential tools like Burp Suite, OWASP ZAP\n` +
                     `3. **Practice:** Use platforms like PortSwigger Web Security Academy\n` +
                     `4. **Choose Targets:** Start with programs that welcome new hunters\n` +
                     `5. **Be Patient:** Quality over quantity - one good finding is better than many duplicates`,
      
      best_practices: `**Bug Bounty Best Practices**\n\n` +
                     `• Always read and follow the scope and rules\n` +
                     `• Test thoroughly but don't be destructive\n` +
                     `• Document everything meticulously\n` +
                     `• Communicate professionally with security teams\n` +
                     `• Continuously learn and adapt your methodology`,
      
      default: `I'm here to help with your security testing and bug bounty hunting! I can assist with:\n\n` +
              `• **Vulnerability Research:** XSS, SQLi, IDOR, SSRF, and more\n` +
              `• **Tool Recommendations:** Best tools for specific testing scenarios\n` +
              `• **Methodology Guidance:** Step-by-step testing approaches\n` +
              `• **Report Writing:** How to document and present findings\n` +
              `• **Target Analysis:** Specific advice for your current targets\n\n` +
              `What would you like to know about?`
    };

    if (message.includes('start') || message.includes('begin') || message.includes('new')) {
      return {
        message: responses.getting_started,
        type: 'guidance',
        confidence: 0.8,
        actionable_items: [
          'Complete OWASP Top 10 training',
          'Set up your testing environment',
          'Practice on legal targets'
        ]
      };
    }

    if (message.includes('best practice') || message.includes('tips')) {
      return {
        message: responses.best_practices,
        type: 'guidance',
        confidence: 0.85
      };
    }

    return {
      message: responses.default,
      type: 'text',
      confidence: 0.6
    };
  }

  // Helper methods
  isVulnerabilityQuestion(message) {
    const vulnKeywords = ['sql', 'xss', 'idor', 'ssrf', 'xxe', 'csrf', 'lfi', 'rfi', 'injection', 'vulnerability'];
    return vulnKeywords.some(keyword => message.includes(keyword));
  }

  isToolQuestion(message) {
    const toolKeywords = ['tool', 'software', 'scanner', 'burp', 'zap', 'nmap', 'gobuster', 'ffuf', 'subfinder'];
    return toolKeywords.some(keyword => message.includes(keyword));
  }

  isMethodologyQuestion(message) {
    const methKeywords = ['methodology', 'approach', 'workflow', 'process', 'steps', 'how to'];
    return methKeywords.some(keyword => message.includes(keyword));
  }

  isExploitationQuestion(message) {
    const exploitKeywords = ['exploit', 'payload', 'poc', 'proof of concept', 'attack', 'bypass'];
    return exploitKeywords.some(keyword => message.includes(keyword));
  }

  isReportQuestion(message) {
    const reportKeywords = ['report', 'write', 'document', 'submit', 'template'];
    return reportKeywords.some(keyword => message.includes(keyword));
  }

  isSpecificTargetQuestion(message, context) {
    const targetKeywords = ['this target', 'current target', 'vulnerabilities found', 'next steps'];
    return context && context.target_id && targetKeywords.some(keyword => message.includes(keyword));
  }

  detectVulnerabilityType(message) {
    const vulnTypes = Object.keys(this.securityKnowledgeBase.vulnerabilities);
    return vulnTypes.find(type => message.includes(type.replace(' ', '')) || message.includes(type));
  }

  getCodeExamples(vulnType) {
    const examples = {
      'sql injection': [
        "' OR '1'='1-- ",
        "1' UNION SELECT null,database(),version()-- ",
        "'; WAITFOR DELAY '00:00:05'-- "
      ],
      'xss': [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        '"><svg onload="alert(document.domain)">'
      ]
    };
    
    return examples[vulnType] || [];
  }

  getRelatedVulnerabilities(vulnType) {
    const related = {
      'sql injection': ['NoSQL Injection', 'Blind SQL Injection', 'Time-based SQL Injection'],
      'xss': ['DOM XSS', 'Stored XSS', 'Reflected XSS'],
      'idor': ['Privilege Escalation', 'Authorization Bypass', 'Horizontal Access Control']
    };
    
    return related[vulnType] || [];
  }

  generateSuggestions(message, context) {
    const suggestions = [
      'How do I test for SQL injection?',
      'What tools should I use for subdomain enumeration?',
      'Show me XSS payloads',
      'How do I write a good bug report?',
      'What is the bug bounty methodology?'
    ];

    // Add context-specific suggestions
    if (context && context.target_id) {
      suggestions.unshift('What vulnerabilities were found on this target?');
      suggestions.unshift('What should I test next on this target?');
    }

    return suggestions.slice(0, 5);
  }

  getRelatedResources(message) {
    return [
      {
        title: 'OWASP Testing Guide',
        url: 'https://owasp.org/www-project-web-security-testing-guide/',
        type: 'documentation'
      },
      {
        title: 'PortSwigger Web Security Academy',
        url: 'https://portswigger.net/web-security',
        type: 'training'
      },
      {
        title: 'Bug Bounty Methodologies',
        url: 'https://github.com/jhaddix/tbhm',
        type: 'methodology'
      }
    ];
  }

  async storeChatMessage(conversationId, userId, userMessage, botResponse) {
    try {
      // Store in database (you may need to create this table)
      await knex('chat_history').insert({
        conversation_id: conversationId,
        user_id: userId,
        user_message: userMessage,
        bot_response: botResponse,
        created_at: new Date()
      });
    } catch (error) {
      console.error('Failed to store chat message:', error);
      // Don't throw error - chat can continue without storage
    }
  }

  async getChatbotStatus(req, res) {
    try {
      res.json({
        success: true,
        data: {
          status: 'online',
          version: '1.0.0',
          knowledge_base_size: Object.keys(this.securityKnowledgeBase.vulnerabilities).length,
          supported_topics: [
            'Vulnerability Research',
            'Tool Recommendations', 
            'Testing Methodologies',
            'Report Writing',
            'Bug Bounty Best Practices'
          ],
          active_conversations: this.conversationHistory.size
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get chatbot status'
      });
    }
  }

  async getChatHistory(req, res) {
    try {
      const { user } = req;
      const { conversation_id, limit = 50 } = req.query;

      let query = knex('chat_history')
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')
        .limit(parseInt(limit));

      if (conversation_id) {
        query = query.where('conversation_id', conversation_id);
      }

      const history = await query;

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      console.error('Error getting chat history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get chat history'
      });
    }
  }

  async clearChatHistory(req, res) {
    try {
      const { user } = req;
      const { conversation_id } = req.body;

      let query = knex('chat_history').where('user_id', user.id);

      if (conversation_id) {
        query = query.where('conversation_id', conversation_id);
      }

      const deleted = await query.del();

      res.json({
        success: true,
        message: `Cleared ${deleted} chat messages`,
        data: { deleted_count: deleted }
      });

    } catch (error) {
      console.error('Error clearing chat history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear chat history'
      });
    }
  }
}

module.exports = new AISecurityAssistant();
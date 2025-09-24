// frontend/assets/js/modules/security-chatbot.js - Updated for your API structure
const SecurityChatbot = {
    currentFindings: {},
    messagesContainer: null,
    inputField: null,
    sendButton: null,
    isProcessing: false,

    // 🔧 API Configuration for your setup
    API_BASE: 'http://localhost:3001/api/v1', // Your API uses /api/v1 prefix

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadCurrentFindings();
        this.addWelcomeMessage();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .chatbot-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border: 2px solid #7c3aed;
                    border-radius: 12px;
                    box-shadow: 0 0 30px rgba(124, 58, 237, 0.3);
                    overflow: hidden;
                    height: calc(100vh - 200px);
                    display: flex;
                    flex-direction: column;
                }

                .chatbot-header {
                    background: linear-gradient(90deg, #7c3aed, #9a4dff);
                    padding: 20px;
                    text-align: center;
                    flex-shrink: 0;
                }

                .chatbot-header h2 {
                    margin: 0;
                    color: white;
                    font-size: 24px;
                }

                .chatbot-header p {
                    margin: 8px 0 0 0;
                    opacity: 0.9;
                    font-size: 14px;
                }

                .ai-status {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin-top: 10px;
                    font-size: 12px;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #10b981;
                    animation: pulse 2s infinite;
                }

                .status-indicator.error {
                    background: #ef4444;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .quick-actions {
                    display: flex;
                    gap: 10px;
                    padding: 15px 20px;
                    background: rgba(0, 0, 0, 0.2);
                    flex-wrap: wrap;
                    flex-shrink: 0;
                }

                .quick-action-btn {
                    background: linear-gradient(45deg, #2d1b69, #7c3aed);
                    border: 1px solid #9a4dff;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.3s ease;
                    border: none;
                }

                .quick-action-btn:hover {
                    background: linear-gradient(45deg, #7c3aed, #a855f7);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
                }

                .findings-context {
                    background: rgba(220, 38, 38, 0.1);
                    border: 1px solid rgba(220, 38, 38, 0.3);
                    padding: 12px 20px;
                    font-size: 12px;
                    flex-shrink: 0;
                }

                .findings-context h4 {
                    margin: 0 0 8px 0;
                    color: #dc2626;
                }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    background: rgba(0, 0, 0, 0.1);
                }

                .message {
                    margin-bottom: 15px;
                    padding: 12px 16px;
                    border-radius: 18px;
                    max-width: 80%;
                    word-wrap: break-word;
                    line-height: 1.4;
                    animation: slideIn 0.3s ease;
                }

                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .message.user {
                    background: linear-gradient(135deg, #7c3aed, #9a4dff);
                    color: white;
                    margin-left: auto;
                    border-bottom-right-radius: 4px;
                }

                .message.bot {
                    background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
                    color: #ffffff;
                    border: 1px solid #444;
                    border-bottom-left-radius: 4px;
                }

                .message.bot .bot-indicator {
                    color: #7c3aed;
                    font-weight: bold;
                    font-size: 12px;
                    margin-bottom: 5px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .message.system {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    color: #22c55e;
                    margin: 0 auto;
                    text-align: center;
                    font-size: 13px;
                    border-radius: 20px;
                    max-width: 60%;
                }

                .typing-indicator {
                    display: none;
                    padding: 12px 16px;
                    margin-bottom: 15px;
                    background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
                    border-radius: 18px;
                    border-bottom-left-radius: 4px;
                    max-width: 80%;
                    border: 1px solid #444;
                }

                .typing-dots {
                    display: inline-block;
                }

                .typing-dots span {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #7c3aed;
                    margin: 0 2px;
                    animation: typing 1.4s infinite ease-in-out;
                }

                .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
                .typing-dots span:nth-child(2) { animation-delay: -0.16s; }

                @keyframes typing {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }

                .chat-input-area {
                    padding: 20px;
                    background: rgba(0, 0, 0, 0.3);
                    border-top: 1px solid #2d1b69;
                    flex-shrink: 0;
                }

                .input-container {
                    display: flex;
                    gap: 12px;
                    align-items: flex-end;
                }

                .input-wrapper {
                    flex: 1;
                    position: relative;
                }

                .chat-input {
                    width: 100%;
                    padding: 12px 16px;
                    background: rgba(0, 0, 0, 0.4);
                    border: 2px solid #2d1b69;
                    border-radius: 25px;
                    color: white;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.3s ease;
                    resize: none;
                    min-height: 45px;
                    max-height: 120px;
                }

                .chat-input:focus {
                    border-color: #7c3aed;
                    box-shadow: 0 0 15px rgba(124, 58, 237, 0.3);
                }

                .char-count {
                    position: absolute;
                    bottom: 5px;
                    right: 15px;
                    font-size: 11px;
                    color: #666;
                }

                .send-btn {
                    background: linear-gradient(45deg, #7c3aed, #9a4dff);
                    border: none;
                    color: white;
                    width: 45px;
                    height: 45px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                    transition: all 0.3s ease;
                    flex-shrink: 0;
                }

                .send-btn:hover:not(:disabled) {
                    background: linear-gradient(45deg, #9a4dff, #a855f7);
                    transform: scale(1.05);
                }

                .send-btn:disabled {
                    background: #444;
                    cursor: not-allowed;
                    transform: none;
                }

                .code-block {
                    background: #000;
                    border: 1px solid #333;
                    padding: 12px;
                    border-radius: 6px;
                    margin: 8px 0;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    overflow-x: auto;
                    color: #a855f7;
                }

                .vulnerability-critical { color: #dc2626; font-weight: bold; }
                .vulnerability-high { color: #ea580c; font-weight: bold; }
                .vulnerability-medium { color: #d97706; }
                .vulnerability-low { color: #eab308; }
                .vulnerability-info { color: #06b6d4; }

                .response-actions {
                    margin-top: 10px;
                    display: flex;
                    gap: 8px;
                }

                .action-btn {
                    background: rgba(124, 58, 237, 0.1);
                    border: 1px solid #7c3aed;
                    color: #9a4dff;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .action-btn:hover {
                    background: rgba(124, 58, 237, 0.2);
                    transform: translateY(-1px);
                }

                @media (max-width: 768px) {
                    .chatbot-container {
                        height: calc(100vh - 150px);
                        border-radius: 0;
                    }
                    
                    .message {
                        max-width: 95%;
                    }
                    
                    .quick-actions {
                        padding: 10px;
                    }
                }
            </style>

            <div class="chatbot-container">
                <!-- Header -->
                <div class="chatbot-header">
                    <h2>🤖 Security Analysis Assistant</h2>
                    <p>AI-powered vulnerability analysis and methodology guidance</p>
                    <div class="ai-status">
                        <div class="status-indicator" id="ai-status-indicator"></div>
                        <span id="ai-status-text">Connecting to AI...</span>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="quick-actions">
                    <button class="quick-action-btn" onclick="SecurityChatbot.quickAction('analyze')">🔍 Analyze Findings</button>
                    <button class="quick-action-btn" onclick="SecurityChatbot.quickAction('prioritize')">📊 Prioritize Risks</button>
                    <button class="quick-action-btn" onclick="SecurityChatbot.quickAction('nextSteps')">➡️ Next Steps</button>
                    <button class="quick-action-btn" onclick="SecurityChatbot.quickAction('remediation')">🛠️ Remediation</button>
                    <button class="quick-action-btn" onclick="SecurityChatbot.quickAction('report')">📄 Write Report</button>
                    <button class="quick-action-btn" onclick="SecurityChatbot.loadFreshFindings()">🔄 Refresh Context</button>
                </div>

                <!-- Current Context -->
                <div class="findings-context">
                    <h4>📋 Current Security Context:</h4>
                    <div id="context-summary">Loading scan results and security context...</div>
                </div>

                <!-- Chat Messages -->
                <div class="chat-messages" id="chatMessages">
                    <!-- Messages will be added here -->
                </div>

                <!-- Typing Indicator -->
                <div class="typing-indicator" id="typingIndicator">
                    <div class="bot-indicator">🤖 Security Assistant</div>
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>

                <!-- Input Area -->
                <div class="chat-input-area">
                    <div class="input-container">
                        <div class="input-wrapper">
                            <textarea class="chat-input" 
                                   id="chatInput" 
                                   placeholder="Ask about vulnerabilities, methodology, or next steps..."
                                   maxlength="1000"
                                   rows="1"></textarea>
                            <div class="char-count" id="charCount">0/1000</div>
                        </div>
                        <button class="send-btn" id="sendBtn" onclick="SecurityChatbot.sendMessage()">➤</button>
                    </div>
                </div>
            </div>
        `;

        // Store references
        this.messagesContainer = document.getElementById('chatMessages');
        this.inputField = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendBtn');
    },

    bindEvents() {
        // Auto-resize textarea
        this.inputField.addEventListener('input', (e) => {
            this.updateCharCount();
            this.autoResizeTextarea(e.target);
        });

        // Enter key handling
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.updateCharCount();
        this.checkAIStatus();
    },

    updateCharCount() {
        const count = this.inputField.value.length;
        const charCountEl = document.getElementById('charCount');
        if (charCountEl) {
            charCountEl.textContent = `${count}/1000`;
            charCountEl.style.color = count > 900 ? '#ef4444' : '#666';
        }
    },

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    },

    async checkAIStatus() {
        try {
            const response = await fetch(`${this.API_BASE}/chatbot/status`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            
            const indicator = document.getElementById('ai-status-indicator');
            const text = document.getElementById('ai-status-text');
            
            if (data.success && data.available) {
                indicator.className = 'status-indicator';
                text.textContent = `${data.provider} AI Ready (${data.model || 'Local Model'})`;
            } else {
                indicator.className = 'status-indicator error';
                text.textContent = 'AI Unavailable - Using fallback responses';
            }
        } catch (error) {
            const indicator = document.getElementById('ai-status-indicator');
            const text = document.getElementById('ai-status-text');
            indicator.className = 'status-indicator error';
            text.textContent = 'Connection Error - Check backend';
        }
    },

    async loadCurrentFindings() {
        try {
            // Load from your existing API endpoints
            const [scansResponse, vulnsResponse, targetsResponse] = await Promise.all([
                fetch(`${this.API_BASE}/scans/jobs?limit=10`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }),
                this.loadVulnerabilities(),
                fetch(`${this.API_BASE}/targets?limit=5`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                })
            ]);

            let findings = {
                vulnerabilities: [],
                recent_scans: [],
                targets: [],
                summary: {
                    total_vulnerabilities: 0,
                    critical_count: 0,
                    high_count: 0,
                    total_scans: 0
                }
            };

            // Process scan results
            if (scansResponse && scansResponse.ok) {
                const scansData = await scansResponse.json();
                if (scansData.success || scansData.data) {
                    findings.recent_scans = scansData.data?.slice(0, 5) || [];
                    findings.summary.total_scans = scansData.data?.length || 0;
                    
                    // Extract vulnerabilities from scan results
                    (scansData.data || []).forEach(scan => {
                        if (scan.results && scan.job_type === 'js_files_scan') {
                            try {
                                const results = typeof scan.results === 'string' ? JSON.parse(scan.results) : scan.results;
                                if (results.vulnerabilities) {
                                    findings.vulnerabilities.push(...results.vulnerabilities);
                                }
                            } catch (e) {
                                console.warn('Failed to parse scan results:', e);
                            }
                        }
                    });
                }
            }

            // Add direct vulnerabilities if available
            if (vulnsResponse && vulnsResponse.length > 0) {
                findings.vulnerabilities.push(...vulnsResponse);
            }

            // Process targets
            if (targetsResponse && targetsResponse.ok) {
                const targetsData = await targetsResponse.json();
                if (targetsData.success || targetsData.data) {
                    findings.targets = targetsData.data?.slice(0, 5) || [];
                }
            }

            // Calculate summary statistics
            findings.summary.total_vulnerabilities = findings.vulnerabilities.length;
            findings.summary.critical_count = findings.vulnerabilities.filter(v => v.severity === 'critical').length;
            findings.summary.high_count = findings.vulnerabilities.filter(v => v.severity === 'high').length;

            this.currentFindings = findings;
            this.updateContextDisplay();

        } catch (error) {
            console.error('Failed to load current findings:', error);
            this.currentFindings = { summary: { total_vulnerabilities: 0 } };
            this.updateContextDisplay();
        }
    },

    async loadVulnerabilities() {
        try {
            const response = await fetch(`${this.API_BASE}/vulnerabilities?limit=20`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                const data = await response.json();
                return (data.success || data.data) ? data.data : [];
            }
        } catch (error) {
            console.warn('Vulnerabilities endpoint error:', error.message);
        }
        return [];
    },

    updateContextDisplay() {
        const contextDiv = document.getElementById('context-summary');
        const { summary, targets, recent_scans } = this.currentFindings;
        
        if (summary.total_vulnerabilities > 0) {
            contextDiv.innerHTML = `
                <strong>Vulnerabilities:</strong> ${summary.total_vulnerabilities} total 
                (${summary.critical_count} critical, ${summary.high_count} high) | 
                <strong>Recent Scans:</strong> ${recent_scans.length} completed | 
                <strong>Active Targets:</strong> ${targets.length}
            `;
        } else if (recent_scans.length > 0) {
            contextDiv.innerHTML = `
                <strong>Recent Scans:</strong> ${recent_scans.length} completed | 
                <strong>Active Targets:</strong> ${targets.length} | 
                <strong>Status:</strong> No vulnerabilities detected yet
            `;
        } else {
            contextDiv.innerHTML = `
                <strong>Status:</strong> No scan results found. Run some scans first to get AI analysis and guidance.
            `;
        }
    },

    addWelcomeMessage() {
        this.addMessage(
            `👋 **Welcome to your Security Analysis Assistant!**

I can help you with:
• 🔍 **Vulnerability Analysis** - Understand impact and exploitability  
• 📊 **Risk Prioritization** - Focus on what matters most
• ➡️ **Methodology Guidance** - Next steps in your testing
• 🛠️ **Remediation Advice** - How to fix security issues
• 📄 **Report Writing** - Professional documentation

**Current Status:** ${this.currentFindings.summary.total_vulnerabilities} vulnerabilities loaded from recent scans.

What would you like help with today?`, 
            'bot'
        );
    },

    quickAction(action) {
        const actions = {
            'analyze': 'Analyze my current security findings and tell me what stands out the most',
            'prioritize': 'Help me prioritize these vulnerabilities by risk level and business impact', 
            'nextSteps': 'Based on my current findings, what should I test next?',
            'remediation': 'Provide specific remediation steps for the most critical issues',
            'report': 'Help me write a professional security report for these findings'
        };
        
        if (actions[action]) {
            this.inputField.value = actions[action];
            this.updateCharCount();
            this.sendMessage();
        }
    },

    async loadFreshFindings() {
        this.addMessage('🔄 Refreshing security context...', 'system');
        await this.loadCurrentFindings();
        this.addMessage('✅ Security context updated with latest scan results', 'system');
    },

    async sendMessage() {
        const message = this.inputField.value.trim();
        
        if (!message || this.isProcessing) return;
        
        this.addMessage(message, 'user');
        this.inputField.value = '';
        this.updateCharCount();
        this.autoResizeTextarea(this.inputField);
        
        this.showTyping();
        this.isProcessing = true;
        
        try {
            const response = await fetch(`${this.API_BASE}/chatbot/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    message: message,
                    context: this.currentFindings
                })
            });
            
            const data = await response.json();
            
            this.hideTyping();
            
            if (data.success) {
                this.addMessage(data.response, 'bot');
            } else {
                this.addMessage(
                    data.fallback_response || 
                    'I apologize, but I\'m having trouble processing your request right now. Please try rephrasing your question.',
                    'bot'
                );
            }
            
        } catch (error) {
            this.hideTyping();
            console.error('Chat error:', error);
            this.addMessage(
                'I\'m having trouble connecting right now. Please check your connection and try again.',
                'bot'
            );
        }
        
        this.isProcessing = false;
    },

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        if (sender === 'bot') {
            messageDiv.innerHTML = `
                <div class="bot-indicator">
                    🤖 Security Assistant
                    <span style="font-weight: normal; font-size: 10px; opacity: 0.7;">(${new Date().toLocaleTimeString()})</span>
                </div>
                ${this.formatMessage(text)}
                <div class="response-actions">
                    <button class="action-btn" onclick="SecurityChatbot.copyToClipboard(this)">📋 Copy</button>
                    <button class="action-btn" onclick="SecurityChatbot.continueConversation(this)">💬 Continue</button>
                </div>
            `;
        } else if (sender === 'system') {
            messageDiv.innerHTML = text;
        } else {
            messageDiv.innerHTML = this.formatMessage(text);
        }
        
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    },

    formatMessage(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code style="background: rgba(124,58,237,0.2); padding: 2px 4px; border-radius: 3px;">$1</code>')
            .replace(/```([\s\S]*?)```/g, '<div class="code-block">$1</div>')
            .replace(/\n/g, '<br>');
    },

    showTyping() {
        document.getElementById('typingIndicator').style.display = 'block';
        this.sendButton.disabled = true;
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    },

    hideTyping() {
        document.getElementById('typingIndicator').style.display = 'none';
        this.sendButton.disabled = false;
    },

    copyToClipboard(button) {
        const messageDiv = button.closest('.message');
        const text = messageDiv.querySelector('.bot-indicator').nextSibling.textContent.trim();
        
        navigator.clipboard.writeText(text).then(() => {
            button.textContent = '✅ Copied';
            setTimeout(() => {
                button.textContent = '📋 Copy';
            }, 2000);
        });
    },

    continueConversation(button) {
        this.inputField.value = 'Can you elaborate on that?';
        this.updateCharCount();
        this.inputField.focus();
    },

    cleanup() {
        this.isProcessing = false;
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
    }
};

window.SecurityChatbot = SecurityChatbot;
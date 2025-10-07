// frontend/assets/js/modules/ai-chatbot.js - AI Security Assistant

const AIChatbot = {
    conversationId: null,
    isTyping: false,
    chatHistory: [],
    currentContext: null,

    async init() {
        this.renderHTML();
        this.bindEvents();
        await this.loadChatStatus();
        await this.loadChatHistory();
        this.startTypingIndicator();
    },

    renderHTML() {
        const content = document.getElementById('main-content');
        content.innerHTML = `
            <style>
                .chat-container {
                    max-height: 600px;
                    display: flex;
                    flex-direction: column;
                    border: 2px solid #9a4dff;
                    background: linear-gradient(135deg, #1a0a2e, #2d1b69);
                    border-radius: 8px;
                    overflow: hidden;
                }
                
                .chat-header {
                    background: linear-gradient(135deg, #2d1b69, #4a2c8a);
                    padding: 15px;
                    border-bottom: 1px solid #9a4dff;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .chat-status {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #00ff00;
                    animation: pulse 2s infinite;
                }
                
                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    min-height: 400px;
                    max-height: 400px;
                    background: rgba(26, 10, 46, 0.3);
                }
                
                .message {
                    margin-bottom: 15px;
                    display: flex;
                    gap: 10px;
                }
                
                .message.user {
                    flex-direction: row-reverse;
                }
                
                .message-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    flex-shrink: 0;
                }
                
                .user-avatar {
                    background: linear-gradient(135deg, #9a4dff, #7b2cbf);
                }
                
                .bot-avatar {
                    background: linear-gradient(135deg, #00ff9f, #00cc7e);
                }
                
                .message-content {
                    max-width: 70%;
                    padding: 12px 16px;
                    border-radius: 18px;
                    position: relative;
                }
                
                .user .message-content {
                    background: linear-gradient(135deg, #9a4dff, #7b2cbf);
                    color: white;
                    margin-left: auto;
                }
                
                .bot .message-content {
                    background: linear-gradient(135deg, #2d1b69, #4a2c8a);
                    color: #e2e8f0;
                    border: 1px solid #9a4dff;
                }
                
                .message-time {
                    font-size: 10px;
                    color: #94a3b8;
                    margin-top: 4px;
                }
                
                .typing-indicator {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #9a4dff;
                    font-size: 12px;
                    padding: 8px 16px;
                }
                
                .typing-dots {
                    display: flex;
                    gap: 2px;
                }
                
                .typing-dot {
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background-color: #9a4dff;
                    animation: typing 1.4s infinite ease-in-out;
                }
                
                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }
                
                @keyframes typing {
                    0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
                    40% { transform: scale(1); opacity: 1; }
                }
                
                .chat-input-container {
                    padding: 20px;
                    border-top: 1px solid #9a4dff;
                    background: rgba(45, 27, 105, 0.3);
                }
                
                .chat-input-form {
                    display: flex;
                    gap: 10px;
                    align-items: flex-end;
                }
                
                .chat-input {
                    flex: 1;
                    min-height: 40px;
                    max-height: 120px;
                    padding: 10px 15px;
                    border: 2px solid #9a4dff;
                    border-radius: 20px;
                    background: rgba(26, 10, 46, 0.8);
                    color: #e2e8f0;
                    resize: none;
                    outline: none;
                    font-family: inherit;
                }
                
                .chat-input:focus {
                    border-color: #00ff9f;
                    box-shadow: 0 0 0 2px rgba(0, 255, 159, 0.2);
                }
                
                .suggestions-container {
                    margin-top: 10px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }
                
                .suggestion-chip {
                    padding: 4px 8px;
                    background: rgba(154, 77, 255, 0.2);
                    border: 1px solid #9a4dff;
                    border-radius: 12px;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .suggestion-chip:hover {
                    background: rgba(154, 77, 255, 0.4);
                    transform: translateY(-1px);
                }
                
                .vulnerability-card {
                    background: rgba(255, 68, 68, 0.1);
                    border: 1px solid #ff4444;
                    border-radius: 8px;
                    padding: 12px;
                    margin: 8px 0;
                }
                
                .code-block {
                    background: rgba(0, 0, 0, 0.5);
                    border: 1px solid #9a4dff;
                    border-radius: 4px;
                    padding: 8px;
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    margin: 8px 0;
                    overflow-x: auto;
                }
                
                .ai-response-actions {
                    margin-top: 8px;
                    display: flex;
                    gap: 5px;
                }
                
                .action-btn {
                    padding: 2px 6px;
                    font-size: 10px;
                    border: 1px solid #9a4dff;
                    background: rgba(154, 77, 255, 0.1);
                    color: #9a4dff;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .action-btn:hover {
                    background: rgba(154, 77, 255, 0.2);
                }
            </style>

            <div class="scan-info">
                <h4>🤖 AI Security Assistant</h4>
                <p>Ask questions about vulnerabilities, tools, methodologies, and get personalized security guidance. The AI assistant can help with bug bounty techniques, exploitation methods, and target-specific analysis.</p>
            </div>

            <!-- AI Status Card -->
            <div class="card">
                <div class="card-title">AI Assistant Status</div>
                <div id="ai-status-content">
                    <p style="color: #9a4dff;">Loading AI assistant status...</p>
                </div>
            </div>

            <!-- Chat Interface -->
            <div class="card">
                <div class="card-title">Security Assistant Chat</div>
                
                <div class="chat-container">
                    <div class="chat-header">
                        <div class="chat-status" id="chat-status"></div>
                        <div>
                            <div style="font-weight: bold; color: #00ff9f;">🛡️ Security AI Assistant</div>
                            <div style="font-size: 11px; color: #94a3b8;" id="ai-status-text">Online</div>
                        </div>
                        <div style="margin-left: auto;">
                            <button onclick="AIChatbot.clearChat()" class="btn btn-secondary btn-small">🗑️ Clear Chat</button>
                        </div>
                    </div>
                    
                    <div class="chat-messages" id="chat-messages">
                        <div class="message bot">
                            <div class="message-avatar bot-avatar">🤖</div>
                            <div class="message-content">
                                <div>Hello! I'm your AI Security Assistant. I can help you with:</div>
                                <ul style="margin: 8px 0; padding-left: 20px; font-size: 13px;">
                                    <li>Vulnerability research and exploitation techniques</li>
                                    <li>Security tool recommendations and usage</li>
                                    <li>Bug bounty methodologies and best practices</li>
                                    <li>Target-specific security analysis</li>
                                    <li>Writing professional security reports</li>
                                </ul>
                                <div>What would you like to know about?</div>
                                <div class="message-time">Just now</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="chat-input-container">
                        <form class="chat-input-form" id="chat-form">
                            <textarea 
                                id="chat-input" 
                                class="chat-input" 
                                placeholder="Ask about vulnerabilities, tools, methodologies..."
                                rows="1"
                            ></textarea>
                            <button type="submit" class="btn btn-primary" id="send-message-btn">
                                🚀 Send
                            </button>
                        </form>
                        
                        <div class="suggestions-container" id="suggestions-container">
                            <!-- Suggestions will be populated here -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card">
                <div class="card-title">Quick Security Questions</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    <button onclick="AIChatbot.askQuestion('How do I test for SQL injection?')" class="btn btn-secondary">💉 SQL Injection Testing</button>
                    <button onclick="AIChatbot.askQuestion('What tools should I use for subdomain enumeration?')" class="btn btn-secondary">🔍 Subdomain Tools</button>
                    <button onclick="AIChatbot.askQuestion('Show me XSS payloads')" class="btn btn-secondary">⚡ XSS Payloads</button>
                    <button onclick="AIChatbot.askQuestion('How do I write a good bug bounty report?')" class="btn btn-secondary">📝 Report Writing</button>
                    <button onclick="AIChatbot.askQuestion('What is the OWASP Top 10?')" class="btn btn-secondary">🛡️ OWASP Top 10</button>
                    <button onclick="AIChatbot.askQuestion('How do I test for IDOR vulnerabilities?')" class="btn btn-secondary">🔑 IDOR Testing</button>
                </div>
            </div>
        `;
    },

    bindEvents() {
        // Chat form submission
        const chatForm = document.getElementById('chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.sendMessage();
            });
        }

        // Auto-resize textarea
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('input', (e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            });

            // Send on Enter (but not Shift+Enter)
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    },

    async loadChatStatus() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/chatbot/status`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.renderAIStatus(data.data);
                }
            }
        } catch (error) {
            console.error('Failed to load AI status:', error);
        }
    },

    renderAIStatus(status) {
        const statusContent = document.getElementById('ai-status-content');
        if (!statusContent) return;

        statusContent.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #00ff9f;">${status.status?.toUpperCase() || 'ONLINE'}</div>
                    <div style="font-size: 12px; color: #94a3b8;">Assistant Status</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #9a4dff;">${status.version || '1.0.0'}</div>
                    <div style="font-size: 12px; color: #94a3b8;">Version</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #ffff00;">${status.knowledge_base_size || 0}</div>
                    <div style="font-size: 12px; color: #94a3b8;">Vulnerabilities in KB</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 20px; font-weight: bold; color: #ff6b6b;">${status.active_conversations || 0}</div>
                    <div style="font-size: 12px; color: #94a3b8;">Active Conversations</div>
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                <strong style="color: #9a4dff;">Supported Topics:</strong>
                <div style="margin-top: 5px; display: flex; flex-wrap: wrap; gap: 5px;">
                    ${(status.supported_topics || []).map(topic => 
                        `<span style="padding: 2px 6px; background: rgba(154, 77, 255, 0.2); border-radius: 4px; font-size: 11px;">${topic}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    },

    async loadChatHistory() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/chatbot/history?limit=20`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.length > 0) {
                    this.chatHistory = data.data.reverse(); // Show oldest first
                    this.renderChatHistory();
                }
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    },

    renderChatHistory() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer || this.chatHistory.length === 0) return;

        // Clear welcome message
        messagesContainer.innerHTML = '';

        this.chatHistory.forEach(chat => {
            this.addMessageToChat(chat.user_message, 'user', chat.created_at);
            this.addMessageToChat(chat.bot_response, 'bot', chat.created_at, true);
        });

        this.scrollToBottom();
    },

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        // Clear input and reset height
        input.value = '';
        input.style.height = 'auto';

        // Add user message to chat
        this.addMessageToChat(message, 'user');

        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Get current context (target info if available)
            const context = await this.getCurrentContext();

            const response = await fetch(`${CONFIG.API_BASE}/chatbot/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversation_id: this.conversationId,
                    context: context
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.conversationId = data.data.conversation_id;
                    
                    // Hide typing indicator
                    this.hideTypingIndicator();
                    
                    // Add bot response
                    this.addBotResponse(data.data.bot_response);
                    
                    // Update suggestions
                    this.updateSuggestions(data.data.suggestions);
                }
            } else {
                this.hideTypingIndicator();
                this.addMessageToChat('Sorry, I encountered an error. Please try again.', 'bot');
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addMessageToChat('Connection error. Please check your internet connection and try again.', 'bot');
        }
    },

    async getCurrentContext() {
        // Get current target and any relevant context
        const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
        const targetFilter = document.getElementById('global-target-filter')?.value;
        
        const context = {
            active_tab: activeTab,
            target_id: targetFilter || null,
            timestamp: new Date().toISOString()
        };

        // Add target-specific context if available
        if (targetFilter && window.Targets && window.Targets.targetsCache) {
            const target = window.Targets.targetsCache[targetFilter];
            if (target) {
                context.target_domain = target.domain;
                context.target_stats = target.stats;
            }
        }

        return context;
    },

    addMessageToChat(message, sender, timestamp = null, isResponse = false) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}`;
        
        const avatar = sender === 'user' ? '👤' : '🤖';
        const avatarClass = sender === 'user' ? 'user-avatar' : 'bot-avatar';
        
        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        messageEl.innerHTML = `
            <div class="message-avatar ${avatarClass}">${avatar}</div>
            <div class="message-content">
                <div class="message-text">${this.formatMessage(message, isResponse)}</div>
                <div class="message-time">${timeStr}</div>
            </div>
        `;

        messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    },

    addBotResponse(response) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const messageEl = document.createElement('div');
        messageEl.className = 'message bot';
        
        const timeStr = new Date().toLocaleTimeString();
        
        messageEl.innerHTML = `
            <div class="message-avatar bot-avatar">🤖</div>
            <div class="message-content">
                <div class="message-text">${this.formatBotResponse(response)}</div>
                <div class="message-time">${timeStr}</div>
                ${this.renderResponseActions(response)}
            </div>
        `;

        messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    },

    formatMessage(message, isResponse = false) {
        if (!isResponse) {
            return message.replace(/\n/g, '<br>');
        }
        
        // For bot responses, support markdown-style formatting
        return message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 2px;">$1</code>')
            .replace(/\n/g, '<br>');
    },

    formatBotResponse(response) {
        let formattedMessage = this.formatMessage(response.message, true);
        
        // Add code examples if available
        if (response.code_examples && response.code_examples.length > 0) {
            formattedMessage += '<div style="margin-top: 8px;"><strong>Code Examples:</strong></div>';
            response.code_examples.forEach(code => {
                formattedMessage += `<div class="code-block">${code}</div>`;
            });
        }

        // Add actionable items if available
        if (response.actionable_items && response.actionable_items.length > 0) {
            formattedMessage += '<div style="margin-top: 8px;"><strong>Action Items:</strong></div>';
            formattedMessage += '<ul style="margin: 4px 0; padding-left: 20px; font-size: 13px;">';
            response.actionable_items.forEach(item => {
                formattedMessage += `<li>${item}</li>`;
            });
            formattedMessage += '</ul>';
        }

        // Add related vulnerabilities if available
        if (response.related_vulnerabilities && response.related_vulnerabilities.length > 0) {
            formattedMessage += '<div style="margin-top: 8px;"><strong>Related Vulnerabilities:</strong></div>';
            response.related_vulnerabilities.forEach(vuln => {
                formattedMessage += `<div class="vulnerability-card">${vuln}</div>`;
            });
        }

        return formattedMessage;
    },

    renderResponseActions(response) {
        if (!response.actionable_items || response.actionable_items.length === 0) {
            return '';
        }

        return `
            <div class="ai-response-actions">
                <span class="action-btn" onclick="AIChatbot.copyResponse('${response.message.replace(/'/g, "\\'")}')" title="Copy response">📋</span>
                <span class="action-btn" onclick="AIChatbot.askFollowUp('Tell me more about this')" title="Ask for more details">💬</span>
                <span class="action-btn" onclick="AIChatbot.rateResponse('helpful')" title="Mark as helpful">👍</span>
            </div>
        `;
    },

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const typingEl = document.createElement('div');
        typingEl.id = 'typing-indicator';
        typingEl.className = 'message bot';
        
        typingEl.innerHTML = `
            <div class="message-avatar bot-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span>AI is thinking</span>
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        `;

        messagesContainer.appendChild(typingEl);
        this.scrollToBottom();
    },

    hideTypingIndicator() {
        const typingEl = document.getElementById('typing-indicator');
        if (typingEl) {
            typingEl.remove();
        }
    },

    updateSuggestions(suggestions) {
        const container = document.getElementById('suggestions-container');
        if (!container || !suggestions || suggestions.length === 0) return;

        container.innerHTML = suggestions.map(suggestion => 
            `<div class="suggestion-chip" onclick="AIChatbot.askQuestion('${suggestion.replace(/'/g, "\\'")}')">${suggestion}</div>`
        ).join('');
    },

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    },

    startTypingIndicator() {
        // Update status indicator
        const statusText = document.getElementById('ai-status-text');
        if (statusText) {
            statusText.textContent = 'Online - Ready to help';
        }
    },

    // Helper methods
    async askQuestion(question) {
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = question;
            await this.sendMessage();
        }
    },

    async askFollowUp(question) {
        await this.askQuestion(question);
    },

    copyResponse(text) {
        navigator.clipboard.writeText(text.replace(/<[^>]*>/g, '')).then(() => {
            Utils.showMessage('Response copied to clipboard!', 'success');
        });
    },

    rateResponse(rating) {
        Utils.showMessage('Thank you for your feedback!', 'success');
        // Could send rating to backend
    },

    async clearChat() {
        if (confirm('Are you sure you want to clear the chat history?')) {
            try {
                const response = await fetch(`${CONFIG.API_BASE}/chatbot/history`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        conversation_id: this.conversationId
                    })
                });

                if (response.ok) {
                    // Clear chat UI
                    const messagesContainer = document.getElementById('chat-messages');
                    if (messagesContainer) {
                        messagesContainer.innerHTML = `
                            <div class="message bot">
                                <div class="message-avatar bot-avatar">🤖</div>
                                <div class="message-content">
                                    <div>Chat cleared! How can I help you with security testing today?</div>
                                    <div class="message-time">${new Date().toLocaleTimeString()}</div>
                                </div>
                            </div>
                        `;
                    }
                    
                    this.conversationId = null;
                    this.chatHistory = [];
                    
                    Utils.showMessage('Chat history cleared successfully!', 'success');
                }
            } catch (error) {
                console.error('Failed to clear chat:', error);
                Utils.showMessage('Failed to clear chat history', 'error');
            }
        }
    },

    // Cleanup method for tab switching
    cleanup() {
        console.log('🧹 Cleaning up AI Chatbot module');
        // No intervals to clean up for now
    }
};

// Make it globally available
window.AIChatbot = AIChatbot;
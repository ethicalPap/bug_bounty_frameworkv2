// backend/src/controllers/chatbot.js - CLEAN VERSION
const SecurityChatbotService = require('../services/securityChatbotService');

/**
 * Chat with the AI security bot
 */
const chatWithBot = async (req, res) => {
  try {
    const { message, context } = req.body;
    const user = req.user; // From authenticateToken middleware

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log(`🤖 Chatbot request from user ${user.id}: "${message.substring(0, 50)}..."`);

    const result = await SecurityChatbotService.analyzeFindings(
      user.organization_id,
      context || {},
      message,
      user.id
    );

    console.log(`✅ Chatbot response generated (${result.provider || 'unknown'})`);
    
    res.json(result);

  } catch (error) {
    console.error('Chatbot controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Chatbot service temporarily unavailable',
      fallback_response: 'I apologize, but I\'m having technical difficulties right now. Please try again in a moment.'
    });
  }
};

/**
 * Get chatbot status and availability
 */
const getChatbotStatus = async (req, res) => {
  try {
    const setupResult = await SecurityChatbotService.setupLocalAI();
    
    res.json({
      success: true,
      available: setupResult,
      provider: setupResult ? 'local_ollama' : 'fallback_rules',
      model: setupResult ? (process.env.SECURITY_AI_MODEL || 'codellama:7b-instruct') : null,
      cost: 0,
      message: setupResult ? 'Local AI ready' : 'Using intelligent fallback responses'
    });

  } catch (error) {
    console.error('Chatbot status check failed:', error);
    res.json({
      success: true,
      available: false,
      provider: 'fallback_rules',
      model: null,
      cost: 0,
      message: 'AI unavailable - using rule-based responses'
    });
  }
};

/**
 * Get conversation history for the current user
 */
const getChatHistory = async (req, res) => {
  try {
    const user = req.user;
    const history = SecurityChatbotService.getConversationHistory(user.id);
    
    res.json({
      success: true,
      history: history,
      count: history.length
    });

  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat history'
    });
  }
};

/**
 * Clear conversation history for the current user
 */
const clearChatHistory = async (req, res) => {
  try {
    const user = req.user;
    SecurityChatbotService.conversationHistory.delete(user.id);
    
    res.json({
      success: true,
      message: 'Chat history cleared'
    });

  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear chat history'
    });
  }
};

module.exports = {
  chatWithBot,
  getChatbotStatus,
  getChatHistory,
  clearChatHistory
};
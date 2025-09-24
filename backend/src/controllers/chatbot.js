// backend/src/controllers/chatbot.js
const FreeSecurityChatbot = require('../services/securityChatbotService');

const chatWithBot = async (req, res) => {
  try {
    const { message, context } = req.body;
    const { user } = req;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    console.log(`🤖 Chatbot request from user ${user.id}: "${message.substring(0, 50)}..."`);

    const result = await FreeSecurityChatbot.analyzeFindings(
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
      fallback_response: 'I apologize, but I\'m having technical difficulties right now. Please try again in a moment, or feel free to ask specific questions about your security findings.'
    });
  }
};

const getChatbotStatus = async (req, res) => {
  try {
    // Check if local AI is available
    const setupResult = await FreeSecurityChatbot.setupLocalAI();
    
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

const getChatHistory = async (req, res) => {
  try {
    const { user } = req;
    const history = FreeSecurityChatbot.getConversationHistory(user.id);
    
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

const clearChatHistory = async (req, res) => {
  try {
    const { user } = req;
    FreeSecurityChatbot.conversationHistory.delete(user.id);
    
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

// backend/src/routes/chatbot.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { chatWithBot, getChatbotStatus, getChatHistory, clearChatHistory } = require('../controllers/chatbot');

// All chatbot routes require authentication
router.use(auth);

// Main chat endpoint
router.post('/chat', chatWithBot);

// Status check endpoint
router.get('/status', getChatbotStatus);

// Chat history management
router.get('/history', getChatHistory);
router.delete('/history', clearChatHistory);

module.exports = router;

// Add to your main app.js or routes/index.js:
// app.use('/api/chatbot', require('./routes/chatbot'));
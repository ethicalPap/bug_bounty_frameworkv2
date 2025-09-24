// backend/src/routes/index.js - UPDATED with chatbot routes
const express = require('express');
const authController = require('../controllers/auth');
const targetsController = require('../controllers/targets');
const scansController = require('../controllers/scans');
const subdomainsController = require('../controllers/subdomains');
const directoriesController = require('../controllers/directories');
const vulnerabilitiesController = require('../controllers/vulnerabilities');
const portsController = require('../controllers/ports');
const chatbotController = require('../controllers/chatbot'); // 🤖 NEW: Add chatbot controller
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Protected routes
router.use(authenticateToken); // All routes below require authentication

// Targets
router.post('/targets', targetsController.createTarget);
router.get('/targets', targetsController.getTargets);
router.get('/targets/:id', targetsController.getTarget);
router.put('/targets/:id', targetsController.updateTarget);
router.delete('/targets/:id', requireRole(['admin', 'manager']), targetsController.deleteTarget);

// Subdomains
router.get('/subdomains', subdomainsController.getSubdomains);
router.get('/subdomains/stats', subdomainsController.getStats);
router.post('/subdomains/:id/check-live', subdomainsController.checkLiveStatus);

// Directories
router.get('/directories', directoriesController.getDirectories);
router.get('/directories/stats', directoriesController.getStats);

// Ports
router.get('/ports', portsController.getPorts);
router.get('/ports/stats', portsController.getStats);
router.get('/ports/:id', portsController.getPortById);
router.put('/ports/:id', portsController.updatePort);

// Vulnerabilities
router.get('/vulnerabilities', vulnerabilitiesController.getVulnerabilities);
router.get('/vulnerabilities/stats', vulnerabilitiesController.getStats);
router.put('/vulnerabilities/:id', vulnerabilitiesController.updateVulnerability);

// Scans
router.post('/scans/start', scansController.startScan);
router.get('/scans/jobs', scansController.getJobs);
router.get('/scans/:id', scansController.getScan);
router.get('/scans/:id/results', scansController.getScanResults);
router.post('/scans/stop/:id', scansController.stopScan);

// 🤖 AI Security Chatbot Routes (NEW)
router.post('/chatbot/chat', chatbotController.chatWithBot);
router.get('/chatbot/status', chatbotController.getChatbotStatus);
router.get('/chatbot/history', chatbotController.getChatHistory);
router.delete('/chatbot/history', chatbotController.clearChatHistory);

module.exports = router;
// backend/src/routes/index.js
const express = require('express');
const authController = require('../controllers/auth');
const targetsController = require('../controllers/targets');
const scansController = require('../controllers/scans');
const subdomainsController = require('../controllers/subdomains');
const directoriesController = require('../controllers/directories');
const vulnerabilitiesController = require('../controllers/vulnerabilities');
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

module.exports = router;
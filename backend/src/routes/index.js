const express = require('express');
const authController = require('../controllers/auth');
const targetsController = require('../controllers/targets');
const scansController = require('../controllers/scans');
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

// Scans
router.post('/scans/start', scansController.startScan);
router.get('/scans/jobs', scansController.getJobs);
router.get('/scans/:id', scansController.getScan);
router.post('/scans/stop/:id', scansController.stopScan);

module.exports = router;
// backend/src/controllers/scans.js
const ScanJob = require('../models/ScanJob');
const Target = require('../models/Target');
const { validationResult, body } = require('express-validator');

const safeJsonParse = (value, fallback = {}) => {
     if (!value) return fallback;
     if (typeof value === 'object') return value;
     if (typeof value === 'string') {
       try {
         return JSON.parse(value);
       } catch (error) {
         console.warn('JSON parse error for value:', value, error.message);
         return fallback;
       }
     }
     return fallback;
   };

// Validation rules for starting a scan
const scanValidation = [
  body('targetId')
    .isInt({ min: 1 })
    .withMessage('Valid target ID is required'),
  body('scanTypes')
    .isArray({ min: 1 })
    .withMessage('At least one scan type is required')
    .custom((scanTypes) => {
      const validTypes = [
        'subdomain_scan',
        'port_scan', 
        'content_discovery',
        'js_files_scan',
        'api_discovery',
        'vulnerability_scan',
        'full_scan'
      ];
      
      const invalidTypes = scanTypes.filter(type => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        throw new Error(`Invalid scan types: ${invalidTypes.join(', ')}`);
      }
      return true;
    }),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be an object')
];

// Start a new scan
const startScan = async (req, res) => {
  try {
    const { targetId, scanTypes, priority = 'medium', config = {} } = req.body;
    const { user } = req;

    // Basic validation
    if (!targetId || !scanTypes || !Array.isArray(scanTypes) || scanTypes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Target ID and scan types are required'
      });
    }

    // Verify target exists and belongs to user's organization
    const target = await Target.findById(targetId, user.organization_id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    // Check if target is already being scanned
    const existingScans = await ScanJob.findByTargetAndStatus(targetId, ['pending', 'running']);

    if (existingScans.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Target is already being scanned. Please wait for current scans to complete.',
        data: {
          existing_scans: existingScans
        }
      });
    }

    // Create scan records for each scan type
    const scans = [];
    
    for (const scanType of scanTypes) {
      const scan = await ScanJob.create({
        target_id: targetId,
        job_type: scanType,
        scan_types: JSON.stringify([scanType]),
        priority,
        config: JSON.stringify(config),
        created_by: user.id,
        organization_id: user.organization_id,
        status: 'pending'
      });
      
      scans.push(scan);
    }

    // Update target status
    await Target.update(targetId, user.organization_id, { 
      status: 'scanning',
      last_scan_at: new Date()
    });

    // TODO: Start the actual scan process asynchronously
    // For now, we'll just mark them as pending
    console.log(`Created ${scans.length} scan jobs for target: ${target.domain}`);

    res.status(201).json({
      success: true,
      message: 'Scans started successfully',
      data: scans
    });

  } catch (error) {
    console.error('Error starting scan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get scan jobs with filtering
const getJobs = async (req, res) => {
  try {
    const { user } = req;
    const { 
      status,
      target_id,
      job_type,
      page = 1, 
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    const filters = {
      status: status ? (Array.isArray(status) ? status : [status]) : undefined,
      target_id,
      job_type,
      sortBy,
      sortOrder: sortOrder.toLowerCase(),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Get scans with pagination
    const [scans, total, stats] = await Promise.all([
      ScanJob.findAll(user.organization_id, filters),
      ScanJob.count(user.organization_id, { status, target_id, job_type }),
      ScanJob.getStats(user.organization_id)
    ]);

    // Add computed fields
    const scansWithComputedFields = scans.map(scan => {
      const scanData = {
        ...scan,
        config: safeJsonParse(scan.config, {}),
        results: safeJsonParse(scan.results, {}),
        scan_types: safeJsonParse(scan.scan_types, [])
      };
      
      // Calculate duration
      if (scan.started_at) {
        const endTime = scan.completed_at ? new Date(scan.completed_at) : new Date();
        const startTime = new Date(scan.started_at);
        scanData.duration_seconds = Math.floor((endTime - startTime) / 1000);
      }
      
      return scanData;
    });

    res.json({
      success: true,
      data: scansWithComputedFields,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      },
      stats
    });

  } catch (error) {
    console.error('Error fetching scan jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a specific scan with results
const getScan = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const scan = await ScanJob.findById(id, user.organization_id);

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    // Add computed fields
    const scanData = {
      ...scan,
      config: scan.config ? JSON.parse(scan.config) : {},
      results: scan.results ? JSON.parse(scan.results) : {},
      scan_types: scan.scan_types ? JSON.parse(scan.scan_types) : []
    };
    
    if (scan.started_at) {
      const endTime = scan.completed_at ? new Date(scan.completed_at) : new Date();
      const startTime = new Date(scan.started_at);
      scanData.duration_seconds = Math.floor((endTime - startTime) / 1000);
    }

    res.json({
      success: true,
      data: scanData
    });

  } catch (error) {
    console.error('Error fetching scan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Stop a running scan
const stopScan = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const scan = await ScanJob.findById(id, user.organization_id);

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    if (!['pending', 'running'].includes(scan.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot stop scan with status: ${scan.status}`
      });
    }

    // Update scan status
    const updatedScan = await ScanJob.update(id, user.organization_id, {
      status: 'cancelled',
      completed_at: new Date()
    });

    // Check if this was the last running scan for the target
    const remainingScans = await ScanJob.count(user.organization_id, {
      target_id: scan.target_id,
      status: ['pending', 'running']
    });

    if (remainingScans === 0) {
      await Target.update(scan.target_id, user.organization_id, { status: 'active' });
    }

    res.json({
      success: true,
      message: 'Scan stopped successfully',
      data: updatedScan
    });

  } catch (error) {
    console.error('Error stopping scan:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  startScan,
  getJobs,
  getScan,
  stopScan,
  scanValidation
};
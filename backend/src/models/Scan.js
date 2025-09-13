// backend/src/controllers/scans.js
const Scan = require('../models/Scan');
const Target = require('../models/Target');
const { validationResult, body } = require('express-validator');
const { Op } = require('sequelize');
const ScanService = require('../services/scanService');

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
    // Run validation
    await Promise.all(scanValidation.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { targetId, scanTypes, priority = 'medium', config = {} } = req.body;
    const { user } = req;

    // Verify target exists and belongs to user's organization
    const target = await Target.findOne({
      where: {
        id: targetId,
        organization_id: user.organization_id
      }
    });

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    // Check if target is already being scanned
    const existingScans = await Scan.findAll({
      where: {
        target_id: targetId,
        status: ['pending', 'running']
      }
    });

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
      const scan = await Scan.create({
        target_id: targetId,
        job_type: scanType,
        scan_types: [scanType],
        priority,
        config,
        created_by: user.id,
        organization_id: user.organization_id,
        status: 'pending'
      });
      
      scans.push(scan);
    }

    // Update target status
    await target.update({ 
      status: 'scanning',
      last_scan_at: new Date()
    });

    // Start the actual scan process asynchronously
    try {
      await ScanService.startScanJobs(scans, target);
    } catch (scanError) {
      console.error('Error starting scan jobs:', scanError);
      
      // Mark scans as failed
      await Promise.all(scans.map(scan => 
        scan.update({
          status: 'failed',
          error_message: 'Failed to start scan job'
        })
      ));
      
      // Reset target status
      await target.update({ status: 'active' });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to start scan jobs',
        error: process.env.NODE_ENV === 'development' ? scanError.message : undefined
      });
    }

    // Return the created scans with target information
    const scansWithTarget = await Promise.all(scans.map(async (scan) => {
      return await Scan.findByPk(scan.id, {
        include: [
          {
            model: Target,
            as: 'target',
            attributes: ['id', 'domain', 'status']
          },
          {
            model: require('../models/User'),
            as: 'creator',
            attributes: ['id', 'name', 'email']
          }
        ]
      });
    }));

    res.status(201).json({
      success: true,
      message: 'Scans started successfully',
      data: scansWithTarget
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
    
    // Build where clause
    const whereClause = {
      organization_id: user.organization_id
    };

    // Add filters
    if (status) {
      if (Array.isArray(status)) {
        whereClause.status = { [Op.in]: status };
      } else {
        whereClause.status = status;
      }
    }

    if (target_id) {
      whereClause.target_id = target_id;
    }

    if (job_type) {
      whereClause.job_type = job_type;
    }

    // Get scans with pagination
    const { count, rows: scans } = await Scan.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Target,
          as: 'target',
          attributes: ['id', 'domain', 'status', 'description']
        },
        {
          model: require('../models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Add computed fields
    const scansWithComputedFields = scans.map(scan => {
      const scanData = scan.toJSON();
      
      // Calculate duration
      if (scan.started_at) {
        const endTime = scan.completed_at || new Date();
        scanData.duration_seconds = Math.floor((endTime - scan.started_at) / 1000);
      }
      
      // Add domain for easier frontend access
      scanData.domain = scan.target?.domain;
      
      return scanData;
    });

    // Get summary statistics
    const stats = await Scan.findOne({
      where: { organization_id: user.organization_id },
      attributes: [
        [Scan.sequelize.fn('COUNT', Scan.sequelize.col('id')), 'total'],
        [Scan.sequelize.fn('COUNT', Scan.sequelize.literal("CASE WHEN status = 'running' THEN 1 END")), 'running'],
        [Scan.sequelize.fn('COUNT', Scan.sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")), 'completed'],
        [Scan.sequelize.fn('COUNT', Scan.sequelize.literal("CASE WHEN status = 'failed' THEN 1 END")), 'failed'],
        [Scan.sequelize.fn('COUNT', Scan.sequelize.literal("CASE WHEN status = 'pending' THEN 1 END")), 'pending']
      ],
      raw: true
    });

    res.json({
      success: true,
      data: scansWithComputedFields,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      },
      stats: {
        total: parseInt(stats?.total || 0),
        running: parseInt(stats?.running || 0),
        completed: parseInt(stats?.completed || 0),
        failed: parseInt(stats?.failed || 0),
        pending: parseInt(stats?.pending || 0)
      }
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

    const scan = await Scan.findOne({
      where: {
        id,
        organization_id: user.organization_id
      },
      include: [
        {
          model: Target,
          as: 'target',
          attributes: ['id', 'domain', 'status', 'description']
        },
        {
          model: require('../models/User'),
          as: 'creator',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    // Add computed fields
    const scanData = scan.toJSON();
    
    if (scan.started_at) {
      const endTime = scan.completed_at || new Date();
      scanData.duration_seconds = Math.floor((endTime - scan.started_at) / 1000);
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

    const scan = await ScanJob.findOne({
      where: {
        id,
        organization_id: user.organization_id
      },
      include: [
        {
          model: Target,
          as: 'target'
        }
      ]
    });

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

    // Stop the scan job
    try {
      await ScanService.stopScanJob(scan);
    } catch (stopError) {
      console.error('Error stopping scan job:', stopError);
    }

    // Update scan status
    await scan.update({
      status: 'cancelled',
      completed_at: new Date()
    });

    // Check if this was the last running scan for the target
    const remainingScans = await ScanJob.count({
      where: {
        target_id: scan.target_id,
        status: ['pending', 'running']
      }
    });

    if (remainingScans === 0) {
      await scan.target.update({ status: 'active' });
    }

    res.json({
      success: true,
      message: 'Scan stopped successfully',
      data: scan
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
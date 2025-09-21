// backend/src/controllers/scans.js - Updated with live_hosts_scan support
const ScanJob = require('../models/ScanJob');
const Target = require('../models/Target');
const { validationResult, body } = require('express-validator');
const scanService = require('../services/scanService');

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

// Validation rules for starting a scan - UPDATED with live_hosts_scan
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
        'live_hosts_scan',     // NEW: Added live hosts scan
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

    // Enhanced conflict checking - allow multiple scan types but prevent duplicates
    const conflictingTypes = ['subdomain_scan', 'live_hosts_scan']; // Scans that can conflict
    const requestedConflictingTypes = scanTypes.filter(type => conflictingTypes.includes(type));
    
    if (requestedConflictingTypes.length > 0) {
      const existingScans = await ScanJob.findByTargetAndStatus(targetId, ['pending', 'running']);
      const existingConflictingScans = existingScans.filter(scan => 
        conflictingTypes.includes(scan.job_type) && requestedConflictingTypes.includes(scan.job_type)
      );

      if (existingConflictingScans.length > 0) {
        return res.status(409).json({
          success: false,
          message: `A ${existingConflictingScans[0].job_type} is already running for this target. Please wait for it to complete.`,
          data: {
            existing_scans: existingConflictingScans
          }
        });
      }
    }

    // Create scan records for each scan type
    const scans = [];
    
    for (const scanType of scanTypes) {
      // Add scan type specific configuration validation
      let scanConfig = { ...config };
      
      if (scanType === 'live_hosts_scan') {
        // Add default config for live hosts scan
        scanConfig = {
          batch_size: 5,
          request_timeout: 8000,
          include_http_check: true,
          include_https_check: true,
          extract_titles: true,
          dns_resolution: true,
          ...config
        };
      } else if (scanType === 'subdomain_scan') {
        // Add default config for subdomain scan
        scanConfig = {
          use_subfinder: true,
          use_amass: false,
          verify_alive: true,
          max_subdomains: 1000,
          ...config
        };
      }
      
      const scan = await ScanJob.create({
        target_id: targetId,
        job_type: scanType,
        scan_types: JSON.stringify([scanType]),
        priority,
        config: JSON.stringify(scanConfig),
        created_by: user.id,
        organization_id: user.organization_id,
        status: 'pending'
      });

      scans.push(scan);
    }

    // Start scan jobs AFTER all scans are created
    console.log(`Starting ${scans.length} scan jobs for target: ${target.domain}`);
    await scanService.startScanJobs(scans, target);

    // Update target status based on scan types
    let targetStatus = 'scanning';
    if (scanTypes.includes('live_hosts_scan') && !scanTypes.includes('subdomain_scan')) {
      targetStatus = 'verifying'; // Different status for live host verification
    }
    
    await Target.update(targetId, user.organization_id, { 
      status: targetStatus,
      last_scan_at: new Date()
    });

    console.log(`Created and started ${scans.length} scan jobs for target: ${target.domain}`);

    res.status(201).json({
      success: true,
      message: `${scans.length > 1 ? 'Scans' : 'Scan'} started successfully`,
      data: scans.map(scan => ({
        ...scan,
        scan_type_display: getScanTypeDisplay(scan.job_type)
      }))
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

// Helper function to get display names for scan types
function getScanTypeDisplay(jobType) {
  const displayNames = {
    'subdomain_scan': 'Subdomain Enumeration',
    'live_hosts_scan': 'Live Host Verification',
    'port_scan': 'Port Scanning',
    'content_discovery': 'Content Discovery',
    'js_files_scan': 'JavaScript Analysis',
    'api_discovery': 'API Discovery',
    'vulnerability_scan': 'Vulnerability Scanning',
    'full_scan': 'Full Comprehensive Scan'
  };
  
  return displayNames[jobType] || jobType;
}

// Get scan jobs with filtering - UPDATED to support job_type filtering
const getJobs = async (req, res) => {
  try {
    const { user } = req;
    const { 
      status,
      target_id,
      job_type,  // This is important for filtering by scan type
      page = 1, 
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    const filters = {
      status: status ? (Array.isArray(status) ? status : [status]) : undefined,
      target_id,
      job_type,  // Pass through job_type filter
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

    // Add computed fields and enhanced display information
    const scansWithComputedFields = scans.map(scan => {
      const scanData = {
        ...scan,
        config: safeJsonParse(scan.config, {}),
        results: safeJsonParse(scan.results, {}),
        scan_types: safeJsonParse(scan.scan_types, []),
        scan_type_display: getScanTypeDisplay(scan.job_type)
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
      stats,
      filters_applied: {
        job_type: job_type || 'all',
        status: status || 'all',
        target_id: target_id || 'all'
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

    const scan = await ScanJob.findById(id, user.organization_id);

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    // Add computed fields and enhanced display information
    const scanData = {
      ...scan,
      config: safeJsonParse(scan.config, {}),
      results: safeJsonParse(scan.results, {}),
      scan_types: safeJsonParse(scan.scan_types, []),
      scan_type_display: getScanTypeDisplay(scan.job_type)
    };
    
    if (scan.started_at) {
      const endTime = scan.completed_at ? new Date(scan.completed_at) : new Date();
      const startTime = new Date(scan.started_at);
      scanData.duration_seconds = Math.floor((endTime - startTime) / 1000);
    }

    // Add results summary based on scan type
    if (scanData.results && Object.keys(scanData.results).length > 0) {
      scanData.results_summary = generateResultsSummary(scan.job_type, scanData.results);
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

// Helper function to generate results summary
function generateResultsSummary(jobType, results) {
  switch (jobType) {
    case 'subdomain_scan':
      return {
        type: 'Subdomain Enumeration',
        total_subdomains: results.total_count || 0,
        alive_subdomains: results.alive_count || 0,
        tools_used: results.tools_used || [],
        success: (results.total_count || 0) > 0
      };
      
    case 'live_hosts_scan':
      return {
        type: 'Live Host Verification',
        total_checked: results.total_checked || 0,
        live_hosts: results.live_hosts || 0,
        newly_discovered: results.newly_discovered?.length || 0,
        success_rate: results.success_rate || 0,
        duration: results.scan_duration_seconds || 0
      };
      
    case 'port_scan':
      return {
        type: 'Port Scanning',
        total_ports: results.total_ports || 0,
        open_ports: results.open_ports || 0,
        scan_targets: results.scan_targets || 0,
        technique_used: results.scan_technique_used || 'unknown'
      };
      
    case 'content_discovery':
      return {
        type: 'Content Discovery',
        total_items: results.total_items || 0,
        endpoints: results.endpoints || 0,
        parameters: results.parameters || 0,
        xss_sinks: results.xss_sinks || 0
      };
      
    default:
      return {
        type: getScanTypeDisplay(jobType),
        raw_results: Object.keys(results).length
      };
  }
}

// Get scan results
const getScanResults = async (req, res) => {
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

    if (scan.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Scan is not completed. Current status: ${scan.status}`
      });
    }

    const scanData = {
      scanJob: {
        id: scan.id,
        job_type: scan.job_type,
        scan_type_display: getScanTypeDisplay(scan.job_type),
        status: scan.status,
        started_at: scan.started_at,
        completed_at: scan.completed_at,
        duration_seconds: scan.started_at && scan.completed_at ? 
          Math.floor((new Date(scan.completed_at) - new Date(scan.started_at)) / 1000) : null
      },
      results: safeJsonParse(scan.results, {}),
      results_summary: generateResultsSummary(scan.job_type, safeJsonParse(scan.results, {}))
    };

    res.json({
      success: true,
      data: scanData
    });

  } catch (error) {
    console.error('Error fetching scan results:', error);
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

    // Stop the scan job using scan service
    await scanService.stopScanJob(scan);

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
      message: `${getScanTypeDisplay(scan.job_type)} stopped successfully`,
      data: {
        ...updatedScan,
        scan_type_display: getScanTypeDisplay(updatedScan.job_type)
      }
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
  getScanResults,
  stopScan,
  scanValidation
};
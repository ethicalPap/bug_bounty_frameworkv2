// backend/src/controllers/targets.js
const Target = require('../models/Target');
const ScanJob = require('../models/ScanJob');
const { validationResult, body } = require('express-validator');

// Add express-validator to your package.json dependencies
const targetValidation = [
  body('domain')
    .isLength({ min: 1 })
    .withMessage('Domain is required')
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/)
    .withMessage('Please enter a valid domain'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters')
];

// Create a new target
const createTarget = async (req, res) => {
  try {
    const { domain, description, tags } = req.body;
    const { user } = req;

    // Basic validation
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: 'Domain is required'
      });
    }

    // Check if target already exists for this organization
    const existingTarget = await Target.findByDomain(domain, user.organization_id);

    if (existingTarget) {
      return res.status(409).json({
        success: false,
        message: 'Target with this domain already exists'
      });
    }

    // Create new target
    const target = await Target.create({
      domain: domain.toLowerCase(),
      description,
      tags: JSON.stringify(tags || []),
      organization_id: user.organization_id,
      created_by: user.id,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'Target created successfully',
      data: target
    });

  } catch (error) {
    console.error('Error creating target:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all targets for the organization
const getTargets = async (req, res) => {
  try {
    const { user } = req;
    const { 
      page = 1, 
      limit = 50, 
      search, 
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    const filters = {
      search,
      status,
      sortBy,
      sortOrder: sortOrder.toLowerCase(),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    // Get targets with pagination
    const [targets, total] = await Promise.all([
      Target.findAll(user.organization_id, filters),
      Target.count(user.organization_id, { search, status })
    ]);

    // Calculate stats for each target (simplified for now)
    const targetsWithStats = targets.map(target => ({
      ...target,
      stats: target.stats ? JSON.parse(target.stats) : { subdomains: 0, ports: 0, vulnerabilities: 0 },
      tags: target.tags ? JSON.parse(target.tags) : [],
      recent_scans: 0 // TODO: Calculate recent scans
    }));

    res.json({
      success: true,
      data: targetsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get a single target
const getTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const target = await Target.findById(id, user.organization_id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    // Parse JSON fields
    const targetData = {
      ...target,
      stats: target.stats ? JSON.parse(target.stats) : { subdomains: 0, ports: 0, vulnerabilities: 0 },
      tags: target.tags ? JSON.parse(target.tags) : []
    };

    res.json({
      success: true,
      data: targetData
    });

  } catch (error) {
    console.error('Error fetching target:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update a target
const updateTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.domain;
    delete updateData.organization_id;
    delete updateData.created_by;

    // Handle tags array
    if (updateData.tags) {
      updateData.tags = JSON.stringify(updateData.tags);
    }

    const target = await Target.findById(id, user.organization_id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    const updatedTarget = await Target.update(id, user.organization_id, updateData);

    if (!updatedTarget) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    // Parse JSON fields for response
    const targetData = {
      ...updatedTarget,
      stats: updatedTarget.stats ? JSON.parse(updatedTarget.stats) : { subdomains: 0, ports: 0, vulnerabilities: 0 },
      tags: updatedTarget.tags ? JSON.parse(updatedTarget.tags) : []
    };

    res.json({
      success: true,
      message: 'Target updated successfully',
      data: targetData
    });

  } catch (error) {
    console.error('Error updating target:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete a target
const deleteTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const target = await Target.findById(id, user.organization_id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target not found'
      });
    }

    // Check for running scans
    const runningScans = await ScanJob.count(user.organization_id, {
      target_id: id,
      status: 'running'
    });

    if (runningScans > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete target with running scans. Please stop all scans first.'
      });
    }

    await Target.delete(id, user.organization_id);

    res.json({
      success: true,
      message: 'Target deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting target:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createTarget,
  getTargets,
  getTarget,
  updateTarget,
  deleteTarget,
  targetValidation
};
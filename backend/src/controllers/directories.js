// backend/src/controllers/directories.js - FIXED WITH CONTENT TYPE FILTER
const Directory = require('../models/Directory');

const getDirectories = async (req, res) => {
  try {
    const { user } = req;
    const { 
      target_id,
      subdomain_id,
      status_code,
      source,
      content_type,
      page = 1, 
      limit = 50,
      search,
      sortBy = 'path',
      sortOrder = 'asc'
    } = req.query;

    const offset = (page - 1) * limit;
    
    const filters = {
      target_id,
      subdomain_id,
      status_code,
      source,
      content_type, // Added content_type filter
      search,
      sortBy,
      sortOrder: sortOrder.toLowerCase(),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    console.log('Directory filters applied:', filters);

    const [directories, total] = await Promise.all([
      Directory.findAll(user.organization_id, filters),
      Directory.count(user.organization_id, { 
        target_id, 
        subdomain_id, 
        status_code,
        source,
        content_type,
        search 
      })
    ]);

    res.json({
      success: true,
      data: directories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching directories:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getStats = async (req, res) => {
  try {
    const { user } = req;
    const stats = await Directory.getStatsByTarget(user.organization_id);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching directory stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// New endpoint: Update status codes for directories without them
const updateStatusCodes = async (req, res) => {
  try {
    const { user } = req;
    const { subdomain_id, path_status_map } = req.body;

    if (!subdomain_id || !path_status_map || typeof path_status_map !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'subdomain_id and path_status_map are required'
      });
    }

    const updated = await Directory.updateStatusCodes(subdomain_id, path_status_map);
    
    res.json({
      success: true,
      message: `Updated status codes for ${updated} directories`,
      data: { updated_count: updated }
    });

  } catch (error) {
    console.error('Error updating directory status codes:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// New endpoint: Get directories pending status code checks
const getPendingStatusChecks = async (req, res) => {
  try {
    const { user } = req;
    const { limit = 100 } = req.query;

    const pending = await Directory.getPendingStatusChecks(user.organization_id, parseInt(limit));
    
    res.json({
      success: true,
      data: pending,
      total: pending.length
    });

  } catch (error) {
    console.error('Error fetching pending status checks:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getDirectories,
  getStats,
  updateStatusCodes,
  getPendingStatusChecks
};
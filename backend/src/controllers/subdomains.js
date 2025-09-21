// backend/src/controllers/subdomains.js
const Subdomain = require('../models/Subdomain');
const { validationResult, query } = require('express-validator');

const getSubdomains = async (req, res) => {
  try {
    const { user } = req;
    const { 
      target_id,
      status,
      http_status,  // ← ADD THIS LINE
      page = 1, 
      limit = 50,
      search,
      sortBy = 'subdomain',
      sortOrder = 'asc'
    } = req.query;

    const offset = (page - 1) * limit;
    
    const filters = {
      target_id,
      status,
      http_status,  // ← ADD THIS LINE
      search,
      sortBy,
      sortOrder: sortOrder.toLowerCase(),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const [subdomains, total] = await Promise.all([
      Subdomain.findAll(user.organization_id, filters),
      Subdomain.count(user.organization_id, { target_id, status, http_status })  // ← ADD http_status HERE
    ]);

    res.json({
      success: true,
      data: subdomains,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subdomains:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const checkLiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const result = await Subdomain.checkLiveStatus(id, user.organization_id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Subdomain not found'
      });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error checking live status:', error);
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
    const stats = await Subdomain.getStatsByTarget(user.organization_id);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching subdomain stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getSubdomains,
  checkLiveStatus,
  getStats
};
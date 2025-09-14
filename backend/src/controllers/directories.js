// backend/src/controllers/directories.js
const Directory = require('../models/Directory');

const getDirectories = async (req, res) => {
  try {
    const { user } = req;
    const { 
      target_id,
      subdomain_id,
      status_code,
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
      search,
      sortBy,
      sortOrder: sortOrder.toLowerCase(),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const [directories, total] = await Promise.all([
      Directory.findAll(user.organization_id, filters),
      Directory.count(user.organization_id, { target_id, subdomain_id })
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

module.exports = {
  getDirectories,
  getStats
};
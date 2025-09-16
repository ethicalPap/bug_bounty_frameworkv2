// backend/src/controllers/ports.js
const Port = require('../models/Port');

const getPorts = async (req, res) => {
  try {
    const { user } = req;
    const { 
      target_id,
      subdomain_id,
      subdomain_status,
      state,
      service_search,
      page = 1, 
      limit = 50,
      sortBy = 'port',
      sortOrder = 'asc'
    } = req.query;

    const offset = (page - 1) * limit;
    
    const filters = {
      target_id,
      subdomain_id,
      subdomain_status,
      state,
      service_search,
      sortBy,
      sortOrder: sortOrder.toLowerCase(),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const [ports, total] = await Promise.all([
      Port.findAll(user.organization_id, filters),
      Port.count(user.organization_id, { target_id, subdomain_id, subdomain_status, state })
    ]);

    res.json({
      success: true,
      data: ports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching ports:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPortById = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    const port = await Port.findById(id, user.organization_id);

    if (!port) {
      return res.status(404).json({
        success: false,
        message: 'Port not found'
      });
    }

    res.json({
      success: true,
      data: port
    });

  } catch (error) {
    console.error('Error fetching port:', error);
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
    const stats = await Port.getStatsByTarget(user.organization_id);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching port stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updatePort = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.subdomain_id;
    delete updateData.port;
    delete updateData.protocol;
    delete updateData.scan_job_id;

    const port = await Port.update(id, user.organization_id, updateData);

    if (!port) {
      return res.status(404).json({
        success: false,
        message: 'Port not found'
      });
    }

    res.json({
      success: true,
      message: 'Port updated successfully',
      data: port
    });

  } catch (error) {
    console.error('Error updating port:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getPorts,
  getPortById,
  getStats,
  updatePort
};
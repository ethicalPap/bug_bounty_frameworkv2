// backend/src/controllers/vulnerabilities.js
const Vulnerability = require('../models/Vulnerability');

const getVulnerabilities = async (req, res) => {
  try {
    const { user } = req;
    const { 
      target_id,
      subdomain_id,
      severity,
      status,
      page = 1, 
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    
    const filters = {
      target_id,
      subdomain_id,
      severity,
      status,
      sortBy,
      sortOrder: sortOrder.toLowerCase(),
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const [vulnerabilities, total] = await Promise.all([
      Vulnerability.findAll(user.organization_id, filters),
      Vulnerability.count(user.organization_id, { target_id, severity })
    ]);

    res.json({
      success: true,
      data: vulnerabilities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching vulnerabilities:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateVulnerability = async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const updateData = req.body;

    const vulnerability = await Vulnerability.update(id, user.organization_id, updateData);

    if (!vulnerability) {
      return res.status(404).json({
        success: false,
        message: 'Vulnerability not found'
      });
    }

    res.json({
      success: true,
      data: vulnerability
    });

  } catch (error) {
    console.error('Error updating vulnerability:', error);
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
    const stats = await Vulnerability.getStatsByTarget(user.organization_id);
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching vulnerability stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getVulnerabilities,
  updateVulnerability,
  getStats
};
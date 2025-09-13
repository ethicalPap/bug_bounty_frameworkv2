// backend/src/models/Subdomain.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Subdomain = sequelize.define('Subdomain', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  target_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'targets',
      key: 'id'
    }
  },
  subdomain: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'resolved', 'error'),
    defaultValue: 'active'
  },
  last_seen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  first_discovered: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  scan_job_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'scan_jobs',
      key: 'id'
    }
  },
  ports: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  technologies: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  http_status: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'subdomains',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associations
Subdomain.associate = (models) => {
  Subdomain.belongsTo(models.Target, {
    foreignKey: 'target_id',
    as: 'target'
  });
  
  Subdomain.belongsTo(models.ScanJob, {
    foreignKey: 'scan_job_id',
    as: 'scan_job'
  });
};

module.exports = Subdomain;
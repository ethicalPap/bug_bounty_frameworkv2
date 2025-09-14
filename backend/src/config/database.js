// backend/src/config/database.js
const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

// Create and export the knex instance
const db = knex(config);

// Test connection on startup
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    console.error('Connection config:', {
      host: config.connection.host,
      port: config.connection.port,
      user: config.connection.user,
      database: config.connection.database
    });
  });

module.exports = db;
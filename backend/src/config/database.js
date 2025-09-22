// backend/src/config/database.js - FIXED WITH PROPER CONNECTION MANAGEMENT
const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

console.log(`📊 Database environment: ${environment}`);
console.log(`🔗 Database config:`, {
  host: config.connection.host,
  port: config.connection.port,
  database: config.connection.database,
  user: config.connection.user,
  poolMin: config.pool?.min,
  poolMax: config.pool?.max
});

// Create and export the knex instance
const db = knex(config);

// Enhanced connection testing with proper error handling
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ Database connected successfully');
    console.log(`🏊 Connection pool: min=${config.pool?.min || 'default'}, max=${config.pool?.max || 'default'}`);
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err.message);
    console.error('🔧 Connection config:', {
      host: config.connection.host,
      port: config.connection.port,
      user: config.connection.user,
      database: config.connection.database
    });
    
    // Log specific connection issues
    if (err.code === 'ECONNREFUSED') {
      console.error('💡 Suggestion: Make sure PostgreSQL is running on the specified host and port');
    } else if (err.code === 'ENOTFOUND') {
      console.error('💡 Suggestion: Check the database host configuration');
    } else if (err.message.includes('authentication')) {
      console.error('💡 Suggestion: Verify database username and password');
    } else if (err.message.includes('does not exist')) {
      console.error('💡 Suggestion: Create the database or check the database name');
    }
  });

// Add connection pool monitoring
db.on('query', (query) => {
  if (process.env.DEBUG_SQL === 'true') {
    console.log('🔍 SQL Query:', query.sql);
  }
});

// Monitor connection pool health
const monitorPool = () => {
  const pool = db.client.pool;
  if (pool) {
    console.log(`📊 Pool status: used=${pool.numUsed()}, free=${pool.numFree()}, pending=${pool.numPendingAcquires()}, pending_creates=${pool.numPendingCreates()}`);
  }
};

// Log pool status every 30 seconds in debug mode
if (process.env.DEBUG_POOL === 'true') {
  setInterval(monitorPool, 30000);
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully shutting down database connections...');
  try {
    await db.destroy();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('🔄 Received SIGTERM, shutting down database connections...');
  try {
    await db.destroy();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
    process.exit(1);
  }
});

// Export database instance
module.exports = db;
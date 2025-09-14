// backend/scripts/init-db.js
require('dotenv').config();
const { Client } = require('pg');
const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

async function initializeDatabase() {
  console.log('🔄 Initializing database...');
  
  // First, connect to postgres database to create our app database if it doesn't exist
  const adminClient = new Client({
    host: config.connection.host,
    port: config.connection.port,
    user: config.connection.user,
    password: config.connection.password,
    database: 'postgres' // Connect to default postgres database
  });

  try {
    await adminClient.connect();
    console.log('✅ Connected to PostgreSQL server');

    // Check if database exists
    const dbExistsQuery = `
      SELECT 1 FROM pg_database WHERE datname = $1
    `;
    const result = await adminClient.query(dbExistsQuery, [config.connection.database]);

    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      console.log(`📦 Creating database: ${config.connection.database}`);
      await adminClient.query(`CREATE DATABASE "${config.connection.database}"`);
      console.log('✅ Database created successfully');
    } else {
      console.log(`✅ Database "${config.connection.database}" already exists`);
    }

  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  } finally {
    await adminClient.end();
  }

  // Now connect to our app database and run migrations
  let db;
  try {
    db = knex(config);
    
    // Test connection
    await db.raw('SELECT 1');
    console.log('✅ Connected to application database');

    // Run migrations
    console.log('🔄 Running database migrations...');
    const [batchNo, migrations] = await db.migrate.latest();
    
    if (migrations.length === 0) {
      console.log('✅ Database is already up to date');
    } else {
      console.log(`✅ Ran ${migrations.length} migrations:`);
      migrations.forEach(migration => {
        console.log(`  - ${migration}`);
      });
    }

    // Check if we should run seeds
    if (process.env.RUN_SEEDS === 'true') {
      console.log('🌱 Running database seeds...');
      await db.seed.run();
      console.log('✅ Seeds completed');
    }

    console.log('🎉 Database initialization completed successfully');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

// Helper function to wait for database to be ready
async function waitForDatabase(maxRetries = 30, retryInterval = 1000) {
  console.log('⏳ Waiting for database to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = new Client({
        host: config.connection.host,
        port: config.connection.port,
        user: config.connection.user,
        password: config.connection.password,
        database: 'postgres',
        connectionTimeoutMillis: 5000
      });

      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      
      console.log('✅ Database server is ready');
      return;
    } catch (error) {
      console.log(`⏳ Attempt ${i + 1}/${maxRetries}: Database not ready yet...`);
      if (i === maxRetries - 1) {
        throw new Error(`Database not ready after ${maxRetries} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
}

async function main() {
  try {
    await waitForDatabase();
    await initializeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { initializeDatabase, waitForDatabase };
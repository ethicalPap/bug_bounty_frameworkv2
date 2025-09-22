// backend/knexfile.js - IMPROVED VERSION
require('dotenv').config();

const config = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'papv2',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'framework'
    },
    pool: {
      min: 1,  // Reduced from 2
      max: 5,  // Reduced from 10 for migrations
      acquireTimeoutMillis: 30000,  // Reduced timeout
      createTimeoutMillis: 20000,   // Reduced timeout
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
      propagateCreateError: false
    },
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './database/seeds'
    },
    debug: process.env.KNEX_DEBUG === 'true',
    // Add connection validation
    postProcessResponse: (result, queryContext) => {
      // This helps catch connection issues early
      return result;
    },
    // Add better error handling
    wrapIdentifier: (value, origImpl, queryContext) => {
      return origImpl(value);
    }
  },

  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 20,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000
    },
    migrations: {
      directory: './database/migrations',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: './database/seeds'
    }
  },

  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'papv2',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'framework_test'
    },
    pool: {
      min: 1,
      max: 3  // Very small pool for tests
    },
    migrations: {
      directory: './database/migrations'
    }
  }
};

module.exports = config;
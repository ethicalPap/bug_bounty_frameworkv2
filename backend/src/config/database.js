const knex = require('knex');

const config = {
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'papv2',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'framework'
  },
  pool: {
    min: 2,
    max: 10
  }
};

const db = knex(config);

db.raw('SELECT 1')
  .then(() => {
    console.log('Database connected successfully');
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
  });

module.exports = db;
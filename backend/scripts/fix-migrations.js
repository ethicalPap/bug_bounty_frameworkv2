// backend/scripts/fix-migrations.js
require('dotenv').config();
const { Client } = require('pg');
const knex = require('knex');
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

async function fixMigrations() {
  console.log('🔧 Fixing database migrations...');
  
  let db;
  try {
    db = knex(config);
    
    // Test connection
    await db.raw('SELECT 1');
    console.log('✅ Connected to database');

    // Check which tables exist
    console.log('\n📋 Checking existing tables...');
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const existingTables = tables.rows.map(row => row.table_name);
    console.log('Existing tables:', existingTables);

    // Check migration tracking table
    const migrationTableExists = existingTables.includes('knex_migrations');
    console.log(`\n📊 Migration tracking table exists: ${migrationTableExists}`);

    if (migrationTableExists) {
      // Check which migrations are recorded as completed
      const completedMigrations = await db('knex_migrations')
        .select('name')
        .orderBy('id');
      
      console.log('\n✅ Completed migrations:');
      completedMigrations.forEach(migration => {
        console.log(`  - ${migration.name}`);
      });
    }

    // Define expected tables and their corresponding migration files
    const expectedTables = [
      { table: 'organizations', migration: '001_create_organizations.js' },
      { table: 'users', migration: '002_create_users.js' },
      { table: 'targets', migration: '003_create_targets.js' },
      { table: 'subdomains', migration: '004_create_subdomains.js' },
      { table: 'scan_jobs', migration: '005_create_scan_jobs.js' },
      { table: 'directories', migration: '007_create_directories.js' },
      { table: 'vulnerabilities', migration: '008_create_vulnerabilities.js' },
      { table: 'ports', migration: '009_create_ports.js' }
    ];

    // Check which tables exist but might not be recorded in migrations
    console.log('\n🔍 Analyzing table/migration status...');
    const missingMigrations = [];
    
    for (const { table, migration } of expectedTables) {
      const tableExists = existingTables.includes(table);
      let migrationRecorded = false;
      
      if (migrationTableExists) {
        const migrationRecord = await db('knex_migrations')
          .where('name', migration)
          .first();
        migrationRecorded = !!migrationRecord;
      }
      
      console.log(`  ${table}: table=${tableExists}, migration=${migrationRecorded}`);
      
      if (tableExists && !migrationRecorded) {
        missingMigrations.push(migration);
      }
    }

    // Fix missing migration records
    if (missingMigrations.length > 0) {
      console.log('\n🔧 Fixing missing migration records...');
      
      if (!migrationTableExists) {
        console.log('Creating knex_migrations table...');
        await db.schema.createTable('knex_migrations', (table) => {
          table.increments('id').primary();
          table.string('name');
          table.integer('batch');
          table.timestamp('migration_time');
        });
      }

      // Get the current batch number
      const lastBatch = await db('knex_migrations')
        .max('batch as max_batch')
        .first();
      
      const nextBatch = (lastBatch?.max_batch || 0) + 1;

      // Insert missing migration records
      for (const migration of missingMigrations) {
        console.log(`  Adding migration record: ${migration}`);
        await db('knex_migrations').insert({
          name: migration,
          batch: nextBatch,
          migration_time: new Date()
        });
      }
    }

    // Fix the ports table if it has the syntax error
    console.log('\n🔧 Checking ports table structure...');
    try {
      const portsColumns = await db.raw(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'ports'
        ORDER BY ordinal_position
      `);
      
      console.log('Ports table columns:', portsColumns.rows.length);
      
      // Check if the table has the proper constraints
      const constraints = await db.raw(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'ports'
      `);
      
      console.log('Ports table constraints:', constraints.rows.length);
      
    } catch (error) {
      console.log('Ports table structure check failed:', error.message);
    }

    console.log('\n✅ Migration fix completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart your backend: docker-compose restart backend');
    console.log('2. Check logs: docker logs framework_backend');
    console.log('3. The backend should now start without migration errors');

  } catch (error) {
    console.error('❌ Migration fix failed:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

// Helper function to reset migrations completely (DANGEROUS!)
async function resetMigrations() {
  console.log('⚠️  RESETTING ALL MIGRATIONS - THIS WILL DROP ALL TABLES!');
  console.log('This should only be used in development!');
  
  let db;
  try {
    db = knex(config);
    
    // Drop all tables
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != 'knex_migrations'
      AND table_name != 'knex_migrations_lock'
    `);
    
    console.log('Dropping tables...');
    for (const table of tables.rows) {
      console.log(`  Dropping ${table.table_name}`);
      await db.schema.dropTableIfExists(table.table_name);
    }
    
    // Clear migration records
    await db('knex_migrations').del();
    
    console.log('✅ All tables dropped and migration records cleared');
    console.log('Now run: npm run migrate');
    
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    throw error;
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'reset') {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Cannot reset migrations in production!');
      process.exit(1);
    }
    await resetMigrations();
  } else {
    await fixMigrations();
  }
  
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fixMigrations, resetMigrations };
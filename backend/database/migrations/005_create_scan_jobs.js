// backend/database/migrations/005_create_scan_jobs.js
exports.up = function(knex) {
  return knex.schema.createTable('scan_jobs', function(table) {
    table.increments('id').primary();
    table.integer('target_id').notNullable(); // Keep as integer since targets.id is integer
    table.enum('job_type', [
      'subdomain_scan',
      'port_scan', 
      'content_discovery',
      'js_files_scan',
      'api_discovery',
      'vulnerability_scan',
      'full_scan'
    ]).notNullable();
    table.enum('status', ['pending', 'running', 'completed', 'failed', 'cancelled']).defaultTo('pending');
    table.integer('progress_percentage').defaultTo(0);
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.uuid('created_by').notNullable(); // Changed to UUID
    table.uuid('organization_id').notNullable(); // Changed to UUID
    table.json('config').defaultTo(JSON.stringify({}));
    table.json('results').defaultTo(JSON.stringify({}));
    table.text('error_message');
    table.json('scan_types').defaultTo(JSON.stringify([]));
    table.enum('priority', ['low', 'medium', 'high', 'urgent']).defaultTo('medium');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['target_id']);
    table.index(['status']);
    table.index(['job_type']);
    table.index(['organization_id']);
    table.index(['created_at']);
    
    // Foreign keys
    table.foreign('target_id').references('targets.id').onDelete('CASCADE');
    table.foreign('created_by').references('users.id').onDelete('RESTRICT');
    table.foreign('organization_id').references('organizations.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('scan_jobs');
};
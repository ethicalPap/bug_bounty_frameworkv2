// backend/database/migrations/003_create_targets.js
exports.up = function(knex) {
  return knex.schema.createTable('targets', function(table) {
    table.increments('id').primary();
    table.string('domain').notNullable();
    table.text('description');
    table.enum('status', ['active', 'inactive', 'scanning', 'error']).defaultTo('active');
    table.uuid('organization_id').notNullable(); // Changed to UUID
    table.uuid('created_by').notNullable(); // Changed to UUID (assuming users also use UUID)
    table.timestamp('last_scan_at');
    table.json('stats').defaultTo(JSON.stringify({
      subdomains: 0,
      ports: 0,
      vulnerabilities: 0,
      last_updated: null
    }));
    table.enum('risk_level', ['low', 'medium', 'high', 'critical']).defaultTo('low');
    table.json('tags').defaultTo(JSON.stringify([]));
    table.timestamps(true, true);
    
    // Indexes
    table.index(['organization_id']);
    table.index(['domain']);
    table.index(['status']);
    
    // Unique constraint
    table.unique(['domain', 'organization_id']);
    
    // Foreign keys
    table.foreign('organization_id').references('organizations.id').onDelete('CASCADE');
    table.foreign('created_by').references('users.id').onDelete('RESTRICT');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('targets');
};
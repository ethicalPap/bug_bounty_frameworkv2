// backend/database/migrations/004_create_subdomains.js
exports.up = function(knex) {
  return knex.schema.createTable('subdomains', function(table) {
    table.increments('id').primary();
    table.integer('target_id').notNullable();
    table.string('subdomain').notNullable();
    table.string('ip_address');
    table.enum('status', ['active', 'inactive', 'resolved', 'error']).defaultTo('active');
    table.timestamp('last_seen');
    table.timestamp('first_discovered').defaultTo(knex.fn.now());
    table.integer('scan_job_id');
    table.json('ports').defaultTo(JSON.stringify([]));
    table.json('technologies').defaultTo(JSON.stringify([]));
    table.string('title');
    table.integer('http_status');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['target_id']);
    table.index(['subdomain']);
    table.index(['status']);
    
    // Unique constraint for subdomain per target
    table.unique(['subdomain', 'target_id']);
    
    // Foreign key to targets only
    table.foreign('target_id').references('targets.id').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('subdomains');
};
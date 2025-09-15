// backend/database/migrations/009_create_ports.js
exports.up = function(knex) {
  return knex.schema.createTable('ports', function(table) {
    table.increments('id').primary();
    table.integer('subdomain_id').notNullable();
    table.integer('port').notNullable();
    table.string('protocol').defaultTo('tcp');
    table.enum('state', ['open', 'closed', 'filtered']).notNullable();
    table.string('service');
    table.string('version');
    table.text('banner');
    table.json('service_info').defaultTo(JSON.stringify({}));
    table.integer('scan_job_id');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['subdomain_id']);
    table.index(['port']);
    table.index(['state']);
    
    // Unique constraint
    table.unique(['subdomain_id', 'port', 'protocol']);
    
    // Foreign keys
    table.foreign('subdomain_id').references('subdomains.id').onDelete('CASCADE');
    table.foreign('scan_job_id').references('scan_jobs.id').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('ports');
};
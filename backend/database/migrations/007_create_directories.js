// backend/database/migrations/007_create_directories.js
exports.up = function(knex) {
  return knex.schema.createTable('directories', function(table) {
    table.increments('id').primary();
    table.integer('subdomain_id').notNullable();
    table.string('path').notNullable();
    table.string('url').notNullable();
    table.integer('status_code');
    table.string('source'); // e.g., "gobuster", "ffuf", "custom"
    table.integer('content_length');
    table.integer('response_time');
    table.string('title');
    table.text('headers');
    table.text('body_preview');
    table.enum('method', ['GET', 'POST', 'PUT', 'DELETE', 'HEAD']).defaultTo('GET');
    table.integer('scan_job_id');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['subdomain_id']);
    table.index(['status_code']);
    table.index(['path']);
    
    // Unique constraint
    table.unique(['subdomain_id', 'path']);
    
    // Foreign keys
    table.foreign('subdomain_id').references('subdomains.id').onDelete('CASCADE');
    table.foreign('scan_job_id').references('scan_jobs.id').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('directories');
};




// backend/database/migrations/007_create_directories.js
exports.up = function(knex) {
  return knex.schema.createTable('directories', function(table) {
    table.increments('id').primary();
    table.integer('subdomain_id').notNullable();
    table.string('path').notNullable();
    table.string('url').notNullable();
    table.integer('status_code');
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

// backend/database/migrations/008_create_vulnerabilities.js
exports.up = function(knex) {
  return knex.schema.createTable('vulnerabilities', function(table) {
    table.increments('id').primary();
    table.integer('target_id').notNullable();
    table.integer('subdomain_id');
    table.string('title').notNullable();
    table.text('description');
    table.enum('severity', ['info', 'low', 'medium', 'high', 'critical']).notNullable();
    table.enum('status', ['open', 'confirmed', 'false_positive', 'fixed']).defaultTo('open');
    table.string('url');
    table.string('method').defaultTo('GET');
    table.text('request');
    table.text('response');
    table.text('proof_of_concept');
    table.json('references').defaultTo(JSON.stringify([]));
    table.string('cve_id');
    table.float('cvss_score');
    table.integer('scan_job_id');
    table.timestamp('verified_at');
    table.timestamps(true, true);
    
    // Indexes
    table.index(['target_id']);
    table.index(['subdomain_id']);
    table.index(['severity']);
    table.index(['status']);
    
    // Unique constraint to prevent duplicates
    table.unique(['target_id', 'title', 'url']);
    
    // Foreign keys
    table.foreign('target_id').references('targets.id').onDelete('CASCADE');
    table.foreign('subdomain_id').references('subdomains.id').onDelete('SET NULL');
    table.foreign('scan_job_id').references('scan_jobs.id').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('vulnerabilities');
};

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
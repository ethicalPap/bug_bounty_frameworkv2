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
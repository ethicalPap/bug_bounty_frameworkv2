// backend/database/migrations/006_add_scan_job_foreign_key.js
exports.up = function(knex) {
  return knex.schema.alterTable('subdomains', function(table) {
    // Add foreign key constraint now that scan_jobs table exists
    table.foreign('scan_job_id').references('scan_jobs.id').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('subdomains', function(table) {
    // Remove the foreign key constraint
    table.dropForeign(['scan_job_id']);
  });
};
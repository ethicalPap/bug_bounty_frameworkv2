// backend/database/migrations/011_add_live_hosts_scan_type.js
exports.up = function(knex) {
  return knex.raw(`
    ALTER TABLE scan_jobs 
    DROP CONSTRAINT IF EXISTS scan_jobs_job_type_check;
    
    ALTER TABLE scan_jobs 
    ADD CONSTRAINT scan_jobs_job_type_check 
    CHECK (job_type IN (
      'subdomain_scan',
      'port_scan', 
      'content_discovery',
      'js_files_scan',
      'api_discovery',
      'vulnerability_scan',
      'full_scan',
      'live_hosts_scan'
    ));
  `);
};

exports.down = function(knex) {
  return knex.raw(`
    ALTER TABLE scan_jobs 
    DROP CONSTRAINT IF EXISTS scan_jobs_job_type_check;
    
    ALTER TABLE scan_jobs 
    ADD CONSTRAINT scan_jobs_job_type_check 
    CHECK (job_type IN (
      'subdomain_scan',
      'port_scan', 
      'content_discovery',
      'js_files_scan',
      'api_discovery',
      'vulnerability_scan',
      'full_scan'
    ));
  `);
};
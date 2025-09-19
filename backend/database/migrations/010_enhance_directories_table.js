// backend/database/migrations/010_enhance_directories_table.js - FIXED
exports.up = function(knex) {
  return knex.schema.alterTable('directories', function(table) {
    // Add new columns for enhanced content discovery
    table.string('content_type').defaultTo('endpoint'); // endpoint, parameter, xss_sink, form, ajax, api
    table.enum('risk_level', ['low', 'medium', 'high', 'critical']).defaultTo('low');
    table.text('parameters'); // Comma-separated list of parameters
    table.text('notes'); // Additional notes about the discovery
    // REMOVED: table.text('body_preview', 1000); // This column already exists from migration 007
    
    // Add indexes for better performance
    table.index(['content_type']);
    table.index(['risk_level']); 
    table.index(['source']);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('directories', function(table) {
    // Remove indexes first
    table.dropIndex(['content_type']);
    table.dropIndex(['risk_level']); 
    table.dropIndex(['source']);
    
    // Remove columns (excluding body_preview since it was in original table)
    table.dropColumn('content_type');
    table.dropColumn('risk_level');
    table.dropColumn('parameters');
    table.dropColumn('notes');
  });
};
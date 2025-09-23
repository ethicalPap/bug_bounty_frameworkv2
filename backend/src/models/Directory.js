// backend/src/models/Directory.js - FIXED VERSION WITH DEDUPLICATION
const knex = require('../config/database');

class Directory {
  static get tableName() {
    return 'directories';
  }

  // Cache for table schema to avoid repeated queries
  static _tableSchema = null;

  // Get table schema and cache it
  static async getTableSchema() {
    if (this._tableSchema) {
      return this._tableSchema;
    }

    try {
      const columns = await knex(this.tableName).columnInfo();
      this._tableSchema = Object.keys(columns);
      console.log(`📋 Directory table columns:`, this._tableSchema);
      return this._tableSchema;
    } catch (error) {
      console.warn('Could not get table schema:', error.message);
      // Return basic columns if we can't get schema
      return ['id', 'subdomain_id', 'path', 'url', 'status_code', 'source', 'content_length', 'response_time', 'title', 'headers', 'body_preview', 'method', 'scan_job_id', 'created_at', 'updated_at'];
    }
  }

  static async findAll(organizationId, filters = {}) {
    try {
      const columns = await this.getTableSchema();
      const hasEnhancedColumns = columns.includes('content_type');
      
      let query = knex(this.tableName)
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId);

      // Select base columns that always exist
      const selectColumns = [
        'directories.id',
        'directories.subdomain_id',
        'directories.path',
        'directories.url',
        'directories.status_code',
        'directories.source',
        'directories.content_length',
        'directories.response_time',
        'directories.title',
        'directories.headers',
        'directories.body_preview',
        'directories.method',
        'directories.scan_job_id',
        'directories.created_at',
        'directories.updated_at',
        'subdomains.subdomain',
        'targets.domain as target_domain',
        'targets.id as target_id'
      ];

      // Add enhanced columns if they exist
      if (hasEnhancedColumns) {
        selectColumns.push(
          'directories.content_type',
          'directories.risk_level',
          'directories.parameters',
          'directories.notes'
        );
      }

      query = query.select(selectColumns);
      
      if (filters.target_id) {
        query = query.where('targets.id', filters.target_id);
      }
      
      if (filters.subdomain_id) {
        query = query.where('directories.subdomain_id', filters.subdomain_id);
      }
      
      if (filters.status_code) {
        if (Array.isArray(filters.status_code)) {
          query = query.whereIn('directories.status_code', filters.status_code);
        } else {
          query = query.where('directories.status_code', filters.status_code);
        }
      }

      if (filters.source) {
        query = query.where('directories.source', filters.source);
      }

      // Only apply content_type filter if the column exists
      if (filters.content_type && hasEnhancedColumns) {
        query = query.where('directories.content_type', filters.content_type);
      }
      
      if (filters.search) {
        query = query.where(function() {
          this.where('directories.path', 'ilike', `%${filters.search}%`)
              .orWhere('directories.title', 'ilike', `%${filters.search}%`)
              .orWhere('directories.url', 'ilike', `%${filters.search}%`);
        });
      }
      
      const sortBy = filters.sortBy || 'path';
      const sortOrder = filters.sortOrder || 'asc';
      query = query.orderBy(`directories.${sortBy}`, sortOrder);
      
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      if (filters.offset) {
        query = query.offset(filters.offset);
      }
      
      const results = await query;
      
      // Add default values for enhanced columns if they don't exist in DB
      if (!hasEnhancedColumns) {
        results.forEach(row => {
          row.content_type = 'endpoint';
          row.risk_level = 'low';
          row.parameters = null;
          row.notes = null;
        });
      }
      
      console.log(`Found ${results.length} directories for organization ${organizationId}`);
      return results;
      
    } catch (error) {
      console.error('Error in Directory.findAll:', error.message);
      // Check if it's a table not exists error
      if (error.message.includes('does not exist') || error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('Directories table does not exist yet, returning empty array');
        return [];
      }
      throw error;
    }
  }

  static async count(organizationId, filters = {}) {
    try {
      const columns = await this.getTableSchema();
      const hasEnhancedColumns = columns.includes('content_type');

      let query = knex(this.tableName)
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId);
      
      if (filters.target_id) {
        query = query.where('targets.id', filters.target_id);
      }
      
      if (filters.subdomain_id) {
        query = query.where('directories.subdomain_id', filters.subdomain_id);
      }
      
      if (filters.status_code) {
        if (Array.isArray(filters.status_code)) {
          query = query.whereIn('directories.status_code', filters.status_code);
        } else {
          query = query.where('directories.status_code', filters.status_code);
        }
      }

      if (filters.source) {
        query = query.where('directories.source', filters.source);
      }

      // Only apply content_type filter if the column exists
      if (filters.content_type && hasEnhancedColumns) {
        query = query.where('directories.content_type', filters.content_type);
      }

      if (filters.search) {
        query = query.where(function() {
          this.where('directories.path', 'ilike', `%${filters.search}%`)
              .orWhere('directories.title', 'ilike', `%${filters.search}%`)
              .orWhere('directories.url', 'ilike', `%${filters.search}%`);
        });
      }
      
      const result = await query.count('directories.id as count').first();
      return parseInt(result.count);
    } catch (error) {
      console.error('Error in Directory.count:', error.message);
      if (error.message.includes('does not exist')) {
        return 0;
      }
      throw error;
    }
  }

  // FIXED: Improved bulkCreate with DEDUPLICATION and better error handling
  static async bulkCreate(directories) {
    if (!directories || directories.length === 0) {
      console.log('No directories to create');
      return [];
    }
    
    try {
      console.log(`Attempting to bulk create ${directories.length} directories`);
      
      // Get table schema to know which columns exist
      const columns = await this.getTableSchema();
      const hasEnhancedColumns = columns.includes('content_type');
      
      console.log(`Enhanced columns available: ${hasEnhancedColumns}`);
      
      // Validate and clean data
      const validDirectories = this.validateAndCleanDirectories(directories);

      if (validDirectories.length === 0) {
        console.warn('No valid directories to create after validation');
        return [];
      }

      console.log(`Validated ${validDirectories.length} out of ${directories.length} directory records`);

      // Prepare directory records with only columns that exist in the table
      const directoryRecords = this.prepareDirectoryRecords(validDirectories, hasEnhancedColumns);

      // Verify subdomain_ids exist before inserting
      const validatedRecords = await this.validateSubdomainReferences(directoryRecords);

      if (validatedRecords.length === 0) {
        console.warn('No directories with valid subdomain references to create');
        return [];
      }

      console.log(`Final validation: ${validatedRecords.length} directories with valid subdomain references`);

      // FIXED: DEDUPLICATE records before processing to avoid constraint violations
      const deduplicatedRecords = this.deduplicateRecords(validatedRecords);
      console.log(`After deduplication: ${deduplicatedRecords.length} unique records (removed ${validatedRecords.length - deduplicatedRecords.length} duplicates)`);

      // FIXED: Process in batches to avoid query size limits
      const BATCH_SIZE = 50; // Reasonable batch size
      let allCreatedRecords = [];

      for (let i = 0; i < deduplicatedRecords.length; i += BATCH_SIZE) {
        const batch = deduplicatedRecords.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`);

        try {
          // ADDITIONAL SAFETY: Deduplicate within batch as well
          const batchDeduplicated = this.deduplicateRecords(batch);
          
          if (batchDeduplicated.length !== batch.length) {
            console.warn(`Found ${batch.length - batchDeduplicated.length} additional duplicates within batch ${Math.floor(i / BATCH_SIZE) + 1}`);
          }
          
          // Use upsert to handle duplicates - only merge columns that exist
          const mergeColumns = [
            'status_code', 
            'content_length', 
            'response_time', 
            'title', 
            'headers',
            'body_preview',
            'scan_job_id',
            'updated_at'
          ];

          // Add enhanced columns to merge list if they exist
          if (hasEnhancedColumns) {
            mergeColumns.push('content_type', 'risk_level', 'parameters', 'notes');
          }

          const batchResults = await knex(this.tableName)
            .insert(batchDeduplicated)
            .onConflict(['subdomain_id', 'path'])
            .merge(mergeColumns)
            .returning('*');

          allCreatedRecords = allCreatedRecords.concat(batchResults);
          console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} completed: ${batchResults.length} records`);

        } catch (batchError) {
          console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchError.message);
          
          // Try to process records individually to identify problematic ones
          console.log('🔄 Attempting individual record processing...');
          const individualResults = await this.processRecordsIndividually(batch, hasEnhancedColumns);
          allCreatedRecords = allCreatedRecords.concat(individualResults);
        }
      }

      console.log(`✅ Successfully created/updated ${allCreatedRecords.length} directory records`);
      return allCreatedRecords;
      
    } catch (error) {
      console.error('Error in Directory.bulkCreate:', error.message);
      
      // Check if it's a table not exists error
      if (error.message.includes('does not exist')) {
        console.error('Directories table does not exist. Make sure migrations have been run.');
        return [];
      }
      
      // Check for column not exists error
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.error('❌ Some columns do not exist in directories table.');
        console.error('💡 Try running: npm run migrate to apply all database migrations');
        return [];
      }
      
      console.error('Full error details:', error);
      return [];
    }
  }

  // NEW: Deduplication method to remove duplicate (subdomain_id, path) combinations
  static deduplicateRecords(records) {
    const seen = new Map();
    const deduplicatedRecords = [];
    
    for (const record of records) {
      const key = `${record.subdomain_id}:${record.path}`;
      
      if (!seen.has(key)) {
        seen.set(key, true);
        deduplicatedRecords.push(record);
      } else {
        console.debug(`Skipping duplicate: subdomain_id=${record.subdomain_id}, path=${record.path}`);
      }
    }
    
    return deduplicatedRecords;
  }

  // Helper method to validate and clean directory data
  static validateAndCleanDirectories(directories) {
    return directories.filter(dir => {
      if (!dir.subdomain_id) {
        console.warn('Skipping directory record with null subdomain_id:', dir.path || 'unknown path');
        return false;
      }
      
      // Only require path and url, status_code can be null for passive discovery
      const isValid = dir.path && dir.url;
      if (!isValid) {
        console.warn('Invalid directory record (missing path or url):', {
          path: dir.path,
          url: dir.url,
          subdomain_id: dir.subdomain_id
        });
        return false;
      }
      
      return true;
    });
  }

  // Helper method to prepare directory records for insertion
  static prepareDirectoryRecords(validDirectories, hasEnhancedColumns) {
    return validDirectories.map(dir => {
      // Base record with columns that always exist
      const record = {
        subdomain_id: parseInt(dir.subdomain_id),
        path: dir.path,
        url: dir.url,
        status_code: dir.status_code ? parseInt(dir.status_code) : null,
        content_length: dir.content_length ? parseInt(dir.content_length) : null,
        response_time: dir.response_time ? parseInt(dir.response_time) : null,
        title: dir.title ? String(dir.title).substring(0, 255) : null,
        headers: dir.headers || null,
        body_preview: dir.body_preview ? String(dir.body_preview).substring(0, 1000) : null,
        method: dir.method || 'GET',
        source: dir.source || 'unknown',
        scan_job_id: dir.scan_job_id || null,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Add enhanced columns only if they exist in the table
      if (hasEnhancedColumns) {
        record.content_type = dir.content_type || 'endpoint';
        record.risk_level = dir.risk_level || 'low';
        record.parameters = dir.parameters ? (Array.isArray(dir.parameters) ? dir.parameters.join(',') : String(dir.parameters)) : null;
        record.notes = dir.notes || null;
      }

      return record;
    });
  }

  // Helper method to validate subdomain references
  static async validateSubdomainReferences(directoryRecords) {
    const subdomainIds = [...new Set(directoryRecords.map(d => d.subdomain_id))];
    
    try {
      const existingSubdomains = await knex('subdomains')
        .whereIn('id', subdomainIds)
        .select('id');
      
      const existingSubdomainIds = new Set(existingSubdomains.map(s => s.id));
      
      // Filter out records with non-existent subdomain_ids
      return directoryRecords.filter(dir => {
        if (!existingSubdomainIds.has(dir.subdomain_id)) {
          console.warn(`Skipping directory - subdomain_id ${dir.subdomain_id} does not exist: ${dir.path}`);
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('Error validating subdomain references:', error.message);
      return directoryRecords; // Return all records if validation fails
    }
  }

  // Helper method to process records individually when batch fails
  static async processRecordsIndividually(batch, hasEnhancedColumns) {
    const results = [];
    const mergeColumns = [
      'status_code', 
      'content_length', 
      'response_time', 
      'title', 
      'headers',
      'body_preview',
      'scan_job_id',
      'updated_at'
    ];

    if (hasEnhancedColumns) {
      mergeColumns.push('content_type', 'risk_level', 'parameters', 'notes');
    }

    for (const record of batch) {
      try {
        const result = await knex(this.tableName)
          .insert(record)
          .onConflict(['subdomain_id', 'path'])
          .merge(mergeColumns)
          .returning('*');
        
        results.push(...result);
      } catch (individualError) {
        console.error(`Failed to process individual record:`, {
          path: record.path,
          subdomain_id: record.subdomain_id,
          error: individualError.message
        });
        
        // Log the problematic record for debugging
        console.error('Problematic record data:', JSON.stringify(record, null, 2));
      }
    }

    console.log(`Individual processing completed: ${results.length}/${batch.length} successful`);
    return results;
  }

  static async getStatsByTarget(organizationId) {
    try {
      const columns = await this.getTableSchema();
      const hasEnhancedColumns = columns.includes('content_type');

      let stats = await knex(this.tableName)
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .select(
          'targets.id as target_id',
          'targets.domain as target_domain',
          knex.raw('COUNT(directories.id) as total_directories'),
          knex.raw("COUNT(CASE WHEN directories.status_code BETWEEN 200 AND 299 THEN 1 END) as accessible_directories"),
          knex.raw("COUNT(CASE WHEN directories.status_code = 403 THEN 1 END) as forbidden_directories"),
          knex.raw("COUNT(CASE WHEN directories.status_code >= 500 THEN 1 END) as error_directories"),
          knex.raw("COUNT(CASE WHEN directories.status_code BETWEEN 300 AND 399 THEN 1 END) as redirect_directories"),
          knex.raw("COUNT(CASE WHEN directories.status_code IS NULL THEN 1 END) as pending_directories")
        )
        .groupBy('targets.id', 'targets.domain');

      // Add enhanced stats if columns exist
      if (hasEnhancedColumns) {
        stats = await knex(this.tableName)
          .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
          .join('targets', 'subdomains.target_id', 'targets.id')
          .where('targets.organization_id', organizationId)
          .select(
            'targets.id as target_id',
            'targets.domain as target_domain',
            knex.raw('COUNT(directories.id) as total_directories'),
            knex.raw("COUNT(CASE WHEN directories.status_code BETWEEN 200 AND 299 THEN 1 END) as accessible_directories"),
            knex.raw("COUNT(CASE WHEN directories.status_code = 403 THEN 1 END) as forbidden_directories"),
            knex.raw("COUNT(CASE WHEN directories.status_code >= 500 THEN 1 END) as error_directories"),
            knex.raw("COUNT(CASE WHEN directories.status_code BETWEEN 300 AND 399 THEN 1 END) as redirect_directories"),
            knex.raw("COUNT(CASE WHEN directories.status_code IS NULL THEN 1 END) as pending_directories"),
            knex.raw("COUNT(CASE WHEN directories.content_type = 'xss_sink' THEN 1 END) as xss_sinks"),
            knex.raw("COUNT(CASE WHEN directories.content_type = 'form' THEN 1 END) as forms"),
            knex.raw("COUNT(CASE WHEN directories.content_type = 'api' THEN 1 END) as api_endpoints")
          )
          .groupBy('targets.id', 'targets.domain');
      }
      
      console.log(`Retrieved directory stats for ${stats.length} targets`);
      return stats;
      
    } catch (error) {
      console.error('Error in Directory.getStatsByTarget:', error.message);
      if (error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  // New method: Get directories by subdomain
  static async findBySubdomain(subdomainId, organizationId) {
    try {
      const directories = await knex(this.tableName)
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('directories.subdomain_id', subdomainId)
        .where('targets.organization_id', organizationId)
        .select('directories.*', 'subdomains.subdomain', 'targets.domain as target_domain')
        .orderBy('directories.path', 'asc');
      
      return directories;
    } catch (error) {
      console.error('Error in Directory.findBySubdomain:', error.message);
      return [];
    }
  }

  // Helper method to check if enhanced columns exist
  static async hasEnhancedColumns() {
    const columns = await this.getTableSchema();
    return columns.includes('content_type');
  }

  // Clear schema cache (useful for testing or after migrations)
  static clearSchemaCache() {
    this._tableSchema = null;
  }

  // FIXED: Updated validation to allow null status codes for passive discovery
  static validateDirectoryRecord(dir) {
    const errors = [];
    
    if (!dir.subdomain_id) {
      errors.push('subdomain_id is required');
    } else if (!Number.isInteger(parseInt(dir.subdomain_id))) {
      errors.push('subdomain_id must be a valid integer');
    }
    
    if (!dir.path) {
      errors.push('path is required');
    }
    
    if (!dir.url) {
      errors.push('url is required');
    }
    
    // Allow null status codes - they can be fetched later for passive discovery
    if (dir.status_code !== null && dir.status_code !== undefined) {
      if (!Number.isInteger(parseInt(dir.status_code))) {
        errors.push('status_code must be a valid integer when provided');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // Helper method to ensure subdomain exists for a target
  static async ensureSubdomainExists(targetId, subdomainName) {
    try {
      let subdomain = await knex('subdomains')
        .where('target_id', targetId)
        .where('subdomain', subdomainName)
        .first();
      
      if (!subdomain) {
        const [newSubdomain] = await knex('subdomains')
          .insert({
            target_id: targetId,
            subdomain: subdomainName,
            status: 'active',
            first_discovered: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          })
          .returning('*');
        
        subdomain = newSubdomain;
        console.log(`Created new subdomain record: ${subdomainName} (ID: ${subdomain.id})`);
      }
      
      return subdomain.id;
    } catch (error) {
      console.error('Error ensuring subdomain exists:', error);
      throw error;
    }
  }

  // Method to run enhanced columns migration check
  static async checkAndSuggestMigration() {
    try {
      const hasEnhanced = await this.hasEnhancedColumns();
      if (!hasEnhanced) {
        console.log('');
        console.log('⚠️  MIGRATION NEEDED ⚠️');
        console.log('📋 The directories table is missing enhanced columns.');
        console.log('🔧 Run: npm run migrate');
        console.log('📝 This will add: content_type, risk_level, parameters, notes columns');
        console.log('');
      }
      return hasEnhanced;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }
}

module.exports = Directory;
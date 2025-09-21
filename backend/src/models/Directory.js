// backend/src/models/Directory.js - FIXED VERSION
const knex = require('../config/database');

class Directory {
  static get tableName() {
    return 'directories';
  }

  static async findAll(organizationId, filters = {}) {
    try {
      let query = knex(this.tableName)
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .select(
          'directories.*',
          'subdomains.subdomain',
          'subdomains.id as subdomain_id',
          'targets.domain as target_domain',
          'targets.id as target_id'
        );
      
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
      
      if (filters.search) {
        query = query.where(function() {
          this.where('directories.path', 'ilike', `%${filters.search}%`)
              .orWhere('directories.title', 'ilike', `%${filters.search}%`);
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

  static async bulkCreate(directories) {
    if (!directories || directories.length === 0) {
      console.log('No directories to create');
      return [];
    }
    
    try {
      console.log(`Attempting to bulk create ${directories.length} directories`);
      
      // Validate required fields and filter out records with null subdomain_id
      const validDirectories = directories.filter(dir => {
        if (!dir.subdomain_id) {
          console.warn('Skipping directory record with null subdomain_id:', dir.path || 'unknown path');
          return false;
        }
        
        const isValid = dir.path && dir.url && dir.status_code;
        if (!isValid) {
          console.warn('Invalid directory record (missing required fields):', dir);
          return false;
        }
        
        return true;
      });

      if (validDirectories.length === 0) {
        console.warn('No valid directories to create after validation');
        return [];
      }

      console.log(`Validated ${validDirectories.length} out of ${directories.length} directory records`);

      // Prepare directory records with proper timestamps
      const directoryRecords = validDirectories.map(dir => ({
        subdomain_id: parseInt(dir.subdomain_id), // Ensure it's an integer
        path: dir.path,
        url: dir.url,
        status_code: parseInt(dir.status_code),
        content_length: dir.content_length ? parseInt(dir.content_length) : null,
        response_time: dir.response_time ? parseInt(dir.response_time) : null,
        title: dir.title ? dir.title.substring(0, 255) : null, // Limit title length
        headers: dir.headers || null,
        body_preview: dir.body_preview ? dir.body_preview.substring(0, 1000) : null,
        method: dir.method || 'GET',
        scan_job_id: dir.scan_job_id || null,
        created_at: new Date(),
        updated_at: new Date()
      }));

      // Verify subdomain_ids exist before inserting
      const subdomainIds = [...new Set(directoryRecords.map(d => d.subdomain_id))];
      const existingSubdomains = await knex('subdomains')
        .whereIn('id', subdomainIds)
        .select('id');
      
      const existingSubdomainIds = new Set(existingSubdomains.map(s => s.id));
      
      // Filter out records with non-existent subdomain_ids
      const validatedRecords = directoryRecords.filter(dir => {
        if (!existingSubdomainIds.has(dir.subdomain_id)) {
          console.warn(`Skipping directory - subdomain_id ${dir.subdomain_id} does not exist: ${dir.path}`);
          return false;
        }
        return true;
      });

      if (validatedRecords.length === 0) {
        console.warn('No directories with valid subdomain references to create');
        return [];
      }

      console.log(`Final validation: ${validatedRecords.length} directories with valid subdomain references`);

      // Use upsert to handle duplicates
      const result = await knex(this.tableName)
        .insert(validatedRecords)
        .onConflict(['subdomain_id', 'path'])
        .merge([
          'status_code', 
          'content_length', 
          'response_time', 
          'title', 
          'headers',
          'body_preview',
          'scan_job_id',
          'updated_at'
        ])
        .returning('*');

      console.log(`✅ Successfully created/updated ${result.length} directory records`);
      return result;
      
    } catch (error) {
      console.error('Error in Directory.bulkCreate:', error.message);
      
      // Check if it's a table not exists error
      if (error.message.includes('does not exist')) {
        console.error('Directories table does not exist. Make sure migrations have been run.');
        return [];
      }
      
      // Check for constraint violations
      if (error.message.includes('violates') || error.message.includes('constraint')) {
        console.error('Database constraint violation:', error.message);
        
        // If it's specifically about subdomain_id being null
        if (error.message.includes('subdomain_id') && error.message.includes('not-null')) {
          console.error('❌ NULL subdomain_id detected. This should not happen with the new validation.');
          console.error('Directories with null subdomain_id have been filtered out in validation.');
        }
        
        return [];
      }
      
      return [];
    }
  }

  static async getStatsByTarget(organizationId) {
    try {
      const stats = await knex(this.tableName)
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
          knex.raw("COUNT(CASE WHEN directories.status_code BETWEEN 300 AND 399 THEN 1 END) as redirect_directories")
        )
        .groupBy('targets.id', 'targets.domain');
      
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

  // New method: Get recent discoveries
  static async getRecentDiscoveries(organizationId, limit = 10) {
    try {
      const recent = await knex(this.tableName)
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .select(
          'directories.*',
          'subdomains.subdomain',
          'targets.domain as target_domain'
        )
        .orderBy('directories.created_at', 'desc')
        .limit(limit);
      
      return recent;
    } catch (error) {
      console.error('Error in Directory.getRecentDiscoveries:', error.message);
      return [];
    }
  }

  // New method: Delete directories for a scan job
  static async deleteByScanJob(scanJobId) {
    try {
      const deleted = await knex(this.tableName)
        .where('scan_job_id', scanJobId)
        .del();
      
      console.log(`Deleted ${deleted} directories for scan job ${scanJobId}`);
      return deleted;
    } catch (error) {
      console.error('Error in Directory.deleteByScanJob:', error.message);
      return 0;
    }
  }

  // New method: Get directories by status code range
  static async findByStatusRange(organizationId, minStatus, maxStatus) {
    try {
      const directories = await knex(this.tableName)
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .whereBetween('directories.status_code', [minStatus, maxStatus])
        .select(
          'directories.*',
          'subdomains.subdomain',
          'targets.domain as target_domain'
        )
        .orderBy('directories.status_code', 'asc')
        .orderBy('directories.path', 'asc');
      
      return directories;
    } catch (error) {
      console.error('Error in Directory.findByStatusRange:', error.message);
      return [];
    }
  }

  // Helper method to validate a single directory record
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
    
    if (!dir.status_code) {
      errors.push('status_code is required');
    } else if (!Number.isInteger(parseInt(dir.status_code))) {
      errors.push('status_code must be a valid integer');
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
}

module.exports = Directory;
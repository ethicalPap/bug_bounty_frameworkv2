// backend/src/models/Directory.js - UPDATED VERSION
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
      
      // Validate required fields
      const validDirectories = directories.filter(dir => {
        const isValid = dir.path && dir.url && dir.status_code;
        if (!isValid) {
          console.warn('Invalid directory record:', dir);
        }
        return isValid;
      });

      if (validDirectories.length === 0) {
        console.warn('No valid directories to create after validation');
        return [];
      }

      // Prepare directory records with proper timestamps
      const directoryRecords = validDirectories.map(dir => ({
        subdomain_id: dir.subdomain_id || null,
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

      // Use upsert to handle duplicates
      const result = await knex(this.tableName)
        .insert(directoryRecords)
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

      console.log(`Successfully created/updated ${result.length} directory records`);
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
        console.error('Database constraint violation. Some directories may reference non-existent subdomains.');
        
        // Try to create only directories with valid subdomain_id
        try {
          const validSubdomainDirectories = directories.filter(async (dir) => {
            if (!dir.subdomain_id) return true; // Allow null subdomain_id
            
            try {
              const subdomain = await knex('subdomains').where('id', dir.subdomain_id).first();
              return !!subdomain;
            } catch {
              return false;
            }
          });
          
          if (validSubdomainDirectories.length > 0) {
            console.log(`Retrying with ${validSubdomainDirectories.length} valid directories`);
            return await this.bulkCreate(validSubdomainDirectories);
          }
        } catch (retryError) {
          console.error('Retry failed:', retryError.message);
        }
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
}

module.exports = Directory;
// backend/src/models/Directory.js
const knex = require('../config/database');

class Directory {
  static get tableName() {
    return 'directories';
  }

  static async findAll(organizationId, filters = {}) {
    // For now, return empty array since table may not exist yet
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
        query = query.where('directories.status_code', filters.status_code);
      }
      
      if (filters.search) {
        query = query.where('directories.path', 'ilike', `%${filters.search}%`);
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
      
      return await query;
    } catch (error) {
      console.log('Directories table not yet created, returning empty array');
      return [];
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
      
      const result = await query.count('directories.id as count').first();
      return parseInt(result.count);
    } catch (error) {
      return 0;
    }
  }

  static async bulkCreate(directories) {
    if (directories.length === 0) return [];
    
    try {
      return await knex(this.tableName)
        .insert(directories.map(dir => ({
          ...dir,
          created_at: new Date(),
          updated_at: new Date()
        })))
        .onConflict(['subdomain_id', 'path'])
        .merge(['status_code', 'content_length', 'response_time', 'title', 'updated_at']);
    } catch (error) {
      console.log('Could not create directories - table may not exist yet');
      return [];
    }
  }

  static async getStatsByTarget(organizationId) {
    try {
      return await knex(this.tableName)
        .join('subdomains', 'directories.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .select(
          'targets.id as target_id',
          'targets.domain as target_domain',
          knex.raw('COUNT(directories.id) as total_directories'),
          knex.raw("COUNT(CASE WHEN directories.status_code BETWEEN 200 AND 299 THEN 1 END) as accessible_directories"),
          knex.raw("COUNT(CASE WHEN directories.status_code = 403 THEN 1 END) as forbidden_directories")
        )
        .groupBy('targets.id', 'targets.domain');
    } catch (error) {
      return [];
    }
  }
}

module.exports = Directory;
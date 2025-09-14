// backend/src/models/Subdomain.js
const knex = require('../config/database');

class Subdomain {
  static get tableName() {
    return 'subdomains';
  }

  static async findAll(organizationId, filters = {}) {
    let query = knex(this.tableName)
      .join('targets', 'subdomains.target_id', 'targets.id')
      .where('targets.organization_id', organizationId)
      .select(
        'subdomains.*',
        'targets.domain as target_domain',
        'targets.id as target_id'
      );
    
    if (filters.target_id) {
      query = query.where('subdomains.target_id', filters.target_id);
    }
    
    if (filters.status) {
      query = query.where('subdomains.status', filters.status);
    }
    
    if (filters.search) {
      query = query.where('subdomains.subdomain', 'ilike', `%${filters.search}%`);
    }
    
    const sortBy = filters.sortBy || 'subdomain';
    const sortOrder = filters.sortOrder || 'asc';
    query = query.orderBy(`subdomains.${sortBy}`, sortOrder);
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  static async count(organizationId, filters = {}) {
    let query = knex(this.tableName)
      .join('targets', 'subdomains.target_id', 'targets.id')
      .where('targets.organization_id', organizationId);
    
    if (filters.target_id) {
      query = query.where('subdomains.target_id', filters.target_id);
    }
    
    if (filters.status) {
      query = query.where('subdomains.status', filters.status);
    }
    
    const result = await query.count('subdomains.id as count').first();
    return parseInt(result.count);
  }

  static async bulkCreate(subdomains) {
    if (subdomains.length === 0) return [];
    
    return await knex(this.tableName)
      .insert(subdomains.map(sub => ({
        ...sub,
        created_at: new Date(),
        updated_at: new Date()
      })))
      .onConflict(['target_id', 'subdomain'])
      .merge(['last_seen', 'status', 'ip_address', 'http_status', 'title', 'updated_at']);
  }

  static async checkLiveStatus(id, organizationId) {
    // Simplified implementation - in production this would use httpx
    const subdomain = await knex(this.tableName)
      .join('targets', 'subdomains.target_id', 'targets.id')
      .where('targets.organization_id', organizationId)
      .where('subdomains.id', id)
      .select('subdomains.*', 'targets.domain as target_domain')
      .first();
    
    if (!subdomain) return null;
    
    // Simulate checking (in production, use httpx or similar)
    const isLive = Math.random() > 0.3;
    const httpStatus = isLive ? 200 : null;
    
    const [updated] = await knex(this.tableName)
      .where('id', id)
      .update({
        status: isLive ? 'active' : 'inactive',
        http_status: httpStatus,
        last_seen: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    return updated;
  }

  static async getStatsByTarget(organizationId) {
    return await knex(this.tableName)
      .join('targets', 'subdomains.target_id', 'targets.id')
      .where('targets.organization_id', organizationId)
      .select(
        'targets.id as target_id',
        'targets.domain as target_domain',
        knex.raw('COUNT(subdomains.id) as total_subdomains'),
        knex.raw("COUNT(CASE WHEN subdomains.status = 'active' THEN 1 END) as active_subdomains"),
        knex.raw("COUNT(CASE WHEN subdomains.http_status BETWEEN 200 AND 299 THEN 1 END) as live_subdomains")
      )
      .groupBy('targets.id', 'targets.domain');
  }
}

module.exports = Subdomain;
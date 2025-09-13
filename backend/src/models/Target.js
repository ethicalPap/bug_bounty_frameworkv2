// backend/src/models/Target.js
const knex = require('../config/database');

class Target {
  static get tableName() {
    return 'targets';
  }

  static async findAll(organizationId, filters = {}) {
    let query = knex(this.tableName).where('organization_id', organizationId);
    
    if (filters.search) {
      query = query.where(function() {
        this.whereILike('domain', `%${filters.search}%`)
            .orWhereILike('description', `%${filters.search}%`);
      });
    }
    
    if (filters.status) {
      query = query.where('status', filters.status);
    }
    
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);
    
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    
    return await query;
  }

  static async findById(id, organizationId) {
    return await knex(this.tableName)
      .where({ id, organization_id: organizationId })
      .first();
  }

  static async create(data) {
    const [target] = await knex(this.tableName)
      .insert({
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    return target;
  }

  static async update(id, organizationId, data) {
    const [target] = await knex(this.tableName)
      .where({ id, organization_id: organizationId })
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    return target;
  }

  static async delete(id, organizationId) {
    return await knex(this.tableName)
      .where({ id, organization_id: organizationId })
      .del();
  }

  static async findByDomain(domain, organizationId) {
    return await knex(this.tableName)
      .where({ domain: domain.toLowerCase(), organization_id: organizationId })
      .first();
  }

  static async count(organizationId, filters = {}) {
    let query = knex(this.tableName).where('organization_id', organizationId);
    
    if (filters.search) {
      query = query.where(function() {
        this.whereILike('domain', `%${filters.search}%`)
            .orWhereILike('description', `%${filters.search}%`);
      });
    }
    
    if (filters.status) {
      query = query.where('status', filters.status);
    }
    
    const result = await query.count('id as count').first();
    return parseInt(result.count);
  }

  static async updateStats(id, stats) {
    const [target] = await knex(this.tableName)
      .where('id', id)
      .update({
        stats: JSON.stringify({
          ...stats,
          last_updated: new Date().toISOString()
        }),
        updated_at: new Date()
      })
      .returning('*');
    return target;
  }
}

module.exports = Target;
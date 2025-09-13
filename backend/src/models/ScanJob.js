// backend/src/models/ScanJob.js
const knex = require('../config/database');

class ScanJob {
  static get tableName() {
    return 'scan_jobs';
  }

  static async findAll(organizationId, filters = {}) {
    let query = knex(this.tableName).where('organization_id', organizationId);
    
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.whereIn('status', filters.status);
      } else {
        query = query.where('status', filters.status);
      }
    }
    
    if (filters.target_id) {
      query = query.where('target_id', filters.target_id);
    }
    
    if (filters.job_type) {
      query = query.where('job_type', filters.job_type);
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
    const [scanJob] = await knex(this.tableName)
      .insert({
        ...data,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    return scanJob;
  }

  static async update(id, organizationId, data) {
    const [scanJob] = await knex(this.tableName)
      .where({ id, organization_id: organizationId })
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    return scanJob;
  }

  static async delete(id, organizationId) {
    return await knex(this.tableName)
      .where({ id, organization_id: organizationId })
      .del();
  }

  static async findByTargetAndStatus(targetId, statuses = []) {
    let query = knex(this.tableName).where('target_id', targetId);
    
    if (statuses.length > 0) {
      query = query.whereIn('status', statuses);
    }
    
    return await query;
  }

  static async count(organizationId, filters = {}) {
    let query = knex(this.tableName).where('organization_id', organizationId);
    
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.whereIn('status', filters.status);
      } else {
        query = query.where('status', filters.status);
      }
    }
    
    if (filters.target_id) {
      query = query.where('target_id', filters.target_id);
    }
    
    if (filters.job_type) {
      query = query.where('job_type', filters.job_type);
    }
    
    const result = await query.count('id as count').first();
    return parseInt(result.count);
  }

  static async getStats(organizationId) {
    const stats = await knex(this.tableName)
      .where('organization_id', organizationId)
      .select(
        knex.raw('COUNT(*) as total'),
        knex.raw("COUNT(CASE WHEN status = 'running' THEN 1 END) as running"),
        knex.raw("COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed"),
        knex.raw("COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed"),
        knex.raw("COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending")
      )
      .first();
    
    return {
      total: parseInt(stats.total),
      running: parseInt(stats.running),
      completed: parseInt(stats.completed),
      failed: parseInt(stats.failed),
      pending: parseInt(stats.pending)
    };
  }

  static async updateProgress(id, percentage, status = null) {
    const updateData = {
      progress_percentage: percentage,
      updated_at: new Date()
    };
    
    if (status) {
      updateData.status = status;
    }
    
    if (percentage === 100 && !status) {
      updateData.status = 'completed';
      updateData.completed_at = new Date();
    }
    
    const [scanJob] = await knex(this.tableName)
      .where('id', id)
      .update(updateData)
      .returning('*');
    
    return scanJob;
  }

  static async markAsStarted(id) {
    const [scanJob] = await knex(this.tableName)
      .where('id', id)
      .update({
        status: 'running',
        started_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    return scanJob;
  }

  static async markAsFailed(id, errorMessage) {
    const [scanJob] = await knex(this.tableName)
      .where('id', id)
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    return scanJob;
  }

  static async markAsCompleted(id, results = {}) {
    const [scanJob] = await knex(this.tableName)
      .where('id', id)
      .update({
        status: 'completed',
        progress_percentage: 100,
        results: JSON.stringify(results),
        completed_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');
    
    return scanJob;
  }
}

module.exports = ScanJob;
// backend/src/models/ScanJob.js - Fixed to include target domain information
const knex = require('../config/database');

class ScanJob {
  static get tableName() {
    return 'scan_jobs';
  }

  static async findAll(organizationId, filters = {}) {
    // Enhanced query with target information
    let query = knex(this.tableName)
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.organization_id', organizationId)
      .select(
        'scan_jobs.*',
        'targets.domain as target_domain',
        'targets.domain as domain', // Add both for compatibility
        'targets.description as target_description'
      );
    
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.whereIn('scan_jobs.status', filters.status);
      } else {
        query = query.where('scan_jobs.status', filters.status);
      }
    }
    
    if (filters.target_id) {
      query = query.where('scan_jobs.target_id', filters.target_id);
    }
    
    if (filters.job_type) {
      query = query.where('scan_jobs.job_type', filters.job_type);
    }
    
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    
    // Handle sorting for joined columns
    if (sortBy === 'target_domain' || sortBy === 'domain') {
      query = query.orderBy('targets.domain', sortOrder);
    } else {
      query = query.orderBy(`scan_jobs.${sortBy}`, sortOrder);
    }
    
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
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.id', id)
      .where('scan_jobs.organization_id', organizationId)
      .select(
        'scan_jobs.*',
        'targets.domain as target_domain',
        'targets.domain as domain',
        'targets.description as target_description'
      )
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
    let query = knex(this.tableName)
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.target_id', targetId)
      .select(
        'scan_jobs.*',
        'targets.domain as target_domain',
        'targets.domain as domain'
      );
    
    if (statuses.length > 0) {
      query = query.whereIn('scan_jobs.status', statuses);
    }
    
    return await query;
  }

  static async count(organizationId, filters = {}) {
    let query = knex(this.tableName)
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.organization_id', organizationId);
    
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.whereIn('scan_jobs.status', filters.status);
      } else {
        query = query.where('scan_jobs.status', filters.status);
      }
    }
    
    if (filters.target_id) {
      query = query.where('scan_jobs.target_id', filters.target_id);
    }
    
    if (filters.job_type) {
      query = query.where('scan_jobs.job_type', filters.job_type);
    }
    
    const result = await query.count('scan_jobs.id as count').first();
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
        knex.raw("COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending"),
        knex.raw("COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled")
      )
      .first();
    
    return {
      total: parseInt(stats.total),
      running: parseInt(stats.running),
      completed: parseInt(stats.completed),
      failed: parseInt(stats.failed),
      pending: parseInt(stats.pending),
      cancelled: parseInt(stats.cancelled)
    };
  }

  static async updateProgress(id, percentage, status = null) {
    const updateData = {
      progress_percentage: Math.round(percentage),
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

  // Get recent scan jobs with target information
  static async getRecentJobs(organizationId, limit = 10) {
    return await knex(this.tableName)
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.organization_id', organizationId)
      .select(
        'scan_jobs.*',
        'targets.domain as target_domain',
        'targets.domain as domain'
      )
      .orderBy('scan_jobs.created_at', 'desc')
      .limit(limit);
  }

  // Get jobs by target with enhanced information
  static async getJobsByTarget(targetId, organizationId, limit = 50) {
    return await knex(this.tableName)
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.target_id', targetId)
      .where('scan_jobs.organization_id', organizationId)
      .select(
        'scan_jobs.*',
        'targets.domain as target_domain',
        'targets.domain as domain'
      )
      .orderBy('scan_jobs.created_at', 'desc')
      .limit(limit);
  }

  // Get running scans with target information
  static async getRunningScans(organizationId) {
    return await knex(this.tableName)
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.organization_id', organizationId)
      .whereIn('scan_jobs.status', ['running', 'pending'])
      .select(
        'scan_jobs.*',
        'targets.domain as target_domain',
        'targets.domain as domain'
      )
      .orderBy('scan_jobs.created_at', 'desc');
  }

  // Enhanced job status summary
  static async getJobStatusSummary(organizationId) {
    const summary = await knex(this.tableName)
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.organization_id', organizationId)
      .select(
        'scan_jobs.status',
        'scan_jobs.job_type',
        'targets.domain as target_domain',
        knex.raw('COUNT(*) as count')
      )
      .groupBy('scan_jobs.status', 'scan_jobs.job_type', 'targets.domain')
      .orderBy('targets.domain');
    
    return summary;
  }
}

module.exports = ScanJob;
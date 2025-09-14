// backend/src/models/index.js
const knex = require('../config/database');

const Organization = {
  async create(data) {
    const [organization] = await knex('organizations').insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    return organization;
  },
  
  async findById(id) {
    return knex('organizations').where('id', id).first();
  },
  
  async findBySlug(slug) {
    return knex('organizations').where('slug', slug).first();
  }
};

const User = {
  async create(data) {
    const [user] = await knex('users').insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    return user;
  },
  
  async findById(id) {
    return knex('users').where('id', id).first();
  },
  
  async findByEmail(email) {
    return knex('users').where('email', email).first();
  },
  
  async updateLastLogin(id) {
    return knex('users').where('id', id).update({
      last_login_at: new Date(),
      updated_at: new Date()
    });
  }
};

const Target = {
  async create(data) {
    const [target] = await knex('targets').insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    return target;
  },
  
  async findByOrganization(organizationId, filters = {}) {
    let query = knex('targets').where('organization_id', organizationId);
    
    if (filters.status) {
      query = query.where('status', filters.status);
    }
    
    return query.orderBy('created_at', 'desc');
  },
  
  async findById(id, organizationId = null) {
    let query = knex('targets').where('id', id);
    
    if (organizationId) {
      query = query.where('organization_id', organizationId);
    }
    
    return query.first();
  },
  
  async update(id, organizationId, data) {
    const [target] = await knex('targets')
      .where({ id, organization_id: organizationId })
      .update({
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    return target;
  },
  
  async delete(id, organizationId) {
    return knex('targets')
      .where({ id, organization_id: organizationId })
      .del();
  }
};

const Subdomain = {
  async create(data) {
    const [subdomain] = await knex('subdomains').insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    return subdomain;
  },
  
  async findByTarget(targetId, filters = {}) {
    let query = knex('subdomains').where('target_id', targetId);
    
    if (filters.status) {
      query = query.where('status', filters.status);
    }
    
    return query.orderBy('subdomain', 'asc');
  },
  
  async bulkCreate(subdomains) {
    return knex('subdomains')
      .insert(subdomains)
      .onConflict(['target_id', 'subdomain'])
      .merge({
        updated_at: new Date()
      });
  }
};

const ScanJob = {
  async create(data) {
    const [scanJob] = await knex('scan_jobs').insert({
      ...data,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');
    return scanJob;
  },
  
  async findByOrganization(organizationId, filters = {}) {
    let query = knex('scan_jobs')
      .select('scan_jobs.*', 'targets.domain')
      .join('targets', 'scan_jobs.target_id', 'targets.id')
      .where('scan_jobs.organization_id', organizationId);
    
    if (filters.status) {
      query = query.where('scan_jobs.status', filters.status);
    }
    
    return query.orderBy('scan_jobs.created_at', 'desc');
  },
  
  async updateStatus(id, status, data = {}) {
    const [scanJob] = await knex('scan_jobs')
      .where('id', id)
      .update({
        status,
        ...data,
        updated_at: new Date()
      })
      .returning('*');
    return scanJob;
  }
};

// Export the knex instance along with models
module.exports = { 
  knex, 
  Organization, 
  User, 
  Target, 
  Subdomain, 
  ScanJob 
};
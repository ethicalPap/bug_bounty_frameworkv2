const knex = require('knex')(require('../../knexfile')[process.env.NODE_ENV || 'development']);

const Organization = {
  async create(data) {
    return knex('organizations').insert(data).returning('*');
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
    return knex('users').insert(data).returning('*');
  },
  
  async findById(id) {
    return knex('users').where('id', id).first();
  },
  
  async findByEmail(email) {
    return knex('users').where('email', email).first();
  },
  
  async updateLastLogin(id) {
    return knex('users').where('id', id).update({
      last_login_at: knex.fn.now()
    });
  }
};

const Target = {
  async create(data) {
    return knex('targets').insert(data).returning('*');
  },
  
  async findByOrganization(organizationId, filters = {}) {
    let query = knex('targets').where('organization_id', organizationId);
    
    if (filters.status) {
      query = query.where('status', filters.status);
    }
    
    return query.orderBy('created_at', 'desc');
  },
  
  async findById(id) {
    return knex('targets').where('id', id).first();
  },
  
  async update(id, data) {
    return knex('targets').where('id', id).update({
      ...data,
      updated_at: knex.fn.now()
    }).returning('*');
  },
  
  async delete(id) {
    return knex('targets').where('id', id).del();
  }
};

const Subdomain = {
  async create(data) {
    return knex('subdomains').insert(data).returning('*');
  },
  
  async findByTarget(targetId, filters = {}) {
    let query = knex('subdomains').where('target_id', targetId);
    
    if (filters.status) {
      query = query.where('status', filters.status);
    }
    
    return query.orderBy('subdomain', 'asc');
  },
  
  async bulkCreate(subdomains) {
    return knex('subdomains').insert(subdomains).onConflict(['target_id', 'subdomain']).merge();
  }
};

const ScanJob = {
  async create(data) {
    return knex('scan_jobs').insert(data).returning('*');
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
    return knex('scan_jobs').where('id', id).update({
      status,
      ...data,
      updated_at: knex.fn.now()
    }).returning('*');
  }
};

module.exports = { knex, Organization, User, Target, Subdomain, ScanJob };
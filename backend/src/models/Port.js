// backend/src/models/Port.js
const knex = require('../config/database');

class Port {
  static get tableName() {
    return 'ports';
  }

  static async findAll(organizationId, filters = {}) {
    try {
      let query = knex(this.tableName)
        .join('subdomains', 'ports.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .select(
          'ports.*',
          'subdomains.subdomain',
          'subdomains.status as subdomain_status',
          'subdomains.id as subdomain_id',
          'targets.domain as target_domain',
          'targets.id as target_id'
        );
      
      if (filters.target_id) {
        query = query.where('targets.id', filters.target_id);
      }
      
      if (filters.subdomain_id) {
        query = query.where('ports.subdomain_id', filters.subdomain_id);
      }
      
      if (filters.subdomain_status) {
        query = query.where('subdomains.status', filters.subdomain_status);
      }
      
      if (filters.state) {
        query = query.where('ports.state', filters.state);
      }
      
      if (filters.service_search) {
        query = query.where('ports.service', 'ilike', `%${filters.service_search}%`);
      }
      
      const sortBy = filters.sortBy || 'port';
      const sortOrder = filters.sortOrder || 'asc';
      
      // Handle different sort fields
      if (sortBy === 'subdomain') {
        query = query.orderBy('subdomains.subdomain', sortOrder);
      } else if (sortBy === 'target') {
        query = query.orderBy('targets.domain', sortOrder);
      } else {
        query = query.orderBy(`ports.${sortBy}`, sortOrder);
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      if (filters.offset) {
        query = query.offset(filters.offset);
      }
      
      const results = await query;
      console.log(`Found ${results.length} ports for organization ${organizationId}`);
      return results;
      
    } catch (error) {
      console.error('Error in Port.findAll:', error.message);
      if (error.message.includes('does not exist')) {
        console.log('Ports table does not exist yet, returning empty array');
        return [];
      }
      throw error;
    }
  }

  static async count(organizationId, filters = {}) {
    try {
      let query = knex(this.tableName)
        .join('subdomains', 'ports.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId);
      
      if (filters.target_id) {
        query = query.where('targets.id', filters.target_id);
      }
      
      if (filters.subdomain_id) {
        query = query.where('ports.subdomain_id', filters.subdomain_id);
      }
      
      if (filters.subdomain_status) {
        query = query.where('subdomains.status', filters.subdomain_status);
      }
      
      if (filters.state) {
        query = query.where('ports.state', filters.state);
      }
      
      const result = await query.count('ports.id as count').first();
      return parseInt(result.count);
    } catch (error) {
      console.error('Error in Port.count:', error.message);
      if (error.message.includes('does not exist')) {
        return 0;
      }
      throw error;
    }
  }

  static async findById(id, organizationId) {
    try {
      const port = await knex(this.tableName)
        .join('subdomains', 'ports.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .where('ports.id', id)
        .select(
          'ports.*',
          'subdomains.subdomain',
          'subdomains.status as subdomain_status',
          'targets.domain as target_domain'
        )
        .first();
      
      return port;
    } catch (error) {
      console.error('Error in Port.findById:', error.message);
      return null;
    }
  }

  static async bulkCreate(ports) {
    if (!ports || ports.length === 0) {
      console.log('No ports to create');
      return [];
    }
    
    try {
      console.log(`Attempting to bulk create ${ports.length} ports`);
      
      // Validate required fields
      const validPorts = ports.filter(port => {
        const isValid = port.port && port.subdomain_id && port.state;
        if (!isValid) {
          console.warn('Invalid port record:', port);
        }
        return isValid;
      });

      if (validPorts.length === 0) {
        console.warn('No valid ports to create after validation');
        return [];
      }

      // Prepare port records with proper timestamps
      const portRecords = validPorts.map(port => ({
        subdomain_id: port.subdomain_id,
        port: parseInt(port.port),
        protocol: port.protocol || 'tcp',
        state: port.state,
        service: port.service || null,
        version: port.version || null,
        banner: port.banner || null,
        service_info: port.service_info ? JSON.stringify(port.service_info) : JSON.stringify({}),
        scan_job_id: port.scan_job_id || null,
        created_at: new Date(),
        updated_at: new Date()
      }));

      // Use upsert to handle duplicates
      const result = await knex(this.tableName)
        .insert(portRecords)
        .onConflict(['subdomain_id', 'port', 'protocol'])
        .merge([
          'state', 
          'service', 
          'version', 
          'banner',
          'service_info',
          'scan_job_id',
          'updated_at'
        ])
        .returning('*');

      console.log(`Successfully created/updated ${result.length} port records`);
      return result;
      
    } catch (error) {
      console.error('Error in Port.bulkCreate:', error.message);
      
      if (error.message.includes('does not exist')) {
        console.error('Ports table does not exist. Make sure migrations have been run.');
        return [];
      }
      
      if (error.message.includes('violates') || error.message.includes('constraint')) {
        console.error('Database constraint violation. Some ports may reference non-existent subdomains.');
        return [];
      }
      
      return [];
    }
  }

  static async update(id, organizationId, data) {
    try {
      // First verify the port exists and belongs to the organization
      const existingPort = await this.findById(id, organizationId);
      if (!existingPort) {
        return null;
      }

      const [port] = await knex(this.tableName)
        .where('id', id)
        .update({
          ...data,
          updated_at: new Date()
        })
        .returning('*');
      
      return port;
    } catch (error) {
      console.error('Error in Port.update:', error.message);
      return null;
    }
  }

  static async getStatsByTarget(organizationId) {
    try {
      const stats = await knex(this.tableName)
        .join('subdomains', 'ports.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .select(
          'targets.id as target_id',
          'targets.domain as target_domain',
          knex.raw('COUNT(ports.id) as total_ports'),
          knex.raw("COUNT(CASE WHEN ports.state = 'open' THEN 1 END) as open_ports"),
          knex.raw("COUNT(CASE WHEN ports.state = 'closed' THEN 1 END) as closed_ports"),
          knex.raw("COUNT(CASE WHEN ports.state = 'filtered' THEN 1 END) as filtered_ports"),
          knex.raw("COUNT(DISTINCT ports.service) FILTER (WHERE ports.service IS NOT NULL AND ports.service != '') as unique_services")
        )
        .groupBy('targets.id', 'targets.domain');
      
      console.log(`Retrieved port stats for ${stats.length} targets`);
      return stats;
      
    } catch (error) {
      console.error('Error in Port.getStatsByTarget:', error.message);
      if (error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  // Get ports by subdomain
  static async findBySubdomain(subdomainId, organizationId) {
    try {
      const ports = await knex(this.tableName)
        .join('subdomains', 'ports.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('ports.subdomain_id', subdomainId)
        .where('targets.organization_id', organizationId)
        .select('ports.*', 'subdomains.subdomain', 'targets.domain as target_domain')
        .orderBy('ports.port', 'asc');
      
      return ports;
    } catch (error) {
      console.error('Error in Port.findBySubdomain:', error.message);
      return [];
    }
  }

  // Get ports by state
  static async findByState(organizationId, state) {
    try {
      const ports = await knex(this.tableName)
        .join('subdomains', 'ports.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .where('ports.state', state)
        .select(
          'ports.*',
          'subdomains.subdomain',
          'targets.domain as target_domain'
        )
        .orderBy('ports.port', 'asc');
      
      return ports;
    } catch (error) {
      console.error('Error in Port.findByState:', error.message);
      return [];
    }
  }

  // Get unique services
  static async getUniqueServices(organizationId) {
    try {
      const services = await knex(this.tableName)
        .join('subdomains', 'ports.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .whereNotNull('ports.service')
        .where('ports.service', '!=', '')
        .distinct('ports.service')
        .orderBy('ports.service', 'asc');
      
      return services.map(s => s.service);
    } catch (error) {
      console.error('Error in Port.getUniqueServices:', error.message);
      return [];
    }
  }

  // Delete ports for a scan job
  static async deleteByScanJob(scanJobId) {
    try {
      const deleted = await knex(this.tableName)
        .where('scan_job_id', scanJobId)
        .del();
      
      console.log(`Deleted ${deleted} ports for scan job ${scanJobId}`);
      return deleted;
    } catch (error) {
      console.error('Error in Port.deleteByScanJob:', error.message);
      return 0;
    }
  }

  // Get high-risk ports
  static async getHighRiskPorts(organizationId) {
    const highRiskPorts = [21, 22, 23, 25, 53, 135, 139, 445, 1433, 1521, 3389, 5432, 5900, 6379];
    
    try {
      const ports = await knex(this.tableName)
        .join('subdomains', 'ports.subdomain_id', 'subdomains.id')
        .join('targets', 'subdomains.target_id', 'targets.id')
        .where('targets.organization_id', organizationId)
        .where('ports.state', 'open')
        .whereIn('ports.port', highRiskPorts)
        .select(
          'ports.*',
          'subdomains.subdomain',
          'targets.domain as target_domain'
        )
        .orderBy('ports.port', 'asc');
      
      return ports;
    } catch (error) {
      console.error('Error in Port.getHighRiskPorts:', error.message);
      return [];
    }
  }
}

module.exports = Port;
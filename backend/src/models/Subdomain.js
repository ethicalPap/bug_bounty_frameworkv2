// backend/src/models/Subdomain.js
const knex = require('../config/database');
const dns = require('dns').promises;
const axios = require('axios');

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
    
    // ← ADD HTTP STATUS FILTER HERE
    if (filters.http_status) {
      // Parse the http_status - it could be a single value or comma-separated
      const statusCodes = filters.http_status.toString().split(',').map(code => parseInt(code.trim())).filter(code => !isNaN(code));
      
      if (statusCodes.length === 1) {
        query = query.where('subdomains.http_status', statusCodes[0]);
      } else if (statusCodes.length > 1) {
        query = query.whereIn('subdomains.http_status', statusCodes);
      }
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
    
    // ← ADD HTTP STATUS FILTER HERE TOO
    if (filters.http_status) {
      // Parse the http_status - it could be a single value or comma-separated
      const statusCodes = filters.http_status.toString().split(',').map(code => parseInt(code.trim())).filter(code => !isNaN(code));
      
      if (statusCodes.length === 1) {
        query = query.where('subdomains.http_status', statusCodes[0]);
      } else if (statusCodes.length > 1) {
        query = query.whereIn('subdomains.http_status', statusCodes);
      }
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
    const subdomain = await knex(this.tableName)
      .join('targets', 'subdomains.target_id', 'targets.id')
      .where('targets.organization_id', organizationId)
      .where('subdomains.id', id)
      .select('subdomains.*', 'targets.domain as target_domain')
      .first();
    
    if (!subdomain) return null;
    
    let ipAddress = null;
    let httpStatus = null;
    let title = null;
    let isLive = false;
    
    console.log(`Checking live status for: ${subdomain.subdomain}`);
    
    try {
      // Step 1: DNS lookup for IP address
      console.log(`DNS lookup for: ${subdomain.subdomain}`);
      const addresses = await dns.resolve4(subdomain.subdomain);
      ipAddress = addresses[0];
      console.log(`DNS resolved: ${subdomain.subdomain} -> ${ipAddress}`);
    } catch (dnsError) {
      console.log(`DNS lookup failed for ${subdomain.subdomain}: ${dnsError.message}`);
    }
    
    // Step 2: HTTP check for status and title (only if DNS resolved)
    if (ipAddress) {
      try {
        console.log(`HTTP check for: ${subdomain.subdomain}`);
        const response = await axios.get(`http://${subdomain.subdomain}`, {
          timeout: 8000,
          maxRedirects: 3,
          validateStatus: () => true, // Accept any status code
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
          }
        });
        
        httpStatus = response.status;
        isLive = response.status >= 200 && response.status < 400;
        
        // Extract title from HTML
        if (response.data && typeof response.data === 'string') {
          const titleMatch = response.data.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            title = titleMatch[1].trim().substring(0, 200); // Limit title length
            // Clean up title (remove extra whitespace, newlines)
            title = title.replace(/\s+/g, ' ').trim();
          }
        }
        
        console.log(`HTTP success: ${subdomain.subdomain} -> ${httpStatus} (${title || 'No title'})`);
        
      } catch (httpError) {
        console.log(`HTTP failed for ${subdomain.subdomain}, trying HTTPS...`);
        
        // Try HTTPS if HTTP fails
        try {
          const httpsResponse = await axios.get(`https://${subdomain.subdomain}`, {
            timeout: 8000,
            maxRedirects: 3,
            validateStatus: () => true,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner/1.0)'
            }
          });
          
          httpStatus = httpsResponse.status;
          isLive = httpsResponse.status >= 200 && httpsResponse.status < 400;
          
          // Extract title from HTTPS response
          if (httpsResponse.data && typeof httpsResponse.data === 'string') {
            const titleMatch = httpsResponse.data.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
              title = titleMatch[1].trim().substring(0, 200);
              title = title.replace(/\s+/g, ' ').trim();
            }
          }
          
          console.log(`HTTPS success: ${subdomain.subdomain} -> ${httpStatus} (${title || 'No title'})`);
          
        } catch (httpsError) {
          console.log(`Both HTTP and HTTPS failed for ${subdomain.subdomain}: ${httpsError.message}`);
          // If we have an IP but HTTP/HTTPS fails, still mark as partially active
          isLive = false;
        }
      }
    }
    
    // Step 3: Update subdomain with gathered information
    const updateData = {
      status: isLive ? 'active' : 'inactive',
      ip_address: ipAddress,
      http_status: httpStatus,
      title: title,
      last_seen: isLive ? new Date() : null,
      updated_at: new Date()
    };
    
    console.log(`Updating ${subdomain.subdomain} with:`, updateData);
    
    const [updated] = await knex(this.tableName)
      .where('id', id)
      .update(updateData)
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
const axios = require('axios');
const { Subdomain } = require('../src/models');

class SubdomainScanner {
  constructor() {
    this.sources = ['crt.sh', 'dnsdumpster'];
  }
  
  async scanDomain(domain, targetId) {
    console.log(`Starting subdomain scan for ${domain}`);
    
    const subdomains = new Set();
    
    try {
      // crt.sh API
      const crtSubdomains = await this.scanCrtSh(domain);
      crtSubdomains.forEach(sub => subdomains.add(sub));
      
      // Simple DNS check (would integrate with actual tools like subfinder)
      const commonSubdomains = await this.scanCommonSubdomains(domain);
      commonSubdomains.forEach(sub => subdomains.add(sub));
      
      // Save results to database
      const subdomainRecords = Array.from(subdomains).map(subdomain => ({
        target_id: targetId,
        subdomain,
        discovered_by: 'crt.sh',
        status: 'unknown'
      }));
      
      if (subdomainRecords.length > 0) {
        await Subdomain.bulkCreate(subdomainRecords);
        console.log(`Found ${subdomainRecords.length} subdomains for ${domain}`);
      }
      
      // Check which subdomains are live (basic HTTP check)
      await this.checkSubdomainStatus(targetId, Array.from(subdomains));
      
      return Array.from(subdomains);
    } catch (error) {
      console.error('Subdomain scan error:', error);
      throw error;
    }
  }
  
  async scanCrtSh(domain) {
    try {
      const response = await axios.get(`https://crt.sh/?q=${domain}&output=json`, {
        timeout: 30000
      });
      
      const subdomains = new Set();
      response.data.forEach(cert => {
        if (cert.name_value) {
          cert.name_value.split('\n').forEach(name => {
            // Clean up and validate subdomain
            const cleanName = name.trim().toLowerCase();
            if (cleanName.includes(domain) && !cleanName.includes('*')) {
              subdomains.add(cleanName);
            }
          });
        }
      });
      
      return Array.from(subdomains);
    } catch (error) {
      console.error('crt.sh scan error:', error);
      return [];
    }
  }
  
  async scanCommonSubdomains(domain) {
    const commonSubs = [
      'www', 'mail', 'ftp', 'api', 'admin', 'test', 'dev', 'staging',
      'blog', 'shop', 'app', 'mobile', 'cdn', 'img', 'images'
    ];
    
    const subdomains = [];
    
    for (const sub of commonSubs) {
      const subdomain = `${sub}.${domain}`;
      subdomains.push(subdomain);
    }
    
    return subdomains;
  }
  
  async checkSubdomainStatus(targetId, subdomains) {
    for (const subdomain of subdomains.slice(0, 10)) { // Limit for demo
      try {
        const httpResponse = await axios.get(`http://${subdomain}`, {
          timeout: 5000,
          validateStatus: () => true // Accept any status
        });
        
        await Subdomain.update(
          { target_id: targetId, subdomain },
          {
            status: 'live',
            http_status: httpResponse.status,
            last_seen_at: new Date()
          }
        );
      } catch (error) {
        // Try HTTPS
        try {
          const httpsResponse = await axios.get(`https://${subdomain}`, {
            timeout: 5000,
            validateStatus: () => true
          });
          
          await Subdomain.update(
            { target_id: targetId, subdomain },
            {
              status: 'live',
              https_status: httpsResponse.status,
              last_seen_at: new Date()
            }
          );
        } catch (httpsError) {
          await Subdomain.update(
            { target_id: targetId, subdomain },
            { status: 'dead' }
          );
        }
      }
    }
  }
}

module.exports = SubdomainScanner;
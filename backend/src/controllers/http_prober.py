import asyncio
import socket
import logging
from typing import List, Dict, Optional, Set
from datetime import datetime
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import and_

from database import SessionLocal
from Subdomain import Subdomain

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HTTPProber:
    """HTTP probing to check live subdomains with status codes and IPs"""
    
    def __init__(self, timeout: int = 10, max_redirects: int = 5, verify_ssl: bool = False):
        self.timeout = timeout
        self.max_redirects = max_redirects
        self.verify_ssl = verify_ssl
        self.results = []
        
    def resolve_ip(self, domain: str) -> Optional[str]:
        """Resolve domain to IP address"""
        try:
            ip_address = socket.gethostbyname(domain)
            return ip_address
        except socket.gaierror as e:
            logger.debug(f"Failed to resolve {domain}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error resolving {domain}: {e}")
            return None
    
    async def probe_single_subdomain(self, subdomain: str, protocols: List[str] = None) -> Dict:
        """
        Probe a single subdomain with HTTP/HTTPS
        
        Args:
            subdomain: The subdomain to probe
            protocols: List of protocols to try (default: ['https', 'http'])
        
        Returns:
            Dict with probe results
        """
        if protocols is None:
            protocols = ['https', 'http']
        
        result = {
            'subdomain': subdomain,
            'ip_address': None,
            'status_code': None,
            'is_active': False,
            'protocol': None,
            'title': None,
            'server': None,
            'content_length': None,
            'redirect_url': None,
            'response_time': None,
            'error': None
        }
        
        # Resolve IP address first
        ip_address = self.resolve_ip(subdomain)
        result['ip_address'] = ip_address
        
        if not ip_address:
            result['error'] = 'DNS resolution failed'
            return result
        
        # Try each protocol
        async with httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=True,
            max_redirects=self.max_redirects,
            verify=self.verify_ssl
        ) as client:
            
            for protocol in protocols:
                url = f"{protocol}://{subdomain}"
                
                try:
                    start_time = asyncio.get_event_loop().time()
                    response = await client.get(url)
                    end_time = asyncio.get_event_loop().time()
                    
                    # Success! Update result
                    result['is_active'] = True
                    result['status_code'] = response.status_code
                    result['protocol'] = protocol
                    result['response_time'] = round((end_time - start_time) * 1000, 2)  # ms
                    result['content_length'] = len(response.content)
                    
                    # Get server header
                    result['server'] = response.headers.get('Server', '')[:255]
                    
                    # Get final URL if redirected
                    if str(response.url) != url:
                        result['redirect_url'] = str(response.url)[:512]
                    
                    # Try to extract title from HTML
                    if 'text/html' in response.headers.get('content-type', '').lower():
                        try:
                            # Simple title extraction without BeautifulSoup
                            content = response.text.lower()
                            title_start = content.find('<title>')
                            title_end = content.find('</title>')
                            
                            if title_start != -1 and title_end != -1:
                                title = response.text[title_start + 7:title_end].strip()
                                result['title'] = title[:500]
                        except Exception as e:
                            logger.debug(f"Failed to extract title from {url}: {e}")
                    
                    logger.info(f"✓ {url} - Status: {response.status_code} - IP: {ip_address} - {result['response_time']}ms")
                    break  # Success, no need to try other protocols
                    
                except httpx.TimeoutException:
                    logger.debug(f"✗ {url} - Timeout")
                    result['error'] = f'{protocol} timeout'
                    
                except httpx.ConnectError as e:
                    logger.debug(f"✗ {url} - Connection error: {e}")
                    result['error'] = f'{protocol} connection failed'
                    
                except httpx.TooManyRedirects:
                    logger.debug(f"✗ {url} - Too many redirects")
                    result['error'] = f'{protocol} too many redirects'
                    
                except Exception as e:
                    logger.debug(f"✗ {url} - Error: {e}")
                    result['error'] = f'{protocol} error: {str(e)[:100]}'
        
        return result
    
    async def probe_subdomains_batch(self, subdomains: List[str], concurrency: int = 10) -> List[Dict]:
        """
        Probe multiple subdomains concurrently
        
        Args:
            subdomains: List of subdomains to probe
            concurrency: Number of concurrent requests
        
        Returns:
            List of probe results
        """
        results = []
        
        # Create semaphore to limit concurrency
        semaphore = asyncio.Semaphore(concurrency)
        
        async def probe_with_semaphore(subdomain: str):
            async with semaphore:
                return await self.probe_single_subdomain(subdomain)
        
        # Create tasks for all subdomains
        tasks = [probe_with_semaphore(subdomain) for subdomain in subdomains]
        
        # Execute all tasks
        logger.info(f"Starting HTTP probe for {len(subdomains)} subdomains (concurrency: {concurrency})")
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions
        valid_results = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Probe task failed: {result}")
            else:
                valid_results.append(result)
        
        return valid_results
    
    def update_database_record(self, subdomain_id: int, probe_result: Dict, db: Session):
        """Update a subdomain record with probe results"""
        try:
            subdomain = db.query(Subdomain).filter(Subdomain.id == subdomain_id).first()
            
            if not subdomain:
                logger.warning(f"Subdomain ID {subdomain_id} not found")
                return False
            
            # Update fields
            subdomain.ip_address = probe_result.get('ip_address')
            subdomain.status_code = probe_result.get('status_code')
            subdomain.is_active = probe_result.get('is_active', False)
            subdomain.title = probe_result.get('title')
            subdomain.server = probe_result.get('server')
            subdomain.content_length = probe_result.get('content_length')
            subdomain.updated_at = datetime.utcnow()
            
            db.commit()
            return True
            
        except Exception as e:
            logger.error(f"Failed to update subdomain {subdomain_id}: {e}")
            db.rollback()
            return False
    
    def update_database_batch(self, probe_results: List[Dict], db: Session) -> int:
        """
        Update multiple subdomain records with probe results
        
        Args:
            probe_results: List of probe results
            db: Database session
        
        Returns:
            Number of records updated
        """
        updated_count = 0
        
        for result in probe_results:
            subdomain_name = result.get('subdomain')
            
            try:
                # Find the subdomain in database
                subdomain = db.query(Subdomain).filter(
                    Subdomain.full_domain == subdomain_name
                ).first()
                
                if subdomain:
                    # Update fields
                    subdomain.ip_address = result.get('ip_address')
                    subdomain.status_code = result.get('status_code')
                    subdomain.is_active = result.get('is_active', False)
                    subdomain.title = result.get('title')
                    subdomain.server = result.get('server')
                    subdomain.content_length = result.get('content_length')
                    subdomain.updated_at = datetime.utcnow()
                    
                    updated_count += 1
                else:
                    logger.warning(f"Subdomain {subdomain_name} not found in database")
                    
            except Exception as e:
                logger.error(f"Failed to update subdomain {subdomain_name}: {e}")
                db.rollback()
                continue
        
        try:
            db.commit()
            logger.info(f"Updated {updated_count} subdomain records in database")
        except Exception as e:
            logger.error(f"Failed to commit batch update: {e}")
            db.rollback()
            return 0
        
        return updated_count


# Async wrapper functions for FastAPI integration

async def probe_domain_subdomains(domain: str, concurrency: int = 10) -> Dict:
    """
    Probe all subdomains for a domain
    
    Args:
        domain: Target domain
        concurrency: Number of concurrent probes
    
    Returns:
        Dict with probe statistics
    """
    db = SessionLocal()
    
    try:
        # Get all subdomains for the domain
        subdomains = db.query(Subdomain).filter(
            Subdomain.domain == domain
        ).all()
        
        if not subdomains:
            logger.warning(f"No subdomains found for domain: {domain}")
            return {
                'domain': domain,
                'total_subdomains': 0,
                'probed': 0,
                'active': 0,
                'inactive': 0
            }
        
        # Extract subdomain names
        subdomain_names = [sub.full_domain for sub in subdomains]
        
        logger.info(f"Probing {len(subdomain_names)} subdomains for {domain}")
        
        # Run async probe (await instead of asyncio.run)
        prober = HTTPProber()
        probe_results = await prober.probe_subdomains_batch(subdomain_names, concurrency)
        
        # Update database
        updated_count = prober.update_database_batch(probe_results, db)
        
        # Calculate statistics
        active_count = sum(1 for r in probe_results if r.get('is_active'))
        inactive_count = len(probe_results) - active_count
        
        return {
            'domain': domain,
            'total_subdomains': len(subdomains),
            'probed': len(probe_results),
            'active': active_count,
            'inactive': inactive_count,
            'updated_in_db': updated_count,
            'results': probe_results
        }
        
    except Exception as e:
        logger.error(f"Failed to probe subdomains for {domain}: {e}")
        raise
    finally:
        db.close()


async def probe_scan_results(scan_id: str, concurrency: int = 10) -> Dict:
    """
    Probe all subdomains from a specific scan
    
    Args:
        scan_id: Scan ID to probe
        concurrency: Number of concurrent probes
    
    Returns:
        Dict with probe statistics
    """
    db = SessionLocal()
    
    try:
        # Get all subdomains for the scan
        subdomains = db.query(Subdomain).filter(
            Subdomain.scan_id == scan_id
        ).all()
        
        if not subdomains:
            logger.warning(f"No subdomains found for scan: {scan_id}")
            return {
                'scan_id': scan_id,
                'total_subdomains': 0,
                'probed': 0,
                'active': 0,
                'inactive': 0
            }
        
        # Extract subdomain names
        subdomain_names = [sub.full_domain for sub in subdomains]
        
        logger.info(f"Probing {len(subdomain_names)} subdomains for scan {scan_id}")
        
        # Run async probe (await instead of asyncio.run)
        prober = HTTPProber()
        probe_results = await prober.probe_subdomains_batch(subdomain_names, concurrency)
        
        # Update database
        updated_count = prober.update_database_batch(probe_results, db)
        
        # Calculate statistics
        active_count = sum(1 for r in probe_results if r.get('is_active'))
        inactive_count = len(probe_results) - active_count
        
        return {
            'scan_id': scan_id,
            'total_subdomains': len(subdomains),
            'probed': len(probe_results),
            'active': active_count,
            'inactive': inactive_count,
            'updated_in_db': updated_count,
            'results': probe_results
        }
        
    except Exception as e:
        logger.error(f"Failed to probe subdomains for scan {scan_id}: {e}")
        raise
    finally:
        db.close()


async def probe_specific_subdomains(subdomain_ids: List[int], concurrency: int = 10) -> Dict:
    """
    Probe specific subdomains by their IDs
    
    Args:
        subdomain_ids: List of subdomain IDs to probe
        concurrency: Number of concurrent probes
    
    Returns:
        Dict with probe statistics
    """
    db = SessionLocal()
    
    try:
        # Get subdomains by IDs
        subdomains = db.query(Subdomain).filter(
            Subdomain.id.in_(subdomain_ids)
        ).all()
        
        if not subdomains:
            logger.warning(f"No subdomains found for IDs: {subdomain_ids}")
            return {
                'total_subdomains': 0,
                'probed': 0,
                'active': 0,
                'inactive': 0
            }
        
        # Extract subdomain names
        subdomain_names = [sub.full_domain for sub in subdomains]
        
        logger.info(f"Probing {len(subdomain_names)} specific subdomains")
        
        # Run async probe (await instead of asyncio.run)
        prober = HTTPProber()
        probe_results = await prober.probe_subdomains_batch(subdomain_names, concurrency)
        
        # Update database
        updated_count = prober.update_database_batch(probe_results, db)
        
        # Calculate statistics
        active_count = sum(1 for r in probe_results if r.get('is_active'))
        inactive_count = len(probe_results) - active_count
        
        return {
            'total_subdomains': len(subdomains),
            'probed': len(probe_results),
            'active': active_count,
            'inactive': inactive_count,
            'updated_in_db': updated_count,
            'results': probe_results
        }
        
    except Exception as e:
        logger.error(f"Failed to probe specific subdomains: {e}")
        raise
    finally:
        db.close()
from celery import shared_task
import logging
from typing import Dict
from src.controllers.subdomains import start_subdomain_scan
from src.config.database import SessionLocal

logger = logging.getLogger(__name__)

@shared_task(name='src.tasks.scan_domain', bind=True)
def scan_domain(self, domain: str, **kwargs) -> Dict:
    """
    Background task to scan a domain for subdomains
    
    Args:
        domain: Target domain to scan
        **kwargs: Additional scan configuration options
    
    Returns:
        Dict with scan results
    """
    try:
        logger.info(f"Starting background scan for domain: {domain}")
        
        # Update task state
        self.update_state(state='PROGRESS', meta={'status': 'Scanning...'})
        
        # Run the scan
        result = start_subdomain_scan(domain=domain, **kwargs)
        
        logger.info(f"Scan completed for {domain}: {result['total_unique_subdomains']} subdomains found")
        
        return result
        
    except Exception as e:
        logger.error(f"Scan failed for {domain}: {e}")
        raise

@shared_task(name='src.tasks.check_http')
def check_http(subdomain_id: int) -> Dict:
    """
    Background task to check HTTP status of a subdomain
    
    Args:
        subdomain_id: Database ID of the subdomain to check
    
    Returns:
        Dict with HTTP check results
    """
    import requests
    from src.models.Subdomain import Subdomain
    
    db = SessionLocal()
    try:
        subdomain = db.query(Subdomain).filter(Subdomain.id == subdomain_id).first()
        
        if not subdomain:
            return {'error': 'Subdomain not found'}
        
        # Try HTTPS first, then HTTP
        for protocol in ['https', 'http']:
            try:
                url = f"{protocol}://{subdomain.full_domain}"
                response = requests.get(
                    url,
                    timeout=10,
                    verify=False,
                    allow_redirects=True
                )
                
                # Update subdomain record
                subdomain.status_code = response.status_code
                subdomain.is_active = True
                subdomain.content_length = len(response.content)
                
                # Try to extract title
                if 'text/html' in response.headers.get('content-type', ''):
                    try:
                        from bs4 import BeautifulSoup
                        soup = BeautifulSoup(response.content, 'html.parser')
                        if soup.title:
                            subdomain.title = soup.title.string[:500]
                    except:
                        pass
                
                # Get server header
                subdomain.server = response.headers.get('Server', '')[:255]
                
                db.commit()
                
                return {
                    'subdomain': subdomain.full_domain,
                    'status_code': response.status_code,
                    'protocol': protocol,
                    'active': True
                }
                
            except requests.RequestException:
                continue
        
        # If both protocols failed
        subdomain.is_active = False
        db.commit()
        
        return {
            'subdomain': subdomain.full_domain,
            'active': False
        }
        
    except Exception as e:
        logger.error(f"HTTP check failed for subdomain {subdomain_id}: {e}")
        return {'error': str(e)}
    finally:
        db.close()

@shared_task(name='src.tasks.cleanup_old_scans')
def cleanup_old_scans(days: int = 30) -> Dict:
    """
    Background task to clean up old scan data
    
    Args:
        days: Number of days to keep (older data will be deleted)
    
    Returns:
        Dict with cleanup results
    """
    from datetime import datetime, timedelta
    from src.models.Subdomain import Subdomain
    
    db = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        deleted_count = db.query(Subdomain).filter(
            Subdomain.created_at < cutoff_date
        ).delete()
        
        db.commit()
        
        logger.info(f"Cleaned up {deleted_count} old subdomain records")
        
        return {
            'deleted_count': deleted_count,
            'cutoff_date': cutoff_date.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()
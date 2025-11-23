"""
Validation Controller
Handles vulnerability validation requests and manages validation workflow
"""

import logging
import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

from src.validators.webapp_validator import WebAppValidator, calculate_validated_risk_score
from src.validators.browser_validator import BrowserValidator, validate_high_value_target
from src.models.Subdomain import Subdomain
from src.models.ContentDiscovery import ContentDiscovery

logger = logging.getLogger(__name__)


# ==================== AUTHORIZATION CHECK ====================

AUTHORIZED_DOMAINS = []  # Add authorized domains here

def is_authorized(target_url: str) -> bool:
    """
    Check if target is authorized for testing
    
    ⚠️ CRITICAL: Only test authorized targets!
    """
    from urllib.parse import urlparse
    
    if not AUTHORIZED_DOMAINS:
        # If no domains configured, allow all (DANGEROUS - for testing only)
        logger.warning("⚠️  No authorized domains configured - allowing all targets")
        return True
    
    parsed = urlparse(target_url)
    domain = parsed.netloc
    
    return any(auth_domain in domain for auth_domain in AUTHORIZED_DOMAINS)


# ==================== VALIDATION FUNCTIONS ====================

def validate_single_target(
    target_url: str,
    discovered_paths: List[str] = None,
    db: Session = None
) -> Dict:
    """
    Validate a single target
    
    Args:
        target_url: URL to validate
        discovered_paths: Optional list of discovered paths
        db: Database session
    
    Returns:
        Validation results
    """
    # Authorization check
    if not is_authorized(target_url):
        logger.error(f"❌ Target not authorized: {target_url}")
        return {
            'error': 'Target not authorized for testing',
            'target': target_url,
            'authorized': False
        }
    
    logger.info(f"🔍 Starting validation for: {target_url}")
    
    try:
        # Run validation
        result = validate_high_value_target(target_url, discovered_paths)
        
        # Update database if session provided
        if db:
            _update_validation_results(target_url, result, db)
        
        logger.info(f"✅ Validation complete: {result['total_vulns']} vulnerabilities found")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Validation failed for {target_url}: {e}")
        return {
            'error': str(e),
            'target': target_url,
            'validated': False
        }


def validate_high_value_targets_for_domain(
    domain: str,
    db: Session,
    limit: int = 10,
    min_risk_score: int = 30
) -> List[Dict]:
    """
    Validate high-value targets for a domain
    
    Strategy:
    1. Get HIGH and CRITICAL tier targets
    2. Validate them to confirm vulnerabilities
    3. Update risk scores with confirmed findings
    
    Args:
        domain: Domain to validate
        db: Database session
        limit: Max number of targets to validate
        min_risk_score: Minimum risk score to validate
    
    Returns:
        List of validation results
    """
    logger.info(f"🎯 Finding high-value targets for {domain}")
    
    # Get high-value targets
    high_value_targets = db.query(Subdomain).filter(
        Subdomain.domain == domain,
        Subdomain.risk_score >= min_risk_score
    ).order_by(desc(Subdomain.risk_score)).limit(limit).all()
    
    if not high_value_targets:
        logger.warning(f"No high-value targets found for {domain}")
        return []
    
    logger.info(f"📋 Found {len(high_value_targets)} targets to validate")
    
    results = []
    
    for target in high_value_targets:
        target_url = f"https://{target.full_domain}"
        
        # Check if recently validated (skip if validated in last 7 days)
        if _was_recently_validated(target):
            logger.info(f"⏭️  Skipping {target_url} - recently validated")
            continue
        
        logger.info(f"🔍 Validating: {target_url} (Risk Score: {target.risk_score})")
        
        # Get discovered paths
        discovered_paths = _get_discovered_paths(target.id, db)
        
        # Validate
        validation_result = validate_single_target(
            target_url,
            discovered_paths=discovered_paths,
            db=db
        )
        
        results.append({
            'target': target_url,
            'original_risk_score': target.risk_score,
            'vulns_found': validation_result.get('total_vulns', 0),
            'critical_vulns': validation_result.get('critical_vulns', 0),
            'validation_complete': 'error' not in validation_result
        })
        
        # Rate limiting - don't hammer targets
        import time
        time.sleep(3)
    
    logger.info(f"✅ Validation batch complete: {len(results)} targets processed")
    
    return results


def quick_validate_target(
    target_url: str,
    discovered_paths: List[str] = None
) -> Dict:
    """
    Quick validation - only critical checks
    
    Faster than full validation, focuses on:
    - Default credentials
    - Sensitive file exposure
    - SQL injection
    """
    if not is_authorized(target_url):
        return {
            'error': 'Target not authorized',
            'target': target_url
        }
    
    validator = WebAppValidator()
    
    results = {
        'target': target_url,
        'validated_at': datetime.utcnow().isoformat(),
        'vulns': [],
        'total_vulns': 0
    }
    
    # Quick tests
    auth_proofs = validator.test_auth_bypass(target_url)
    file_proofs = validator.test_sensitive_files(target_url)
    
    all_proofs = auth_proofs + file_proofs
    
    if discovered_paths:
        sqli_proofs = validator.test_sqli(target_url, discovered_paths[:3])
        all_proofs.extend(sqli_proofs)
    
    results['vulns'] = [
        {
            'type': p.vuln_type,
            'severity': p.severity,
            'url': p.url,
            'payload': p.payload,
            'evidence': p.evidence
        }
        for p in all_proofs
    ]
    results['total_vulns'] = len(all_proofs)
    
    return results


# ==================== HELPER FUNCTIONS ====================

def _update_validation_results(target_url: str, validation_result: Dict, db: Session):
    """Update database with validation results"""
    try:
        from urllib.parse import urlparse
        
        parsed = urlparse(target_url)
        subdomain_name = parsed.netloc
        
        subdomain = db.query(Subdomain).filter(
            Subdomain.full_domain == subdomain_name
        ).first()
        
        if subdomain:
            subdomain.validated = True
            subdomain.validation_results = json.dumps(validation_result)
            subdomain.confirmed_vulns = validation_result.get('total_vulns', 0)
            subdomain.last_validated = datetime.utcnow()
            
            # Update tier if critical vulns found
            if validation_result.get('critical_vulns', 0) > 0:
                subdomain.risk_tier = 'CRITICAL_CONFIRMED'
            
            db.commit()
            logger.info(f"💾 Updated validation results in database for {target_url}")
            
    except Exception as e:
        logger.error(f"Failed to update validation results: {e}")
        db.rollback()


def _was_recently_validated(subdomain: Subdomain, days: int = 7) -> bool:
    """Check if target was validated recently"""
    if not subdomain.last_validated:
        return False
    
    cutoff = datetime.utcnow() - timedelta(days=days)
    return subdomain.last_validated > cutoff


def _get_discovered_paths(subdomain_id: int, db: Session) -> List[str]:
    """Get discovered paths for a subdomain"""
    try:
        content_discoveries = db.query(ContentDiscovery).filter(
            ContentDiscovery.subdomain_id == subdomain_id
        ).limit(20).all()
        
        return [cd.path for cd in content_discoveries if cd.path]
    except Exception as e:
        logger.error(f"Failed to get discovered paths: {e}")
        return []


# ==================== EXPORT FUNCTIONS ====================

def get_validation_report(domain: str, db: Session) -> Dict:
    """
    Get comprehensive validation report for a domain
    """
    validated_targets = db.query(Subdomain).filter(
        Subdomain.domain == domain,
        Subdomain.validated == True
    ).all()
    
    total_vulns = sum(t.confirmed_vulns for t in validated_targets)
    critical_count = len([t for t in validated_targets if t.risk_tier == 'CRITICAL_CONFIRMED'])
    
    return {
        'domain': domain,
        'total_validated': len(validated_targets),
        'total_vulns_confirmed': total_vulns,
        'critical_targets': critical_count,
        'validated_targets': [
            {
                'subdomain': t.full_domain,
                'risk_tier': t.risk_tier,
                'confirmed_vulns': t.confirmed_vulns,
                'last_validated': t.last_validated.isoformat() if t.last_validated else None
            }
            for t in validated_targets
        ]
    }
"""
Validation Controller
Handles vulnerability validation requests and manages validation workflow
Supports workspace isolation

⚠️ SECURITY NOTICE: Authorization is disabled - human operator determines scope
Only test targets you have explicit permission to test!
"""

import logging
import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

from src.models.Subdomain import Subdomain
from src.models.ContentDiscovery import ContentDiscovery

logger = logging.getLogger(__name__)


# ==================== AUTHORIZATION CHECK ====================

# AUTHORIZATION DISABLED - Human operator determines scope
AUTHORIZED_DOMAINS = []  

def is_authorized(target_url: str) -> bool:
    """
    Check if target is authorized for testing
    
    ⚠️ AUTHORIZATION DISABLED
    Human operator is responsible for determining scope and authorization
    
    Returns: True (always) - authorization check disabled
    """
    logger.info(f"⚠️  Authorization check bypassed for: {target_url}")
    logger.info(f"⚠️  Operator is responsible for ensuring proper authorization!")
    return True


# ==================== VALIDATION FUNCTIONS ====================

def validate_single_target(
    target_url: str,
    discovered_paths: List[str] = None,
    db: Session = None,
    workspace_id: Optional[str] = None
) -> Dict:
    """
    Validate a single target
    
    Args:
        target_url: URL to validate
        discovered_paths: Optional list of discovered paths
        db: Database session
        workspace_id: Optional workspace filter
    
    Returns:
        Validation results
    """
    if not is_authorized(target_url):
        logger.error(f"❌ Target not authorized: {target_url}")
        return {
            'error': 'Target not authorized for testing',
            'target': target_url,
            'authorized': False
        }
    
    logger.info(f"🔍 Starting validation for: {target_url}")
    
    try:
        # Import validators
        try:
            from src.validators.browser_validator import validate_high_value_target
            result = validate_high_value_target(target_url, discovered_paths)
        except ImportError:
            # Fallback if validators not available
            result = {
                'target': target_url,
                'validated': True,
                'total_vulns': 0,
                'critical_vulns': 0,
                'message': 'Validation module not available'
            }
        
        # Update database if session provided
        if db:
            _update_validation_results(target_url, result, db, workspace_id)
        
        logger.info(f"✅ Validation complete: {result.get('total_vulns', 0)} vulnerabilities found")
        
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
    workspace_id: Optional[str] = None,
    limit: int = 10,
    min_risk_score: int = 30
) -> List[Dict]:
    """
    Validate high-value targets for a domain
    
    Args:
        domain: Domain to validate
        db: Database session
        workspace_id: Optional workspace filter
        limit: Max number of targets to validate
        min_risk_score: Minimum risk score to validate
    
    Returns:
        List of validation results
    """
    logger.info(f"🎯 Finding high-value targets for {domain}")
    
    # Get high-value targets
    query = db.query(Subdomain).filter(
        Subdomain.domain == domain,
        Subdomain.risk_score >= min_risk_score
    )
    if workspace_id:
        query = query.filter(Subdomain.workspace_id == workspace_id)
    
    high_value_targets = query.order_by(desc(Subdomain.risk_score)).limit(limit).all()
    
    if not high_value_targets:
        logger.warning(f"No high-value targets found for {domain}")
        return []
    
    logger.info(f"📋 Found {len(high_value_targets)} targets to validate")
    
    results = []
    
    for target in high_value_targets:
        target_url = f"https://{target.full_domain}"
        
        # Check if recently validated
        if _was_recently_validated(target):
            logger.info(f"⏭️  Skipping {target_url} - recently validated")
            continue
        
        logger.info(f"🔍 Validating: {target_url} (Risk Score: {target.risk_score})")
        
        # Get discovered paths
        discovered_paths = _get_discovered_paths(target.id, db, workspace_id)
        
        # Validate
        validation_result = validate_single_target(
            target_url,
            discovered_paths=discovered_paths,
            db=db,
            workspace_id=workspace_id
        )
        
        results.append({
            'target': target_url,
            'original_risk_score': target.risk_score,
            'vulns_found': validation_result.get('total_vulns', 0),
            'critical_vulns': validation_result.get('critical_vulns', 0),
            'validation_complete': 'error' not in validation_result
        })
        
        # Rate limiting
        import time
        time.sleep(3)
    
    logger.info(f"✅ Validation batch complete: {len(results)} targets processed")
    
    return results


def validate_workspace_targets(
    workspace_id: str,
    db: Session,
    limit: int = 10,
    min_risk_score: int = 30
) -> List[Dict]:
    """
    Validate high-value targets across an entire workspace
    
    Args:
        workspace_id: Workspace ID
        db: Database session
        limit: Max number of targets to validate
        min_risk_score: Minimum risk score to validate
    
    Returns:
        List of validation results
    """
    logger.info(f"🎯 Finding high-value targets for workspace {workspace_id}")
    
    # Get high-value targets across all domains in workspace
    high_value_targets = db.query(Subdomain).filter(
        Subdomain.workspace_id == workspace_id,
        Subdomain.risk_score >= min_risk_score
    ).order_by(desc(Subdomain.risk_score)).limit(limit).all()
    
    if not high_value_targets:
        logger.warning(f"No high-value targets found for workspace {workspace_id}")
        return []
    
    logger.info(f"📋 Found {len(high_value_targets)} targets to validate")
    
    results = []
    
    for target in high_value_targets:
        target_url = f"https://{target.full_domain}"
        
        if _was_recently_validated(target):
            logger.info(f"⏭️  Skipping {target_url} - recently validated")
            continue
        
        logger.info(f"🔍 Validating: {target_url} (Risk Score: {target.risk_score})")
        
        discovered_paths = _get_discovered_paths(target.id, db, workspace_id)
        
        validation_result = validate_single_target(
            target_url,
            discovered_paths=discovered_paths,
            db=db,
            workspace_id=workspace_id
        )
        
        results.append({
            'target': target_url,
            'domain': target.domain,
            'original_risk_score': target.risk_score,
            'vulns_found': validation_result.get('total_vulns', 0),
            'critical_vulns': validation_result.get('critical_vulns', 0),
            'validation_complete': 'error' not in validation_result
        })
        
        import time
        time.sleep(3)
    
    logger.info(f"✅ Workspace validation batch complete: {len(results)} targets processed")
    
    return results


def quick_validate_target(
    target_url: str,
    discovered_paths: List[str] = None,
    workspace_id: Optional[str] = None
) -> Dict:
    """
    Quick validation - only critical checks
    """
    if not is_authorized(target_url):
        return {
            'error': 'Target not authorized',
            'target': target_url
        }
    
    results = {
        'target': target_url,
        'workspace_id': workspace_id,
        'validated_at': datetime.utcnow().isoformat(),
        'vulns': [],
        'total_vulns': 0
    }
    
    try:
        from src.validators.webapp_validator import WebAppValidator
        validator = WebAppValidator()
        
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
    except ImportError:
        results['message'] = 'Validation module not available'
    
    return results


# ==================== HELPER FUNCTIONS ====================

def _update_validation_results(
    target_url: str, 
    validation_result: Dict, 
    db: Session,
    workspace_id: Optional[str] = None
):
    """Update database with validation results"""
    try:
        from urllib.parse import urlparse
        
        parsed = urlparse(target_url)
        subdomain_name = parsed.netloc
        
        query = db.query(Subdomain).filter(Subdomain.full_domain == subdomain_name)
        if workspace_id:
            query = query.filter(Subdomain.workspace_id == workspace_id)
        
        subdomain = query.first()
        
        if subdomain:
            # Store validation results in notes field
            subdomain.notes = json.dumps(validation_result)
            subdomain.updated_at = datetime.utcnow()
            
            # Update risk score based on findings
            if validation_result.get('critical_vulns', 0) > 0:
                subdomain.risk_score = max(subdomain.risk_score or 0, 90)
            elif validation_result.get('total_vulns', 0) > 0:
                subdomain.risk_score = max(subdomain.risk_score or 0, 70)
            
            db.commit()
            logger.info(f"💾 Updated validation results in database for {target_url}")
            
    except Exception as e:
        logger.error(f"Failed to update validation results: {e}")
        db.rollback()


def _was_recently_validated(subdomain: Subdomain, days: int = 7) -> bool:
    """Check if target was validated recently"""
    if not subdomain.notes:
        return False
    
    try:
        notes = json.loads(subdomain.notes)
        validated_at = notes.get('validated_at')
        if validated_at:
            validated_date = datetime.fromisoformat(validated_at.replace('Z', '+00:00'))
            cutoff = datetime.utcnow() - timedelta(days=days)
            return validated_date > cutoff
    except:
        pass
    
    return False


def _get_discovered_paths(
    subdomain_id: int, 
    db: Session,
    workspace_id: Optional[str] = None
) -> List[str]:
    """Get discovered paths for a subdomain"""
    try:
        query = db.query(ContentDiscovery).filter(
            ContentDiscovery.subdomain_id == subdomain_id
        )
        if workspace_id:
            query = query.filter(ContentDiscovery.workspace_id == workspace_id)
        
        content_discoveries = query.limit(20).all()
        return [cd.path for cd in content_discoveries if cd.path]
    except Exception as e:
        logger.error(f"Failed to get discovered paths: {e}")
        return []


# ==================== EXPORT FUNCTIONS ====================

def get_validation_report(domain: str, db: Session, workspace_id: Optional[str] = None) -> Dict:
    """
    Get comprehensive validation report for a domain
    """
    query = db.query(Subdomain).filter(
        Subdomain.domain == domain,
        Subdomain.notes.isnot(None)
    )
    if workspace_id:
        query = query.filter(Subdomain.workspace_id == workspace_id)
    
    validated_targets = query.all()
    
    total_vulns = 0
    critical_count = 0
    
    for t in validated_targets:
        try:
            notes = json.loads(t.notes)
            total_vulns += notes.get('total_vulns', 0)
            critical_count += notes.get('critical_vulns', 0)
        except:
            pass
    
    return {
        'domain': domain,
        'workspace_id': workspace_id,
        'total_validated': len(validated_targets),
        'total_vulns_confirmed': total_vulns,
        'critical_targets': critical_count,
        'validated_targets': [
            {
                'subdomain': t.full_domain,
                'risk_score': t.risk_score,
                'updated_at': t.updated_at.isoformat() if t.updated_at else None
            }
            for t in validated_targets
        ]
    }


def get_workspace_validation_report(workspace_id: str, db: Session) -> Dict:
    """
    Get comprehensive validation report for an entire workspace
    """
    validated_targets = db.query(Subdomain).filter(
        Subdomain.workspace_id == workspace_id,
        Subdomain.notes.isnot(None)
    ).all()
    
    total_vulns = 0
    critical_count = 0
    domain_stats = {}
    
    for t in validated_targets:
        try:
            notes = json.loads(t.notes)
            vulns = notes.get('total_vulns', 0)
            critical = notes.get('critical_vulns', 0)
            
            total_vulns += vulns
            critical_count += critical
            
            if t.domain not in domain_stats:
                domain_stats[t.domain] = {'validated': 0, 'vulns': 0}
            domain_stats[t.domain]['validated'] += 1
            domain_stats[t.domain]['vulns'] += vulns
        except:
            pass
    
    return {
        'workspace_id': workspace_id,
        'total_validated': len(validated_targets),
        'total_vulns_confirmed': total_vulns,
        'critical_findings': critical_count,
        'domains': domain_stats
    }
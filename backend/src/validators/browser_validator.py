"""
Browser-based Vulnerability Validator
Simplified version without Selenium dependency for initial deployment

For full JavaScript analysis, install Selenium separately
"""

import requests
from typing import List, Dict, Optional
import logging
import re
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class BrowserValidator:
    """
    Simplified browser validator
    For full JS analysis, use Selenium version
    """
    
    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.verify = False
        requests.packages.urllib3.disable_warnings()
        
    def detect_sinks_static(self, url: str) -> List[Dict]:
        """
        Detect dangerous JavaScript sinks via static analysis
        (Without browser execution)
        """
        sinks_found = []
        
        try:
            response = self.session.get(url, timeout=self.timeout)
            html = response.text
            
            # Pattern matching for dangerous sinks
            sink_patterns = {
                'eval': r'eval\s*\(',
                'innerHTML': r'\.innerHTML\s*=',
                'document.write': r'document\.write\s*\(',
                'setTimeout_string': r'setTimeout\s*\(\s*["\']',
                'javascript_protocol': r'href\s*=\s*["\']javascript:',
            }
            
            for sink_type, pattern in sink_patterns.items():
                matches = re.findall(pattern, html, re.IGNORECASE)
                if matches:
                    sinks_found.append({
                        'url': url,
                        'sink_type': sink_type,
                        'count': len(matches),
                        'severity': 'HIGH' if sink_type in ['eval', 'javascript_protocol'] else 'MEDIUM',
                        'evidence': f'Found {len(matches)} instances of {sink_type}'
                    })
                    
        except Exception as e:
            logger.debug(f"Sink detection error: {e}")
            
        return sinks_found
    
    def discover_ajax_endpoints(self, url: str) -> List[Dict]:
        """
        Discover AJAX/API endpoints via static analysis
        """
        endpoints = []
        
        try:
            response = self.session.get(url, timeout=self.timeout)
            html = response.text
            
            # Find fetch() calls
            fetch_pattern = r'fetch\s*\(\s*["\']([^"\']+)["\']'
            fetch_matches = re.findall(fetch_pattern, html)
            
            for endpoint in fetch_matches:
                endpoints.append({
                    'url': endpoint,
                    'type': 'fetch',
                    'discovered_via': 'static_analysis'
                })
            
            # Find $.ajax() calls
            ajax_pattern = r'\$\.ajax\s*\(\s*\{[^}]*url\s*:\s*["\']([^"\']+)["\']'
            ajax_matches = re.findall(ajax_pattern, html)
            
            for endpoint in ajax_matches:
                endpoints.append({
                    'url': endpoint,
                    'type': 'jquery_ajax',
                    'discovered_via': 'static_analysis'
                })
                
        except Exception as e:
            logger.debug(f"AJAX endpoint discovery error: {e}")
            
        return endpoints
    
    def test_clickjacking_static(self, url: str) -> Optional[Dict]:
        """
        Test for clickjacking via HTTP headers
        """
        try:
            response = self.session.get(url, timeout=self.timeout)
            
            xfo = response.headers.get('X-Frame-Options')
            csp = response.headers.get('Content-Security-Policy')
            
            has_protection = False
            
            if xfo:
                has_protection = True
                
            if csp and 'frame-ancestors' in csp:
                has_protection = True
                
            if not has_protection:
                return {
                    'url': url,
                    'vuln_type': 'clickjacking',
                    'severity': 'MEDIUM',
                    'evidence': 'No X-Frame-Options or CSP frame-ancestors',
                    'remediation': 'Add X-Frame-Options: DENY'
                }
                
        except Exception as e:
            logger.debug(f"Clickjacking test error: {e}")
            
        return None
    
    def comprehensive_validation(self, url: str) -> Dict:
        """
        Run all static browser-based validations
        """
        results = {
            'url': url,
            'sinks': [],
            'ajax_endpoints': [],
            'clickjacking': None,
            'total_issues': 0
        }
        
        results['sinks'] = self.detect_sinks_static(url)
        results['ajax_endpoints'] = self.discover_ajax_endpoints(url)
        results['clickjacking'] = self.test_clickjacking_static(url)
        
        results['total_issues'] = (
            len(results['sinks']) + 
            (1 if results['clickjacking'] else 0)
        )
        
        return results


def validate_high_value_target(target_url: str, discovered_paths: List[str] = None) -> Dict:
    """
    Complete validation pipeline
    """
    from .webapp_validator import WebAppValidator
    
    results = {
        'target': target_url,
        'http_validation': {},
        'browser_validation': {},
        'total_vulns': 0,
        'critical_vulns': 0,
        'validated': True
    }
    
    # HTTP validation
    http_validator = WebAppValidator()
    results['http_validation'] = http_validator.validate_target(
        target_url,
        discovered_paths=discovered_paths
    )
    
    # Browser validation
    browser_validator = BrowserValidator()
    results['browser_validation'] = browser_validator.comprehensive_validation(target_url)
    
    # Aggregate
    results['total_vulns'] = (
        results['http_validation']['total_vulns'] +
        results['browser_validation']['total_issues']
    )
    results['critical_vulns'] = results['http_validation']['critical_vulns']
    
    return results
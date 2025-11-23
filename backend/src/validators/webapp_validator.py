"""
Web Application Vulnerability Validator
Actively tests for vulnerabilities to validate risk scores

⚠️ WARNING: Only use on targets you have permission to test!
"""

import requests
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse, parse_qs, urlencode
from dataclasses import dataclass
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class VulnerabilityProof:
    """Proof of vulnerability with evidence"""
    vuln_type: str
    severity: str
    url: str
    payload: str
    evidence: str
    screenshot_path: Optional[str] = None
    remediation: str = ""


class WebAppValidator:
    """
    Validates potential vulnerabilities found during reconnaissance
    
    ⚠️ IMPORTANT: Only use on targets you have permission to test!
    """
    
    def __init__(self, timeout: int = 10):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.verify = False  # For testing
        requests.packages.urllib3.disable_warnings()
        
    # ==================== AUTHENTICATION BYPASS TESTS ====================
    
    def test_auth_bypass(self, target_url: str) -> List[VulnerabilityProof]:
        """
        Test common authentication bypass techniques
        Returns proofs if bypass is successful
        """
        proofs = []
        
        # Test 1: Default Credentials
        default_creds = [
            ('admin', 'admin'),
            ('admin', 'password'),
            ('administrator', 'administrator'),
            ('root', 'root'),
            ('admin', ''),
        ]
        
        for username, password in default_creds:
            if self._test_login(target_url, username, password):
                proofs.append(VulnerabilityProof(
                    vuln_type='default_credentials',
                    severity='CRITICAL',
                    url=target_url,
                    payload=f'{username}:{password}',
                    evidence=f'Successfully logged in with {username}:{password}',
                    remediation='Change default credentials immediately'
                ))
                break
        
        # Test 2: SQL Injection Auth Bypass
        sqli_payloads = [
            "' OR '1'='1",
            "' OR '1'='1' --",
            "admin' --",
            "' OR 1=1--",
        ]
        
        for payload in sqli_payloads:
            if self._test_sqli_login(target_url, payload):
                proofs.append(VulnerabilityProof(
                    vuln_type='sqli_auth_bypass',
                    severity='CRITICAL',
                    url=target_url,
                    payload=payload,
                    evidence=f'SQL injection bypass successful with payload: {payload}',
                    remediation='Use parameterized queries, implement input validation'
                ))
                break
        
        return proofs
    
    def _test_login(self, url: str, username: str, password: str) -> bool:
        """Test a single username/password combination"""
        try:
            endpoints = ['/login', '/admin/login', '/wp-login.php', '/administrator']
            
            for endpoint in endpoints:
                login_url = urljoin(url, endpoint)
                
                data = {
                    'username': username,
                    'password': password,
                    'user': username,
                    'pass': password,
                }
                
                response = self.session.post(
                    login_url,
                    data=data,
                    timeout=self.timeout,
                    allow_redirects=False
                )
                
                if response.status_code == 302:
                    return True
                if 'dashboard' in response.text.lower():
                    return True
                if 'welcome' in response.text.lower() and 'login' not in response.text.lower():
                    return True
                    
        except Exception as e:
            logger.debug(f"Login test error: {e}")
        
        return False
    
    def _test_sqli_login(self, url: str, payload: str) -> bool:
        """Test SQL injection in login form"""
        try:
            endpoints = ['/login', '/admin/login']
            
            for endpoint in endpoints:
                login_url = urljoin(url, endpoint)
                
                data = {
                    'username': payload,
                    'password': 'anything',
                }
                
                response = self.session.post(
                    login_url,
                    data=data,
                    timeout=self.timeout,
                    allow_redirects=False
                )
                
                if response.status_code == 302:
                    return True
                if 'dashboard' in response.text.lower():
                    return True
                    
        except Exception as e:
            logger.debug(f"SQLi login test error: {e}")
        
        return False
    
    # ==================== XSS VALIDATION ====================
    
    def test_xss(self, target_url: str, discovered_paths: List[str]) -> List[VulnerabilityProof]:
        """Test for XSS in discovered endpoints"""
        proofs = []
        
        payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "'\"><script>alert(String.fromCharCode(88,83,83))</script>",
        ]
        
        for path in discovered_paths[:10]:
            full_url = urljoin(target_url, path)
            parsed = urlparse(full_url)
            params = parse_qs(parsed.query)
            
            if not params:
                continue
            
            for param_name in params.keys():
                for payload in payloads:
                    if proof := self._test_xss_param(full_url, param_name, payload):
                        proofs.append(proof)
                        break
        
        return proofs
    
    def _test_xss_param(self, url: str, param_name: str, payload: str) -> Optional[VulnerabilityProof]:
        """Test a single parameter for XSS"""
        try:
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            params[param_name] = [payload]
            
            new_query = urlencode(params, doseq=True)
            test_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{new_query}"
            
            response = self.session.get(test_url, timeout=self.timeout)
            
            if payload in response.text:
                if not self._is_escaped(response.text, payload):
                    return VulnerabilityProof(
                        vuln_type='reflected_xss',
                        severity='HIGH',
                        url=test_url,
                        payload=payload,
                        evidence=f'XSS payload reflected unescaped in parameter: {param_name}',
                        remediation='Implement output encoding/escaping, use Content Security Policy'
                    )
                    
        except Exception as e:
            logger.debug(f"XSS test error: {e}")
        
        return None
    
    def _is_escaped(self, html: str, payload: str) -> bool:
        """Check if payload is properly escaped"""
        escaped_versions = [
            payload.replace('<', '&lt;').replace('>', '&gt;'),
            payload.replace('<', '\\x3c').replace('>', '\\x3e'),
        ]
        
        for escaped in escaped_versions:
            if escaped in html:
                return True
        
        return False
    
    # ==================== SQL INJECTION VALIDATION ====================
    
    def test_sqli(self, target_url: str, discovered_paths: List[str]) -> List[VulnerabilityProof]:
        """Test for SQL injection in discovered endpoints"""
        proofs = []
        
        payloads = [
            "'",
            "1' OR '1'='1",
            "' OR 1=1--",
        ]
        
        for path in discovered_paths[:10]:
            full_url = urljoin(target_url, path)
            parsed = urlparse(full_url)
            params = parse_qs(parsed.query)
            
            if not params:
                continue
            
            for param_name in params.keys():
                for payload in payloads:
                    if proof := self._test_sqli_param(full_url, param_name, payload):
                        proofs.append(proof)
                        break
        
        return proofs
    
    def _test_sqli_param(self, url: str, param_name: str, payload: str) -> Optional[VulnerabilityProof]:
        """Test a single parameter for SQL injection"""
        try:
            parsed = urlparse(url)
            params = parse_qs(parsed.query)
            params[param_name] = [payload]
            
            new_query = urlencode(params, doseq=True)
            test_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{new_query}"
            
            response = self.session.get(test_url, timeout=self.timeout)
            
            sql_errors = [
                'mysql_fetch',
                'sql syntax',
                'postgresql',
                'ora-[0-9]+',
                'microsoft sql',
                'sqlite',
            ]
            
            for error in sql_errors:
                if re.search(error, response.text, re.IGNORECASE):
                    return VulnerabilityProof(
                        vuln_type='sql_injection',
                        severity='CRITICAL',
                        url=test_url,
                        payload=payload,
                        evidence=f'SQL error message detected in parameter: {param_name}',
                        remediation='Use parameterized queries, implement input validation'
                    )
                    
        except Exception as e:
            logger.debug(f"SQLi test error: {e}")
        
        return None
    
    # ==================== EXPOSED SENSITIVE FILES ====================
    
    def test_sensitive_files(self, target_url: str) -> List[VulnerabilityProof]:
        """Test for exposed sensitive files"""
        proofs = []
        
        sensitive_files = [
            ('.git/config', 'git_exposure'),
            ('.env', 'env_file'),
            ('backup.sql', 'database_backup'),
            ('database.sql', 'database_backup'),
            ('.DS_Store', 'macos_metadata'),
            ('web.config', 'config_file'),
            ('config.php', 'config_file'),
            ('phpinfo.php', 'phpinfo'),
        ]
        
        for file_path, vuln_type in sensitive_files:
            test_url = urljoin(target_url, file_path)
            
            try:
                response = self.session.get(test_url, timeout=self.timeout)
                
                if response.status_code == 200:
                    if self._verify_sensitive_file(file_path, response.text):
                        proofs.append(VulnerabilityProof(
                            vuln_type=vuln_type,
                            severity='CRITICAL' if 'backup' in vuln_type or 'git' in vuln_type else 'HIGH',
                            url=test_url,
                            payload=file_path,
                            evidence=f'Sensitive file accessible: {file_path}',
                            remediation='Remove sensitive files from web root, configure proper access controls'
                        ))
                        
            except Exception as e:
                logger.debug(f"Sensitive file test error: {e}")
        
        return proofs
    
    def _verify_sensitive_file(self, file_path: str, content: str) -> bool:
        """Verify that the file is actually what we're looking for"""
        indicators = {
            '.git/config': ['[core]', 'repositoryformatversion'],
            '.env': ['PASSWORD', 'SECRET', 'KEY', 'API'],
            'backup.sql': ['CREATE TABLE', 'INSERT INTO', 'DROP TABLE'],
            'database.sql': ['CREATE TABLE', 'INSERT INTO', 'DROP TABLE'],
            'phpinfo.php': ['phpinfo()', 'PHP Version'],
        }
        
        if file_path in indicators:
            file_indicators = indicators[file_path]
            return any(indicator in content for indicator in file_indicators)
        
        return True
    
    # ==================== SUBDOMAIN TAKEOVER ====================
    
    def test_subdomain_takeover(self, subdomain: str) -> Optional[VulnerabilityProof]:
        """Test if subdomain is vulnerable to takeover"""
        try:
            response = self.session.get(
                f'https://{subdomain}',
                timeout=self.timeout,
                allow_redirects=False
            )
            
            takeover_indicators = {
                'NoSuchBucket': ('s3_takeover', 'Amazon S3 bucket not found'),
                'There is no app configured': ('heroku_takeover', 'Heroku app not configured'),
                'No such app': ('heroku_takeover', 'Heroku app not found'),
                'Project doesnt exist': ('github_pages_takeover', 'GitHub Pages project not found'),
            }
            
            for indicator, (vuln_type, description) in takeover_indicators.items():
                if indicator in response.text:
                    return VulnerabilityProof(
                        vuln_type=vuln_type,
                        severity='CRITICAL',
                        url=f'https://{subdomain}',
                        payload='N/A',
                        evidence=f'Subdomain takeover possible: {description}',
                        remediation='Remove DNS record or reclaim the service'
                    )
                    
        except Exception as e:
            logger.debug(f"Subdomain takeover test error: {e}")
        
        return None
    
    # ==================== MAIN VALIDATION ORCHESTRATOR ====================
    
    def validate_target(self, 
                       target_url: str, 
                       discovered_paths: List[str] = None,
                       is_subdomain: bool = False) -> Dict:
        """
        Comprehensive validation of a target
        
        Returns:
            Dict with validation results and proofs
        """
        results = {
            'target': target_url,
            'validated_at': datetime.utcnow().isoformat(),
            'total_vulns': 0,
            'critical_vulns': 0,
            'high_vulns': 0,
            'proofs': []
        }
        
        all_proofs = []
        
        # Test 1: Authentication Bypass
        logger.info(f"Testing authentication bypass on {target_url}")
        all_proofs.extend(self.test_auth_bypass(target_url))
        
        # Test 2: Sensitive Files
        logger.info(f"Testing for sensitive files on {target_url}")
        all_proofs.extend(self.test_sensitive_files(target_url))
        
        # Test 3: Subdomain Takeover (if it's a subdomain)
        if is_subdomain:
            parsed = urlparse(target_url)
            domain = parsed.netloc
            logger.info(f"Testing subdomain takeover on {domain}")
            proof = self.test_subdomain_takeover(domain)
            if proof:
                all_proofs.append(proof)
        
        # Test 4: XSS (if we have discovered paths)
        if discovered_paths:
            logger.info(f"Testing XSS on {len(discovered_paths)} paths")
            all_proofs.extend(self.test_xss(target_url, discovered_paths))
        
        # Test 5: SQLi (if we have discovered paths)
        if discovered_paths:
            logger.info(f"Testing SQL injection on {len(discovered_paths)} paths")
            all_proofs.extend(self.test_sqli(target_url, discovered_paths))
        
        # Aggregate results
        results['total_vulns'] = len(all_proofs)
        results['critical_vulns'] = len([p for p in all_proofs if p.severity == 'CRITICAL'])
        results['high_vulns'] = len([p for p in all_proofs if p.severity == 'HIGH'])
        results['proofs'] = [
            {
                'type': p.vuln_type,
                'severity': p.severity,
                'url': p.url,
                'payload': p.payload,
                'evidence': p.evidence,
                'remediation': p.remediation
            }
            for p in all_proofs
        ]
        
        return results


def calculate_validated_risk_score(recon_data: Dict, validation_results: Dict = None) -> Dict:
    """
    Enhanced risk scoring with validation
    
    Args:
        recon_data: Data from reconnaissance
        validation_results: Results from validation (optional)
    
    Returns:
        Enhanced risk analysis
    """
    from src.controllers.visualization import calculate_exposure_score
    
    # Calculate base heuristic score
    # (This would use your existing calculate_risk_score function)
    base_score = 0
    base_findings = []
    
    # Simple heuristic scoring
    if 'admin' in recon_data.get('subdomain', '').lower():
        base_score += 25
        base_findings.append({'type': 'critical_subdomain', 'description': 'Admin subdomain detected'})
    
    if recon_data.get('open_ports'):
        base_score += len(recon_data['open_ports']) * 5
        base_findings.append({'type': 'open_ports', 'description': f"{len(recon_data['open_ports'])} open ports"})
    
    # Add validated findings if available
    validated_score = 0
    if validation_results:
        if validation_results['critical_vulns'] > 0:
            validated_score += validation_results['critical_vulns'] * 30
        
        if validation_results['high_vulns'] > 0:
            validated_score += validation_results['high_vulns'] * 15
    
    total_score = min(base_score + validated_score, 100)
    
    # Determine tier
    if validation_results and validation_results['critical_vulns'] > 0:
        tier = 'CRITICAL_CONFIRMED'
    elif total_score >= 50:
        tier = 'CRITICAL'
    elif total_score >= 30:
        tier = 'HIGH'
    elif total_score >= 15:
        tier = 'MEDIUM'
    else:
        tier = 'LOW'
    
    return {
        'score': total_score,
        'tier': tier,
        'heuristic_score': base_score,
        'validated_score': validated_score,
        'heuristic_findings': base_findings,
        'validated_findings': validation_results['proofs'] if validation_results else [],
        'total_vulns': validation_results['total_vulns'] if validation_results else 0,
        'critical_vulns': validation_results['critical_vulns'] if validation_results else 0,
        'high_vulns': validation_results['high_vulns'] if validation_results else 0,
    }
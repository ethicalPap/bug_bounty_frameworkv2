import asyncio
import subprocess
import json
import uuid
import logging
import re
import os
import tempfile
from typing import List, Dict, Optional, Set
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
import requests
from requests.packages.urllib3.exceptions import InsecureRequestWarning
from sqlalchemy.orm import Session
from sqlalchemy import and_, func  # ✅ FIXED: Import func from sqlalchemy
from src.config.database import get_db, SessionLocal
from src.models import Subdomain

# Disable SSL warnings
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ScanConfig:
    domain: str
    use_subfinder: bool = True
    use_sublist3r: bool = True
    use_amass: bool = True
    use_assetfinder: bool = True
    use_findomain: bool = True
    use_chaos: bool = False  # Requires API key
    chaos_api_key: Optional[str] = None
    timeout: int = 300  # 5 minutes per tool
    output_format: str = "json"

class SubdomainScanner:
    def __init__(self, config: ScanConfig):
        self.config = config
        self.scan_id = str(uuid.uuid4())
        self.found_subdomains: Set[str] = set()
        self.results: List[Dict] = []
        
    def check_tool_installed(self, tool_name: str) -> bool:
        """Check if a tool is installed and available"""
        try:
            result = subprocess.run(['which', tool_name], 
                                   capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            return False
        except Exception as e:
            logger.warning(f"Error checking tool {tool_name}: {e}")
            return False

    def run_subfinder(self) -> Set[str]:
        """Run subfinder tool"""
        if not self.check_tool_installed('subfinder'):
            logger.warning("Subfinder not installed, skipping...")
            return set()
        
        logger.info(f"Running subfinder for {self.config.domain}")
        subdomains = set()
        
        try:
            cmd = [
                'subfinder',
                '-d', self.config.domain,
                '-silent',
                '-o', '/dev/stdout'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, 
                                   timeout=self.config.timeout)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.strip() and self.config.domain in line:
                        subdomains.add(line.strip().lower())
                        
            logger.info(f"Subfinder found {len(subdomains)} subdomains")
            
        except subprocess.TimeoutExpired:
            logger.error(f"Subfinder timeout for {self.config.domain}")
        except Exception as e:
            logger.error(f"Subfinder error: {e}")
            
        return subdomains

    def run_sublist3r(self) -> Set[str]:
        """Run sublist3r tool"""
        if not self.check_tool_installed('sublist3r'):
            logger.warning("Sublist3r not installed, skipping...")
            return set()
            
        logger.info(f"Running sublist3r for {self.config.domain}")
        subdomains = set()
        
        try:
            with tempfile.NamedTemporaryFile(mode='w+', delete=False, suffix='.txt') as tmp_file:
                cmd = [
                    'sublist3r',
                    '-d', self.config.domain,
                    '-o', tmp_file.name
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True,
                                       timeout=self.config.timeout)
                
                # Read results from temp file
                if os.path.exists(tmp_file.name):
                    with open(tmp_file.name, 'r') as f:
                        for line in f:
                            line = line.strip().lower()
                            if line and self.config.domain in line:
                                subdomains.add(line)
                    
                    os.unlink(tmp_file.name)
                    
            logger.info(f"Sublist3r found {len(subdomains)} subdomains")
            
        except subprocess.TimeoutExpired:
            logger.error(f"Sublist3r timeout for {self.config.domain}")
        except Exception as e:
            logger.error(f"Sublist3r error: {e}")
            
        return subdomains

    def run_amass(self) -> Set[str]:
        """Run amass tool"""
        if not self.check_tool_installed('amass'):
            logger.warning("Amass not installed, skipping...")
            return set()
            
        logger.info(f"Running amass for {self.config.domain}")
        subdomains = set()
        
        try:
            cmd = [
                'amass', 'enum',
                '-d', self.config.domain,
                '-silent'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True,
                                   timeout=self.config.timeout)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.strip() and self.config.domain in line:
                        subdomains.add(line.strip().lower())
                        
            logger.info(f"Amass found {len(subdomains)} subdomains")
            
        except subprocess.TimeoutExpired:
            logger.error(f"Amass timeout for {self.config.domain}")
        except Exception as e:
            logger.error(f"Amass error: {e}")
            
        return subdomains

    def run_assetfinder(self) -> Set[str]:
        """Run assetfinder tool"""
        if not self.check_tool_installed('assetfinder'):
            logger.warning("Assetfinder not installed, skipping...")
            return set()
            
        logger.info(f"Running assetfinder for {self.config.domain}")
        subdomains = set()
        
        try:
            cmd = ['assetfinder', '--subs-only', self.config.domain]
            
            result = subprocess.run(cmd, capture_output=True, text=True,
                                   timeout=self.config.timeout)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.strip() and self.config.domain in line:
                        subdomains.add(line.strip().lower())
                        
            logger.info(f"Assetfinder found {len(subdomains)} subdomains")
            
        except subprocess.TimeoutExpired:
            logger.error(f"Assetfinder timeout for {self.config.domain}")
        except Exception as e:
            logger.error(f"Assetfinder error: {e}")
            
        return subdomains

    def run_findomain(self) -> Set[str]:
        """Run findomain tool"""
        if not self.check_tool_installed('findomain'):
            logger.warning("Findomain not installed, skipping...")
            return set()
            
        logger.info(f"Running findomain for {self.config.domain}")
        subdomains = set()
        
        try:
            cmd = [
                'findomain',
                '-t', self.config.domain,
                '-q'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True,
                                   timeout=self.config.timeout)
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.strip() and self.config.domain in line:
                        subdomains.add(line.strip().lower())
                        
            logger.info(f"Findomain found {len(subdomains)} subdomains")
            
        except subprocess.TimeoutExpired:
            logger.error(f"Findomain timeout for {self.config.domain}")
        except Exception as e:
            logger.error(f"Findomain error: {e}")
            
        return subdomains

    def run_chaos(self) -> Set[str]:
        """Run chaos API client"""
        if not self.config.use_chaos or not self.config.chaos_api_key:
            return set()
            
        logger.info(f"Running chaos API for {self.config.domain}")
        subdomains = set()
        
        try:
            headers = {'Authorization': f'Bearer {self.config.chaos_api_key}'}
            url = f'https://dns.projectdiscovery.io/dns/{self.config.domain}/subdomains'
            
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if 'subdomains' in data:
                    for subdomain in data['subdomains']:
                        full_domain = f"{subdomain}.{self.config.domain}"
                        subdomains.add(full_domain.lower())
                        
            logger.info(f"Chaos API found {len(subdomains)} subdomains")
            
        except Exception as e:
            logger.error(f"Chaos API error: {e}")
            
        return subdomains

    def validate_subdomain(self, subdomain: str) -> bool:
        """Validate if subdomain is legitimate"""
        # Basic validation
        if not subdomain or not self.config.domain in subdomain:
            return False
            
        # Check for valid domain format
        domain_pattern = re.compile(
            r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
        )
        
        if not domain_pattern.match(subdomain):
            return False
            
        # Filter out wildcards and invalid entries
        invalid_patterns = ['*', '?.', 'www.www.', '..']
        for pattern in invalid_patterns:
            if pattern in subdomain:
                return False
                
        return True

    def deduplicate_subdomains(self, db: Session) -> int:
        """Remove duplicate subdomains from database"""
        logger.info("Deduplicating subdomains in database...")
        
        # ✅ FIXED: Use func from sqlalchemy import instead of db.func
        duplicates = db.query(Subdomain).filter(
            Subdomain.full_domain.in_(
                db.query(Subdomain.full_domain)
                .group_by(Subdomain.full_domain)
                .having(func.count(Subdomain.id) > 1)  # ✅ FIXED
            )
        ).all()
        
        # Group by full_domain and keep only the latest one
        domain_groups = {}
        for subdomain in duplicates:
            if subdomain.full_domain not in domain_groups:
                domain_groups[subdomain.full_domain] = []
            domain_groups[subdomain.full_domain].append(subdomain)
        
        deleted_count = 0
        for domain, records in domain_groups.items():
            # Sort by created_at and keep the latest
            records.sort(key=lambda x: x.created_at, reverse=True)
            for record in records[1:]:  # Delete all except the first (latest)
                db.delete(record)
                deleted_count += 1
        
        db.commit()
        logger.info(f"Removed {deleted_count} duplicate subdomains")
        return deleted_count

    def save_to_database(self, subdomains: Set[str]) -> int:
        """Save discovered subdomains to database"""
        db = SessionLocal()
        saved_count = 0
        
        try:
            for subdomain in subdomains:
                if not self.validate_subdomain(subdomain):
                    continue
                
                # Check if subdomain already exists
                existing = db.query(Subdomain).filter(
                    Subdomain.full_domain == subdomain
                ).first()
                
                if not existing:
                    # Extract subdomain part
                    subdomain_part = subdomain.replace(f".{self.config.domain}", "")
                    if subdomain_part == self.config.domain:
                        subdomain_part = "@"  # Root domain
                    
                    new_subdomain = Subdomain(
                        domain=self.config.domain,
                        subdomain=subdomain_part,
                        full_domain=subdomain,
                        scan_id=self.scan_id,
                        is_active=False  # Will be updated by HTTP checker
                    )
                    
                    db.add(new_subdomain)
                    saved_count += 1
                else:
                    # Update scan_id for existing subdomain
                    existing.scan_id = self.scan_id
                    existing.updated_at = datetime.utcnow()
            
            db.commit()
            logger.info(f"Saved {saved_count} new subdomains to database")
            
            # Deduplicate after saving
            self.deduplicate_subdomains(db)
            
        except Exception as e:
            logger.error(f"Database error: {e}")
            db.rollback()
        finally:
            db.close()
            
        return saved_count

    def run_scan(self) -> Dict:
        """Run complete subdomain scan"""
        logger.info(f"Starting subdomain scan for {self.config.domain} (scan_id: {self.scan_id})")
        
        all_subdomains = set()
        tool_results = {}
        
        # Run all enabled tools
        if self.config.use_subfinder:
            subfinder_results = self.run_subfinder()
            all_subdomains.update(subfinder_results)
            tool_results['subfinder'] = len(subfinder_results)
        
        if self.config.use_sublist3r:
            sublist3r_results = self.run_sublist3r()
            all_subdomains.update(sublist3r_results)
            tool_results['sublist3r'] = len(sublist3r_results)
        
        if self.config.use_amass:
            amass_results = self.run_amass()
            all_subdomains.update(amass_results)
            tool_results['amass'] = len(amass_results)
        
        if self.config.use_assetfinder:
            assetfinder_results = self.run_assetfinder()
            all_subdomains.update(assetfinder_results)
            tool_results['assetfinder'] = len(assetfinder_results)
        
        if self.config.use_findomain:
            findomain_results = self.run_findomain()
            all_subdomains.update(findomain_results)
            tool_results['findomain'] = len(findomain_results)
        
        if self.config.use_chaos:
            chaos_results = self.run_chaos()
            all_subdomains.update(chaos_results)
            tool_results['chaos'] = len(chaos_results)
        
        # Save results to database
        saved_count = self.save_to_database(all_subdomains)
        
        scan_summary = {
            'scan_id': self.scan_id,
            'domain': self.config.domain,
            'total_unique_subdomains': len(all_subdomains),
            'new_subdomains_saved': saved_count,
            'tool_results': tool_results,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        logger.info(f"Scan completed: {scan_summary}")
        return scan_summary

# API Functions
def start_subdomain_scan(domain: str, **kwargs) -> Dict:
    """Start a new subdomain scan"""
    config = ScanConfig(domain=domain, **kwargs)
    scanner = SubdomainScanner(config)
    return scanner.run_scan()

def get_subdomains_by_domain(domain: str, db: Session) -> List[Dict]:
    """Get all subdomains for a domain"""
    subdomains = db.query(Subdomain).filter(
        Subdomain.domain == domain
    ).order_by(Subdomain.created_at.desc()).all()
    
    return [subdomain.to_dict() for subdomain in subdomains]

def get_scan_results(scan_id: str, db: Session) -> List[Dict]:
    """Get results for a specific scan"""
    subdomains = db.query(Subdomain).filter(
        Subdomain.scan_id == scan_id
    ).order_by(Subdomain.full_domain).all()
    
    return [subdomain.to_dict() for subdomain in subdomains]

def delete_duplicates(domain: str, db: Session) -> int:
    """Delete duplicate subdomains for a domain"""
    scanner = SubdomainScanner(ScanConfig(domain=domain))
    return scanner.deduplicate_subdomains(db)
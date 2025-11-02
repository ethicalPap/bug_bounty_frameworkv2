import asyncio
import subprocess
import json
import uuid
import logging
import re
import os
import tempfile
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional, Set, Tuple
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
import socket
from sqlalchemy.orm import Session
from sqlalchemy import and_

from database import get_db, SessionLocal
from PortScan import PortScan, PortScanSummary
from Subdomain import Subdomain

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Common port lists
COMMON_PORTS = {
    'top-100': '7,9,13,21-23,25-26,37,53,79-81,88,106,110-111,113,119,135,139,143-144,179,199,389,427,443-445,465,513-515,543-544,548,554,587,631,646,873,990,993,995,1025-1029,1110,1433,1720,1723,1755,1900,2000-2001,2049,2121,2717,3000,3128,3306,3389,3986,4899,5000,5009,5051,5060,5101,5190,5357,5432,5631,5666,5800,5900,6000-6001,6646,7070,8000,8008-8009,8080-8081,8443,8888,9100,9999-10000,32768,49152-49157',
    'top-1000': '1-1000',
    'common-web': '80,443,8000,8008,8080,8081,8443,8888,3000,5000,5001,9000,9001,9090',
    'common-db': '1433,1434,3306,5432,5984,6379,9042,9200,9300,27017,27018,27019,28015',
    'common-admin': '21,22,23,3389,5900,5901,5902,5903,5904,5905,5906,5907,5908,5909',
    'all-tcp': '1-65535'
}

@dataclass
class PortScanConfig:
    targets: List[str]  # List of IPs or domains to scan
    ports: str = 'top-100'  # Port range or preset (top-100, top-1000, common-web, etc.)
    scan_type: str = 'quick'  # quick, full, stealth, udp, comprehensive
    
    # Tool selection
    use_nmap: bool = True
    use_masscan: bool = False
    use_naabu: bool = True
    
    # Nmap options
    nmap_scan_type: str = '-sS'  # -sS (SYN), -sT (Connect), -sU (UDP), -sV (Version)
    nmap_timing: str = 'T4'  # T0-T5 (paranoid to insane)
    nmap_scripts: Optional[str] = None  # Nmap scripts to run (e.g., 'default', 'vuln')
    service_detection: bool = True
    os_detection: bool = False
    version_intensity: int = 5  # 0-9
    
    # Masscan options
    masscan_rate: int = 10000  # Packets per second
    
    # Naabu options
    naabu_rate: int = 1000  # Packets per second
    naabu_retries: int = 3
    
    # General options
    timeout: int = 600  # Timeout per tool in seconds
    threads: int = 10
    exclude_closed: bool = True  # Don't save closed ports
    subdomain_ids: Optional[List[int]] = None  # Link to subdomain IDs
    
class PortScanner:
    def __init__(self, config: PortScanConfig):
        self.config = config
        self.scan_id = str(uuid.uuid4())
        self.found_ports: Set[Tuple[str, int, str]] = set()  # (target, port, state)
        self.scan_start_time = None
        self.scan_end_time = None
        
    def check_tool_installed(self, tool_name: str) -> bool:
        """Check if a tool is installed and available"""
        try:
            result = subprocess.run(['which', tool_name], 
                                   capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except Exception as e:
            logger.warning(f"Error checking tool {tool_name}: {e}")
            return False
    
    def resolve_target(self, target: str) -> Optional[str]:
        """Resolve domain to IP address"""
        try:
            # If it's already an IP, return it
            socket.inet_aton(target)
            return target
        except socket.error:
            # It's a domain, resolve it
            try:
                ip = socket.gethostbyname(target)
                logger.info(f"Resolved {target} to {ip}")
                return ip
            except socket.gaierror:
                logger.warning(f"Failed to resolve {target}")
                return None
    
    def get_port_range(self) -> str:
        """Get the port range to scan"""
        if self.config.ports in COMMON_PORTS:
            return COMMON_PORTS[self.config.ports]
        return self.config.ports
    
    def is_common_port(self, port: int) -> bool:
        """Check if port is in the common ports list"""
        common = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 
                 993, 995, 1723, 3306, 3389, 5900, 8080, 8443]
        return port in common
    
    # ==================== NMAP SCANNER ====================
    
    def run_nmap(self, target: str) -> List[Dict]:
        """Run nmap port scan"""
        if not self.check_tool_installed('nmap'):
            logger.warning("nmap not installed, skipping...")
            return []
        
        logger.info(f"Running nmap for {target}")
        results = []
        
        try:
            output_file = f"/tmp/nmap_{self.scan_id}_{target.replace('.', '_')}.xml"
            
            # Build nmap command
            cmd = [
                'nmap',
                self.config.nmap_scan_type,
                f'-{self.config.nmap_timing}',
                '-p', self.get_port_range(),
                '--open',  # Only show open ports
                '-oX', output_file,  # XML output
            ]
            
            # Add service detection
            if self.config.service_detection:
                cmd.extend(['-sV', f'--version-intensity', str(self.config.version_intensity)])
            
            # Add OS detection
            if self.config.os_detection:
                cmd.append('-O')
            
            # Add scripts
            if self.config.nmap_scripts:
                cmd.extend(['--script', self.config.nmap_scripts])
            
            # Add target
            cmd.append(target)
            
            logger.info(f"Nmap command: {' '.join(cmd)}")
            
            # Run nmap
            result = subprocess.run(cmd, capture_output=True, text=True, 
                                   timeout=self.config.timeout)
            
            # Parse XML output
            if os.path.exists(output_file):
                results = self.parse_nmap_xml(output_file, target)
                os.unlink(output_file)
            
            logger.info(f"nmap found {len(results)} open ports on {target}")
            
        except subprocess.TimeoutExpired:
            logger.error(f"nmap timeout for {target}")
        except Exception as e:
            logger.error(f"nmap error for {target}: {e}")
        
        return results
    
    def parse_nmap_xml(self, xml_file: str, target: str) -> List[Dict]:
        """Parse nmap XML output"""
        results = []
        
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            # Find host element
            for host in root.findall('host'):
                # Get address
                addr = host.find('address')
                if addr is None:
                    continue
                
                ip_address = addr.get('addr')
                
                # Get ports
                ports_elem = host.find('ports')
                if ports_elem is None:
                    continue
                
                for port in ports_elem.findall('port'):
                    port_id = int(port.get('portid'))
                    protocol = port.get('protocol', 'tcp')
                    
                    # Get state
                    state = port.find('state')
                    if state is None:
                        continue
                    
                    port_state = state.get('state', 'unknown')
                    
                    # Get service info
                    service = port.find('service')
                    service_name = ''
                    service_version = ''
                    service_product = ''
                    cpe = ''
                    
                    if service is not None:
                        service_name = service.get('name', '')
                        service_product = service.get('product', '')
                        service_version = service.get('version', '')
                        
                        # Build version string
                        if service_product and service_version:
                            service_version = f"{service_product} {service_version}"
                        elif service_product:
                            service_version = service_product
                        
                        # Get CPE
                        cpe_elem = service.find('cpe')
                        if cpe_elem is not None:
                            cpe = cpe_elem.text or ''
                    
                    # Get script output
                    script_output = []
                    for script in port.findall('script'):
                        script_id = script.get('id', '')
                        script_out = script.get('output', '')
                        if script_id and script_out:
                            script_output.append(f"{script_id}:\n{script_out}")
                    
                    script_text = '\n\n'.join(script_output) if script_output else None
                    
                    # Create result
                    result = {
                        'target': target,
                        'ip_address': ip_address,
                        'port': port_id,
                        'protocol': protocol,
                        'state': port_state,
                        'service': service_name,
                        'version': service_version,
                        'cpe': cpe,
                        'script_output': script_text,
                        'tool': 'nmap',
                        'is_common_port': self.is_common_port(port_id)
                    }
                    
                    results.append(result)
                    self.found_ports.add((target, port_id, port_state))
            
        except ET.ParseError as e:
            logger.error(f"Failed to parse nmap XML: {e}")
        except Exception as e:
            logger.error(f"Error parsing nmap XML: {e}")
        
        return results
    
    # ==================== MASSCAN SCANNER ====================
    
    def run_masscan(self, target: str) -> List[Dict]:
        """Run masscan port scan"""
        if not self.check_tool_installed('masscan'):
            logger.warning("masscan not installed, skipping...")
            return []
        
        logger.info(f"Running masscan for {target}")
        results = []
        
        try:
            output_file = f"/tmp/masscan_{self.scan_id}_{target.replace('.', '_')}.json"
            
            # Build masscan command
            cmd = [
                'masscan',
                target,
                '-p', self.get_port_range(),
                '--rate', str(self.config.masscan_rate),
                '-oJ', output_file,  # JSON output
                '--open-only'
            ]
            
            logger.info(f"Masscan command: {' '.join(cmd)}")
            
            # Run masscan (requires root)
            result = subprocess.run(cmd, capture_output=True, text=True,
                                   timeout=self.config.timeout)
            
            # Parse JSON output
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    # Masscan outputs line-delimited JSON
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith('#'):
                            continue
                        
                        try:
                            data = json.loads(line.rstrip(','))  # Remove trailing comma
                            
                            if 'ports' in data:
                                for port_info in data['ports']:
                                    port_id = port_info.get('port')
                                    protocol = port_info.get('proto', 'tcp')
                                    status = port_info.get('status', 'open')
                                    
                                    result_dict = {
                                        'target': target,
                                        'ip_address': data.get('ip', target),
                                        'port': port_id,
                                        'protocol': protocol,
                                        'state': status,
                                        'service': '',
                                        'tool': 'masscan',
                                        'is_common_port': self.is_common_port(port_id)
                                    }
                                    
                                    results.append(result_dict)
                                    self.found_ports.add((target, port_id, status))
                        
                        except json.JSONDecodeError:
                            continue
                
                os.unlink(output_file)
            
            logger.info(f"masscan found {len(results)} open ports on {target}")
            
        except subprocess.TimeoutExpired:
            logger.error(f"masscan timeout for {target}")
        except Exception as e:
            logger.error(f"masscan error for {target}: {e}")
        
        return results
    
    # ==================== NAABU SCANNER ====================
    
    def run_naabu(self, target: str) -> List[Dict]:
        """Run naabu port scan"""
        if not self.check_tool_installed('naabu'):
            logger.warning("naabu not installed, skipping...")
            return []
        
        logger.info(f"Running naabu for {target}")
        results = []
        
        try:
            output_file = f"/tmp/naabu_{self.scan_id}_{target.replace('.', '_')}.json"
            
            # Build naabu command
            cmd = [
                'naabu',
                '-host', target,
                '-p', self.get_port_range(),
                '-rate', str(self.config.naabu_rate),
                '-retries', str(self.config.naabu_retries),
                '-json',
                '-o', output_file,
                '-silent'
            ]
            
            # Add service detection if enabled
            if self.config.service_detection:
                cmd.append('-sV')
            
            logger.info(f"Naabu command: {' '.join(cmd)}")
            
            # Run naabu
            result = subprocess.run(cmd, capture_output=True, text=True,
                                   timeout=self.config.timeout)
            
            # Parse JSON output
            if os.path.exists(output_file):
                with open(output_file, 'r') as f:
                    for line in f:
                        try:
                            data = json.loads(line.strip())
                            
                            port_id = data.get('port')
                            if port_id:
                                result_dict = {
                                    'target': target,
                                    'ip_address': data.get('ip', target),
                                    'port': port_id,
                                    'protocol': 'tcp',  # Naabu primarily does TCP
                                    'state': 'open',
                                    'service': data.get('service', ''),
                                    'version': data.get('version', ''),
                                    'tool': 'naabu',
                                    'is_common_port': self.is_common_port(port_id)
                                }
                                
                                results.append(result_dict)
                                self.found_ports.add((target, port_id, 'open'))
                        
                        except json.JSONDecodeError:
                            continue
                
                os.unlink(output_file)
            
            logger.info(f"naabu found {len(results)} open ports on {target}")
            
        except subprocess.TimeoutExpired:
            logger.error(f"naabu timeout for {target}")
        except Exception as e:
            logger.error(f"naabu error for {target}: {e}")
        
        return results
    
    # ==================== DATABASE OPERATIONS ====================
    
    def save_to_database(self, results: List[Dict]) -> int:
        """Save port scan results to database"""
        db = SessionLocal()
        saved_count = 0
        
        try:
            for result in results:
                try:
                    # Skip closed ports if configured
                    if self.config.exclude_closed and result.get('state') == 'closed':
                        continue
                    
                    # Check if port already exists for this target
                    existing = db.query(PortScan).filter(
                        PortScan.target == result.get('target'),
                        PortScan.port == result.get('port'),
                        PortScan.protocol == result.get('protocol', 'tcp')
                    ).first()
                    
                    # Get subdomain_id if available
                    subdomain_id = None
                    if self.config.subdomain_ids:
                        # Try to match target to subdomain
                        subdomain = db.query(Subdomain).filter(
                            Subdomain.full_domain == result.get('target')
                        ).first()
                        if subdomain:
                            subdomain_id = subdomain.id
                    
                    if not existing:
                        new_port = PortScan(
                            subdomain_id=subdomain_id,
                            target=result.get('target'),
                            port=result.get('port'),
                            protocol=result.get('protocol', 'tcp'),
                            state=result.get('state', 'open'),
                            service=result.get('service', '')[:100],
                            version=result.get('version', '')[:255],
                            banner=result.get('banner'),
                            cpe=result.get('cpe'),
                            script_output=result.get('script_output'),
                            tool_name=result.get('tool', 'unknown'),
                            scan_type=self.config.scan_type,
                            response_time=result.get('response_time'),
                            is_common_port=result.get('is_common_port', False),
                            scan_id=self.scan_id
                        )
                        
                        db.add(new_port)
                        saved_count += 1
                    else:
                        # Update existing record with new information
                        if result.get('service'):
                            existing.service = result.get('service', '')[:100]
                        if result.get('version'):
                            existing.version = result.get('version', '')[:255]
                        if result.get('script_output'):
                            existing.script_output = result.get('script_output')
                        existing.updated_at = datetime.utcnow()
                        existing.scan_id = self.scan_id
                
                except Exception as e:
                    logger.error(f"Error saving port result: {e}")
                    continue
            
            db.commit()
            logger.info(f"Saved {saved_count} new port scan results to database")
            
        except Exception as e:
            logger.error(f"Database error: {e}")
            db.rollback()
        finally:
            db.close()
        
        return saved_count
    
    def save_scan_summary(self, tool_results: Dict, status: str = 'completed', 
                         error_message: Optional[str] = None):
        """Save scan summary to database"""
        db = SessionLocal()
        
        try:
            # Calculate statistics
            open_ports = len([p for p in self.found_ports if p[2] == 'open'])
            filtered_ports = len([p for p in self.found_ports if p[2] == 'filtered'])
            closed_ports = len([p for p in self.found_ports if p[2] == 'closed'])
            
            # Calculate duration
            duration = None
            if self.scan_start_time and self.scan_end_time:
                duration = int((self.scan_end_time - self.scan_start_time).total_seconds())
            
            summary = PortScanSummary(
                scan_id=self.scan_id,
                target_count=len(self.config.targets),
                total_ports_scanned=len(self.found_ports),
                open_ports=open_ports,
                closed_ports=closed_ports,
                filtered_ports=filtered_ports,
                scan_type=self.config.scan_type,
                port_range=self.config.ports,
                tools_used=','.join(tool_results.keys()),
                scan_duration=duration,
                status=status,
                error_message=error_message,
                completed_at=self.scan_end_time
            )
            
            db.add(summary)
            db.commit()
            
            logger.info(f"Saved scan summary for scan_id: {self.scan_id}")
            
        except Exception as e:
            logger.error(f"Failed to save scan summary: {e}")
            db.rollback()
        finally:
            db.close()
    
    # ==================== MAIN SCAN ORCHESTRATION ====================
    
    def run_scan(self) -> Dict:
        """Run complete port scan"""
        logger.info(f"Starting port scan (scan_id: {self.scan_id})")
        logger.info(f"Targets: {len(self.config.targets)}")
        logger.info(f"Ports: {self.config.ports}")
        logger.info(f"Scan type: {self.config.scan_type}")
        
        self.scan_start_time = datetime.utcnow()
        
        all_results = []
        tool_results = {}
        
        try:
            for target in self.config.targets:
                logger.info(f"\n{'='*60}")
                logger.info(f"Scanning target: {target}")
                logger.info(f"{'='*60}")
                
                # Resolve target if needed
                resolved_target = self.resolve_target(target)
                if not resolved_target:
                    logger.warning(f"Skipping {target} - resolution failed")
                    continue
                
                # Run nmap
                if self.config.use_nmap:
                    nmap_results = self.run_nmap(target)
                    all_results.extend(nmap_results)
                    tool_results.setdefault('nmap', 0)
                    tool_results['nmap'] += len(nmap_results)
                
                # Run masscan
                if self.config.use_masscan:
                    masscan_results = self.run_masscan(target)
                    all_results.extend(masscan_results)
                    tool_results.setdefault('masscan', 0)
                    tool_results['masscan'] += len(masscan_results)
                
                # Run naabu
                if self.config.use_naabu:
                    naabu_results = self.run_naabu(target)
                    all_results.extend(naabu_results)
                    tool_results.setdefault('naabu', 0)
                    tool_results['naabu'] += len(naabu_results)
            
            self.scan_end_time = datetime.utcnow()
            
            # Save results to database
            saved_count = self.save_to_database(all_results)
            
            # Save summary
            self.save_scan_summary(tool_results, status='completed')
            
            scan_summary = {
                'scan_id': self.scan_id,
                'targets': self.config.targets,
                'target_count': len(self.config.targets),
                'scan_type': self.config.scan_type,
                'ports_scanned': self.config.ports,
                'total_results': len(all_results),
                'unique_ports': len(self.found_ports),
                'new_results_saved': saved_count,
                'open_ports': len([p for p in self.found_ports if p[2] == 'open']),
                'tool_results': tool_results,
                'duration_seconds': int((self.scan_end_time - self.scan_start_time).total_seconds()),
                'timestamp': self.scan_end_time.isoformat()
            }
            
            logger.info(f"\n{'='*60}")
            logger.info(f"Port scan completed: {scan_summary}")
            logger.info(f"{'='*60}\n")
            
            return scan_summary
            
        except Exception as e:
            self.scan_end_time = datetime.utcnow()
            logger.error(f"Port scan failed: {e}")
            self.save_scan_summary(tool_results, status='failed', error_message=str(e))
            raise


# ==================== API FUNCTIONS ====================

def start_port_scan(targets: List[str], **kwargs) -> Dict:
    """Start a new port scan"""
    config = PortScanConfig(targets=targets, **kwargs)
    scanner = PortScanner(config)
    return scanner.run_scan()

def get_ports_by_target(target: str, db: Session) -> List[Dict]:
    """Get all discovered ports for a target"""
    results = db.query(PortScan).filter(
        PortScan.target == target
    ).order_by(PortScan.port).all()
    
    return [result.to_dict() for result in results]

def get_ports_by_subdomain(subdomain_id: int, db: Session) -> List[Dict]:
    """Get all ports for a subdomain"""
    results = db.query(PortScan).filter(
        PortScan.subdomain_id == subdomain_id
    ).order_by(PortScan.port).all()
    
    return [result.to_dict() for result in results]

def get_ports_by_scan(scan_id: str, db: Session) -> List[Dict]:
    """Get results for a specific scan"""
    results = db.query(PortScan).filter(
        PortScan.scan_id == scan_id
    ).order_by(PortScan.target, PortScan.port).all()
    
    return [result.to_dict() for result in results]

def get_scan_summary(scan_id: str, db: Session) -> Optional[Dict]:
    """Get summary for a specific scan"""
    summary = db.query(PortScanSummary).filter(
        PortScanSummary.scan_id == scan_id
    ).first()
    
    return summary.to_dict() if summary else None

def get_open_ports(db: Session, limit: int = 100) -> List[Dict]:
    """Get all open ports across all scans"""
    results = db.query(PortScan).filter(
        PortScan.state == 'open'
    ).order_by(PortScan.created_at.desc()).limit(limit).all()
    
    return [result.to_dict() for result in results]

def get_vulnerable_services(db: Session) -> List[Dict]:
    """Get ports with potentially vulnerable services"""
    results = db.query(PortScan).filter(
        PortScan.is_vulnerable == True
    ).order_by(PortScan.created_at.desc()).all()
    
    return [result.to_dict() for result in results]

def get_ports_by_service(service: str, db: Session) -> List[Dict]:
    """Get all ports running a specific service"""
    results = db.query(PortScan).filter(
        PortScan.service.ilike(f'%{service}%')
    ).order_by(PortScan.target, PortScan.port).all()
    
    return [result.to_dict() for result in results]
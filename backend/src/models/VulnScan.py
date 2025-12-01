from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index, JSON
from sqlalchemy.sql import func
from datetime import datetime

# Import the SHARED Base from database config
from src.config.database import Base


class VulnScan(Base):
    """Store vulnerability scan results"""
    __tablename__ = 'vuln_scans'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    subdomain_id = Column(Integer, nullable=True, index=True)  # Reference to subdomains table
    target = Column(String(512), nullable=False, index=True)  # Target URL or domain
    scanner = Column(String(50), nullable=False, index=True)  # nuclei, nikto, sqlmap, etc.
    scan_type = Column(String(50))  # quick, full, custom
    
    # Results summary
    total_vulns = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    high_count = Column(Integer, default=0)
    medium_count = Column(Integer, default=0)
    low_count = Column(Integer, default=0)
    info_count = Column(Integer, default=0)
    
    # Detailed results stored as JSON
    vulnerabilities = Column(JSON)  # Array of vulnerability objects
    scanner_output = Column(Text)  # Raw scanner output
    
    # Scan metadata
    scan_duration = Column(String(50))  # e.g., "12.5s"
    templates_used = Column(JSON)  # For nuclei: list of template categories
    scan_config = Column(JSON)  # Configuration used for this scan
    
    # Status
    status = Column(String(20), default='completed', index=True)  # running, completed, failed, stopped
    error_message = Column(Text)
    
    # Grouping
    scan_id = Column(String(50), index=True)  # For grouping batch scans
    batch_id = Column(String(50), index=True)  # For grouping multiple targets in one batch
    
    # Timestamps
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_vuln_target_scanner', 'target', 'scanner'),
        Index('idx_vuln_scan_status', 'scan_id', 'status'),
        Index('idx_vuln_severity', 'critical_count', 'high_count'),
    )
    
    def __repr__(self):
        return f"<VulnScan(target='{self.target}', scanner='{self.scanner}', vulns={self.total_vulns})>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'subdomain_id': self.subdomain_id,
            'target': self.target,
            'scanner': self.scanner,
            'scan_type': self.scan_type,
            'total_vulns': self.total_vulns,
            'critical_count': self.critical_count,
            'high_count': self.high_count,
            'medium_count': self.medium_count,
            'low_count': self.low_count,
            'info_count': self.info_count,
            'vulnerabilities': self.vulnerabilities,
            'scanner_output': self.scanner_output,
            'scan_duration': self.scan_duration,
            'templates_used': self.templates_used,
            'scan_config': self.scan_config,
            'status': self.status,
            'error_message': self.error_message,
            'scan_id': self.scan_id,
            'batch_id': self.batch_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class VulnFinding(Base):
    """Store individual vulnerability findings for detailed tracking"""
    __tablename__ = 'vuln_findings'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    vuln_scan_id = Column(Integer, ForeignKey('vuln_scans.id'), nullable=False, index=True)
    subdomain_id = Column(Integer, nullable=True, index=True)
    
    # Vulnerability details
    name = Column(String(255), nullable=False, index=True)  # CVE-2023-XXXX, git-exposure, etc.
    vuln_type = Column(String(100), nullable=False, index=True)  # cve, exposure, misconfig, etc.
    severity = Column(String(20), nullable=False, index=True)  # critical, high, medium, low, info
    
    # Location
    target_url = Column(Text, nullable=False)
    matched_at = Column(Text)  # Specific URL/endpoint where vuln was found
    
    # Evidence
    description = Column(Text)
    evidence = Column(Text)
    payload = Column(Text)
    matcher_name = Column(String(255))  # For nuclei template matches
    
    # Metadata
    scanner = Column(String(50), nullable=False)
    template_id = Column(String(255))  # For nuclei
    cve_id = Column(String(50), index=True)  # If applicable
    cwe_id = Column(String(50))  # If applicable
    cvss_score = Column(String(10))
    
    # Remediation
    remediation = Column(Text)
    reference_urls = Column(JSON)  # Array of reference URLs
    
    # Status tracking
    status = Column(String(20), default='open', index=True)  # open, confirmed, false_positive, fixed
    confirmed = Column(Boolean, default=False)
    confirmed_at = Column(DateTime)
    confirmed_by = Column(String(100))
    notes = Column(Text)
    
    # Timestamps
    found_at = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Indexes
    __table_args__ = (
        Index('idx_finding_severity_status', 'severity', 'status'),
        Index('idx_finding_type_scanner', 'vuln_type', 'scanner'),
    )
    
    def __repr__(self):
        return f"<VulnFinding(name='{self.name}', severity='{self.severity}', target='{self.target_url[:50]}...')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'vuln_scan_id': self.vuln_scan_id,
            'subdomain_id': self.subdomain_id,
            'name': self.name,
            'vuln_type': self.vuln_type,
            'severity': self.severity,
            'target_url': self.target_url,
            'matched_at': self.matched_at,
            'description': self.description,
            'evidence': self.evidence,
            'payload': self.payload,
            'matcher_name': self.matcher_name,
            'scanner': self.scanner,
            'template_id': self.template_id,
            'cve_id': self.cve_id,
            'cwe_id': self.cwe_id,
            'cvss_score': self.cvss_score,
            'remediation': self.remediation,
            'reference_urls': self.reference_urls,
            'status': self.status,
            'confirmed': self.confirmed,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'confirmed_by': self.confirmed_by,
            'notes': self.notes,
            'found_at': self.found_at.isoformat() if self.found_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
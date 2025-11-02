from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class PortScan(Base):
    """Store port scanning results for subdomains"""
    __tablename__ = 'port_scans'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    subdomain_id = Column(Integer, nullable=True, index=True)  # Reference to subdomains table (no FK constraint)
    target = Column(String(512), nullable=False, index=True)  # IP address or domain
    port = Column(Integer, nullable=False, index=True)
    protocol = Column(String(10), nullable=False, default='tcp')  # tcp, udp
    state = Column(String(20), nullable=False, index=True)  # open, closed, filtered
    service = Column(String(100))  # http, ssh, mysql, etc.
    version = Column(String(255))  # Service version info
    banner = Column(Text)  # Service banner
    cpe = Column(Text)  # Common Platform Enumeration
    script_output = Column(Text)  # Output from nmap scripts
    tool_name = Column(String(50), nullable=False, index=True)  # nmap, masscan, naabu
    scan_type = Column(String(50))  # full, quick, stealth, etc.
    response_time = Column(Integer)  # Response time in milliseconds
    is_common_port = Column(Boolean, default=False)  # Flag for common ports
    is_vulnerable = Column(Boolean, default=False)  # Flag for potential vulnerabilities
    notes = Column(Text)  # Additional notes
    scan_id = Column(String(50), index=True)  # For grouping scans
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Create composite indexes for common queries
    __table_args__ = (
        Index('idx_target_port', 'target', 'port'),
        Index('idx_target_state', 'target', 'state'),
        Index('idx_scan_tool', 'scan_id', 'tool_name'),
        Index('idx_port_state', 'port', 'state'),
    )
    
    def __repr__(self):
        return f"<PortScan(target='{self.target}', port={self.port}, state='{self.state}', service='{self.service}')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'subdomain_id': self.subdomain_id,
            'target': self.target,
            'port': self.port,
            'protocol': self.protocol,
            'state': self.state,
            'service': self.service,
            'version': self.version,
            'banner': self.banner,
            'cpe': self.cpe,
            'script_output': self.script_output,
            'tool_name': self.tool_name,
            'scan_type': self.scan_type,
            'response_time': self.response_time,
            'is_common_port': self.is_common_port,
            'is_vulnerable': self.is_vulnerable,
            'notes': self.notes,
            'scan_id': self.scan_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class PortScanSummary(Base):
    """Summary statistics for port scans"""
    __tablename__ = 'port_scan_summaries'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_id = Column(String(50), unique=True, nullable=False, index=True)
    target_count = Column(Integer, default=0)
    total_ports_scanned = Column(Integer, default=0)
    open_ports = Column(Integer, default=0)
    closed_ports = Column(Integer, default=0)
    filtered_ports = Column(Integer, default=0)
    scan_type = Column(String(50))
    port_range = Column(String(100))  # e.g., "1-65535" or "80,443,8080"
    tools_used = Column(String(255))  # Comma-separated list
    scan_duration = Column(Integer)  # Duration in seconds
    status = Column(String(20), default='completed')  # running, completed, failed
    error_message = Column(Text)
    created_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime)
    
    def __repr__(self):
        return f"<PortScanSummary(scan_id='{self.scan_id}', targets={self.target_count}, open_ports={self.open_ports})>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'scan_id': self.scan_id,
            'target_count': self.target_count,
            'total_ports_scanned': self.total_ports_scanned,
            'open_ports': self.open_ports,
            'closed_ports': self.closed_ports,
            'filtered_ports': self.filtered_ports,
            'scan_type': self.scan_type,
            'port_range': self.port_range,
            'tools_used': self.tools_used,
            'scan_duration': self.scan_duration,
            'status': self.status,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
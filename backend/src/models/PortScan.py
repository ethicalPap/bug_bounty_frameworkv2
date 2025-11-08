from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.sql import func
from datetime import datetime

# Import the SHARED Base from database config
from src.config.database import Base

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
    
    # Create composite indexes for common queries with UNIQUE names
    __table_args__ = (
        Index('idx_port_target_port', 'target', 'port'),  # RENAMED with port_ prefix
        Index('idx_port_target_state', 'target', 'state'),  # RENAMED with port_ prefix
        Index('idx_port_scan_tool', 'scan_id', 'tool_name'),  # RENAMED with port_ prefix (was idx_scan_tool)
        Index('idx_port_port_state', 'port', 'state'),  # RENAMED with port_ prefix
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
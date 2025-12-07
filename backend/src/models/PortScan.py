"""
Port Scan Model
Stores port scanning results with workspace isolation
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.sql import func
from src.config.database import Base


class PortScan(Base):
    __tablename__ = "port_scans"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Workspace isolation
    workspace_id = Column(String(36), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=True, index=True)
    
    # Target info
    target = Column(String(512), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)
    subdomain_id = Column(Integer, ForeignKey('subdomains.id', ondelete='SET NULL'), nullable=True)
    
    # Scan metadata
    scan_id = Column(String(36), nullable=True, index=True)
    source = Column(String(100), nullable=True)  # nmap, masscan, naabu
    
    # Port info
    port = Column(Integer, nullable=False, index=True)
    protocol = Column(String(10), default='tcp')  # tcp, udp
    state = Column(String(20), default='open', index=True)  # open, closed, filtered
    
    # Service detection
    service = Column(String(100), nullable=True, index=True)
    version = Column(String(255), nullable=True)
    product = Column(String(255), nullable=True)
    extra_info = Column(Text, nullable=True)
    
    # OS detection (if available)
    os_guess = Column(String(255), nullable=True)
    
    # Analysis
    is_vulnerable = Column(Boolean, default=False)
    risk_score = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    
    # Timestamps
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())
    last_checked = Column(DateTime(timezone=True), nullable=True)
    
    # Composite indexes
    __table_args__ = (
        Index('idx_portscan_workspace_target', 'workspace_id', 'target'),
        Index('idx_portscan_workspace_port', 'workspace_id', 'port'),
        Index('idx_portscan_target_port', 'target', 'port', 'protocol', unique=True),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'target': self.target,
            'ip_address': self.ip_address,
            'subdomain_id': self.subdomain_id,
            'scan_id': self.scan_id,
            'source': self.source,
            'port': self.port,
            'protocol': self.protocol,
            'state': self.state,
            'service': self.service,
            'version': self.version,
            'product': self.product,
            'extra_info': self.extra_info,
            'os_guess': self.os_guess,
            'is_vulnerable': self.is_vulnerable,
            'risk_score': self.risk_score,
            'notes': self.notes,
            'discovered_at': self.discovered_at.isoformat() if self.discovered_at else None,
            'last_checked': self.last_checked.isoformat() if self.last_checked else None
        }
    
    def __repr__(self):
        return f"<PortScan(id={self.id}, target={self.target}, port={self.port}/{self.protocol})>"
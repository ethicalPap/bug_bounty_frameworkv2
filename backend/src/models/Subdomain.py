"""
Subdomain Model
Stores discovered subdomains with workspace isolation
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey, Index
from sqlalchemy.sql import func
from src.config.database import Base


class Subdomain(Base):
    __tablename__ = "subdomains"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Workspace isolation
    workspace_id = Column(String(36), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=True, index=True)
    
    # Core fields
    domain = Column(String(255), nullable=False, index=True)
    subdomain = Column(String(255), nullable=False, index=True)
    full_domain = Column(String(512), nullable=False, index=True)
    
    # Discovery metadata
    source = Column(String(100), nullable=True)  # subfinder, amass, etc.
    scan_id = Column(String(36), nullable=True, index=True)
    
    # HTTP probe results
    is_active = Column(Boolean, default=False, index=True)
    http_status = Column(Integer, nullable=True)
    https_status = Column(Integer, nullable=True)
    response_time = Column(Float, nullable=True)
    content_length = Column(Integer, nullable=True)
    title = Column(String(500), nullable=True)
    technologies = Column(Text, nullable=True)  # JSON string
    
    # DNS info
    ip_address = Column(String(45), nullable=True)
    cname = Column(String(512), nullable=True)
    
    # Risk assessment
    risk_score = Column(Integer, default=0)
    interesting = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    
    # Timestamps
    discovered_at = Column(DateTime(timezone=True), server_default=func.now())
    last_checked = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('idx_subdomain_workspace_domain', 'workspace_id', 'domain'),
        Index('idx_subdomain_workspace_active', 'workspace_id', 'is_active'),
        Index('idx_subdomain_domain_full', 'domain', 'full_domain', unique=True),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'domain': self.domain,
            'subdomain': self.subdomain,
            'full_domain': self.full_domain,
            'source': self.source,
            'scan_id': self.scan_id,
            'is_active': self.is_active,
            'http_status': self.http_status,
            'https_status': self.https_status,
            'response_time': self.response_time,
            'content_length': self.content_length,
            'title': self.title,
            'technologies': self.technologies,
            'ip_address': self.ip_address,
            'cname': self.cname,
            'risk_score': self.risk_score,
            'interesting': self.interesting,
            'notes': self.notes,
            'discovered_at': self.discovered_at.isoformat() if self.discovered_at else None,
            'last_checked': self.last_checked.isoformat() if self.last_checked else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f"<Subdomain(id={self.id}, full_domain={self.full_domain}, workspace={self.workspace_id})>"
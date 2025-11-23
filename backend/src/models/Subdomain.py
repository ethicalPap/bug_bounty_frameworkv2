from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from datetime import datetime

# Import the SHARED Base from database config
from src.config.database import Base

class Subdomain(Base):
    __tablename__ = 'subdomains'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    domain = Column(String(255), nullable=False, index=True)
    subdomain = Column(String(255), nullable=False, index=True)
    full_domain = Column(String(512), nullable=False, unique=True)
    ip_address = Column(String(45))  # IPv6 support
    status_code = Column(Integer)
    is_active = Column(Boolean, default=True)
    title = Column(String(500))
    server = Column(String(255))
    content_length = Column(Integer)
    technologies = Column(Text)  # JSON string of detected technologies
    screenshot_path = Column(String(512))
    scan_id = Column(String(50), index=True)  # For grouping scans
    validated = Column(Boolean, default=False, index=True)
    validation_results = Column(Text)
    confirmed_vulns = Column(Integer, default=0)
    last_validated = Column(DateTime)
    risk_score = Column(Integer, default=0)
    risk_tier = Column(String(50))
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Subdomain(full_domain='{self.full_domain}', ip='{self.ip_address}', status={self.status_code})>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'domain': self.domain,
            'subdomain': self.subdomain,
            'full_domain': self.full_domain,
            'ip_address': self.ip_address,
            'status_code': self.status_code,
            'is_active': self.is_active,
            'title': self.title,
            'server': self.server,
            'content_length': self.content_length,
            'technologies': self.technologies,
            'screenshot_path': self.screenshot_path,
            'scan_id': self.scan_id,
            'validated': self.validated,
            'validation_results': self.validation_results,
            'confirmed_vulns': self.confirmed_vulns,
            'last_validated': self.last_validated.isoformat() if self.last_validated else None,
            'risk_score': self.risk_score,
            'risk_tier': self.risk_tier,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
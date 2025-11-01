from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class ContentDiscovery(Base):
    __tablename__ = 'content_discovery'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    subdomain_id = Column(Integer, nullable=True, index=True)  # Reference to subdomains table
    target_url = Column(String(1024), nullable=False, index=True)  # Full URL of target
    discovered_url = Column(Text, nullable=False)  # Full discovered URL - TEXT type for long URLs
    path = Column(Text, nullable=False)  # Just the path part - TEXT type for long paths
    status_code = Column(Integer)
    content_length = Column(Integer)
    content_type = Column(String(255))
    method = Column(String(10), default='GET')  # HTTP method
    discovery_type = Column(String(50), nullable=False, index=True)  # fuzzing, passive, crawling, js_analysis, api
    tool_name = Column(String(50), nullable=False)  # ffuf, feroxbuster, waymore, etc.
    response_time = Column(Integer)  # Response time in milliseconds
    words_count = Column(Integer)  # Word count in response
    lines_count = Column(Integer)  # Line count in response
    is_interesting = Column(Boolean, default=False)  # Flagged as interesting
    notes = Column(Text)  # Additional notes or metadata
    redirects_to = Column(String(2048))  # If redirected
    headers = Column(Text)  # JSON string of response headers
    technologies = Column(Text)  # JSON string of detected technologies
    scan_id = Column(String(50), index=True)  # For grouping scans
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Create composite indexes for common queries
    __table_args__ = (
        Index('idx_target_discovery_type', 'target_url', 'discovery_type'),
        Index('idx_scan_tool', 'scan_id', 'tool_name'),
        Index('idx_status_interesting', 'status_code', 'is_interesting'),
    )
    
    def __repr__(self):
        return f"<ContentDiscovery(url='{self.discovered_url[:100]}...', status={self.status_code}, tool='{self.tool_name}')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'subdomain_id': self.subdomain_id,
            'target_url': self.target_url,
            'discovered_url': self.discovered_url,
            'path': self.path,
            'status_code': self.status_code,
            'content_length': self.content_length,
            'content_type': self.content_type,
            'method': self.method,
            'discovery_type': self.discovery_type,
            'tool_name': self.tool_name,
            'response_time': self.response_time,
            'words_count': self.words_count,
            'lines_count': self.lines_count,
            'is_interesting': self.is_interesting,
            'notes': self.notes,
            'redirects_to': self.redirects_to,
            'headers': self.headers,
            'technologies': self.technologies,
            'scan_id': self.scan_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class JSEndpoint(Base):
    """Store JavaScript endpoints and API paths found during analysis"""
    __tablename__ = 'js_endpoints'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    content_discovery_id = Column(Integer, ForeignKey('content_discovery.id'), nullable=True)
    source_url = Column(Text, nullable=False, index=False)  # JS file URL - changed to TEXT
    endpoint = Column(Text, nullable=False)  # Discovered endpoint/API path - changed to TEXT
    endpoint_type = Column(String(50))  # api, path, parameter, etc.
    method = Column(String(10))  # GET, POST, etc. if detectable
    confidence = Column(String(20))  # high, medium, low
    context = Column(Text)  # Surrounding code context
    scan_id = Column(String(50), index=True)
    created_at = Column(DateTime, default=func.now())
    
    def __repr__(self):
        return f"<JSEndpoint(endpoint='{self.endpoint[:100]}...', source='{self.source_url[:100]}...')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'content_discovery_id': self.content_discovery_id,
            'source_url': self.source_url,
            'endpoint': self.endpoint,
            'endpoint_type': self.endpoint_type,
            'method': self.method,
            'confidence': self.confidence,
            'context': self.context,
            'scan_id': self.scan_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class APIParameter(Base):
    """Store discovered API parameters"""
    __tablename__ = 'api_parameters'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    content_discovery_id = Column(Integer, ForeignKey('content_discovery.id'), nullable=True)
    target_url = Column(Text, nullable=False, index=False)  # Changed to TEXT for long URLs
    parameter_name = Column(String(255), nullable=False)
    parameter_type = Column(String(50))  # query, post, json, header, cookie
    example_value = Column(String(512))
    is_vulnerable = Column(Boolean, default=False)
    vulnerability_type = Column(String(100))  # XSS, SQLi, etc. if tested
    scan_id = Column(String(50), index=True)
    created_at = Column(DateTime, default=func.now())
    
    __table_args__ = (
        # Removed index on target_url since TEXT fields can't be indexed efficiently in PostgreSQL
        Index('idx_param_name_type', 'parameter_name', 'parameter_type'),
    )
    
    def __repr__(self):
        return f"<APIParameter(param='{self.parameter_name}', type='{self.parameter_type}')>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'content_discovery_id': self.content_discovery_id,
            'target_url': self.target_url,
            'parameter_name': self.parameter_name,
            'parameter_type': self.parameter_type,
            'example_value': self.example_value,
            'is_vulnerable': self.is_vulnerable,
            'vulnerability_type': self.vulnerability_type,
            'scan_id': self.scan_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
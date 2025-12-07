"""
Content Discovery Models
Stores discovered content (APIs, endpoints, directories, JS files) with workspace isolation
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey, Index
from sqlalchemy.sql import func
from src.config.database import Base


class ContentDiscovery(Base):
    __tablename__ = "content_discovery"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Workspace isolation
    workspace_id = Column(String(36), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=True, index=True)
    
    # Core fields
    subdomain_id = Column(Integer, ForeignKey('subdomains.id', ondelete='SET NULL'), nullable=True)
    target_url = Column(String(512), nullable=False, index=True)
    discovered_url = Column(String(2048), nullable=False)
    path = Column(String(1024), nullable=True)
    
    # HTTP response info
    status_code = Column(Integer, nullable=True, index=True)
    content_length = Column(Integer, nullable=True)
    method = Column(String(10), default='GET')
    response_time = Column(Float, nullable=True)
    words_count = Column(Integer, nullable=True)
    lines_count = Column(Integer, nullable=True)
    
    # Classification
    discovery_type = Column(String(50), nullable=True, index=True)  # fuzzing, passive, crawling, js_analysis, api
    tool_name = Column(String(100), nullable=True)  # ffuf, katana, gau, etc.
    
    # Analysis
    is_interesting = Column(Boolean, default=False, index=True)
    
    # Metadata
    scan_id = Column(String(36), nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Composite indexes
    __table_args__ = (
        Index('idx_content_workspace_target', 'workspace_id', 'target_url'),
        Index('idx_content_workspace_type', 'workspace_id', 'discovery_type'),
        Index('idx_content_target_url', 'target_url', 'discovered_url'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'subdomain_id': self.subdomain_id,
            'target_url': self.target_url,
            'discovered_url': self.discovered_url,
            'path': self.path,
            'status_code': self.status_code,
            'content_length': self.content_length,
            'method': self.method,
            'response_time': self.response_time,
            'words_count': self.words_count,
            'lines_count': self.lines_count,
            'discovery_type': self.discovery_type,
            'tool_name': self.tool_name,
            'is_interesting': self.is_interesting,
            'scan_id': self.scan_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f"<ContentDiscovery(id={self.id}, url={self.discovered_url[:50] if self.discovered_url else 'N/A'})>"


class JSEndpoint(Base):
    """Endpoints extracted from JavaScript files"""
    __tablename__ = "js_endpoints"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Workspace isolation
    workspace_id = Column(String(36), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=True, index=True)
    
    # Source reference
    source_url = Column(String(2048), nullable=False)
    
    # Extracted endpoint
    endpoint = Column(String(2048), nullable=False)
    endpoint_type = Column(String(50), nullable=True)  # path, api, resource
    
    # Analysis
    confidence = Column(String(20), default='medium')  # low, medium, high
    
    # Metadata
    scan_id = Column(String(36), nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_jsendpoint_workspace', 'workspace_id'),
        Index('idx_jsendpoint_source', 'source_url'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'source_url': self.source_url,
            'endpoint': self.endpoint,
            'endpoint_type': self.endpoint_type,
            'confidence': self.confidence,
            'scan_id': self.scan_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f"<JSEndpoint(id={self.id}, endpoint={self.endpoint[:50] if self.endpoint else 'N/A'})>"


class APIParameter(Base):
    """API parameters discovered during content analysis"""
    __tablename__ = "api_parameters"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Workspace isolation
    workspace_id = Column(String(36), ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=True, index=True)
    
    # Reference
    target_url = Column(String(2048), nullable=False)
    
    # Parameter info
    parameter_name = Column(String(255), nullable=False)
    parameter_type = Column(String(50), nullable=True)  # query, body, header, path
    
    # Metadata
    scan_id = Column(String(36), nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('idx_apiparam_workspace', 'workspace_id'),
        Index('idx_apiparam_target', 'target_url'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'workspace_id': self.workspace_id,
            'target_url': self.target_url,
            'parameter_name': self.parameter_name,
            'parameter_type': self.parameter_type,
            'scan_id': self.scan_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f"<APIParameter(id={self.id}, name={self.parameter_name})>"
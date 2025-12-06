"""
Workspace Model
Represents a workspace for organizing reconnaissance data
"""

from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from src.config.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"
    
    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    target_scope = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Workspace(id={self.id}, name={self.name})>"
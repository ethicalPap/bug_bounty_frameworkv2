"""
ScanJob Model - Tracks background scan jobs
"""

from sqlalchemy import Column, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from datetime import datetime
from typing import Dict, List
import enum

from src.config.database import Base


class ScanStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ScanJob(Base):
    """Database model for tracking scan jobs"""
    __tablename__ = "scan_jobs"
    
    id = Column(String(36), primary_key=True)
    workspace_id = Column(String(36), nullable=False, index=True)
    target_domain = Column(String(255), nullable=False)
    
    status = Column(String(20), default=ScanStatus.PENDING.value)
    current_phase = Column(String(20), nullable=True)
    
    # Progress tracking (JSON arrays/objects)
    completed_phases = Column(JSON, default=list)
    failed_phases = Column(JSON, default=list)
    phase_progress = Column(JSON, default=dict)
    
    # Results summary
    results = Column(JSON, default=dict)
    
    # Settings used for this scan
    settings = Column(JSON, default=dict)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    
    # Logs (last 100 entries)
    logs = Column(JSON, default=list)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "target_domain": self.target_domain,
            "status": self.status,
            "current_phase": self.current_phase,
            "completed_phases": self.completed_phases or [],
            "failed_phases": self.failed_phases or [],
            "phase_progress": self.phase_progress or {},
            "results": self.results or {},
            "settings": self.settings or {},
            "error_message": self.error_message,
            "logs": (self.logs or [])[-50:],  # Only return last 50 logs
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
    
    def add_log(self, message: str, level: str = "info", phase: str = None):
        """Add a log entry"""
        if self.logs is None:
            self.logs = []
        
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "message": message,
            "level": level,
            "phase": phase or self.current_phase
        }
        
        # Need to reassign to trigger SQLAlchemy change detection
        self.logs = (self.logs or []) + [entry]
        
        # Keep only last 100 logs
        if len(self.logs) > 100:
            self.logs = self.logs[-100:]
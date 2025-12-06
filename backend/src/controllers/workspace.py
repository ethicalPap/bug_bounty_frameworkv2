"""
Workspace Controller
Handles workspace CRUD operations and workspace-scoped data management
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import uuid

from src.models.Workspace import Workspace
from src.models.Subdomain import Subdomain
from src.models.ContentDiscovery import ContentDiscovery
from src.models.PortScan import PortScan

import logging

logger = logging.getLogger(__name__)


def create_workspace(
    db: Session,
    name: str,
    description: Optional[str] = None,
    target_scope: Optional[str] = None
) -> Workspace:
    """Create a new workspace"""
    workspace = Workspace(
        id=str(uuid.uuid4()),
        name=name,
        description=description,
        target_scope=target_scope,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    
    logger.info(f"Created workspace: {workspace.name} ({workspace.id})")
    return workspace


def get_workspace(db: Session, workspace_id: str) -> Optional[Workspace]:
    """Get a workspace by ID"""
    return db.query(Workspace).filter(Workspace.id == workspace_id).first()


def get_all_workspaces(db: Session, skip: int = 0, limit: int = 100) -> List[Workspace]:
    """Get all workspaces"""
    return db.query(Workspace).order_by(Workspace.updated_at.desc()).offset(skip).limit(limit).all()


def update_workspace(
    db: Session,
    workspace_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    target_scope: Optional[str] = None
) -> Optional[Workspace]:
    """Update a workspace"""
    workspace = get_workspace(db, workspace_id)
    if not workspace:
        return None
    
    if name is not None:
        workspace.name = name
    if description is not None:
        workspace.description = description
    if target_scope is not None:
        workspace.target_scope = target_scope
    
    workspace.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(workspace)
    
    logger.info(f"Updated workspace: {workspace.name} ({workspace.id})")
    return workspace


def delete_workspace(db: Session, workspace_id: str) -> bool:
    """Delete a workspace and all associated data"""
    workspace = get_workspace(db, workspace_id)
    if not workspace:
        return False
    
    # Delete associated data
    db.query(Subdomain).filter(Subdomain.workspace_id == workspace_id).delete()
    db.query(ContentDiscovery).filter(ContentDiscovery.workspace_id == workspace_id).delete()
    db.query(PortScan).filter(PortScan.workspace_id == workspace_id).delete()
    
    # Delete workspace
    db.delete(workspace)
    db.commit()
    
    logger.info(f"Deleted workspace: {workspace.name} ({workspace_id})")
    return True


def get_workspace_stats(db: Session, workspace_id: str) -> dict:
    """Get statistics for a workspace"""
    workspace = get_workspace(db, workspace_id)
    if not workspace:
        return {}
    
    # Count subdomains
    subdomains_count = db.query(func.count(Subdomain.id)).filter(
        Subdomain.workspace_id == workspace_id
    ).scalar() or 0
    
    # Count active subdomains (live hosts)
    live_hosts_count = db.query(func.count(Subdomain.id)).filter(
        Subdomain.workspace_id == workspace_id,
        Subdomain.is_active == True
    ).scalar() or 0
    
    # Count content discoveries
    content_count = db.query(func.count(ContentDiscovery.id)).filter(
        ContentDiscovery.workspace_id == workspace_id
    ).scalar() or 0
    
    # Count port scans
    ports_count = db.query(func.count(PortScan.id)).filter(
        PortScan.workspace_id == workspace_id
    ).scalar() or 0
    
    # Get unique domains
    unique_domains = db.query(func.count(func.distinct(Subdomain.domain))).filter(
        Subdomain.workspace_id == workspace_id
    ).scalar() or 0
    
    return {
        "workspace_id": workspace_id,
        "subdomains": subdomains_count,
        "live_hosts": live_hosts_count,
        "content_discoveries": content_count,
        "port_scans": ports_count,
        "unique_domains": unique_domains,
        "last_scan": workspace.updated_at.isoformat() if workspace.updated_at else None
    }


def workspace_to_dict(workspace: Workspace, include_stats: bool = True, db: Session = None) -> dict:
    """Convert workspace model to dictionary"""
    result = {
        "id": workspace.id,
        "name": workspace.name,
        "description": workspace.description,
        "target_scope": workspace.target_scope,
        "created_at": workspace.created_at.isoformat() if workspace.created_at else None,
        "updated_at": workspace.updated_at.isoformat() if workspace.updated_at else None
    }
    
    if include_stats and db:
        result["stats"] = get_workspace_stats(db, workspace.id)
    
    return result
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
import logging
import os

from src.config.database import get_db, init_db
from src.controllers.subdomains import (
    start_subdomain_scan,
    get_subdomains_by_domain,
    get_scan_results,
    delete_duplicates
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Subdomain Scanner API",
    description="Advanced subdomain enumeration and reconnaissance tool",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request/response
class ScanRequest(BaseModel):
    domain: str = Field(..., description="Target domain to scan", example="example.com")
    use_subfinder: bool = Field(True, description="Use Subfinder tool")
    use_sublist3r: bool = Field(True, description="Use Sublist3r tool")
    use_amass: bool = Field(True, description="Use Amass tool")
    use_assetfinder: bool = Field(True, description="Use Assetfinder tool")
    use_findomain: bool = Field(True, description="Use Findomain tool")
    use_chaos: bool = Field(False, description="Use Chaos API (requires API key)")
    chaos_api_key: Optional[str] = Field(None, description="Chaos API key")
    timeout: int = Field(300, description="Timeout per tool in seconds", ge=60, le=600)

class ScanResponse(BaseModel):
    scan_id: str
    domain: str
    total_unique_subdomains: int
    new_subdomains_saved: int
    tool_results: Dict[str, int]
    timestamp: str

class SubdomainResponse(BaseModel):
    id: int
    domain: str
    subdomain: str
    full_domain: str
    ip_address: Optional[str]
    status_code: Optional[int]
    is_active: bool
    scan_id: Optional[str]
    created_at: Optional[str]

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    logger.info("Starting Subdomain Scanner API...")
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "subdomain-scanner",
        "version": "1.0.0"
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Subdomain Scanner API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "scan": "/api/v1/scan",
            "subdomains": "/api/v1/subdomains/{domain}",
            "scan_results": "/api/v1/scans/{scan_id}",
            "docs": "/docs"
        }
    }

# API Routes
@app.post("/api/v1/scan", response_model=ScanResponse)
async def create_scan(
    scan_request: ScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start a new subdomain enumeration scan
    
    This endpoint initiates a scan using multiple subdomain enumeration tools.
    The scan runs in the background and results are saved to the database.
    """
    try:
        logger.info(f"Starting scan for domain: {scan_request.domain}")
        
        # Start scan (this could be moved to background task for async processing)
        result = start_subdomain_scan(
            domain=scan_request.domain,
            use_subfinder=scan_request.use_subfinder,
            use_sublist3r=scan_request.use_sublist3r,
            use_amass=scan_request.use_amass,
            use_assetfinder=scan_request.use_assetfinder,
            use_findomain=scan_request.use_findomain,
            use_chaos=scan_request.use_chaos,
            chaos_api_key=scan_request.chaos_api_key,
            timeout=scan_request.timeout
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@app.get("/api/v1/subdomains/{domain}", response_model=List[SubdomainResponse])
async def get_domain_subdomains(
    domain: str,
    db: Session = Depends(get_db)
):
    """
    Get all discovered subdomains for a specific domain
    
    Returns all subdomains found across all scans for the specified domain.
    """
    try:
        subdomains = get_subdomains_by_domain(domain, db)
        return subdomains
    except Exception as e:
        logger.error(f"Failed to retrieve subdomains: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve subdomains: {str(e)}")

@app.get("/api/v1/scans/{scan_id}", response_model=List[SubdomainResponse])
async def get_scan_by_id(
    scan_id: str,
    db: Session = Depends(get_db)
):
    """
    Get results for a specific scan
    
    Returns all subdomains discovered in a particular scan session.
    """
    try:
        results = get_scan_results(scan_id, db)
        if not results:
            raise HTTPException(status_code=404, detail="Scan not found")
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve scan results: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan results: {str(e)}")

@app.delete("/api/v1/subdomains/{domain}/duplicates")
async def remove_duplicates(
    domain: str,
    db: Session = Depends(get_db)
):
    """
    Remove duplicate subdomain entries for a domain
    
    Cleans up duplicate entries in the database for the specified domain.
    """
    try:
        deleted_count = delete_duplicates(domain, db)
        return {
            "message": "Duplicates removed successfully",
            "domain": domain,
            "deleted_count": deleted_count
        }
    except Exception as e:
        logger.error(f"Failed to remove duplicates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to remove duplicates: {str(e)}")

@app.get("/api/v1/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """
    Get overall statistics
    
    Returns statistics about total domains, subdomains, and scans.
    """
    try:
        from src.models.Subdomain import Subdomain
        from sqlalchemy import func
        
        total_subdomains = db.query(Subdomain).count()
        unique_domains = db.query(Subdomain.domain).distinct().count()
        active_subdomains = db.query(Subdomain).filter(Subdomain.is_active == True).count()
        unique_scans = db.query(Subdomain.scan_id).distinct().count()
        
        return {
            "total_subdomains": total_subdomains,
            "unique_domains": unique_domains,
            "active_subdomains": active_subdomains,
            "total_scans": unique_scans
        }
    except Exception as e:
        logger.error(f"Failed to retrieve statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve statistics: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
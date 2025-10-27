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
from src.controllers.http_prober import (
    probe_domain_subdomains,
    probe_scan_results,
    probe_specific_subdomains
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Subdomain Scanner API",
    description="Advanced subdomain enumeration and reconnaissance tool with HTTP probing",
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
    auto_probe: bool = Field(False, description="Automatically probe subdomains after scan")

class ProbeRequest(BaseModel):
    domain: Optional[str] = Field(None, description="Domain to probe (all subdomains)")
    scan_id: Optional[str] = Field(None, description="Scan ID to probe")
    subdomain_ids: Optional[List[int]] = Field(None, description="Specific subdomain IDs to probe")
    concurrency: int = Field(10, description="Number of concurrent probes", ge=1, le=50)

class ScanResponse(BaseModel):
    scan_id: str
    domain: str
    total_unique_subdomains: int
    new_subdomains_saved: int
    tool_results: Dict[str, int]
    timestamp: str

class ProbeResponse(BaseModel):
    total_subdomains: int
    probed: int
    active: int
    inactive: int
    updated_in_db: int

class SubdomainResponse(BaseModel):
    id: int
    domain: str
    subdomain: str
    full_domain: str
    ip_address: Optional[str]
    status_code: Optional[int]
    is_active: bool
    title: Optional[str]
    server: Optional[str]
    content_length: Optional[int]
    scan_id: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

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
            "probe": "/api/v1/probe",
            "subdomains": "/api/v1/subdomains/{domain}",
            "scan_results": "/api/v1/scans/{scan_id}",
            "docs": "/docs"
        }
    }

# ============================================================================
# SCAN ENDPOINTS
# ============================================================================

@app.post("/api/v1/scan", response_model=ScanResponse)
async def create_scan(
    scan_request: ScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start a new subdomain enumeration scan
    
    This endpoint initiates a scan using multiple subdomain enumeration tools.
    The scan runs synchronously and results are saved to the database.
    
    Optionally, set auto_probe=true to automatically probe HTTP status after scan.
    """
    try:
        logger.info(f"Starting scan for domain: {scan_request.domain}")
        
        # Start scan
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
        
        # Auto-probe if requested
        if scan_request.auto_probe and result.get('scan_id'):
            logger.info(f"Auto-probing enabled for scan {result['scan_id']}")
            background_tasks.add_task(
                probe_scan_results, 
                result['scan_id'], 
                concurrency=10
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
    
    Returns all subdomains found across all scans for the specified domain,
    including their HTTP probe status if available.
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
    
    Returns all subdomains discovered in a particular scan session,
    including their HTTP probe status if available.
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

# ============================================================================
# HTTP PROBE ENDPOINTS
# ============================================================================

@app.post("/api/v1/probe", response_model=ProbeResponse)
async def probe_subdomains(
    probe_request: ProbeRequest,
    background_tasks: BackgroundTasks
):
    """
    Probe subdomains to check if they're live
    
    Check HTTP/HTTPS status, get IP addresses, and update database.
    
    Provide one of:
    - domain: Probe all subdomains for a domain
    - scan_id: Probe all subdomains from a specific scan
    - subdomain_ids: Probe specific subdomain IDs
    """
    try:
        # Validate request
        if not any([probe_request.domain, probe_request.scan_id, probe_request.subdomain_ids]):
            raise HTTPException(
                status_code=400,
                detail="Must provide domain, scan_id, or subdomain_ids"
            )
        
        # Probe based on request type
        if probe_request.domain:
            logger.info(f"Probing all subdomains for domain: {probe_request.domain}")
            result = await probe_domain_subdomains(
                domain=probe_request.domain,
                concurrency=probe_request.concurrency
            )
            
        elif probe_request.scan_id:
            logger.info(f"Probing subdomains for scan: {probe_request.scan_id}")
            result = await probe_scan_results(
                scan_id=probe_request.scan_id,
                concurrency=probe_request.concurrency
            )
            
        else:  # subdomain_ids
            logger.info(f"Probing {len(probe_request.subdomain_ids)} specific subdomains")
            result = await probe_specific_subdomains(
                subdomain_ids=probe_request.subdomain_ids,
                concurrency=probe_request.concurrency
            )
        
        # Remove detailed results for cleaner response
        result.pop('results', None)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Probe failed: {e}")
        raise HTTPException(status_code=500, detail=f"Probe failed: {str(e)}")

@app.post("/api/v1/probe/domain/{domain}")
async def probe_domain(
    domain: str,
    concurrency: int = 10,
    background_tasks: BackgroundTasks = None
):
    """
    Probe all subdomains for a specific domain
    
    Convenience endpoint for probing by domain name.
    """
    try:
        logger.info(f"Probing domain: {domain} with concurrency {concurrency}")
        result = await probe_domain_subdomains(domain=domain, concurrency=concurrency)
        result.pop('results', None)
        return result
    except Exception as e:
        logger.error(f"Probe failed: {e}")
        raise HTTPException(status_code=500, detail=f"Probe failed: {str(e)}")

@app.post("/api/v1/probe/scan/{scan_id}")
async def probe_scan(
    scan_id: str,
    concurrency: int = 10,
    background_tasks: BackgroundTasks = None
):
    """
    Probe all subdomains from a specific scan
    
    Convenience endpoint for probing by scan ID.
    """
    try:
        logger.info(f"Probing scan: {scan_id} with concurrency {concurrency}")
        result = await probe_scan_results(scan_id=scan_id, concurrency=concurrency)
        result.pop('results', None)
        return result
    except Exception as e:
        logger.error(f"Probe failed: {e}")
        raise HTTPException(status_code=500, detail=f"Probe failed: {str(e)}")

@app.get("/api/v1/subdomains/{domain}/active")
async def get_active_subdomains(
    domain: str,
    db: Session = Depends(get_db)
):
    """
    Get only active (live) subdomains for a domain
    
    Returns subdomains where is_active=true (HTTP/HTTPS responded).
    """
    try:
        from src.models.Subdomain import Subdomain
        
        subdomains = db.query(Subdomain).filter(
            Subdomain.domain == domain,
            Subdomain.is_active == True
        ).order_by(Subdomain.created_at.desc()).all()
        
        return [subdomain.to_dict() for subdomain in subdomains]
    except Exception as e:
        logger.error(f"Failed to retrieve active subdomains: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve active subdomains: {str(e)}")

# ============================================================================
# STATISTICS ENDPOINTS
# ============================================================================

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
        
        # Get count by status code
        status_codes = db.query(
            Subdomain.status_code,
            func.count(Subdomain.id).label('count')
        ).filter(
            Subdomain.status_code.isnot(None)
        ).group_by(Subdomain.status_code).all()
        
        status_code_stats = {str(code): count for code, count in status_codes}
        
        return {
            "total_subdomains": total_subdomains,
            "unique_domains": unique_domains,
            "active_subdomains": active_subdomains,
            "inactive_subdomains": total_subdomains - active_subdomains,
            "total_scans": unique_scans,
            "status_codes": status_code_stats
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
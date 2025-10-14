from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, validator
import logging
import re

from backend.src.models.Subdomain import Subdomain
from backend.src.config.database import get_db, init_database, test_connection
from backend.src.controllers.subdomains import (
    start_subdomain_scan, 
    get_subdomains_by_domain, 
    get_scan_results,
    delete_duplicates,
    ScanConfig
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Subdomain Scanner API",
    description="Professional subdomain enumeration using multiple tools",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ScanRequest(BaseModel):
    domain: str
    use_subfinder: bool = True
    use_sublist3r: bool = True
    use_amass: bool = True
    use_assetfinder: bool = True
    use_findomain: bool = True
    use_chaos: bool = False
    chaos_api_key: Optional[str] = None
    timeout: int = 300

    @validator('domain')
    def validate_domain(cls, v):
        # Basic domain validation
        domain_pattern = re.compile(
            r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)+$'
        )
        if not domain_pattern.match(v):
            raise ValueError('Invalid domain format')
        return v.lower()

class ScanResponse(BaseModel):
    scan_id: str
    domain: str
    total_unique_subdomains: int
    new_subdomains_saved: int
    tool_results: dict
    timestamp: str

class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp: str

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    try:
        logger.info("Starting up Subdomain Scanner API...")
        
        # Test database connection
        if test_connection():
            logger.info("Database connection successful")
            init_database()
        else:
            logger.error("Database connection failed")
            
    except Exception as e:
        logger.error(f"Startup error: {e}")

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    from datetime import datetime
    
    db_status = "healthy" if test_connection() else "unhealthy"
    
    return HealthResponse(
        status="healthy" if db_status == "healthy" else "degraded",
        database=db_status,
        timestamp=datetime.utcnow().isoformat()
    )

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Subdomain Scanner API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# Scan endpoints
@app.post("/scan", response_model=ScanResponse)
async def start_scan(scan_request: ScanRequest, background_tasks: BackgroundTasks):
    """Start a new subdomain scan"""
    try:
        logger.info(f"Starting scan for domain: {scan_request.domain}")
        
        # Convert to ScanConfig
        config_dict = scan_request.dict()
        
        # Run scan in background
        def run_scan():
            try:
                result = start_subdomain_scan(**config_dict)
                logger.info(f"Scan completed for {scan_request.domain}")
                return result
            except Exception as e:
                logger.error(f"Scan error for {scan_request.domain}: {e}")
                raise
        
        # For now, run synchronously. In production, use Celery
        result = run_scan()
        
        return ScanResponse(**result)
        
    except Exception as e:
        logger.error(f"Scan request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/subdomains/{domain}")
async def get_domain_subdomains(domain: str, db: Session = Depends(get_db)):
    """Get all subdomains for a specific domain"""
    try:
        # Validate domain
        scan_request = ScanRequest(domain=domain)
        
        subdomains = get_subdomains_by_domain(domain, db)
        
        return {
            "domain": domain,
            "total_subdomains": len(subdomains),
            "subdomains": subdomains
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching subdomains for {domain}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scan/{scan_id}")
async def get_scan_by_id(scan_id: str, db: Session = Depends(get_db)):
    """Get scan results by scan ID"""
    try:
        results = get_scan_results(scan_id, db)
        
        if not results:
            raise HTTPException(status_code=404, detail="Scan not found")
        
        return {
            "scan_id": scan_id,
            "total_results": len(results),
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching scan {scan_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/subdomains/{domain}/duplicates")
async def remove_duplicates(domain: str, db: Session = Depends(get_db)):
    """Remove duplicate subdomains for a domain"""
    try:
        # Validate domain
        scan_request = ScanRequest(domain=domain)
        
        deleted_count = delete_duplicates(domain, db)
        
        return {
            "domain": domain,
            "deleted_duplicates": deleted_count,
            "message": f"Removed {deleted_count} duplicate subdomains"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error removing duplicates for {domain}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get general statistics"""
    try:
        from backend.src.models.Subdomain import Subdomain
        from sqlalchemy import func
        
        total_subdomains = db.query(Subdomain).count()
        total_domains = db.query(func.count(func.distinct(Subdomain.domain))).scalar()
        active_subdomains = db.query(Subdomain).filter(Subdomain.is_active == True).count()
        recent_scans = db.query(func.count(func.distinct(Subdomain.scan_id))).scalar()
        
        return {
            "total_subdomains": total_subdomains,
            "total_domains": total_domains,
            "active_subdomains": active_subdomains,
            "total_scans": recent_scans
        }
        
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return HTTPException(status_code=400, detail=str(exc))

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return HTTPException(status_code=500, detail="Internal server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
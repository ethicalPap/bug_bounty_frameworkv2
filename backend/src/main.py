from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
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
from src.controllers.content_discovery import (
    start_content_discovery,
    get_content_by_target,
    get_content_by_scan,
    get_interesting_discoveries,
    get_js_endpoints,
    get_api_parameters
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Bug Bounty Hunter Platform API",
    description="Advanced subdomain enumeration, content discovery, and vulnerability scanning tool",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Pydantic Models ====================

# Subdomain Scanning Models
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

# Content Discovery Models
class ContentDiscoveryRequest(BaseModel):
    target_url: str = Field(..., description="Target URL to scan", example="https://example.com")
    scan_type: str = Field("full", description="Type of scan: full, fuzzing, passive, crawling, js_analysis, api")
    
    # Fuzzing options
    use_ffuf: bool = Field(True, description="Use ffuf for fuzzing")
    use_feroxbuster: bool = Field(True, description="Use feroxbuster for recursive fuzzing")
    wordlist: str = Field("/opt/wordlists/common.txt", description="Path to wordlist file")
    
    # Passive options
    use_waymore: bool = Field(True, description="Use waymore for archive discovery")
    use_gau: bool = Field(True, description="Use gau for archive URLs")
    
    # Crawling options
    use_katana: bool = Field(True, description="Use katana for crawling")
    use_gospider: bool = Field(True, description="Use gospider for spidering")
    crawl_depth: int = Field(3, description="Crawl depth", ge=1, le=5)
    
    # JS Analysis
    use_linkfinder: bool = Field(True, description="Use LinkFinder for JS analysis")
    
    # API Discovery
    use_arjun: bool = Field(True, description="Use Arjun for parameter discovery")
    
    # Specialized
    use_unfurl: bool = Field(True, description="Use unfurl for URL parsing")
    use_uro: bool = Field(True, description="Use uro for URL filtering")
    use_nuclei: bool = Field(False, description="Use nuclei for vulnerability templates")
    
    # General options
    threads: int = Field(10, description="Number of threads", ge=1, le=50)
    timeout: int = Field(600, description="Timeout in seconds", ge=60, le=1800)
    rate_limit: int = Field(150, description="Requests per second", ge=10, le=500)
    subdomain_id: Optional[int] = Field(None, description="Link to subdomain ID")

class ContentDiscoveryResponse(BaseModel):
    scan_id: str
    target_url: str
    scan_type: str
    total_unique_urls: int
    new_urls_saved: int
    tool_results: Dict[str, int]
    timestamp: str

class DiscoveredContentResponse(BaseModel):
    id: int
    target_url: str
    discovered_url: str
    path: str
    status_code: Optional[int]
    content_length: Optional[int]
    method: str
    discovery_type: str
    tool_name: str
    is_interesting: bool
    scan_id: str
    created_at: Optional[str]

class JSEndpointResponse(BaseModel):
    id: int
    source_url: str
    endpoint: str
    endpoint_type: Optional[str]
    confidence: Optional[str]
    scan_id: str
    created_at: Optional[str]

class APIParameterResponse(BaseModel):
    id: int
    target_url: str
    parameter_name: str
    parameter_type: str
    scan_id: str
    created_at: Optional[str]

# ==================== Startup Events ====================

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    logger.info("Starting Bug Bounty Platform API...")
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

# ==================== Health & Info Endpoints ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "bug-bounty-platform",
        "version": "2.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Bug Bounty Hunter Platform API",
        "version": "2.0.0",
        "features": ["subdomain_enumeration", "content_discovery", "vulnerability_scanning"],
        "endpoints": {
            "health": "/health",
            "subdomain_scan": "/api/v1/scan",
            "content_discovery": "/api/v1/content/scan",
            "subdomains": "/api/v1/subdomains/{domain}",
            "discovered_content": "/api/v1/content/{target_url}",
            "docs": "/docs"
        }
    }

# ==================== Subdomain Enumeration Endpoints ====================

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

# ==================== Content Discovery Endpoints ====================

@app.post("/api/v1/content/scan", response_model=ContentDiscoveryResponse)
async def create_content_discovery(
    request: ContentDiscoveryRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start a new content discovery scan
    
    This endpoint initiates content discovery using multiple tools including:
    - Active fuzzing (ffuf, feroxbuster)
    - Passive discovery (waymore, gau)
    - Crawling (katana, gospider)
    - JS analysis (LinkFinder)
    - API discovery (Arjun)
    - Specialized tools (unfurl, uro, nuclei)
    """
    try:
        logger.info(f"Starting content discovery for: {request.target_url}")
        
        result = start_content_discovery(
            target_url=request.target_url,
            scan_type=request.scan_type,
            use_ffuf=request.use_ffuf,
            use_feroxbuster=request.use_feroxbuster,
            wordlist=request.wordlist,
            use_waymore=request.use_waymore,
            use_gau=request.use_gau,
            use_katana=request.use_katana,
            use_gospider=request.use_gospider,
            crawl_depth=request.crawl_depth,
            use_linkfinder=request.use_linkfinder,
            use_arjun=request.use_arjun,
            use_unfurl=request.use_unfurl,
            use_uro=request.use_uro,
            use_nuclei=request.use_nuclei,
            threads=request.threads,
            timeout=request.timeout,
            rate_limit=request.rate_limit,
            subdomain_id=request.subdomain_id
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Content discovery failed: {e}")
        raise HTTPException(status_code=500, detail=f"Content discovery failed: {str(e)}")

@app.get("/api/v1/content/target", response_model=List[DiscoveredContentResponse])
async def get_content_by_target_url(
    target_url: str = Query(..., description="Target URL to get discoveries for"),
    db: Session = Depends(get_db)
):
    """
    Get all discovered content for a specific target URL
    
    Returns all paths, files, and endpoints discovered for the target.
    """
    try:
        content = get_content_by_target(target_url, db)
        return content
    except Exception as e:
        logger.error(f"Failed to retrieve content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve content: {str(e)}")

@app.get("/api/v1/content/scan/{scan_id}", response_model=List[DiscoveredContentResponse])
async def get_content_scan_results(
    scan_id: str,
    db: Session = Depends(get_db)
):
    """
    Get results for a specific content discovery scan
    
    Returns all content discovered in a particular scan session.
    """
    try:
        results = get_content_by_scan(scan_id, db)
        if not results:
            raise HTTPException(status_code=404, detail="Scan not found")
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve scan results: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan results: {str(e)}")

@app.get("/api/v1/content/interesting", response_model=List[DiscoveredContentResponse])
async def get_interesting_content(
    limit: int = Query(100, description="Maximum number of results", ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get interesting discoveries across all scans
    
    Returns content flagged as potentially interesting based on:
    - Status codes (200, 401, 403, 500, etc.)
    - Interesting paths (admin, api, backup, config, etc.)
    - Response size
    """
    try:
        content = get_interesting_discoveries(db, limit)
        return content
    except Exception as e:
        logger.error(f"Failed to retrieve interesting content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve interesting content: {str(e)}")

@app.get("/api/v1/content/js-endpoints", response_model=List[JSEndpointResponse])
async def get_js_endpoint_discoveries(
    source_url: str = Query(..., description="Source JS file URL"),
    db: Session = Depends(get_db)
):
    """
    Get JavaScript endpoints discovered from a source URL
    
    Returns API paths and endpoints extracted from JavaScript files.
    """
    try:
        endpoints = get_js_endpoints(source_url, db)
        return endpoints
    except Exception as e:
        logger.error(f"Failed to retrieve JS endpoints: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve JS endpoints: {str(e)}")

@app.get("/api/v1/content/api-parameters", response_model=List[APIParameterResponse])
async def get_api_parameter_discoveries(
    target_url: str = Query(..., description="Target URL to get parameters for"),
    db: Session = Depends(get_db)
):
    """
    Get API parameters discovered for a target URL
    
    Returns query parameters, POST parameters, and other API inputs discovered.
    """
    try:
        parameters = get_api_parameters(target_url, db)
        return parameters
    except Exception as e:
        logger.error(f"Failed to retrieve API parameters: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve API parameters: {str(e)}")

# ==================== Statistics Endpoints ====================

@app.get("/api/v1/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """
    Get overall platform statistics
    
    Returns statistics about:
    - Total domains and subdomains
    - Content discoveries
    - Scans performed
    - Interesting findings
    """
    try:
        from src.models.Subdomain import Subdomain
        from src.models.ContentDiscovery import ContentDiscovery
        from sqlalchemy import func
        
        # Subdomain stats
        total_subdomains = db.query(Subdomain).count()
        unique_domains = db.query(Subdomain.domain).distinct().count()
        active_subdomains = db.query(Subdomain).filter(Subdomain.is_active == True).count()
        unique_subdomain_scans = db.query(Subdomain.scan_id).distinct().count()
        
        # Content discovery stats
        total_discoveries = db.query(ContentDiscovery).count()
        interesting_discoveries = db.query(ContentDiscovery).filter(
            ContentDiscovery.is_interesting == True
        ).count()
        unique_content_scans = db.query(ContentDiscovery.scan_id).distinct().count()
        
        # Discovery type breakdown
        discovery_types = db.query(
            ContentDiscovery.discovery_type,
            func.count(ContentDiscovery.id)
        ).group_by(ContentDiscovery.discovery_type).all()
        
        discovery_breakdown = {dtype: count for dtype, count in discovery_types}
        
        return {
            "subdomain_stats": {
                "total_subdomains": total_subdomains,
                "unique_domains": unique_domains,
                "active_subdomains": active_subdomains,
                "total_scans": unique_subdomain_scans
            },
            "content_stats": {
                "total_discoveries": total_discoveries,
                "interesting_discoveries": interesting_discoveries,
                "total_scans": unique_content_scans,
                "discovery_breakdown": discovery_breakdown
            }
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
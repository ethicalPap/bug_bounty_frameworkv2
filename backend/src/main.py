from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
import logging
import os

# FIXED: Correct import path
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
from src.controllers.port_scanner import (
    start_port_scan,
    get_ports_by_target,
    get_ports_by_subdomain,
    get_ports_by_scan,
    get_open_ports,
    get_vulnerable_services,
    get_ports_by_service
)
from src.controllers.visualization import (
    get_domain_visualization_data,
    get_technology_breakdown,
    get_service_breakdown,
    get_endpoint_tree,
    get_attack_surface_summary
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Bug Bounty Hunter Platform API",
    description="Advanced subdomain enumeration, content discovery, port scanning, and vulnerability scanning tool",
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

# Port Scanning Models
class PortScanRequest(BaseModel):
    targets: List[str] = Field(..., description="List of IPs or domains to scan", example=["example.com", "192.168.1.1"])
    ports: str = Field("top-100", description="Port range (top-100, top-1000, common-web, common-db, common-admin, all-tcp, or custom)")
    scan_type: str = Field("quick", description="Scan type: quick, full, stealth, udp, comprehensive")
    
    # Tool selection
    use_nmap: bool = Field(True, description="Use nmap scanner")
    use_masscan: bool = Field(False, description="Use masscan scanner (requires root)")
    use_naabu: bool = Field(True, description="Use naabu scanner")
    
    # Nmap options
    nmap_scan_type: str = Field("-sS", description="Nmap scan type: -sS (SYN), -sT (Connect), -sU (UDP)")
    nmap_timing: str = Field("T4", description="Nmap timing template: T0-T5")
    nmap_scripts: Optional[str] = Field(None, description="Nmap scripts to run")
    service_detection: bool = Field(True, description="Enable service/version detection")
    os_detection: bool = Field(False, description="Enable OS detection")
    version_intensity: int = Field(5, description="Version detection intensity (0-9)", ge=0, le=9)
    
    # Performance options
    masscan_rate: int = Field(10000, description="Masscan packets per second", ge=100, le=100000)
    naabu_rate: int = Field(1000, description="Naabu packets per second", ge=100, le=10000)
    naabu_retries: int = Field(3, description="Naabu retry attempts", ge=1, le=5)
    
    # General options
    timeout: int = Field(600, description="Timeout per tool in seconds", ge=60, le=1800)
    threads: int = Field(10, description="Number of threads", ge=1, le=50)
    exclude_closed: bool = Field(True, description="Don't save closed ports to database")
    subdomain_ids: Optional[List[int]] = Field(None, description="Link results to subdomain IDs")

class PortScanResponse(BaseModel):
    scan_id: str
    targets: List[str]
    target_count: int
    scan_type: str
    ports_scanned: str
    total_results: int
    unique_ports: int
    new_results_saved: int
    open_ports: int
    tool_results: Dict[str, int]
    duration_seconds: int
    timestamp: str

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
        "features": [
            "subdomain_enumeration",
            "content_discovery",
            "port_scanning",
            "vulnerability_scanning",
            "visualization"
        ],
        "endpoints": {
            "health": "/health",
            "subdomain_scan": "/api/v1/scan",
            "content_discovery": "/api/v1/content/scan",
            "port_scan": "/api/v1/ports/scan",
            "visualization": "/api/v1/visualization/{domain}",
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
    """Start a new subdomain enumeration scan"""
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

@app.get("/api/v1/subdomains/{domain}")
async def get_domain_subdomains(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get all discovered subdomains for a specific domain"""
    try:
        subdomains = get_subdomains_by_domain(domain, db)
        return subdomains
    except Exception as e:
        logger.error(f"Failed to retrieve subdomains: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve subdomains: {str(e)}")

# ==================== Port Scanning Endpoints ====================

@app.post("/api/v1/ports/scan", response_model=PortScanResponse)
async def create_port_scan(
    scan_request: PortScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start a new port scan"""
    try:
        logger.info(f"Starting port scan for targets: {scan_request.targets}")
        
        result = start_port_scan(
            targets=scan_request.targets,
            ports=scan_request.ports,
            scan_type=scan_request.scan_type,
            use_nmap=scan_request.use_nmap,
            use_masscan=scan_request.use_masscan,
            use_naabu=scan_request.use_naabu,
            nmap_scan_type=scan_request.nmap_scan_type,
            nmap_timing=scan_request.nmap_timing,
            nmap_scripts=scan_request.nmap_scripts,
            service_detection=scan_request.service_detection,
            os_detection=scan_request.os_detection,
            version_intensity=scan_request.version_intensity,
            masscan_rate=scan_request.masscan_rate,
            naabu_rate=scan_request.naabu_rate,
            naabu_retries=scan_request.naabu_retries,
            timeout=scan_request.timeout,
            threads=scan_request.threads,
            exclude_closed=scan_request.exclude_closed,
            subdomain_ids=scan_request.subdomain_ids
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Port scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Port scan failed: {str(e)}")

@app.get("/api/v1/ports/target/{target}")
async def get_ports_for_target(
    target: str,
    db: Session = Depends(get_db)
):
    """Get all discovered ports for a specific target"""
    try:
        ports = get_ports_by_target(target, db)
        return ports
    except Exception as e:
        logger.error(f"Failed to retrieve ports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve ports: {str(e)}")

# ==================== Content Discovery Endpoints ====================

@app.post("/api/v1/content/scan", response_model=ContentDiscoveryResponse)
async def create_content_discovery(
    request: ContentDiscoveryRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start a new content discovery scan"""
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

# ==================== Visualization Endpoints ====================

@app.get("/api/v1/visualization/{domain}")
async def get_visualization_data(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get comprehensive visualization data for network graph"""
    try:
        data = get_domain_visualization_data(domain, db)
        return data
    except Exception as e:
        logger.error(f"Failed to get visualization data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get visualization data: {str(e)}")

@app.get("/api/v1/visualization/{domain}/technology")
async def get_tech_breakdown(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get technology breakdown for visualization"""
    try:
        data = get_technology_breakdown(domain, db)
        return data
    except Exception as e:
        logger.error(f"Failed to get technology breakdown: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get technology breakdown: {str(e)}")

@app.get("/api/v1/visualization/{domain}/services")
async def get_services_breakdown(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get service/port breakdown for visualization"""
    try:
        data = get_service_breakdown(domain, db)
        return data
    except Exception as e:
        logger.error(f"Failed to get service breakdown: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get service breakdown: {str(e)}")

@app.get("/api/v1/visualization/{domain}/tree")
async def get_tree_view(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get hierarchical tree view of endpoints"""
    try:
        data = get_endpoint_tree(domain, db)
        return data
    except Exception as e:
        logger.error(f"Failed to get tree view: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get tree view: {str(e)}")

@app.get("/api/v1/visualization/{domain}/attack-surface")
async def get_attack_surface(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get attack surface summary metrics"""
    try:
        data = get_attack_surface_summary(domain, db)
        return data
    except Exception as e:
        logger.error(f"Failed to get attack surface: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get attack surface: {str(e)}")

# ==================== Statistics Endpoints ====================

@app.get("/api/v1/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """Get overall platform statistics"""
    try:
        from src.models.Subdomain import Subdomain
        from src.models.ContentDiscovery import ContentDiscovery
        from src.models.PortScan import PortScan
        from sqlalchemy import func
        
        # Subdomain stats
        total_subdomains = db.query(Subdomain).count()
        unique_domains = db.query(Subdomain.domain).distinct().count()
        active_subdomains = db.query(Subdomain).filter(Subdomain.is_active == True).count()
        
        # Port scan stats
        total_ports = db.query(PortScan).count()
        open_ports = db.query(PortScan).filter(PortScan.state == 'open').count()
        
        # Content discovery stats
        total_discoveries = db.query(ContentDiscovery).count()
        interesting_discoveries = db.query(ContentDiscovery).filter(
            ContentDiscovery.is_interesting == True
        ).count()
        
        return {
            "subdomain_stats": {
                "total_subdomains": total_subdomains,
                "unique_domains": unique_domains,
                "active_subdomains": active_subdomains
            },
            "port_scan_stats": {
                "total_ports_discovered": total_ports,
                "open_ports": open_ports
            },
            "content_stats": {
                "total_discoveries": total_discoveries,
                "interesting_discoveries": interesting_discoveries
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
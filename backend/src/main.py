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
from src.controllers.port_scanner import (
    start_port_scan,
    get_ports_by_target,
    get_ports_by_subdomain,
    get_ports_by_scan,
    get_scan_summary,
    get_open_ports,
    get_vulnerable_services,
    get_ports_by_service
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

# Port Scanning Models
class PortScanRequest(BaseModel):
    targets: List[str] = Field(..., description="List of IPs or domains to scan", example=["example.com", "192.168.1.1"])
    ports: str = Field("top-100", description="Port range (top-100, top-1000, common-web, common-db, common-admin, all-tcp, or custom like 1-1000 or 80,443,8080)")
    scan_type: str = Field("quick", description="Scan type: quick, full, stealth, udp, comprehensive")
    
    # Tool selection
    use_nmap: bool = Field(True, description="Use nmap scanner")
    use_masscan: bool = Field(False, description="Use masscan scanner (requires root)")
    use_naabu: bool = Field(True, description="Use naabu scanner")
    
    # Nmap options
    nmap_scan_type: str = Field("-sS", description="Nmap scan type: -sS (SYN), -sT (Connect), -sU (UDP), -sV (Version)")
    nmap_timing: str = Field("T4", description="Nmap timing template: T0-T5")
    nmap_scripts: Optional[str] = Field(None, description="Nmap scripts to run (e.g., 'default', 'vuln')")
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

class PortResultResponse(BaseModel):
    id: int
    subdomain_id: Optional[int]
    target: str
    port: int
    protocol: str
    state: str
    service: Optional[str]
    version: Optional[str]
    banner: Optional[str]
    cpe: Optional[str]
    script_output: Optional[str]
    tool_name: str
    scan_type: Optional[str]
    response_time: Optional[int]
    is_common_port: bool
    is_vulnerable: bool
    notes: Optional[str]
    scan_id: str
    created_at: Optional[str]
    updated_at: Optional[str]

class PortScanSummaryResponse(BaseModel):
    id: int
    scan_id: str
    target_count: int
    total_ports_scanned: int
    open_ports: int
    closed_ports: int
    filtered_ports: int
    scan_type: Optional[str]
    port_range: Optional[str]
    tools_used: Optional[str]
    scan_duration: Optional[int]
    status: str
    error_message: Optional[str]
    created_at: Optional[str]
    completed_at: Optional[str]

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
            "vulnerability_scanning"
        ],
        "endpoints": {
            "health": "/health",
            "subdomain_scan": "/api/v1/scan",
            "content_discovery": "/api/v1/content/scan",
            "port_scan": "/api/v1/ports/scan",
            "scan_subdomains_ports": "/api/v1/ports/scan/subdomains",
            "subdomains": "/api/v1/subdomains/{domain}",
            "discovered_content": "/api/v1/content/{target_url}",
            "discovered_ports": "/api/v1/ports/target/{target}",
            "open_ports": "/api/v1/ports/open",
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

# ==================== PORT SCANNING ENDPOINTS ====================

@app.post("/api/v1/ports/scan", response_model=PortScanResponse)
async def create_port_scan(
    scan_request: PortScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start a new port scan
    
    Scans target hosts/IPs for open ports using multiple tools:
    - nmap: Full-featured scanner with service detection and version scanning
    - masscan: High-speed scanner for large-scale scans (requires root)
    - naabu: Fast port scanner from ProjectDiscovery
    
    Port presets:
    - top-100: Most common 100 ports
    - top-1000: Most common 1000 ports
    - common-web: Web service ports (80, 443, 8080, etc.)
    - common-db: Database ports (3306, 5432, 27017, etc.)
    - common-admin: Remote admin ports (22, 3389, 5900, etc.)
    - all-tcp: All TCP ports (1-65535)
    - Custom: Specify ports like "1-1000" or "80,443,8080,8443"
    """
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

@app.get("/api/v1/ports/target/{target}", response_model=List[PortResultResponse])
async def get_ports_for_target(
    target: str,
    db: Session = Depends(get_db)
):
    """
    Get all discovered ports for a specific target
    
    Returns all ports found across all scans for the specified IP or domain.
    """
    try:
        ports = get_ports_by_target(target, db)
        return ports
    except Exception as e:
        logger.error(f"Failed to retrieve ports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve ports: {str(e)}")

@app.get("/api/v1/ports/subdomain/{subdomain_id}", response_model=List[PortResultResponse])
async def get_ports_for_subdomain(
    subdomain_id: int,
    db: Session = Depends(get_db)
):
    """
    Get all ports for a specific subdomain
    
    Returns all discovered ports linked to the specified subdomain ID.
    """
    try:
        ports = get_ports_by_subdomain(subdomain_id, db)
        if not ports:
            raise HTTPException(status_code=404, detail="No ports found for this subdomain")
        return ports
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve ports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve ports: {str(e)}")

@app.get("/api/v1/ports/scan/{scan_id}", response_model=List[PortResultResponse])
async def get_port_scan_results(
    scan_id: str,
    db: Session = Depends(get_db)
):
    """
    Get results for a specific port scan
    
    Returns all ports discovered in a particular scan session.
    """
    try:
        results = get_ports_by_scan(scan_id, db)
        if not results:
            raise HTTPException(status_code=404, detail="Scan not found")
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve scan results: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan results: {str(e)}")

@app.get("/api/v1/ports/scan/{scan_id}/summary", response_model=PortScanSummaryResponse)
async def get_port_scan_summary_endpoint(
    scan_id: str,
    db: Session = Depends(get_db)
):
    """
    Get summary statistics for a specific port scan
    
    Returns aggregated information about the scan including:
    - Number of targets scanned
    - Total ports found (open/closed/filtered)
    - Tools used
    - Scan duration
    """
    try:
        summary = get_scan_summary(scan_id, db)
        if not summary:
            raise HTTPException(status_code=404, detail="Scan summary not found")
        return summary
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve scan summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve scan summary: {str(e)}")

@app.get("/api/v1/ports/open", response_model=List[PortResultResponse])
async def get_all_open_ports(
    limit: int = Query(100, description="Maximum number of results", ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get all open ports across all scans
    
    Returns the most recently discovered open ports.
    """
    try:
        ports = get_open_ports(db, limit)
        return ports
    except Exception as e:
        logger.error(f"Failed to retrieve open ports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve open ports: {str(e)}")

@app.get("/api/v1/ports/vulnerable", response_model=List[PortResultResponse])
async def get_vulnerable_ports(
    db: Session = Depends(get_db)
):
    """
    Get ports flagged as potentially vulnerable
    
    Returns ports with services that may have known vulnerabilities.
    """
    try:
        ports = get_vulnerable_services(db)
        return ports
    except Exception as e:
        logger.error(f"Failed to retrieve vulnerable ports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve vulnerable ports: {str(e)}")

@app.get("/api/v1/ports/service/{service}", response_model=List[PortResultResponse])
async def get_ports_by_service_name(
    service: str,
    db: Session = Depends(get_db)
):
    """
    Get all ports running a specific service
    
    Search for ports by service name (e.g., 'http', 'ssh', 'mysql').
    Performs a case-insensitive partial match.
    """
    try:
        ports = get_ports_by_service(service, db)
        return ports
    except Exception as e:
        logger.error(f"Failed to retrieve ports by service: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve ports by service: {str(e)}")

@app.post("/api/v1/ports/scan/subdomains")
async def scan_subdomain_ports(
    domain: str = Query(..., description="Domain to scan subdomains for"),
    ports: str = Query("top-100", description="Port range to scan"),
    scan_type: str = Query("quick", description="Scan type"),
    use_nmap: bool = Query(True, description="Use nmap"),
    use_naabu: bool = Query(True, description="Use naabu"),
    service_detection: bool = Query(True, description="Enable service detection"),
    db: Session = Depends(get_db)
):
    """
    Scan ports for all subdomains of a domain
    
    Convenience endpoint that:
    1. Retrieves all subdomains for the specified domain
    2. Filters for active subdomains only
    3. Initiates a port scan on all active subdomains
    """
    try:
        from src.models.Subdomain import Subdomain
        
        # Get all active subdomains for the domain
        subdomains = db.query(Subdomain).filter(
            Subdomain.domain == domain,
            Subdomain.is_active == True
        ).all()
        
        if not subdomains:
            raise HTTPException(status_code=404, detail=f"No active subdomains found for domain: {domain}")
        
        # Extract targets
        targets = [sub.full_domain for sub in subdomains]
        subdomain_ids = [sub.id for sub in subdomains]
        
        logger.info(f"Scanning {len(targets)} subdomains for domain: {domain}")
        
        # Start port scan
        result = start_port_scan(
            targets=targets,
            ports=ports,
            scan_type=scan_type,
            use_nmap=use_nmap,
            use_masscan=False,  # Don't use masscan for subdomain scans
            use_naabu=use_naabu,
            service_detection=service_detection,
            subdomain_ids=subdomain_ids
        )
        
        return {
            "message": f"Port scan initiated for {len(targets)} subdomains",
            "domain": domain,
            "scan_result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to scan subdomain ports: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to scan subdomain ports: {str(e)}")

# ==================== Statistics Endpoints ====================

@app.get("/api/v1/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """
    Get overall platform statistics
    
    Returns statistics about:
    - Total domains and subdomains
    - Content discoveries
    - Port scans
    - Scans performed
    - Interesting findings
    """
    try:
        from src.models.Subdomain import Subdomain
        from src.models.ContentDiscovery import ContentDiscovery
        from src.models.PortScan import PortScan, PortScanSummary
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
        
        # Port scan stats
        total_ports = db.query(PortScan).count()
        open_ports = db.query(PortScan).filter(PortScan.state == 'open').count()
        unique_targets = db.query(PortScan.target).distinct().count()
        unique_port_scans = db.query(PortScan.scan_id).distinct().count()
        vulnerable_services = db.query(PortScan).filter(PortScan.is_vulnerable == True).count()
        
        # Service breakdown
        services = db.query(
            PortScan.service,
            func.count(PortScan.id)
        ).filter(
            PortScan.service != '',
            PortScan.service.isnot(None),
            PortScan.state == 'open'
        ).group_by(PortScan.service).order_by(func.count(PortScan.id).desc()).limit(10).all()
        
        service_breakdown = {service: count for service, count in services}
        
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
            },
            "port_scan_stats": {
                "total_ports_discovered": total_ports,
                "open_ports": open_ports,
                "unique_targets": unique_targets,
                "total_scans": unique_port_scans,
                "vulnerable_services": vulnerable_services,
                "top_services": service_breakdown
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
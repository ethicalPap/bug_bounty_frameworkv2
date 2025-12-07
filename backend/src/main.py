from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
import logging
import os

from src.config.database import get_db, init_db

from src.controllers.workspace import (
    create_workspace as create_workspace_db,
    get_workspace as get_workspace_db,
    get_all_workspaces,
    update_workspace as update_workspace_db,
    delete_workspace as delete_workspace_db,
    get_workspace_stats as get_workspace_stats_db,
    workspace_to_dict
)

from src.controllers.subdomains import (
    start_subdomain_scan,
    get_subdomains_by_domain,
    get_scan_results,
    get_subdomains_by_workspace,
    delete_duplicates
)

from src.controllers.content_discovery import (
    start_content_discovery,
    get_content_by_target,
    get_content_by_scan,
    get_content_by_workspace,
    get_interesting_discoveries,
    get_js_endpoints,
    get_api_parameters
)

from src.controllers.port_scanner import (
    start_port_scan,
    get_ports_by_target,
    get_ports_by_subdomain,
    get_ports_by_scan,
    get_ports_by_workspace,
    get_open_ports,
    get_vulnerable_services,
    get_ports_by_service
)

from src.controllers.visualization import (
    get_domain_visualization_data,
    get_technology_breakdown,
    get_service_breakdown,
    get_endpoint_tree,
    get_attack_surface_summary,
    get_workspace_visualization_data
)

from src.controllers.http_prober import (
    HTTPProber,
    probe_domain_subdomains,
    probe_scan_results,
    probe_specific_subdomains,
    probe_workspace_subdomains
)

from src.controllers.validation import (
    validate_single_target,
    validate_high_value_targets_for_domain,
    validate_workspace_targets,
    quick_validate_target,
    get_validation_report,
    get_workspace_validation_report
)

from src.controllers.vuln_scanner import (
    run_vulnerability_scan,
    get_vuln_stats_by_workspace,
    get_vuln_summary
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Bug Bounty Hunter Platform API",
    description="Advanced subdomain enumeration, content discovery, port scanning, and vulnerability validation tool with workspace isolation",
    version="3.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Pydantic Models ====================

# Workspace Models
class WorkspaceCreate(BaseModel):
    name: str = Field(..., description="Workspace name", example="HackerOne - Example Corp")
    description: Optional[str] = Field(None, description="Workspace description")
    target_scope: Optional[str] = Field(None, description="Target scope", example="*.example.com")

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = Field(None, description="Workspace name")
    description: Optional[str] = Field(None, description="Workspace description")
    target_scope: Optional[str] = Field(None, description="Target scope")

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    target_scope: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    stats: Optional[Dict] = None


# Subdomain Scanning Models
class ScanRequest(BaseModel):
    domain: str = Field(..., description="Target domain to scan", example="example.com")
    workspace_id: Optional[str] = Field(None, description="Workspace ID for isolation")
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
    workspace_id: Optional[str]
    domain: str
    total_unique_subdomains: int
    new_subdomains_saved: int
    tool_results: Dict[str, int]
    timestamp: str


# HTTP Probing Models
class ProbeHostsRequest(BaseModel):
    subdomains: List[str] = Field(..., description="List of subdomains to probe")
    workspace_id: Optional[str] = Field(None, description="Workspace ID for isolation")
    concurrency: int = Field(10, description="Number of concurrent probes", ge=1, le=50)
    timeout: int = Field(10, description="Timeout per request in seconds", ge=1, le=30)

class ProbeHostsResponse(BaseModel):
    total: int
    active: int
    inactive: int
    workspace_id: Optional[str]
    results: List[Dict]


# Content Discovery Models
class ContentDiscoveryRequest(BaseModel):
    target_url: str = Field(..., description="Target URL to scan", example="https://example.com")
    workspace_id: Optional[str] = Field(None, description="Workspace ID for isolation")
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
    use_hakrawler: bool = Field(False, description="Use hakrawler for simple crawling")
    use_zap_spider: bool = Field(False, description="Use OWASP ZAP spider")
    use_zap_ajax: bool = Field(False, description="Use OWASP ZAP Ajax spider")
    crawl_depth: int = Field(3, description="Crawl depth", ge=1, le=5)
    
    # JS Analysis
    use_linkfinder: bool = Field(True, description="Use LinkFinder for JS analysis")
    use_jsluice: bool = Field(False, description="Use jsluice for JS URL extraction")
    
    # Parameter Discovery
    use_paramspider: bool = Field(False, description="Use ParamSpider for parameter mining")
    
    # Specialized
    use_unfurl: bool = Field(True, description="Use unfurl for URL parsing")
    use_uro: bool = Field(True, description="Use uro for URL filtering")
    use_nuclei: bool = Field(False, description="Use nuclei for vulnerability templates")
    
    # General options
    threads: int = Field(10, description="Number of threads", ge=1, le=50)
    timeout: int = Field(600, description="Timeout in seconds", ge=60, le=1800)
    rate_limit: int = Field(150, description="Requests per second", ge=10, le=500)
    subdomain_id: Optional[int] = Field(None, description="Link to subdomain ID")


# Port Scanning Models
class PortScanRequest(BaseModel):
    targets: List[str] = Field(..., description="List of IPs or domains to scan", example=["example.com"])
    workspace_id: Optional[str] = Field(None, description="Workspace ID for isolation")
    ports: str = Field("top-100", description="Port range")
    scan_type: str = Field("quick", description="Scan type: quick, full, stealth, udp, comprehensive")
    
    # Tool selection
    use_nmap: bool = Field(True, description="Use nmap scanner")
    use_masscan: bool = Field(False, description="Use masscan scanner (requires root)")
    use_naabu: bool = Field(True, description="Use naabu scanner")
    
    # Nmap options
    nmap_scan_type: str = Field("-sS", description="Nmap scan type")
    nmap_timing: str = Field("T4", description="Nmap timing template")
    nmap_scripts: Optional[str] = Field(None, description="Nmap scripts to run")
    service_detection: bool = Field(True, description="Enable service detection")
    os_detection: bool = Field(False, description="Enable OS detection")
    version_intensity: int = Field(5, description="Version detection intensity", ge=0, le=9)
    
    # Performance options
    masscan_rate: int = Field(10000, description="Masscan packets per second", ge=100, le=100000)
    naabu_rate: int = Field(1000, description="Naabu packets per second", ge=100, le=10000)
    naabu_retries: int = Field(3, description="Naabu retry attempts", ge=1, le=5)
    
    # General options
    timeout: int = Field(600, description="Timeout per tool in seconds", ge=60, le=1800)
    threads: int = Field(10, description="Number of threads", ge=1, le=50)
    exclude_closed: bool = Field(True, description="Don't save closed ports to database")
    subdomain_ids: Optional[List[int]] = Field(None, description="Link results to subdomain IDs")


# Vulnerability Scanner Models
class VulnScanRequest(BaseModel):
    target_url: str = Field(..., description="Target URL to scan")
    workspace_id: Optional[str] = Field(None, description="Workspace ID for isolation")
    templates: Optional[List[str]] = Field(None, description="Nuclei template tags")
    concurrency: int = Field(10, description="Concurrent requests", ge=1, le=50)
    timeout: int = Field(300, description="Scan timeout in seconds", ge=60, le=1800)
    rate_limit: int = Field(150, description="Requests per second", ge=10, le=500)
    scan_type: str = Field("quick", description="Scan type: quick, full, comprehensive")
    save_to_db: bool = Field(True, description="Save results to database")


class BatchVulnScanRequest(BaseModel):
    targets: List[str] = Field(..., description="List of target URLs")
    workspace_id: Optional[str] = Field(None, description="Workspace ID for isolation")
    scanners: List[str] = Field(["nuclei"], description="List of scanners to use")
    templates: Optional[List[str]] = Field(None, description="Nuclei template tags")
    concurrency: int = Field(10, description="Concurrent requests per scanner")
    timeout: int = Field(300, description="Timeout per scan")
    save_to_db: bool = Field(True, description="Save results to database")


# Validation Models
class ValidationRequest(BaseModel):
    target_url: str = Field(..., description="Target URL to validate")
    workspace_id: Optional[str] = Field(None, description="Workspace ID for isolation")
    discovered_paths: Optional[List[str]] = Field(None, description="List of discovered paths to test")


class DomainValidationRequest(BaseModel):
    domain: str = Field(..., description="Domain to validate")
    workspace_id: Optional[str] = Field(None, description="Workspace ID for isolation")
    limit: int = Field(10, description="Max targets to validate", ge=1, le=50)
    min_risk_score: int = Field(30, description="Minimum risk score", ge=0, le=100)


# ==================== Startup Event ====================

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully")


# ==================== Health Check ====================

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "3.0.0"}

@app.get("/")
async def root():
    return {
        "name": "Bug Bounty Hunter Platform API",
        "version": "3.0.0",
        "features": [
            "Workspace Isolation",
            "Subdomain Enumeration",
            "HTTP Probing",
            "Content Discovery",
            "Port Scanning",
            "Vulnerability Scanning",
            "Validation",
            "Visualization"
        ]
    }


# ==================== WORKSPACE ENDPOINTS ====================

@app.get("/api/v1/workspaces")
async def list_workspaces(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """List all workspaces with stats"""
    try:
        workspaces = get_all_workspaces(db, skip=skip, limit=limit)
        return [workspace_to_dict(w, include_stats=True, db=db) for w in workspaces]
    except Exception as e:
        logger.error(f"Failed to list workspaces: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/workspaces")
async def create_workspace(request: WorkspaceCreate, db: Session = Depends(get_db)):
    """Create a new workspace"""
    try:
        workspace = create_workspace_db(
            db=db,
            name=request.name,
            description=request.description,
            target_scope=request.target_scope
        )
        return workspace_to_dict(workspace, include_stats=True, db=db)
    except Exception as e:
        logger.error(f"Failed to create workspace: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """Get a workspace by ID"""
    workspace = get_workspace_db(db, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace_to_dict(workspace, include_stats=True, db=db)


@app.put("/api/v1/workspaces/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    request: WorkspaceUpdate,
    db: Session = Depends(get_db)
):
    """Update a workspace"""
    workspace = update_workspace_db(
        db=db,
        workspace_id=workspace_id,
        name=request.name,
        description=request.description,
        target_scope=request.target_scope
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace_to_dict(workspace, include_stats=True, db=db)


@app.delete("/api/v1/workspaces/{workspace_id}")
async def delete_workspace(workspace_id: str, db: Session = Depends(get_db)):
    """Delete a workspace and all associated data"""
    success = delete_workspace_db(db, workspace_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"message": "Workspace deleted successfully", "workspace_id": workspace_id}


@app.get("/api/v1/workspaces/{workspace_id}/stats")
async def get_workspace_stats(workspace_id: str, db: Session = Depends(get_db)):
    """Get statistics for a workspace"""
    stats = get_workspace_stats_db(db, workspace_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return stats


@app.get("/api/v1/workspaces/{workspace_id}/visualization")
async def get_workspace_visualization(workspace_id: str, db: Session = Depends(get_db)):
    """Get visualization data for entire workspace"""
    try:
        return get_workspace_visualization_data(workspace_id, db)
    except Exception as e:
        logger.error(f"Failed to get workspace visualization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SUBDOMAIN SCANNING ENDPOINTS ====================

@app.post("/api/v1/scan/subdomains")
async def scan_subdomains(request: ScanRequest, background_tasks: BackgroundTasks):
    """Start a subdomain enumeration scan"""
    try:
        result = start_subdomain_scan(
            domain=request.domain,
            workspace_id=request.workspace_id,
            use_subfinder=request.use_subfinder,
            use_sublist3r=request.use_sublist3r,
            use_amass=request.use_amass,
            use_assetfinder=request.use_assetfinder,
            use_findomain=request.use_findomain,
            use_chaos=request.use_chaos,
            chaos_api_key=request.chaos_api_key,
            timeout=request.timeout
        )
        return result
    except Exception as e:
        logger.error(f"Subdomain scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/subdomains/domain/{domain}")
async def get_domain_subdomains(
    domain: str,
    workspace_id: Optional[str] = Query(None, description="Filter by workspace"),
    db: Session = Depends(get_db)
):
    """Get all subdomains for a domain"""
    try:
        subdomains = get_subdomains_by_domain(domain, db, workspace_id=workspace_id)
        return subdomains
    except Exception as e:
        logger.error(f"Failed to get subdomains: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/subdomains/scan/{scan_id}")
async def get_scan_subdomains(scan_id: str, db: Session = Depends(get_db)):
    """Get subdomains from a specific scan"""
    try:
        subdomains = get_scan_results(scan_id, db)
        return subdomains
    except Exception as e:
        logger.error(f"Failed to get scan results: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/subdomains/workspace/{workspace_id}")
async def get_workspace_subdomains(workspace_id: str, db: Session = Depends(get_db)):
    """Get all subdomains for a workspace"""
    try:
        subdomains = get_subdomains_by_workspace(workspace_id, db)
        return subdomains
    except Exception as e:
        logger.error(f"Failed to get workspace subdomains: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/subdomains/duplicates/{domain}")
async def remove_duplicates(
    domain: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Remove duplicate subdomains for a domain"""
    try:
        deleted_count = delete_duplicates(domain, db, workspace_id=workspace_id)
        return {"deleted": deleted_count, "domain": domain}
    except Exception as e:
        logger.error(f"Failed to delete duplicates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== HTTP PROBING ENDPOINTS ====================

@app.post("/api/v1/probe/hosts")
async def probe_hosts(request: ProbeHostsRequest):
    """Probe a list of hosts for HTTP connectivity"""
    try:
        import asyncio
        prober = HTTPProber(timeout=request.timeout)
        results = await prober.probe_subdomains_batch(
            request.subdomains,
            concurrency=request.concurrency
        )
        
        active_count = sum(1 for r in results if r.get('is_active'))
        
        return {
            "total": len(results),
            "active": active_count,
            "inactive": len(results) - active_count,
            "workspace_id": request.workspace_id,
            "results": results
        }
    except Exception as e:
        logger.error(f"HTTP probe failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/probe/domain/{domain}")
async def probe_domain(
    domain: str,
    workspace_id: Optional[str] = Query(None),
    concurrency: int = Query(10, ge=1, le=50)
):
    """Probe all subdomains for a domain"""
    try:
        result = await probe_domain_subdomains(domain, concurrency, workspace_id)
        return result
    except Exception as e:
        logger.error(f"Domain probe failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/probe/scan/{scan_id}")
async def probe_scan(scan_id: str, concurrency: int = Query(10, ge=1, le=50)):
    """Probe all subdomains from a scan"""
    try:
        result = await probe_scan_results(scan_id, concurrency)
        return result
    except Exception as e:
        logger.error(f"Scan probe failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/probe/workspace/{workspace_id}")
async def probe_workspace(workspace_id: str, concurrency: int = Query(10, ge=1, le=50)):
    """Probe all subdomains in a workspace"""
    try:
        result = await probe_workspace_subdomains(workspace_id, concurrency)
        return result
    except Exception as e:
        logger.error(f"Workspace probe failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CONTENT DISCOVERY ENDPOINTS ====================

@app.post("/api/v1/scan/content")
async def scan_content(request: ContentDiscoveryRequest):
    """Start a content discovery scan"""
    try:
        result = start_content_discovery(
            target_url=request.target_url,
            workspace_id=request.workspace_id,
            scan_type=request.scan_type,
            use_ffuf=request.use_ffuf,
            use_feroxbuster=request.use_feroxbuster,
            wordlist=request.wordlist,
            use_waymore=request.use_waymore,
            use_gau=request.use_gau,
            use_katana=request.use_katana,
            use_gospider=request.use_gospider,
            use_hakrawler=request.use_hakrawler,
            use_zap_spider=request.use_zap_spider,
            use_zap_ajax=request.use_zap_ajax,
            crawl_depth=request.crawl_depth,
            use_linkfinder=request.use_linkfinder,
            use_jsluice=request.use_jsluice,
            use_paramspider=request.use_paramspider,
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
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/content/target/{target:path}")
async def get_target_content(
    target: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get discovered content for a target"""
    try:
        content = get_content_by_target(target, db, workspace_id=workspace_id)
        return content
    except Exception as e:
        logger.error(f"Failed to get content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/content/scan/{scan_id}")
async def get_scan_content(scan_id: str, db: Session = Depends(get_db)):
    """Get content from a specific scan"""
    try:
        content = get_content_by_scan(scan_id, db)
        return content
    except Exception as e:
        logger.error(f"Failed to get scan content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/content/workspace/{workspace_id}")
async def get_workspace_content(workspace_id: str, db: Session = Depends(get_db)):
    """Get all content discoveries for a workspace"""
    try:
        content = get_content_by_workspace(workspace_id, db)
        return content
    except Exception as e:
        logger.error(f"Failed to get workspace content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/content/interesting")
async def get_interesting(
    workspace_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get interesting discoveries"""
    try:
        content = get_interesting_discoveries(db, workspace_id=workspace_id, limit=limit)
        return content
    except Exception as e:
        logger.error(f"Failed to get interesting content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PORT SCANNING ENDPOINTS ====================

@app.post("/api/v1/scan/ports")
async def scan_ports(request: PortScanRequest):
    """Start a port scan"""
    try:
        result = start_port_scan(
            targets=request.targets,
            workspace_id=request.workspace_id,
            ports=request.ports,
            scan_type=request.scan_type,
            use_nmap=request.use_nmap,
            use_masscan=request.use_masscan,
            use_naabu=request.use_naabu,
            nmap_scan_type=request.nmap_scan_type,
            nmap_timing=request.nmap_timing,
            nmap_scripts=request.nmap_scripts,
            service_detection=request.service_detection,
            os_detection=request.os_detection,
            version_intensity=request.version_intensity,
            masscan_rate=request.masscan_rate,
            naabu_rate=request.naabu_rate,
            naabu_retries=request.naabu_retries,
            timeout=request.timeout,
            threads=request.threads,
            exclude_closed=request.exclude_closed,
            subdomain_ids=request.subdomain_ids
        )
        return result
    except Exception as e:
        logger.error(f"Port scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/ports/target/{target}")
async def get_target_ports(
    target: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get ports for a target"""
    try:
        ports = get_ports_by_target(target, db, workspace_id=workspace_id)
        return ports
    except Exception as e:
        logger.error(f"Failed to get ports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/ports/scan/{scan_id}")
async def get_scan_ports(scan_id: str, db: Session = Depends(get_db)):
    """Get ports from a specific scan"""
    try:
        ports = get_ports_by_scan(scan_id, db)
        return ports
    except Exception as e:
        logger.error(f"Failed to get scan ports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/ports/workspace/{workspace_id}")
async def get_workspace_ports(workspace_id: str, db: Session = Depends(get_db)):
    """Get all ports for a workspace"""
    try:
        ports = get_ports_by_workspace(workspace_id, db)
        return ports
    except Exception as e:
        logger.error(f"Failed to get workspace ports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/ports/open")
async def get_all_open_ports(
    workspace_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get all open ports"""
    try:
        ports = get_open_ports(db, workspace_id=workspace_id, limit=limit)
        return ports
    except Exception as e:
        logger.error(f"Failed to get open ports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/ports/service/{service}")
async def get_service_ports(
    service: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get ports by service name"""
    try:
        ports = get_ports_by_service(service, db, workspace_id=workspace_id)
        return ports
    except Exception as e:
        logger.error(f"Failed to get service ports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== VISUALIZATION ENDPOINTS ====================

@app.get("/api/v1/visualization/domain/{domain}")
async def get_domain_viz(
    domain: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get visualization data for a domain"""
    try:
        return get_domain_visualization_data(domain, db, workspace_id=workspace_id)
    except Exception as e:
        logger.error(f"Failed to get visualization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/visualization/domain/{domain}/technologies")
async def get_domain_technologies(
    domain: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get technology breakdown for a domain"""
    try:
        return get_technology_breakdown(domain, db, workspace_id=workspace_id)
    except Exception as e:
        logger.error(f"Failed to get technologies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/visualization/domain/{domain}/services")
async def get_domain_services(
    domain: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get service breakdown for a domain"""
    try:
        return get_service_breakdown(domain, db, workspace_id=workspace_id)
    except Exception as e:
        logger.error(f"Failed to get services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/visualization/domain/{domain}/endpoints")
async def get_domain_endpoints(
    domain: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get endpoint tree for a domain"""
    try:
        return get_endpoint_tree(domain, db, workspace_id=workspace_id)
    except Exception as e:
        logger.error(f"Failed to get endpoints: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/visualization/domain/{domain}/attack-surface")
async def get_domain_attack_surface(
    domain: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get attack surface summary for a domain"""
    try:
        return get_attack_surface_summary(domain, db, workspace_id=workspace_id)
    except Exception as e:
        logger.error(f"Failed to get attack surface: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== VULNERABILITY SCANNING ENDPOINTS ====================

@app.post("/api/v1/vuln-scan/nuclei")
async def nuclei_scan(request: VulnScanRequest, db: Session = Depends(get_db)):
    """Run Nuclei vulnerability scanner"""
    try:
        result = run_vulnerability_scan(
            target_url=request.target_url,
            workspace_id=request.workspace_id,
            scanner='nuclei',
            templates=request.templates,
            concurrency=request.concurrency,
            timeout=request.timeout,
            rate_limit=request.rate_limit,
            scan_type=request.scan_type,
            save_to_db=request.save_to_db
        )
        return result
    except Exception as e:
        logger.error(f"Nuclei scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/vuln-scan/batch")
async def batch_vuln_scan(request: BatchVulnScanRequest, db: Session = Depends(get_db)):
    """Run vulnerability scans on multiple targets"""
    import uuid
    batch_id = str(uuid.uuid4())
    
    results = []
    
    for target in request.targets:
        for scanner in request.scanners:
            try:
                result = run_vulnerability_scan(
                    target_url=target,
                    workspace_id=request.workspace_id,
                    scanner=scanner,
                    templates=request.templates,
                    concurrency=request.concurrency,
                    timeout=request.timeout,
                    save_to_db=request.save_to_db,
                    batch_id=batch_id
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Batch scan failed for {target} with {scanner}: {e}")
                results.append({
                    'target': target,
                    'scanner': scanner,
                    'status': 'failed',
                    'error': str(e)
                })
    
    return {
        'batch_id': batch_id,
        'workspace_id': request.workspace_id,
        'total_scans': len(results),
        'successful': len([r for r in results if r.get('status') == 'completed']),
        'failed': len([r for r in results if r.get('status') == 'failed']),
        'results': results
    }


@app.get("/api/v1/vuln-scan/workspace/{workspace_id}/stats")
async def get_workspace_vuln_stats(workspace_id: str, db: Session = Depends(get_db)):
    """Get vulnerability statistics for a workspace"""
    try:
        return get_vuln_stats_by_workspace(workspace_id, db)
    except Exception as e:
        logger.error(f"Failed to get vuln stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/vuln-scan/summary")
async def get_vuln_summary_endpoint(
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get overall vulnerability summary"""
    try:
        return get_vuln_summary(db, workspace_id=workspace_id)
    except Exception as e:
        logger.error(f"Failed to get vuln summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== VALIDATION ENDPOINTS ====================

@app.post("/api/v1/validate/target")
async def validate_target(request: ValidationRequest, db: Session = Depends(get_db)):
    """Validate a single target for vulnerabilities"""
    try:
        result = validate_single_target(
            target_url=request.target_url,
            discovered_paths=request.discovered_paths,
            db=db,
            workspace_id=request.workspace_id
        )
        return result
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/validate/domain")
async def validate_domain(request: DomainValidationRequest, db: Session = Depends(get_db)):
    """Validate high-value targets for a domain"""
    try:
        results = validate_high_value_targets_for_domain(
            domain=request.domain,
            db=db,
            workspace_id=request.workspace_id,
            limit=request.limit,
            min_risk_score=request.min_risk_score
        )
        return {"domain": request.domain, "results": results}
    except Exception as e:
        logger.error(f"Domain validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/validate/workspace/{workspace_id}")
async def validate_workspace(
    workspace_id: str,
    limit: int = Query(10, ge=1, le=50),
    min_risk_score: int = Query(30, ge=0, le=100),
    db: Session = Depends(get_db)
):
    """Validate high-value targets across a workspace"""
    try:
        results = validate_workspace_targets(
            workspace_id=workspace_id,
            db=db,
            limit=limit,
            min_risk_score=min_risk_score
        )
        return {"workspace_id": workspace_id, "results": results}
    except Exception as e:
        logger.error(f"Workspace validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/validate/report/domain/{domain}")
async def get_domain_validation_report(
    domain: str,
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get validation report for a domain"""
    try:
        return get_validation_report(domain, db, workspace_id=workspace_id)
    except Exception as e:
        logger.error(f"Failed to get validation report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/validate/report/workspace/{workspace_id}")
async def get_workspace_validation_report_endpoint(
    workspace_id: str,
    db: Session = Depends(get_db)
):
    """Get validation report for a workspace"""
    try:
        return get_workspace_validation_report(workspace_id, db)
    except Exception as e:
        logger.error(f"Failed to get workspace validation report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AUTOSCAN ENDPOINTS ====================

from src.services.autoscan import autoscan_service
from src.config.database import SessionLocal

def get_db_factory():
    """Returns a function that creates new database sessions"""
    return SessionLocal


class AutoScanRequest(BaseModel):
    target_domain: str = Field(..., description="Target domain to scan")
    settings: Optional[Dict] = Field(default=None, description="Scan settings")


@app.post("/api/v1/autoscan/start/{workspace_id}")
async def start_autoscan(
    workspace_id: str,
    request: AutoScanRequest,
    db: Session = Depends(get_db)
):
    """
    Start a background auto-scan for a workspace.
    The scan continues running even if the client disconnects.
    """
    try:
        # Verify workspace exists
        workspace = get_workspace_db(workspace_id, db)
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        job = await autoscan_service.start_scan(
            workspace_id=workspace_id,
            target_domain=request.target_domain,
            settings=request.settings,
            db_session_factory=get_db_factory()
        )
        
        return {
            "status": "started",
            "job_id": job.id,
            "message": f"Scan started for {request.target_domain}"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to start autoscan: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/autoscan/status/{workspace_id}")
async def get_autoscan_status(workspace_id: str):
    """Get the current scan status for a workspace"""
    job = autoscan_service.get_workspace_job(workspace_id)
    if not job:
        return {
            "status": "idle",
            "job": None
        }
    
    return {
        "status": job.status.value,
        "job": job.to_dict()
    }


@app.get("/api/v1/autoscan/job/{job_id}")
async def get_autoscan_job(job_id: str):
    """Get details of a specific scan job"""
    job = autoscan_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return job.to_dict()


@app.post("/api/v1/autoscan/pause/{job_id}")
async def pause_autoscan(job_id: str):
    """Pause a running scan"""
    success = await autoscan_service.pause_scan(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot pause this scan")
    
    return {"status": "paused", "job_id": job_id}


@app.post("/api/v1/autoscan/resume/{job_id}")
async def resume_autoscan(job_id: str):
    """Resume a paused scan"""
    success = await autoscan_service.resume_scan(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot resume this scan")
    
    return {"status": "resumed", "job_id": job_id}


@app.post("/api/v1/autoscan/cancel/{job_id}")
async def cancel_autoscan(job_id: str):
    """Cancel a scan"""
    success = await autoscan_service.cancel_scan(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel this scan")
    
    return {"status": "cancelled", "job_id": job_id}


@app.delete("/api/v1/autoscan/job/{job_id}")
async def delete_autoscan_job(job_id: str):
    """Delete a completed/failed/cancelled scan job"""
    success = autoscan_service.clear_job(job_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete this job (may be still running)")
    
    return {"status": "deleted", "job_id": job_id}


@app.get("/api/v1/autoscan/jobs")
async def list_autoscan_jobs(workspace_id: Optional[str] = Query(None)):
    """List all scan jobs, optionally filtered by workspace"""
    jobs = autoscan_service.get_all_jobs(workspace_id)
    return {
        "jobs": [j.to_dict() for j in jobs],
        "count": len(jobs)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
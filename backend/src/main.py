from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
import logging
import os

# FIXED: Correct import path
from src.config.database import get_db, init_db

from src.controllers.validation import (
    validate_single_target,
    validate_high_value_targets_for_domain,
    quick_validate_target,
    get_validation_report
)

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
from src.controllers.http_prober import HTTPProber

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Bug Bounty Hunter Platform API",
    description="Advanced subdomain enumeration, content discovery, port scanning, and vulnerability validation tool",
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

# HTTP Probing Models
class ProbeHostsRequest(BaseModel):
    subdomains: List[str] = Field(..., description="List of subdomains to probe")
    concurrency: int = Field(10, description="Number of concurrent probes", ge=1, le=50)
    timeout: int = Field(10, description="Timeout per request in seconds", ge=1, le=30)

class ProbeHostsResponse(BaseModel):
    total: int
    active: int
    inactive: int
    results: List[Dict]

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

# Validation Models
class TargetValidationRequest(BaseModel):
    target_url: str = Field(..., description="Target URL to validate", example="https://admin.example.com")
    discovered_paths: Optional[List[str]] = Field([], description="List of discovered paths for testing")
    background: bool = Field(False, description="Run validation in background")

class ValidationResponse(BaseModel):
    target: str
    validated_at: str
    total_vulns: int
    critical_vulns: int
    high_vulns: int
    proofs: List[Dict]

class DomainValidationRequest(BaseModel):
    domain: str = Field(..., description="Domain to validate high-value targets")
    limit: int = Field(10, description="Max number of targets to validate", ge=1, le=50)
    min_risk_score: int = Field(30, description="Minimum risk score for validation", ge=0, le=100)

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
            "http_probing",
            "content_discovery",
            "port_scanning",
            "vulnerability_validation",
            "visualization"
        ],
        "endpoints": {
            "health": "/health",
            "subdomain_scan": "/api/v1/scan",
            "probe_hosts": "/api/v1/probe-hosts",
            "content_discovery": "/api/v1/content/scan",
            "port_scan": "/api/v1/ports/scan",
            "validation": "/api/v1/validation",
            "visualization": "/api/v1/visualization/{domain}",
            "docs": "/docs"
        }
    }

# ==================== HTTP Probing Endpoints ====================

@app.post("/api/v1/probe-hosts", response_model=ProbeHostsResponse)
async def probe_hosts_endpoint(
    request: ProbeHostsRequest,
    db: Session = Depends(get_db)
):
    """
    Probe a list of subdomains to check if they're live
    Returns status, IP, response time, etc.
    """
    try:
        logger.info(f"Starting HTTP probe for {len(request.subdomains)} subdomains")
        
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
            "results": results
        }
        
    except Exception as e:
        logger.error(f"HTTP probe failed: {e}")
        raise HTTPException(status_code=500, detail=f"Probe failed: {str(e)}")


@app.post("/api/v1/probe-hosts/batch")
async def probe_hosts_batch_endpoint(
    request: ProbeHostsRequest,
    db: Session = Depends(get_db)
):
    """
    Probe hosts in batches with progress tracking
    """
    try:
        logger.info(f"Starting batched HTTP probe for {len(request.subdomains)} subdomains")
        
        prober = HTTPProber(timeout=request.timeout)
        
        # Process in batches
        batch_size = min(request.concurrency, 20)
        all_results = []
        
        for i in range(0, len(request.subdomains), batch_size):
            batch = request.subdomains[i:i + batch_size]
            batch_results = await prober.probe_subdomains_batch(batch, concurrency=batch_size)
            all_results.extend(batch_results)
        
        active_count = sum(1 for r in all_results if r.get('is_active'))
        
        return {
            "total": len(all_results),
            "active": active_count,
            "inactive": len(all_results) - active_count,
            "results": all_results
        }
        
    except Exception as e:
        logger.error(f"Batched HTTP probe failed: {e}")
        raise HTTPException(status_code=500, detail=f"Probe failed: {str(e)}")

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

@app.get("/api/v1/domains")
async def get_domains(db: Session = Depends(get_db)):
    """Get all unique domains"""
    try:
        from src.models.Subdomain import Subdomain
        from sqlalchemy import distinct
        
        domains = db.query(distinct(Subdomain.domain)).all()
        domain_list = [d[0] for d in domains if d[0]]
        
        return sorted(domain_list)
    except Exception as e:
        logger.error(f"Failed to retrieve domains: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve domains: {str(e)}")

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

@app.post("/api/v1/content-discovery/start")
async def start_content_discovery_scan(
    request: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Start content discovery scan with custom tool configuration (frontend endpoint)
    """
    try:
        target_url = request.get('target_url')
        
        if not target_url:
            raise HTTPException(status_code=400, detail="target_url is required")
        
        # Extract all configuration options
        scan_config = {
            'scan_type': request.get('scan_type', 'full'),
            'use_ffuf': request.get('use_ffuf', True),
            'use_feroxbuster': request.get('use_feroxbuster', True),
            'use_waymore': request.get('use_waymore', True),
            'use_gau': request.get('use_gau', True),
            'use_katana': request.get('use_katana', True),
            'use_gospider': request.get('use_gospider', False),
            'use_linkfinder': request.get('use_linkfinder', False),
            'use_arjun': request.get('use_arjun', True),
            'use_unfurl': request.get('use_unfurl', True),
            'use_uro': request.get('use_uro', True),
            'use_nuclei': request.get('use_nuclei', False),
            'threads': request.get('threads', 10),
            'timeout': request.get('timeout', 600),
            'rate_limit': request.get('rate_limit', 150),
            'crawl_depth': request.get('crawl_depth', 3),
            'wordlist': request.get('wordlist', '/opt/wordlists/common.txt'),
            'subdomain_id': request.get('subdomain_id')
        }
        
        # Run scan (synchronously for now)
        result = start_content_discovery(target_url, **scan_config)
        
        return result
            
    except Exception as e:
        logger.error(f"Content discovery scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/content-discovery/target/{target}")
async def get_content_by_target_endpoint(
    target: str,
    db: Session = Depends(get_db)
):
    """Get all discovered content for a target URL"""
    try:
        results = get_content_by_target(target, db)
        return results
    except Exception as e:
        logger.error(f"Failed to get content: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Validation Endpoints ====================

@app.post("/api/v1/validation/validate-target")
async def validate_target_endpoint(
    request: TargetValidationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Validate a single target for vulnerabilities
    
    ⚠️ IMPORTANT: Only use on targets you have permission to test!
    """
    try:
        logger.info(f"Validation request for: {request.target_url}")
        
        if request.background:
            # Run in background
            background_tasks.add_task(
                validate_single_target,
                request.target_url,
                request.discovered_paths,
                db
            )
            return {
                "message": "Validation started in background",
                "target": request.target_url,
                "status": "running"
            }
        else:
            # Run synchronously
            result = validate_single_target(
                request.target_url,
                request.discovered_paths,
                db
            )
            return result
            
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/validation/quick-validate")
async def quick_validate_endpoint(
    request: TargetValidationRequest,
    db: Session = Depends(get_db)
):
    """
    Quick validation of a target (critical checks only)
    
    ⚠️ IMPORTANT: Only use on targets you have permission to test!
    """
    try:
        logger.info(f"Quick validation for: {request.target_url}")
        
        result = quick_validate_target(
            request.target_url,
            request.discovered_paths
        )
        return result
        
    except Exception as e:
        logger.error(f"Quick validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/validation/validate-domain")
async def validate_domain_endpoint(
    request: DomainValidationRequest,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """
    Validate high-value targets for a domain
    
    ⚠️ IMPORTANT: Only use on domains you have permission to test!
    """
    try:
        logger.info(f"Domain validation for: {request.domain} (limit: {request.limit}, min_risk: {request.min_risk_score})")
        
        result = validate_high_value_targets_for_domain(
            request.domain,
            db,
            request.limit,
            request.min_risk_score
        )
        return result
        
    except Exception as e:
        logger.error(f"Domain validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/validation/results/{domain}")
async def get_validation_report_endpoint(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get validation report for a domain"""
    try:
        report = get_validation_report(domain, db)
        return report
    except Exception as e:
        logger.error(f"Failed to get validation report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/validation/target/{subdomain}")
async def get_target_validation_endpoint(
    subdomain: str,
    db: Session = Depends(get_db)
):
    """Get validation results for a specific subdomain"""
    try:
        from src.models.Subdomain import Subdomain
        
        target = db.query(Subdomain).filter(
            Subdomain.full_domain == subdomain
        ).first()
        
        if not target:
            raise HTTPException(status_code=404, detail="Target not found")
        
        return {
            'subdomain': subdomain,
            'validated': target.validated,
            'validation_results': target.validation_results,
            'confirmed_vulns': target.confirmed_vulns,
            'last_validated': target.last_validated.isoformat() if target.last_validated else None,
            'risk_tier': target.risk_tier,
            'risk_score': target.risk_score
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get target validation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_attack_surface_viz(
    domain: str,
    db: Session = Depends(get_db)
):
    """Get attack surface summary metrics (visualization path)"""
    try:
        data = get_attack_surface_summary(domain, db)
        return data
    except Exception as e:
        logger.error(f"Failed to get attack surface: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get attack surface: {str(e)}")

@app.get("/api/v1/attack-surface/{domain}")
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
        
        # Validation stats
        validated_targets = db.query(Subdomain).filter(
            Subdomain.validated == True
        ).count()
        
        confirmed_critical = db.query(Subdomain).filter(
            Subdomain.risk_tier == 'CRITICAL_CONFIRMED'
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
            },
            "validation_stats": {
                "validated_targets": validated_targets,
                "confirmed_critical": confirmed_critical
            }
        }
    except Exception as e:
        logger.error(f"Failed to retrieve statistics: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve statistics: {str(e)}")


# ==================== VULNERABILITY SCANNING ENDPOINTS ====================

from src.controllers.vuln_scanner import (
    run_vulnerability_scan,
    get_vuln_scans_by_target,
    get_vuln_scans_by_domain,
    get_findings_by_severity,
    get_findings_by_scan,
    get_vuln_statistics,
    update_finding_status
)

class VulnScanRequest(BaseModel):
    target_url: str
    templates: Optional[List[str]] = None
    concurrency: int = Field(10, ge=1, le=50)
    timeout: int = Field(300, ge=30, le=600)
    rate_limit: int = Field(150, ge=10, le=500)
    follow_redirects: bool = True
    verify_ssl: bool = False
    save_to_db: bool = Field(True, description="Save results to database")
    scan_type: str = Field("quick", description="Scan type: quick, full, custom")

class VulnScanResponse(BaseModel):
    scanner: str
    target: str
    scan_id: str
    vulnerabilities: List[Dict]
    total_vulns: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    info_count: int
    scan_duration: str
    status: str
    error: Optional[str] = None
    db_id: Optional[int] = None

class BatchVulnScanRequest(BaseModel):
    targets: List[str]
    scanners: List[str] = Field(["nuclei"], description="List of scanners to run")
    templates: Optional[List[str]] = None
    concurrency: int = Field(10, ge=1, le=50)
    timeout: int = Field(300, ge=30, le=600)
    save_to_db: bool = True

class FindingUpdateRequest(BaseModel):
    status: str = Field(..., description="open, confirmed, false_positive, fixed")
    confirmed: Optional[bool] = None
    notes: Optional[str] = None
    confirmed_by: Optional[str] = None

@app.post("/api/v1/vuln-scan/nuclei")
async def nuclei_scan(request: VulnScanRequest, db: Session = Depends(get_db)):
    """Run Nuclei vulnerability scanner against a target"""
    try:
        result = run_vulnerability_scan(
            target_url=request.target_url,
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

@app.post("/api/v1/vuln-scan/nikto")
async def nikto_scan(request: VulnScanRequest, db: Session = Depends(get_db)):
    """Run Nikto web server scanner against a target"""
    try:
        result = run_vulnerability_scan(
            target_url=request.target_url,
            scanner='nikto',
            concurrency=request.concurrency,
            timeout=request.timeout,
            rate_limit=request.rate_limit,
            scan_type=request.scan_type,
            save_to_db=request.save_to_db
        )
        return result
    except Exception as e:
        logger.error(f"Nikto scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/vuln-scan/sqlmap")
async def sqlmap_scan(request: VulnScanRequest, db: Session = Depends(get_db)):
    """Run SQLMap SQL injection scanner (simulated for safety)"""
    try:
        result = run_vulnerability_scan(
            target_url=request.target_url,
            scanner='sqlmap',
            concurrency=request.concurrency,
            timeout=request.timeout,
            scan_type=request.scan_type,
            save_to_db=request.save_to_db
        )
        return result
    except Exception as e:
        logger.error(f"SQLMap scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/vuln-scan/xsstrike")
async def xsstrike_scan(request: VulnScanRequest, db: Session = Depends(get_db)):
    """Run XSStrike XSS scanner"""
    try:
        result = run_vulnerability_scan(
            target_url=request.target_url,
            scanner='xsstrike',
            concurrency=request.concurrency,
            timeout=request.timeout,
            scan_type=request.scan_type,
            save_to_db=request.save_to_db
        )
        return result
    except Exception as e:
        logger.error(f"XSStrike scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/vuln-scan/wpscan")
async def wpscan_scan(request: VulnScanRequest, db: Session = Depends(get_db)):
    """Run WPScan WordPress scanner"""
    try:
        result = run_vulnerability_scan(
            target_url=request.target_url,
            scanner='wpscan',
            concurrency=request.concurrency,
            timeout=request.timeout,
            scan_type=request.scan_type,
            save_to_db=request.save_to_db
        )
        return result
    except Exception as e:
        logger.error(f"WPScan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/vuln-scan/sslyze")
async def sslyze_scan(request: VulnScanRequest, db: Session = Depends(get_db)):
    """Run SSLyze SSL/TLS analyzer"""
    try:
        result = run_vulnerability_scan(
            target_url=request.target_url,
            scanner='sslyze',
            concurrency=request.concurrency,
            timeout=request.timeout,
            scan_type=request.scan_type,
            save_to_db=request.save_to_db
        )
        return result
    except Exception as e:
        logger.error(f"SSLyze scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/vuln-scan/batch")
async def batch_vuln_scan(
    request: BatchVulnScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Run vulnerability scans on multiple targets with multiple scanners"""
    import uuid
    batch_id = str(uuid.uuid4())
    
    results = []
    
    for target in request.targets:
        for scanner in request.scanners:
            try:
                result = run_vulnerability_scan(
                    target_url=target,
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
        'total_scans': len(results),
        'successful': len([r for r in results if r.get('status') == 'completed']),
        'failed': len([r for r in results if r.get('status') == 'failed']),
        'results': results
    }

@app.get("/api/v1/vuln-scan/target/{target:path}")
async def get_target_vuln_scans(target: str, db: Session = Depends(get_db)):
    """Get all vulnerability scans for a specific target"""
    try:
        scans = get_vuln_scans_by_target(target, db)
        return scans
    except Exception as e:
        logger.error(f"Failed to get vuln scans: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/vuln-scan/domain/{domain}")
async def get_domain_vuln_scans(domain: str, db: Session = Depends(get_db)):
    """Get all vulnerability scans for a domain's subdomains"""
    try:
        scans = get_vuln_scans_by_domain(domain, db)
        return scans
    except Exception as e:
        logger.error(f"Failed to get domain vuln scans: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/vuln-scan/findings/{scan_id}")
async def get_scan_findings(scan_id: str, db: Session = Depends(get_db)):
    """Get all findings for a specific scan"""
    try:
        findings = get_findings_by_scan(scan_id, db)
        return findings
    except Exception as e:
        logger.error(f"Failed to get scan findings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/vuln-scan/findings/severity/{severity}")
async def get_findings_by_sev(
    severity: str,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get vulnerability findings by severity level"""
    try:
        findings = get_findings_by_severity(severity, db, limit)
        return findings
    except Exception as e:
        logger.error(f"Failed to get findings by severity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/vuln-scan/finding/{finding_id}")
async def update_finding(
    finding_id: int,
    request: FindingUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update the status of a vulnerability finding"""
    try:
        result = update_finding_status(
            finding_id=finding_id,
            status=request.status,
            confirmed=request.confirmed,
            notes=request.notes,
            confirmed_by=request.confirmed_by,
            db=db
        )
        return result
    except Exception as e:
        logger.error(f"Failed to update finding: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/vuln-scan/statistics")
async def get_vuln_stats(db: Session = Depends(get_db)):
    """Get overall vulnerability scanning statistics"""
    try:
        stats = get_vuln_statistics(db)
        return stats
    except Exception as e:
        logger.error(f"Failed to get vuln statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
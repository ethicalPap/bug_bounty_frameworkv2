# Subdomain Scanner Controllers
# All controllers support workspace isolation via workspace_id parameter

__version__ = "2.0.0"

from src.controllers.workspace import (
    create_workspace,
    get_workspace,
    get_all_workspaces,
    update_workspace,
    delete_workspace,
    get_workspace_stats,
    workspace_to_dict,
    touch_workspace
)

from src.controllers.subdomains import (
    start_subdomain_scan,
    get_subdomains_by_domain,
    get_scan_results,
    get_subdomains_by_workspace,
    delete_duplicates
)

from src.controllers.http_prober import (
    probe_domain_subdomains,
    probe_scan_results,
    probe_specific_subdomains,
    probe_workspace_subdomains
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

from src.controllers.content_discovery import (
    start_content_discovery,
    get_content_by_target,
    get_content_by_scan,
    get_content_by_workspace,
    get_interesting_discoveries,
    get_js_endpoints,
    get_api_parameters
)

from src.controllers.visualization import (
    get_domain_visualization_data,
    get_technology_breakdown,
    get_service_breakdown,
    get_endpoint_tree,
    get_attack_surface_summary,
    get_workspace_visualization_data
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

__all__ = [
    # Workspace
    'create_workspace',
    'get_workspace',
    'get_all_workspaces',
    'update_workspace',
    'delete_workspace',
    'get_workspace_stats',
    'workspace_to_dict',
    'touch_workspace',
    
    # Subdomains
    'start_subdomain_scan',
    'get_subdomains_by_domain',
    'get_scan_results',
    'get_subdomains_by_workspace',
    'delete_duplicates',
    
    # HTTP Prober
    'probe_domain_subdomains',
    'probe_scan_results',
    'probe_specific_subdomains',
    'probe_workspace_subdomains',
    
    # Port Scanner
    'start_port_scan',
    'get_ports_by_target',
    'get_ports_by_subdomain',
    'get_ports_by_scan',
    'get_ports_by_workspace',
    'get_open_ports',
    'get_vulnerable_services',
    'get_ports_by_service',
    
    # Content Discovery
    'start_content_discovery',
    'get_content_by_target',
    'get_content_by_scan',
    'get_content_by_workspace',
    'get_interesting_discoveries',
    'get_js_endpoints',
    'get_api_parameters',
    
    # Visualization
    'get_domain_visualization_data',
    'get_technology_breakdown',
    'get_service_breakdown',
    'get_endpoint_tree',
    'get_attack_surface_summary',
    'get_workspace_visualization_data',
    
    # Validation
    'validate_single_target',
    'validate_high_value_targets_for_domain',
    'validate_workspace_targets',
    'quick_validate_target',
    'get_validation_report',
    'get_workspace_validation_report',
    
    # Vuln Scanner
    'run_vulnerability_scan',
    'get_vuln_stats_by_workspace',
    'get_vuln_summary'
]
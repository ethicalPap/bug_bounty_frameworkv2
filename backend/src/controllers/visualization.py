"""
Visualization Data Controller
Aggregates data from all scan types for visual representation
Supports workspace isolation
"""

import logging
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from collections import defaultdict

from src.models.Subdomain import Subdomain
from src.models.ContentDiscovery import ContentDiscovery, JSEndpoint, APIParameter
from src.models.PortScan import PortScan
from src.config.database import SessionLocal

logger = logging.getLogger(__name__)


def get_domain_visualization_data(domain: str, db: Session, workspace_id: Optional[str] = None) -> Dict:
    """
    Get comprehensive visualization data for a domain
    Returns data structured for network graph visualization
    """
    try:
        # Get all subdomains
        query = db.query(Subdomain).filter(Subdomain.domain == domain)
        if workspace_id:
            query = query.filter(Subdomain.workspace_id == workspace_id)
        subdomains = query.all()
        
        # Get all content discoveries for this domain
        subdomain_ids = [s.id for s in subdomains]
        content_discoveries = []
        if subdomain_ids:
            cd_query = db.query(ContentDiscovery).filter(
                ContentDiscovery.subdomain_id.in_(subdomain_ids)
            )
            if workspace_id:
                cd_query = cd_query.filter(ContentDiscovery.workspace_id == workspace_id)
            content_discoveries = cd_query.all()
        
        # Get all port scans
        port_scans = []
        subdomain_names = [s.full_domain for s in subdomains]
        if subdomain_names:
            ps_query = db.query(PortScan).filter(PortScan.target.in_(subdomain_names))
            if workspace_id:
                ps_query = ps_query.filter(PortScan.workspace_id == workspace_id)
            port_scans = ps_query.all()
        
        # Get JS endpoints and API parameters
        js_endpoints = []
        api_parameters = []
        if subdomain_ids:
            content_ids = [cd.id for cd in content_discoveries]
            if content_ids:
                je_query = db.query(JSEndpoint).filter(
                    JSEndpoint.content_discovery_id.in_(content_ids)
                )
                if workspace_id:
                    je_query = je_query.filter(JSEndpoint.workspace_id == workspace_id)
                js_endpoints = je_query.all()
                
                ap_query = db.query(APIParameter).filter(
                    APIParameter.content_discovery_id.in_(content_ids)
                )
                if workspace_id:
                    ap_query = ap_query.filter(APIParameter.workspace_id == workspace_id)
                api_parameters = ap_query.all()
        
        # Build nodes and edges for network graph
        nodes = []
        edges = []
        
        # Root domain node
        nodes.append({
            'id': f'domain-{domain}',
            'label': domain,
            'type': 'domain',
            'group': 'domain',
            'size': 30,
            'color': '#3b82f6'
        })
        
        # Subdomain nodes
        subdomain_map = {}
        for subdomain in subdomains:
            node_id = f'subdomain-{subdomain.id}'
            subdomain_map[subdomain.id] = node_id
            
            nodes.append({
                'id': node_id,
                'label': subdomain.subdomain,
                'full_domain': subdomain.full_domain,
                'type': 'subdomain',
                'group': 'subdomain',
                'size': 20,
                'color': '#10b981' if subdomain.is_active else '#6b7280',
                'is_active': subdomain.is_active,
                'ip_address': subdomain.ip_address,
                'status_code': subdomain.http_status,
                'title': subdomain.title
            })
            
            # Edge from domain to subdomain
            edges.append({
                'source': f'domain-{domain}',
                'target': node_id,
                'type': 'has_subdomain',
                'label': 'subdomain'
            })
        
        # Technology nodes (from technologies field)
        tech_map = defaultdict(list)
        for subdomain in subdomains:
            if subdomain.technologies:
                tech = subdomain.technologies.split('/')[0] if '/' in subdomain.technologies else subdomain.technologies
                tech_map[tech].append(subdomain.id)
        
        for tech, sub_ids in tech_map.items():
            tech_id = f'tech-{tech}'
            nodes.append({
                'id': tech_id,
                'label': tech,
                'type': 'technology',
                'group': 'technology',
                'size': 15,
                'color': '#a855f7',
                'count': len(sub_ids)
            })
            
            for sub_id in sub_ids:
                if sub_id in subdomain_map:
                    edges.append({
                        'source': subdomain_map[sub_id],
                        'target': tech_id,
                        'type': 'uses_tech',
                        'label': 'uses'
                    })
        
        # Port/Service nodes
        service_map = defaultdict(list)
        for port in port_scans:
            if port.service:
                service_map[port.service].append(port)
        
        for service, ports in service_map.items():
            service_id = f'service-{service}'
            nodes.append({
                'id': service_id,
                'label': service,
                'type': 'service',
                'group': 'service',
                'size': 12,
                'color': '#ec4899',
                'ports': list(set([p.port for p in ports])),
                'count': len(ports)
            })
            
            for port in ports:
                for subdomain in subdomains:
                    if subdomain.full_domain == port.target:
                        if subdomain.id in subdomain_map:
                            edges.append({
                                'source': subdomain_map[subdomain.id],
                                'target': service_id,
                                'type': 'runs_service',
                                'label': f':{port.port}',
                                'port': port.port,
                                'state': port.state
                            })
                        break
        
        # Endpoint nodes (top-level paths only)
        endpoint_map = defaultdict(set)
        for content in content_discoveries:
            if content.path:
                parts = content.path.strip('/').split('/')
                top_level = '/' + parts[0] if parts and parts[0] else '/'
                endpoint_map[content.subdomain_id].add(top_level)
        
        for sub_id, paths in endpoint_map.items():
            if sub_id in subdomain_map:
                for path in list(paths)[:5]:
                    path_id = f'path-{sub_id}-{path.replace("/", "_")}'
                    nodes.append({
                        'id': path_id,
                        'label': path,
                        'type': 'endpoint',
                        'group': 'endpoint',
                        'size': 8,
                        'color': '#f59e0b'
                    })
                    
                    edges.append({
                        'source': subdomain_map[sub_id],
                        'target': path_id,
                        'type': 'has_endpoint',
                        'label': 'endpoint'
                    })
        
        # Statistics
        stats = {
            'total_subdomains': len(subdomains),
            'active_subdomains': len([s for s in subdomains if s.is_active]),
            'total_technologies': len(tech_map),
            'total_services': len(service_map),
            'total_open_ports': len(port_scans),
            'total_endpoints': len(content_discoveries),
            'total_js_endpoints': len(js_endpoints),
            'total_api_parameters': len(api_parameters)
        }
        
        return {
            'domain': domain,
            'workspace_id': workspace_id,
            'nodes': nodes,
            'edges': edges,
            'stats': stats,
            'raw_data': {
                'subdomains': [s.to_dict() for s in subdomains],
                'technologies': list(tech_map.keys()),
                'services': list(service_map.keys()),
                'ports': [p.to_dict() for p in port_scans[:100]],
                'content_discoveries': [c.to_dict() for c in content_discoveries[:100]]
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting visualization data for {domain}: {e}")
        raise


def get_technology_breakdown(domain: str, db: Session, workspace_id: Optional[str] = None) -> Dict:
    """Get detailed technology breakdown for visualization"""
    try:
        query = db.query(Subdomain).filter(Subdomain.domain == domain)
        if workspace_id:
            query = query.filter(Subdomain.workspace_id == workspace_id)
        subdomains = query.all()
        
        tech_breakdown = defaultdict(lambda: {'count': 0, 'subdomains': []})
        
        for subdomain in subdomains:
            if subdomain.technologies:
                tech = subdomain.technologies.split('/')[0] if '/' in subdomain.technologies else subdomain.technologies
                tech_breakdown[tech]['count'] += 1
                tech_breakdown[tech]['subdomains'].append(subdomain.full_domain)
        
        return {
            'domain': domain,
            'workspace_id': workspace_id,
            'technologies': [
                {
                    'name': tech,
                    'count': data['count'],
                    'subdomains': data['subdomains']
                }
                for tech, data in sorted(tech_breakdown.items(), key=lambda x: x[1]['count'], reverse=True)
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting technology breakdown: {e}")
        raise


def get_service_breakdown(domain: str, db: Session, workspace_id: Optional[str] = None) -> Dict:
    """Get detailed service/port breakdown for visualization"""
    try:
        query = db.query(Subdomain).filter(Subdomain.domain == domain)
        if workspace_id:
            query = query.filter(Subdomain.workspace_id == workspace_id)
        subdomains = query.all()
        
        subdomain_names = [s.full_domain for s in subdomains]
        
        ps_query = db.query(PortScan).filter(PortScan.target.in_(subdomain_names))
        if workspace_id:
            ps_query = ps_query.filter(PortScan.workspace_id == workspace_id)
        ports = ps_query.all()
        
        service_breakdown = defaultdict(lambda: {
            'count': 0,
            'ports': set(),
            'targets': set(),
            'versions': set()
        })
        
        for port in ports:
            if port.service:
                service_breakdown[port.service]['count'] += 1
                service_breakdown[port.service]['ports'].add(port.port)
                service_breakdown[port.service]['targets'].add(port.target)
                if port.version:
                    service_breakdown[port.service]['versions'].add(port.version)
        
        return {
            'domain': domain,
            'workspace_id': workspace_id,
            'services': [
                {
                    'name': service,
                    'count': data['count'],
                    'ports': sorted(list(data['ports'])),
                    'targets': list(data['targets'])[:10],
                    'versions': list(data['versions'])[:5]
                }
                for service, data in sorted(service_breakdown.items(), key=lambda x: x[1]['count'], reverse=True)
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting service breakdown: {e}")
        raise


def get_endpoint_tree(domain: str, db: Session, workspace_id: Optional[str] = None) -> Dict:
    """Get hierarchical endpoint tree for visualization"""
    try:
        query = db.query(Subdomain).filter(Subdomain.domain == domain)
        if workspace_id:
            query = query.filter(Subdomain.workspace_id == workspace_id)
        subdomains = query.all()
        
        subdomain_ids = [s.id for s in subdomains]
        
        cd_query = db.query(ContentDiscovery).filter(
            ContentDiscovery.subdomain_id.in_(subdomain_ids)
        )
        if workspace_id:
            cd_query = cd_query.filter(ContentDiscovery.workspace_id == workspace_id)
        content = cd_query.all()
        
        # Build tree structure
        tree = {
            'name': domain,
            'children': []
        }
        
        subdomain_tree = {}
        for subdomain in subdomains:
            subdomain_tree[subdomain.id] = {
                'name': subdomain.subdomain,
                'full_domain': subdomain.full_domain,
                'children': []
            }
        
        # Add endpoints to subdomains
        for item in content:
            if item.subdomain_id in subdomain_tree:
                subdomain_tree[item.subdomain_id]['children'].append({
                    'name': item.path,
                    'status_code': item.status_code,
                    'content_type': item.content_type,
                    'size': 1
                })
        
        tree['children'] = list(subdomain_tree.values())
        
        return {
            'domain': domain,
            'workspace_id': workspace_id,
            'tree': tree
        }
        
    except Exception as e:
        logger.error(f"Error getting endpoint tree: {e}")
        raise


def get_attack_surface_summary(domain: str, db: Session, workspace_id: Optional[str] = None) -> Dict:
    """Get attack surface summary metrics"""
    try:
        query = db.query(Subdomain).filter(Subdomain.domain == domain)
        if workspace_id:
            query = query.filter(Subdomain.workspace_id == workspace_id)
        subdomains = query.all()
        
        subdomain_ids = [s.id for s in subdomains]
        subdomain_names = [s.full_domain for s in subdomains]
        
        # Count various metrics
        total_subdomains = len(subdomains)
        active_subdomains = len([s for s in subdomains if s.is_active])
        
        total_ports = 0
        open_ports = 0
        if subdomain_names:
            ps_query = db.query(PortScan).filter(PortScan.target.in_(subdomain_names))
            if workspace_id:
                ps_query = ps_query.filter(PortScan.workspace_id == workspace_id)
            total_ports = ps_query.count()
            
            open_query = db.query(PortScan).filter(
                PortScan.target.in_(subdomain_names),
                PortScan.state == 'open'
            )
            if workspace_id:
                open_query = open_query.filter(PortScan.workspace_id == workspace_id)
            open_ports = open_query.count()
        
        total_endpoints = 0
        interesting_endpoints = 0
        if subdomain_ids:
            cd_query = db.query(ContentDiscovery).filter(
                ContentDiscovery.subdomain_id.in_(subdomain_ids)
            )
            if workspace_id:
                cd_query = cd_query.filter(ContentDiscovery.workspace_id == workspace_id)
            total_endpoints = cd_query.count()
            
            int_query = db.query(ContentDiscovery).filter(
                ContentDiscovery.subdomain_id.in_(subdomain_ids),
                ContentDiscovery.interesting == True
            )
            if workspace_id:
                int_query = int_query.filter(ContentDiscovery.workspace_id == workspace_id)
            interesting_endpoints = int_query.count()
        
        # Technology diversity
        tech_query = db.query(distinct(Subdomain.technologies)).filter(
            Subdomain.domain == domain,
            Subdomain.technologies.isnot(None)
        )
        if workspace_id:
            tech_query = tech_query.filter(Subdomain.workspace_id == workspace_id)
        unique_techs = tech_query.count()
        
        # Service diversity
        unique_services = 0
        if subdomain_names:
            svc_query = db.query(distinct(PortScan.service)).filter(
                PortScan.target.in_(subdomain_names),
                PortScan.service.isnot(None)
            )
            if workspace_id:
                svc_query = svc_query.filter(PortScan.workspace_id == workspace_id)
            unique_services = svc_query.count()
        
        return {
            'domain': domain,
            'workspace_id': workspace_id,
            'attack_surface': {
                'subdomains': {
                    'total': total_subdomains,
                    'active': active_subdomains,
                    'inactive': total_subdomains - active_subdomains
                },
                'ports': {
                    'total': total_ports,
                    'open': open_ports,
                    'services': unique_services
                },
                'endpoints': {
                    'total': total_endpoints,
                    'interesting': interesting_endpoints
                },
                'technologies': {
                    'count': unique_techs
                },
                'exposure_score': calculate_exposure_score(
                    active_subdomains,
                    open_ports,
                    total_endpoints,
                    interesting_endpoints
                )
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting attack surface summary: {e}")
        raise


def get_workspace_visualization_data(workspace_id: str, db: Session) -> Dict:
    """Get comprehensive visualization data for an entire workspace"""
    try:
        # Get all unique domains in workspace
        domains = db.query(distinct(Subdomain.domain)).filter(
            Subdomain.workspace_id == workspace_id
        ).all()
        
        domain_list = [d[0] for d in domains]
        
        # Aggregate stats across all domains
        total_subdomains = db.query(Subdomain).filter(
            Subdomain.workspace_id == workspace_id
        ).count()
        
        active_subdomains = db.query(Subdomain).filter(
            Subdomain.workspace_id == workspace_id,
            Subdomain.is_active == True
        ).count()
        
        total_ports = db.query(PortScan).filter(
            PortScan.workspace_id == workspace_id
        ).count()
        
        total_content = db.query(ContentDiscovery).filter(
            ContentDiscovery.workspace_id == workspace_id
        ).count()
        
        return {
            'workspace_id': workspace_id,
            'domains': domain_list,
            'stats': {
                'total_domains': len(domain_list),
                'total_subdomains': total_subdomains,
                'active_subdomains': active_subdomains,
                'total_ports': total_ports,
                'total_content_discoveries': total_content
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting workspace visualization data: {e}")
        raise


def calculate_exposure_score(active_subs: int, open_ports: int, 
                            total_endpoints: int, interesting_endpoints: int) -> float:
    """
    Calculate a normalized exposure score (0-100)
    Higher score = larger attack surface
    """
    score = 0
    
    # Active subdomains (0-30 points)
    score += min(active_subs * 2, 30)
    
    # Open ports (0-25 points)
    score += min(open_ports * 0.5, 25)
    
    # Total endpoints (0-25 points)
    score += min(total_endpoints * 0.1, 25)
    
    # Interesting endpoints (0-20 points)
    score += min(interesting_endpoints * 2, 20)
    
    return min(round(score, 2), 100.0)
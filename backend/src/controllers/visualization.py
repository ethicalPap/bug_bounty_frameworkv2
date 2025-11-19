"""
Visualization Data Controller
Aggregates data from all scan types for visual representation
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


def get_domain_visualization_data(domain: str, db: Session) -> Dict:
    """
    Get comprehensive visualization data for a domain
    Returns data structured for network graph visualization
    """
    try:
        # Get all subdomains
        subdomains = db.query(Subdomain).filter(
            Subdomain.domain == domain
        ).all()
        
        # Get all content discoveries for this domain
        subdomain_ids = [s.id for s in subdomains]
        content_discoveries = []
        if subdomain_ids:
            content_discoveries = db.query(ContentDiscovery).filter(
                ContentDiscovery.subdomain_id.in_(subdomain_ids)
            ).all()
        
        # Get all port scans
        port_scans = []
        subdomain_names = [s.full_domain for s in subdomains]
        if subdomain_names:
            port_scans = db.query(PortScan).filter(
                PortScan.target.in_(subdomain_names)
            ).all()
        
        # Get JS endpoints and API parameters
        js_endpoints = []
        api_parameters = []
        if subdomain_ids:
            js_endpoints = db.query(JSEndpoint).filter(
                JSEndpoint.content_discovery_id.in_([cd.id for cd in content_discoveries])
            ).all()
            
            api_parameters = db.query(APIParameter).filter(
                APIParameter.content_discovery_id.in_([cd.id for cd in content_discoveries])
            ).all()
        
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
                'status_code': subdomain.status_code,
                'title': subdomain.title,
                'server': subdomain.server
            })
            
            # Edge from domain to subdomain
            edges.append({
                'source': f'domain-{domain}',
                'target': node_id,
                'type': 'has_subdomain',
                'label': 'subdomain'
            })
        
        # Technology nodes (from server headers)
        tech_map = defaultdict(list)
        for subdomain in subdomains:
            if subdomain.server:
                tech = subdomain.server.split('/')[0]  # Extract tech name
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
            
            # Edge from subdomains to technology
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
            
            # Edge from subdomains to services
            for port in ports:
                # Find matching subdomain
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
                # Extract top-level path
                parts = content.path.strip('/').split('/')
                top_level = '/' + parts[0] if parts and parts[0] else '/'
                endpoint_map[content.subdomain_id].add(top_level)
        
        for sub_id, paths in endpoint_map.items():
            if sub_id in subdomain_map:
                for path in list(paths)[:5]:  # Limit to top 5 paths per subdomain
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
            'nodes': nodes,
            'edges': edges,
            'stats': stats,
            'raw_data': {
                'subdomains': [s.to_dict() for s in subdomains],
                'technologies': list(tech_map.keys()),
                'services': list(service_map.keys()),
                'ports': [p.to_dict() for p in port_scans[:100]],  # Limit for performance
                'content_discoveries': [c.to_dict() for c in content_discoveries[:100]]
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting visualization data for {domain}: {e}")
        raise


def get_technology_breakdown(domain: str, db: Session) -> Dict:
    """Get detailed technology breakdown for visualization"""
    try:
        subdomains = db.query(Subdomain).filter(
            Subdomain.domain == domain
        ).all()
        
        tech_breakdown = defaultdict(lambda: {'count': 0, 'subdomains': []})
        
        for subdomain in subdomains:
            if subdomain.server:
                tech = subdomain.server.split('/')[0]
                tech_breakdown[tech]['count'] += 1
                tech_breakdown[tech]['subdomains'].append(subdomain.full_domain)
        
        return {
            'domain': domain,
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


def get_service_breakdown(domain: str, db: Session) -> Dict:
    """Get detailed service/port breakdown for visualization"""
    try:
        subdomains = db.query(Subdomain).filter(
            Subdomain.domain == domain
        ).all()
        
        subdomain_names = [s.full_domain for s in subdomains]
        
        ports = db.query(PortScan).filter(
            PortScan.target.in_(subdomain_names)
        ).all()
        
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
            'services': [
                {
                    'name': service,
                    'count': data['count'],
                    'ports': sorted(list(data['ports'])),
                    'targets': list(data['targets'])[:10],  # Limit for performance
                    'versions': list(data['versions'])[:5]
                }
                for service, data in sorted(service_breakdown.items(), key=lambda x: x[1]['count'], reverse=True)
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting service breakdown: {e}")
        raise


def get_endpoint_tree(domain: str, db: Session) -> Dict:
    """Get hierarchical endpoint tree for visualization"""
    try:
        subdomains = db.query(Subdomain).filter(
            Subdomain.domain == domain
        ).all()
        
        subdomain_ids = [s.id for s in subdomains]
        
        content = db.query(ContentDiscovery).filter(
            ContentDiscovery.subdomain_id.in_(subdomain_ids)
        ).all()
        
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
                    'method': item.method,
                    'discovery_type': item.discovery_type,
                    'size': 1
                })
        
        tree['children'] = list(subdomain_tree.values())
        
        return {
            'domain': domain,
            'tree': tree
        }
        
    except Exception as e:
        logger.error(f"Error getting endpoint tree: {e}")
        raise


def get_attack_surface_summary(domain: str, db: Session) -> Dict:
    """Get attack surface summary metrics"""
    try:
        subdomains = db.query(Subdomain).filter(
            Subdomain.domain == domain
        ).all()
        
        subdomain_ids = [s.id for s in subdomains]
        subdomain_names = [s.full_domain for s in subdomains]
        
        # Count various metrics
        total_subdomains = len(subdomains)
        active_subdomains = len([s for s in subdomains if s.is_active])
        
        total_ports = 0
        open_ports = 0
        if subdomain_names:
            total_ports = db.query(PortScan).filter(
                PortScan.target.in_(subdomain_names)
            ).count()
            
            open_ports = db.query(PortScan).filter(
                PortScan.target.in_(subdomain_names),
                PortScan.state == 'open'
            ).count()
        
        total_endpoints = 0
        interesting_endpoints = 0
        if subdomain_ids:
            total_endpoints = db.query(ContentDiscovery).filter(
                ContentDiscovery.subdomain_id.in_(subdomain_ids)
            ).count()
            
            interesting_endpoints = db.query(ContentDiscovery).filter(
                ContentDiscovery.subdomain_id.in_(subdomain_ids),
                ContentDiscovery.is_interesting == True
            ).count()
        
        # Technology diversity
        unique_techs = db.query(distinct(Subdomain.server)).filter(
            Subdomain.domain == domain,
            Subdomain.server.isnot(None)
        ).count()
        
        # Service diversity
        unique_services = 0
        if subdomain_names:
            unique_services = db.query(distinct(PortScan.service)).filter(
                PortScan.target.in_(subdomain_names),
                PortScan.service.isnot(None)
            ).count()
        
        return {
            'domain': domain,
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


def calculate_exposure_score(active_subs: int, open_ports: int, 
                            total_endpoints: int, interesting_endpoints: int) -> float:
    """
    Calculate a normalized exposure score (0-100)
    Higher score = larger attack surface
    """
    # Weighted scoring
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
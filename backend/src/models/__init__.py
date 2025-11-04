# Models package
# This file imports all models so they're registered with SQLAlchemy Base

from src.models.Subdomain import Subdomain
from src.models.ContentDiscovery import ContentDiscovery, JSEndpoint, APIParameter
from src.models.PortScan import PortScan

__all__ = [
    'Subdomain',
    'ContentDiscovery',
    'JSEndpoint', 
    'APIParameter',
    'PortScan'
]

__version__ = "2.0.0"
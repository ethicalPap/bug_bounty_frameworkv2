import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# Get database URL from environment variable
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@db:5432/subdomain_scanner"
)

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False  # Set to True for SQL query logging
)

# Create SessionLocal class
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for models
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session.
    Use in FastAPI route dependencies.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initialize database tables.
    Creates all tables defined in models in correct order to handle foreign keys.
    """
    # Import all models to register them with their Base classes
    from src.models.Subdomain import Base as SubdomainBase, Subdomain
    from src.models.ContentDiscovery import Base as ContentDiscoveryBase, ContentDiscovery, JSEndpoint, APIParameter
    from src.models.PortScan import Base as PortScanBase, PortScan, PortScanSummary
    
    # Create tables in dependency order
    # 1. First create independent tables (no foreign keys)
    SubdomainBase.metadata.create_all(bind=engine)
    print("✓ Created: subdomains table")
    
    # 2. Then create tables that depend on subdomains
    ContentDiscoveryBase.metadata.create_all(bind=engine)
    print("✓ Created: content_discovery, js_endpoints, api_parameters tables")
    
    # 3. Finally create port scan tables (depends on subdomains)
    PortScanBase.metadata.create_all(bind=engine)
    print("✓ Created: port_scans, port_scan_summaries tables")
    
    print("\n✅ Database initialized successfully!")
    print("Tables created: subdomains, content_discovery, js_endpoints, api_parameters, port_scans, port_scan_summaries")

def drop_db():
    """
    Drop all database tables.
    WARNING: This will delete all data!
    """
    from src.models.Subdomain import Base as SubdomainBase
    from src.models.ContentDiscovery import Base as ContentDiscoveryBase
    from src.models.PortScan import Base as PortScanBase
    
    SubdomainBase.metadata.drop_all(bind=engine)
    ContentDiscoveryBase.metadata.drop_all(bind=engine)
    PortScanBase.metadata.drop_all(bind=engine)
    print("Database tables dropped!")
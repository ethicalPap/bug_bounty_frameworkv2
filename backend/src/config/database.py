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
    Creates all tables defined in models.
    """
    from src.models.Subdomain import Base as SubdomainBase
    from src.models.ContentDiscovery import Base as ContentDiscoveryBase
    
    # Import all models here to ensure they're registered
    # This ensures all tables are created
    SubdomainBase.metadata.create_all(bind=engine)
    ContentDiscoveryBase.metadata.create_all(bind=engine)
    print("Database tables created successfully!")
    print("Tables: subdomains, content_discovery, js_endpoints, api_parameters")

def drop_db():
    """
    Drop all database tables.
    WARNING: This will delete all data!
    """
    from src.models.Subdomain import Base as SubdomainBase
    from src.models.ContentDiscovery import Base as ContentDiscoveryBase
    
    SubdomainBase.metadata.drop_all(bind=engine)
    ContentDiscoveryBase.metadata.drop_all(bind=engine)
    print("Database tables dropped!")
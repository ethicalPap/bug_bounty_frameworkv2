import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import logging

logger = logging.getLogger(__name__)

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

# SHARED Base class for ALL models
# This must be imported in all model files instead of creating separate bases
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
    Handles fresh builds and recovers from inconsistent states automatically.
    Creates all tables defined in models using the shared Base.
    """
    try:
        # Import all models to register them with the shared Base
        from src.models import Subdomain, ContentDiscovery, JSEndpoint, APIParameter, PortScan
        
        logger.info("📦 Importing models...")
        logger.info("✓ Models imported successfully")
        
        # Show registered models
        logger.info("📋 Registered models:")
        for table_name in Base.metadata.tables.keys():
            logger.info(f"  • {table_name}")
        
        # Try to create tables
        logger.info("🏗️  Creating tables...")
        
        try:
            Base.metadata.create_all(bind=engine)
            
            # Verify tables were created
            inspector = inspect(engine)
            created_tables = inspector.get_table_names()
            
            print("\n✅ Database initialized successfully!")
            print(f"Tables created: {len(created_tables)}")
            for table_name in created_tables:
                print(f"  ✓ {table_name}")
            
            return True
            
        except Exception as create_error:
            # If creation fails (e.g., orphaned indexes), clean and retry
            error_str = str(create_error)
            
            if "already exists" in error_str or "DuplicateTable" in error_str:
                logger.warning("⚠️  Found orphaned database objects, cleaning up...")
                
                # Drop everything and recreate
                with engine.connect() as conn:
                    inspector = inspect(engine)
                    tables = inspector.get_table_names()
                    
                    if tables:
                        logger.info(f"Dropping {len(tables)} existing tables with CASCADE...")
                        for table in tables:
                            conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                            conn.commit()
                        logger.info("✓ Tables dropped")
                
                # Now create fresh tables
                logger.info("🏗️  Creating fresh tables...")
                Base.metadata.create_all(bind=engine)
                
                # Verify
                inspector = inspect(engine)
                created_tables = inspector.get_table_names()
                
                print("\n✅ Database initialized successfully (after cleanup)!")
                print(f"Tables created: {len(created_tables)}")
                for table_name in created_tables:
                    print(f"  ✓ {table_name}")
                
                return True
            else:
                # Different error, re-raise
                raise
        
    except Exception as e:
        logger.error(f"❌ Error initializing database: {e}")
        import traceback
        traceback.print_exc()
        return False

def drop_db():
    """
    Drop all database tables.
    WARNING: This will delete all data!
    """
    try:
        logger.info("Dropping all tables...")
        
        # Drop with CASCADE to remove all dependencies
        with engine.connect() as conn:
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            for table in tables:
                conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                conn.commit()
        
        print("✓ Database tables dropped!")
    except Exception as e:
        logger.error(f"Error dropping tables: {e}")
        raise
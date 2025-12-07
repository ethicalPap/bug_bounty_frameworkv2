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

def drop_all_indexes_and_constraints(conn):
    """Drop all indexes and constraints to ensure clean slate"""
    logger.info("🧹 Dropping all indexes and constraints...")
    
    try:
        # Get all indexes except primary key indexes
        result = conn.execute(text("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public' 
            AND indexname NOT LIKE '%_pkey'
        """))
        
        indexes = [row[0] for row in result]
        for index_name in indexes:
            try:
                conn.execute(text(f'DROP INDEX IF EXISTS "{index_name}" CASCADE'))
                logger.debug(f"  Dropped index: {index_name}")
            except Exception as e:
                logger.warning(f"  Could not drop index {index_name}: {e}")
        
        conn.commit()
        logger.info(f"  ✓ Dropped {len(indexes)} indexes")
        
    except Exception as e:
        logger.error(f"Error dropping indexes: {e}")
        conn.rollback()

def drop_all_tables(conn):
    """Drop all tables with CASCADE"""
    logger.info("🗑️  Dropping all tables...")
    
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if tables:
            logger.info(f"  Found {len(tables)} tables to drop")
            for table in tables:
                try:
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
                    logger.debug(f"  Dropped table: {table}")
                except Exception as e:
                    logger.warning(f"  Could not drop table {table}: {e}")
            
            conn.commit()
            logger.info("  ✓ All tables dropped")
        else:
            logger.info("  No tables to drop")
            
    except Exception as e:
        logger.error(f"Error dropping tables: {e}")
        conn.rollback()

def init_db():
    """
    Initialize database tables.
    Handles fresh builds and recovers from inconsistent states automatically.
    Creates all tables defined in models using the shared Base.
    """
    try:
        # Import all models to register them with the shared Base
        logger.info("📦 Importing models...")
        from src.models import Workspace, Subdomain, ContentDiscovery, JSEndpoint, APIParameter, PortScan
        
        logger.info("✓ Models imported successfully")
        
        # Show registered models
        logger.info("📋 Registered models:")
        for table_name in Base.metadata.tables.keys():
            logger.info(f"  • {table_name}")
        
        # Check if tables already exist
        inspector = inspect(engine)
        existing_tables = inspector.get_table_names()
        
        # If tables exist, check for orphaned objects
        if existing_tables:
            logger.info(f"⚠️  Found {len(existing_tables)} existing tables")
            
            # Try to create tables (will fail if there are conflicts)
            logger.info("🏗️  Attempting to create/update tables...")
            try:
                Base.metadata.create_all(bind=engine)
                
                # Verify tables were created/updated
                inspector = inspect(engine)
                created_tables = inspector.get_table_names()
                
                print("\n✅ Database initialized successfully!")
                print(f"Tables ready: {len(created_tables)}")
                for table_name in created_tables:
                    print(f"  ✓ {table_name}")
                
                return True
                
            except Exception as create_error:
                error_str = str(create_error).lower()
                
                # Check if it's a duplicate/orphaned object error
                if any(keyword in error_str for keyword in [
                    'already exists', 
                    'duplicatetable', 
                    'duplicateobject',
                    'relation', 
                    'index'
                ]):
                    logger.warning("⚠️  Found orphaned database objects, performing deep cleanup...")
                    
                    # Perform comprehensive cleanup
                    with engine.connect() as conn:
                        # Drop all indexes first
                        drop_all_indexes_and_constraints(conn)
                        
                        # Drop all tables
                        drop_all_tables(conn)
                        
                        # Verify cleanup
                        inspector = inspect(engine)
                        remaining_tables = inspector.get_table_names()
                        
                        if remaining_tables:
                            logger.error(f"❌ Tables still exist after cleanup: {remaining_tables}")
                            raise Exception("Failed to clean up all tables")
                    
                    # Now create fresh tables
                    logger.info("🏗️  Creating fresh database schema...")
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
        
        else:
            # No existing tables, create fresh
            logger.info("🏗️  Creating fresh database schema...")
            Base.metadata.create_all(bind=engine)
            
            # Verify
            inspector = inspect(engine)
            created_tables = inspector.get_table_names()
            
            print("\n✅ Database initialized successfully!")
            print(f"Tables created: {len(created_tables)}")
            for table_name in created_tables:
                print(f"  ✓ {table_name}")
            
            return True
        
    except Exception as e:
        logger.error(f"❌ Error initializing database: {e}")
        import traceback
        traceback.print_exc()
        return False

def drop_db():
    """
    Drop all database tables and indexes.
    WARNING: This will delete all data!
    """
    try:
        logger.info("Dropping entire database schema...")
        
        with engine.connect() as conn:
            # Drop all indexes first
            drop_all_indexes_and_constraints(conn)
            
            # Drop all tables
            drop_all_tables(conn)
        
        print("✓ Database schema dropped completely!")
        
    except Exception as e:
        logger.error(f"Error dropping database: {e}")
        raise

def reset_db():
    """
    Complete database reset: drop everything and recreate.
    WARNING: This will delete all data!
    """
    logger.info("=" * 70)
    logger.info("DATABASE RESET")
    logger.info("=" * 70)
    
    try:
        # Drop everything
        drop_db()
        
        # Recreate
        init_db()
        
        logger.info("=" * 70)
        logger.info("DATABASE RESET COMPLETE!")
        logger.info("=" * 70)
        
    except Exception as e:
        logger.error(f"Database reset failed: {e}")
        raise
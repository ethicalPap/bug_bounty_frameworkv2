#!/usr/bin/env python3
"""
Database Initialization Script
Run this to create all database tables
"""

import sys
import os

# Add parent directory to path so we can import from src
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config.database import init_db, Base, engine

def main():
    """Initialize the database tables"""
    print("=" * 70)
    print("DATABASE INITIALIZATION")
    print("=" * 70)
    print()
    
    try:
        # Import all models to ensure they're registered
        print("Importing models...")
        from src.models import (
            Subdomain, 
            ContentDiscovery, 
            JSEndpoint, 
            APIParameter,
            PortScan,
            VulnScan,
            VulnFinding,
            Workspace
        )
        print("All models imported successfully")
        print()
        
        # Show which models are registered
        print("Registered models:")
        for table_name in Base.metadata.tables.keys():
            print(f"  • {table_name}")
        print()
        
        # Create all tables
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully!")
        print()
        
        # Verify tables were created
        print("Verification:")
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        for table in tables:
            print(f"  {table}")
        
        print()
        print("=" * 70)
        print("DATABASE INITIALIZATION COMPLETE!")
        print("=" * 70)
        print()
        print("You can now start using the application.")
        print()
        
    except Exception as e:
        print()
        print("ERROR: Database initialization failed!")
        print(f"   {str(e)}")
        print()
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
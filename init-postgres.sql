-- init-postgres.sql
-- This script runs when the PostgreSQL container starts for the first time

-- Create the application database if it doesn't exist
SELECT 'CREATE DATABASE framework'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'framework')\gexec

-- Connect to the framework database
\c framework;

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a function to generate random UUIDs (alternative to uuid-ossp)
CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS $$
BEGIN
  RETURN uuid_generate_v4();
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE framework TO papv2;
GRANT ALL ON SCHEMA public TO papv2;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO papv2;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO papv2;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO papv2;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO papv2;

-- Log the completion
\echo 'PostgreSQL initialization completed successfully!'
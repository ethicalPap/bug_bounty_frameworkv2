#!/bin/bash

# backend/start.sh
# Simplified startup script for the backend service

set -e

echo "🚀 Starting Bug Bounty Framework Backend..."

# Environment variables with defaults
NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-3001}
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-framework}
DB_USER=${DB_USER:-papv2}
DB_PASSWORD=${DB_PASSWORD:-password}
MAX_RETRIES=${MAX_RETRIES:-30}
RETRY_INTERVAL=${RETRY_INTERVAL:-2}

echo "📊 Environment: $NODE_ENV"
echo "🔌 Port: $PORT"
echo "🗄️  Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

# Function to wait for PostgreSQL
wait_for_postgres() {
    echo "⏳ Waiting for PostgreSQL to be ready..."
    
    for i in $(seq 1 $MAX_RETRIES); do
        # Use node to test connection instead of pg_isready
        if node -e "
            const { Client } = require('pg');
            const client = new Client({
                host: '$DB_HOST',
                port: $DB_PORT,
                user: '$DB_USER',
                password: '$DB_PASSWORD',
                database: '$DB_NAME'
            });
            client.connect()
                .then(() => { console.log('Connected'); client.end(); process.exit(0); })
                .catch(() => process.exit(1));
        " 2>/dev/null; then
            echo "✅ PostgreSQL is ready!"
            return 0
        fi
        
        echo "⏳ Attempt $i/$MAX_RETRIES: PostgreSQL not ready yet, waiting ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    echo "❌ PostgreSQL failed to become ready after $MAX_RETRIES attempts"
    exit 1
}

# Function to run database migrations
run_migrations() {
    echo "🗄️  Running database migrations..."
    
    # Use npx to run migrations (no global installation needed)
    echo "📋 Running migrations with npx..."
    if npx knex migrate:latest --knexfile knexfile.js; then
        echo "✅ Migrations completed successfully"
    else
        echo "⚠️  Migration failed, attempting to continue..."
        echo "🔧 Trying to create database schema manually..."
        
        # If migrations fail, try to run the init script
        if [ -f "/app/scripts/init-db.js" ]; then
            node /app/scripts/init-db.js
        fi
    fi
    
    # Run seeds if requested
    if [ "$RUN_SEEDS" = "true" ]; then
        echo "🌱 Running database seeds..."
        npx knex seed:run --knexfile knexfile.js || echo "⚠️  Seeds failed, continuing..."
    fi
}

# Function to setup tools directory
setup_tools() {
    echo "🔧 Setting up tools directory..."
    
    # Create tools directory structure
    mkdir -p /app/tools/wordlists
    mkdir -p /app/tools/config
    mkdir -p /app/scan_data
    
    # Ensure wordlists exist
    if [ ! -f "/app/tools/wordlists/common.txt" ]; then
        echo "📝 Creating default wordlist..."
        cat > /app/tools/wordlists/common.txt << 'EOF'
admin
api
www
mail
ftp
test
blog
shop
dev
staging
app
cdn
images
static
login
dashboard
config
backup
upload
download
files
docs
help
support
contact
about
services
products
news
events
career
jobs
search
feed
rss
xml
json
v1
v2
rest
graphql
webapp
mobile
testing
stage
prod
beta
alpha
demo
sandbox
tmp
temp
cache
backups
logs
monitoring
metrics
health
status
ping
version
info
EOF
    fi
    
    echo "✅ Tools directory setup complete"
}

# Function to check tool availability
check_tools() {
    echo "🔍 Checking security tool availability..."
    
    TOOLS_AVAILABLE=0
    
    # Check subfinder
    if command -v subfinder &> /dev/null; then
        echo "✅ subfinder: Available"
        TOOLS_AVAILABLE=$((TOOLS_AVAILABLE + 1))
    else
        echo "⚠️  subfinder: Not available"
    fi
    
    # Check nmap
    if command -v nmap &> /dev/null; then
        echo "✅ nmap: Available"
        TOOLS_AVAILABLE=$((TOOLS_AVAILABLE + 1))
    else
        echo "⚠️  nmap: Not available"
    fi
    
    # Check httpx
    if command -v httpx &> /dev/null; then
        echo "✅ httpx: Available"
        TOOLS_AVAILABLE=$((TOOLS_AVAILABLE + 1))
    else
        echo "⚠️  httpx: Not available"
    fi
    
    # Check ffuf
    if command -v ffuf &> /dev/null; then
        echo "✅ ffuf: Available"
        TOOLS_AVAILABLE=$((TOOLS_AVAILABLE + 1))
    else
        echo "⚠️  ffuf: Not available"
    fi
    
    echo "📊 Available tools: $TOOLS_AVAILABLE/4"
    
    if [ $TOOLS_AVAILABLE -eq 0 ]; then
        echo "⚠️  No security tools available - scans will use basic functionality"
    fi
}

# Main execution
main() {
    echo "🎯 Starting initialization sequence..."
    
    # Wait for dependencies
    wait_for_postgres
    
    # Setup application
    setup_tools
    run_migrations
    check_tools
    
    echo "🎉 Initialization complete!"
    echo "🚀 Starting Node.js application..."
    
    # Start the application with proper error handling
    exec node src/app.js
}

# Handle signals for graceful shutdown
trap 'echo "🛑 Received shutdown signal, stopping..."; exit 0' SIGTERM SIGINT

# Run main function
main "$@"
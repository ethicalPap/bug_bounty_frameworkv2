#!/bin/bash

# Subdomain Scanner - Setup Script
# This script copies all fixed files to the correct locations in your project

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Subdomain Scanner - Automated Setup                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend/ directory not found!"
    echo "Please run this script from your project root directory."
    exit 1
fi

echo "📁 Project structure detected!"
echo ""

# Create necessary directories
echo "📂 Creating required directories..."
mkdir -p backend/src/config
mkdir -p backend/src/models
mkdir -p backend/src/controllers
mkdir -p output
mkdir -p logs

# Backup existing files if they exist
echo "💾 Backing up existing files..."
[ -f "backend/requirements.txt" ] && cp backend/requirements.txt backend/requirements.txt.bak
[ -f "backend/src/config/database.py" ] && cp backend/src/config/database.py backend/src/config/database.py.bak
[ -f "backend/src/main.py" ] && cp backend/src/main.py backend/src/main.py.bak
[ -f "docker-compose.yml" ] && cp docker-compose.yml docker-compose.yml.bak

# Copy fixed files
echo "📝 Copying fixed files..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Copy files from the same directory as this script
cp "$SCRIPT_DIR/requirements.txt" backend/requirements.txt
echo "  ✓ requirements.txt"

cp "$SCRIPT_DIR/database.py" backend/src/config/database.py
echo "  ✓ database.py"

cp "$SCRIPT_DIR/main.py" backend/src/main.py
echo "  ✓ main.py"

cp "$SCRIPT_DIR/docker-compose.yml" docker-compose.yml
echo "  ✓ docker-compose.yml"

cp "$SCRIPT_DIR/__init__.py" backend/src/__init__.py
echo "  ✓ __init__.py"

echo ""
echo "✅ All files copied successfully!"
echo ""

# Clean up Docker
echo "🧹 Cleaning up Docker containers and images..."
docker-compose down -v 2>/dev/null || true
echo "  ✓ Containers stopped and removed"

# Rebuild
echo ""
echo "🏗️  Rebuilding Docker images..."
echo "This may take several minutes..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

# Check service status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                 Setup Complete! ✨                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Access your services:"
echo "  • API:        http://localhost:8000"
echo "  • API Docs:   http://localhost:8000/docs"
echo "  • Health:     http://localhost:8000/health"
echo "  • pgAdmin:    http://localhost:5050"
echo "              Login: admin@example.com / admin"
echo "  • Flower:     http://localhost:5555"
echo ""
echo "📖 Check DEPLOYMENT_GUIDE.md for more information"
echo ""
echo "🔍 View logs:"
echo "  docker-compose logs -f app"
echo ""
echo "🧪 Test the API:"
echo "  curl http://localhost:8000/health"
echo ""

# Test health endpoint
echo "Testing API health endpoint..."
sleep 5
if curl -f http://localhost:8000/health 2>/dev/null; then
    echo ""
    echo "✅ API is responding correctly!"
else
    echo ""
    echo "⚠️  API might still be starting. Check logs with:"
    echo "  docker-compose logs -f app"
fi

echo ""
echo "Happy scanning! 🎯"
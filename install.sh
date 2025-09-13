#!/bin/bash

# Security scanning tools installation script
# Run this script to install required tools for the security framework

set -e

echo "🔧 Installing security scanning tools..."

# Update package manager
if command -v apt-get &> /dev/null; then
    echo "📦 Updating apt packages..."
    sudo apt-get update
    PACKAGE_MANAGER="apt"
elif command -v yum &> /dev/null; then
    echo "📦 Updating yum packages..."
    sudo yum update -y
    PACKAGE_MANAGER="yum"
elif command -v brew &> /dev/null; then
    echo "📦 Updating homebrew..."
    brew update
    PACKAGE_MANAGER="brew"
else
    echo "❌ No supported package manager found (apt/yum/brew)"
    exit 1
fi

# Install basic dependencies
echo "📋 Installing basic dependencies..."
case $PACKAGE_MANAGER in
    "apt")
        sudo apt-get install -y curl wget git unzip python3 python3-pip golang-go
        ;;
    "yum")
        sudo yum install -y curl wget git unzip python3 python3-pip golang
        ;;
    "brew")
        brew install curl wget git unzip python3 go
        ;;
esac

# Create tools directory
TOOLS_DIR="$(pwd)/backend/tools"
mkdir -p "$TOOLS_DIR"
mkdir -p "$TOOLS_DIR/wordlists"

echo "📂 Tools directory: $TOOLS_DIR"

# Install Go tools
echo "🔧 Installing Go-based security tools..."

# Subfinder
echo "Installing subfinder..."
go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# FFUF
echo "Installing ffuf..."
go install github.com/ffuf/ffuf@latest

# Add Go bin to PATH if not already there
export PATH=$PATH:$(go env GOPATH)/bin
echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc

# Install nmap
echo "🗺️  Installing nmap..."
case $PACKAGE_MANAGER in
    "apt")
        sudo apt-get install -y nmap
        ;;
    "yum")
        sudo yum install -y nmap
        ;;
    "brew")
        brew install nmap
        ;;
esac

# Install amass (optional)
echo "🔍 Installing amass..."
if [ "$PACKAGE_MANAGER" = "apt" ]; then
    # Download latest amass release
    AMASS_VERSION=$(curl -s https://api.github.com/repos/OWASP/Amass/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    wget -q "https://github.com/OWASP/Amass/releases/download/$AMASS_VERSION/amass_linux_amd64.zip" -O /tmp/amass.zip
    unzip -q /tmp/amass.zip -d /tmp/
    sudo mv /tmp/amass_linux_amd64/amass /usr/local/bin/
    rm -rf /tmp/amass*
elif [ "$PACKAGE_MANAGER" = "brew" ]; then
    brew install amass
else
    echo "⚠️  Manual installation required for amass on this system"
fi

# Download common wordlists
echo "📝 Downloading wordlists..."
cd "$TOOLS_DIR/wordlists"

# SecLists common.txt
if [ ! -f "common.txt" ]; then
    echo "Downloading common.txt wordlist..."
    wget -q "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt"
fi

# Directory wordlist
if [ ! -f "directory-list-2.3-medium.txt" ]; then
    echo "Downloading directory-list wordlist..."
    wget -q "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/directory-list-2.3-medium.txt"
fi

# Create a simple config directory
mkdir -p "$TOOLS_DIR/config"

# Create subfinder config
cat > "$TOOLS_DIR/config/subfinder.yaml" << EOF
# Subfinder configuration
resolvers:
  - 8.8.8.8
  - 8.8.4.4
  - 1.1.1.1
  - 1.0.0.1

# Add your API keys here for better results
# virustotal: []
# shodan: []
# censys: []
EOF

echo "✅ Installation complete!"
echo ""
echo "📋 Installed tools:"
echo "  - subfinder (subdomain enumeration)"
echo "  - ffuf (content discovery)"
echo "  - nmap (port scanning)"
echo "  - amass (subdomain enumeration - optional)"
echo ""
echo "📁 Wordlists location: $TOOLS_DIR/wordlists"
echo "⚙️  Config location: $TOOLS_DIR/config"
echo ""
echo "🔄 Please restart your terminal or run: source ~/.bashrc"
echo ""
echo "🧪 Test installation:"
echo "  subfinder -version"
echo "  ffuf -V"
echo "  nmap --version"
echo ""
echo "💡 Tip: Add API keys to $TOOLS_DIR/config/subfinder.yaml for better subdomain enumeration results"
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    build-essential \
    golang-go \
    chromium \
    chromium-driver \
    nmap \
    && rm -rf /var/lib/apt/lists/*

# Set up Go environment
ENV GOPATH=/go
ENV PATH=$GOPATH/bin:$PATH
RUN mkdir -p $GOPATH/bin

# ==================== SUBDOMAIN ENUMERATION TOOLS ====================

# Install Subfinder
RUN go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest

# Install Amass
RUN go install -v github.com/owasp-amass/amass/v3/...@master

# Install Assetfinder
RUN go install github.com/tomnomnom/assetfinder@latest

# Install Findomain
RUN wget https://github.com/Findomain/Findomain/releases/latest/download/findomain-linux.zip \
    && unzip findomain-linux.zip \
    && chmod +x findomain \
    && mv findomain /usr/local/bin/ \
    && rm findomain-linux.zip

# Install Sublist3r
RUN git clone https://github.com/aboul3la/Sublist3r.git /opt/Sublist3r \
    && cd /opt/Sublist3r \
    && pip install -r requirements.txt \
    && chmod +x sublist3r.py \
    && ln -s /opt/Sublist3r/sublist3r.py /usr/local/bin/sublist3r

# Install Chaos Client
RUN go install -v github.com/projectdiscovery/chaos-client/cmd/chaos@latest

# Install httpx for HTTP probing
RUN go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# Install nuclei for vulnerability scanning
RUN go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest

# Install dnsx for DNS enumeration
RUN go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest

# ==================== PORT SCANNING TOOLS ====================

# Nmap is already installed from system dependencies above

# Install masscan
RUN git clone https://github.com/robertdavidgraham/masscan /opt/masscan \
    && cd /opt/masscan \
    && make \
    && make install \
    && cd / \
    && rm -rf /opt/masscan

# Install naabu - optional, will continue if it fails
# Try v2 first, then fallback to older versions
RUN go install -v github.com/projectdiscovery/naabu/v2/cmd/naabu@v2.1.8 || \
    echo "Naabu installation skipped - nmap and masscan are available"

# ==================== CONTENT DISCOVERY TOOLS ====================

# Active Fuzzing Tools
# Install ffuf
RUN go install github.com/ffuf/ffuf/v2@latest

# Install feroxbuster
RUN wget https://github.com/epi052/feroxbuster/releases/latest/download/x86_64-linux-feroxbuster.zip \
    && unzip x86_64-linux-feroxbuster.zip \
    && chmod +x feroxbuster \
    && mv feroxbuster /usr/local/bin/ \
    && rm x86_64-linux-feroxbuster.zip

# Passive/Archive Discovery Tools
# Install waymore
RUN pip install waymore

# Install gau (getallurls)
RUN go install github.com/lc/gau/v2/cmd/gau@latest

# Crawling & Spidering Tools
# Install katana
RUN go install github.com/projectdiscovery/katana/cmd/katana@latest

# Install gospider
RUN go install github.com/jaeles-project/gospider@latest

# JavaScript Analysis Tools
# Install LinkFinder
RUN git clone https://github.com/GerbenJavado/LinkFinder.git /opt/LinkFinder \
    && cd /opt/LinkFinder \
    && pip install -r requirements.txt \
    && chmod +x linkfinder.py

# API Discovery Tools
# Install Arjun
RUN pip install arjun

# Install kiterunner (optional - very large)
# RUN wget https://github.com/assetnote/kiterunner/releases/latest/download/kiterunner_linux_amd64.tar.gz \
#     && tar -xzf kiterunner_linux_amd64.tar.gz \
#     && mv kr /usr/local/bin/ \
#     && rm kiterunner_linux_amd64.tar.gz

# Specialized Discovery Tools
# Install unfurl
RUN go install github.com/tomnomnom/unfurl@latest

# Install uro
RUN pip install uro

# Install anew (for deduplication)
RUN go install github.com/tomnomnom/anew@latest

# Install qsreplace (for parameter manipulation)
RUN go install github.com/tomnomnom/qsreplace@latest

# Copy Go binaries to system PATH
RUN cp $GOPATH/bin/* /usr/local/bin/ 2>/dev/null || true

# ==================== WORDLISTS ====================

# Create wordlists directory
RUN mkdir -p /opt/wordlists

# Download SecLists (comprehensive wordlist collection)
RUN git clone --depth 1 https://github.com/danielmiessler/SecLists.git /opt/SecLists \
    && ln -s /opt/SecLists/Discovery/Web-Content/common.txt /opt/wordlists/common.txt \
    && ln -s /opt/SecLists/Discovery/Web-Content/directory-list-2.3-medium.txt /opt/wordlists/medium.txt \
    && ln -s /opt/SecLists/Discovery/Web-Content/big.txt /opt/wordlists/big.txt \
    && ln -s /opt/SecLists/Discovery/Web-Content/raft-large-files.txt /opt/wordlists/files.txt \
    && ln -s /opt/SecLists/Discovery/Web-Content/raft-large-directories.txt /opt/wordlists/directories.txt

# Download Assetnote wordlists (high quality, targeted)
RUN mkdir -p /opt/assetnote-wordlists \
    && cd /opt/assetnote-wordlists \
    && wget https://wordlists-cdn.assetnote.io/data/manual/best-dns-wordlist.txt \
    && wget https://wordlists-cdn.assetnote.io/data/manual/2m-subdomains.txt \
    && ln -s /opt/assetnote-wordlists/best-dns-wordlist.txt /opt/wordlists/dns-best.txt

# ==================== NUCLEI TEMPLATES ====================

# Update nuclei templates
RUN nuclei -update-templates

# ==================== PYTHON DEPENDENCIES ====================

# Copy Python requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# ==================== APPLICATION SETUP ====================

# Copy application code
COPY src/ ./src/

# Create directories for output and logs
RUN mkdir -p /app/output /app/logs /tmp

# Set environment variables
ENV PYTHONPATH=/app
ENV DATABASE_URL=postgresql://postgres:password@db:5432/subdomain_scanner

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
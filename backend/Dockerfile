# backend/Dockerfile - Updated to Node.js 20
FROM node:20-alpine

# Install system dependencies including PostgreSQL client
RUN apk update && apk add --no-cache \
    wget \
    unzip \
    curl \
    bash \
    postgresql-client \
    redis \
    nmap \
    nmap-scripts \
    git \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Install knex globally as root before switching users
RUN npm install -g knex

# Create tools and data directories
RUN mkdir -p /app/tools/wordlists /app/tools/config /app/scan_data

# Install security tools with error handling
RUN set -e && \
    # Install Go for Go-based tools
    echo "Installing Go..." && \
    wget -q https://dl.google.com/go/go1.21.4.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.21.4.linux-amd64.tar.gz && \
    rm go1.21.4.linux-amd64.tar.gz && \
    export PATH=$PATH:/usr/local/go/bin && \
    \
    # Install subfinder
    echo "Installing subfinder..." && \
    (/usr/local/go/bin/go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest && \
    mv /root/go/bin/subfinder /usr/local/bin/ || echo "Subfinder installation failed") && \
    \
    # Install httpx
    echo "Installing httpx..." && \
    (/usr/local/go/bin/go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest && \
    mv /root/go/bin/httpx /usr/local/bin/ || echo "httpx installation failed") && \
    \
    # Install ffuf
    echo "Installing ffuf..." && \
    (/usr/local/go/bin/go install github.com/ffuf/ffuf@latest && \
    mv /root/go/bin/ffuf /usr/local/bin/ || echo "ffuf installation failed") && \
    \
    # Clean up Go installation
    rm -rf /usr/local/go /root/go

# Download wordlists with fallback
RUN (wget -q -O /app/tools/wordlists/common.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt) || \
    echo -e "admin\napi\nwww\nmail\nftp\ntest\nblog\nshop\ndev\nstaging\napp\ncdn\nimages\nstatic\nlogin\ndashboard\nconfig\nbackup\nupload\ndownload\nfiles\ndocs\nhelp\nsupport\ncontact\nabout\nservices\nproducts\nnews\nevents\ncareer\njobs\nsearch\nfeed\nrss\nxml\njson\napi\nv1\nv2\nrest\ngraphql\nwebapp\nmobile\ntesting\nstage\nprod\nbeta\nalpha\ndemo\nsandbox\ntmp\ntemp\ncache\nbackups\nlogs\nmonitoring\nmetrics\nhealth\nstatus\nping\nversion\ninfo" > /app/tools/wordlists/common.txt

# Copy application code
COPY . .

# Copy and make startup script executable
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node /tmp/health_check.js || exit 1

# Use startup script
CMD ["/app/start.sh"]
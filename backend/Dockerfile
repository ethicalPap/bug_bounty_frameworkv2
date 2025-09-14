# backend/Dockerfile.prod
FROM node:18-alpine

# Install system dependencies
RUN apk update && apk add --no-cache \
    wget \
    unzip \
    nmap \
    nmap-scripts \
    git \
    curl \
    bash \
    ca-certificates

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Create tools directory
RUN mkdir -p /tmp/tools /app/tools/wordlists

# Install security tools with error handling
RUN set -e && \
    # Install subfinder
    echo "Installing subfinder..." && \
    wget -q -O /tmp/tools/subfinder.zip https://github.com/projectdiscovery/subfinder/releases/download/v2.6.3/subfinder_2.6.3_linux_amd64.zip && \
    cd /tmp/tools && unzip -o subfinder.zip && \
    mv subfinder /usr/local/bin/ && \
    chmod +x /usr/local/bin/subfinder && \
    \
    # Install amass
    echo "Installing amass..." && \
    wget -q -O /tmp/tools/amass.zip https://github.com/owasp-amass/amass/releases/download/v4.2.0/amass_Linux_amd64.zip && \
    unzip -o amass.zip && \
    mv amass_Linux_amd64/amass /usr/local/bin/ && \
    chmod +x /usr/local/bin/amass && \
    \
    # Install httpx
    echo "Installing httpx..." && \
    wget -q -O /tmp/tools/httpx.zip https://github.com/projectdiscovery/httpx/releases/download/v1.3.7/httpx_1.3.7_linux_amd64.zip && \
    unzip -o httpx.zip && \
    mv httpx /usr/local/bin/ && \
    chmod +x /usr/local/bin/httpx && \
    \
    # Clean up
    rm -rf /tmp/tools

# Download wordlists
RUN wget -q -O /app/tools/wordlists/common.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt || \
    echo "# Fallback wordlist" > /app/tools/wordlists/common.txt

# Install ffuf using Go (more reliable)
RUN apk add --no-cache go && \
    GOPATH=/tmp/go go install github.com/ffuf/ffuf/v2@latest && \
    mv /tmp/go/bin/ffuf /usr/local/bin/ && \
    chmod +x /usr/local/bin/ffuf && \
    apk del go && \
    rm -rf /tmp/go

# Verify installations
RUN echo "Verifying tool installations..." && \
    subfinder -version && \
    amass version && \
    httpx -version && \
    ffuf -version && \
    nmap --version && \
    echo "All tools installed successfully!"

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "start"]
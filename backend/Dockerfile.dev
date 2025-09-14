# backend/Dockerfile.prod
FROM node:18-alpine

# Install system dependencies and security tools
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

# Install security tools
RUN mkdir -p /tmp/tools

# Install subfinder
RUN wget -O /tmp/tools/subfinder.zip https://github.com/projectdiscovery/subfinder/releases/download/v2.6.3/subfinder_2.6.3_linux_amd64.zip && \
    cd /tmp/tools && unzip subfinder.zip && \
    mv subfinder /usr/local/bin/ && \
    chmod +x /usr/local/bin/subfinder

# Install amass
RUN wget -O /tmp/tools/amass.zip https://github.com/owasp-amass/amass/releases/download/v4.2.0/amass_Linux_amd64.zip && \
    cd /tmp/tools && unzip amass.zip && \
    mv amass_Linux_amd64/amass /usr/local/bin/ && \
    chmod +x /usr/local/bin/amass

# Install ffuf
RUN wget -O /tmp/tools/ffuf.tgz https://github.com/ffuf/ffuf/releases/download/v2.0.4/ffuf_2.0.4_linux_amd64.tar.gz && \
    cd /tmp/tools && tar -xzf ffuf.tgz && \
    mv ffuf /usr/local/bin/ && \
    chmod +x /usr/local/bin/ffuf

# Install httpx
RUN wget -O /tmp/tools/httpx.zip https://github.com/projectdiscovery/httpx/releases/download/v1.3.7/httpx_1.3.7_linux_amd64.zip && \
    cd /tmp/tools && unzip httpx.zip && \
    mv httpx /usr/local/bin/ && \
    chmod +x /usr/local/bin/httpx

# Create tools directory and download wordlists
RUN mkdir -p /app/tools/wordlists
RUN wget -O /app/tools/wordlists/common.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/common.txt
RUN wget -O /app/tools/wordlists/big.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/big.txt
RUN wget -O /app/tools/wordlists/directory-list-2.3-medium.txt https://raw.githubusercontent.com/danielmiessler/SecLists/master/Discovery/Web-Content/directory-list-2.3-medium.txt

# Clean up
RUN rm -rf /tmp/tools

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
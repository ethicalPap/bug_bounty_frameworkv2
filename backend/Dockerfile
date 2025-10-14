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
    && rm -rf /var/lib/apt/lists/*

# Set up Go environment
ENV GOPATH=/go
ENV PATH=$GOPATH/bin:$PATH
RUN mkdir -p $GOPATH/bin

# Install subdomain enumeration tools
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

# Copy Go binaries to system PATH
RUN cp $GOPATH/bin/* /usr/local/bin/ 2>/dev/null || true

# Copy Python requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Create directories for output and logs
RUN mkdir -p /app/output /app/logs

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
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install for development)
RUN npm install --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S papv2 -u 1001

# Change ownership
RUN chown -R papv2:nodejs /app
USER papv2

EXPOSE 3001

CMD ["npm", "start"]
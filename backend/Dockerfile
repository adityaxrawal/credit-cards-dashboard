# ============================================
# Multi-stage Dockerfile for Credit Card Backend
# Optimized for single package.json structure
# ============================================

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy TypeScript configuration
COPY tsconfig.base.json ./
COPY services/api-gateway/tsconfig.json ./services/api-gateway/
COPY services/shared/tsconfig.json ./services/shared/

# Copy source code for both api-gateway and shared
COPY services/api-gateway/src ./services/api-gateway/src
COPY services/shared ./services/shared

# Build TypeScript (both shared and api-gateway)
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /app/services/shared/dist ./services/shared/dist

# Copy environment file template (actual .env should be provided at runtime)
# COPY services/api-gateway/.env.example ./services/api-gateway/.env

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "services/api-gateway/dist/index.js"]

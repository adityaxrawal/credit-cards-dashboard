# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (optimize cache)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build


# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files again
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built artifacts from builder stage (chown during copy to avoid double layers)
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Set file permissions for the nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]

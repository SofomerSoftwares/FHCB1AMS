# ==============================================================================
# Multi-stage Dockerfile for Local Deployment
# FHC Branch One Physical Archive & Document Tracking System
# ==============================================================================

# --- Stage 1: Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build tools
COPY . .

# Build Vite client SPA and bundle Express server.ts into dist/server.js
RUN npm run build

# --- Stage 2: Production Runtime Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=3000

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled production artifacts from builder
COPY --from=builder /app/dist ./dist

# Create persistent data directory for archive storage
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user for container security
USER node

# Expose default application port
EXPOSE 3000

# Healthcheck to monitor app health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the full-stack application
CMD ["npm", "start"]

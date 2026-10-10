# ==============================================================================
# Pantone Fixed Asset Management System - Production Backend Dockerfile
# Multi-stage build for minimal image size and secure non-root execution
# Build context: repository root
# ==============================================================================

# Stage 1: Build & Compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies using backend package manifests
COPY backend/package*.json ./
RUN npm ci

# Copy TypeScript configuration and application source from backend
COPY backend/tsconfig.json ./
COPY backend/src/ ./src/

# Compile TypeScript and bundle migration SQL files into dist/src/database/migrations
RUN npm run build

# Remove development dependencies for a minimal runtime image
RUN npm prune --production

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV STORAGE_PATH=/var/data/pantone/uploads

# Security: Create non-root user and group
RUN addgroup -S pantone && adduser -S pantone -G pantone

# Create persistent storage directory with proper permissions
RUN mkdir -p /var/data/pantone/uploads && chown -R pantone:pantone /var/data/pantone

# Copy production dependencies, compiled code, and runtime assets from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/migrations ./src/database/migrations

# Switch to unprivileged user
USER pantone

# Expose internal port and Render default port
EXPOSE 5000 10000

# Healthcheck probe using internal endpoint and dynamically assigned port
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:${PORT:-5000}/health || exit 1

CMD ["node", "dist/src/server.js"]

# ==============================================================================
# Pantone Fixed Asset Management System - Production Backend Dockerfile
# Multi-stage build for minimal image size and secure non-root execution
# ==============================================================================

# Stage 1: Build & Compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV STORAGE_PATH=/var/data/pantone/uploads

# Security: Create non-root user
RUN addgroup -S pantone && adduser -S pantone -G pantone

# Create persistent storage directory
RUN mkdir -p /var/data/pantone/uploads && chown -R pantone:pantone /var/data/pantone

# Copy compiled code and production node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Switch to unprivileged user
USER pantone

EXPOSE 5000

# Healthcheck probe using internal endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:5000/health/ready || exit 1

CMD ["node", "dist/src/server.js"]

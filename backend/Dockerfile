# ── Build stage ────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first (layer caching — only re-installs on package.json change)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Production stage ──────────────────────────────────────────────
FROM node:22-alpine

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy deps from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

# Switch to non-root user
USER appuser

# Health check (Docker-level, independent of Nginx)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3001}/health/live || exit 1

EXPOSE ${PORT:-3001}

CMD ["node", "src/server.js"]

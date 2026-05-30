# ── Stage 1: Build Frontend ──────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend packages for dependency caching
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source and build it
COPY frontend/ ./

# Accept build-time tokens from Render's "Build & Deploy > Environment" settings
ARG VITE_MAPBOX_TOKEN
ARG VITE_API_BASE
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

# ── Stage 2: Build Backend Dependencies ──────────────────────────────
FROM node:22-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend packages for dependency caching
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ── Stage 3: Runtime Environment ─────────────────────────────────────
FROM node:22-alpine

# Install required runtime packages (ca-certificates and wget for health checks)
RUN apk add --no-cache ca-certificates wget

# Security: Create a dedicated non-root application user/group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy built frontend assets to the expected location
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend node_modules and code
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/
COPY backend/src ./backend/src

# Set permission to non-root user for security
RUN chown -R appuser:appgroup /app

# Switch to the non-root user
USER appuser

# Work directory should be the backend for starting the server
WORKDIR /app/backend

# Default port configuration for Render
ENV PORT=10000
ENV NODE_ENV=production
EXPOSE 10000

# Health check using wget on the health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health/live || exit 1

# Start the server
CMD ["node", "src/server.js"]

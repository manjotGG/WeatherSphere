/**
 * WeatherSphere API Server — Express entry point.
 *
 * Wires together:
 *   - Security middleware (Helmet, CORS)
 *   - Request logging + request ID tracking
 *   - Global rate limiter (100 req/min per IP)
 *   - Prometheus metrics collection
 *   - API routes (weather, geocode, health)
 *   - Graceful shutdown (closes Redis, drains connections)
 *
 * The server is designed to run as multiple instances behind Nginx.
 * State is shared via Redis; the server itself is stateless.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import config from './config/index.js';
import logger from './utils/logger.js';

// Middleware
import { securityMiddleware } from './middleware/securityHeaders.js';
import { requestLogger } from './middleware/requestLogger.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { metricsMiddleware, getMetrics } from './utils/metrics.js';

// Routes
import weatherRoutes from './routes/weather.js';
import geocodeRoutes from './routes/geocode.js';
import healthRoutes from './routes/health.js';

// Services
import { getRedisClient, closeRedis } from './services/redisClient.js';

// ── Initialize ──────────────────────────────────────────────────────

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust the first proxy (Nginx) — required for correct req.ip behind LB
app.set('trust proxy', 1);

// ── Middleware Stack (order matters) ────────────────────────────────

// 1. Security headers + CORS
app.use(securityMiddleware());

// 2. Body parsing with size limit
app.use(express.json({ limit: config.maxBodySize }));

// 3. Request logging + ID tracking
app.use(requestLogger());

// 4. Prometheus metrics collection
app.use(metricsMiddleware());

// 5. Global rate limiter (broad — catches bots + scrapers)
app.use('/api', globalLimiter);

// ── Routes ──────────────────────────────────────────────────────────

// Health checks (no rate limiting — Nginx needs these)
app.use('/health', healthRoutes);

// Prometheus metrics endpoint
app.get('/metrics', getMetrics);

// API config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    mapboxToken: config.mapbox.token
  });
});

// API routes (each has its own rate limiter + circuit breaker)
app.use('/api/weather', weatherRoutes);
app.use('/api/geocode', geocodeRoutes);

// ── Serve React frontend (production) ────────────────────────────────
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');

// Serve Vite-built static assets (JS, CSS, images, etc.)
app.use(express.static(frontendDist));

// For React Router: any unmatched route returns index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── 404 handler ─────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No route matches ${req.method} ${req.path}`,
  });
});

// ── Global error handler ────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error({ err, requestId: req.requestId }, 'Unhandled error');
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.env === 'production' ? 'An unexpected error occurred' : err.message,
  });
});

// ── Start Server ────────────────────────────────────────────────────

// Initialize Redis connection (non-blocking — app starts even if Redis is down)
if (config.redis.url) {
  try {
    getRedisClient();
  } catch (err) {
    logger.warn({ err }, 'Redis initialization failed — running in degraded mode');
  }
} else {
  logger.info('Redis not configured — running in degraded mode');
}

const server = app.listen(config.port, () => {
  logger.info({
    port: config.port,
    env: config.env,
    pid: process.pid,
  }, `WeatherSphere API listening on port ${config.port}`);
});

// ── Request timeout ───────────────────────────────────────────────
server.timeout = config.requestTimeoutMs;
server.keepAliveTimeout = 65_000; // > Nginx's keepalive timeout (60s)
server.headersTimeout = 66_000;   // > keepAliveTimeout

// ── Graceful Shutdown ─────────────────────────────────────────────
// Handles SIGTERM (Docker stop) and SIGINT (Ctrl+C).
// Drains existing connections, closes Redis, then exits.

async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received — draining connections...');

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await closeRedis();
    } catch (err) {
      logger.error({ err }, 'Error closing Redis during shutdown');
    }

    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Force exit after 10s if connections don't drain
  setTimeout(() => {
    logger.warn('Forced shutdown — connections did not drain in time');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled rejections (log but don't crash — let health checks handle it)
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

export default app;

/**
 * Environment-based configuration.
 *
 * All secrets and tunables come from environment variables.
 * Defaults are set for development; production overrides via env.
 *
 * Pattern: single source of truth for every configurable value.
 * Components import `config` instead of reading `process.env` directly.
 */

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  port: parseInt(process.env.PORT || '3001', 10),

  // ── CORS ────────────────────────────────────────────────────────
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:4173'],

  // ── Redis ───────────────────────────────────────────────────────
  redis: {
    url: process.env.REDIS_URL || (env === 'production' ? undefined : 'redis://localhost:6379'),
    // Prefix all keys to avoid collisions if Redis is shared
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'ws:',
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // ── Upstream API keys (server-side only — NEVER expose to client) ──
  openweather: {
    apiKey: process.env.OPENWEATHER_API_KEY || '',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    timeoutMs: parseInt(process.env.UPSTREAM_TIMEOUT_MS || '8000', 10),
  },

  mapbox: {
    token: process.env.MAPBOX_TOKEN || '',
    geocodingBase: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
    timeoutMs: parseInt(process.env.UPSTREAM_TIMEOUT_MS || '8000', 10),
  },

  // ── Rate Limiting ───────────────────────────────────────────────
  // All values are per-IP unless noted otherwise.
  rateLimit: {
    global: {
      windowMs: 60_000,       // 1 minute window
      maxRequests: 100,       // 100 req/min global
    },
    weather: {
      windowMs: 60_000,
      maxRequests: 30,        // 30 req/min for weather endpoints
    },
    geocode: {
      windowMs: 60_000,
      maxRequests: 20,        // 20 req/min for geocoding (tighter)
    },
    burst: {
      capacity: 10,           // Token bucket burst capacity
      refillRate: 2,          // Tokens refilled per second
    },
  },

  // ── Circuit Breaker ─────────────────────────────────────────────
  circuitBreaker: {
    failureThreshold: 5,      // Trips after 5 failures
    failureWindowMs: 60_000,  // Within 60 seconds
    resetTimeoutMs: 30_000,   // Half-open probe after 30s
  },

  // ── Response Cache TTLs ─────────────────────────────────────────
  cache: {
    weatherCurrentTtl: 300,   // 5 minutes (seconds)
    weatherForecastTtl: 900,  // 15 minutes
    geocodeTtl: 3600,         // 1 hour (locations rarely change)
  },

  // ── Request Limits ──────────────────────────────────────────────
  maxBodySize: '100kb',
  requestTimeoutMs: 10_000,

  // ── Logging ─────────────────────────────────────────────────────
  logLevel: process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug'),
};

export default config;

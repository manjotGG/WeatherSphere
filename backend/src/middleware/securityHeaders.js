/**
 * Security Headers Middleware.
 *
 * Uses Helmet for comprehensive HTTP security headers, plus
 * custom CORS and request size limits.
 */

import helmet from 'helmet';
import cors from 'cors';
import config from '../config/index.js';

/**
 * Returns an array of security middleware to apply to the Express app.
 */
export function securityMiddleware() {
  return [
    // ── Helmet — industry-standard security headers ────────────────
    helmet({
      contentSecurityPolicy: false, // API server — no HTML content
      crossOriginEmbedderPolicy: false,
    }),

    // ── CORS — restrict to allowed frontend origins ────────────────
    cors({
      origin: config.corsOrigins,
      methods: ['GET', 'OPTIONS'],   // API is read-only
      allowedHeaders: ['Content-Type', 'X-Client-ID', 'X-Request-ID'],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'Retry-After',
        'X-Request-ID',
      ],
      maxAge: 86400, // Preflight cache: 24 hours
    }),
  ];
}

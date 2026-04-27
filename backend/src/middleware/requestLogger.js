/**
 * Request Logger Middleware.
 *
 * Logs every request with structured JSON data suitable for
 * log aggregation (ELK, Loki, CloudWatch, Datadog).
 *
 * Logged fields: method, url, status, durationMs, ip, userAgent,
 *   requestId, rateLimitRemaining.
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Attaches a unique request ID and logs request/response details.
 */
export function requestLogger() {
  return (req, res, next) => {
    // Generate or propagate request ID for distributed tracing
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.set('X-Request-ID', requestId);

    const start = process.hrtime.bigint();

    // Log after response is sent (captures status code and duration)
    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationMs = Number(durationNs / 1_000_000n);

      const logData = {
        requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs,
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        userAgent: req.headers['user-agent']?.slice(0, 100),
        rateLimitRemaining: res.getHeader('X-RateLimit-Remaining'),
      };

      if (res.statusCode >= 500) {
        logger.error(logData, 'Request error');
      } else if (res.statusCode === 429) {
        logger.warn(logData, 'Rate limited');
      } else if (res.statusCode >= 400) {
        logger.warn(logData, 'Client error');
      } else {
        logger.info(logData, 'Request completed');
      }
    });

    next();
  };
}

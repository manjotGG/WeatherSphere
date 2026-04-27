/**
 * Rate Limiter Middleware Factory.
 *
 * Creates Express middleware that enforces rate limits using:
 *   1. Sliding window log (sustained rate control)
 *   2. Token bucket (burst control)
 *
 * Both checks must pass for a request to proceed.
 *
 * Returns proper HTTP 429 responses with headers:
 *   X-RateLimit-Limit      — max requests in the window
 *   X-RateLimit-Remaining   — requests remaining
 *   X-RateLimit-Reset       — seconds until window resets
 *   Retry-After             — seconds to wait (only on 429)
 */

import { slidingWindowCheck } from '../lib/slidingWindowLimiter.js';
import { tokenBucketCheck } from '../lib/tokenBucketLimiter.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Extract a stable client identifier from the request.
 *
 * Priority:
 *   1. X-Client-ID header (for authenticated clients)
 *   2. X-Forwarded-For (real IP behind proxy/LB)
 *   3. req.ip (direct connection)
 *
 * Note: X-Forwarded-For can be spoofed, but Nginx sets it from
 * the actual connection IP, overriding any client-sent value.
 */
function getClientId(req) {
  return (
    req.headers['x-client-id'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  );
}

/**
 * Create a rate limiting middleware.
 *
 * @param {Object} options
 * @param {number} options.windowMs     Sliding window duration (ms)
 * @param {number} options.maxRequests  Max requests in the window
 * @param {string} [options.keyPrefix]  Additional key prefix (e.g. "weather")
 * @param {boolean} [options.enableBurst=true] Apply token bucket burst control
 * @returns {Function} Express middleware
 */
export function createRateLimiter({
  windowMs,
  maxRequests,
  keyPrefix = 'global',
  enableBurst = true,
}) {
  const { burst } = config.rateLimit;

  return async (req, res, next) => {
    const clientId = getClientId(req);
    const key = `${clientId}:${keyPrefix}`;

    try {
      // ── Check 1: Sliding Window (sustained rate) ─────────────────
      const windowResult = await slidingWindowCheck(key, windowMs, maxRequests);

      // Set rate limit headers on ALL responses (not just 429)
      res.set({
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': String(windowResult.remaining),
        'X-RateLimit-Reset': String(Math.ceil(windowResult.resetMs / 1000)),
      });

      if (!windowResult.allowed) {
        const retryAfterSec = Math.ceil(windowResult.retryAfterMs / 1000);
        res.set('Retry-After', String(retryAfterSec));

        logger.warn({
          clientId,
          keyPrefix,
          remaining: 0,
          retryAfterSec,
        }, 'Rate limit exceeded (sliding window)');

        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfterSec} seconds.`,
          retryAfter: retryAfterSec,
        });
      }

      // ── Check 2: Token Bucket (burst control) ────────────────────
      if (enableBurst) {
        const burstResult = await tokenBucketCheck(
          key,
          burst.capacity,
          burst.refillRate
        );

        if (!burstResult.allowed) {
          const retryAfterSec = Math.ceil(burstResult.retryAfterMs / 1000) || 1;
          res.set('Retry-After', String(retryAfterSec));

          logger.warn({
            clientId,
            keyPrefix,
            retryAfterSec,
          }, 'Burst limit exceeded (token bucket)');

          return res.status(429).json({
            error: 'Too Many Requests',
            message: `Burst rate exceeded. Slow down and retry in ${retryAfterSec} second(s).`,
            retryAfter: retryAfterSec,
          });
        }
      }

      next();
    } catch (err) {
      // If rate limiting itself fails, let the request through
      // (fail-open to avoid total outage)
      logger.error({ err, clientId }, 'Rate limiter error — allowing request');
      next();
    }
  };
}

/**
 * Pre-configured rate limiters for different endpoint tiers.
 */
export const globalLimiter = createRateLimiter({
  ...config.rateLimit.global,
  keyPrefix: 'global',
  enableBurst: false, // Global limiter is broad — burst control on endpoints
});

export const weatherLimiter = createRateLimiter({
  ...config.rateLimit.weather,
  keyPrefix: 'weather',
});

export const geocodeLimiter = createRateLimiter({
  ...config.rateLimit.geocode,
  keyPrefix: 'geocode',
});

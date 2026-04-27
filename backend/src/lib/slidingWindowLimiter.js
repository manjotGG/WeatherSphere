/**
 * Sliding Window Log — Redis Lua rate limiter.
 *
 * Algorithm:
 *   Uses a Redis sorted set per key. Each request adds a member scored
 *   by the current timestamp. Before checking the count, we remove all
 *   members older than (now - windowMs). The set size = request count
 *   within the window.
 *
 * Why sliding window (not fixed window):
 *   Fixed windows create a burst-at-boundary problem: a client can send
 *   2× the limit by timing requests at the edge of two adjacent windows.
 *   Sliding window log distributes the limit smoothly over any time period.
 *
 * Why Lua script:
 *   The cleanup + count + add + expire must be atomic. Without Lua,
 *   race conditions between multiple Node instances would allow limit
 *   bypasses. Lua runs in a single Redis thread — guaranteed atomicity.
 *
 * Trade-off:
 *   Sliding window log has O(n) memory per key (one sorted set member per
 *   request). For our limits (≤100 req/min), this is ~100 small entries/key
 *   which is fine. For very high limits (10K+/min), a sliding window counter
 *   would be more memory-efficient.
 */

import { getRedisClient, isRedisConnected, getFallbackStore } from '../services/redisClient.js';
import logger from '../utils/logger.js';

/**
 * Lua script for atomic sliding window rate limiting.
 *
 * KEYS[1] = rate limit key (e.g. "rl:ip:192.168.1.1:weather")
 * ARGV[1] = current timestamp (ms)
 * ARGV[2] = window size (ms)
 * ARGV[3] = max requests allowed in window
 * ARGV[4] = unique request ID (to avoid duplicate members)
 *
 * Returns: [allowed (0|1), currentCount, oldestTimestamp]
 */
const LUA_SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local maxReqs = tonumber(ARGV[3])
local reqId = ARGV[4]

-- Remove entries older than the window
local windowStart = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- Count remaining entries
local count = redis.call('ZCARD', key)

if count < maxReqs then
  -- Allowed: add this request
  redis.call('ZADD', key, now, reqId)
  -- Set expiry on the key to auto-cleanup (window + buffer)
  redis.call('PEXPIRE', key, window + 1000)
  return {1, count + 1, 0}
else
  -- Denied: find when the oldest entry expires
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = 0
  if #oldest >= 2 then
    retryAfter = tonumber(oldest[2]) + window - now
  end
  return {0, count, retryAfter}
end
`;

/**
 * Check if a request is allowed under the sliding window limit.
 *
 * @param {string} key       Unique identifier (e.g. "ip:1.2.3.4:weather")
 * @param {number} windowMs  Window duration in milliseconds
 * @param {number} maxReqs   Maximum requests allowed in the window
 * @returns {Promise<{allowed: boolean, remaining: number, resetMs: number, retryAfterMs: number}>}
 */
export async function slidingWindowCheck(key, windowMs, maxReqs) {
  const prefixedKey = `rl:${key}`;

  // ── Redis-backed distributed check ──────────────────────────────
  if (isRedisConnected()) {
    try {
      const redis = getRedisClient();
      const now = Date.now();
      const reqId = `${now}:${Math.random().toString(36).slice(2, 10)}`;

      const result = await redis.eval(
        LUA_SLIDING_WINDOW,
        1,
        prefixedKey,
        now,
        windowMs,
        maxReqs,
        reqId
      );

      const [allowed, count, retryAfterMs] = result;

      return {
        allowed: allowed === 1,
        remaining: Math.max(0, maxReqs - count),
        resetMs: windowMs,
        retryAfterMs: allowed === 1 ? 0 : Math.max(0, retryAfterMs),
      };
    } catch (err) {
      logger.error({ err, key: prefixedKey }, 'Sliding window Redis error — falling back');
      // Fall through to in-memory fallback
    }
  }

  // ── In-memory fallback (per-instance, not distributed) ──────────
  return inMemorySlidingWindow(prefixedKey, windowMs, maxReqs);
}

/**
 * In-memory sliding window fallback.
 * Used when Redis is unavailable. NOT distributed — each instance
 * tracks independently, so effective limits are per-instance.
 */
function inMemorySlidingWindow(key, windowMs, maxReqs) {
  const store = getFallbackStore();
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get or create the request log for this key
  let requests = store.get(key);
  if (!requests) {
    requests = [];
    store.set(key, requests);
  }

  // Remove expired entries
  const filtered = requests.filter((ts) => ts > windowStart);
  store.set(key, filtered);

  if (filtered.length < maxReqs) {
    filtered.push(now);
    return {
      allowed: true,
      remaining: maxReqs - filtered.length,
      resetMs: windowMs,
      retryAfterMs: 0,
    };
  }

  const oldestInWindow = filtered[0] || now;
  const retryAfterMs = oldestInWindow + windowMs - now;

  return {
    allowed: false,
    remaining: 0,
    resetMs: windowMs,
    retryAfterMs: Math.max(0, retryAfterMs),
  };
}

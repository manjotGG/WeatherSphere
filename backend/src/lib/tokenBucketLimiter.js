/**
 * Token Bucket — Burst control rate limiter.
 *
 * Algorithm:
 *   A bucket starts with `capacity` tokens. Each request consumes one token.
 *   Tokens refill at `refillRate` per second. If the bucket is empty, the
 *   request is denied.
 *
 * Why token bucket + sliding window (defense in depth):
 *   The sliding window enforces average rate (e.g. 30/min). But it allows
 *   a client to send all 30 requests in one second. The token bucket limits
 *   the burst: with capacity=10, refill=2/s, a client can burst 10 requests
 *   instantly, then must slow to 2/s.
 *
 * Redis implementation:
 *   Stores {tokens, lastRefill} as a Redis hash. The refill is computed
 *   lazily on each check (no background process needed).
 */

import { getRedisClient, isRedisConnected, getFallbackStore } from '../services/redisClient.js';
import logger from '../utils/logger.js';

/**
 * Lua script for atomic token bucket rate limiting.
 *
 * KEYS[1] = bucket key
 * ARGV[1] = capacity (max tokens)
 * ARGV[2] = refill rate (tokens per second)
 * ARGV[3] = current time (seconds, float)
 * ARGV[4] = TTL for the key (seconds) — auto-cleanup idle buckets
 *
 * Returns: [allowed (0|1), remainingTokens, retryAfterSeconds]
 */
const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if tokens == nil then
  -- First request: initialize full bucket
  tokens = capacity
  lastRefill = now
end

-- Calculate tokens to add since last refill
local elapsed = math.max(0, now - lastRefill)
local newTokens = elapsed * refillRate
tokens = math.min(capacity, tokens + newTokens)
lastRefill = now

if tokens >= 1 then
  tokens = tokens - 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
  redis.call('EXPIRE', key, ttl)
  return {1, math.floor(tokens), 0}
else
  -- Denied: calculate when next token is available
  local waitTime = (1 - tokens) / refillRate
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
  redis.call('EXPIRE', key, ttl)
  return {0, 0, math.ceil(waitTime * 1000)}
end
`;

/**
 * Check if a request is allowed under the token bucket.
 *
 * @param {string} key        Unique identifier
 * @param {number} capacity   Max tokens (burst size)
 * @param {number} refillRate Tokens per second
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfterMs: number}>}
 */
export async function tokenBucketCheck(key, capacity, refillRate) {
  const prefixedKey = `tb:${key}`;

  if (isRedisConnected()) {
    try {
      const redis = getRedisClient();
      const nowSec = Date.now() / 1000;
      const ttl = Math.ceil(capacity / refillRate) + 60; // Auto-cleanup

      const result = await redis.eval(
        LUA_TOKEN_BUCKET,
        1,
        prefixedKey,
        capacity,
        refillRate,
        nowSec,
        ttl
      );

      const [allowed, remaining, retryAfterMs] = result;
      return {
        allowed: allowed === 1,
        remaining,
        retryAfterMs: allowed === 1 ? 0 : retryAfterMs,
      };
    } catch (err) {
      logger.error({ err, key: prefixedKey }, 'Token bucket Redis error — falling back');
    }
  }

  // ── In-memory fallback ──────────────────────────────────────────
  return inMemoryTokenBucket(prefixedKey, capacity, refillRate);
}

/**
 * In-memory token bucket fallback.
 */
function inMemoryTokenBucket(key, capacity, refillRate) {
  const store = getFallbackStore();
  const now = Date.now() / 1000;

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, lastRefill: now };
    store.set(key, bucket);
  }

  // Refill tokens
  const elapsed = Math.max(0, now - bucket.lastRefill);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
  }

  const waitTime = (1 - bucket.tokens) / refillRate;
  return { allowed: false, remaining: 0, retryAfterMs: Math.ceil(waitTime * 1000) };
}

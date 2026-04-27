/**
 * Redis-backed response cache with TTL.
 *
 * Caches upstream API responses (weather, geocoding) to:
 *   1. Reduce latency for repeated queries
 *   2. Reduce upstream API usage (stay within rate limits)
 *   3. Serve stale data when upstream is unavailable (circuit breaker OPEN)
 *
 * Cache key format: "cache:{type}:{lat}:{lon}" or "cache:geo:{query}"
 */

import { getRedisClient, isRedisConnected } from '../services/redisClient.js';
import logger from '../utils/logger.js';

/**
 * Get a cached response.
 *
 * @param {string} key    Cache key (e.g. "weather:current:40.7:-74.0")
 * @returns {Promise<Object|null>}  Parsed JSON or null if miss
 */
export async function cacheGet(key) {
  if (!isRedisConnected()) return null;

  try {
    const redis = getRedisClient();
    const raw = await redis.get(`cache:${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.warn({ err, key }, 'Cache GET failed');
    return null;
  }
}

/**
 * Store a response in cache.
 *
 * @param {string} key    Cache key
 * @param {Object} data   Data to cache (will be JSON-serialized)
 * @param {number} ttlSec Time-to-live in seconds
 */
export async function cacheSet(key, data, ttlSec) {
  if (!isRedisConnected()) return;

  try {
    const redis = getRedisClient();
    await redis.set(`cache:${key}`, JSON.stringify(data), 'EX', ttlSec);
  } catch (err) {
    logger.warn({ err, key }, 'Cache SET failed');
  }
}

/**
 * Build a cache key for weather data.
 * Rounds coordinates to 1 decimal (same as frontend LRU cache).
 */
export function weatherCacheKey(type, lat, lon) {
  const rLat = Math.round(lat * 10) / 10;
  const rLon = Math.round(lon * 10) / 10;
  return `weather:${type}:${rLat}:${rLon}`;
}

/**
 * Build a cache key for geocoding results.
 */
export function geocodeCacheKey(query) {
  return `geo:${query.toLowerCase().trim()}`;
}

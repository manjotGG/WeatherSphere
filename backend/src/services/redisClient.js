/**
 * Redis client — ioredis with reconnection, error handling, and graceful degradation.
 *
 * Architecture decision: ioredis over node-redis for:
 *   - Built-in Lua scripting support (critical for atomic rate limiting)
 *   - Automatic reconnection with configurable backoff
 *   - Cluster/Sentinel support for production HA
 *
 * Graceful degradation:
 *   If Redis is unavailable, the app continues with degraded functionality:
 *   - Rate limiting falls back to in-memory (per-instance, not distributed)
 *   - Caching is skipped (requests go directly upstream)
 *   - Circuit breaker state is per-instance only
 */

import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

let client = null;
let isConnected = false;

/**
 * In-memory fallback store for when Redis is down.
 * Keyed by string, values are arbitrary.
 * This is NOT distributed — each instance has its own.
 */
const fallbackStore = new Map();

/**
 * Create and return the Redis client singleton.
 * Calling this multiple times returns the same instance.
 */
export function getRedisClient() {
  if (!config.redis.url) {
    logger.info('Redis URL not configured — skipping Redis client initialization');
    return null;
  }

  if (client) return client;

  client = new Redis(config.redis.url, {
    password: config.redis.password,
    keyPrefix: config.redis.keyPrefix,
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times >= 5) {
        logger.warn({ attempt: times }, 'Redis reconnecting: max retries reached; continuing without Redis');
        return null;
      }

      const delay = Math.min(times * 200, 10_000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting...');
      return delay;
    },
    reconnectOnError(err) {
      // Reconnect on READONLY errors (failover scenarios)
      return err.message.includes('READONLY');
    },
    lazyConnect: false,
    enableReadyCheck: true,
  });

  client.on('connect', () => {
    logger.info('Redis connected');
    isConnected = true;
  });

  client.on('ready', () => {
    logger.info('Redis ready');
    isConnected = true;
  });

  client.on('error', (err) => {
    logger.error({ err }, 'Redis error');
    isConnected = false;
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
    isConnected = false;
  });

  return client;
}

/**
 * Check if Redis is currently connected and responsive.
 */
export function isRedisConnected() {
  return isConnected && client?.status === 'ready';
}

/**
 * Get the in-memory fallback store (for degraded mode).
 */
export function getFallbackStore() {
  return fallbackStore;
}

/**
 * Gracefully close the Redis connection (for shutdown).
 */
export async function closeRedis() {
  if (client) {
    logger.info('Closing Redis connection...');
    await client.quit().catch(() => client.disconnect());
    client = null;
    isConnected = false;
  }
}

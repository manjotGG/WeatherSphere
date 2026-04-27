/**
 * Circuit Breaker — protects against upstream API failures.
 *
 * States:
 *   CLOSED   — normal operation, requests pass through
 *   OPEN     — upstream is down, requests are rejected immediately (or served from cache)
 *   HALF_OPEN — probe period: one request is allowed through to test recovery
 *
 * State transitions:
 *   CLOSED → OPEN:      After `failureThreshold` failures within `failureWindowMs`
 *   OPEN → HALF_OPEN:   After `resetTimeoutMs` elapses
 *   HALF_OPEN → CLOSED: Probe request succeeds
 *   HALF_OPEN → OPEN:   Probe request fails
 *
 * State is stored in Redis (shared across instances).
 * Falls back to per-instance in-memory state if Redis is down.
 */

import { getRedisClient, isRedisConnected } from '../services/redisClient.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const { failureThreshold, failureWindowMs, resetTimeoutMs } = config.circuitBreaker;

// In-memory fallback state (per circuit name)
const localState = new Map();

/**
 * Get the current circuit breaker state from Redis.
 * @param {string} name  Circuit name (e.g. "openweather", "mapbox")
 */
async function getState(name) {
  const key = `cb:${name}`;

  if (isRedisConnected()) {
    try {
      const redis = getRedisClient();
      const raw = await redis.get(key);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      logger.warn({ err, circuit: name }, 'Circuit breaker: Redis GET failed');
    }
  }

  // Fallback to local state
  return localState.get(name) || { state: 'CLOSED', failures: 0, lastFailure: 0, openedAt: 0 };
}

/**
 * Persist circuit breaker state to Redis.
 */
async function setState(name, data) {
  const key = `cb:${name}`;

  // Always update local state
  localState.set(name, data);

  if (isRedisConnected()) {
    try {
      const redis = getRedisClient();
      // TTL: keep state for double the reset timeout
      await redis.set(key, JSON.stringify(data), 'PX', resetTimeoutMs * 3);
    } catch (err) {
      logger.warn({ err, circuit: name }, 'Circuit breaker: Redis SET failed');
    }
  }
}

/**
 * Check if the circuit allows a request through.
 *
 * @param {string} name  Circuit name
 * @returns {Promise<{allowed: boolean, state: string}>}
 */
export async function circuitCheck(name) {
  const current = await getState(name);
  const now = Date.now();

  switch (current.state) {
    case 'CLOSED':
      return { allowed: true, state: 'CLOSED' };

    case 'OPEN': {
      // Check if reset timeout has elapsed → transition to HALF_OPEN
      if (now - current.openedAt >= resetTimeoutMs) {
        const updated = { ...current, state: 'HALF_OPEN' };
        await setState(name, updated);
        logger.info({ circuit: name }, 'Circuit breaker: OPEN → HALF_OPEN (probe)');
        return { allowed: true, state: 'HALF_OPEN' };
      }
      return { allowed: false, state: 'OPEN' };
    }

    case 'HALF_OPEN':
      // Allow one probe request
      return { allowed: true, state: 'HALF_OPEN' };

    default:
      return { allowed: true, state: 'CLOSED' };
  }
}

/**
 * Record a successful request — resets the circuit to CLOSED.
 */
export async function circuitSuccess(name) {
  const current = await getState(name);
  if (current.state !== 'CLOSED') {
    logger.info({ circuit: name, from: current.state }, 'Circuit breaker: → CLOSED (success)');
  }
  await setState(name, { state: 'CLOSED', failures: 0, lastFailure: 0, openedAt: 0 });
}

/**
 * Record a failed request — may trip the circuit to OPEN.
 */
export async function circuitFailure(name) {
  const current = await getState(name);
  const now = Date.now();

  // If in HALF_OPEN, probe failed → back to OPEN
  if (current.state === 'HALF_OPEN') {
    logger.warn({ circuit: name }, 'Circuit breaker: HALF_OPEN → OPEN (probe failed)');
    await setState(name, { state: 'OPEN', failures: current.failures + 1, lastFailure: now, openedAt: now });
    return;
  }

  // Reset failure count if outside the window
  let failures = current.failures;
  if (now - current.lastFailure > failureWindowMs) {
    failures = 0;
  }
  failures += 1;

  if (failures >= failureThreshold) {
    logger.error({ circuit: name, failures }, 'Circuit breaker: CLOSED → OPEN (threshold reached)');
    await setState(name, { state: 'OPEN', failures, lastFailure: now, openedAt: now });
  } else {
    await setState(name, { ...current, state: 'CLOSED', failures, lastFailure: now });
  }
}

/**
 * Express middleware factory for circuit breaker protection.
 *
 * @param {string} circuitName  Name of the circuit (e.g. "openweather")
 * @returns {Function} Express middleware
 */
export function circuitBreakerMiddleware(circuitName) {
  return async (req, res, next) => {
    const result = await circuitCheck(circuitName);

    if (!result.allowed) {
      logger.warn({ circuit: circuitName }, 'Circuit breaker OPEN — request blocked');
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Upstream service is temporarily unavailable. Please try again later.',
        circuit: circuitName,
      });
    }

    // Attach circuit info to request for use in handlers
    req.circuitName = circuitName;
    req.circuitState = result.state;
    next();
  };
}

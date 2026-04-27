/**
 * Health Check Routes — used by Nginx + Kubernetes for service lifecycle.
 *
 * GET /health       — basic liveness (process is running)
 * GET /health/ready — readiness (Redis connected, upstream reachable)
 * GET /health/live  — liveness probe (minimal, always 200)
 */

import { Router } from 'express';
import { isRedisConnected } from '../services/redisClient.js';

const router = Router();

/**
 * Basic health — returns 200 if the process is active.
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe — checks dependencies.
 * Returns 503 if any critical dependency is down.
 */
router.get('/ready', async (req, res) => {
  const checks = {
    redis: isRedisConnected(),
  };

  const allHealthy = Object.values(checks).every(Boolean);

  const status = allHealthy ? 200 : 503;
  res.status(status).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Liveness probe — minimal check.
 * Returns 200 as long as the event loop is responsive.
 */
router.get('/live', (req, res) => {
  res.status(200).send('OK');
});

export default router;

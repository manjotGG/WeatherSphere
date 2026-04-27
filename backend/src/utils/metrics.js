/**
 * Prometheus Metrics — /metrics endpoint for monitoring.
 *
 * Exposes counters, histograms, and gauges compatible with
 * Prometheus scraping. Use with Grafana for dashboards.
 *
 * Metrics exported:
 *   - http_requests_total         (counter)  — total requests by method/route/status
 *   - http_request_duration_ms    (histogram) — request latency distribution
 *   - rate_limited_total          (counter)  — total 429 responses
 *   - upstream_requests_total     (counter)  — calls to OpenWeather/Mapbox
 *   - upstream_latency_ms         (histogram) — upstream response time
 *   - circuit_breaker_state       (gauge)    — 0=closed, 1=open, 2=half-open
 *   - redis_connected             (gauge)    — 1=connected, 0=disconnected
 */

import client from 'prom-client';

// Collect default Node.js metrics (memory, CPU, event loop, GC)
client.collectDefaultMetrics({ prefix: 'ws_' });

// ── Custom Metrics ────────────────────────────────────────────────

export const httpRequestsTotal = new client.Counter({
  name: 'ws_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDuration = new client.Histogram({
  name: 'ws_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

export const rateLimitedTotal = new client.Counter({
  name: 'ws_rate_limited_total',
  help: 'Total rate-limited (429) responses',
  labelNames: ['route', 'limiter_type'],
});

export const upstreamRequestsTotal = new client.Counter({
  name: 'ws_upstream_requests_total',
  help: 'Total upstream API requests',
  labelNames: ['service', 'status'],
});

export const upstreamLatency = new client.Histogram({
  name: 'ws_upstream_latency_ms',
  help: 'Upstream API response time in milliseconds',
  labelNames: ['service'],
  buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
});

export const circuitBreakerState = new client.Gauge({
  name: 'ws_circuit_breaker_state',
  help: 'Circuit breaker state: 0=closed, 1=open, 2=half-open',
  labelNames: ['circuit'],
});

export const redisConnected = new client.Gauge({
  name: 'ws_redis_connected',
  help: 'Redis connection status: 1=connected, 0=disconnected',
});

/**
 * Express middleware to record request metrics.
 */
export function metricsMiddleware() {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const route = req.route?.path || req.path || 'unknown';
      const method = req.method;
      const status = res.statusCode;

      httpRequestsTotal.inc({ method, route, status });
      httpRequestDuration.observe({ method, route, status }, duration);

      if (status === 429) {
        rateLimitedTotal.inc({ route, limiter_type: 'combined' });
      }
    });

    next();
  };
}

/**
 * Returns the Prometheus metrics endpoint handler.
 */
export async function getMetrics(req, res) {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end('Error collecting metrics');
  }
}

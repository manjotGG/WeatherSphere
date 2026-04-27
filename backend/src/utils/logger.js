/**
 * Structured logger — pino.
 *
 * Outputs JSON in production (for log aggregation — ELK, Loki, CloudWatch)
 * and pretty-printed in development.
 *
 * Every log entry includes: level, timestamp, msg, and any additional context.
 * Request-scoped child loggers add requestId for tracing.
 */

import pino from 'pino';
import config from '../config/index.js';

const transport =
  config.env !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined;

const logger = pino({
  level: config.logLevel,
  transport,
  // Redact sensitive values from logs
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'apiKey'],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      ip: req.ip || req.headers?.['x-forwarded-for'],
    }),
  },
});

export default logger;

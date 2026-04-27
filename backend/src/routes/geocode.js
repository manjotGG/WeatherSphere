/**
 * Geocoding API Routes.
 *
 * GET /api/geocode/search?q=Paris&limit=5
 */

import { Router } from 'express';
import { validateGeocodeParams } from '../middleware/requestValidator.js';
import { geocodeLimiter } from '../middleware/rateLimiter.js';
import { circuitBreakerMiddleware } from '../middleware/circuitBreaker.js';
import { searchLocations } from '../services/geocodeProxy.js';

const router = Router();

router.use(geocodeLimiter);
router.use(circuitBreakerMiddleware('mapbox'));

/**
 * GET /api/geocode/search
 * Search for locations by name.
 */
router.get('/search', validateGeocodeParams, async (req, res) => {
  try {
    const { q, limit } = req.validatedParams;
    const results = await searchLocations(q, limit);
    res.json(results);
  } catch (err) {
    res.status(502).json({
      error: 'Bad Gateway',
      message: err.message || 'Failed to search locations',
    });
  }
});

export default router;

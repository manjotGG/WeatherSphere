/**
 * Weather API Routes.
 *
 * GET /api/weather/current?lat=X&lon=Y
 * GET /api/weather/forecast?lat=X&lon=Y
 */

import { Router } from 'express';
import { validateWeatherParams } from '../middleware/requestValidator.js';
import { weatherLimiter } from '../middleware/rateLimiter.js';
import { circuitBreakerMiddleware } from '../middleware/circuitBreaker.js';
import logger from '../utils/logger.js';
import { getCurrentWeather, getWeatherForecast } from '../services/weatherProxy.js';

const router = Router();

// Apply rate limiting + circuit breaker to all weather routes
router.use(weatherLimiter);
router.use(circuitBreakerMiddleware('openweather'));

/**
 * GET /api/weather/current
 * Returns current weather conditions for coordinates.
 */
router.get('/current', validateWeatherParams, async (req, res) => {
  try {
    const { lat, lon } = req.validatedParams;
    const data = await getCurrentWeather(lat, lon);
    res.json(data);
  } catch (err) {
    logger.error({ err, requestId: req.requestId, lat: req.validatedParams.lat, lon: req.validatedParams.lon }, 'Weather current request failed');
    res.status(502).json({
      error: 'Bad Gateway',
      message: err.message || 'Failed to fetch weather data',
    });
  }
});

/**
 * GET /api/weather/forecast
 * Returns 5-day forecast for coordinates.
 */
router.get('/forecast', validateWeatherParams, async (req, res) => {
  try {
    const { lat, lon } = req.validatedParams;
    const data = await getWeatherForecast(lat, lon);
    res.json(data);
  } catch (err) {
    logger.error({ err, requestId: req.requestId, lat: req.validatedParams.lat, lon: req.validatedParams.lon }, 'Weather forecast request failed');
    res.status(502).json({
      error: 'Bad Gateway',
      message: err.message || 'Failed to fetch forecast data',
    });
  }
});

export default router;

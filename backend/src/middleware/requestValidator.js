/**
 * Request Validator Middleware.
 *
 * Validates and sanitizes all incoming request parameters before
 * they reach the route handlers. Rejects malformed requests early.
 */

/**
 * Validate weather endpoint query parameters.
 * Ensures lat/lon are valid geographic coordinates.
 */
export function validateWeatherParams(req, res, next) {
  const { lat, lon } = req.query;

  if (lat == null || lon == null) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required query parameters: lat, lon',
    });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (isNaN(latNum) || isNaN(lonNum)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'lat and lon must be valid numbers',
    });
  }

  if (latNum < -90 || latNum > 90) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'lat must be between -90 and 90',
    });
  }

  if (lonNum < -180 || lonNum > 180) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'lon must be between -180 and 180',
    });
  }

  // Attach parsed values so handlers don't need to re-parse
  req.validatedParams = { lat: latNum, lon: lonNum };
  next();
}

/**
 * Validate geocoding search query.
 * Ensures the query string is present and within sane limits.
 */
export function validateGeocodeParams(req, res, next) {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing required query parameter: q',
    });
  }

  // Sanitize: trim, limit length, strip HTML tags
  const sanitized = q.trim().replace(/<[^>]*>/g, '').slice(0, 200);

  if (sanitized.length < 1) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Query string is too short',
    });
  }

  const limit = Math.min(parseInt(req.query.limit || '5', 10) || 5, 10);

  req.validatedParams = { q: sanitized, limit };
  next();
}

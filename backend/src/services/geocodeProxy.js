/**
 * Geocode Proxy Service — proxies to Mapbox Geocoding API.
 *
 * Mapbox token is injected server-side for geocoding calls.
 * (The token is still needed in the frontend for map rendering,
 * but geocoding API calls are more sensitive to abuse.)
 */

import config from '../config/index.js';
import { cacheGet, cacheSet, geocodeCacheKey } from '../lib/responseCache.js';
import { circuitSuccess, circuitFailure } from '../middleware/circuitBreaker.js';
import logger from '../utils/logger.js';

const CIRCUIT_NAME = 'mapbox';

/**
 * Fetch with timeout.
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Search for locations matching a text query.
 *
 * @param {string} query  Search text
 * @param {number} [limit=5]  Max results
 * @returns {Promise<Array<{name, lat, lon, bbox}>>}
 */
export async function searchLocations(query, limit = 5) {
  const cacheKey = geocodeCacheKey(`${query}:${limit}`);

  // Check cache
  const cached = await cacheGet(cacheKey);
  if (cached) {
    logger.debug({ query }, 'Geocode: cache HIT');
    return cached;
  }

  const encoded = encodeURIComponent(query);
  const url = `${config.mapbox.geocodingBase}/${encoded}.json?access_token=${config.mapbox.token}&limit=${limit}&types=place,country,region`;

  try {
    const res = await fetchWithTimeout(url, config.mapbox.timeoutMs);

    if (!res.ok) {
      throw new Error(`Mapbox Geocoding error: ${res.status}`);
    }

    const data = await res.json();
    const results = (data.features || []).map((f) => ({
      name: f.place_name || f.text || '',
      lat: f.center[1],
      lon: f.center[0],
      bbox: f.bbox || null,
    }));

    // Cache results (locations rarely change)
    await cacheSet(cacheKey, results, config.cache.geocodeTtl);
    await circuitSuccess(CIRCUIT_NAME);

    return results;
  } catch (err) {
    await circuitFailure(CIRCUIT_NAME);

    const stale = await cacheGet(cacheKey);
    if (stale) {
      logger.warn({ err, query }, 'Geocode: upstream failed, serving stale cache');
      return stale;
    }

    throw err;
  }
}

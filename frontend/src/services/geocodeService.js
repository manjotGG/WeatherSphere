/**
 * Mapbox Geocoding service for location search.
 *
 * Uses the Mapbox Geocoding API (v5) to convert text queries into
 * geographic coordinates. The same Mapbox token used for the map works here.
 */

import { MAPBOX_GEOCODING_BASE } from '../utils/constants.js';

/**
 * @returns {string} Mapbox access token
 */
function getToken() {
  return import.meta.env.VITE_MAPBOX_TOKEN || '';
}

/**
 * Search for locations matching a text query.
 *
 * @param {string} query  Free-text search (e.g. "Paris", "Tokyo Tower")
 * @param {Object} [options]
 * @param {number} [options.limit=5]  Max results
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array<{name: string, lat: number, lon: number, bbox: number[]|null}>>}
 */
export async function searchLocations(query, { limit = 5, signal } = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('Missing VITE_MAPBOX_TOKEN. Add it to your .env file.');
  }

  const encoded = encodeURIComponent(query.trim());
  const url = `${MAPBOX_GEOCODING_BASE}/${encoded}.json?access_token=${token}&limit=${limit}&types=place,country,region`;

  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`Geocoding API error: ${res.status}`);
  }

  const data = await res.json();

  return (data.features || []).map((f) => ({
    name: f.place_name || f.text || '',
    lat: f.center[1],
    lon: f.center[0],
    bbox: f.bbox || null,
  }));
}

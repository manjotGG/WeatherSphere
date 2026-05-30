/**
 * Geocoding service — proxied through backend.
 *
 * Searches for locations via the backend's /api/geocode/search endpoint,
 * which proxies to Mapbox Geocoding with server-side token injection.
 *
 * Note: The Mapbox token is still used in the frontend for map rendering
 * (required by the Mapbox GL JS SDK), but geocoding API calls are now
 * proxied to prevent abuse.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

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
  const encoded = encodeURIComponent(query.trim());
  const url = `${API_BASE}/api/geocode/search?q=${encoded}&limit=${limit}`;

  const res = await fetch(url, { signal });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') || '30';
    throw new Error(`Rate limited. Please wait ${retryAfter} seconds.`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Geocoding API error: ${res.status}`);
  }

  return await res.json();
}

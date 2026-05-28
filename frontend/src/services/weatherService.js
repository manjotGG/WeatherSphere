/**
 * Weather API service — proxied through backend.
 *
 * All weather-related API calls go through the backend server, which:
 *   - Injects the OpenWeather API key server-side (never exposed to client)
 *   - Applies rate limiting and circuit breaker protection
 *   - Caches responses in Redis
 *
 * The backend returns the same normalized data shape, so components
 * remain unchanged.
 */
const API = import.meta.env.VITE_API_URL;
import { API_BASE } from '../utils/constants.js';

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fetch current weather for a geographic coordinate.
 *
 * @param {number} lat  Latitude
 * @param {number} lon  Longitude
 * @param {AbortSignal} [signal]  Optional AbortController signal
 * @returns {Promise<{current: Object, location: Object}>}
 * @throws {Error} On network failure or non-OK status
 */
export async function fetchCurrentWeather(lat, lon, signal) {
  const url = `${API_BASE}/api/weather/current?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') || '30';
    throw new Error(`Rate limited. Please wait ${retryAfter} seconds.`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || `Weather API error: ${res.status}`
    );
  }

  return await res.json();
}

/**
 * Fetch 5-day / 3-hour forecast for a geographic coordinate.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{dt, temp, description, icon, …}>>}
 */
export async function fetchForecast(lat, lon, signal) {
  const url = `${API_BASE}/api/weather/forecast?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') || '30';
    throw new Error(`Rate limited. Please wait ${retryAfter} seconds.`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || `Forecast API error: ${res.status}`
    );
  }

  return await res.json();
}

/**
 * OpenWeather API service.
 *
 * All weather-related API calls go through this module so the rest of the app
 * works with a normalized data shape — if the API changes or we switch providers,
 * only this file needs updating.
 *
 * Requirements:
 *   - Set VITE_OPENWEATHER_API_KEY in your .env file
 *   - Uses metric units (Celsius, m/s)
 */

import { OPENWEATHER_BASE } from '../utils/constants.js';

/**
 * @returns {string} API key or empty string
 */
function getApiKey() {
  return import.meta.env.VITE_OPENWEATHER_API_KEY || '';
}

// ── Normalized Response Shapes ───────────────────────────────────────
//
// Every public function in this module returns data in these shapes
// so consumers never deal with raw API responses.
//
// CurrentWeather:
//   { temp, feelsLike, humidity, windSpeed, windDeg,
//     description, icon, pressure, visibility }
//
// Location:
//   { name, country, lat, lon }
//
// ForecastEntry:
//   { dt, temp, tempMin, tempMax, description, icon, humidity, windSpeed }

/**
 * Normalize a raw OpenWeather "current weather" response.
 */
function normalizeCurrentWeather(raw) {
  return {
    current: {
      temp: raw.main?.temp ?? null,
      feelsLike: raw.main?.feels_like ?? null,
      humidity: raw.main?.humidity ?? null,
      windSpeed: raw.wind?.speed ?? null,
      windDeg: raw.wind?.deg ?? null,
      description: raw.weather?.[0]?.description ?? '',
      icon: raw.weather?.[0]?.icon ?? '',
      pressure: raw.main?.pressure ?? null,
      visibility: raw.visibility ?? null,
    },
    location: {
      name: raw.name ?? '',
      country: raw.sys?.country ?? '',
      lat: raw.coord?.lat ?? null,
      lon: raw.coord?.lon ?? null,
    },
  };
}

/**
 * Normalize a raw OpenWeather "5-day / 3-hour forecast" response.
 */
function normalizeForecast(raw) {
  const list = raw.list ?? [];
  return list.map((entry) => ({
    dt: entry.dt,
    temp: entry.main?.temp ?? null,
    tempMin: entry.main?.temp_min ?? null,
    tempMax: entry.main?.temp_max ?? null,
    description: entry.weather?.[0]?.description ?? '',
    icon: entry.weather?.[0]?.icon ?? '',
    humidity: entry.main?.humidity ?? null,
    windSpeed: entry.wind?.speed ?? null,
  }));
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fetch current weather for a geographic coordinate.
 *
 * @param {number} lat  Latitude
 * @param {number} lon  Longitude
 * @param {AbortSignal} [signal]  Optional AbortController signal
 * @returns {Promise<{current: Object, location: Object}>}
 * @throws {Error} On network failure, missing API key, or non-OK status
 */
export async function fetchCurrentWeather(lat, lon, signal) {
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'Missing VITE_OPENWEATHER_API_KEY. Add it to your .env file.'
    );
  }

  const url = `${OPENWEATHER_BASE}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
  const res = await fetch(url, { signal });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || `OpenWeather API error: ${res.status}`
    );
  }

  const raw = await res.json();
  return normalizeCurrentWeather(raw);
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
  const key = getApiKey();
  if (!key) {
    throw new Error(
      'Missing VITE_OPENWEATHER_API_KEY. Add it to your .env file.'
    );
  }

  const url = `${OPENWEATHER_BASE}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
  const res = await fetch(url, { signal });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.message || `OpenWeather Forecast API error: ${res.status}`
    );
  }

  const raw = await res.json();
  return normalizeForecast(raw);
}

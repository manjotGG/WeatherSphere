/**
 * Weather Proxy Service — proxies to OpenWeather API.
 *
 * API keys are injected server-side (never exposed to clients).
 * Responses are cached in Redis with configurable TTL.
 * Circuit breaker integration prevents hammering a downed API.
 */

import config from '../config/index.js';
import { cacheGet, cacheSet, weatherCacheKey } from '../lib/responseCache.js';
import { circuitSuccess, circuitFailure } from '../middleware/circuitBreaker.js';
import logger from '../utils/logger.js';

const CIRCUIT_NAME = 'openweather';

/**
 * Fetch with timeout — prevents hanging requests.
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Normalize a raw OpenWeather "current weather" response.
 * Same shape as the frontend normalizer — clients don't need to change.
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
 * Normalize a raw OpenWeather forecast response.
 */
function normalizeForecast(raw) {
  return (raw.list ?? []).map((entry) => ({
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

/**
 * Fetch current weather data.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Object>} Normalized weather data
 */
export async function getCurrentWeather(lat, lon) {
  const cacheKey = weatherCacheKey('current', lat, lon);

  // Check cache first
  const cached = await cacheGet(cacheKey);
  if (cached) {
    logger.debug({ lat, lon }, 'Weather current: cache HIT');
    return cached;
  }

  // Fetch from upstream
  const url = `${config.openweather.baseUrl}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${config.openweather.apiKey}`;

  try {
    const res = await fetchWithTimeout(url, config.openweather.timeoutMs);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `OpenWeather API error: ${res.status}`);
    }

    const raw = await res.json();
    const data = normalizeCurrentWeather(raw);

    // Cache the response
    await cacheSet(cacheKey, data, config.cache.weatherCurrentTtl);

    // Record success for circuit breaker
    await circuitSuccess(CIRCUIT_NAME);

    logger.debug({ lat, lon }, 'Weather current: fetched from upstream');
    return data;
  } catch (err) {
    await circuitFailure(CIRCUIT_NAME);

    // Try to return stale cache on failure
    const stale = await cacheGet(cacheKey);
    if (stale) {
      logger.warn({ err, lat, lon }, 'Weather current: upstream failed, serving stale cache');
      return stale;
    }

    throw err;
  }
}

/**
 * Fetch weather forecast data.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Array>} Normalized forecast entries
 */
export async function getWeatherForecast(lat, lon) {
  const cacheKey = weatherCacheKey('forecast', lat, lon);

  const cached = await cacheGet(cacheKey);
  if (cached) {
    logger.debug({ lat, lon }, 'Weather forecast: cache HIT');
    return cached;
  }

  const url = `${config.openweather.baseUrl}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${config.openweather.apiKey}`;

  try {
    const res = await fetchWithTimeout(url, config.openweather.timeoutMs);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `OpenWeather Forecast error: ${res.status}`);
    }

    const raw = await res.json();
    const data = normalizeForecast(raw);

    await cacheSet(cacheKey, data, config.cache.weatherForecastTtl);
    await circuitSuccess(CIRCUIT_NAME);

    return data;
  } catch (err) {
    await circuitFailure(CIRCUIT_NAME);

    const stale = await cacheGet(cacheKey);
    if (stale) {
      logger.warn({ err, lat, lon }, 'Weather forecast: upstream failed, serving stale cache');
      return stale;
    }

    throw err;
  }
}

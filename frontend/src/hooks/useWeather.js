/**
 * useWeather — Custom hook for fetching and caching weather data.
 *
 * Design decisions:
 *   - LRU cache keyed by rounded lat/lon avoids hammering the API on
 *     repeated hovers of nearby points.
 *   - AbortController cancels stale in-flight requests when a new
 *     location is selected before the previous one resolves.
 *   - Returns { data, forecast, loading, error, fetchWeather, clearWeather }
 *     so components stay declarative.
 */

import { useState, useRef, useCallback } from 'react';
import { fetchCurrentWeather, fetchForecast } from '../services/weatherService.js';
import { WEATHER_CACHE_TTL_MS, WEATHER_CACHE_MAX } from '../utils/constants.js';

/**
 * Round a coordinate to 1 decimal place for cache key grouping.
 * Points within ~11 km of each other share the same cache entry.
 */
function roundCoord(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Simple LRU cache with TTL eviction.
 */
class WeatherCache {
  constructor(maxSize = WEATHER_CACHE_MAX, ttl = WEATHER_CACHE_TTL_MS) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    /** @type {Map<string, {data: any, ts: number}>} */
    this.store = new Map();
  }

  _key(lat, lon) {
    return `${roundCoord(lat)}|${roundCoord(lon)}`;
  }

  get(lat, lon) {
    const key = this._key(lat, lon);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttl) {
      this.store.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data;
  }

  set(lat, lon, data) {
    const key = this._key(lat, lon);
    // Evict oldest if at capacity
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }
    this.store.set(key, { data, ts: Date.now() });
  }
}

/**
 * React hook for weather data management.
 *
 * @returns {{
 *   data: Object|null,
 *   forecast: Array|null,
 *   loading: boolean,
 *   error: string|null,
 *   fetchWeather: (lat: number, lon: number) => Promise<void>,
 *   clearWeather: () => void
 * }}
 */
export function useWeather() {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cacheRef = useRef(new WeatherCache());
  const controllerRef = useRef(null);

  const fetchWeather = useCallback(async (lat, lon) => {
    // Cancel any in-flight request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;

    // Check cache first
    const cached = cacheRef.current.get(lat, lon);
    if (cached) {
      setData(cached.current);
      setForecast(cached.forecast);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch current weather and forecast in parallel
      const [weatherResult, forecastResult] = await Promise.all([
        fetchCurrentWeather(lat, lon, controller.signal),
        fetchForecast(lat, lon, controller.signal).catch(() => null),
      ]);

      // Don't update state if this request was aborted
      if (controller.signal.aborted) return;

      setData(weatherResult);
      setForecast(forecastResult);
      setLoading(false);

      // Cache the combined result
      cacheRef.current.set(lat, lon, {
        current: weatherResult,
        forecast: forecastResult,
      });
    } catch (err) {
      if (err.name === 'AbortError') return; // Silently ignore aborted requests
      setError(err.message || 'Failed to fetch weather data');
      setLoading(false);
    }
  }, []);

  const clearWeather = useCallback(() => {
    setData(null);
    setForecast(null);
    setLoading(false);
    setError(null);
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  }, []);

  return { data, forecast, loading, error, fetchWeather, clearWeather };
}

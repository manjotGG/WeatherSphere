/**
 * Application-wide constants and configuration.
 *
 * Centralizing these values makes it easy to tune the app
 * without hunting through component files.
 */

// ── Map Configuration ────────────────────────────────────────────────
/** Mapbox dark globe style — chosen for its space-like aesthetic */
export const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

/** Where the globe centers on first load (Atlantic view shows multiple continents) */
export const INITIAL_CENTER = [20, 20];   // [lng, lat]
export const INITIAL_ZOOM = 1.8;
export const INITIAL_PITCH = 0;
export const INITIAL_BEARING = 0;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 18;

// ── Layer / Source IDs ───────────────────────────────────────────────
// Keeping IDs as constants avoids typo bugs when referencing them
// across GlobeMap, highlight handlers, and search fly-to logic.
export const COUNTRY_SOURCE = 'country-boundaries';
export const COUNTRY_FILL_LAYER = 'country-fill';
export const COUNTRY_LINE_LAYER = 'country-line';
export const COUNTRY_HIGHLIGHT_LAYER = 'country-highlight-fill';
export const COUNTRY_HIGHLIGHT_LINE_LAYER = 'country-highlight-line';

// ── Backend API ──────────────────────────────────────────────────────
// API calls now go through the backend (which proxies to OpenWeather/Mapbox).
// API keys stay server-side — never exposed in client bundle.
export function resolveApiBase() {
  const envBase = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE;
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return '';
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

export const API_BASE = resolveApiBase();

// ── Weather icon URL (still direct — it's just public CDN images) ────
export const OPENWEATHER_ICON_BASE = 'https://openweathermap.org/img/wn';

/** Cache weather responses for 10 minutes to avoid excessive API calls */
export const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
/** Max entries in the LRU cache */
export const WEATHER_CACHE_MAX = 100;

// ── Interaction ──────────────────────────────────────────────────────
/** Debounce delay for search input (ms) */
export const SEARCH_DEBOUNCE_MS = 350;
/** Debounce delay for hover weather fetch (ms) */
export const HOVER_DEBOUNCE_MS = 200;

/**
 * Formatting utilities for weather data display.
 *
 * All formatters are pure functions — easy to test and reuse
 * across tooltips, panels, and any future data views.
 */

import { OPENWEATHER_ICON_BASE } from './constants.js';

// ── Temperature ──────────────────────────────────────────────────────

/**
 * Format a Celsius temperature for display.
 * @param {number|null} celsius
 * @returns {string} e.g. "24°C" or "--"
 */
export function formatTemp(celsius) {
  if (celsius == null || isNaN(celsius)) return '--';
  return `${Math.round(celsius)}°C`;
}

// ── Wind ─────────────────────────────────────────────────────────────

const CARDINAL_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Format wind speed (m/s) and direction (degrees) into a human-readable string.
 * @param {number} speed  m/s
 * @param {number} deg    meteorological degrees (0 = north)
 * @returns {string} e.g. "5.2 m/s NW"
 */
export function formatWind(speed, deg) {
  if (speed == null) return '--';
  const index = Math.round(deg / 45) % 8;
  return `${speed.toFixed(1)} m/s ${CARDINAL_DIRS[index]}`;
}

// ── Date / Time ──────────────────────────────────────────────────────

/**
 * Format a Unix timestamp into a localized short date/time.
 * @param {number} unixSeconds
 * @returns {string}
 */
export function formatDate(unixSeconds) {
  if (!unixSeconds) return '--';
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a Unix timestamp into a short time string (e.g. "3 PM").
 * @param {number} unixSeconds
 * @returns {string}
 */
export function formatTime(unixSeconds) {
  if (!unixSeconds) return '--';
  return new Date(unixSeconds * 1000).toLocaleTimeString(undefined, {
    hour: 'numeric',
    hour12: true,
  });
}

// ── Weather Icons ────────────────────────────────────────────────────

/**
 * Build the OpenWeather icon URL for a given icon code.
 * @param {string} iconCode  e.g. "04d"
 * @param {number} [size=2]  1 = small, 2 = medium, 4 = large (available: @2x, @4x)
 * @returns {string} full image URL
 */
export function getWeatherIconUrl(iconCode, size = 2) {
  if (!iconCode) return '';
  return `${OPENWEATHER_ICON_BASE}/${iconCode}@${size}x.png`;
}

// ── Misc ─────────────────────────────────────────────────────────────

/**
 * Capitalize the first letter of every word.
 * Used for weather descriptions from the API (e.g. "broken clouds" → "Broken Clouds").
 */
export function capitalizeWords(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

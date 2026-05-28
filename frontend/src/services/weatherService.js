import { API_BASE } from '../utils/constants.js';

export async function fetchCurrentWeather(lat, lon, signal) {
  const base = API_BASE || '';
  const url = `${base}/api/weather/current?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Weather API failed");
  }

  return await res.json();
}

export async function fetchForecast(lat, lon, signal) {
  const base = API_BASE || '';
  const url = `${base}/api/weather/forecast?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Forecast API failed");
  }

  return await res.json();
}
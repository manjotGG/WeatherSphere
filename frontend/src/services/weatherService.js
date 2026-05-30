const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function fetchCurrentWeather(lat, lon, signal) {
  const url = `${API_BASE}/api/weather/current?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Weather API failed");
  }

  return await res.json();
}

export async function fetchForecast(lat, lon, signal) {
  const url = `${API_BASE}/api/weather/forecast?lat=${lat}&lon=${lon}`;
  const res = await fetch(url, { signal });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Forecast API failed");
  }

  return await res.json();
}
/**
 * WeatherPanel — Slide-in panel showing detailed forecast data.
 *
 * Opens when a user clicks a country (vs hover for popup).
 * Shows hourly and daily forecast from the OpenWeather API.
 *
 * Props:
 *   visible       — Whether the panel is open
 *   countryName   — Name of the selected country
 *   weatherData   — Current weather data (normalized)
 *   forecast      — Forecast array from useWeather
 *   loading       — Loading state
 *   error         — Error message
 *   onClose       — Callback to close the panel
 */

import { formatTemp, formatTime, formatDate, getWeatherIconUrl, capitalizeWords } from '../../utils/formatters.js';

export default function WeatherPanel({
  visible,
  countryName,
  weatherData,
  forecast,
  loading,
  error,
  onClose,
}) {
  if (!visible) return null;

  const current = weatherData?.current || null;
  const location = weatherData?.location || null;

  // Group forecast into daily summaries (take one entry per day, roughly every 24h)
  const dailyForecast = forecast
    ? forecast.filter((_, i) => i % 8 === 0).slice(0, 5)
    : [];

  // Hourly: next 8 entries (24 hours at 3h intervals)
  const hourlyForecast = forecast ? forecast.slice(0, 8) : [];

  return (
    <div className={`weather-panel ${visible ? 'weather-panel--open' : ''}`} id="weather-panel">
      {/* Panel header */}
      <div className="weather-panel-header">
        <div>
          <h2 className="weather-panel-title">{countryName}</h2>
          {location?.name && (
            <span className="weather-panel-subtitle">{location.name}, {location.country}</span>
          )}
        </div>
        <button
          className="weather-panel-close"
          onClick={onClose}
          type="button"
          aria-label="Close weather panel"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="weather-panel-loading">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="ws-skeleton" style={{ height: 60, marginBottom: 12 }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="weather-panel-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Current weather */}
      {current && !loading && !error && (
        <div className="weather-panel-content">
          {/* Current conditions card */}
          <div className="weather-panel-current">
            <div className="weather-panel-current-main">
              {current.icon && (
                <img
                  src={getWeatherIconUrl(current.icon, 4)}
                  alt={current.description}
                  className="weather-panel-current-icon"
                  width="80"
                  height="80"
                />
              )}
              <div>
                <div className="weather-panel-current-temp">{formatTemp(current.temp)}</div>
                <div className="weather-panel-current-desc">
                  {capitalizeWords(current.description)}
                </div>
              </div>
            </div>

            <div className="weather-panel-stats">
              <div className="weather-panel-stat">
                <span className="weather-panel-stat-label">Feels like</span>
                <span className="weather-panel-stat-value">{formatTemp(current.feelsLike)}</span>
              </div>
              <div className="weather-panel-stat">
                <span className="weather-panel-stat-label">Humidity</span>
                <span className="weather-panel-stat-value">{current.humidity ?? '--'}%</span>
              </div>
              <div className="weather-panel-stat">
                <span className="weather-panel-stat-label">Wind</span>
                <span className="weather-panel-stat-value">{current.windSpeed ?? '--'} m/s</span>
              </div>
              <div className="weather-panel-stat">
                <span className="weather-panel-stat-label">Pressure</span>
                <span className="weather-panel-stat-value">{current.pressure ?? '--'} hPa</span>
              </div>
            </div>
          </div>

          {/* Hourly forecast */}
          {hourlyForecast.length > 0 && (
            <div className="weather-panel-section">
              <h3 className="weather-panel-section-title">Hourly Forecast</h3>
              <div className="weather-panel-hourly">
                {hourlyForecast.map((entry) => (
                  <div key={entry.dt} className="weather-panel-hourly-item">
                    <span className="weather-panel-hourly-time">{formatTime(entry.dt)}</span>
                    {entry.icon && (
                      <img
                        src={getWeatherIconUrl(entry.icon, 1)}
                        alt={entry.description}
                        width="32"
                        height="32"
                      />
                    )}
                    <span className="weather-panel-hourly-temp">{formatTemp(entry.temp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily forecast */}
          {dailyForecast.length > 0 && (
            <div className="weather-panel-section">
              <h3 className="weather-panel-section-title">5-Day Forecast</h3>
              <div className="weather-panel-daily">
                {dailyForecast.map((entry) => (
                  <div key={entry.dt} className="weather-panel-daily-item">
                    <span className="weather-panel-daily-date">{formatDate(entry.dt)}</span>
                    <div className="weather-panel-daily-icon-desc">
                      {entry.icon && (
                        <img
                          src={getWeatherIconUrl(entry.icon, 1)}
                          alt={entry.description}
                          width="28"
                          height="28"
                        />
                      )}
                      <span className="weather-panel-daily-desc">
                        {capitalizeWords(entry.description)}
                      </span>
                    </div>
                    <div className="weather-panel-daily-temps">
                      <span className="weather-panel-daily-high">{formatTemp(entry.tempMax)}</span>
                      <span className="weather-panel-daily-low">{formatTemp(entry.tempMin)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * WeatherPopup — Glassmorphic weather card displayed on country hover/click.
 *
 * Appears near the cursor (or bottom-center on mobile) with
 * current weather data. Includes loading skeleton and error states.
 *
 * Props:
 *   countryName  — Name of the hovered/clicked country
 *   weatherData  — Normalized weather response (from useWeather)
 *   loading      — Whether weather data is being fetched
 *   error        — Error message (if fetch failed)
 *   visible      — Whether the popup should be shown
 *   position     — { x, y } screen coordinates for desktop positioning
 *   onClose      — Callback to dismiss
 */

import { formatTemp, formatWind, getWeatherIconUrl, capitalizeWords } from '../../utils/formatters.js';

export default function WeatherPopup({
  countryName,
  weatherData,
  loading,
  error,
  visible,
  position,
  onClose,
}) {
  if (!visible || !countryName) return null;

  const current = weatherData?.current || null;
  const location = weatherData?.location || null;

  return (
    <div
      className="weather-popup"
      style={{
        top: position?.y != null ? position.y + 20 : undefined,
        left: position?.x != null ? position.x + 16 : undefined,
      }}
      id="weather-popup"
    >
      {/* Close button */}
      <button
        className="weather-popup-close"
        onClick={onClose}
        type="button"
        aria-label="Close weather popup"
      >
        ×
      </button>

      {/* Header: Country name */}
      <div className="weather-popup-header">
        <span className="weather-popup-label">Weather Info</span>
        <h3 className="weather-popup-country">
          {countryName}
          {location?.country && (
            <span className="weather-popup-country-code">{location.country}</span>
          )}
        </h3>
        {location?.name && location.name !== countryName && (
          <span className="weather-popup-city">{location.name}</span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="weather-popup-skeleton">
          <div className="ws-skeleton" style={{ width: '60%', height: 28, marginBottom: 8 }} />
          <div className="ws-skeleton" style={{ width: '80%', height: 14, marginBottom: 6 }} />
          <div className="ws-skeleton" style={{ width: '50%', height: 14 }} />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="weather-popup-error">
          <span className="weather-popup-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Weather data */}
      {current && !loading && !error && (
        <div className="weather-popup-body">
          <div className="weather-popup-main">
            {current.icon && (
              <img
                className="weather-popup-icon"
                src={getWeatherIconUrl(current.icon)}
                alt={current.description || 'Weather icon'}
                width="56"
                height="56"
              />
            )}
            <div className="weather-popup-temp">
              {formatTemp(current.temp)}
            </div>
          </div>

          {current.description && (
            <div className="weather-popup-desc">
              {capitalizeWords(current.description)}
            </div>
          )}

          <div className="weather-popup-details">
            <div className="weather-popup-detail">
              <span className="weather-popup-detail-label">Feels like</span>
              <span className="weather-popup-detail-value">{formatTemp(current.feelsLike)}</span>
            </div>
            <div className="weather-popup-detail">
              <span className="weather-popup-detail-label">Humidity</span>
              <span className="weather-popup-detail-value">
                {current.humidity != null ? `${current.humidity}%` : '--'}
              </span>
            </div>
            <div className="weather-popup-detail">
              <span className="weather-popup-detail-label">Wind</span>
              <span className="weather-popup-detail-value">
                {formatWind(current.windSpeed, current.windDeg)}
              </span>
            </div>
            {current.pressure != null && (
              <div className="weather-popup-detail">
                <span className="weather-popup-detail-label">Pressure</span>
                <span className="weather-popup-detail-value">{current.pressure} hPa</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

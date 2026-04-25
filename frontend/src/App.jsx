/**
 * App — Root component that composes the entire WeatherSphere application.
 *
 * Architecture:
 *   - GlobeMap handles all map rendering and user interactions
 *   - SearchBar provides location search with Mapbox Geocoding
 *   - WeatherPopup shows on country hover (desktop)
 *   - WeatherPanel slides in on country click for detailed forecast
 *   - LoadingOverlay displays during initial map load
 *   - ErrorBoundary catches any render crashes
 *
 * State management is intentionally kept in this single component
 * since the data flow is simple: map events → weather fetch → display.
 * No need for Context or state libraries at this scale.
 */

import { useState, useCallback, useRef } from 'react';

// Components
import GlobeMap from './components/GlobeMap/GlobeMap.jsx';
import GlobeControls from './components/GlobeMap/GlobeControls.jsx';
import SearchBar from './components/SearchBar/SearchBar.jsx';
import WeatherPopup from './components/Weather/WeatherPopup.jsx';
import WeatherPanel from './components/Weather/WeatherPanel.jsx';
import LoadingOverlay from './components/UI/LoadingOverlay.jsx';
import ErrorBoundary from './components/UI/ErrorBoundary.jsx';

// Hooks
import { useWeather } from './hooks/useWeather.js';

// Styles (component CSS imports)
import './components/GlobeMap/GlobeMap.css';
import './components/Weather/Weather.css';
import './components/SearchBar/SearchBar.css';
import './components/UI/UI.css';

// Constants
import {
  INITIAL_CENTER,
  INITIAL_ZOOM,
  HOVER_DEBOUNCE_MS,
} from './utils/constants.js';

export default function App() {
  // ── Map State ──────────────────────────────────────────────────────
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const mapRef = useRef(null);

  // ── Weather State (via custom hook) ────────────────────────────────
  const {
    data: weatherData,
    forecast,
    loading: weatherLoading,
    error: weatherError,
    fetchWeather,
    clearWeather,
  } = useWeather();

  // ── Popup State (hover) ────────────────────────────────────────────
  const [popupInfo, setPopupInfo] = useState({
    visible: false,
    countryName: null,
    position: { x: 0, y: 0 },
  });

  // ── Panel State (click) ────────────────────────────────────────────
  const [panelInfo, setPanelInfo] = useState({
    visible: false,
    countryName: null,
  });

  // Debounce hover weather fetches
  const hoverTimerRef = useRef(null);

  // ── Event Handlers ─────────────────────────────────────────────────

  /**
   * Called when the user hovers over a country on the globe.
   * Debounces the weather fetch to avoid excessive API calls during fast mouse movement.
   */
  const handleCountryHover = useCallback(
    (countryName, lat, lon) => {
      // Clear pending hover fetch
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }

      if (!countryName) {
        // Mouse left a country — hide popup
        setPopupInfo((prev) => ({ ...prev, visible: false }));
        return;
      }

      // Show popup immediately with country name, fetch weather with debounce
      setPopupInfo({
        visible: true,
        countryName,
        position: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      });

      hoverTimerRef.current = setTimeout(() => {
        fetchWeather(lat, lon);
      }, HOVER_DEBOUNCE_MS);
    },
    [fetchWeather]
  );

  /**
   * Called when the user clicks on a country.
   * Opens the detailed weather panel and triggers a weather fetch.
   */
  const handleCountryClick = useCallback(
    (countryName, lat, lon) => {
      // Close popup, open panel
      setPopupInfo((prev) => ({ ...prev, visible: false }));
      setPanelInfo({ visible: true, countryName });
      fetchWeather(lat, lon);
    },
    [fetchWeather]
  );

  /**
   * Called when a location is selected from the search bar.
   * Flies globe to the location and opens the weather panel.
   */
  const handleLocationSelect = useCallback(
    (location) => {
      setSelectedLocation({
        lat: location.lat,
        lon: location.lon,
        zoom: 5,
        bbox: location.bbox,
      });
      setPanelInfo({ visible: true, countryName: location.name });
      fetchWeather(location.lat, location.lon);
    },
    [fetchWeather]
  );

  const handleClosePopup = useCallback(() => {
    setPopupInfo((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelInfo({ visible: false, countryName: null });
    clearWeather();
  }, [clearWeather]);

  // ── Globe Control Handlers ─────────────────────────────────────────
  // Use the Mapbox map instance exposed via mapRef to control zoom/pitch.

  const handleZoomIn = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomIn({ duration: 300 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.zoomOut({ duration: 300 });
  }, []);

  const handleTiltToggle = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    // Toggle between flat (0°) and tilted (45°) views
    const currentPitch = map.getPitch();
    map.easeTo({
      pitch: currentPitch > 10 ? 0 : 45,
      duration: 800,
    });
  }, []);

  const handleResetView = useCallback(() => {
    setSelectedLocation({
      lat: INITIAL_CENTER[1],
      lon: INITIAL_CENTER[0],
      zoom: INITIAL_ZOOM,
    });
  }, []);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      {/* Loading screen while map initializes */}
      <LoadingOverlay isLoading={!mapLoaded} />

      {/* 3D Globe — passes mapRef so we can control it externally */}
      <GlobeMap
        onCountryHover={handleCountryHover}
        onCountryClick={handleCountryClick}
        onMapLoaded={() => setMapLoaded(true)}
        selectedLocation={selectedLocation}
        mapRef={mapRef}
      />

      {/* Search bar (appears after map loads) */}
      {mapLoaded && (
        <SearchBar onLocationSelect={handleLocationSelect} />
      )}

      {/* Globe controls */}
      {mapLoaded && (
        <GlobeControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onTiltToggle={handleTiltToggle}
          onResetView={handleResetView}
        />
      )}

      {/* Weather popup (hover) — only on desktop */}
      <WeatherPopup
        countryName={popupInfo.countryName}
        weatherData={weatherData}
        loading={weatherLoading}
        error={weatherError}
        visible={popupInfo.visible && !panelInfo.visible}
        position={popupInfo.position}
        onClose={handleClosePopup}
      />

      {/* Weather panel (click — detailed forecast) */}
      <WeatherPanel
        visible={panelInfo.visible}
        countryName={panelInfo.countryName}
        weatherData={weatherData}
        forecast={forecast}
        loading={weatherLoading}
        error={weatherError}
        onClose={handleClosePanel}
      />
    </ErrorBoundary>
  );
}
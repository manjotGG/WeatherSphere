/**
 * GlobeMap — The core 3D globe component powered by Mapbox GL JS.
 *
 * Architecture:
 *   - Initializes a Mapbox GL map with `projection: 'globe'`
 *   - Uses Mapbox's built-in country-boundaries source for hover detection
 *     (replaces 100+ lines of manual raycasting / point-in-polygon code)
 *   - Manages two interaction modes:
 *       1. Hover → highlight country + emit event for weather fetch
 *       2. Click → select country, show popup, open weather panel
 *   - Globe atmosphere and fog effects create the "floating in space" look
 *   - Exposes map instance via `mapRef` prop for external controls
 *
 * Props:
 *   onCountryHover(countryName, lat, lon) — called when user hovers a country
 *   onCountryClick(countryName, lat, lon) — called when user clicks a country
 *   onMapLoaded() — called once the map finishes initial load
 *   selectedLocation — { lat, lon, zoom? } to fly to externally (search)
 *   mapRef — mutable ref object to receive the Mapbox map instance
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  MAP_STYLE,
  INITIAL_CENTER,
  INITIAL_ZOOM,
  INITIAL_PITCH,
  INITIAL_BEARING,
  MIN_ZOOM,
  MAX_ZOOM,
  COUNTRY_FILL_LAYER,
  COUNTRY_LINE_LAYER,
  COUNTRY_HIGHLIGHT_LAYER,
  COUNTRY_HIGHLIGHT_LINE_LAYER,
} from '../../utils/constants.js';

/**
 * Set the Mapbox access token from environment.
 * This runs once at module load time.
 */
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

export default function GlobeMap({
  onCountryHover,
  onCountryClick,
  onMapLoaded,
  selectedLocation,
  mapRef: externalMapRef,
}) {
  const containerRef = useRef(null);
  const internalMapRef = useRef(null);
  const hoveredCountryRef = useRef(null);

  // Store callback props in refs so the initialization effect (which runs once)
  // always calls the latest version without needing them as dependencies.
  const onCountryHoverRef = useRef(onCountryHover);
  const onCountryClickRef = useRef(onCountryClick);
  const onMapLoadedRef = useRef(onMapLoaded);
  const externalMapRefStable = useRef(externalMapRef);

  // Sync callback props into refs inside an effect (React 19 forbids
  // ref writes during render). The map init effect reads these refs
  // so it always invokes the latest callback without re-running.
  useEffect(() => {
    onCountryHoverRef.current = onCountryHover;
    onCountryClickRef.current = onCountryClick;
    onMapLoadedRef.current = onMapLoaded;
    externalMapRefStable.current = externalMapRef;
  });

  // ── Initialize Map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || internalMapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      pitch: INITIAL_PITCH,
      bearing: INITIAL_BEARING,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      projection: 'globe',          // 3D globe projection
      antialias: true,
      fadeDuration: 0,               // Crisp layer transitions
    });

    internalMapRef.current = map;

    // Expose map instance to parent via ref
    if (externalMapRefStable.current) {
      externalMapRefStable.current.current = map;
    }

    // ── Globe Atmosphere ───────────────────────────────────────────
    // Adds the subtle blue haze around the globe edges
    map.on('style.load', () => {
      map.setFog({
        color: 'rgba(10, 20, 40, 0.9)',          // Dark space fog
        'high-color': 'rgba(20, 40, 80, 0.6)',   // Upper atmosphere
        'horizon-blend': 0.08,                     // Thin glow line
        'space-color': '#040913',                  // Match our bg color
        'star-intensity': 0.8,                     // Built-in starfield
      });
    });

    // ── Add Country Layers ─────────────────────────────────────────
    map.on('load', () => {
      // Mapbox has a built-in country-boundaries tileset.
      // We add an invisible fill layer for hit-testing and a visible
      // highlight layer that we toggle per-country via filters.

      map.addSource('country-boundaries', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1',
      });

      // Invisible fill for hover detection
      map.addLayer({
        id: COUNTRY_FILL_LAYER,
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': 0,              // Invisible — only for interaction
        },
      });

      // Highlight fill — only active country (filter starts empty)
      map.addLayer({
        id: COUNTRY_HIGHLIGHT_LAYER,
        type: 'fill',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            1, 0.12,
            6, 0.06,
          ],
        },
        filter: ['==', 'iso_3166_1', ''],   // Empty = nothing highlighted
      });

      // Highlight border line
      map.addLayer({
        id: COUNTRY_HIGHLIGHT_LINE_LAYER,
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': '#38bdf8',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            1, 0.8,
            6, 1.5,
          ],
          'line-opacity': 0.7,
        },
        filter: ['==', 'iso_3166_1', ''],
      });

      // Subtle country borders visible at all times
      map.addLayer({
        id: COUNTRY_LINE_LAYER,
        type: 'line',
        source: 'country-boundaries',
        'source-layer': 'country_boundaries',
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.08)',
          'line-width': 0.5,
        },
      });

      onMapLoadedRef.current?.();
    });

    // ── Hover Interaction ──────────────────────────────────────────
    map.on('mousemove', COUNTRY_FILL_LAYER, (e) => {
      if (!e.features?.length) return;

      const feature = e.features[0];
      const countryName = feature.properties.name_en || feature.properties.name || '';
      const iso = feature.properties.iso_3166_1 || '';

      // Only update if we moved to a new country
      if (hoveredCountryRef.current === iso) return;
      hoveredCountryRef.current = iso;

      // Update highlight filter to show this country
      map.setFilter(COUNTRY_HIGHLIGHT_LAYER, ['==', 'iso_3166_1', iso]);
      map.setFilter(COUNTRY_HIGHLIGHT_LINE_LAYER, ['==', 'iso_3166_1', iso]);

      map.getCanvas().style.cursor = 'pointer';

      // Emit hover event with the center of the feature or click point
      const { lng, lat } = e.lngLat;
      onCountryHoverRef.current?.(countryName, lat, lng);
    });

    map.on('mouseleave', COUNTRY_FILL_LAYER, () => {
      hoveredCountryRef.current = null;
      map.setFilter(COUNTRY_HIGHLIGHT_LAYER, ['==', 'iso_3166_1', '']);
      map.setFilter(COUNTRY_HIGHLIGHT_LINE_LAYER, ['==', 'iso_3166_1', '']);
      map.getCanvas().style.cursor = 'grab';
      onCountryHoverRef.current?.(null, null, null);
    });

    // ── Click Interaction ──────────────────────────────────────────
    map.on('click', COUNTRY_FILL_LAYER, (e) => {
      if (!e.features?.length) return;

      const feature = e.features[0];
      const countryName = feature.properties.name_en || feature.properties.name || '';
      const { lng, lat } = e.lngLat;

      onCountryClickRef.current?.(countryName, lat, lng);
    });

    // ── Cursor reset when off the globe ────────────────────────────
    map.on('mouseout', () => {
      map.getCanvas().style.cursor = 'grab';
    });

    // Default cursor
    map.getCanvas().style.cursor = 'grab';

    // ── Cleanup ────────────────────────────────────────────────────
    return () => {
      map.remove();
      internalMapRef.current = null;
      if (externalMapRefStable.current) {
        externalMapRefStable.current.current = null;
      }
    };
  }, []); // Empty deps — map initializes once

  // ── Fly to selected location (from search) ─────────────────────────
  useEffect(() => {
    if (!selectedLocation || !internalMapRef.current) return;

    const { lat, lon, zoom, bbox } = selectedLocation;

    if (bbox) {
      internalMapRef.current.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        { padding: 80, duration: 2500, essential: true }
      );
    } else {
      internalMapRef.current.flyTo({
        center: [lon, lat],
        zoom: zoom || 5,
        pitch: 30,
        duration: 2500,
        essential: true,
      });
    }
  }, [selectedLocation]);

  return (
    <div
      ref={containerRef}
      className="globe-map-container"
      id="globe-map"
    />
  );
}

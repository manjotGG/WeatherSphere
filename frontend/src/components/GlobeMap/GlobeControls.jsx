/**
 * GlobeControls — Glassmorphic control panel for the 3D globe.
 *
 * Provides:
 *   - Zoom in / Zoom out
 *   - Tilt toggle (0° ↔ 45°)
 *   - Reset view (return to initial globe position)
 *
 * Receives the Mapbox map instance via a ref-forwarding pattern,
 * but to keep things simple we pass imperative callbacks from the parent.
 */

export default function GlobeControls({ onZoomIn, onZoomOut, onTiltToggle, onResetView }) {
  return (
    <div className="globe-controls" id="globe-controls">
      <button
        className="globe-control-btn"
        onClick={onZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
        type="button"
        id="btn-zoom-in"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <button
        className="globe-control-btn"
        onClick={onZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
        type="button"
        id="btn-zoom-out"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="globe-controls-divider" />

      <button
        className="globe-control-btn"
        onClick={onTiltToggle}
        title="Toggle tilt"
        aria-label="Toggle tilt"
        type="button"
        id="btn-tilt"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <ellipse cx="9" cy="12" rx="7" ry="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M9 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="9" cy="3" r="1.5" fill="currentColor" />
        </svg>
      </button>

      <button
        className="globe-control-btn"
        onClick={onResetView}
        title="Reset view"
        aria-label="Reset view"
        type="button"
        id="btn-reset"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 9a6 6 0 1 1 1.06 3.39" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M3 13V9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

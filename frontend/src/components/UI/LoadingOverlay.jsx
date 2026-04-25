/**
 * LoadingOverlay — Full-screen loading state while the map initializes.
 *
 * Shows animated globe rings and pulsing text.
 * Fades out once the map fires its 'load' event.
 *
 * Uses a CSS transition + transitionend event (no setState in effect)
 * to handle the fade-out unmount timing.
 */

import { useRef, useCallback } from 'react';

export default function LoadingOverlay({ isLoading }) {
  const overlayRef = useRef(null);

  // After the CSS fade-out transition ends, hide via display:none
  const handleTransitionEnd = useCallback(() => {
    if (!isLoading && overlayRef.current) {
      overlayRef.current.style.display = 'none';
    }
  }, [isLoading]);

  return (
    <div
      ref={overlayRef}
      className="loading-overlay"
      style={{ opacity: isLoading ? 1 : 0 }}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="loading-content">
        {/* Animated globe rings */}
        <div className="loading-globe">
          <div className="loading-ring loading-ring-1" />
          <div className="loading-ring loading-ring-2" />
          <div className="loading-ring loading-ring-3" />
          <div className="loading-dot" />
        </div>
        <div className="loading-text">Loading WeatherSphere</div>
        <div className="loading-subtext">Preparing your 3D globe experience…</div>
      </div>
    </div>
  );
}

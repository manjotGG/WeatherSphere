/**
 * ErrorBoundary — Catches render errors and shows a fallback UI.
 *
 * Wrapping the globe in this prevents a blank screen if Mapbox GL
 * encounters an unexpected error (e.g. WebGL context lost).
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.message || 'Something went wrong' };
  }

  componentDidCatch(error, info) {
    console.error('[WeatherSphere] Render error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h2 className="error-boundary-title">Something went wrong</h2>
            <p className="error-boundary-message">{this.state.errorMessage}</p>
            <button
              className="error-boundary-retry"
              onClick={this.handleRetry}
              type="button"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

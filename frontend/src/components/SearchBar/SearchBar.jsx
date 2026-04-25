/**
 * SearchBar — Location search with Mapbox Geocoding autocomplete.
 *
 * Features:
 *   - Debounced input → Mapbox Geocoding API
 *   - Dropdown with matching locations
 *   - On select: emits location for globe fly-to + weather fetch
 *   - Keyboard accessible (Enter to select first, Escape to close)
 *
 * React 19 compliance:
 *   - No synchronous setState inside effects
 *   - Loading state derived from pending async work
 *
 * Props:
 *   onLocationSelect({ name, lat, lon, bbox }) — called when user picks a result
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDebounce } from '../../hooks/useDebounce.js';
import { searchLocations } from '../../services/geocodeService.js';
import { SEARCH_DEBOUNCE_MS } from '../../utils/constants.js';

export default function SearchBar({ onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  // Derive whether we should search based on query length
  const shouldSearch = debouncedQuery && debouncedQuery.length >= 2;

  // Derive loading state: we're loading when query has changed
  // but results haven't been updated for it yet.
  // This avoids synchronous setState in the effect.
  const [lastFetchedQuery, setLastFetchedQuery] = useState('');
  const loading = shouldSearch && debouncedQuery !== lastFetchedQuery;

  // Fetch results when debounced query changes
  useEffect(() => {
    if (!shouldSearch) return;

    // Cancel previous request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;

    searchLocations(debouncedQuery, { limit: 5, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted && requestIdRef.current === requestId) {
          setResults(data);
          setIsOpen(data.length > 0);
          setActiveIndex(-1);
          setLastFetchedQuery(debouncedQuery);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError' && requestIdRef.current === requestId) {
          setResults([]);
          setIsOpen(false);
          setLastFetchedQuery(debouncedQuery);
        }
      });

    return () => controller.abort();
  }, [shouldSearch, debouncedQuery]);

  const handleSelect = useCallback(
    (location) => {
      setQuery(location.name);
      setIsOpen(false);
      setResults([]);
      setLastFetchedQuery('');
      onLocationSelect?.(location);
    },
    [onLocationSelect]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        const idx = activeIndex >= 0 ? activeIndex : 0;
        handleSelect(results[idx]);
      }
    },
    [results, activeIndex, handleSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.search-bar')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="search-bar" id="search-bar">
      <div className="search-bar-input-wrapper">
        {/* Search icon */}
        <svg className="search-bar-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          className="search-bar-input"
          type="text"
          placeholder="Search any location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          autoComplete="off"
          spellCheck="false"
          id="search-input"
          aria-label="Search locations"
        />

        {/* Loading indicator */}
        {loading && <div className="search-bar-spinner" />}

        {/* Clear button */}
        {query && !loading && (
          <button
            className="search-bar-clear"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              setLastFetchedQuery('');
              inputRef.current?.focus();
            }}
            type="button"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <ul className="search-bar-dropdown" role="listbox">
          {results.map((result, i) => (
            <li
              key={`${result.lat}-${result.lon}`}
              className={`search-bar-item ${i === activeIndex ? 'search-bar-item--active' : ''}`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setActiveIndex(i)}
              role="option"
              aria-selected={i === activeIndex}
            >
              <svg className="search-bar-item-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1C4.79 1 3 2.79 3 5c0 3.25 4 7 4 7s4-3.75 4-7c0-2.21-1.79-4-4-4z" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="7" cy="5" r="1.5" fill="currentColor" />
              </svg>
              <span className="search-bar-item-text">{result.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

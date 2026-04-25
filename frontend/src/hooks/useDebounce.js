/**
 * useDebounce — Debounce a value by a given delay.
 *
 * Returns the debounced value which only updates after `delay` ms
 * of inactivity. Useful for search inputs and hover events to avoid
 * excessive API calls.
 */

import { useState, useEffect } from 'react';

/**
 * @template T
 * @param {T} value     The value to debounce
 * @param {number} delay  Delay in milliseconds
 * @returns {T}  The debounced value
 */
export function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

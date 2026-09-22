"use client";

import { useEffect, useState } from "react";

/**
 * Hold a value still until the user stops changing it.
 *
 * Search boxes were passing their raw value straight into a query hook, so
 * every keystroke fired a request — typing "Jpeg" meant four round trips, the
 * list flickering through four states, and the first letter's result often
 * arriving last. Passing the debounced value instead means one request once
 * typing settles.
 *
 * 400ms is roughly the gap between "still typing" and "waiting for an answer";
 * below ~250ms a fast typist still triggers several requests, above ~600ms the
 * pause starts to feel like the page has missed the input.
 *
 * Note this only delays the value handed to the query — bind the input itself
 * to the immediate state so typing never feels laggy.
 */
export function useDebouncedValue<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return debounced;
}

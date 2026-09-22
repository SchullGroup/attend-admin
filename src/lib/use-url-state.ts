"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/lib/use-debounced-value";

/**
 * Keep list-page filters in the URL instead of component state.
 *
 * Every list screen had the same bug: search something, open a row, press
 * back — and you are on the unfiltered first page again, retyping. Reload was
 * worse, because it looked like the app had lost the work. Component state
 * dies with the component; the query string survives a reload, the back
 * button, a bookmark and a link pasted to a colleague.
 *
 * router.replace rather than push, so filtering does not fill the history
 * stack — back should leave the page, not step through every keystroke.
 *
 * NOTE: useSearchParams suspends, so any page using these hooks needs a
 * <Suspense> boundary above the component that calls them. The usual shape is
 * a `PageInner` holding the hooks and a default export that wraps it.
 */

/**
 * Write several params in one go.
 *
 * Needed wherever one control changes two params — picking a registrar also
 * clears the register under it, a new search also returns to page 1. Two
 * separate single-key writes in the same handler both start from the same
 * snapshot of the URL, so the second silently undoes the first.
 *
 * A null (or empty) value removes the key, keeping default states out of the
 * URL: `/events` rather than `/events?q=&status=&page=0`.
 */
/**
 * Writes that have gone to router.replace but are not yet reflected in
 * useSearchParams, keyed by path.
 *
 * router.replace does not update useSearchParams synchronously, so two writes
 * in the same tick — a page with several debounced fields, or a handler that
 * sets one param and schedules another — would both build on the pre-write
 * snapshot and the second would drop the first. Replaying the pending writes
 * on top of the snapshot makes the second write see the first. Cleared as soon
 * as the snapshot catches up, so nothing stale survives a real navigation.
 */
const pendingWrites = new Map<string, { basis: string; updates: Record<string, string | null> }>();

export function useUrlParamWriter() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const snapshot     = searchParams.toString();

  return useCallback(
    (updates: Record<string, string | null>) => {
      const pending = pendingWrites.get(pathname);
      const carried = pending && pending.basis === snapshot ? pending.updates : {};
      const merged  = { ...carried, ...updates };

      const params = new URLSearchParams(snapshot);
      for (const [key, next] of Object.entries(merged)) {
        if (next) params.set(key, next);
        else params.delete(key);
      }

      pendingWrites.set(pathname, { basis: snapshot, updates: merged });

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, snapshot]
  );
}

/** One param, read/write, shaped like useState. */
export function useUrlState(key: string, fallback = "") {
  const searchParams = useSearchParams();
  const write        = useUrlParamWriter();
  const value        = searchParams.get(key) ?? fallback;
  const setValue     = useCallback((next: string | null) => write({ [key]: next }), [write, key]);
  return [value, setValue] as const;
}

/**
 * A param constrained to a known set — tab names, statuses, view modes.
 *
 * A hand-edited or stale URL should land on the default view, not on a tab
 * that does not exist and renders nothing.
 */
export function useUrlEnumState<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const [raw, setRaw] = useUrlState(key, fallback);
  const value = (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  const setValue = useCallback((next: T) => setRaw(next === fallback ? null : next), [setRaw, fallback]);
  return [value, setValue] as const;
}

/**
 * A page number in the URL, guarded against `?page=banana` becoming NaN.
 *
 * The setter takes a number or an updater function, so this is a drop-in
 * replacement for `useState(0)` — every pager in the app is written as
 * `setPage(p => p + 1)` and silently breaking that shape is not worth the
 * saved line.
 */
export function useUrlPageState(key = "page") {
  const [raw, setRaw] = useUrlState(key);
  const parsed = Number.parseInt(raw, 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const setPage = useCallback(
    (next: number | ((prev: number) => number)) => {
      const value = typeof next === "function" ? next(page) : next;
      setRaw(value > 0 ? String(value) : null);
    },
    [setRaw, page]
  );

  return [page, setPage] as const;
}

/**
 * Search box backed by a URL param, debounced.
 *
 * Returns [draft, setDraft, settled]:
 *   - bind the input to `draft` so typing is never laggy,
 *   - pass `settled` to the query hook so one request goes out per search
 *     rather than one per keystroke,
 *   - the URL follows `settled` too, so a reload restores the same search.
 *
 * `onSettle` runs alongside the URL write when the term changes — pass the
 * extra params a new search should reset, usually `{ page: null }`.
 */
export function useUrlSearchState(
  key = "q",
  ms = 500,
  onSettle?: Record<string, string | null>
) {
  const searchParams = useSearchParams();
  const write        = useUrlParamWriter();
  const urlValue     = searchParams.get(key) ?? "";

  const [draft, setDraft] = useState(urlValue);
  const settled = useDebouncedValue(draft, ms);

  useEffect(() => {
    if (settled !== urlValue) write({ [key]: settled, ...(onSettle ?? {}) });
    // Deliberately keyed on `settled` alone: including `urlValue` or `write`
    // re-runs this on every URL change, which fights other filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  return [draft, setDraft, settled] as const;
}

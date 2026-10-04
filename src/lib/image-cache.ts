"use client";

/**
 * image-cache — stop logos/avatars from re-downloading on every navigation.
 *
 * Why this exists: logo and avatar URLs are OBS/S3 **pre-signed** URLs. The
 * backend re-signs them on every response, so `AccessKeyId` / `Expires` /
 * `Signature` change each time — which means the browser sees a brand-new URL
 * on every render and re-fetches the exact same image. Leaving a page and
 * coming back re-signs again, so the image flickers/reloads every time.
 *
 * The fix is to key each image by its STABLE identity (origin + path, minus the
 * volatile signing params) and:
 *   1. pin the first signed URL we saw for that key, and reuse it for the rest
 *      of the session, so repeat renders hit the browser HTTP cache instead of
 *      a freshly-signed miss;
 *   2. remember which keys have already decoded, so a revisit paints instantly
 *      with no reload flash;
 *   3. expose a preloader that decodes off-DOM, so a new image is fully loaded
 *      "somewhere" before anything on screen swaps to it.
 */

// Query params that change per signature and must NOT be part of the identity.
const VOLATILE = new Set([
  "AccessKeyId", "Expires", "Signature",
  "X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date", "X-Amz-Expires",
  "X-Amz-SignedHeaders", "X-Amz-Signature", "X-Amz-Security-Token",
  "x-obs-security-token", "token",
]);

/** Stable identity for an image URL — origin + path + any non-signing query. */
export function imageKey(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.href : "http://local");
    const kept = [...u.searchParams.entries()]
      .filter(([k]) => !VOLATILE.has(k))
      .sort(([a], [b]) => a.localeCompare(b));
    const q = kept.map(([k, v]) => `${k}=${v}`).join("&");
    return `${u.origin}${u.pathname}${q ? "?" + q : ""}`;
  } catch {
    return url; // relative or non-URL — use verbatim
  }
}

const pinned   = new Map<string, string>(); // key -> first signed URL seen
const loaded   = new Set<string>();         // keys decoded at least once this session
const inflight = new Map<string, Promise<boolean>>();

/** The URL to actually render: the pinned one for this key, so the cache hits. */
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const key = imageKey(url);
  if (!key) return url;
  const existing = pinned.get(key);
  if (existing) return existing;
  pinned.set(key, url);
  return url;
}

/** Has this image already decoded this session? (revisit = instant, no flash) */
export function isImageLoaded(url?: string | null): boolean {
  const key = imageKey(url);
  return key ? loaded.has(key) : false;
}

/**
 * Drop the pin/loaded state for an image — call on <img> error so a stale
 * (e.g. expired-signature) pin is abandoned and the next render re-pins from
 * the current, freshly-signed prop URL.
 */
export function invalidateImage(url?: string | null): void {
  const key = imageKey(url);
  if (!key) return;
  pinned.delete(key);
  loaded.delete(key);
  inflight.delete(key);
}

/** Decode the image off-DOM; resolves true once ready (or already cached). */
export function preloadImage(url?: string | null): Promise<boolean> {
  const key = imageKey(url);
  const src = resolveImageUrl(url);
  if (!key || !src) return Promise.resolve(false);
  if (loaded.has(key)) return Promise.resolve(true);
  const running = inflight.get(key);
  if (running) return running;
  if (typeof window === "undefined") return Promise.resolve(false);
  const p = new Promise<boolean>((resolve) => {
    const img = new window.Image();
    img.onload  = () => { loaded.add(key); inflight.delete(key); resolve(true); };
    img.onerror = () => { inflight.delete(key); resolve(false); };
    img.src = src;
  });
  inflight.set(key, p);
  return p;
}

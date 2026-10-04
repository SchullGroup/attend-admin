"use client";

/**
 * CachedImage — a drop-in <img> that doesn't re-download on navigation.
 *
 * Uses the stable-key image cache (see lib/image-cache): it renders the pinned
 * URL so the browser cache is reused across renders/navigations, preloads the
 * image off-DOM, and only paints once it's decoded — so a freshly-uploaded logo
 * is loaded "somewhere" before it ever appears, and a revisit shows instantly
 * with no flash. On load failure it renders the supplied fallback instead of a
 * torn-image icon.
 */

import { useEffect, useState } from "react";
import {
  resolveImageUrl,
  isImageLoaded,
  preloadImage,
  invalidateImage,
} from "@/lib/image-cache";

interface CachedImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Shown while the image hasn't decoded yet and when it fails to load. */
  fallback?: React.ReactNode;
}

export function CachedImage({ src, alt = "", className, style, fallback = null }: CachedImageProps) {
  const resolved = resolveImageUrl(src);
  const [ready, setReady]   = useState<boolean>(() => isImageLoaded(src));
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    if (!resolved) { setReady(false); return; }
    if (isImageLoaded(src)) { setReady(true); return; }
    setReady(false);
    preloadImage(src).then((ok) => {
      if (!alive) return;
      setReady(ok);
      setFailed(!ok);
    });
    return () => { alive = false; };
  // resolved is stable per logical image, so this runs once per real change
  }, [resolved]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!resolved || failed) return <>{fallback}</>;
  if (!ready) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={className}
      style={style}
      onError={() => { invalidateImage(src); setFailed(true); }}
    />
  );
}

export default CachedImage;

"use client";

/**
 * CachedImage — an <img> whose URL is pinned by stable identity so it isn't
 * re-downloaded every time the backend re-signs the URL or the component
 * remounts (see lib/image-cache). Renders the image directly — the browser's
 * own HTTP cache does the heavy lifting once the URL is stable — and falls back
 * to `fallback` only if it genuinely fails to load.
 */

import { useEffect, useState } from "react";
import { resolveImageUrl, invalidateImage } from "@/lib/image-cache";

interface CachedImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Shown only when there is no src or the image fails to load. */
  fallback?: React.ReactNode;
}

export function CachedImage({ src, alt = "", className, style, fallback = null }: CachedImageProps) {
  const resolved = resolveImageUrl(src);
  const [failed, setFailed] = useState(false);

  // A new image deserves a fresh attempt.
  useEffect(() => { setFailed(false); }, [resolved]);

  if (!resolved || failed) return <>{fallback}</>;

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

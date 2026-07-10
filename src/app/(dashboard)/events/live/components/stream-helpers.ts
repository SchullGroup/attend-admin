export function isZoomUrl(url: string) {
  return /zoom\.us\/j\/|zoomus\.cn\/j\//.test(url);
}

export function isGoogleMeetUrl(url: string) {
  return /meet\.google\.com\//.test(url);
}

export function isYoutubeUrl(url: string) {
  return /(?:youtu\.be\/|youtube\.com\/)/.test(url);
}

/**
 * True when the URL is a youtube.com/youtu.be link but has no resolvable
 * 11-char video ID — e.g. a channel's vanity "/live" or "/@handle/live" page.
 * These pages set X-Frame-Options / CSP frame-ancestors and refuse to load in
 * an iframe ("youtube.com refused to connect"), unlike /embed/{videoId} URLs
 * which explicitly allow framing. Caller should show an "Open in YouTube"
 * fallback instead of iframing these directly.
 */
export function isUnembeddableYoutubeUrl(url: string) {
  return isYoutubeUrl(url) && !/\/embed\//.test(parseStreamUrl(url));
}

export function parseStreamUrl(url: string): string {
  // Already an embed URL — pass through untouched.
  if (/youtube\.com\/embed\//.test(url)) return url;
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|shorts\/|embed\/))([A-Za-z0-9_-]{11})/
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=0&controls=1&rel=0&modestbranding=1`;
  return url;
}

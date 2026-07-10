import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Sets Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy on both
// /zoom-meeting.html AND /events/live — required for SharedArrayBuffer,
// which Zoom's Ribbon/Gallery view need internally.
//
// Confirmed via DevTools that /zoom-meeting.html's response DID carry
// these headers correctly (credentialless / same-origin) while scoped to
// that path alone, yet window.crossOriginIsolated still read false inside
// that iframe. That means the "credentialless nested frame doesn't need
// its ancestor to also opt in" shortcut does not hold here — the ancestor
// document (/events/live) needs COEP too for the child's isolation to
// actually take effect.
//
// The YouTube <iframe> on /events/live (StreamPreviewCard.tsx) is a
// genuine cross-origin embed that does NOT send back a
// Cross-Origin-Resource-Policy header, so once /events/live itself has
// COEP, that iframe would normally be blocked. Fixed by adding the HTML
// `credentialless` attribute directly on that <iframe> tag — Chrome's
// purpose-built mechanism for letting an isolated page embed a
// non-cooperating cross-origin iframe without breaking either side.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (pathname === "/zoom-meeting.html" || pathname === "/events/live") {
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  }

  return response;
}

export const config = {
  matcher: ["/zoom-meeting.html", "/events/live"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// next.config.ts's headers() does not reliably apply custom headers to
// static files served from /public (known Next.js behavior/issue — public
// folder assets can bypass the headers() pipeline). Middleware runs on
// every request, including public file requests, so it's used here instead
// to guarantee zoom-meeting.html gets Cross-Origin-Opener-Policy /
// Cross-Origin-Embedder-Policy, making that iframe cross-origin-isolated
// (required for SharedArrayBuffer, which Zoom's Ribbon/Gallery view need).
//
// Scoped to this one path only — the rest of the app (including the
// YouTube iframe on /events/live) must NOT get these headers, or YouTube
// embeds break again.
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  return response;
}

export const config = {
  matcher: "/zoom-meeting.html",
};

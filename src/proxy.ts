import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );
  const hasToken = !!request.cookies.get("accessToken");

  if (!isPublicRoute && !hasToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicRoute && hasToken && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();

  // ── Cross-origin isolation for the Zoom Meeting SDK ──────────────────────
  // The SDK's Gallery/Ribbon views need SharedArrayBuffer, which needs
  // crossOriginIsolated === true inside /zoom-meeting.html. For that, BOTH
  // the top-level page (/events/live) and the iframe document
  // (/zoom-meeting.html) must carry COOP + COEP — headers on the iframe
  // alone are not enough.
  //
  // COEP is `credentialless` (not `require-corp`) so cross-origin no-cors
  // subresources still load without CORP headers: the Zoom CDN <script>s
  // inside the iframe, and the YouTube embed on /events/live (which already
  // sets the `credentialless` iframe attribute for exactly this case —
  // see StreamPreviewCard.tsx).
  //
  // This is THE single mechanism for isolation. The coi-serviceworker
  // approach was abandoned (zoom-meeting.html still unregisters leftovers),
  // and next.config.ts headers() was dropped because it doesn't reliably
  // reach files under /public. Keep it scoped — COOP/COEP on the whole
  // dashboard would break other cross-origin embeds.
  if (pathname === "/zoom-meeting.html" || pathname.startsWith("/events/live")) {
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|eot)$).*)"],
};

import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Server-side proxy for GET /api/v1/client/analytics/event-performance.
//
// Why this exists: the browser-visible URL for that endpoint gets silently
// killed by ad/privacy-blocker extensions (uBlock Origin Lite etc.) — Chrome
// DevTools shows `net::ERR_BLOCKED_BY_CLIENT` on it, 0 bytes, request never
// even leaves the browser. Filter lists commonly blocklist any URL matching
// "event-performance" / "*performance*" as an analytics/tracking pattern.
// Every other /analytics/* endpoint (stats, by-type, rsvps-by-event, etc.)
// loads fine — this is the only one whose name happens to collide with a
// generic ad-tracker rule.
//
// Fix: route this one call through our own Next.js server instead of
// hitting the external API directly from the browser. The browser only ever
// sees a same-origin request to a neutrally-named path
// (/api/reports/event-summary), which no filter list flags. The actual
// outbound call to attend-api happens server-side, invisible to any
// browser-installed extension.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") ?? "0";
  const size = searchParams.get("size") ?? "10";

  const authHeader = request.headers.get("authorization");

  try {
    const upstream = await fetch(
      `${API_URL}/api/v1/client/analytics/event-performance?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        cache: "no-store",
      }
    );

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error("Event summary proxy error:", error);
    return NextResponse.json(
      { status: false, message: "Proxy request to analytics service failed" },
      { status: 502 }
    );
  }
}

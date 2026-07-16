import { NextResponse } from "next/server";

/**
 * ⚠️ DEAD ROUTE — kept only for reference, returns 410 Gone.
 *
 * This route fetched a ZAK from `GET https://api.zoom.us/v2/users/me/token`
 * authenticated with a self-signed HS256 JWT built from ZOOM_SDK_KEY /
 * ZOOM_SDK_SECRET — i.e. it assumed a Zoom **JWT App**. Zoom discontinued
 * JWT apps entirely in September 2023, so this call can only 401 now.
 *
 * Nothing in the frontend calls this route. Fresh ZAKs are obtained via
 * /api/zoom/refresh-meeting, which proxies to the backend's
 * Server-to-Server OAuth integration (POST /api/v1/client/events/{id}/zoom)
 * and extracts the ZAK from the returned startUrl.
 *
 * If a standalone ZAK endpoint is ever needed again, it must go through the
 * backend's S2S OAuth app — it cannot be done from this Next.js server with
 * SDK credentials.
 */
export async function GET() {
  return NextResponse.json(
    { error: "Gone: this route relied on Zoom JWT apps, discontinued by Zoom in 2023. Use /api/zoom/refresh-meeting instead." },
    { status: 410 }
  );
}

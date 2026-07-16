import { NextResponse } from "next/server";

/**
 * ⚠️ DEAD ROUTE — kept only for reference, returns 410 Gone.
 *
 * This route listed and force-ended live meetings by calling the Zoom API
 * with a self-signed JWT (Zoom **JWT App** auth). Zoom discontinued JWT
 * apps in September 2023, so these calls can only 401 now. It was also
 * never wired up: no frontend code calls it, and the "auto end-active
 * before retrying error 3000" behavior it was built for was never
 * implemented (error 3000 shows manual guidance in zoom-embed.tsx instead).
 *
 * If force-ending stale meetings is needed, it must be implemented on the
 * backend using its Server-to-Server OAuth Zoom app.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Gone: this route relied on Zoom JWT apps, discontinued by Zoom in 2023. End stale meetings from the backend (S2S OAuth) or at zoom.us/meeting." },
    { status: 410 }
  );
}

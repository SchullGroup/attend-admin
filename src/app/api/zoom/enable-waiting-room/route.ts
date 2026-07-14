import { NextResponse } from "next/server";

/**
 * ⚠️ DEAD ROUTE — kept only for reference, returns 410 Gone.
 *
 * This route PATCHed the meeting to enable the waiting room, authenticated
 * as a Zoom **JWT App** (self-signed HS256 JWT from ZOOM_SDK_KEY/SECRET).
 * Zoom discontinued JWT apps in September 2023, so the call can only 401
 * now. No frontend code ever called this route.
 *
 * Waiting-room settings should be set by the backend when it creates the
 * meeting (Server-to-Server OAuth), e.g. `settings.waiting_room: true` in
 * the create-meeting payload.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Gone: this route relied on Zoom JWT apps, discontinued by Zoom in 2023. Set waiting_room in the backend's create-meeting payload instead." },
    { status: 410 }
  );
}

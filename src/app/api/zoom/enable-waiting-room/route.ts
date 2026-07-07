import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * POST /api/zoom/enable-waiting-room
 * Body: { meetingId: string }
 *
 * Patches the Zoom meeting to enable waiting room so the host can
 * see and admit participants from the embedded SDK.
 */
function makeZoomApiJwt(apiKey: string, apiSecret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 120;
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: apiKey, exp })).toString("base64url");
  const sig     = crypto.createHmac("sha256", apiSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  const apiKey    = process.env.ZOOM_SDK_KEY;
  const apiSecret = process.env.ZOOM_SDK_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Zoom credentials not configured." }, { status: 503 });
  }

  let body: { meetingId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { meetingId } = body;
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId is required" }, { status: 400 });
  }

  try {
    const jwt = makeZoomApiJwt(apiKey, apiSecret);

    const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ settings: { waiting_room: true } }),
    });

    // 204 = success, no body
    if (res.status === 204 || res.ok) {
      return NextResponse.json({ ok: true });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (data as any)?.message ?? `Zoom API error ${res.status}` },
      { status: res.status }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to enable waiting room" },
      { status: 500 }
    );
  }
}

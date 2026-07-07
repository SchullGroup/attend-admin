import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * POST /api/zoom/end-active
 *
 * Finds all live meetings on the Zoom account and ends them.
 * Called automatically before retrying when SDK error 3000 occurs.
 *
 * Uses the same ZOOM_SDK_KEY / ZOOM_SDK_SECRET credentials (JWT App).
 */
function makeZoomApiJwt(apiKey: string, apiSecret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 120;
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: apiKey, exp })).toString("base64url");
  const sig     = crypto.createHmac("sha256", apiSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export async function POST() {
  const apiKey    = process.env.ZOOM_SDK_KEY;
  const apiSecret = process.env.ZOOM_SDK_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Zoom credentials not configured." }, { status: 503 });
  }

  try {
    const jwt = makeZoomApiJwt(apiKey, apiSecret);
    const headers = { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };

    // 1. List all live meetings for the account owner
    const listRes = await fetch(
      "https://api.zoom.us/v2/users/me/meetings?type=live&page_size=30",
      { headers }
    );

    if (!listRes.ok) {
      const body = await listRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: (body as any)?.message ?? `Zoom API error ${listRes.status}` },
        { status: listRes.status }
      );
    }

    const listData = await listRes.json() as { meetings?: { id: number }[] };
    const meetings = listData.meetings ?? [];

    // 2. End each one
    const results = await Promise.allSettled(
      meetings.map((m) =>
        fetch(`https://api.zoom.us/v2/meetings/${m.id}/status`, {
          method:  "PUT",
          headers,
          body:    JSON.stringify({ action: "end" }),
        })
      )
    );

    const ended = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ ended, total: meetings.length });

  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to end meetings" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Returns a fresh Zoom ZAK (Zoom Access Key) for the account owner.
 * The ZAK is required for host join via the Meeting SDK.
 *
 * Uses the same ZOOM_SDK_KEY / ZOOM_SDK_SECRET credentials to generate
 * a short-lived JWT, then calls GET https://api.zoom.us/v2/users/me/token?type=zak.
 *
 * Note: this works if the Zoom app is a JWT App (Account-level credentials).
 * Server-to-Server OAuth apps would need a different flow.
 */
function makeZoomApiJwt(apiKey: string, apiSecret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60; // 60-second token — only needed for this request

  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: apiKey, exp })).toString("base64url");
  const sig     = crypto.createHmac("sha256", apiSecret).update(`${header}.${payload}`).digest("base64url");

  return `${header}.${payload}.${sig}`;
}

export async function GET() {
  const apiKey    = process.env.ZOOM_SDK_KEY;
  const apiSecret = process.env.ZOOM_SDK_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Zoom credentials not configured." },
      { status: 503 }
    );
  }

  try {
    const jwt = makeZoomApiJwt(apiKey, apiSecret);

    const res = await fetch("https://api.zoom.us/v2/users/me/token?type=zak", {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (body as any)?.message ?? `Zoom API error ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json() as { token: string };
    return NextResponse.json({ zak: data.token });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch ZAK" },
      { status: 500 }
    );
  }
}

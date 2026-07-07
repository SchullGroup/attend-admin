import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Generates a Zoom Meeting SDK JWT signature (HS256).
 * Docs: https://developers.zoom.us/docs/meeting-sdk/auth/
 */
function generateSignature(
  sdkKey: string,
  sdkSecret: string,
  meetingNumber: string,
  role: number,
): string {
  const iat = Math.round(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours

  // mn MUST be an integer — Zoom rejects the signature if it's a string (error 3712)
  const mn = parseInt(meetingNumber, 10);

  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ sdkKey, appKey: sdkKey, mn, role: Number(role), iat, exp, tokenExp: exp }),
  ).toString("base64url");

  const toSign = `${header}.${payload}`;
  const sig    = crypto.createHmac("sha256", sdkSecret).update(toSign).digest("base64url");

  return `${toSign}.${sig}`;
}

export async function POST(request: Request) {
  const sdkKey    = process.env.ZOOM_SDK_KEY;
  const sdkSecret = process.env.ZOOM_SDK_SECRET;

  if (!sdkKey || !sdkSecret) {
    return NextResponse.json(
      { error: "Zoom SDK credentials are not configured. Set ZOOM_SDK_KEY and ZOOM_SDK_SECRET in .env.local." },
      { status: 503 },
    );
  }

  let body: { meetingNumber?: string; role?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { meetingNumber, role = 1 } = body;

  if (!meetingNumber) {
    return NextResponse.json({ error: "meetingNumber is required" }, { status: 400 });
  }

  const signature = generateSignature(sdkKey, sdkSecret, String(meetingNumber), role);
  return NextResponse.json({ signature, sdkKey });
}

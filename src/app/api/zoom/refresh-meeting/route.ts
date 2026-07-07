import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy route: silently refreshes a Zoom meeting on the backend and returns
 * a fresh ZoomMeetingDto (including fresh startUrl with a non-expired ZAK).
 *
 * POST /api/zoom/refresh-meeting
 * Body: { eventId: string }
 *
 * Reads the accessToken cookie and forwards it to the backend so the call
 * is authenticated as the current user.
 */
export async function POST(req: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    return NextResponse.json({ error: "API URL not configured" }, { status: 503 });
  }

  let body: { eventId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { eventId } = body;
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  // Forward the access token cookie as a Bearer token
  const accessToken = req.cookies.get("accessToken")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const backendRes = await fetch(
      `${apiBase}/api/v1/client/events/${eventId}/zoom`,
      {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      }
    );

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data?.message ?? `Backend error ${backendRes.status}` },
        { status: backendRes.status }
      );
    }

    // Backend wraps response: { success, message, data: ZoomMeetingDto }
    const meeting = data?.data ?? data;
    return NextResponse.json(meeting);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to refresh meeting" },
      { status: 500 }
    );
  }
}

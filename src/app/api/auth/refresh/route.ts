import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   7 * 24 * 60 * 60, // 7 days
};

export async function POST(request: Request) {
  try {
    // Read the refresh token from the HttpOnly cookie
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { status: "FAILURE", message: "No refresh token found" },
        { status: 401 },
      );
    }

    const response = await fetch(`${API_URL}/api/v1/auth/refresh-token`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    const backendStatus = response.status;
    if (!response.ok || data.status === "FAILURE") {
      // Return the error status but do NOT delete the refreshToken cookie here.
      //
      // Why: with rotating refresh tokens, two simultaneous refresh requests
      // (from two browser tabs or a burst of 401s) both forward the same cookie
      // to the backend. The backend accepts the first and rejects the second
      // with 401. If this route deleted the cookie on that 401, it would wipe
      // the new token the winning tab already set — permanently locking the
      // user out.  The frontend's logout flow (window.location.href = "/login"
      // → POST /api/auth/logout) is the right place to clear the cookie.
      return NextResponse.json(data, { status: backendStatus || 401 });
    }

    // Parse the wrapped or flat token shapes
    const tokenData = data.data ?? data;
    const { refreshToken: newRefreshToken, ...restData } = tokenData;

    // Build response and set the cookie directly on it — more reliable than
    // cookies().set() in App Router route handlers (that call can fail to
    // merge with the NextResponse headers).
    const res = NextResponse.json({ ...data, data: restData }, { status: 200 });

    // Always rotate the cookie — use new token if provided, keep old one if not
    res.cookies.set("refreshToken", newRefreshToken ?? refreshToken, COOKIE_OPTS);

    return res;
  } catch (error) {
    console.error("Refresh Proxy Error:", error);
    return NextResponse.json(
      { status: "FAILURE", message: "Internal server error during refresh" },
      { status: 500 },
    );
  }
}

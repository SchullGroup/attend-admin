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

    // Only treat 401 / 403 from the backend as a definitive "token is invalid".
    // On 4xx/5xx network errors we do NOT wipe the cookie — the old token may
    // still be valid and we don't want to lock the user out over a flaky server.
    const backendStatus = response.status;
    if (!response.ok || data.status === "FAILURE") {
      const isDefinitivelyInvalid = backendStatus === 401 || backendStatus === 403;
      const errRes = NextResponse.json(data, { status: backendStatus || 401 });
      if (isDefinitivelyInvalid) {
        errRes.cookies.delete("refreshToken");
      }
      return errRes;
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

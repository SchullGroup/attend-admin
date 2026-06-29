import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || data.status === "FAILURE") {
      return NextResponse.json(data, { status: response.status || 400 });
    }

    const tokenData = data.data ?? data;
    const { refreshToken, ...restData } = tokenData;

    // Build response first, then set the HttpOnly cookie directly on it.
    // Do NOT use cookies().set() — in Next.js App Router that call can fail to
    // merge with the NextResponse headers, meaning the browser never receives the
    // Set-Cookie header and the refreshToken is never stored.
    const res = NextResponse.json({ ...data, data: restData }, { status: 200 });

    if (refreshToken) {
      res.cookies.set("refreshToken", refreshToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",   // lax allows the cookie on same-site navigations
        path:     "/",
        maxAge:   7 * 24 * 60 * 60, // 7 days — matches backend TTL
      });
    }

    return res;
  } catch (error) {
    console.error("Login Proxy Error:", error);
    return NextResponse.json(
      { status: "FAILURE", message: "Internal server error during login" },
      { status: 500 },
    );
  }
}

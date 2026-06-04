import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { status: "FAILURE", message: "No refresh token found" },
        { status: 401 },
      );
    }

    const response = await fetch(`${API_URL}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok || data.status === "FAILURE") {
      // Clear cookie if refresh fails
      cookieStore.delete("refreshToken");
      return NextResponse.json(data, { status: response.status || 401 });
    }

    const { refreshToken: newRefreshToken, ...restData } = data.data;

    // Set new HttpOnly cookie
    cookieStore.set("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Return the response without the new refreshToken in the body
    return NextResponse.json({ ...data, data: restData }, { status: 200 });
  } catch (error) {
    console.error("Refresh Proxy Error:", error);
    return NextResponse.json(
      { status: "FAILURE", message: "Internal server error during refresh" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");

    // We optionally call the backend logout endpoint if there's a token
    if (authHeader) {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
        },
      }).catch((err) => console.error("Backend logout call failed:", err));
    }

    // Clear the HttpOnly cookie directly on the response object
    const res = NextResponse.json(
      { status: "SUCCESS", message: "Logged out successfully" },
      { status: 200 },
    );
    res.cookies.delete("refreshToken");
    return res;
  } catch (error) {
    console.error("Logout Proxy Error:", error);
    return NextResponse.json(
      { status: "FAILURE", message: "Internal server error during logout" },
      { status: 500 },
    );
  }
}

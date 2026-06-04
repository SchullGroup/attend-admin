import { cookies } from "next/headers";
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

    const { refreshToken, ...restData } = data.data;

    // Set HttpOnly cookie for refreshToken
    const cookieStore = await cookies();
    cookieStore.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Return the response without the refreshToken in the body
    return NextResponse.json({ ...data, data: restData }, { status: 200 });
  } catch (error) {
    console.error("Login Proxy Error:", error);
    return NextResponse.json(
      { status: "FAILURE", message: "Internal server error during login" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import {
  getAuthRoles,
  hasAttendAdminRole,
  UNSUPPORTED_PORTAL_ROLE_MESSAGE,
} from "@/lib/auth-roles";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/** Host only — safe to show a user, and the thing you actually need to see when this fails. */
function apiHost(): string {
  try {
    return new URL(API_URL).host;
  } catch {
    return API_URL;
  }
}

export async function POST(request: Request) {
  const target = `${API_URL}/api/v1/auth/login`;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "FAILURE", message: "Malformed request body.", code: "BAD_REQUEST_BODY" },
      { status: 400 },
    );
  }

  // ── 1. Reach the API ──────────────────────────────────────────────────────
  // A failure here is a network/DNS/TLS problem between this server and the
  // Attend API — nothing to do with the credentials. Previously this collapsed
  // into a generic 500 whose message ("Internal server error during login")
  // sent everyone looking for a bug in the login logic instead.
  let response: Response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // undici puts the useful part (ECONNREFUSED, ENOTFOUND, cert errors,
    // UND_ERR_CONNECT_TIMEOUT) on `cause`, not on the wrapper Error.
    const cause = (error as any)?.cause ?? error;
    const code = cause?.code ?? cause?.name ?? "UNKNOWN";
    console.error("Login Proxy Error — could not reach the API", {
      target,
      code,
      message: cause?.message,
    });
    return NextResponse.json(
      {
        status: "FAILURE",
        code: "API_UNREACHABLE",
        message: `Could not reach the Attend API at ${apiHost()} (${code}).`,
        ...(process.env.NODE_ENV !== "production" ? { detail: String(cause?.message ?? cause) } : {}),
      },
      { status: 502 },
    );
  }

  // ── 2. Read it as text first ──────────────────────────────────────────────
  // response.json() on an HTML error page (an nginx 502, a Spring whitelabel
  // page, a WAF block) throws a SyntaxError that says nothing about what was
  // actually returned. Parse manually so the status, content-type and the first
  // line of the body survive into the log.
  const raw = await response.text();
  let data: any;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    const contentType = response.headers.get("content-type") ?? "none";
    console.error("Login Proxy Error — API returned a non-JSON response", {
      target,
      status: response.status,
      contentType,
      snippet: raw.slice(0, 400),
    });
    return NextResponse.json(
      {
        status: "FAILURE",
        code: "API_BAD_RESPONSE",
        message: `The Attend API at ${apiHost()} answered ${response.status} with ${contentType}, not JSON.`,
        ...(process.env.NODE_ENV !== "production" ? { detail: raw.slice(0, 400) } : {}),
      },
      { status: 502 },
    );
  }

  if (!response.ok || data.status === "FAILURE") {
    return NextResponse.json(data, { status: response.status || 400 });
  }

  const tokenData = data.data ?? data;

  // The auth service is shared with the attendee platform. Reject every
  // account that has no explicit Attend Admin role before issuing cookies.
  if (!hasAttendAdminRole(tokenData)) {
    console.warn("Rejected login for unsupported portal role", {
      roles: getAuthRoles(tokenData),
    });
    return NextResponse.json(
      { status: false, message: UNSUPPORTED_PORTAL_ROLE_MESSAGE },
      { status: 403 },
    );
  }

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
}

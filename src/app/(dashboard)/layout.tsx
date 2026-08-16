"use client";
import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { refreshAccessToken } from "@/lib/api-client";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { Loader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { rememberSessionEndReason } from "@/lib/auth-session";
import { useGetMe } from "@/api/auth/hooks";
import { hasAttendAdminRole } from "@/lib/auth-roles";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Always start as false so the server and client render the same initial HTML.
  // The effect below immediately flips to true if a token already exists, or
  // attempts a silent refresh first — avoiding a hydration mismatch.
  const [ready, setReady] = useState(false);
  // Prevent React StrictMode's double-effect invocation from firing two concurrent
  // POST /api/auth/refresh calls. If the backend uses rotating refresh tokens the
  // second call arrives with an already-consumed token → 401 → forced logout.
  // refreshAccessToken() is a singleton (returns the same Promise when in-flight),
  // but this ref prevents even starting a second call from this effect.
  const refreshStarted = useRef(false);
  const unsupportedRoleRedirected = useRef(false);
  const [tokenReady, setTokenReady] = useState(false);
  const {
    data: userResponse,
    isLoading: userLoading,
    isError: userError,
    error: userErrorDetails,
    refetch: refetchUser,
  } = useGetMe(tokenReady);

  useEffect(() => {
    if (Cookies.get("accessToken")) {
      setTokenReady(true);
      return;
    }

    // Guard against StrictMode double-invoke
    if (refreshStarted.current) return;
    refreshStarted.current = true;

    // Access token is missing (expired after 1 day) but the refresh token httpOnly
    // cookie may still be valid for up to 7 days. Attempt a silent refresh before
    // rendering anything so the user stays logged in.
    // Uses the shared singleton from api-client so concurrent callers never
    // trigger more than one POST /api/auth/refresh at the same time.
    refreshAccessToken()
      .then(() => {
        setTokenReady(true);
      })
      .catch((error) => {
        // Refresh token is also expired or missing — send to login.
        rememberSessionEndReason(error);
        window.location.replace("/login");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tokenReady || userLoading || unsupportedRoleRedirected.current) {
      return;
    }

    const userErrorStatus = (userErrorDetails as any)?.response?.status;
    const sessionRejected = userError && [401, 403].includes(userErrorStatus);
    const unsupportedRole = !userError && !hasAttendAdminRole(userResponse?.data);

    if (sessionRejected || unsupportedRole) {
      unsupportedRoleRedirected.current = true;
      Cookies.remove("accessToken");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("userLogoUrl");
        // Clear the HttpOnly refresh cookie as well. The redirect query gives
        // the login page a safe, user-visible explanation for the rejection.
        void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
          window.location.replace(
            `/login?reason=${sessionRejected ? "session-invalid" : "unsupported-role"}`,
          );
        });
      }
      return;
    }

    if (!userError) setReady(true);
  }, [tokenReady, userError, userErrorDetails, userLoading, userResponse]);

  if (tokenReady && userError) {
    const userErrorStatus = (userErrorDetails as any)?.response?.status;
    if (![401, 403].includes(userErrorStatus)) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              We could not verify your account
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Check your connection and try again.
            </p>
          </div>
          <Button type="button" onClick={() => void refetchUser()}>
            Try again
          </Button>
        </div>
      );
    }
  }

  if (!ready) return <Loader variant="page" text="Resuming session…" />;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f6f7fb" }}>
      <Sidebar />
      <div className="ml-[272px] flex-1 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

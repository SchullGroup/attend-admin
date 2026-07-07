"use client";
import { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { refreshAccessToken } from "@/lib/api-client";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";
import { Loader } from "@/components/ui/Loader";

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

  useEffect(() => {
    if (Cookies.get("accessToken")) {
      setReady(true);
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
        setReady(true);
      })
      .catch(() => {
        // Refresh token is also expired or missing — send to login.
        window.location.replace("/login");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
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

  useEffect(() => {
    if (Cookies.get("accessToken")) {
      setReady(true);
      return;
    }

    // Access token is missing (expired after 1 day) but the refresh token httpOnly
    // cookie may still be valid for up to 7 days. Attempt a silent refresh before
    // rendering anything so the user stays logged in.
    axios
      .post("/api/auth/refresh")
      .then(({ data }) => {
        const tokenData = data?.data ?? data;
        const token = tokenData?.token ?? tokenData?.accessToken;
        if (token) {
          Cookies.set("accessToken", token, {
            expires:  1,
            secure:   process.env.NODE_ENV === "production",
            sameSite: "strict",
          });
        }
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

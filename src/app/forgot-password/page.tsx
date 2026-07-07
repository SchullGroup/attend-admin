"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPassword } from "@/api/auth/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPassword();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    forgotPassword.mutate(
      { email: email.trim() },
      { onSuccess: () => setSent(true) }
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7fb] px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <img src="/attend-logo.png" alt="Attend" className="h-[52px] w-auto shrink-0" />
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ backgroundColor: "rgba(17,24,39,0.07)", color: "#6b7280" }}
          >
            Admin
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-8 shadow-sm">
          {sent ? (
            /* ── Sent state ── */
            <div className="text-center space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Check your inbox</h1>
                <p className="mt-2 text-sm" style={{ color: "#6b7280" }}>
                  We sent a password reset link to{" "}
                  <span className="font-semibold" style={{ color: "#374151" }}>{email}</span>.
                  It expires in 15 minutes.
                </p>
              </div>
              <p className="text-xs" style={{ color: "#9ca3af" }}>
                No email? Check your spam folder or{" "}
                <button
                  onClick={() => setSent(false)}
                  className="font-semibold underline-offset-2 hover:underline"
                  style={{ color: "#374151" }}
                >
                  try a different address
                </button>.
              </p>
              <Button
                className="w-full h-11"
                onClick={() => router.push("/reset-password")}
              >
                Set new password
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => router.push("/login")}
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Button>
            </div>
          ) : (
            /* ── Email form ── */
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: "#111827" }}>
                  Forgot your password?
                </h1>
                <p className="text-sm" style={{ color: "#6b7280" }}>
                  Enter your admin email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium" style={{ color: "#374151" }}>
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#9ca3af" }} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@yourorganisation.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-9"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-11" disabled={forgotPassword.isPending || !email.trim()}>
                  {forgotPassword.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-sm hover:underline"
                  style={{ color: "#6b7280" }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "#d1d5db" }}>
          Attend v1.0 · Enterprise Events Management Platform
        </p>
      </div>
    </div>
  );
}

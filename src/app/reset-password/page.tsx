"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, Check, X, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8          },
  { label: "One capital letter",     test: (p: string) => /[A-Z]/.test(p)        },
  { label: "Contains a number",      test: (p: string) => /\d/.test(p)           },
];

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password,      setPassword]      = useState("");
  const [confirm,       setConfirm]       = useState("");
  const [showPassword,  setShowPassword]  = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [done,          setDone]          = useState(false);

  const rulesPass = RULES.every((r) => r.test(password));
  const matches   = password === confirm && confirm.length > 0;
  const canSubmit = rulesPass && matches;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); }, 1200);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7fb] px-4">
      <div className="w-full max-w-[420px]">
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
          {done ? (
            /* ── Success state ── */
            <div className="text-center space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: "#111827" }}>Password updated</h1>
                <p className="mt-2 text-sm" style={{ color: "#6b7280" }}>
                  Your password has been reset successfully. Sign in with your new credentials.
                </p>
              </div>
              <Button className="w-full h-11" onClick={() => router.push("/login")}>
                Go to sign in
              </Button>
            </div>
          ) : (
            /* ── Reset form ── */
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: "#111827" }}>
                  Set a new password
                </h1>
                <p className="text-sm" style={{ color: "#6b7280" }}>
                  Choose a strong password you haven&apos;t used before.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                {/* New password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium" style={{ color: "#374151" }}>
                    New password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#9ca3af" }} />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "#9ca3af" }}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {RULES.map((r) => {
                        const ok = r.test(password);
                        return (
                          <li key={r.label} className="flex items-center gap-1.5">
                            {ok
                              ? <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
                              : <X    className="h-3.5 w-3.5 text-red-500"     strokeWidth={2.5} />
                            }
                            <span className={`text-xs font-medium ${ok ? "text-emerald-700" : "text-red-600"}`}>
                              {r.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-sm font-medium" style={{ color: "#374151" }}>
                    Confirm new password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#9ca3af" }} />
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter your new password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="h-11 pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "#9ca3af" }}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirm.length > 0 && !matches && (
                    <p className="text-xs text-red-600 font-medium">Passwords do not match.</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || !canSubmit}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
                  ) : (
                    "Update password"
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

"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  BarChart3,
  Radio,
  Vote,
  Shield,
} from "lucide-react";
import { useLogin } from "@/api/auth/hooks";
import { toast } from "sonner";
import Cookies from "js-cookie";

const FEATURES = [
  {
    icon: ShieldCheck,
    label: "KYC & Compliance",
    desc: "Identity verification & audit trails",
  },
  {
    icon: Radio,
    label: "Live Control Room",
    desc: "Real-time event management",
  },
  {
    icon: Vote,
    label: "AGM Voting",
    desc: "Binding electronic shareholder votes",
  },
  {
    icon: BarChart3,
    label: "Analytics",
    desc: "Insights across all platform events",
  },
];

function OtpInput({
  onComplete,
  onAnyChange,
}: {
  onComplete: (code: string) => void;
  onAnyChange?: () => void;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(i: number, val: string) {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = digits.map((v, idx) => (idx === i ? d : v));
    setDigits(next);
    onAnyChange?.();
    if (d && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) onComplete(next.join(""));
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0)
      refs.current[i - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""].map((_, i) => pasted[i] ?? "");
    setDigits(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) onComplete(pasted);
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-12 w-12 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
          style={{
            border: `1.5px solid ${d ? "#111827" : "#e5e7eb"}`,
            color: "#111827",
            backgroundColor: d ? "rgba(17,24,39,0.04)" : "#ffffff",
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [resendKey, setResendKey] = useState(0);
  const { mutate: loginMutation, isPending } = useLogin();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    loginMutation(
      { email, password },
      {
        onSuccess: (response) => {
          // Block attendee-only accounts — this portal is admin-only.
          // AuthResponse nests the payload in response.data; roles come as string[] (e.g. ["ATTENDEE"])
          const inner = (response as any)?.data ?? response;
          const rolesRaw: string[] = [
            ...(Array.isArray(inner?.roles) ? inner.roles : []),
            ...(inner?.role ? [inner.role] : []),
          ];
          const normalized = rolesRaw
            .map((r) =>
              String(r ?? "")
                .toLowerCase()
                .replace(/[-\s]+/g, "_"),
            )
            .filter(Boolean);
          const isAttendeeOnly =
            normalized.length > 0 && normalized.every((r) => r === "attendee");
          if (isAttendeeOnly) {
            Cookies.remove("accessToken");
            toast.error(
              "Access denied. This portal is for administrators only.",
            );
            return;
          }
          toast.success("Login successful");
          router.push("/");
        },
        onError: (err: any) => {
          toast.error(
            err?.response?.data?.message ||
              err?.message ||
              "Invalid email or password",
          );
        },
      },
    );
  }

  useEffect(() => {
    if (step !== "otp") return;
    setCountdown(60);
    const interval = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearInterval(interval);
  }, [step, resendKey]);

  function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
    }, 600);
  }

  function handleOtp(code: string) {
    setOtpError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("credentials");
    }, 600);
    // addAuditEntry({
    //   actor: "Admin User",
    //   actorEmail: email,
    //   actorRole: "super_admin",
    //   action: "Signed in",
    //   category: "auth",
    //   resource: "Admin Portal",
    //   details: "Successful credential verification",
    //   ip: "197.210.xx.xx",
    //   severity: "info",
    // });
    // addAuditEntry({
    //   actor: "Admin User",
    //   actorEmail: email,
    //   actorRole: "super_admin",
    //   action: "2FA verified",
    //   category: "auth",
    //   resource: "Admin Portal",
    //   details: "OTP authentication completed successfully",
    //   ip: "197.210.xx.xx",
    //   severity: "info",
    // });
    setTimeout(() => router.push("/"), 400);
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left panel ── */}
      <div
        className="w-full md:w-[52%] flex flex-col min-h-screen"
        style={{ borderRight: "1px solid #f1f5f9" }}
      >
        {/* Top logo bar */}
        <div className="flex items-center gap-2 px-10 pt-10 pb-0">
          <img
            src="/attend-logo.png"
            alt="Attend"
            style={{ height: 40, width: "auto" }}
          />
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ backgroundColor: "rgba(17,24,39,0.07)", color: "#6b7280" }}
          >
            Admin
          </span>
        </div>

        {/* Centred form */}
        <div className="flex-1 flex items-center justify-center px-10">
          <div className="w-full max-w-95">
            <h1
              className="text-[2rem] font-bold tracking-tight mb-1"
              style={{ color: "#111827" }}
            >
              Welcome back
            </h1>
            <p className="text-sm mb-8" style={{ color: "#9ca3af" }}>
              Sign in to access the Attend Admin Portal.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium"
                  style={{ color: "#374151" }}
                >
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@yourorganisation.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium"
                    style={{ color: "#374151" }}
                  >
                    Password
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs hover:underline"
                    style={{ color: "#6b7280" }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "#9ca3af" }}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  id="remember"
                  className="rounded"
                  defaultChecked
                />
                <label
                  htmlFor="remember"
                  className="cursor-pointer"
                  style={{ color: "#6b7280" }}
                >
                  Keep me signed in
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold mt-1"
                disabled={isPending}
                style={{ backgroundColor: "#111827" }}
              >
                {isPending ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 pb-8 text-xs" style={{ color: "#d1d5db" }}>
          Attend v1.0 · Enterprise Events Management Platform
        </div>
      </div>

      {/* ── Right panel ── */}
      <div
        className="hidden md:flex w-[48%] relative overflow-hidden flex-col items-center justify-center"
        style={{ backgroundColor: "#111827" }}
      >
        {/* Decorative rings */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full border border-white/5" />
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full border border-white/5" />
          <div className="absolute bottom-0 -left-20 h-80 w-80 rounded-full border border-white/5" />
          <div className="absolute top-1/2 right-12 h-40 w-40 rounded-full bg-white/3" />
        </div>

        <div className="relative z-10 px-14 max-w-md w-full">
          {/* Logo lockup */}
          <div className="mb-10">
            <img
              src="/attend-logo.png"
              alt="Attend"
              style={{
                height: 36,
                width: "auto",
                filter: "brightness(0) invert(1)",
                opacity: 0.9,
              }}
            />
          </div>

          <h2 className="text-2xl font-bold text-white mb-3 leading-snug">
            The platform powering Nigeria&apos;s capital market events
          </h2>
          <p className="text-sm mb-10" style={{ color: "#94a3b8" }}>
            AGMs, innovation challenges, product launches — managed end-to-end
            from a single admin console.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="rounded-xl p-4 text-left"
                style={{
                  // Solid (not translucent) so the decorative rings behind the
                  // grid don't show through the card — same visual shade as the
                  // old rgba(255,255,255,0.06)-over-#111827 look, just opaque.
                  backgroundColor: "#1f2634",
                  border: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <f.icon className="h-4 w-4 text-white" />
                </div>
                <div className="text-sm font-semibold text-white mb-0.5">
                  {f.label}
                </div>
                <div className="text-xs" style={{ color: "#64748b" }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

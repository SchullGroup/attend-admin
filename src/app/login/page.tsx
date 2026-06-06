"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLogin } from "@/api/auth/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldCheck, BarChart3, Radio, Vote } from "lucide-react";
import { toast } from "sonner";

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

export default function LoginPage() {
  const router = useRouter();
  const { mutate: loginMutation, isPending } = useLogin();
  const [email, setEmail] = useState("stanley.jacob@meristem.com");
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    loginMutation(
      { email, password },
      {
        onSuccess: () => {
          toast.success("Login successful");
          router.push("/");
        },
        onError: (err: any) => {
          toast.error(
            err?.response?.data?.message ||
              err?.message ||
              "Invalid email or password"
          );
        },
      }
    );
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
          <img src="/attend-logo.png" alt="Attend" style={{ height: 40 }} />
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{ backgroundColor: "rgba(17,24,39,0.07)", color: "#6b7280" }}
          >
            Admin
          </span>
        </div>

        {/* Centred form */}
        <div className="flex-1 flex items-center justify-center px-10">
          <div className="w-full max-w-[380px]">
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
                  <button
                    type="button"
                    className="text-xs hover:underline"
                    style={{ color: "#6b7280" }}
                  >
                    Forgot password?
                  </button>
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
                style={{ backgroundColor: "#2563eb" }}
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
                  backgroundColor: "rgba(255,255,255,0.06)",
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

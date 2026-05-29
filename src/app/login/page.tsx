"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const { login, seedStore } = useStore();
  const [email, setEmail] = useState("stanley.jacob@meristem.com");
  const [password, setPassword] = useState("password");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    seedStore();
    login(email);
    setTimeout(() => {
      router.push("/");
    }, 400);
  }

  return (
    <div className="min-h-screen flex">
      <div className="w-1/2 flex flex-col justify-between p-12">
        <div>
          <div className="flex items-baseline gap-1.5 mb-12">
            <span className="text-2xl font-bold text-[#1a6b3c] tracking-tight">Attend</span>
            <span className="text-sm text-[hsl(var(--muted-foreground))] font-medium">by Meristem</span>
          </div>

          <div className="max-w-sm">
            <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">Admin Portal</h1>
            <p className="text-[hsl(var(--muted-foreground))] mb-8">Sign in to manage the Attend enterprise event platform.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="email" className="mb-2 block">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@meristem.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password" className="mb-2 block">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <span className="text-[hsl(var(--muted-foreground))]">Remember me</span>
                </label>
                <button type="button" className="text-[hsl(var(--primary))] hover:underline">Forgot password?</button>
              </div>
              <Button type="submit" className="w-full h-11 text-base mt-2" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
        </div>

        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          Powered by <span className="font-semibold text-[hsl(var(--foreground))]">Meristem Group</span> · Attend v1.0
        </div>
      </div>

      <div className="w-1/2 relative overflow-hidden flex flex-col items-center justify-center" style={{ backgroundColor: "#1a6b3c" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-white/5" />
          <div className="absolute top-1/4 -left-20 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute bottom-10 right-1/4 h-48 w-48 rounded-full bg-white/8" />
          <div className="absolute -bottom-10 -left-10 h-72 w-72 rounded-full bg-white/5" />
          <div className="absolute top-1/2 right-10 h-32 w-32 rounded-full bg-white/6" />
        </div>

        <div className="relative z-10 px-12 text-center max-w-md">
          <div className="h-16 w-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3 leading-tight">Enterprise Event Management Platform</h2>
          <p className="text-green-200 text-sm mb-8">Powering AGMs, product launches, hackathons, and enterprise events for Nigeria's capital markets.</p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Virtual AGMs", desc: "Secure shareholder voting" },
              { label: "Live Events", desc: "Real-time attendance & Q&A" },
              { label: "Innovation Challenges", desc: "Manage innovation challenges" },
              { label: "Analytics", desc: "Insights & compliance reports" },
            ].map((pill) => (
              <div key={pill.label} className="rounded-xl bg-white/10 border border-white/15 p-3 text-left">
                <div className="text-sm font-semibold text-white">{pill.label}</div>
                <div className="text-xs text-green-200 mt-0.5">{pill.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

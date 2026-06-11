"use client";

import { useState } from "react";
import { useGetMe } from "@/api/auth/hooks";
import { useChangePassword } from "@/api/auth/auth";
import { ClientOrgSettings } from "@/components/dashboard/client-org-settings";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  CheckCircle, XCircle, Settings, Shield, Link2,
  Loader2, RefreshCw, KeyRound, AlertCircle, Lock,
} from "lucide-react";
import { toast } from "sonner";

// ─── Role normalisation ────────────────────────────────────────────────────
//
// Safely collapses all variants — "SUPER-ADMIN", "Super Admin", "super_admin" —
// to a canonical underscore-separated lowercase token.
function normaliseRole(raw: string | undefined | null): string {
  return (raw ?? "").toLowerCase().replace(/[-\s]+/g, "_");
}

// ─── Types ─────────────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "disconnected" | "pending";

interface Integration {
  id: string;
  label: string;
  desc: string;
  status: IntegrationStatus;
}

const INITIAL_INTEGRATIONS: Integration[] = [
  { id: "ngx",      label: "NGX/CSCS Market Data",      desc: "Nigerian Exchange Group & CSCS shareholder data link",  status: "connected"    },
  { id: "nibss",    label: "BVN/NIN Gateway (NIBSS)",    desc: "National Identity Management Commission verification",  status: "connected"    },
  { id: "paystack", label: "Payment Gateway (Paystack)", desc: "Event registration payment processing",                 status: "connected"    },
  { id: "mux",      label: "Streaming Provider (Mux)",   desc: "Live virtual event video streaming",                    status: "pending"      },
  { id: "termii",   label: "SMS Gateway (Termii)",       desc: "OTP and notification delivery",                         status: "disconnected" },
];

const STATUS_CONFIG = {
  connected:    { icon: CheckCircle, color: "text-green-600",  bg: "bg-green-50",  text: "Connected"    },
  disconnected: { icon: XCircle,     color: "text-red-500",    bg: "bg-red-50",    text: "Disconnected" },
  pending:      { icon: Loader2,     color: "text-yellow-600", bg: "bg-yellow-50", text: "Pending"      },
};

// ─── Read-only toggle display (Super Admin) ────────────────────────────────

function ROToggle({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        checked ? "bg-green-50 text-green-700" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
      }`}
    >
      {checked ? "Enabled" : "Disabled"}
    </span>
  );
}

// ─── Change Password card (non-super-admin only) ───────────────────────────

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientError,     setClientError]     = useState<string | null>(null);

  const changePwMutation = useChangePassword();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (!currentPassword.trim()) { setClientError("Current password is required."); return; }
    if (!newPassword.trim())     { setClientError("New password is required."); return; }
    if (newPassword.length < 8)  { setClientError("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setClientError("New passwords do not match."); return; }

    changePwMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
      }
    );
  }

  const busy = changePwMutation.isPending;

  return (
    <Card className="attend-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <KeyRound className="h-4 w-4 text-[hsl(var(--primary))]" />
        <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Change Password</h2>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="space-y-1.5">
            <Label
              htmlFor="currentPw"
              className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
            >
              Current Password
            </Label>
            <Input
              id="currentPw"
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setClientError(null); }}
              placeholder="••••••••"
              disabled={busy}
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="newPw"
              className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
            >
              New Password
            </Label>
            <Input
              id="newPw"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setClientError(null); }}
              placeholder="••••••••"
              disabled={busy}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="confirmPw"
              className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
            >
              Confirm New Password
            </Label>
            <Input
              id="confirmPw"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setClientError(null); }}
              placeholder="••••••••"
              disabled={busy}
              autoComplete="new-password"
            />
          </div>
        </div>

        {/* Inline client-side validation error */}
        {clientError && (
          <p className="flex items-center gap-1.5 text-sm text-red-600 mb-4">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {clientError}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? "Updating…" : "Update Password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: userResponse } = useGetMe();
  const normalizedRole = normaliseRole(userResponse?.data?.role);

  // Super Admin is gated strictly. All other roles — client_admin, event_manager,
  // viewer, kyc_officer, etc. — fall into the non-admin branch.
  const isSuperAdmin = normalizedRole === "super_admin";

  // Integrations state — only mounted for Super Admin
  const [integrations,     setIntegrations]     = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [togglingId,       setTogglingId]       = useState<string | null>(null);

  function toggleIntegration(id: string) {
    const item = integrations.find((i) => i.id === id);
    if (!item) return;
    setTogglingId(id);
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((i) => i.id !== id ? i : { ...i, status: i.status === "connected" ? "disconnected" : "connected" })
      );
      const next = item.status === "connected" ? "disconnected" : "connected";
      toast.success(`${item.label} ${next === "connected" ? "connected" : "disconnected"}.`);
      setTogglingId(null);
    }, 1200);
  }

  function reconnectPending(id: string) {
    const item = integrations.find((i) => i.id === id);
    if (!item) return;
    setTogglingId(id);
    setTimeout(() => {
      setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, status: "connected" } : i));
      toast.success(`${item.label} is now connected.`);
      setTogglingId(null);
    }, 1400);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Platform Settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          {isSuperAdmin
            ? "Global platform configuration — read-only system view"
            : "Manage your organisation profile, branding, and account security"}
        </p>
      </div>

      <div className="flex flex-col gap-5">

        {/* ══════════════════════════════════════════════════════════════════
            NON-SUPER-ADMIN VIEW
            Covers: client_admin, event_manager, viewer, kyc_officer, etc.
            ══════════════════════════════════════════════════════════════════ */}
        {!isSuperAdmin && (
          <>
            {/* Organisation profile + logo upload */}
            <ClientOrgSettings />

            {/* Change password */}
            <ChangePasswordCard />
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SUPER ADMIN VIEW
            Read-only platform configuration — no input fields are editable.
            ══════════════════════════════════════════════════════════════════ */}
        {isSuperAdmin && (
          <>
            {/* ── General (read-only) ── */}
            <Card className="attend-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">General</h2>
                </div>
                <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <Lock className="h-3 w-3" /> Read-only
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Platform Name
                  </Label>
                  <Input
                    value="Attend Enterprise Platform"
                    readOnly
                    disabled
                    className="bg-[hsl(var(--muted))] cursor-not-allowed text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    Support Email
                  </Label>
                  <Input
                    type="email"
                    value="support@meristem.com"
                    readOnly
                    disabled
                    className="bg-[hsl(var(--muted))] cursor-not-allowed text-[hsl(var(--muted-foreground))]"
                  />
                </div>
              </div>

              <div className="border-t border-[hsl(var(--border))] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-3">
                  Notification Channels
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: "Email Notifications", desc: "Send event notices and updates via email", enabled: true  },
                    { label: "SMS Notifications",   desc: "Send OTPs and alerts via SMS",              enabled: false },
                    { label: "Push Notifications",  desc: "In-app push notifications for mobile users", enabled: true  },
                  ].map((n) => (
                    <div key={n.label} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">{n.label}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{n.desc}</div>
                      </div>
                      <ROToggle checked={n.enabled} />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* ── Compliance (read-only) ── */}
            <Card className="attend-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Compliance</h2>
                </div>
                <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                  <Lock className="h-3 w-3" /> Read-only
                </span>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] mb-2">
                    Audit Log Retention
                  </p>
                  <div className="flex gap-2">
                    {(["7yr", "3yr"] as const).map((opt) => (
                      <span
                        key={opt}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium pointer-events-none select-none ${
                          opt === "7yr"
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] text-[hsl(var(--primary))]"
                            : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                        }`}
                      >
                        {opt === "7yr" ? "7 Years (Active)" : "3 Years"}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-[hsl(var(--border))]">
                  <div>
                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">NDPA Data Processing Consent</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">Nigeria Data Protection Act — explicit consent collection</div>
                  </div>
                  <ROToggle checked={true} />
                </div>

                <div className="flex items-center justify-between py-3 border-t border-[hsl(var(--border))]">
                  <div>
                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">BVN Gateway Compliance Mode</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">Enforce BVN validation for Full KYC upgrade</div>
                  </div>
                  <ROToggle checked={true} />
                </div>
              </div>
            </Card>

            {/* ── Integrations (interactive — not form inputs) ── */}
            <Card className="attend-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Link2 className="h-4 w-4 text-[hsl(var(--primary))]" />
                <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Integrations</h2>
              </div>

              <div className="divide-y divide-[hsl(var(--border))]">
                {integrations.map((item) => {
                  const c    = STATUS_CONFIG[item.status];
                  const Icon = c.icon;
                  return (
                    <div key={item.id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">{item.label}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{item.desc}</div>
                      </div>
                      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.color}`}>
                        <Icon className={`h-3.5 w-3.5 ${item.status === "pending" ? "animate-spin" : ""}`} />
                        {c.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end mt-4">
                <Button size="sm" onClick={() => setIntegrationsOpen(true)}>
                  Manage Integrations
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* ── Integrations Dialog ─────────────────────────────────────────────── */}
      {isSuperAdmin && (
        <Dialog open={integrationsOpen} onOpenChange={setIntegrationsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Manage Integrations</DialogTitle>
              <DialogDescription>
                Connect or disconnect third-party services used by the Attend platform.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              {integrations.map((item) => {
                const c    = STATUS_CONFIG[item.status];
                const Icon = c.icon;
                const busy = togglingId === item.id;
                return (
                  <div key={item.id} className="flex items-center justify-between py-3.5 gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{item.label}</span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.color}`}>
                          <Icon className={`h-3 w-3 ${item.status === "pending" ? "animate-spin" : ""}`} />
                          {c.text}
                        </span>
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{item.desc}</p>
                    </div>

                    <div className="shrink-0">
                      {item.status === "connected" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                          disabled={busy}
                          onClick={() => toggleIntegration(item.id)}
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
                        </Button>
                      )}
                      {item.status === "disconnected" && (
                        <Button
                          size="sm" className="h-7 text-xs"
                          disabled={busy}
                          onClick={() => toggleIntegration(item.id)}
                        >
                          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect"}
                        </Button>
                      )}
                      {item.status === "pending" && (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={busy}
                          onClick={() => reconnectPending(item.id)}
                        >
                          {busy
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><RefreshCw className="h-3 w-3" /> Retry</>
                          }
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGetMe } from "@/api/auth/hooks";
import { useChangePassword } from "@/api/auth/auth";
import { useClientStakeholder } from "@/api/client-organisation";
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
  Eye, EyeOff, Volume2, VolumeX,
} from "lucide-react";
import { toast } from "sonner";

// ─── Role normalisation ────────────────────────────────────────────────────
//
// Safely collapses all variants — "SUPER-ADMIN", "Super Admin", "super_admin" —
// to a canonical underscore-separated lowercase token.
function normaliseRole(raw: string | undefined | null): string {
  return (raw ?? "").toLowerCase().replace(/[-\s]+/g, "_");
}

// ─── Judge Profile view ────────────────────────────────────────────────────

function JudgeSettingsView({ user }: { user: Record<string, any> }) {
  const { data: stakeholder } = useClientStakeholder();
  const storedLogoUrl = typeof window !== "undefined" ? (localStorage.getItem("userLogoUrl") ?? null) : null;
  const orgLogoUrl = user?.avatarUrl || user?.logoUrl || storedLogoUrl || stakeholder?.logoUrl || null;

  const fields = [
    { label: "Full Name",     value: user?.fullName ?? user?.name ?? "—" },
    { label: "Email",         value: user?.email ?? "—" },
    { label: "Role",          value: "Judge" },
    { label: "Organisation",  value: user?.organisation ?? user?.organizationName ?? user?.companyName ?? stakeholder?.name ?? "—" },
  ];

  return (
    <>
      {/* Profile card — read-only */}
      <Card className="attend-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">My Profile</h2>
          </div>
          <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
            <Lock className="h-3 w-3" /> Read-only
          </span>
        </div>

        <div className="flex items-center gap-4 mb-6">
          {/* Avatar / org logo */}
          {orgLogoUrl ? (
            <img
              src={orgLogoUrl}
              alt="Organisation logo"
              className="h-14 w-14 rounded-full object-cover shrink-0 ring-2 ring-[hsl(var(--border))]"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-[hsl(var(--primary)/0.12)] flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-[hsl(var(--primary))]">
                {(user?.fullName ?? user?.name ?? "J").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="text-base font-semibold text-[hsl(var(--foreground))]">
              {user?.fullName ?? user?.name ?? "—"}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{user?.email ?? "—"}</p>
            {stakeholder?.name && (
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{stakeholder.name}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.label} className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {f.label}
              </Label>
              <Input
                value={f.value}
                readOnly
                disabled
                className="bg-[hsl(var(--muted))] cursor-not-allowed text-[hsl(var(--muted-foreground))]"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Change password */}
      <ChangePasswordCard />

      {/* Notification sound */}
      <NotificationSoundCard />
    </>
  );
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

// ─── Constant ─────────────────────────────────────────────────────────────
export const NOTIFICATION_SOUND_KEY = "attend_notification_sound";

// ─── Password field with eye toggle ───────────────────────────────────────

function PwField({
  id, label, value, onChange, disabled, autoComplete,
}: {
  id:           string;
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  disabled?:    boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          disabled={disabled}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Change Password card (non-super-admin only) ───────────────────────────

function ChangePasswordCard() {
  const router = useRouter();
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
          // API invalidates the current session — redirect to login
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setTimeout(() => router.push("/login"), 1500);
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
          <PwField
            id="currentPw" label="Current Password"
            value={currentPassword} onChange={(v) => { setCurrentPassword(v); setClientError(null); }}
            disabled={busy} autoComplete="current-password"
          />
          <PwField
            id="newPw" label="New Password"
            value={newPassword} onChange={(v) => { setNewPassword(v); setClientError(null); }}
            disabled={busy} autoComplete="new-password"
          />
          <PwField
            id="confirmPw" label="Confirm New Password"
            value={confirmPassword} onChange={(v) => { setConfirmPassword(v); setClientError(null); }}
            disabled={busy} autoComplete="new-password"
          />
        </div>

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

// ─── Notification Sound card ───────────────────────────────────────────────

function NotificationSoundCard() {
  const [enabled, setEnabled] = useState(true);

  // Read persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem(NOTIFICATION_SOUND_KEY);
    if (stored !== null) setEnabled(stored !== "false");
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(NOTIFICATION_SOUND_KEY, String(next));
  }

  return (
    <Card className="attend-card p-6">
      <div className="flex items-center gap-2 mb-5">
        {enabled
          ? <Volume2 className="h-4 w-4 text-[hsl(var(--primary))]" />
          : <VolumeX className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />}
        <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Notification Sound</h2>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            {enabled ? "Sound is on" : "Sound is off"}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Play a chime when new notifications arrive
          </p>
        </div>

        {/* Toggle pill */}
        <button
          type="button"
          onClick={toggle}
          role="switch"
          aria-checked={enabled}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 ${
            enabled ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </Card>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: userResponse } = useGetMe();
  const normalizedRole = normaliseRole(userResponse?.data?.role);

  // Role gates
  const isSuperAdmin = normalizedRole === "super_admin";
  const isJudge      = normalizedRole === "judge";

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
            : isJudge
            ? "View your profile and manage your account security"
            : "Manage your organisation profile, branding, and account security"}
        </p>
      </div>

      <div className="flex flex-col gap-5">

        {/* ══════════════════════════════════════════════════════════════════
            JUDGE VIEW — read-only profile + change password
            ══════════════════════════════════════════════════════════════════ */}
        {isJudge && (
          <JudgeSettingsView user={userResponse?.data as Record<string, any>} />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            NON-SUPER-ADMIN, NON-JUDGE VIEW
            Covers: client_admin, event_manager, viewer, kyc_officer, etc.
            ══════════════════════════════════════════════════════════════════ */}
        {!isSuperAdmin && !isJudge && (
          <>
            {/* Organisation profile + logo upload */}
            <ClientOrgSettings />

            {/* Change password */}
            <ChangePasswordCard />

            {/* Notification sound toggle */}
            <NotificationSoundCard />
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

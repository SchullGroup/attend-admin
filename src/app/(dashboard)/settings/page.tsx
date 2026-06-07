"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Settings, Shield, Link2, Loader2, RefreshCw, Lock, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

// ─── Toggle ────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
        checked ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted-foreground)/0.3)]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "disconnected" | "pending";

interface Integration {
  id: string;
  label: string;
  desc: string;
  status: IntegrationStatus;
  category: string;
}

const INITIAL_INTEGRATIONS: Integration[] = [
  { id: "ngx",      label: "NGX/CSCS Market Data",        desc: "Nigerian Exchange Group & CSCS shareholder data link",   status: "connected",    category: "Market Data" },
  { id: "nibss",    label: "BVN/NIN Gateway (NIBSS)",      desc: "National Identity Management Commission verification",    status: "connected",    category: "Identity" },
  { id: "paystack", label: "Payment Gateway (Paystack)",   desc: "Event registration payment processing",                  status: "connected",    category: "Payments" },
  { id: "mux",      label: "Streaming Provider (Mux)",     desc: "Live virtual event video streaming",                     status: "pending",      category: "Streaming" },
  { id: "termii",   label: "SMS Gateway (Termii)",         desc: "OTP and notification delivery",                          status: "disconnected", category: "Messaging" },
];

const STATUS_CONFIG = {
  connected:    { icon: CheckCircle, color: "text-green-600",  bg: "bg-green-50",  text: "Connected"    },
  disconnected: { icon: XCircle,     color: "text-red-500",    bg: "bg-red-50",    text: "Disconnected" },
  pending:      { icon: Loader2,     color: "text-yellow-600", bg: "bg-yellow-50", text: "Pending"      },
};

// ─── Page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { currentUser, uploadOrgLogo } = useStore();

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => uploadOrgLogo(reader.result as string);
    reader.readAsDataURL(file);
    toast.success("Organisation logo updated.");
  }

  // General
  const [platformName,  setPlatformName]  = useState("Attend Enterprise Platform");
  const [supportEmail,  setSupportEmail]  = useState("support@meristem.com");
  const [emailNotifs,   setEmailNotifs]   = useState(true);
  const [smsNotifs,     setSmsNotifs]     = useState(false);
  const [pushNotifs,    setPushNotifs]    = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Compliance
  const [ndpa,              setNdpa]              = useState(true);
  const [bvnGateway,        setBvnGateway]        = useState(true);
  const [auditRetention,    setAuditRetention]    = useState("7yr");
  const [savingCompliance,  setSavingCompliance]  = useState(false);

  // Integrations
  const [integrations,        setIntegrations]        = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const [integrationsOpen,    setIntegrationsOpen]    = useState(false);
  const [togglingId,          setTogglingId]          = useState<string | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────

  function saveGeneral() {
    if (!platformName.trim()) { toast.error("Platform name cannot be empty."); return; }
    if (!supportEmail.trim()) { toast.error("Support email cannot be empty."); return; }
    setSavingGeneral(true);
    setTimeout(() => {
      setSavingGeneral(false);
      toast.success("General settings saved.");
    }, 900);
  }

  function saveCompliance() {
    setSavingCompliance(true);
    setTimeout(() => {
      setSavingCompliance(false);
      toast.success("Compliance settings saved.");
    }, 900);
  }

  function toggleIntegration(id: string) {
    const item = integrations.find((i) => i.id === id);
    if (!item) return;
    setTogglingId(id);
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i;
          if (i.status === "connected") return { ...i, status: "disconnected" };
          return { ...i, status: "connected" };
        })
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
      setIntegrations((prev) =>
        prev.map((i) => i.id === id ? { ...i, status: "connected" } : i)
      );
      toast.success(`${item?.label} is now connected.`);
      setTogglingId(null);
    }, 1400);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Platform Settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Manage platform configuration, compliance, and integrations
        </p>
      </div>

      <div className="flex flex-col gap-5">

        {/* ── Organisation Profile ─────────────────────────────────────── */}
        <Card className="attend-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
              <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Organisation Profile</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <Lock className="h-3 w-3" />
              Contact support to update registered details
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="mb-2 block text-[hsl(var(--muted-foreground))]">Organisation Name</Label>
              <Input
                value={currentUser?.orgName ?? "Meristem Securities Limited"}
                disabled
                className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
              />
            </div>
            <div>
              <Label className="mb-2 block text-[hsl(var(--muted-foreground))]">RC Number</Label>
              <Input
                value={currentUser?.rcNumber ?? "—"}
                disabled
                className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
              />
            </div>
            <div>
              <Label className="mb-2 block text-[hsl(var(--muted-foreground))]">Registered Email</Label>
              <Input
                value={currentUser?.orgEmail ?? "—"}
                disabled
                className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex items-center gap-5">
            <div
              className="h-14 w-14 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 overflow-hidden"
            >
              {currentUser?.logoUrl
                ? <img src={currentUser.logoUrl} alt="Org logo" className="h-full w-full object-contain" />
                : <Building2 className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
              }
            </div>
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-0.5">Organisation Logo</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                Shown in the top-right header. PNG or SVG, max 2 MB.
              </p>
              <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))] transition-colors">
                {currentUser?.logoUrl ? "Change logo" : "Upload logo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>
        </Card>

        {/* ── General ──────────────────────────────────────────────────── */}
        <Card className="attend-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Settings className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">General</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <Label htmlFor="pname" className="mb-2 block">Platform Name</Label>
              <Input id="pname" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="semail" className="mb-2 block">Support Email</Label>
              <Input id="semail" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
            </div>
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <div className="attend-section-title mb-3">Notification Channels</div>
            <div className="flex flex-col gap-3">
              {[
                { label: "Email Notifications", desc: "Send event notices and updates via email", value: emailNotifs, set: setEmailNotifs },
                { label: "SMS Notifications",   desc: "Send OTPs and alerts via SMS",               value: smsNotifs,   set: setSmsNotifs   },
                { label: "Push Notifications",  desc: "In-app push notifications for mobile users", value: pushNotifs,  set: setPushNotifs  },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">{n.label}</div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">{n.desc}</div>
                  </div>
                  <Toggle checked={n.value} onChange={n.set} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-5">
            <Button size="sm" onClick={saveGeneral} disabled={savingGeneral}>
              {savingGeneral && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {savingGeneral ? "Saving…" : "Save General Settings"}
            </Button>
          </div>
        </Card>

        {/* ── Compliance ────────────────────────────────────────────────── */}
        <Card className="attend-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Compliance</h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="attend-section-title mb-2">Audit Log Retention</div>
              <div className="flex gap-2">
                {(["7yr", "3yr"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAuditRetention(opt)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      auditRetention === opt
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] text-[hsl(var(--primary))]"
                        : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.3)]"
                    }`}
                  >
                    {opt === "7yr" ? "7 Years (Recommended)" : "3 Years"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-[hsl(var(--border))]">
              <div>
                <div className="text-sm font-medium text-[hsl(var(--foreground))]">NDPA Data Processing Consent</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Nigeria Data Protection Act — explicit consent collection enabled
                </div>
              </div>
              <Toggle checked={ndpa} onChange={setNdpa} />
            </div>

            <div className="flex items-center justify-between py-3 border-t border-[hsl(var(--border))]">
              <div>
                <div className="text-sm font-medium text-[hsl(var(--foreground))]">BVN Gateway Compliance Mode</div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Enforce BVN validation for Full KYC upgrade
                </div>
              </div>
              <Toggle checked={bvnGateway} onChange={setBvnGateway} />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button size="sm" onClick={saveCompliance} disabled={savingCompliance}>
              {savingCompliance && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {savingCompliance ? "Saving…" : "Save Compliance Settings"}
            </Button>
          </div>
        </Card>

        {/* ── Integrations ──────────────────────────────────────────────── */}
        <Card className="attend-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Link2 className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Integrations</h2>
          </div>

          <div className="divide-y divide-[hsl(var(--border))]">
            {integrations.map((item) => {
              const c = STATUS_CONFIG[item.status];
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
      </div>

      {/* ── Integrations Dialog ─────────────────────────────────────────── */}
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
              const c = STATUS_CONFIG[item.status];
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
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                        disabled={busy}
                        onClick={() => toggleIntegration(item.id)}
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
                      </Button>
                    )}
                    {item.status === "disconnected" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={busy}
                        onClick={() => toggleIntegration(item.id)}
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect"}
                      </Button>
                    )}
                    {item.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
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
    </div>
  );
}

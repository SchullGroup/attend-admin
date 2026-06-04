"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Settings, Shield, Link2 } from "lucide-react";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted-foreground)/0.3)]"}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${checked ? "translate-x-4" : "translate-x-0.5"}`}
      />
    </button>
  );
}

function IntegrationRow({
  label,
  status,
  desc,
}: {
  label: string;
  status: "connected" | "disconnected" | "pending";
  desc: string;
}) {
  const colors = {
    connected: {
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
      text: "Connected",
    },
    disconnected: {
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-50",
      text: "Disconnected",
    },
    pending: {
      icon: Link2,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      text: "Pending",
    },
  };
  const c = colors[status];
  const Icon = c.icon;
  return (
    <div className="flex items-center justify-between py-3 border-b border-[hsl(var(--border))] last:border-0">
      <div>
        <div className="text-sm font-medium text-[hsl(var(--foreground))]">
          {label}
        </div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          {desc}
        </div>
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.color}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {c.text}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [platformName, setPlatformName] = useState(
    "Attend Enterprise Platform",
  );
  const [supportEmail, setSupportEmail] = useState("support@meristem.com");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [ndpa, setNdpa] = useState(true);
  const [auditRetention, setAuditRetention] = useState("7yr");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Platform Settings
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Manage platform configuration, compliance, and integrations
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <Card className="attend-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Settings className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
              General
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <Label htmlFor="pname" className="mb-2 block">
                Platform Name
              </Label>
              <Input
                id="pname"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="semail" className="mb-2 block">
                Support Email
              </Label>
              <Input
                id="semail"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <div className="attend-section-title mb-3">
              Notification Preferences
            </div>
            <div className="flex flex-col gap-3">
              {[
                {
                  label: "Email Notifications",
                  desc: "Send event reminders and updates via email",
                  value: emailNotifs,
                  set: setEmailNotifs,
                },
                {
                  label: "SMS Notifications",
                  desc: "Send OTPs and alerts via SMS",
                  value: smsNotifs,
                  set: setSmsNotifs,
                },
                {
                  label: "Push Notifications",
                  desc: "In-app push notifications for mobile users",
                  value: pushNotifs,
                  set: setPushNotifs,
                },
              ].map((n) => (
                <div
                  key={n.label}
                  className="flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {n.label}
                    </div>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      {n.desc}
                    </div>
                  </div>
                  <Toggle checked={n.value} onChange={n.set} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end mt-5">
            <Button size="sm">Save General Settings</Button>
          </div>
        </Card>

        <Card className="attend-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
              Compliance
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="attend-section-title mb-2">
                Audit Log Retention
              </div>
              <div className="flex gap-2">
                {["7yr", "3yr"].map((opt) => (
                  <button
                    key={opt}
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
                <div className="text-sm font-medium text-[hsl(var(--foreground))]">
                  NDPA Data Processing Consent
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Nigeria Data Protection Act — explicit consent collection
                  enabled
                </div>
              </div>
              <Toggle checked={ndpa} onChange={setNdpa} />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-[hsl(var(--border))]">
              <div>
                <div className="text-sm font-medium text-[hsl(var(--foreground))]">
                  BVN Gateway Compliance Mode
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Enforce BVN validation for Full KYC upgrade
                </div>
              </div>
              <Toggle checked={true} onChange={() => {}} />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button size="sm">Save Compliance Settings</Button>
          </div>
        </Card>

        <Card className="attend-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Link2 className="h-4 w-4 text-[hsl(var(--primary))]" />
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
              Integrations
            </h2>
          </div>
          <IntegrationRow
            label="NGX/CSCS Market Data"
            desc="Nigerian Exchange Group & CSCS shareholder data link"
            status="connected"
          />
          <IntegrationRow
            label="BVN/NIN Gateway (NIBSS)"
            desc="National Identity Management Commission verification"
            status="connected"
          />
          <IntegrationRow
            label="Payment Gateway (Paystack)"
            desc="Event registration payment processing"
            status="connected"
          />
          <IntegrationRow
            label="Streaming Provider (Mux)"
            desc="Live virtual event video streaming"
            status="pending"
          />
          <IntegrationRow
            label="SMS Gateway (Termii)"
            desc="OTP and notification delivery"
            status="disconnected"
          />
          <div className="flex justify-end mt-4">
            <Button size="sm">Manage Integrations</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

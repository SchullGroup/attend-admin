"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { Registrar } from "@/lib/mock-data";

const PLAN_OPTIONS: Registrar["plan"][] = ["enterprise", "growth", "starter"];

const INDUSTRY_OPTIONS = [
  "Banking & Finance",
  "Insurance",
  "Oil & Gas",
  "FMCG",
  "Telecommunications",
  "Technology / Fintech",
  "Healthcare",
  "Real Estate",
  "Manufacturing",
  "Agriculture",
  "Financial Services",
  "Education",
  "Other",
];

export default function PendingEnrollmentsPage() {
  const { registrars, enrollRegistrar } = useStore();
  const pending = registrars.filter((s) => s.status === "pending");

  const [form, setForm] = useState({
    name: "",
    industry: "",
    rcNumber: "",
    contactEmail: "",
    plan: "starter" as Registrar["plan"],
  });

  function handleFormChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSendInvitation() {
    if (!form.name.trim() || !form.rcNumber.trim() || !form.contactEmail.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    toast.success(`Invitation sent to ${form.name}`);
    setForm({ name: "", industry: "", rcNumber: "", contactEmail: "", plan: "starter" });
  }

  function handleApprove(id: string, name: string) {
    enrollRegistrar(id);
    toast.success(`${name} has been approved and activated.`);
  }

  function handleReject(name: string) {
    toast.error(`Enrollment for ${name} has been rejected.`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Pending Enrollments</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Registrars awaiting review and activation
        </p>
      </div>

      {/* Enroll New Organisation form */}
      <Card className="attend-card p-6">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Enroll New Organisation</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              placeholder="e.g. Access Bank Plc"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Industry</label>
            <select
              value={form.industry}
              onChange={(e) => handleFormChange("industry", e.target.value)}
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            >
              <option value="">Select industry…</option>
              {INDUSTRY_OPTIONS.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              RC Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.rcNumber}
              onChange={(e) => handleFormChange("rcNumber", e.target.value)}
              placeholder="e.g. RC 125384"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Contact Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => handleFormChange("contactEmail", e.target.value)}
              placeholder="e.g. ir@company.com"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Plan</label>
            <select
              value={form.plan}
              onChange={(e) => handleFormChange("plan", e.target.value)}
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow capitalize"
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSendInvitation}>Send Invitation</Button>
        </div>
      </Card>

      {/* Pending requests table */}
      {pending.length > 0 ? (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Pending Requests</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Organisation</th>
                <th className="px-5 py-3 text-left">RC Number</th>
                <th className="px-5 py-3 text-left">Contact Email</th>
                <th className="px-5 py-3 text-left">Requested</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((stk) => (
                <tr key={stk.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{stk.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{stk.industry}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{stk.rcNumber}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{stk.contactEmail}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {new Date(stk.enrolledAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleApprove(stk.id, stk.name)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleReject(stk.name)}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="attend-card p-10 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No pending enrollment requests.</p>
        </Card>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, Users, CalendarDays } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Registrar } from "@/lib/mock-data";

const STATUS_DOT: Record<Registrar["status"], { dot: string; label: string }> = {
  active:    { dot: "#16a34a", label: "Active" },
  suspended: { dot: "#dc2626", label: "Suspended" },
  pending:   { dot: "#f59e0b", label: "Pending" },
};

export default function RegistrarsPage() {
  const { registrars, enrollRegistrar, suspendRegistrar } = useStore();
  const [activeTab, setActiveTab] = useState("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const TABS = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Suspended", value: "suspended" },
  ];

  const filtered = activeTab === "all" ? registrars : registrars.filter((r) => r.status === activeTab);

  const active = registrars.filter((r) => r.status === "active").length;
  const totalRegisters = registrars.reduce((s, r) => s + r.registersCount, 0);
  const totalEvents = registrars.reduce((s, r) => s + r.eventsCount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Registrars</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Platform operators authorised to manage registers and events</p>
        </div>
        <Link href="/registrars/enrol">
          <Button className="gap-2">Enrol Registrar</Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden mb-6">
        {[
          { label: "Active Registrars", value: active, icon: Building2, color: "#111827" },
          { label: "Registers Managed", value: totalRegisters, icon: Users, color: "#374151" },
          { label: "Events Created", value: totalEvents, icon: CalendarDays, color: "#374151" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-4">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
        {TABS.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)} className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${activeTab === tab.value ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Registrar</th>
              <th className="px-5 py-3 text-left">RC Number</th>
              <th className="px-5 py-3 text-left">Representative</th>
              <th className="px-5 py-3 text-left">Registers</th>
              <th className="px-5 py-3 text-left">Events</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Enrolled</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const statusInfo = STATUS_DOT[r.status];
              return (
                <tr key={r.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{r.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{r.industry}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{r.rcNumber}</td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-[hsl(var(--foreground))]">{r.repName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{r.repEmail}</p>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">{r.registersCount}</td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">{r.eventsCount}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusInfo.dot }} />
                      <span className="text-sm text-[hsl(var(--foreground))]">{statusInfo.label}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {new Date(r.enrolledAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {r.status === "active" && (
                        confirmId === r.id ? (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 bg-red-50 font-semibold" onClick={() => { suspendRegistrar(r.id); setConfirmId(null); }}>Confirm?</Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmId(r.id)}>Suspend</Button>
                        )
                      )}
                      {r.status === "suspended" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-50" onClick={() => enrollRegistrar(r.id)}>Activate</Button>
                      )}
                      {r.status === "pending" && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => enrollRegistrar(r.id)}>Approve</Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-14 text-center">
            <Building2 className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">No registrars match this filter</p>
          </div>
        )}
      </Card>
    </div>
  );
}

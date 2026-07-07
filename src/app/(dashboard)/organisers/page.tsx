"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Organiser } from "@/types/mock";

const TABS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
];

const PLAN_STYLE: Record<Organiser["plan"], { label: string; color: string; bg: string }> = {
  enterprise: { label: "Enterprise", color: "#166534", bg: "#dcfce7" },
  growth:     { label: "Growth",     color: "#374151", bg: "#dbeafe" },
  starter:    { label: "Starter",    color: "#6b7280", bg: "#f3f4f6" },
};

const STATUS_DOT: Record<Organiser["status"], { dot: string; label: string }> = {
  active:    { dot: "#16a34a", label: "Active" },
  suspended: { dot: "#dc2626", label: "Suspended" },
  pending:   { dot: "#f59e0b", label: "Pending" },
};

export default function OrganisersPage() {
  const { organisers, enrollOrganiser, suspendOrganiser } = useStore();
  const [activeTab, setActiveTab] = useState("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered =
    activeTab === "all"
      ? organisers
      : organisers.filter((s) => s.status === activeTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Organisers</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Enrolled organisations on the Attend platform
          </p>
        </div>
        <Link href="/organisers/pending">
          <Button className="gap-2">Enroll New Organiser</Button>
        </Link>
      </div>

      <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
              activeTab === tab.value
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Organisation</th>
              <th className="px-5 py-3 text-left">RC Number</th>
              <th className="px-5 py-3 text-left">Plan</th>
              <th className="px-5 py-3 text-left">Events</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Enrolled</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((stk) => {
              const plan = PLAN_STYLE[stk.plan];
              const statusInfo = STATUS_DOT[stk.status];
              return (
                <tr key={stk.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{stk.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{stk.industry}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{stk.rcNumber}</td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ color: plan.color, backgroundColor: plan.bg }}
                    >
                      {plan.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums text-[hsl(var(--foreground))]">
                    {stk.eventsCount}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusInfo.dot }} />
                      <span className="text-sm text-[hsl(var(--foreground))]">{statusInfo.label}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {new Date(stk.enrolledAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/organisers/${stk.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                      </Link>
                      {stk.status === "active" && (
                        confirmId === stk.id ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-600 bg-red-50 font-semibold"
                            onClick={() => { suspendOrganiser(stk.id); setConfirmId(null); }}
                          >
                            Confirm?
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setConfirmId(stk.id)}
                          >
                            Suspend
                          </Button>
                        )
                      )}
                      {stk.status === "suspended" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                          onClick={() => enrollOrganiser(stk.id)}
                        >
                          Activate
                        </Button>
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
            <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No organisers match this filter</p>
            {activeTab !== "all" && (
              <button
                onClick={() => setActiveTab("all")}
                className="text-xs text-[hsl(var(--primary))] hover:underline mt-1"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

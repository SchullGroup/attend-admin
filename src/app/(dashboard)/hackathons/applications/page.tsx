"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { formatDate } from "@/lib/utils";
import type { ApplicationStatus } from "@/lib/mock-data";
import { ChevronDown } from "lucide-react";

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Under Review", value: "under_review" },
  { label: "Shortlisted", value: "shortlisted" },
  { label: "Selected", value: "selected" },
];

const STATUS_OPTIONS: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "selected", "not_progressed"];

export default function ApplicationsPage() {
  const { applications, updateApplicationStatus } = useStore();
  const [activeTab, setActiveTab] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = activeTab === "all" ? applications : applications.filter((a) => a.status === activeTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Applications — MeriHack 2026</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{applications.length} total applications received</p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-full mb-4">
        {STATUS_TABS.map((tab) => (
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
              <th className="px-5 py-3 text-left">Team</th>
              <th className="px-5 py-3 text-left">Idea Title</th>
              <th className="px-5 py-3 text-left">Track</th>
              <th className="px-5 py-3 text-left">Members</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Score</th>
              <th className="px-5 py-3 text-left">Submitted</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr key={app.id} className="attend-table-row">
                <td className="px-5 py-3">
                  <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{app.teamName}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="text-sm text-[hsl(var(--foreground))] max-w-[220px] truncate">{app.ideaTitle}</div>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs bg-purple-50 text-purple-700 rounded-full px-2.5 py-0.5 font-medium">{app.track}</span>
                </td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">{app.memberCount}</td>
                <td className="px-5 py-3"><StatusBadge status={app.status} /></td>
                <td className="px-5 py-3 text-sm font-semibold tabular-nums">
                  {app.score != null ? (
                    <span className="text-[hsl(var(--foreground))]">{app.score}<span className="text-[hsl(var(--muted-foreground))] font-normal">/100</span></span>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))]">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(app.submittedAt)}</td>
                <td className="px-5 py-3">
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setOpenMenu(openMenu === app.id ? null : app.id)}
                    >
                      Update Status
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    {openMenu === app.id && (
                      <div className="absolute right-0 top-8 z-50 min-w-[160px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg p-1">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s}
                            className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
                            onClick={() => {
                              updateApplicationStatus(app.id, s);
                              setOpenMenu(null);
                            }}
                          >
                            <StatusBadge status={s} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No applications found.</div>
        )}
      </Card>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { formatDate } from "@/lib/utils";
import type { ApplicationStatus } from "@/types/mock";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

const STATUS_TABS = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Under Review", value: "under_review" },
  { label: "Shortlisted", value: "shortlisted" },
  { label: "Selected", value: "selected" },
];

const STATUS_OPTIONS: ApplicationStatus[] = [
  "submitted",
  "under_review",
  "shortlisted",
  "selected",
  "not_progressed",
];

const DEFAULT_APPLICATIONS = [
  {
    id: "app_001",
    eventId: "evt_005",
    teamName: "FinTech Gladiators",
    ideaTitle: "DeFi Micro-Lending Platform for SMEs",
    track: "Financial Inclusion",
    status: "shortlisted",
    memberCount: 4,
    submittedAt: "2026-05-20",
    score: 85,
  },
  {
    id: "app_002",
    eventId: "evt_005",
    teamName: "GreenByte",
    ideaTitle: "Eco-Friendly Carbon Ledger",
    track: "Sustainability",
    status: "under_review",
    memberCount: 3,
    submittedAt: "2026-05-21",
    score: 72,
  },
  {
    id: "app_003",
    eventId: "evt_005",
    teamName: "MedConnect",
    ideaTitle: "Telehealth AI Diagnostics",
    track: "Healthcare",
    status: "submitted",
    memberCount: 5,
    submittedAt: "2026-05-22",
  },
  {
    id: "app_004",
    eventId: "evt_005",
    teamName: "EduFlow",
    ideaTitle: "Gamified Local Language Learning App",
    track: "EdTech",
    status: "selected",
    memberCount: 3,
    submittedAt: "2026-05-23",
    score: 94,
  },
  {
    id: "app_005",
    eventId: "evt_005",
    teamName: "PaySplit",
    ideaTitle: "Peer-to-peer bill splitting engine",
    track: "Financial Inclusion",
    status: "not_progressed",
    memberCount: 4,
    submittedAt: "2026-05-24",
  },
];

function getSavedApplications() {
  if (typeof window === "undefined") return DEFAULT_APPLICATIONS;
  const saved = localStorage.getItem("merihack_applications");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return DEFAULT_APPLICATIONS;
    }
  }
  localStorage.setItem(
    "merihack_applications",
    JSON.stringify(DEFAULT_APPLICATIONS),
  );
  return DEFAULT_APPLICATIONS;
}

function saveApplications(apps: any[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("merihack_applications", JSON.stringify(apps));
  }
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    setApplications(getSavedApplications());
  }, []);

  function updateApplicationStatus(id: string, status: any) {
    const updated = applications.map((app) =>
      app.id === id ? { ...app, status } : app,
    );
    setApplications(updated);
    saveApplications(updated);
    toast.success(`Application status updated to ${status.replace("_", " ")}`);
  }

  const filtered =
    activeTab === "all"
      ? applications
      : applications.filter((a: any) => a.status === activeTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Applications — MeriHack 2026
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {applications.length} total applications received
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-fit mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
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
                  <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {app.teamName}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="text-sm text-[hsl(var(--foreground))] max-w-[220px] truncate">
                    {app.ideaTitle}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs bg-purple-50 text-purple-700 rounded-full px-2.5 py-0.5 font-medium">
                    {app.track}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">
                  {app.memberCount}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-5 py-3 text-sm font-semibold tabular-nums">
                  {app.score != null ? (
                    <span className="text-[hsl(var(--foreground))]">
                      {app.score}
                      <span className="text-[hsl(var(--muted-foreground))] font-normal">
                        /100
                      </span>
                    </span>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))]">
                      —
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {formatDate(app.submittedAt)}
                </td>
                <td className="px-5 py-3">
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        setOpenMenu(openMenu === app.id ? null : app.id)
                      }
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
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No applications found.
          </div>
        )}
      </Card>
    </div>
  );
}

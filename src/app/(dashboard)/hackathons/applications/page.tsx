"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { OrgFilter } from "@/components/custom/org-filter";
import { formatDate } from "@/lib/utils";
import type { ApplicationStatus } from "@/lib/mock-data";
import { ChevronDown, ChevronRight, FileText, Users, Star, Lightbulb } from "lucide-react";

const STATUS_TABS = [
  { label: "All",         value: "all" },
  { label: "Submitted",   value: "submitted" },
  { label: "Under Review",value: "under_review" },
  { label: "Shortlisted", value: "shortlisted" },
  { label: "Selected",    value: "selected" },
];

const STATUS_OPTIONS: ApplicationStatus[] = ["submitted", "under_review", "shortlisted", "selected", "not_progressed"];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ── Level 2: applications for a challenge ────────────────────────────────────

function ApplicationsView({ challenge, onBack }: { challenge: any; onBack: () => void }) {
  const { applications, updateApplicationStatus } = useStore();
  const [activeTab, setActiveTab] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const challengeApps = applications; // single hackathon — all apps belong to it
  const filtered = activeTab === "all" ? challengeApps : challengeApps.filter((a) => a.status === activeTab);

  const shortlisted  = challengeApps.filter((a) => a.status === "shortlisted").length;
  const underReview  = challengeApps.filter((a) => a.status === "under_review").length;
  const selected     = challengeApps.filter((a) => a.status === "selected").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Back + header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to Challenges
        </button>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{challenge.title}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{challenge.organiser} · Applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Applications", value: challengeApps.length, icon: FileText, accent: "#7c22c9" },
          { label: "Under Review",        value: underReview,          icon: Users,    accent: "#d97706" },
          { label: "Shortlisted",         value: shortlisted,          icon: Star,     accent: "#0891b2" },
          { label: "Selected",            value: selected,             icon: Star,     accent: "#16a34a" },
        ].map((stat) => (
          <Card key={stat.label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stat.accent + "18" }}>
              <stat.icon className="h-4.5 w-4.5" style={{ color: stat.accent }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{stat.value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
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

      {/* Table */}
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
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold shrink-0">
                      {initials(app.teamName)}
                    </div>
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{app.teamName}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="text-sm text-[hsl(var(--foreground))] max-w-[200px] truncate">{app.ideaTitle}</div>
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
                      Update Status <ChevronDown className="h-3 w-3" />
                    </Button>
                    {openMenu === app.id && (
                      <div className="absolute right-0 top-8 z-50 min-w-[160px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg p-1">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s}
                            className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
                            onClick={() => { updateApplicationStatus(app.id, s); setOpenMenu(null); }}
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

// ── Level 1: challenges table ─────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { events, applications } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState("");

  const hackathons = events.filter((e) => e.module === "HACKATHON");
  const selectedChallenge = hackathons.find((e) => e.id === selectedId);
  const organisers = [...new Set(hackathons.map((e) => e.organiser))].sort();
  const visibleHackathons = orgFilter ? hackathons.filter((e) => e.organiser === orgFilter) : hackathons;

  if (selectedChallenge) {
    return <ApplicationsView challenge={selectedChallenge} onBack={() => setSelectedId(null)} />;
  }

  const total      = applications.length;
  const shortlisted = applications.filter((a) => a.status === "shortlisted").length;
  const selected   = applications.filter((a) => a.status === "selected").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Hackathon Applications</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Select a challenge to review its applications</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Challenges",    value: hackathons.length, icon: Lightbulb, accent: "#7c22c9" },
          { label: "Total Applications",   value: total,             icon: FileText,  accent: "#111827" },
          { label: "Shortlisted / Selected", value: `${shortlisted} / ${selected}`, icon: Star, accent: "#16a34a" },
        ].map((stat) => (
          <Card key={stat.label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stat.accent + "18" }}>
              <stat.icon className="h-4.5 w-4.5" style={{ color: stat.accent }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{stat.value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Challenges</h2>
          <div className="flex items-center gap-3">
            <OrgFilter organisers={organisers} value={orgFilter} onChange={setOrgFilter} />
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{visibleHackathons.length} active</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Challenge</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Format</th>
                <th className="px-5 py-3 text-left">Applications</th>
                <th className="px-5 py-3 text-left">Shortlisted</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {visibleHackathons.map((evt) => (
                <tr key={evt.id} className="attend-table-row">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: "#7c22c9" }}>
                        <Lightbulb className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">{evt.title}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{evt.organiser}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{evt.date}</td>
                  <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))] capitalize">{evt.format}</td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">{total}</td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">{shortlisted}</td>
                  <td className="px-5 py-4">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={evt.status === "live"
                        ? { backgroundColor: "#16a34a18", color: "#16a34a" }
                        : { backgroundColor: "#7c22c918", color: "#7c22c9" }}
                    >
                      <span className="capitalize">{evt.status}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSelectedId(evt.id)}>
                      View Applications <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

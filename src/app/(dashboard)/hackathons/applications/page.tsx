"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { StatusBadge } from "@/components/custom/status-badge";
import { formatDate } from "@/lib/utils";
import { ChevronDown, ChevronRight, FileText, Users, Star, Lightbulb } from "lucide-react";
import {
  useAdminChallenges,
  useAdminChallengeApplications,
  useUpdateApplicationStatus,
  type ApplicationStatus,
  type ChallengeItem,
} from "@/api/admin-challenges";

const STATUS_TABS = [
  { label: "All",           value: "" },
  { label: "Submitted",     value: "SUBMITTED" },
  { label: "Under Review",  value: "UNDER_REVIEW" },
  { label: "Shortlisted",   value: "SHORTLISTED" },
  { label: "Selected",      value: "SELECTED" },
];

const STATUS_OPTIONS: ApplicationStatus[] = [
  "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "SELECTED", "NOT_PROGRESSED",
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function ApplicationsView({ challenge, onBack }: { challenge: ChallengeItem; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState("");
  const [openMenu,  setOpenMenu]  = useState<string | null>(null);

  const { data, isLoading } = useAdminChallengeApplications(challenge.id, activeTab, 0, 100);
  const updateStatus = useUpdateApplicationStatus();

  const apps = data?.content ?? [];
  const shortlisted = apps.filter((a) => a.status === "SHORTLISTED").length;
  const underReview = apps.filter((a) => a.status === "UNDER_REVIEW").length;
  const selected    = apps.filter((a) => a.status === "SELECTED").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Challenges
        </button>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{challenge.title}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{challenge.registerName ?? challenge.organizerName} · Applications</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Applications", value: data?.totalElements ?? apps.length, icon: FileText, accent: "#7c22c9" },
          { label: "Under Review",        value: underReview, icon: Users, accent: "#d97706" },
          { label: "Shortlisted",         value: shortlisted, icon: Star, accent: "#0891b2" },
          { label: "Selected",            value: selected,    icon: Star, accent: "#16a34a" },
        ].map((stat) => (
          <Card key={stat.label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stat.accent + "18" }}>
              <stat.icon className="h-4 w-4" style={{ color: stat.accent }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{stat.value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${activeTab === tab.value ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {isLoading ? <Loader variant="page" text="Loading applications…" /> : (
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
              {apps.map((app) => (
                <tr key={app.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold shrink-0">{initials(app.teamName)}</div>
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{app.teamName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--foreground))] max-w-[200px] truncate">{app.ideaTitle}</td>
                  <td className="px-5 py-3"><span className="text-xs bg-purple-50 text-purple-700 rounded-full px-2.5 py-0.5 font-medium">{app.track}</span></td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">{app.memberCount}</td>
                  <td className="px-5 py-3"><StatusBadge status={app.status} /></td>
                  <td className="px-5 py-3 text-sm font-semibold tabular-nums">
                    {app.score != null ? <span>{app.score}<span className="text-[hsl(var(--muted-foreground))] font-normal">/100</span></span> : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(app.submittedAt)}</td>
                  <td className="px-5 py-3">
                    <div className="relative">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setOpenMenu(openMenu === app.id ? null : app.id)}>
                        Update Status <ChevronDown className="h-3 w-3" />
                      </Button>
                      {openMenu === app.id && (
                        <div className="absolute right-0 top-8 z-50 min-w-[160px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg p-1">
                          {STATUS_OPTIONS.map((s) => (
                            <button key={s} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
                              onClick={() => { updateStatus.mutate({ challengeId: challenge.id, applicationId: app.id, data: { status: s } }); setOpenMenu(null); }}>
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
          {apps.length === 0 && <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No applications found.</div>}
        </Card>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useAdminChallenges(0, 50);

  const challenges = data?.content ?? [];
  const selected   = challenges.find((c) => c.id === selectedId);

  if (isLoading) return <Loader variant="page" text="Loading Challenges…" />;
  if (selected) return <ApplicationsView challenge={selected} onBack={() => setSelectedId(null)} />;

  const totalApps   = challenges.reduce((s, c) => s + (c.applicationCount ?? 0), 0);
  const shortlisted = challenges.reduce((s, c) => s + (c.shortlistedCount ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Hackathon Applications</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Select a challenge to review its applications</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Challenges",      value: challenges.length, icon: Lightbulb, accent: "#7c22c9" },
          { label: "Total Applications",     value: totalApps,         icon: FileText,  accent: "#111827" },
          { label: "Shortlisted",            value: shortlisted,       icon: Star,      accent: "#16a34a" },
        ].map((stat) => (
          <Card key={stat.label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stat.accent + "18" }}>
              <stat.icon className="h-4 w-4" style={{ color: stat.accent }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{stat.value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Challenges</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Challenge</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Applications</th>
              <th className="px-5 py-3 text-left">Shortlisted</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c) => (
              <tr key={c.id} className="attend-table-row">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: "#7c22c9" }}>
                      <Lightbulb className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">{c.title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.registerName ?? c.organizerName ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{c.date}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.applicationCount ?? 0}</td>
                <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedCount ?? 0}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={c.status?.toUpperCase() === "LIVE" ? { backgroundColor: "#16a34a18", color: "#16a34a" } : { backgroundColor: "#7c22c918", color: "#7c22c9" }}>
                    {c.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSelectedId(c.id)}>
                    View Applications <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {challenges.length === 0 && <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No challenges found.</div>}
      </Card>
    </div>
  );
}

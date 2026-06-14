"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, ChevronDown, ArrowLeft, ChevronRight, Search,
  Users, Trophy, Lightbulb,
} from "lucide-react";
import {
  useClientChallenges,
  useClientChallengeApplications,
  useClientChallengeApplication,
  useUpdateClientApplicationStatus,
  type ApplicationStatus,
} from "@/api/client-challenges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusChip(status: string) {
  const s = status?.toUpperCase();
  const map: Record<string, { bg: string; color: string }> = {
    SUBMITTED:      { bg: "#3b82f618", color: "#3b82f6" },
    UNDER_REVIEW:   { bg: "#f59e0b18", color: "#d97706" },
    SHORTLISTED:    { bg: "#0891b218", color: "#0891b2" },
    SELECTED:       { bg: "#16a34a18", color: "#16a34a" },
    NOT_PROGRESSED: { bg: "#6b728018", color: "#6b7280" },
  };
  const style = map[s] ?? { bg: "#7c22c918", color: "#7c22c9" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}

const STATUS_OPTIONS: ApplicationStatus[] = [
  "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "SELECTED", "NOT_PROGRESSED",
];

// ---------------------------------------------------------------------------
// Application detail view
// ---------------------------------------------------------------------------
function ApplicationDetail({
  challengeId,
  applicationId,
  onBack,
}: {
  challengeId:   string;
  applicationId: string;
  onBack:        () => void;
}) {
  const { data: app, isLoading } = useClientChallengeApplication(challengeId, applicationId);
  const updateStatus = useUpdateClientApplicationStatus();

  if (isLoading) return <Loader variant="inline" text="Loading application…" />;
  if (!app) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Not found.</p>;

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors self-start"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Applications
      </button>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-5">
          <Card className="attend-card p-5">
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: app.teamInitialColor || "#7c22c9" }}
              >
                {app.teamInitial || app.teamName?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">{app.teamName}</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{app.ideaTitle}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{app.challengeTitle}</p>
              </div>
              <div className="flex items-center gap-3">
                {statusChip(app.status)}
                {app.hasScore && app.score != null && (
                  <span className="text-lg font-black text-[hsl(var(--foreground))] tabular-nums">
                    {app.score}
                    <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">/{app.scoreOutOf || 100}</span>
                  </span>
                )}
              </div>
            </div>
          </Card>

          {app.members?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Team Members ({app.members.length})
              </h2>
              <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                {app.members.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-bold shrink-0">
                      {m.fullName?.slice(0, 2).toUpperCase() || "??"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{m.fullName}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{m.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {app.criteriaScores?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Judging Criteria Scores</h2>
              <div className="flex flex-col gap-3">
                {app.criteriaScores.map((c) => {
                  const pct = c.weight > 0 ? Math.min(Math.round((c.score / c.weight) * 100), 100) : 0;
                  return (
                    <div key={c.criterion}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-[hsl(var(--foreground))]">{c.criterion}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{c.score}/{c.weight}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#7c22c9" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Update Status</h2>
            <div className="flex flex-col gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={app.status === s || updateStatus.isPending}
                  onClick={() => updateStatus.mutate({ challengeId, applicationId: app.id, status: s })}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    app.status === s
                      ? "bg-[hsl(var(--muted))] cursor-not-allowed"
                      : "hover:bg-[hsl(var(--accent))] border border-[hsl(var(--border))]"
                  }`}
                >
                  {statusChip(s)}
                </button>
              ))}
            </div>
          </Card>

          {app.statusHistory?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">History</h2>
              <div className="flex flex-col gap-3">
                {app.statusHistory.map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7c22c9] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{h.status}</p>
                      {h.by   && <p className="text-xs text-[hsl(var(--muted-foreground))]">by {h.by}</p>}
                      {h.note && <p className="text-xs text-[hsl(var(--muted-foreground))] italic">{h.note}</p>}
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        {new Date(h.timestamp).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Details</h2>
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              <div className="py-2 flex justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Track</span>
                <span className="text-xs font-medium text-[hsl(var(--foreground))]">{app.track || "—"}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Submitted</span>
                <span className="text-xs font-medium text-[hsl(var(--foreground))]">
                  {app.submittedAt
                    ? new Date(app.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applications list for a single challenge
// ---------------------------------------------------------------------------
function ChallengeApplications({
  challengeId,
  onViewDetail,
}: {
  challengeId:  string;
  onViewDetail: (appId: string) => void;
}) {
  const [activeStatus, setActiveStatus] = useState("");
  const [activeTrack,  setActiveTrack]  = useState("");
  const [openMenu,     setOpenMenu]     = useState<string | null>(null);
  const updateStatus = useUpdateClientApplicationStatus();

  const { data, isLoading } = useClientChallengeApplications(challengeId, activeStatus, activeTrack, 0, 100);

  const apps   = data?.applications ?? [];
  const tabs   = data?.tabs ?? [];
  const tracks = Array.from(new Set(apps.map((a) => a.track).filter(Boolean)));

  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
          <button
            onClick={() => setActiveStatus("")}
            className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-center ${
              activeStatus === "" ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            All
          </button>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-center ${
                activeStatus === tab.key ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] rounded-full px-1.5 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {tracks.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Track:</span>
          {["", ...tracks].map((t) => (
            <button
              key={t || "all"}
              onClick={() => setActiveTrack(t)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                activeTrack === t
                  ? "bg-[#7c22c9] text-white"
                  : "bg-[#faf5ff] text-[#7c22c9] border border-[#e9d5ff] hover:bg-[#f3e8ff]"
              }`}
            >
              {t || "All tracks"}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Loader variant="inline" text="Loading applications…" />
      ) : (
        <Card className="attend-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Team</th>
                <th className="px-5 py-3 text-left">Idea</th>
                <th className="px-5 py-3 text-left">Track</th>
                <th className="px-5 py-3 text-left">Members</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Score</th>
                <th className="px-5 py-3 text-left">Submitted</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: app.teamInitialColor || "#7c22c9" }}
                      >
                        {app.teamInitial || app.teamName?.slice(0, 2).toUpperCase()}
                      </div>
                      <button
                        className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition-colors text-left"
                        onClick={() => onViewDetail(app.id)}
                      >
                        {app.teamName}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--foreground))] max-w-[180px] truncate">{app.ideaTitle}</td>
                  <td className="px-5 py-3">
                    <span
                      className="text-xs rounded-full px-2.5 py-0.5 font-medium"
                      style={{
                        backgroundColor: app.trackColor ? app.trackColor + "18" : "#faf5ff",
                        color: app.trackColor || "#7c22c9",
                      }}
                    >
                      {app.track || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-center tabular-nums">{app.memberCount}</td>
                  <td className="px-5 py-3">{statusChip(app.status)}</td>
                  <td className="px-5 py-3 text-sm font-semibold tabular-nums">
                    {app.hasScore && app.score != null
                      ? <span>{app.score}<span className="text-[hsl(var(--muted-foreground))] font-normal">/{app.scoreOutOf || 100}</span></span>
                      : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    {app.submittedLabel || formatDate(app.submittedAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="relative inline-flex items-center gap-1">
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2"
                        onClick={() => onViewDetail(app.id)}
                      >
                        View <ChevronRight className="h-3 w-3" />
                      </Button>
                      <div className="relative">
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => setOpenMenu(openMenu === app.id ? null : app.id)}
                        >
                          Status <ChevronDown className="h-3 w-3" />
                        </Button>
                        {openMenu === app.id && (
                          <div className="absolute right-0 top-8 z-50 min-w-[170px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg p-1">
                            {STATUS_OPTIONS.map((s) => (
                              <button
                                key={s}
                                className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
                                onClick={() => {
                                  updateStatus.mutate({ challengeId, applicationId: app.id, status: s });
                                  setOpenMenu(null);
                                }}
                              >
                                {statusChip(s)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {apps.length === 0 && !isLoading && (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No applications found.</div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ApplicationsPage() {
  const router = useRouter();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [selectedAppId,       setSelectedAppId]       = useState<string | null>(null);
  const [search,              setSearch]              = useState("");

  const { data, isLoading } = useClientChallenges("", "", 0, 100);
  const challenges = data?.challenges ?? [];
  const summary    = data?.summary;

  const selectedChallenge = challenges.find((c) => c.id === selectedChallengeId);

  if (isLoading) return <Loader variant="page" text="Loading Applications…" />;

  // Application detail drill-down
  if (selectedChallengeId && selectedAppId) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <button
            onClick={() => setSelectedAppId(null)}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Applications
          </button>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Application Detail</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{selectedChallenge?.title}</p>
        </div>
        <ApplicationDetail
          challengeId={selectedChallengeId}
          applicationId={selectedAppId}
          onBack={() => setSelectedAppId(null)}
        />
      </div>
    );
  }

  // Challenge selected — show its applications list
  if (selectedChallengeId) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <button
            onClick={() => setSelectedChallengeId(null)}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Challenges
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{selectedChallenge?.title}</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                {selectedChallenge?.organiserName} · {formatDate(selectedChallenge?.date ?? "")} · Applications
              </p>
            </div>
            <Button
              variant="outline" size="sm" className="gap-1.5"
              onClick={() => router.push(`/hackathons/${selectedChallengeId}`)}
            >
              Open Challenge <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ChallengeApplications
          challengeId={selectedChallengeId}
          onViewDetail={(appId) => setSelectedAppId(appId)}
        />
      </div>
    );
  }

  // Default: challenge picker
  const filtered = search
    ? challenges.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.organiserName ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : challenges;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button
          onClick={() => router.push("/hackathons")}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-2 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Innovation Challenges
        </button>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Applications</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Review and manage applications across all challenges
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Applications", value: summary.totalApplications, icon: FileText,  color: "#7c22c9" },
            { label: "Active Challenges",  value: summary.activeChallenges,  icon: Lightbulb, color: "#0891b2" },
            { label: "Teams to Score",     value: summary.teamsToScore,      icon: Trophy,    color: "#d97706" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="attend-card p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-[hsl(var(--foreground))]">{value}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder="Search challenges…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Select a Challenge</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Click a challenge to review its applications</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Challenge</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Shortlisted</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const s = c.status?.toUpperCase();
              const style = s === "LIVE" ? { bg: "#16a34a18", color: "#16a34a" }
                : s === "PUBLISHED"      ? { bg: "#0891b218", color: "#0891b2" }
                : s === "ENDED"          ? { bg: "#6b728018", color: "#6b7280" }
                : { bg: "#7c22c918", color: "#7c22c9" };
              return (
                <tr
                  key={c.id}
                  className="attend-table-row cursor-pointer"
                  onClick={() => setSelectedChallengeId(c.id)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c22c918" }}>
                        <Lightbulb className="h-4 w-4" style={{ color: "#7c22c9" }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[240px]">{c.title}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.organiserName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{formatDate(c.date)}</td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedTeams ?? 0}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.color }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedChallengeId(c.id); }}>
                      View Applications <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {search ? "No challenges match your search." : "No challenges found."}
          </div>
        )}
      </Card>
    </div>
  );
}

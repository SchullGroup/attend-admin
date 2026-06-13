"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Trophy, Users, FileText, Lightbulb, Star, ChevronDown,
  Plus, Trash2, ToggleLeft, ToggleRight, ListOrdered, Target, Award,
  ClipboardList, UserCheck, BookOpen,
} from "lucide-react";
import {
  useClientChallengeDetail,
  useClientChallengeApplications,
  useClientChallengeLeaderboard,
  useClientChallengeApplication,
  useUpdateClientApplicationStatus,
  useToggleApplicationsOpen,
  useAddJudge,
  useRemoveJudge,
  type ApplicationStatus,
  type ApplicationItem,
  type JudgeItem,
} from "@/api/client-challenges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import { popup } from "@/lib/popup-store";

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
// Overview tab
// ---------------------------------------------------------------------------
function OverviewTab({ challengeId }: { challengeId: string }) {
  const { data: c, isLoading } = useClientChallengeDetail(challengeId);
  const toggleOpen = useToggleApplicationsOpen();

  if (isLoading) return <Loader variant="inline" text="Loading…" />;
  if (!c) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Challenge not found.</p>;

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* Left — main detail */}
      <div className="col-span-2 flex flex-col gap-5">

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Applications", value: c.applicationCount, icon: FileText,  color: "#7c22c9" },
            { label: "Shortlisted",  value: c.shortlistedCount, icon: Star,      color: "#0891b2" },
            { label: "Judges",       value: c.judgeCount,       icon: UserCheck, color: "#16a34a" },
            { label: "Top Prize",    value: c.topPrizePool || "—", icon: Trophy, color: "#d97706", isText: true },
          ].map(({ label, value, icon: Icon, color, isText }) => (
            <Card key={label} className="attend-card p-4 flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: color + "18" }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className={`font-bold text-[hsl(var(--foreground))] ${isText ? "text-sm" : "text-lg"}`}>
                  {value}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Description */}
        {c.description && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Description
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">
              {c.description}
            </p>
          </Card>
        )}

        {/* Problem statement */}
        {c.problemStatement && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" /> Problem Statement
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">
              {c.problemStatement}
            </p>
          </Card>
        )}

        {/* Expected deliverable */}
        {c.expectedDeliverable && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Expected Deliverable
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">
              {c.expectedDeliverable}
            </p>
          </Card>
        )}

        {/* Eligibility */}
        {c.eligibilityCriteria && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
              <ListOrdered className="h-4 w-4" /> Eligibility Criteria
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">
              {c.eligibilityCriteria}
            </p>
          </Card>
        )}
      </div>

      {/* Right — sidebar */}
      <div className="flex flex-col gap-5">

        {/* Key dates */}
        <Card className="attend-card p-5">
          <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Key Dates</h2>
          <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
            <div className="py-2.5 flex justify-between">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Event Date</span>
              <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{formatDate(c.date)}</span>
            </div>
            {c.applicationDeadline && (
              <div className="py-2.5 flex justify-between">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">App Deadline</span>
                <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{formatDate(c.applicationDeadline)}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Team size */}
        {(c.minTeamSize || c.maxTeamSize) && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Team Size</h2>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-[hsl(var(--muted)/0.5)] p-3 text-center">
                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{c.minTeamSize ?? "—"}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Min</p>
              </div>
              <span className="text-[hsl(var(--muted-foreground))]">–</span>
              <div className="flex-1 rounded-xl bg-[hsl(var(--muted)/0.5)] p-3 text-center">
                <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{c.maxTeamSize ?? "—"}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Max</p>
              </div>
            </div>
          </Card>
        )}

        {/* Tracks */}
        {c.tracks?.length > 0 && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Tracks</h2>
            <div className="flex flex-wrap gap-2">
              {c.tracks.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}
                >
                  {t}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Prizes */}
        {c.prizeTiers?.length > 0 && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Prize Tiers
            </h2>
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              {c.prizeTiers.map((p) => (
                <div key={p.position} className="py-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] w-16">{p.position}</span>
                  <span className="text-sm font-bold text-[hsl(var(--foreground))]">{p.reward}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Applications toggle */}
        <Card className="attend-card p-5">
          <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Applications</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                {c.applicationsOpen ? "Open" : "Closed"}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {c.applicationsOpen ? "Participants can apply" : "Applications are paused"}
              </p>
            </div>
            <Button
              size="sm"
              variant={c.applicationsOpen ? "outline" : "default"}
              disabled={toggleOpen.isPending}
              className="gap-1.5"
              onClick={() => toggleOpen.mutate({ challengeId, open: !c.applicationsOpen })}
            >
              {c.applicationsOpen
                ? <><ToggleRight className="h-4 w-4" /> Close</>
                : <><ToggleLeft className="h-4 w-4" /> Open</>}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applications tab
// ---------------------------------------------------------------------------
function ApplicationsTab({ challengeId }: { challengeId: string }) {
  const [activeStatus, setActiveStatus]  = useState("");
  const [activeTrack,  setActiveTrack]   = useState("");
  const [openMenu,     setOpenMenu]      = useState<string | null>(null);
  const [selectedApp,  setSelectedApp]   = useState<string | null>(null);

  const { data, isLoading } = useClientChallengeApplications(challengeId, activeStatus, activeTrack, 0, 100);
  const updateStatus = useUpdateClientApplicationStatus();

  const apps = data?.applications ?? [];
  const tabs = data?.tabs ?? [];
  const tracks = Array.from(new Set(apps.map((a) => a.track).filter(Boolean)));

  if (selectedApp) {
    return (
      <ApplicationDetailPanel
        challengeId={challengeId}
        applicationId={selectedApp}
        onBack={() => setSelectedApp(null)}
        onStatusChange={(appId, status) =>
          updateStatus.mutate({ challengeId, applicationId: appId, status })
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary chips */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Applications", value: data.summary.totalApplications, color: "#7c22c9" },
            { label: "Active Challenges",  value: data.summary.activeChallenges,  color: "#0891b2" },
            { label: "Teams to Score",     value: data.summary.teamsToScore,      color: "#d97706" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="attend-card p-4">
              <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Status tabs from API */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
          <button
            onClick={() => setActiveStatus("")}
            className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-center ${
              activeStatus === ""
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            All
          </button>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-center ${
                activeStatus === tab.key
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
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

      {/* Track filter */}
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

      {/* Table */}
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
                        onClick={() => setSelectedApp(app.id)}
                      >
                        {app.teamName}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--foreground))] max-w-[180px] truncate">
                    {app.ideaTitle}
                  </td>
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
                  <td className="px-5 py-3 text-sm font-medium text-center tabular-nums">
                    {app.memberCount}
                  </td>
                  <td className="px-5 py-3">
                    {statusChip(app.status)}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold tabular-nums">
                    {app.hasScore && app.score != null
                      ? <span>{app.score}<span className="text-[hsl(var(--muted-foreground))] font-normal">/{app.scoreOutOf || 100}</span></span>
                      : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    {app.submittedLabel || formatDate(app.submittedAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="relative inline-block">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {apps.length === 0 && !isLoading && (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No applications found.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Application detail panel
// ---------------------------------------------------------------------------
function ApplicationDetailPanel({
  challengeId,
  applicationId,
  onBack,
  onStatusChange,
}: {
  challengeId:    string;
  applicationId:  string;
  onBack:         () => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}) {
  const { data: app, isLoading } = useClientChallengeApplication(challengeId, applicationId);

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
          {/* Team header */}
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
              </div>
              <div className="flex items-center gap-3">
                {statusChip(app.status)}
                {app.hasScore && app.score != null && (
                  <span className="text-lg font-black text-[hsl(var(--foreground))] tabular-nums">
                    {app.score}<span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">/{app.scoreOutOf || 100}</span>
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Members */}
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

          {/* Criteria scores */}
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
                        <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                          {c.score}/{c.weight}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: "#7c22c9" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-5">
          {/* Status update */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Update Status</h2>
            <div className="flex flex-col gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={app.status === s}
                  onClick={() => onStatusChange(app.id, s)}
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

          {/* Status history */}
          {app.statusHistory?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">History</h2>
              <div className="flex flex-col gap-3">
                {app.statusHistory.map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7c22c9] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{h.status}</p>
                      {h.by && <p className="text-xs text-[hsl(var(--muted-foreground))]">by {h.by}</p>}
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

          {/* Meta */}
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
                  {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—"}
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
// Leaderboard tab
// ---------------------------------------------------------------------------
function LeaderboardTab({ challengeId }: { challengeId: string }) {
  const { data, isLoading } = useClientChallengeLeaderboard(challengeId);

  if (isLoading) return <Loader variant="inline" text="Loading leaderboard…" />;

  const results = data?.results ?? [];

  const medalColor = (rank: number) => {
    if (rank === 1) return "#f59e0b"; // gold
    if (rank === 2) return "#94a3b8"; // silver
    if (rank === 3) return "#d97706"; // bronze
    return "#6b7280";
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top 3 podium */}
      {results.length >= 1 && (
        <div className="grid grid-cols-3 gap-4">
          {[results[1], results[0], results[2]].map((r, i) => {
            if (!r) return <div key={i} />;
            const actualRank = i === 1 ? 1 : i === 0 ? 2 : 3;
            const color = medalColor(r.rank);
            return (
              <Card
                key={r.applicationId}
                className={`attend-card p-5 text-center ${actualRank === 1 ? "ring-2 ring-amber-400" : ""}`}
              >
                <div
                  className="h-10 w-10 rounded-full mx-auto flex items-center justify-center text-white text-lg font-black mb-2"
                  style={{ backgroundColor: color }}
                >
                  {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
                </div>
                <p className="text-sm font-bold text-[hsl(var(--foreground))]">{r.teamName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{r.ideaTitle}</p>
                <p className="text-xs mt-1" style={{ color }}>{r.track}</p>
                <p className="text-2xl font-black tabular-nums mt-2" style={{ color }}>
                  {r.score.toFixed(1)}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">score</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            {data?.challengeTitle ? `${data.challengeTitle} — Leaderboard` : "Full Leaderboard"}
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left w-12">Rank</th>
              <th className="px-5 py-3 text-left">Team</th>
              <th className="px-5 py-3 text-left">Idea</th>
              <th className="px-5 py-3 text-left">Track</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.applicationId} className="attend-table-row">
                <td className="px-5 py-3">
                  <span
                    className="text-sm font-black tabular-nums"
                    style={{ color: medalColor(r.rank) }}
                  >
                    #{r.rank}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-[hsl(var(--foreground))]">
                  {r.teamName}
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[200px] truncate">
                  {r.ideaTitle}
                </td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
                    {r.track}
                  </span>
                </td>
                <td className="px-5 py-3">{statusChip(r.status)}</td>
                <td className="px-5 py-3 text-right text-sm font-bold tabular-nums">
                  {r.score.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No scored entries yet. Score teams from the Applications tab first.
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judges tab
// ---------------------------------------------------------------------------
function JudgesTab({ challengeId }: { challengeId: string }) {
  const { data: challenge, isLoading } = useClientChallengeDetail(challengeId);
  const addJudge    = useAddJudge();
  const removeJudge = useRemoveJudge();

  const [showForm,  setShowForm]  = useState(false);
  const [name,      setName]      = useState("");
  const [org,       setOrg]       = useState("");
  const [track,     setTrack]     = useState("");

  // The judges list isn't a separate endpoint — we get judge count from detail,
  // but the actual list would need to come from an endpoint if it exists.
  // For now show the count + add/remove UI.
  const judges: JudgeItem[] = (challenge as any)?.judges ?? [];

  if (isLoading) return <Loader variant="inline" text="Loading…" />;

  function handleAdd() {
    if (!name.trim()) return;
    addJudge.mutate(
      { challengeId, data: { name: name.trim(), organization: org.trim(), specialtyTrack: track.trim() || undefined } },
      {
        onSuccess: () => {
          setName(""); setOrg(""); setTrack(""); setShowForm(false);
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Judges {challenge?.judgeCount != null ? `(${challenge.judgeCount})` : ""}
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Manage judges assigned to this challenge
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> Add Judge
        </Button>
      </div>

      {/* Add judge form */}
      {showForm && (
        <Card className="attend-card p-5">
          <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">New Judge</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">
                Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Judge name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">
                Organisation
              </label>
              <Input
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder="Organisation (optional)"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">
                Specialty Track
              </label>
              <Input
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                placeholder="Track (optional)"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button
              size="sm"
              disabled={!name.trim() || addJudge.isPending}
              onClick={handleAdd}
            >
              {addJudge.isPending ? "Adding…" : "Add Judge"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Judges list */}
      {judges.length > 0 ? (
        <Card className="attend-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Judge</th>
                <th className="px-5 py-3 text-left">Organisation</th>
                <th className="px-5 py-3 text-left">Specialty Track</th>
                <th className="px-5 py-3 text-left">Assigned</th>
                <th className="px-5 py-3 text-left">Scored</th>
                <th className="px-5 py-3 text-left">Progress</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {judges.map((j) => (
                <tr key={j.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: j.color || "#7c22c9" }}
                      >
                        {j.initials || j.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{j.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{j.organization || "—"}</td>
                  <td className="px-5 py-3">
                    {j.specialtyTrack
                      ? <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>{j.specialtyTrack}</span>
                      : <span className="text-xs text-[hsl(var(--muted-foreground))]">All tracks</span>}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold tabular-nums">{j.assignedCount}</td>
                  <td className="px-5 py-3 text-sm font-semibold tabular-nums">{j.scoredCount}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden min-w-[60px]">
                        <div
                          className="h-full rounded-full bg-[#7c22c9]"
                          style={{ width: `${j.progressPercent ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-8 text-right">
                        {j.progressPercent ?? 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                      disabled={removeJudge.isPending}
                      onClick={() => removeJudge.mutate({ challengeId, judgeId: j.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="attend-card p-12 text-center">
          <UserCheck className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No judges assigned yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Add judges using the button above to start the scoring process.
          </p>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — orchestrator
// ---------------------------------------------------------------------------
const TABS = ["Overview", "Applications", "Leaderboard", "Judges"] as const;
type Tab = typeof TABS[number];

export default function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");

  const { data: challenge, isLoading } = useClientChallengeDetail(challengeId);

  if (isLoading) return <Loader variant="page" text="Loading Challenge…" />;
  if (!challenge) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Challenge not found</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/hackathons")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div>
        <button
          onClick={() => router.push("/hackathons")}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Challenges
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: "#7c22c918" }}
            >
              <Lightbulb className="h-5 w-5" style={{ color: "#7c22c9" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] leading-tight">
                {challenge.title}
              </h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                {formatDate(challenge.date)}
                {challenge.topPrizePool ? ` · Top prize: ${challenge.topPrizePool}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={
                challenge.status?.toUpperCase() === "LIVE"
                  ? { backgroundColor: "#16a34a18", color: "#16a34a" }
                  : { backgroundColor: "#7c22c918", color: "#7c22c9" }
              }
            >
              {challenge.status}
            </span>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: challenge.applicationsOpen ? "#16a34a18" : "#6b728018",
                color:           challenge.applicationsOpen ? "#16a34a"   : "#6b7280",
              }}
            >
              Applications {challenge.applicationsOpen ? "Open" : "Closed"}
            </span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
              tab === t
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t}
            {t === "Applications" && challenge.applicationCount > 0 && (
              <span className="ml-1.5 text-[10px] font-bold bg-[#7c22c918] text-[#7c22c9] rounded-full px-1.5 py-0.5">
                {challenge.applicationCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === "Overview"     && <OverviewTab     challengeId={challengeId} />}
      {tab === "Applications" && <ApplicationsTab challengeId={challengeId} />}
      {tab === "Leaderboard"  && <LeaderboardTab  challengeId={challengeId} />}
      {tab === "Judges"       && <JudgesTab        challengeId={challengeId} />}
    </div>
  );
}

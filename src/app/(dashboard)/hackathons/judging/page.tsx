"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Trophy, ArrowLeft, ChevronRight, Search, Lightbulb,
  Star, UserCheck, Plus, Trash2, CheckCircle2, MessageSquare,
  ExternalLink, FileText, Video, Code, Globe, Link2, Users, ClipboardList, Eye,
} from "lucide-react";
import {
  useClientChallenges,
  useClientChallengeLeaderboard,
  useClientChallengeDetail,
  useClientChallengeJudges,
  useGetJudgePool,
  useAddJudgeToPool,
  useAssignJudge,
  useRemoveJudge,
  useRemoveJudgeFromPool,
  type JudgeItem,
} from "@/api/client-challenges";
import { AssignmentsSection } from "../components/AssignmentsSection";
import {
  useJudgeChallenges,
  useJudgeChallengeApplications,
  useJudgeChallengeLeaderboard,
  useJudgeScoringPanel,
  useJudgeApplication,
  useSubmitJudgeScore,
  type SubmitScoreResponse,
} from "@/api/judge";
import { useGetMe } from "@/api/auth/hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

const JUDGE_ROLES = new Set(["judge"]);

// ---------------------------------------------------------------------------
// Status chip
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

const medalColor = (rank: number) => {
  if (rank === 1) return "#f59e0b";
  if (rank === 2) return "#94a3b8";
  if (rank === 3) return "#d97706";
  return "#6b7280";
};

// ---------------------------------------------------------------------------
// Leaderboard panel
// ---------------------------------------------------------------------------
function LeaderboardPanel({ challengeId }: { challengeId: string }) {
  const { data, isLoading } = useClientChallengeLeaderboard(challengeId);

  if (isLoading) return <Loader variant="inline" text="Loading leaderboard…" />;

  const results = data?.results ?? [];

  return (
    <div className="flex flex-col gap-5">
      {results.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[results[1], results[0], results[2]].map((r, i) => {
            if (!r) return <div key={i} />;
            const actualRank = i === 1 ? 1 : i === 0 ? 2 : 3;
            const color = medalColor(r.rank);
            return (
              <Card key={r.applicationId} className={`attend-card p-5 text-center ${actualRank === 1 ? "ring-2 ring-amber-400" : ""}`}>
                <div className="h-10 w-10 rounded-full mx-auto flex items-center justify-center text-white text-lg font-black mb-2" style={{ backgroundColor: color }}>
                  {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
                </div>
                <p className="text-sm font-bold text-[hsl(var(--foreground))]">{r.teamName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{r.ideaTitle}</p>
                <p className="text-xs mt-1" style={{ color }}>{r.track}</p>
                <p className="text-2xl font-black tabular-nums mt-2" style={{ color }}>{r.score.toFixed(1)}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">score</p>
              </Card>
            );
          })}
        </div>
      )}

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
              <th className="px-5 py-3 text-right">Avg. Score</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.applicationId} className="attend-table-row">
                <td className="px-5 py-3">
                  <span className="text-sm font-black tabular-nums" style={{ color: medalColor(r.rank) }}>#{r.rank}</span>
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-[hsl(var(--foreground))]">{r.teamName}</td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[200px] truncate">{r.ideaTitle}</td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
                    {r.track}
                  </span>
                </td>
                <td className="px-5 py-3">{statusChip(r.status)}</td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm font-bold tabular-nums">{r.score.toFixed(1)}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]"> /100</span>
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
// Judges panel
// ---------------------------------------------------------------------------
type JudgePanelFormTab = "pool" | "new";

function JudgesPanel({ challengeId }: { challengeId: string }) {
  const { data: challenge } = useClientChallengeDetail(challengeId);
  const { data: panel,  isLoading: judgesLoading } = useClientChallengeJudges(challengeId);
  const judges = panel?.judges ?? [];
  const { data: pool  = [], isLoading: poolLoading }    = useGetJudgePool();
  const addJudgeToPool   = useAddJudgeToPool();
  const assignJudge      = useAssignJudge();
  const unassignJudge    = useRemoveJudge();


  const [showForm,   setShowForm]   = useState(false);
  const [formTab,    setFormTab]    = useState<JudgePanelFormTab>("pool");
  const [selectedId, setSelectedId] = useState("");
  const [track,      setTrack]      = useState("");
  const [newName,    setNewName]    = useState("");
  const [newEmail,   setNewEmail]   = useState("");
  const [newOrg,     setNewOrg]     = useState("");
  const [newTrack,   setNewTrack]   = useState("");

  // Pool judges not yet assigned to this challenge
  const assignedIds = new Set(judges.map((j) => j.id));
  const available   = pool.filter((p) => !assignedIds.has(p.id));

  function openForm() {
    setShowForm(true);
    setFormTab(available.length > 0 ? "pool" : "new");
    setSelectedId(""); setTrack("");
    setNewName(""); setNewEmail(""); setNewOrg(""); setNewTrack("");
  }

  function handleAssignFromPool() {
    if (!selectedId) return;
    assignJudge.mutate(
      { challengeId, judgeId: selectedId, data: { specialtyTrack: track.trim() || undefined } },
      { onSuccess: () => { setSelectedId(""); setTrack(""); setShowForm(false); } }
    );
  }

  function handleAddNew() {
    if (!newName.trim()) return;
    addJudgeToPool.mutate(
      { name: newName.trim(), email: newEmail.trim() || undefined, organization: newOrg.trim() || undefined },
      {
        onSuccess: (newJudge) => {
          // Chain: add to pool → assign to challenge
          assignJudge.mutate(
            { challengeId, judgeId: newJudge.id, data: { specialtyTrack: newTrack.trim() || undefined } },
            { onSuccess: () => { setNewName(""); setNewEmail(""); setNewOrg(""); setNewTrack(""); setShowForm(false); } }
          );
        },
      }
    );
  }

  const isBusy = addJudgeToPool.isPending || assignJudge.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Judges {judges.length > 0 ? `(${judges.length})` : challenge?.judgeCount != null ? `(${challenge.judgeCount})` : ""}
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Scoring is averaged across all assigned judges
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openForm}>
          <Plus className="h-3.5 w-3.5" /> Assign Judge
        </Button>
      </div>

      {showForm && (
        <Card className="attend-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[hsl(var(--foreground))]">Assign Judge to Challenge</h3>
            <button onClick={() => setShowForm(false)} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">✕</button>
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 mb-4 self-start">
            {(["pool", "new"] as JudgePanelFormTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setFormTab(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  formTab === t ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                }`}
              >
                {t === "pool" ? "From Judge Pool" : "Add New Judge"}
              </button>
            ))}
          </div>

          {formTab === "pool" ? (
            poolLoading ? (
              <Loader variant="inline" text="Loading pool…" />
            ) : available.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {pool.length === 0
                    ? "No judges in your pool yet. Add a new judge to get started."
                    : "All judges in your pool are already assigned to this challenge."}
                </p>
                <button className="mt-3 text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => setFormTab("new")}>
                  Add a new judge
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto rounded-lg border border-[hsl(var(--border))] p-1">
                  {available.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id === selectedId ? "" : p.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selectedId === p.id ? "bg-[#7c22c9] text-white" : "hover:bg-[hsl(var(--accent))]"
                      }`}
                    >
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: selectedId === p.id ? "rgba(255,255,255,0.25)" : "#7c22c918",
                          color: selectedId === p.id ? "#fff" : "#7c22c9",
                        }}
                      >
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{p.name}</p>
                        {(p.email || p.organization) && (
                          <p className={`text-xs truncate ${selectedId === p.id ? "text-purple-200" : "text-[hsl(var(--muted-foreground))]"}`}>
                            {[p.email, p.organization].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      {selectedId === p.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Specialty Track (optional)</label>
                  <Input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="e.g. Fintech, Healthcare…" className="h-9" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Button size="sm" disabled={!selectedId || isBusy} onClick={handleAssignFromPool}>
                    {isBusy ? "Assigning…" : "Assign Selected Judge"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Full Name *</label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Judge full name" className="h-9" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Email</label>
                  <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="judge@example.com" className="h-9" type="email" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Organisation</label>
                  <Input value={newOrg} onChange={(e) => setNewOrg(e.target.value)} placeholder="Organisation (optional)" className="h-9" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Specialty Track</label>
                  <Input value={newTrack} onChange={(e) => setNewTrack(e.target.value)} placeholder="e.g. Fintech, Healthcare…" className="h-9" />
                </div>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                This will add the judge to your pool and immediately assign them to this challenge.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={!newName.trim() || isBusy} onClick={handleAddNew}>
                  {isBusy ? "Adding…" : "Add & Assign Judge"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {judgesLoading ? (
        <Loader variant="inline" text="Loading judges…" />
      ) : judges.length > 0 ? (
        <Card className="attend-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Judge</th>
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
                        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: j.color || "#7c22c9" }}
                      >
                        {j.initials || j.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{j.name}</p>
                        {j.specialtyTrack && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9" }}>
                            {j.specialtyTrack}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold tabular-nums">{j.assignedCount}</td>
                  <td className="px-5 py-3 text-sm font-semibold tabular-nums">{j.scoredCount}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden min-w-[60px]">
                        <div className="h-full rounded-full bg-[#7c22c9]" style={{ width: `${j.progressPercent ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-8 text-right">{j.progressPercent ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                      disabled={unassignJudge.isPending}
                      onClick={() => unassignJudge.mutate({ challengeId, judgeId: j.id })}
                      title="Unassign from challenge"
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
            Assign judges from your pool. Scores will be averaged across all judges.
          </p>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Challenge judging view
// ---------------------------------------------------------------------------
type JudgingTab = "Leaderboard" | "Judges" | "Assignments";

function ChallengeJudging({ challengeId }: { challengeId: string }) {
  const [tab, setTab] = useState<JudgingTab>("Leaderboard");

  // Fetched here (not inside AssignmentsSection) so the same judges/tracks
  // data feeding the Judges tab also feeds Assignments — keeps this page
  // in sync with the challenge detail page's Judges tab, which renders the
  // exact same <AssignmentsSection>.
  const { data: challenge }   = useClientChallengeDetail(challengeId);
  const { data: judgePanel }  = useClientChallengeJudges(challengeId);
  const judges = judgePanel?.judges ?? [];

  const TABS: { key: JudgingTab; icon: React.ElementType; label: string }[] = [
    { key: "Leaderboard",  icon: Trophy,       label: "Leaderboard"  },
    { key: "Judges",       icon: UserCheck,    label: "Judges"       },
    { key: "Assignments",  icon: ClipboardList, label: "Assignments" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 self-start">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
              tab === key
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "Leaderboard" && <LeaderboardPanel  challengeId={challengeId} />}
      {tab === "Judges"      && <JudgesPanel        challengeId={challengeId} />}
      {tab === "Assignments" && (
        <AssignmentsSection
          challengeId={challengeId}
          judges={judges}
          tracks={challenge?.tracks ?? []}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureAbsoluteUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

// ---------------------------------------------------------------------------
// Judge application detail panel
// ---------------------------------------------------------------------------

function JudgeAppDetailPanel({
  challengeId,
  applicationId,
  onBack,
}: {
  challengeId:   string;
  applicationId: string;
  onBack:        () => void;
}) {
  const { data: app, isLoading } = useJudgeApplication(challengeId, applicationId);

  if (isLoading) return <Loader variant="inline" text="Loading application…" />;
  if (!app) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Not found.</p>;

  const links = [
    { label: "Pitch Deck",      url: app.pitchDeckUrl,           icon: FileText,     desc: "PDF / PPTX"        },
    { label: "Pitch Video",     url: app.pitchVideoUrl,          icon: Video,        desc: "YouTube or Loom"   },
    { label: "Idea Video",      url: app.ideaVideoUrl,           icon: Video,        desc: "Idea walkthrough"  },
    { label: "Demo Video",      url: app.demoVideoUrl,           icon: Video,        desc: "Product demo"      },
    { label: "Source Code",     url: app.sourceCodeUrl,          icon: Code,         desc: "GitHub / GitLab"   },
    { label: "Live Demo",       url: app.liveDemoUrl,            icon: Globe,        desc: "Deployed app"      },
    { label: "Supporting Doc",  url: app.ideaSupportingDocUrl,   icon: FileText,     desc: "Idea support file" },
    { label: "Additional Docs", url: app.additionalDocumentsUrl, icon: Link2,        desc: "Extra documents"   },
  ].filter((l) => !!l.url) as { label: string; url: string; icon: React.ElementType; desc: string }[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Scoring
        </button>
        <Button size="sm" className="gap-1.5" onClick={onBack}>
          <Star className="h-3.5 w-3.5" /> Score this Team
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* ── Left ── */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Header */}
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
                {app.track && (
                  <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
                    {app.track}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {statusChip(app.status)}
                {app.hasScore && app.score != null && (
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-black text-[hsl(var(--foreground))] tabular-nums">
                      {app.score}<span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">/{app.scoreOutOf || 100}</span>
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">avg. score</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Idea description */}
          {app.ideaDescription && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Idea
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.ideaDescription}</p>
            </Card>
          )}

          {/* Project description */}
          {app.projectDescription && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Project Description
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.projectDescription}</p>
            </Card>
          )}

          {/* Submission links */}
          {links.length > 0 && (
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <ExternalLink className="h-4 w-4" style={{ color: "#7c22c9" }} />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Submission Links</h2>
              </div>
              <div className="divide-y divide-[hsl(var(--border))]">
                {[0, 2, 4, 6].map((startIdx) => {
                  const pair = links.slice(startIdx, startIdx + 2);
                  if (pair.length === 0) return null;
                  return (
                    <div key={startIdx} className={`grid gap-0 ${pair.length === 2 ? "grid-cols-2 divide-x divide-[hsl(var(--border))]" : "grid-cols-1"}`}>
                      {pair.map((l) => (
                        <a
                          key={l.label}
                          href={ensureAbsoluteUrl(l.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-5 py-4 hover:bg-[hsl(var(--accent))] transition-colors group"
                        >
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c22c918" }}>
                            <l.icon className="h-4 w-4" style={{ color: "#7c22c9" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))] group-hover:text-[#7c22c9] transition-colors">{l.label}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{l.desc}</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                        </a>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Team members */}
          {app.members?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Team Members ({app.members.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {app.members.map((m) => {
                  const raw = m as any;
                  const memberName = m.fullName || raw.name || raw.memberName ||
                    [raw.firstName, raw.lastName].filter(Boolean).join(" ") ||
                    m.email?.split("@")[0] || "Unknown";
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(var(--muted)/0.3)]">
                      <div className="h-8 w-8 rounded-full bg-[#7c22c918] flex items-center justify-center text-xs font-bold shrink-0 text-[#7c22c9]">
                        {memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{memberName}</p>
                        {m.email && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{m.email}</p>}
                        {m.role && (
                          <span className="mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#faf5ff", color: "#7c22c9" }}>
                            {m.role}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Criteria scores */}
          {app.criteriaScores?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Scoring Criteria
              </h2>
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

        {/* ── Right ── */}
        <div className="flex flex-col gap-5">
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Details</h2>
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              <div className="py-2 flex justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Status</span>
                <span className="text-xs font-medium">{statusChip(app.status)}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Track</span>
                <span className="text-xs font-medium text-[hsl(var(--foreground))] text-right">{app.track || "—"}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Submitted</span>
                <span className="text-xs font-medium text-[hsl(var(--foreground))] text-right">
                  {app.submittedAt
                    ? new Date(app.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Members</span>
                <span className="text-xs font-medium text-[hsl(var(--foreground))] text-right">{app.members?.length ?? 0}</span>
              </div>
              {app.hasScore && app.score != null && (
                <div className="py-2 flex justify-between gap-2">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Avg. Score</span>
                  <span className="text-xs font-bold text-[hsl(var(--foreground))] text-right tabular-nums">
                    {app.score}/{app.scoreOutOf || 100}
                  </span>
                </div>
              )}
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
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge scoring panel (JUDGE role)
// ---------------------------------------------------------------------------

function JudgeScoringPanel({ challengeId, challengeTitle, onBack, hideHeader }: {
  challengeId:    string;
  challengeTitle: string;
  onBack:         () => void;
  hideHeader?:    boolean;
}) {
  const { data, isLoading } = useJudgeScoringPanel(challengeId);
  const submitScore = useSubmitJudgeScore();

  const [scores,        setScores]        = useState<Record<string, string>>({});
  const [comments,      setComments]      = useState<Record<string, string>>({});
  const [editing,       setEditing]       = useState<Record<string, boolean>>({});
  const [latestResult,  setLatestResult]  = useState<Record<string, SubmitScoreResponse>>({});
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [initialized,   setInitialized]   = useState(false);

  const applications = data?.applications ?? [];
  const criteria     = data?.criteria     ?? [];

  // Pre-fill score/comment inputs from API data on first load
  useEffect(() => {
    if (!initialized && applications.length > 0) {
      const initScores:   Record<string, string> = {};
      const initComments: Record<string, string> = {};
      applications.forEach((a) => {
        if (a.score != null)  initScores[a.applicationId]   = String(a.score);
        if (a.comment)        initComments[a.applicationId] = a.comment;
      });
      setScores(initScores);
      setComments(initComments);
      setInitialized(true);
    }
  }, [applications, initialized]);

  const scoredCount = applications.filter(
    (a) => a.score != null || latestResult[a.applicationId]
  ).length;

  // Drill into full application detail
  if (selectedAppId) {
    return (
      <JudgeAppDetailPanel
        challengeId={challengeId}
        applicationId={selectedAppId}
        onBack={() => setSelectedAppId(null)}
      />
    );
  }

  if (isLoading) return <Loader variant="page" text="Loading scoring panel…" />;

  function handleSubmit(appId: string) {
    const score = parseFloat(scores[appId] ?? "");
    if (isNaN(score) || score < 0 || score > 100) return;
    submitScore.mutate(
      { challengeId, applicationId: appId, data: { score, comment: comments[appId]?.trim() || undefined } },
      {
        onSuccess: (result) => {
          setLatestResult((r) => ({ ...r, [appId]: result }));
          setEditing((e) => ({ ...e, [appId]: false }));
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header — hidden when embedded inside a tab view */}
      {!hideHeader && (
        <div>
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> My Dashboard
          </button>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{data?.challengeTitle || challengeTitle}</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Score each shortlisted team · {scoredCount}/{applications.length} scored
          </p>
        </div>
      )}

      {/* Progress bar */}
      {applications.length > 0 && (
        <div className="h-1.5 w-full rounded-full bg-[hsl(var(--muted))] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#7c22c9] transition-all"
            style={{ width: `${Math.round((scoredCount / applications.length) * 100)}%` }}
          />
        </div>
      )}

      {/* Criteria */}
      {criteria.length > 0 && (
        <Card className="attend-card p-5">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Scoring Criteria</h2>
          <div className="flex flex-wrap gap-2">
            {criteria.map((c, i) => (
              <span
                key={c.name ? `${c.name}-${i}` : i}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] font-medium"
              >
                {c.name}
                {c.weight ? <span className="font-bold text-[hsl(var(--foreground))]"> · {c.weight}%</span> : null}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Application scoring cards */}
      <div className="flex flex-col gap-4">
        {applications.map((app, idx) => {
          const latest       = latestResult[app.applicationId];
          const myScore      = latest?.score        ?? app.score;
          const avgScore     = latest?.averageScore ?? app.averageScore;
          const judgeCount   = app.judgeCount ?? 0;
          const hasMyScore   = myScore != null || (app.scored ?? false);
          const isEditing    = editing[app.applicationId] ?? false;
          const showForm     = !hasMyScore || isEditing;
          const rank         = app.rank;

          return (
            <Card key={app.applicationId} className="attend-card p-5">
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <span
                    className="h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
                    style={rank != null
                      ? { backgroundColor: medalColor(rank) + "22", color: medalColor(rank) }
                      : { backgroundColor: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }
                    }
                  >
                    {rank != null ? `#${rank}` : idx + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[hsl(var(--foreground))]">{app.teamName}</p>
                    {app.ideaTitle && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{app.ideaTitle}</p>}
                    {app.track && (
                      <span className="mt-1 inline-flex text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
                        {app.track}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasMyScore && (
                    <div className="flex items-center gap-1.5 text-green-700 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Scored
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedAppId(app.applicationId)}
                    className="flex items-center gap-1 text-xs text-[#7c22c9] hover:underline font-medium"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </button>
                </div>
              </div>

              {/* Average badge (shown whenever other judges have also scored) */}
              {avgScore != null && judgeCount > 1 && (
                <div className="mb-3 flex items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium" style={{ backgroundColor: "#7c22c918", color: "#7c22c9" }}>
                    <Star className="h-3 w-3" />
                    Avg across {judgeCount} judges: <strong className="tabular-nums">{avgScore.toFixed(1)}</strong>
                  </div>
                </div>
              )}

              {showForm ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-end gap-3">
                    <div className="flex flex-col gap-1.5 w-28">
                      <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Score (0–100)</label>
                      <Input
                        type="number" min={0} max={100}
                        placeholder="e.g. 85"
                        value={scores[app.applicationId] ?? ""}
                        onChange={(e) => setScores((s) => ({ ...s, [app.applicationId]: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Comment (optional)
                      </label>
                      <Input
                        placeholder="Add a comment…"
                        value={comments[app.applicationId] ?? ""}
                        onChange={(e) => setComments((s) => ({ ...s, [app.applicationId]: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm" className="h-9"
                        disabled={!scores[app.applicationId] || submitScore.isPending}
                        onClick={() => handleSubmit(app.applicationId)}
                      >
                        {hasMyScore ? "Update" : "Submit"}
                      </Button>
                      {hasMyScore && isEditing && (
                        <Button
                          size="sm" variant="outline" className="h-9"
                          onClick={() => setEditing((e) => ({ ...e, [app.applicationId]: false }))}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Scored summary — edit button allows re-scoring */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span>Your score: <strong className="text-[hsl(var(--foreground))] tabular-nums">{myScore}</strong></span>
                    </div>
                    {app.comment && (
                      <span className="text-xs italic text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">"{app.comment}"</span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditing((e) => ({ ...e, [app.applicationId]: true }))}
                    className="text-xs text-[#7c22c9] hover:underline font-medium shrink-0"
                  >
                    Edit Score
                  </button>
                </div>
              )}
            </Card>
          );
        })}

        {applications.length === 0 && (
          <Card className="attend-card p-12 text-center">
            <Trophy className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">No shortlisted teams yet</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Teams will appear here once shortlisted by the organiser.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge — read-only applications list for a challenge
// ---------------------------------------------------------------------------

function JudgeApplicationsList({
  challengeId,
  onViewDetail,
}: {
  challengeId:  string;
  onViewDetail: (appId: string) => void;
}) {
  const [activeStatus, setActiveStatus] = useState("");
  const [activeTrack,  setActiveTrack]  = useState("");
  const { data, isLoading } = useJudgeChallengeApplications(challengeId, activeStatus, activeTrack, 0, 100);
  const apps  = data?.applications ?? [];
  const tabs  = data?.tabs         ?? [];
  const tracks = Array.from(new Set(apps.map((a) => a.track).filter(Boolean)));

  if (isLoading) return <Loader variant="inline" text="Loading applications…" />;

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

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Team</th>
              <th className="px-5 py-3 text-left">Idea</th>
              <th className="px-5 py-3 text-left">Track</th>
              <th className="px-5 py-3 text-left">Members</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Avg. Score</th>
              <th className="px-5 py-3 text-left">Submitted</th>
              <th className="px-5 py-3 text-right"></th>
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
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{app.teamName}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--foreground))] max-w-[180px] truncate">{app.ideaTitle}</td>
                <td className="px-5 py-3">
                  <span className="text-xs rounded-full px-2.5 py-0.5 font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
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
                <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">{formatDate(app.submittedAt)}</td>
                <td className="px-5 py-3 text-right">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" onClick={() => onViewDetail(app.id)}>
                    View <ChevronRight className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {apps.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No applications found.</div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge leaderboard panel — uses /api/v1/judge/... endpoint
// ---------------------------------------------------------------------------

function JudgeLeaderboardPanel({ challengeId }: { challengeId: string }) {
  const { data, isLoading } = useJudgeChallengeLeaderboard(challengeId);

  if (isLoading) return <Loader variant="inline" text="Loading leaderboard…" />;

  const results = data?.results ?? [];

  return (
    <div className="flex flex-col gap-5">
      {results.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[results[1], results[0], results[2]].map((r, i) => {
            if (!r) return <div key={i} />;
            const color = medalColor(r.rank);
            return (
              <Card key={r.applicationId} className={`attend-card p-5 text-center ${r.rank === 1 ? "ring-2 ring-amber-400" : ""}`}>
                <div className="h-10 w-10 rounded-full mx-auto flex items-center justify-center text-white text-lg font-black mb-2" style={{ backgroundColor: color }}>
                  {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}
                </div>
                <p className="text-sm font-bold text-[hsl(var(--foreground))]">{r.teamName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{r.ideaTitle}</p>
                <p className="text-xs mt-1" style={{ color }}>{r.track}</p>
                <p className="text-2xl font-black tabular-nums mt-2" style={{ color }}>{r.score.toFixed(1)}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">score</p>
              </Card>
            );
          })}
        </div>
      )}

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
              <th className="px-5 py-3 text-right">Avg. Score</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.applicationId} className="attend-table-row">
                <td className="px-5 py-3">
                  <span className="text-sm font-black tabular-nums" style={{ color: medalColor(r.rank) }}>#{r.rank}</span>
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-[hsl(var(--foreground))]">{r.teamName}</td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[200px] truncate">{r.ideaTitle}</td>
                <td className="px-5 py-3">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
                    {r.track}
                  </span>
                </td>
                <td className="px-5 py-3">{statusChip(r.status)}</td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm font-bold tabular-nums">{r.score.toFixed(1)}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]"> /100</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No scored entries yet.
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge challenge view — Score (default) | Leaderboard tabs
// ---------------------------------------------------------------------------

type JudgeChallengeTab = "Score" | "Leaderboard";

function JudgeChallengeView({
  challengeId,
  challengeTitle,
  challengeOrg,
  challengeDate,
  onBack,
}: {
  challengeId:    string;
  challengeTitle: string;
  challengeOrg?:  string;
  challengeDate?: string;
  onBack:         () => void;
}) {
  const [tab, setTab] = useState<JudgeChallengeTab>("Score");

  const TABS: { key: JudgeChallengeTab; icon: React.ElementType; label: string }[] = [
    { key: "Score",       icon: Star,    label: "Score Teams"  },
    { key: "Leaderboard", icon: Trophy,  label: "Leaderboard"  },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Challenges
        </button>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{challengeTitle}</h1>
        {(challengeOrg || challengeDate) && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            {[challengeOrg, challengeDate ? formatDate(challengeDate) : ""].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 self-start">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
              tab === key
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "Score" && (
        <JudgeScoringPanel
          challengeId={challengeId}
          challengeTitle={challengeTitle}
          onBack={onBack}
          hideHeader
        />
      )}
      {tab === "Leaderboard" && <JudgeLeaderboardPanel challengeId={challengeId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge full browser (JUDGE role)
// ---------------------------------------------------------------------------

function JudgeJudgingPage() {
  const searchParams = useSearchParams();
  const paramId    = searchParams.get("id")    ?? null;
  const paramTitle = searchParams.get("title") ?? "";

  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(paramId);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useJudgeChallenges("", "", 0, 100);
  const challenges = data?.challenges ?? [];
  const summary    = data?.summary;

  // If a challenge is selected (from list or URL param), show tabbed view
  const selected = challenges.find((c) => c.id === selectedChallengeId);

  if (selectedChallengeId) {
    return (
      <JudgeChallengeView
        challengeId={selectedChallengeId}
        challengeTitle={selected?.title ?? decodeURIComponent(paramTitle) ?? "Challenge"}
        challengeOrg={selected?.organiserName}
        challengeDate={selected?.date}
        onBack={() => setSelectedChallengeId(null)}
      />
    );
  }

  if (isLoading) return <Loader variant="page" text="Loading challenges…" />;

  const filtered = search
    ? challenges.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.organiserName ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : challenges;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">My Challenges</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Select a challenge to view applications, leaderboard, and score teams
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Challenges",  value: summary.activeChallenges,  icon: Lightbulb, color: "#7c22c9" },
            { label: "Total Applications", value: summary.totalApplications, icon: FileText,  color: "#0891b2" },
            { label: "Shortlisted",        value: summary.shortlisted ?? summary.teamsToScore ?? 0, icon: Trophy, color: "#d97706" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="attend-card p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-[hsl(var(--foreground))]">{value ?? 0}</p>
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
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Click to view applications, leaderboard, and score</p>
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
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedCount ?? c.shortlistedTeams ?? 0}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.color }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedChallengeId(c.id); }}>
                      Open <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {search ? "No challenges match your search." : "No challenges assigned yet."}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (role gate — no hooks below the branch)
// ---------------------------------------------------------------------------
export default function JudgingPage() {
  const { data: userResponse } = useGetMe();
  const normalizedRole = (userResponse?.data?.role ?? "").toLowerCase().replace(/[-\s]/g, "_");
  const isJudge = JUDGE_ROLES.has(normalizedRole);

  if (isJudge) return <JudgeJudgingPage />;
  return <ClientJudgingView />;
}

// ---------------------------------------------------------------------------
// Client / admin judging view
// ---------------------------------------------------------------------------
function ClientJudgingView() {
  const router = useRouter();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [search,              setSearch]              = useState("");

  const { data, isLoading } = useClientChallenges("", "", 0, 100);
  const challenges = data?.challenges ?? [];
  const summary    = data?.summary;

  const selectedChallenge = challenges.find((c) => c.id === selectedChallengeId);

  if (isLoading) return <Loader variant="page" text="Loading Judging…" />;

  // Challenge selected — show leaderboard + judges
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
                {selectedChallenge?.organiserName} · {formatDate(selectedChallenge?.date ?? "")} · Judging & Scoring
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
        <ChallengeJudging challengeId={selectedChallengeId} />
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
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Judging & Scoring</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          View leaderboards and manage judges across all challenges
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Challenges",  value: summary.activeChallenges,  icon: Lightbulb, color: "#7c22c9" },
            { label: "Teams to Score",     value: summary.teamsToScore,      icon: Star,      color: "#d97706" },
            { label: "Total Applications", value: summary.totalApplications, icon: Trophy,    color: "#0891b2" },
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
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Click a challenge to view its leaderboard and manage judges</p>
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
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedCount ?? c.shortlistedTeams ?? 0}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.color }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedChallengeId(c.id); }}>
                      View Judging <ChevronRight className="h-3.5 w-3.5" />
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

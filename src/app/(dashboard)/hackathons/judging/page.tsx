"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, ArrowLeft, ChevronRight, Search, Lightbulb,
  Star, UserCheck, Plus, Trash2,
} from "lucide-react";
import {
  useClientChallenges,
  useClientChallengeLeaderboard,
  useClientChallengeDetail,
  useAddJudge,
  useRemoveJudge,
  type JudgeItem,
} from "@/api/client-challenges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

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
              <th className="px-5 py-3 text-right">Score</th>
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
                <td className="px-5 py-3 text-right text-sm font-bold tabular-nums">{r.score.toFixed(1)}</td>
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
function JudgesPanel({ challengeId }: { challengeId: string }) {
  const { data: challenge, isLoading } = useClientChallengeDetail(challengeId);
  const addJudge    = useAddJudge();
  const removeJudge = useRemoveJudge();

  const [showForm, setShowForm] = useState(false);
  const [name,     setName]     = useState("");
  const [org,      setOrg]      = useState("");
  const [track,    setTrack]    = useState("");

  const judges: JudgeItem[] = (challenge as any)?.judges ?? [];

  if (isLoading) return <Loader variant="inline" text="Loading…" />;

  function handleAdd() {
    if (!name.trim()) return;
    addJudge.mutate(
      { challengeId, data: { name: name.trim(), organization: org.trim(), specialtyTrack: track.trim() || undefined } },
      { onSuccess: () => { setName(""); setOrg(""); setTrack(""); setShowForm(false); } }
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Judges {challenge?.judgeCount != null ? `(${challenge.judgeCount})` : ""}
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Manage judges assigned to this challenge</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> Add Judge
        </Button>
      </div>

      {showForm && (
        <Card className="attend-card p-5">
          <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">New Judge</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Judge name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">Organisation</label>
              <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Organisation (optional)" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">Specialty Track</label>
              <Input value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Track (optional)" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button size="sm" disabled={!name.trim() || addJudge.isPending} onClick={handleAdd}>
              {addJudge.isPending ? "Adding…" : "Add Judge"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

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
                        <div className="h-full rounded-full bg-[#7c22c9]" style={{ width: `${j.progressPercent ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-8 text-right">{j.progressPercent ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
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
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Add judges using the button above to start the scoring process.</p>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Challenge judging view
// ---------------------------------------------------------------------------
type JudgingTab = "Leaderboard" | "Judges";

function ChallengeJudging({ challengeId }: { challengeId: string }) {
  const [tab, setTab] = useState<JudgingTab>("Leaderboard");
  const TABS: JudgingTab[] = ["Leaderboard", "Judges"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 self-start">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              tab === t
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t === "Leaderboard" ? <span className="flex items-center gap-1.5"><Trophy className="h-3.5 w-3.5" /> Leaderboard</span>
              : <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Judges</span>}
          </button>
        ))}
      </div>

      {tab === "Leaderboard" && <LeaderboardPanel challengeId={challengeId} />}
      {tab === "Judges"      && <JudgesPanel      challengeId={challengeId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function JudgingPage() {
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
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedTeams ?? 0}</td>
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

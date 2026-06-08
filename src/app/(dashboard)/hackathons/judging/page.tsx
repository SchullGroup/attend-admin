"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { OrgFilter } from "@/components/custom/org-filter";
import { Trophy, Star, ChevronRight, Lightbulb, Users } from "lucide-react";

const CRITERIA = [
  { label: "Innovation",          points: 25, desc: "Originality and novelty of the idea" },
  { label: "Feasibility",         points: 25, desc: "Technical and business viability" },
  { label: "Technical Execution", points: 25, desc: "Quality of implementation and demo" },
  { label: "Business Potential",  points: 25, desc: "Market opportunity and revenue model" },
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ── Level 2: judging panel for a challenge ────────────────────────────────────

function JudgingView({ challenge, onBack }: { challenge: any; onBack: () => void }) {
  const { applications } = useStore();
  const shortlisted = applications.filter((a) => a.status === "shortlisted");

  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(shortlisted.map((a) => [a.id, a.score?.toString() ?? ""]))
  );
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  const scoredCount = shortlisted.filter((a) => submitted[a.id] || a.score != null).length;

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
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{challenge.organiser} · Judging Panel</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Teams to Score", value: shortlisted.length, icon: Trophy, accent: "#7c22c9" },
          { label: "Scored",          value: scoredCount,        icon: Star,   accent: "#16a34a" },
          { label: "Pending",         value: shortlisted.length - scoredCount, icon: Users, accent: "#d97706" },
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

      {/* Content */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-4">
          {shortlisted.length === 0 && (
            <Card className="attend-card p-12 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-[hsl(var(--muted-foreground))]">No shortlisted applications yet.</p>
              <p className="text-sm mt-1 text-[hsl(var(--muted-foreground))]">Go to Applications to shortlist teams.</p>
            </Card>
          )}
          {shortlisted.map((app, rank) => (
            <Card key={app.id} className="attend-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-6 w-6 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold">
                      {rank + 1}
                    </div>
                    <span className="text-xs bg-purple-50 text-purple-700 rounded-full px-2.5 py-0.5 font-medium">{app.track}</span>
                  </div>
                  <h3 className="text-base font-bold text-[hsl(var(--foreground))]">{app.teamName}</h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{app.ideaTitle}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{app.memberCount} members</p>
                </div>
                {app.score != null && (
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.15)]">
                    <Star className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
                    <span className="text-lg font-bold tabular-nums text-[hsl(var(--primary))]">{app.score}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">/100</span>
                  </div>
                )}
              </div>
              {submitted[app.id] ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <Trophy className="h-4 w-4" />
                  Score submitted: <span className="font-bold">{scores[app.id]}/100</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="attend-section-title mb-2 block">Score (0–100)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Enter score"
                      value={scores[app.id] ?? ""}
                      onChange={(e) => setScores((prev) => ({ ...prev, [app.id]: e.target.value }))}
                      className="max-w-[160px]"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="mt-6 h-9"
                    disabled={scores[app.id] === undefined || scores[app.id] === ""}
                    onClick={() => setSubmitted((prev) => ({ ...prev, [app.id]: true }))}
                  >
                    Submit Score
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="col-span-1">
          <Card className="attend-card p-5 sticky top-20">
            <div className="attend-section-title mb-4">Scoring Criteria</div>
            <div className="flex flex-col gap-3">
              {CRITERIA.map((c) => (
                <div key={c.label} className="rounded-xl border border-[hsl(var(--border))] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{c.label}</span>
                    <span className="text-xs font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] rounded-full px-2 py-0.5">{c.points} pts</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.desc}</p>
                </div>
              ))}
              <div className="rounded-xl bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.15)] p-3 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[hsl(var(--primary))]">Total</span>
                  <span className="text-base font-bold text-[hsl(var(--primary))]">100 pts</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Level 1: challenges table ─────────────────────────────────────────────────

export default function JudgingPage() {
  const { events, applications } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState("");

  const hackathons  = events.filter((e) => e.module === "HACKATHON");
  const shortlisted = applications.filter((a) => a.status === "shortlisted").length;
  const selectedChallenge = hackathons.find((e) => e.id === selectedId);
  const organisers = [...new Set(hackathons.map((e) => e.organiser))].sort();
  const visibleHackathons = orgFilter ? hackathons.filter((e) => e.organiser === orgFilter) : hackathons;

  if (selectedChallenge) {
    return <JudgingView challenge={selectedChallenge} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Judging Panel</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Select a challenge to score shortlisted teams</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Challenges", value: hackathons.length,     icon: Lightbulb, accent: "#7c22c9" },
          { label: "Teams to Score",    value: shortlisted,           icon: Trophy,    accent: "#d97706" },
          { label: "Total Applications",value: applications.length,   icon: Users,     accent: "#111827" },
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
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Challenge</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Format</th>
                <th className="px-5 py-3 text-left">Shortlisted Teams</th>
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
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">{shortlisted}</td>
                  <td className="px-5 py-4">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: "#7c22c918", color: "#7c22c9" }}
                    >
                      <span className="capitalize">{evt.status}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSelectedId(evt.id)}>
                      Open Judging <ChevronRight className="h-3.5 w-3.5" />
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

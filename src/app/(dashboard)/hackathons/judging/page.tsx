"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { Trophy, Star, ChevronRight, Lightbulb, Users } from "lucide-react";
import { useAdminChallenges, useAdminChallengesJudging, useSubmitJudgingScores, type ChallengeItem } from "@/api/admin-challenges";
import { toast } from "sonner";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function JudgingView({ challenge, onBack }: { challenge: ChallengeItem; onBack: () => void }) {
  const { data: panel, isLoading } = useAdminChallengesJudging();
  const submitScores = useSubmitJudgingScores();

  const shortlisted = panel?.shortlisted ?? [];
  const criteria    = panel?.criteria ?? [
    { name: "Innovation",          weight: 25 },
    { name: "Feasibility",         weight: 25 },
    { name: "Technical Execution", weight: 25 },
    { name: "Business Potential",  weight: 25 },
  ];

  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(shortlisted.map((a) => [a.id, a.score?.toString() ?? ""]))
  );
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const scoredCount = shortlisted.filter((a) => submitted[a.id] || a.score != null).length;

  if (isLoading) return <Loader variant="page" text="Loading judging panel…" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Challenges
        </button>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{panel?.challengeTitle ?? challenge.title}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{challenge.registerName ?? challenge.organizerName} · Judging Panel</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Teams to Score", value: shortlisted.length, icon: Trophy, accent: "#7c22c9" },
          { label: "Scored",          value: scoredCount,        icon: Star,   accent: "#16a34a" },
          { label: "Pending",         value: shortlisted.length - scoredCount, icon: Users, accent: "#d97706" },
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
      <div className="grid grid-cols-4 gap-3">
        {criteria.map((c) => (
          <Card key={c.name} className="attend-card p-4 text-center">
            <p className="text-2xl font-black text-[hsl(var(--foreground))] tabular-nums">{c.weight}%</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{c.name}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {shortlisted.length === 0 ? (
          <Card className="attend-card p-8 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No shortlisted teams yet. Shortlist teams from the Applications tab first.</p>
          </Card>
        ) : shortlisted.map((app, i) => {
          const isSubmitted = submitted[app.id] || app.score != null;
          return (
            <Card key={app.id} className="attend-card p-5">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
                  {initials(app.teamName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{app.teamName}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{app.ideaTitle} · {app.track}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="0" max="100"
                          placeholder="Score"
                          className="w-20 h-8 text-sm"
                          value={scores[app.id] ?? ""}
                          onChange={(e) => setScores((s) => ({ ...s, [app.id]: e.target.value }))}
                          disabled={isSubmitted}
                        />
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">/100</span>
                      </div>
                      {isSubmitted ? (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 rounded-full px-2.5 py-0.5">Scored ✓</span>
                      ) : (
                        <Button size="sm" className="h-8 gap-1.5"
                          disabled={!scores[app.id] || submitScores.isPending}
                          onClick={() => {
                            submitScores.mutate(
                              { challengeId: challenge.id, data: { scores: [{ applicationId: app.id, score: parseInt(scores[app.id]) }] } },
                              { onSuccess: () => setSubmitted((s) => ({ ...s, [app.id]: true })) }
                            );
                          }}>
                          <Star className="h-3.5 w-3.5" /> Submit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function JudgingPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useAdminChallenges(0, 50);
  const challenges = data?.content ?? [];
  const selected   = challenges.find((c) => c.id === selectedId);

  if (isLoading) return <Loader variant="page" text="Loading Challenges…" />;
  if (selected) return <JudgingView challenge={selected} onBack={() => setSelectedId(null)} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Judging Panel</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Select a challenge to manage judging</p>
      </div>
      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Challenge</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c) => (
              <tr key={c.id} className="attend-table-row">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#7c22c918" }}>
                      <Lightbulb className="h-4 w-4" style={{ color: "#7c22c9" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{c.title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.registerName ?? c.organizerName ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{c.date}</td>
                <td className="px-5 py-4">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: "#7c22c918", color: "#7c22c9" }}>{c.status}</span>
                </td>
                <td className="px-5 py-4">
                  <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSelectedId(c.id)}>
                    Open Judging Panel <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {challenges.length === 0 && <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No challenges available.</div>}
      </Card>
    </div>
  );
}

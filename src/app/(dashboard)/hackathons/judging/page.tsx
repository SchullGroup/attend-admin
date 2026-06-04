"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trophy, Star } from "lucide-react";

const CRITERIA = [
  { label: "Innovation", points: 25, desc: "Originality and novelty of the idea" },
  { label: "Feasibility", points: 25, desc: "Technical and business viability" },
  { label: "Technical Execution", points: 25, desc: "Quality of implementation and demo" },
  { label: "Business Potential", points: 25, desc: "Market opportunity and revenue model" },
];

export default function JudgingPage() {
  const { applications } = useStore();
  const shortlisted = applications.filter((a) => a.status === "shortlisted");

  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(shortlisted.map((a) => [a.id, a.score?.toString() ?? ""]))
  );
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  function handleSubmit(id: string) {
    setSubmitted((prev) => ({ ...prev, [id]: true }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Judging Panel</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">MeriHack 2026 — Score shortlisted teams</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.15)]">
          <Trophy className="h-4 w-4 text-[hsl(var(--primary))]" />
          <span className="text-sm font-semibold text-[hsl(var(--primary))]">{shortlisted.length} Teams to Score</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 grid grid-cols-1 gap-4">
          {shortlisted.length === 0 && (
            <Card className="attend-card p-12 text-center col-span-2">
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
                    disabled={!scores[app.id]}
                    onClick={() => handleSubmit(app.id)}
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

"use client";
import Link from "next/link";
import { Lightbulb, ArrowRight, Trophy, Clock, CheckCircle, FileText } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HackathonsPage() {
  const { events, applications } = useStore();

  const hackathonEvent = events.find((e) => e.module === "HACKATHON");
  const total = applications.length;
  const shortlisted = applications.filter((a) => a.status === "shortlisted").length;
  const underReview = applications.filter((a) => a.status === "under_review").length;
  const submitted = applications.filter((a) => a.status === "submitted").length;
  const selected = applications.filter((a) => a.status === "selected").length;

  const tracks = [...new Set(applications.map((a) => a.track))];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Innovation Challenges</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Manage innovation challenges, review applications, and coordinate judging</p>
      </div>

      {hackathonEvent && (
        <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #9333ea 0%, #7c22c9 60%, #5b21b6 100%)" }}>
          <div className="p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Lightbulb className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-purple-200">Innovation Challenge</span>
                </div>
                <h2 className="text-2xl font-bold mb-1">{hackathonEvent.title}</h2>
                <p className="text-purple-200 text-sm mb-4">{hackathonEvent.organiser} · {hackathonEvent.date} · {hackathonEvent.format === "in-person" ? hackathonEvent.venue : "Virtual"}</p>
                <div className="flex items-center gap-3">
                  <Link href="/hackathons/applications">
                    <Button className="h-9 text-sm bg-white text-purple-700 hover:bg-white/90 gap-2">
                      View Applications
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Link href="/hackathons/judging">
                    <Button variant="outline" className="h-9 text-sm border-white/30 text-white hover:bg-white/10 gap-2">
                      <Trophy className="h-3.5 w-3.5" />
                      Judging Panel
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {[
                  { label: "Total Applications", value: total, icon: FileText },
                  { label: "Shortlisted", value: shortlisted, icon: CheckCircle },
                  { label: "Under Review", value: underReview, icon: Clock },
                  { label: "Submitted", value: submitted, icon: FileText },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-white/10 p-3 min-w-[110px]">
                    <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
                    <div className="text-xs text-purple-200 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="attend-card p-5 col-span-2">
          <div className="attend-section-title mb-4">Application Status Breakdown</div>
          <div className="flex flex-col gap-3">
            {[
              { label: "Submitted", count: submitted, total, color: "#3b82f6" },
              { label: "Under Review", count: underReview, total, color: "#f59e0b" },
              { label: "Shortlisted", count: shortlisted, total, color: "#16a34a" },
              { label: "Selected", count: selected, total, color: "#9333ea" },
            ].map((s) => {
              const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] w-24 shrink-0">{s.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-6 text-right">{s.count}</span>
                  <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="attend-card p-5">
          <div className="attend-section-title mb-4">Challenge Tracks</div>
          <div className="flex flex-col gap-2">
            {tracks.map((track) => {
              const count = applications.filter((a) => a.track === track).length;
              return (
                <div key={track} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
                  <span className="text-sm text-[hsl(var(--foreground))]">{track}</span>
                  <span className="text-sm font-semibold tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

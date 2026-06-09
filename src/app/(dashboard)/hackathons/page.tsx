"use client";
import Link from "next/link";
import {
  Lightbulb, ArrowRight, Trophy, Clock, CheckCircle2,
  FileText, Users, Globe, MapPin,
} from "lucide-react";
import { useEvents } from "@/api/super-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import { MOCK_APPLICATIONS } from "@/lib/mock-data";
import type { EventSummaryResponse } from "@/types/super-admin";

function formatLocation(e: EventSummaryResponse) {
  if (e.format === "VIRTUAL") return "Virtual";
  if (e.format === "HYBRID") return "Hybrid";
  return "In-Person";
}

function FormatIcon({ format }: { format: string }) {
  if (format === "VIRTUAL") return <Globe className="h-3 w-3" />;
  return <MapPin className="h-3 w-3" />;
}

export default function HackathonsPage() {
  const { data: eventsData, isLoading } = useEvents("", 0, 100);

  if (isLoading) return <Loader variant="page" text="Loading Challenges..." />;

  const allEvents: EventSummaryResponse[] = eventsData?.data?.content ?? [];
  const featuredEvent =
    allEvents.find((e) => e.status?.toLowerCase() === "live") ??
    allEvents.find((e) => e.status?.toLowerCase() === "published") ??
    allEvents[0] ?? null;

  const totalRegistrations = allEvents.reduce((s, e) => s + (e.registrationCount ?? 0), 0);
  const liveCount    = allEvents.filter((e) => e.status?.toLowerCase() === "live").length;
  const publishedCount = allEvents.filter((e) => e.status?.toLowerCase() === "published").length;

  // Applications from mock data (no API yet)
  const applications = MOCK_APPLICATIONS;
  const total       = applications.length;
  const submitted   = applications.filter((a) => a.status === "submitted").length;
  const underReview = applications.filter((a) => a.status === "under_review").length;
  const shortlisted = applications.filter((a) => a.status === "shortlisted").length;
  const selected    = applications.filter((a) => a.status === "selected").length;
  const tracks      = [...new Set(applications.map((a) => a.track))];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Innovation Challenges</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Manage innovation challenges, review applications, and coordinate judging
          </p>
        </div>
      </div>

      {/* ── Purple banner ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #9333ea 0%, #7c22c9 60%, #5b21b6 100%)" }}
      >
        <div className="p-6 text-white">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Lightbulb className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-purple-200">Innovation Challenge</span>
              </div>

              {featuredEvent ? (
                <>
                  <h2 className="text-2xl font-bold mb-1 truncate">{featuredEvent.title}</h2>
                  <p className="text-purple-200 text-sm mb-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{featuredEvent.organizerName}</span>
                    <span>·</span>
                    <span>{formatDate(featuredEvent.date)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <FormatIcon format={featuredEvent.format} />
                      {formatLocation(featuredEvent)}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-1">No active challenges yet</h2>
                  <p className="text-purple-200 text-sm mb-4">Create your first innovation challenge to get started.</p>
                </>
              )}

              <div className="flex items-center gap-3">
                <Link href="/hackathons/applications">
                  <Button className="h-9 text-sm bg-white text-purple-700 hover:bg-white/90 gap-2">
                    View Applications <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
                <Link href="/hackathons/judging">
                  <Button variant="outline" className="h-9 text-sm border-white/30 text-white hover:bg-white/10 gap-2">
                    <Trophy className="h-3.5 w-3.5" /> Judging Panel
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stat boxes */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {[
                { label: "Total Applications", value: total,              icon: FileText    },
                { label: "Shortlisted",         value: shortlisted,       icon: CheckCircle2 },
                { label: "Under Review",        value: underReview,       icon: Clock       },
                { label: "Submitted",           value: submitted,         icon: Users       },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white/10 p-3 min-w-[110px]">
                  <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-xs text-purple-200 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom grid: Application Status Breakdown + Challenge Tracks ── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="attend-card p-5 col-span-2">
          <div className="attend-section-title mb-4">Application Status Breakdown</div>
          <div className="flex flex-col gap-3">
            {[
              { label: "Submitted",    count: submitted,   color: "#3b82f6" },
              { label: "Under Review", count: underReview, color: "#f59e0b" },
              { label: "Shortlisted",  count: shortlisted, color: "#16a34a" },
              { label: "Selected",     count: selected,    color: "#9333ea" },
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

"use client";

import { UserCheck, ChevronRight } from "lucide-react";
import { UserAvatar } from "@/components/custom/user-avatar";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { useAdminChallengeJudges } from "@/api/admin-challenges";

/**
 * Super-admin read-only judge panel, embedded directly on the event detail
 * page for Innovation Challenge / Hackathon events.
 * API: GET /api/v1/admin/challenges/{id}/judges
 */
export function EventChallengeJudgesTab({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const { data: panel, isLoading } = useAdminChallengeJudges(challengeId);

  if (isLoading) return <Loader variant="inline" text="Loading judges…" />;

  const judges = panel?.judges ?? [];

  if (judges.length === 0) {
    return (
      <Card className="attend-card p-12 text-center">
        <UserCheck className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">No judges assigned yet</p>
      </Card>
    );
  }

  return (
    <Card className="attend-card overflow-hidden">
      {/* Tracks sit on their own row rather than being squeezed in beside the
          heading. Nine of them could not fit on one line, so each pill broke its
          own label in half and collided with the title. */}
      <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-[#7c22c9] shrink-0" />
          <h2 className="font-semibold text-[hsl(var(--foreground))] mr-auto">
            Judge Panel ({judges.length})
          </h2>
        {/* The panel shows how much scoring has been done but never the scores
            themselves, which left no route from here to the results. */}
        <Button
          variant="outline" size="sm" className="gap-1.5 shrink-0"
          onClick={() => router.push(`/hackathons/${challengeId}?tab=Leaderboard`)}
        >
          View Scoring <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        </div>
        {panel?.tracks && panel.tracks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {panel.tracks.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap max-w-[220px] truncate" title={t} style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <table className="w-full">
        <thead>
          <tr className="attend-table-header">
            <th className="px-5 py-3 text-left">Judge</th>
            <th className="px-5 py-3 text-left">Email</th>
            <th className="px-5 py-3 text-left">Organisation</th>
            <th className="px-5 py-3 text-left">Specialty Track</th>
            <th className="px-5 py-3 text-left">Assigned</th>
            <th className="px-5 py-3 text-left">Scored</th>
            <th className="px-5 py-3 text-left">Progress</th>
          </tr>
        </thead>
        <tbody>
          {judges.map((j) => (
            <tr key={j.id} className="attend-table-row">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    src={j.avatarUrl}
                    initials={j.initials || j.name?.slice(0, 2).toUpperCase() || "?"}
                    color={j.color || "#7c22c9"}
                    variant="solid"
                    size={28}
                  />
                  <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{j.name}</span>
                </div>
              </td>
              <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">{j.email}</td>
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
                  <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-8 text-right">
                    {j.progressPercent ?? 0}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

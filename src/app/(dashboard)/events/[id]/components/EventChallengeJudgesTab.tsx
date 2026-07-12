"use client";

import { UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { useAdminChallengeJudges } from "@/api/admin-challenges";

/**
 * Super-admin read-only judge panel, embedded directly on the event detail
 * page for Innovation Challenge / Hackathon events.
 * API: GET /api/v1/admin/challenges/{id}/judges
 */
export function EventChallengeJudgesTab({ challengeId }: { challengeId: string }) {
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
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-[#7c22c9]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">
          Judge Panel ({judges.length})
        </h2>
        {panel?.tracks && panel.tracks.length > 0 && (
          <div className="ml-auto flex gap-1.5">
            {panel.tracks.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
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
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: j.color || "#7c22c9" }}
                  >
                    {j.initials || j.name?.slice(0, 2).toUpperCase()}
                  </div>
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

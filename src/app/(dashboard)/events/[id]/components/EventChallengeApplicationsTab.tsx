"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { StatusBadge } from "@/components/custom/status-badge";
import { cn, formatDate } from "@/lib/utils";
import { useAdminChallengeApplications } from "@/api/admin-challenges";

const STATUS_TABS = [
  { label: "All",            value: ""               },
  { label: "Submitted",      value: "SUBMITTED"      },
  { label: "Under Review",   value: "UNDER_REVIEW"   },
  { label: "Shortlisted",    value: "SHORTLISTED"    },
  { label: "Selected",       value: "SELECTED"       },
  { label: "Not Progressed", value: "NOT_PROGRESSED" },
];

/**
 * Super-admin read-only view of a challenge's applications, embedded directly
 * on the event detail page (mirrors the client-side Applications tab under
 * /hackathons/{id}, but sourced from GET /api/v1/admin/challenges/{id}/applications
 * — the admin-scoped endpoint — since this page runs under super_admin, who
 * has no client org and can't hit the org-scoped equivalent).
 */
export function EventChallengeApplicationsTab({ challengeId }: { challengeId: string }) {
  const [activeStatus, setActiveStatus] = useState("");
  const { data, isLoading } = useAdminChallengeApplications(challengeId, activeStatus, 0, 100);

  const apps = data?.content ?? [];

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#7c22c9]" />
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Applications {data ? `(${data.totalElements})` : ""}
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveStatus(t.value)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium border transition-colors",
                activeStatus === t.value
                  ? "bg-[#7c22c9] text-white border-[#7c22c9]"
                  : "bg-white text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:border-[#7c22c9]/40"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Loader variant="inline" text="Loading applications…" />
      ) : apps.length === 0 ? (
        <div className="py-14 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <FileText className="h-8 w-8 mx-auto mb-3 opacity-25" />
          <p className="font-medium text-[hsl(var(--foreground))]">No applications yet</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Team</th>
              <th className="px-5 py-3 text-left">Idea</th>
              <th className="px-5 py-3 text-left">Track</th>
              <th className="px-5 py-3 text-left">Members</th>
              <th className="px-5 py-3 text-left">Score</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="attend-table-row">
                <td className="px-5 py-3 text-sm font-medium text-[hsl(var(--foreground))]">{a.teamName}</td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[200px] truncate" title={a.ideaTitle}>{a.ideaTitle}</td>
                <td className="px-5 py-3">
                  {a.track ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>{a.track}</span>
                  ) : "—"}
                </td>
                <td className="px-5 py-3 text-sm tabular-nums">{a.memberCount ?? "—"}</td>
                <td className="px-5 py-3 text-sm font-semibold tabular-nums">{a.score ?? "—"}</td>
                <td className="px-5 py-3"><StatusBadge status={(a.status ?? "").toLowerCase()} /></td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(a.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

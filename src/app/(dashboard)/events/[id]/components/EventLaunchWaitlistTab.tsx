"use client";

import { useState } from "react";
import { Users, CheckCircle, Clock, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { useListWaitlist, useApproveWaitlist, useRemoveWaitlist } from "@/api/client-events";

function timeAgo(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_STYLES: Record<string, { pill: string; icon: React.ReactNode }> = {
  WAITING:  { pill: "bg-amber-50 text-amber-700",  icon: <Clock        className="h-3 w-3" /> },
  APPROVED: { pill: "bg-green-50 text-green-700",  icon: <CheckCircle  className="h-3 w-3" /> },
  REMOVED:  { pill: "bg-red-50   text-red-600",    icon: <X            className="h-3 w-3" /> },
};

export function EventLaunchWaitlistTab({ eventId }: { eventId: string }) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useListWaitlist(eventId, page, 20);
  const approve = useApproveWaitlist();
  const remove  = useRemoveWaitlist();

  const entries    = data?.entries    ?? [];
  const totalPages = data?.totalPages ?? 1;

  if (isLoading) return <Loader variant="inline" text="Loading waitlist…" />;

  return (
    <Card className="attend-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Waitlist</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {data?.totalWaiting ?? 0} waiting · {data?.totalApproved ?? 0} approved
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 rounded-xl border border-dashed border-[hsl(var(--border))]">
          <Users className="h-9 w-9 text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No waitlist entries yet.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.5)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] hidden sm:table-cell">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))] hidden md:table-cell">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[hsl(var(--muted-foreground))]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {entries.map((entry) => {
                  const s = STATUS_STYLES[entry.status] ?? { pill: "bg-gray-50 text-gray-600", icon: null };
                  return (
                    <tr key={entry.id} className="bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.3)] transition-colors">
                      <td className="px-4 py-3 text-xs font-medium text-[hsl(var(--muted-foreground))]">{entry.position}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {entry.firstName} {entry.lastName}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">{entry.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.pill}`}>
                          {s.icon}
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{timeAgo(entry.joinedAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {entry.status === "WAITING" && (
                            <button
                              onClick={() => approve.mutate({ eventId, waitlistId: entry.id })}
                              disabled={approve.isPending}
                              className="h-7 px-2.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => remove.mutate({ eventId, waitlistId: entry.id })}
                            disabled={remove.isPending}
                            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-[hsl(var(--muted-foreground))] hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Page {page + 1} of {totalPages} · {data?.totalElements ?? 0} entries
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

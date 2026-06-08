"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Vote, Play, Square, Download, CheckCircle2, XCircle, MinusCircle, ArrowLeft, Search } from "lucide-react";
import { MOCK_AGM_VOTE_RECORDS } from "@/lib/mock-data";
import { OrgFilter } from "@/components/custom/org-filter";

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  live:      { label: "Live",      color: "#16a34a", bg: "#dcfce7" },
  ended:     { label: "Ended",     color: "#6b7280", bg: "#f3f4f6" },
  published: { label: "Published", color: "#111827", bg: "#dbeafe" },
  draft:     { label: "Draft",     color: "#9ca3af", bg: "#f9fafb" },
  cancelled: { label: "Cancelled", color: "#dc2626", bg: "#fee2e2" },
};

function VoteBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-24 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

export default function VoteResultsPage() {
  const { openVoting, closeVoting, selectedLiveSessionId } = useStore();
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [voteStates, setVoteStates] = useState<Record<string, "idle" | "open" | "closed">>({});

  const organisers = [...new Set(MOCK_AGM_VOTE_RECORDS.map((r) => r.organiser))].sort();

  const filtered = MOCK_AGM_VOTE_RECORDS.filter((r) => {
    if (search.trim() && !r.eventTitle.toLowerCase().includes(search.toLowerCase()) && !r.organiser.toLowerCase().includes(search.toLowerCase())) return false;
    if (orgFilter && r.organiser !== orgFilter) return false;
    return true;
  });

  const selected = selectedEventId ? MOCK_AGM_VOTE_RECORDS.find((r) => r.eventId === selectedEventId) : null;

  function getResolutionState(resId: string, defaultStatus: string) {
    if (voteStates[resId]) return voteStates[resId];
    return defaultStatus === "open" ? "open" : defaultStatus === "closed" ? "closed" : "idle";
  }

  function handleOpen(resId: string) {
    openVoting(selectedLiveSessionId, resId);
    setVoteStates((s) => ({ ...s, [resId]: "open" }));
    toast.success("Voting opened for this resolution");
  }

  function handleClose(resId: string) {
    closeVoting(selectedLiveSessionId, resId);
    setVoteStates((s) => ({ ...s, [resId]: "closed" }));
    toast.success("Voting closed — results are final");
  }

  if (selected) {
    const openCount = selected.resolutions.filter((r) => getResolutionState(r.id, r.status) === "open").length;
    const closedCount = selected.resolutions.filter((r) => getResolutionState(r.id, r.status) === "closed").length;
    const totalVotes = selected.resolutions.reduce((s, r) => s + r.for + r.against + r.abstain, 0);
    const st = STATUS_STYLE[selected.status] ?? STATUS_STYLE.draft;

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setSelectedEventId(null)}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> All AGMs
          </button>
          <span className="text-[hsl(var(--muted-foreground))]">/</span>
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">{selected.organiser}</span>
        </div>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{selected.eventTitle}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {new Date(selected.date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} ·
              {" "}{selected.resolutions.length} resolutions
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ color: st.color, backgroundColor: st.bg }}
            >
              {st.label}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => toast.success("Vote audit log exported")}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden mb-6">
          {[
            { label: "Resolutions", value: selected.resolutions.length, icon: Vote, color: "#374151" },
            { label: "Voting Open", value: openCount, icon: Play, color: "#111827" },
            { label: "Closed", value: closedCount, icon: Square, color: "#6b7280" },
            { label: "Total Votes Cast", value: totalVotes.toLocaleString(), icon: CheckCircle2, color: "#16a34a" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="flex items-center gap-3 px-5 py-4">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
                <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {selected.resolutions.map((v, i) => {
            const total = v.for + v.against + v.abstain;
            const state = getResolutionState(v.id, v.status);
            const isLive = selected.status === "live";

            return (
              <Card key={v.id} className="attend-card p-5">
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div className="flex-1">
                    <div className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-1">RESOLUTION {i + 1}</div>
                    <div className="text-base font-semibold text-[hsl(var(--foreground))]">{v.title}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        color: state === "open" ? "#111827" : state === "closed" ? "#6b7280" : "#9ca3af",
                        backgroundColor: state === "open" ? "#dbeafe" : state === "closed" ? "#f3f4f6" : "#f9fafb",
                      }}
                    >
                      {state === "open" ? "Open" : state === "closed" ? "Closed" : "Pending"}
                    </span>
                    {isLive && state === "idle" && (
                      <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleOpen(v.id)}>
                        <Play className="h-3.5 w-3.5" /> Open Voting
                      </Button>
                    )}
                    {isLive && state === "open" && (
                      <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleClose(v.id)}>
                        <Square className="h-3.5 w-3.5" /> Close Voting
                      </Button>
                    )}
                  </div>
                </div>

                {state === "open" && (
                  <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    <span className="text-xs text-blue-700 font-medium">Voting is live — shareholders can cast votes now</span>
                  </div>
                )}

                {total > 0 ? (
                  <div className="flex flex-col gap-2.5 bg-[hsl(var(--muted)/0.4)] rounded-xl p-4">
                    <div className="flex items-center gap-4 mb-3">
                      {[
                        { icon: CheckCircle2, label: "For", value: v.for, color: "#16a34a" },
                        { icon: XCircle, label: "Against", value: v.against, color: "#dc2626" },
                        { icon: MinusCircle, label: "Abstain", value: v.abstain, color: "#9ca3af" },
                      ].map(({ icon: Icon, label, value: val, color }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <Icon className="h-4 w-4" style={{ color }} />
                          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{val.toLocaleString()}</span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
                        </div>
                      ))}
                      <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{total.toLocaleString()} total</span>
                    </div>
                    <VoteBar label="For" value={v.for} total={total} color="#16a34a" />
                    <VoteBar label="Against" value={v.against} total={total} color="#dc2626" />
                    <VoteBar label="Abstain" value={v.abstain} total={total} color="#9ca3af" />
                  </div>
                ) : (
                  <div className="text-sm text-[hsl(var(--muted-foreground))] italic bg-[hsl(var(--muted)/0.4)] rounded-xl p-4">
                    No votes cast yet.
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Overview table ────────────────────────────────────────────────────────────
  const liveCount = MOCK_AGM_VOTE_RECORDS.filter((r) => r.status === "live").length;
  const endedCount = MOCK_AGM_VOTE_RECORDS.filter((r) => r.status === "ended").length;
  const pendingCount = MOCK_AGM_VOTE_RECORDS.filter((r) => r.status === "published" || r.status === "draft").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Voting & Resolutions</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          AGM vote records across all stakeholder organisations
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden mb-6">
        {[
          { label: "Live AGMs", value: liveCount, color: "#16a34a" },
          { label: "With Vote Records", value: endedCount, color: "#111827" },
          { label: "Upcoming / Draft", value: pendingCount, color: "#6b7280" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-4">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
              <Vote className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Organiser filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Search by event or stakeholder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <OrgFilter organisers={organisers} value={orgFilter} onChange={setOrgFilter} />
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Event</th>
              <th className="px-5 py-3 text-left">Stakeholder</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Resolutions</th>
              <th className="px-5 py-3 text-left">Votes Cast</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((record) => {
              const st = STATUS_STYLE[record.status] ?? STATUS_STYLE.draft;
              const totalVotes = record.resolutions.reduce((s, r) => s + r.for + r.against + r.abstain, 0);
              const closedCount = record.resolutions.filter((r) => r.status === "closed").length;
              return (
                <tr key={record.eventId} className="attend-table-row">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] max-w-xs truncate">{record.eventTitle}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{record.organiser}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {new Date(record.date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-[hsl(var(--foreground))] tabular-nums">
                      {record.resolutions.length}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1.5">
                      ({closedCount} closed)
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums text-[hsl(var(--foreground))]">
                    {totalVotes > 0 ? totalVotes.toLocaleString() : <span className="text-[hsl(var(--muted-foreground))] font-normal italic">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ color: st.color, backgroundColor: st.bg }}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setSelectedEventId(record.eventId)}
                    >
                      {record.status === "live" ? "Manage Votes" : "View Results"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Vote className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No AGM records match your search.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

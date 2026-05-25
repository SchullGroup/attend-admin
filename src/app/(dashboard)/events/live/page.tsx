"use client";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { Check, X, Users, Vote, MessageSquare, UserCheck, Clock, Wifi, Radio, Building2 } from "lucide-react";
import type { LiveSession } from "@/lib/mock-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function VoteBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-sm font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-sm text-[hsl(var(--muted-foreground))] tabular-nums w-20 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

// ── Session tab pill ──────────────────────────────────────────────────────────

function SessionTab({ session, active, onClick }: { session: LiveSession; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border whitespace-nowrap ${
        active
          ? "text-white shadow-sm border-transparent"
          : "bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:border-[hsl(var(--foreground)/0.2)] hover:text-[hsl(var(--foreground))]"
      }`}
      style={active ? { backgroundColor: session.color, borderColor: session.color } : {}}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: active ? "#ffffff" : "#dc2626" }} />
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: active ? "#ffffff" : "#dc2626" }} />
      </span>
      <span className="max-w-[180px] truncate">{session.organiser}</span>
      <span className={`text-xs px-1.5 py-0.5 rounded-md font-semibold ${active ? "bg-white/20 text-white" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>
        {session.attendees.toLocaleString()}
      </span>
    </button>
  );
}

// ── Resolution panel ──────────────────────────────────────────────────────────

function ResolutionsPanel({ session, onOpen, onClose }: { session: LiveSession; onOpen: (resId: string) => void; onClose: (resId: string) => void }) {
  if (session.votes.length === 0) {
    return (
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Session Segments</h2>
        </div>
        <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${session.color}18` }}>
            <Wifi className="h-5 w-5" style={{ color: session.color }} />
          </div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">Presentation-mode session</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-xs">
            This event does not have formal voting resolutions. Monitor attendance and manage Q&amp;A from the panel on the right.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Resolutions</h2>
        <span className="text-xs text-[hsl(var(--muted-foreground))]">
          {session.votes.filter((v) => v.status === "closed").length} / {session.votes.length} closed
        </span>
      </div>
      <div className="divide-y divide-[hsl(var(--border))]">
        {session.votes.map((v, i) => {
          const total = v.for + v.against + v.abstain;
          return (
            <div key={v.resolutionId} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">RES. {i + 1}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{v.title}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {v.status === "pending" && (
                    <Button size="sm" className="h-7 text-xs" onClick={() => onOpen(v.resolutionId)}>
                      Open Voting
                    </Button>
                  )}
                  {v.status === "open" && (
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => onClose(v.resolutionId)}>
                      Close Voting
                    </Button>
                  )}
                </div>
              </div>
              {(v.status === "open" || v.status === "closed") && total > 0 && (
                <div className="flex flex-col gap-2 mt-3 bg-[hsl(var(--muted)/0.4)] rounded-xl p-3">
                  <VoteBar label="For" value={v.for} total={total} color="#16a34a" />
                  <VoteBar label="Against" value={v.against} total={total} color="#dc2626" />
                  <VoteBar label="Abstain" value={v.abstain} total={total} color="#9ca3af" />
                  <div className="pt-1 mt-1 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                    Total votes cast: <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span>
                  </div>
                </div>
              )}
              {v.status === "pending" && (
                <div className="text-xs text-[hsl(var(--muted-foreground))] mt-2 italic">Voting not yet opened for this resolution.</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LiveControlPage() {
  const { liveSessions, selectedLiveSessionId, setSelectedLiveSession, openVoting, closeVoting, approveQA, rejectQA } = useStore();

  const session = liveSessions.find((s) => s.id === selectedLiveSessionId) ?? liveSessions[0];
  const totalAttendees = liveSessions.reduce((sum, s) => sum + s.attendees, 0);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Radio className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No live sessions at the moment.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Live Control Room</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {liveSessions.length} LIVE
            </span>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {totalAttendees.toLocaleString()} total attendees connected across all sessions
          </p>
        </div>
      </div>

      {/* ── Session tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {liveSessions.map((sess) => (
          <SessionTab
            key={sess.id}
            session={sess}
            active={sess.id === session.id}
            onClick={() => setSelectedLiveSession(sess.id)}
          />
        ))}
      </div>

      {/* ── Selected session header card ── */}
      <div
        className="rounded-2xl p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${session.color}ee, ${session.color}bb)` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 opacity-70" />
              <span className="text-sm font-medium opacity-80">{session.organiser}</span>
              <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide">
                {session.module}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-snug">{session.eventTitle}</h2>
            {session.venue && (
              <p className="text-sm opacity-70 mt-1">{session.venue} · {session.format}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2 shrink-0">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-sm font-bold">LIVE</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { icon: Users, label: "Attendees", value: session.attendees.toLocaleString(), sub: session.capacity ? `of ${session.capacity.toLocaleString()} cap` : "connected" },
            { icon: UserCheck, label: "Quorum", value: session.quorumPct != null ? `${session.quorumPct}%` : "N/A", sub: session.quorumPct != null ? "of required" : "non-voting event" },
            { icon: Vote, label: "Resolutions", value: session.votes.length > 0 ? `${session.votes.filter((v) => v.status === "closed").length} / ${session.votes.length}` : "—", sub: session.votes.length > 0 ? "closed" : "no votes" },
            { icon: Clock, label: "Elapsed", value: formatElapsed(session.elapsedMinutes), sub: "session time" },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-white/15 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-3.5 w-3.5 opacity-70" />
                <span className="text-xs font-medium opacity-70">{label}</span>
              </div>
              <div className="text-xl font-bold tabular-nums">{value}</div>
              <div className="text-xs opacity-60 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content grid ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Left: Resolutions */}
        <div className="col-span-2">
          <ResolutionsPanel
            session={session}
            onOpen={(resId) => openVoting(session.id, resId)}
            onClose={(resId) => closeVoting(session.id, resId)}
          />
        </div>

        {/* Right: Q&A + attendance */}
        <div className="col-span-1 flex flex-col gap-5">

          {/* Q&A Queue */}
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Q&A Queue</h2>
              <span className="ml-auto text-xs bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] rounded-full px-2 py-0.5 font-semibold">
                {session.qaQueue.filter((q) => q.approved === null).length} pending
              </span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {session.qaQueue.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[hsl(var(--muted-foreground))] text-center italic">No questions yet.</p>
              ) : session.qaQueue.map((q) => (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{q.name}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{q.time}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">{q.question}</p>
                  {q.approved === null ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs flex-1 gap-1" onClick={() => approveQA(session.id, q.id)}>
                        <Check className="h-3 w-3" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => rejectQA(session.id, q.id)}
                      >
                        <X className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${q.approved ? "text-green-600" : "text-red-500"}`}>
                      {q.approved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {q.approved ? "Approved" : "Rejected"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Attendance log */}
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Attendance Log</h2>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {session.recentJoins.map((join, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: session.color }}
                    >
                      {initials(join.name)}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[hsl(var(--foreground))]">{join.name}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{join.method}</div>
                    </div>
                  </div>
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">{join.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

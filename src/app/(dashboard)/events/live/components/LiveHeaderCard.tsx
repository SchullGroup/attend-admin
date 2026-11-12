import { Building2, Users, UserCheck, Vote, Clock } from "lucide-react";
import type { LiveRoomDetail } from "@/api/client-live";
import { formatQuorumPct, formatThreshold } from "@/lib/quorum";
import { formatElapsed } from "./helpers";
import { toEventModule } from "@/lib/event-module";

export function LiveHeaderCard({ room, color, organiserName }: { room: LiveRoomDetail; color: string; organiserName?: string }) {
  const isVirtual = room.format?.toUpperCase() === "VIRTUAL";
  const isAGM = toEventModule(room.eventType) === "AGM";

  const stats = [
    {
      icon:  Users,
      label: "Attendees",
      value: room.attendeeCount.toLocaleString(),
      sub:   room.capacity ? `of ${room.capacity.toLocaleString()} cap` : "connected",
    },
    ...(!isVirtual ? [{
      icon:  UserCheck,
      label: "Checked In",
      value: room.checkedInCount.toLocaleString(),
      sub:   room.attendeeCount > 0
        ? `${Math.round((room.checkedInCount / room.attendeeCount) * 100)}% of attendees`
        : "check-ins",
    }] : []),
    ...(isAGM ? [{
      icon:  Vote,
      label: "Resolutions",
      value: room.resolutions.length > 0
        ? `${room.resolutions.filter((r) => r.status === "CLOSED").length} / ${room.resolutions.length}`
        : "—",
      sub:   room.resolutions.length > 0 ? "closed" : "no votes",
    }] : []),
    {
      icon:  Clock,
      label: "Elapsed",
      value: formatElapsed(room.elapsedMinutes),
      sub:   "session time",
    },
  ];

  return (
    <div
      className="rounded-2xl p-5 text-white"
      style={{ background: `linear-gradient(135deg, ${color}ee, ${color}bb)` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 opacity-70" />
            <span className="text-sm font-medium opacity-80">{organiserName ?? room.organiserName}</span>
            <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide">
              {room.eventType}
            </span>
          </div>
          <h2 className="text-lg font-bold leading-snug">{room.title}</h2>
          <p className="text-sm opacity-70 mt-1">
            {[room.venue, room.format].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/15 rounded-xl px-3 py-2 shrink-0">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          <span className="text-sm font-bold">LIVE</span>
        </div>
      </div>

      {/* Stats */}
      <div className={`grid gap-3 mt-4 ${stats.length === 4 ? "grid-cols-4" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {stats.map(({ icon: Icon, label, value, sub }) => (
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

      {/* Quorum (AGM only) */}
      {room.quorumPct != null && <QuorumPanel room={room} />}
    </div>
  );
}

/**
 * One quorum panel: the deciding figure big, one bar with a marker at the
 * required %, and checked-in shown as the solid part of that same bar
 * (checked-in shares are always a subset of the quorum shares).
 */
function QuorumPanel({ room }: { room: LiveRoomDetail }) {
  const pct      = room.quorumPct ?? 0;
  const required = room.requiredQuorumPct;
  const checked  = room.checkedInQuorumPct;
  const met      = room.quorumMet ?? (required != null && pct >= required);
  const accent   = met ? "#4ade80" : "#fbbf24";
  const fmt      = (v?: number | null) => (v == null ? "—" : v.toLocaleString("en-NG"));

  const parts = [
    { label: "Registered", value: room.registeredHoldingsShares },
    { label: "Walk-in",    value: room.walkInShares },
    ...(room.proxyShares ? [{ label: "Proxy", value: room.proxyShares }] : []),
  ].filter((x) => x.value != null);

  return (
    <div className="mt-4 bg-white/10 rounded-xl px-4 py-3.5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Quorum</div>
          <div className="flex items-center gap-2.5 mt-0.5">
            <span className="text-3xl font-bold tabular-nums leading-none">{formatQuorumPct(pct)}</span>
            <span
              className="text-xs font-semibold rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: accent + "26", color: accent }}
            >
              {met ? "Met" : "Not met"}
            </span>
          </div>
          <div className="text-xs opacity-60 mt-1">
            of share capital{required != null && <> · {formatThreshold(required)} required</>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {parts.map((x) => (
            <div key={x.label} className="rounded-lg bg-white/10 px-3 py-1.5">
              <div className="text-[10px] uppercase tracking-wider opacity-60">{x.label}</div>
              <div className="text-sm font-semibold tabular-nums">{fmt(x.value)}</div>
            </div>
          ))}
          {checked != null && (
            <div className="rounded-lg bg-white/10 px-3 py-1.5" title="Shareholders actually present plus proxies marked attended. Information only.">
              <div className="text-[10px] uppercase tracking-wider opacity-60">Checked in</div>
              <div className="text-sm font-semibold tabular-nums">{formatQuorumPct(checked)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bar: faint = counted for quorum, solid = checked in, tick = required */}
      <div className="relative mt-4">
        <div className="h-2.5 rounded-full bg-white/15 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: accent, opacity: 0.45 }} />
          {checked != null && (
            <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${Math.min(checked, 100)}%`, backgroundColor: accent }} />
          )}
        </div>
        {required != null && (
          <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-white/80" style={{ left: `calc(${Math.min(required, 100)}% - 1px)` }} title={`${formatThreshold(required)} required`} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] opacity-60">
        <div className="flex items-center gap-3">
          {checked != null && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} /> Checked in
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent, opacity: 0.45 }} /> Registered + walk-in{room.proxyShares ? " + proxy" : ""}
          </span>
          {required != null && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-0.5 rounded bg-white/80" /> Required
            </span>
          )}
        </div>
        {room.quorumShares != null && room.registerShares != null && (
          <span className="tabular-nums">{fmt(room.quorumShares)} of {fmt(room.registerShares)} shares</span>
        )}
      </div>
    </div>
  );
}

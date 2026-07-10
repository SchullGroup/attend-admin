import { Building2, Users, UserCheck, Vote, Clock } from "lucide-react";
import type { LiveRoomDetail } from "@/api/client-live";
import { formatElapsed } from "./helpers";

export function LiveHeaderCard({ room, color }: { room: LiveRoomDetail; color: string }) {
  return (
    <div
      className="rounded-2xl p-5 text-white"
      style={{ background: `linear-gradient(135deg, ${color}ee, ${color}bb)` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 opacity-70" />
            <span className="text-sm font-medium opacity-80">{room.organiserName}</span>
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
      <div className="grid grid-cols-4 gap-3 mt-4">
        {[
          {
            icon:  Users,
            label: "Attendees",
            value: room.attendeeCount.toLocaleString(),
            sub:   room.capacity ? `of ${room.capacity.toLocaleString()} cap` : "connected",
          },
          {
            icon:  UserCheck,
            label: "Checked In",
            value: room.checkedInCount.toLocaleString(),
            sub:   room.attendeeCount > 0
              ? `${Math.round((room.checkedInCount / room.attendeeCount) * 100)}% of attendees`
              : "check-ins",
          },
          {
            icon:  Vote,
            label: "Resolutions",
            value: room.resolutions.length > 0
              ? `${room.resolutions.filter((r) => r.status === "CLOSED").length} / ${room.resolutions.length}`
              : "—",
            sub:   room.resolutions.length > 0 ? "closed" : "no votes",
          },
          {
            icon:  Clock,
            label: "Elapsed",
            value: formatElapsed(room.elapsedMinutes),
            sub:   "session time",
          },
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

      {/* Quorum bar (AGM only) */}
      {room.quorumPct != null && (
        <div className="mt-4 bg-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2 text-xs font-medium opacity-80">
            <span>Quorum Progress</span>
            <span className="tabular-nums">
              {room.quorumPct}%
              {room.requiredQuorumPct != null && ` / ${room.requiredQuorumPct}% required`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(room.quorumPct, 100)}%`,
                backgroundColor:
                  room.requiredQuorumPct != null && room.quorumPct >= room.requiredQuorumPct
                    ? "#4ade80"
                    : "#fbbf24",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

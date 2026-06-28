"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, CalendarX, Eye, Monitor,
  MapPin, Users2, Radio, Hash, Mail, Phone, User,
  CalendarCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { ModuleBadge } from "@/components/custom/module-badge";
import { DateCell } from "@/components/ui/date-cell";
import { Loader } from "@/components/ui/Loader";
import { useRegisterDetail, useRegisterDocuments } from "@/api/registers";
import { useClientEvents, type EventListItem } from "@/api/client-events";
import { RegisterShareholdersSection } from "./components/RegisterShareholdersSection";
import { RegisterDocumentsSection }    from "./components/RegisterDocumentsSection";
import { useGetMe } from "@/api/auth/hooks";
import { getEventModule, MODULE_COLORS } from "@/lib/event-module";
import { formatDate } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_ICON: Record<string, React.ElementType> = {
  VIRTUAL:   Monitor,
  HYBRID:    Users2,
  IN_PERSON: MapPin,
};

function formatLabel(fmt: string) {
  if (!fmt) return "—";
  return fmt === "IN_PERSON" ? "In-Person" : fmt.charAt(0) + fmt.slice(1).toLowerCase();
}

/**
 * Normalise fillRate to a clean 0-100 percentage.
 * The API returns fractional values (0–1) for some endpoints and whole
 * percentages (0–100) for others. Values ≤ 1 are treated as fractional.
 */
function normaliseFill(fillRate: number | null | undefined): number | null {
  if (fillRate == null) return null;
  if (fillRate > 0 && fillRate <= 1) return Math.round(fillRate * 100);
  return Math.min(Math.round(fillRate), 100);
}

function normaliseRole(raw?: string | null): string {
  return (raw ?? "").toLowerCase().replace(/[-\s]+/g, "_");
}

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  ACTIVE:    { dot: "#16a34a", label: "Active"    },
  SUSPENDED: { dot: "#dc2626", label: "Suspended" },
  PENDING:   { dot: "#f59e0b", label: "Pending"   },
  REJECTED:  { dot: "#6b7280", label: "Rejected"  },
};

// ─── Loading skeleton row ─────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="attend-table-row">
      <td className="pl-4 pr-1 py-3">
        <div className="h-3 w-3 rounded-full bg-[hsl(var(--muted))] animate-pulse mx-auto" />
      </td>
      <td className="px-5 py-3">
        <div className="space-y-1.5">
          <div className="h-4 w-40 rounded bg-[hsl(var(--muted))] animate-pulse" />
          <div className="h-3 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
        </div>
      </td>
      <td className="px-5 py-3"><div className="h-3.5 w-20 rounded bg-[hsl(var(--muted))] animate-pulse" /></td>
      <td className="px-5 py-3"><div className="h-3.5 w-16 rounded bg-[hsl(var(--muted))] animate-pulse" /></td>
      <td className="px-5 py-3"><div className="h-3.5 w-14 rounded bg-[hsl(var(--muted))] animate-pulse" /></td>
      <td className="px-5 py-3"><div className="h-5 w-16 rounded-full bg-[hsl(var(--muted))] animate-pulse" /></td>
      <td className="px-5 py-3"><div className="h-7 w-14 rounded-lg bg-[hsl(var(--muted))] animate-pulse" /></td>
    </tr>
  );
}

// ─── Event table row ──────────────────────────────────────────────────────────

function EventRow({
  event,
  canLiveControl,
}: {
  event: EventListItem;
  canLiveControl: boolean;
}) {
  const isLive      = event.status?.toUpperCase() === "LIVE";
  const mod         = getEventModule({ eventType: event.eventType });
  const dotColor    = MODULE_COLORS[mod];
  const FormatIcon  = FORMAT_ICON[event.format] ?? Monitor;
  const fillPct     = normaliseFill(event.fillRate);
  const registerName = event.registerName ?? "";

  return (
    <tr className="attend-table-row">

      {/* Module colour dot */}
      <td className="pl-4 pr-1 py-3 w-8">
        <span
          className="block h-3 w-3 rounded-full shrink-0 mx-auto"
          style={{ backgroundColor: dotColor }}
        />
      </td>

      {/* Event: title + register/organizer name (strict layout boundaries) */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-2 mb-0.5">
          <ModuleBadge module={mod} />
          {isLive && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-1.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE
            </span>
          )}
        </div>
        <p
          className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[240px] truncate"
          title={event.title}
        >
          {event.title}
        </p>
        {/* Register/organizer — max-w-[160px] hard boundary per spec */}
        <p
          className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 max-w-[160px] truncate"
          title={registerName || "—"}
        >
          {registerName || "—"}
        </p>
      </td>

      {/* Date */}
      <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
        {formatDate(event.date)}
      </td>

      {/* Format */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
          <FormatIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{formatLabel(event.format)}</span>
        </div>
      </td>

      {/* RSVP + fill % */}
      <td className="px-5 py-3 text-sm tabular-nums">
        <span className="font-medium">{(event.rsvpCount ?? 0).toLocaleString()}</span>
        {fillPct !== null && (
          <div className="text-xs text-[hsl(var(--muted-foreground))]">{fillPct}% filled</div>
        )}
      </td>

      {/* Status */}
      <td className="px-5 py-3">
        <StatusBadge status={event.status?.toLowerCase()} />
      </td>

      {/* Actions */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-1.5">
          <Link href={`/events/${event.id}`}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              <Eye className="h-3 w-3" /> View
            </Button>
          </Link>
          {/* Crimson Live button — only shown when event is LIVE and role permits */}
          {isLive && canLiveControl && (
            <Link href="/events/live">
              <Button size="sm" className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white">
                <Radio className="h-3 w-3" /> Live
              </Button>
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterDetailPage() {
  const params = useParams();
  const id     = params.id as string;
  const router = useRouter();

  // Role-based permission: viewer cannot access the live control room
  const { data: userResponse } = useGetMe();
  const role         = normaliseRole(userResponse?.data?.role);
  const canLiveControl = role !== "viewer";
  const canCreate      = role !== "viewer";

  const {
    data:      register,
    isLoading: registerLoading,
    isError:   registerError,
  } = useRegisterDetail(id);

  const {
    data:      eventsData,
    isLoading: eventsLoading,
  } = useClientEvents("ALL", 0, 200);

  const { data: docsData = [] } = useRegisterDocuments(id);

  // Client-side filter — only events belonging to this register
  const events: EventListItem[] = (eventsData?.events ?? []).filter(
    (e) => e.registerId === id
  );

  // ── Full-page load / error ───────────────────────────────────────────────
  if (registerLoading) return <Loader variant="page" text="Loading register…" />;

  if (registerError || !register) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 className="h-10 w-10 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Register not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          This register may have been removed or you may not have access.
        </p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/registers")}>
          <ArrowLeft className="h-4 w-4" /> Back to Registers
        </Button>
      </div>
    );
  }

  // ── Derived display values ───────────────────────────────────────────────
  const displayName = (register as any).companyName || register.name || "—";
  const initials    = displayName
    .split(" ").filter(Boolean)
    .map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  const statusKey  = register.status?.toUpperCase() ?? "PENDING";
  const statusInfo = STATUS_DOT[statusKey] ?? STATUS_DOT["PENDING"];

  const industry   = register.industry   ?? (register as any).industry    ?? null;
  const rcNumber   = register.rcNumber   ?? (register as any).rcNumber    ?? null;
  const email      = register.email      ?? (register as any).contactEmail ?? null;
  const repName    = register.representativeName  ?? null;
  const repPhone   = register.representativePhone ?? null;
  const enrolledAt = register.enrolledAt ?? (register as any).approvedAt  ?? null;

  const eventCount  = register.eventCount ?? events.length;
  const totalRsvps  = events.reduce((sum, e) => sum + (e.rsvpCount ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Back nav ── */}
      <button
        onClick={() => router.push("/registers")}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Registers
      </button>

      {/* ── Register profile card ── */}
      <Card className="attend-card p-6">
        <div className="flex items-start gap-5">

          {/* Avatar */}
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
            style={{ backgroundColor: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
          >
            {initials}
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[hsl(var(--foreground))] truncate">{displayName}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              {industry && <span className="truncate max-w-[160px]">{industry}</span>}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
                <span>{statusInfo.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mt-5 pt-4 border-t border-[hsl(var(--border))] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {([
            { icon: Hash,          label: "RC Number",     value: rcNumber },
            { icon: Mail,          label: "Email",          value: email    },
            { icon: User,          label: "Representative", value: repName  },
            { icon: Phone,         label: "Rep. Phone",     value: repPhone },
          ] as { icon: React.ElementType; label: string; value: string | null }[]).map(
            ({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-md bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{label}</p>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5 truncate">
                    {value ?? <i className="text-[hsl(var(--muted-foreground))]">—</i>}
                  </p>
                </div>
              </div>
            )
          )}

          <div className="flex items-start gap-2">
            <div className="h-6 w-6 rounded-md bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
              <CalendarCheck className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Enrolled</p>
              <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">
                {enrolledAt
                  ? <DateCell value={enrolledAt} />
                  : <i className="text-[hsl(var(--muted-foreground))]">—</i>
                }
              </p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex items-center gap-6">
          <div>
            <span className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{eventCount}</span>
            <span className="text-sm text-[hsl(var(--muted-foreground))] ml-1.5">Events</span>
          </div>
          <div>
            <span className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{totalRsvps.toLocaleString()}</span>
            <span className="text-sm text-[hsl(var(--muted-foreground))] ml-1.5">Total RSVPs</span>
          </div>
          <div>
            <span className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">{docsData.length}</span>
            <span className="text-sm text-[hsl(var(--muted-foreground))] ml-1.5">Documents</span>
          </div>
        </div>
      </Card>

      {/* ── Events table ── */}
      <div id="events-registry">
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Events Registry</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              {eventsLoading
                ? "Loading events…"
                : `${events.length} event${events.length !== 1 ? "s" : ""} under this register`
              }
            </p>
          </div>
          {canCreate && (
            <Link href="/events/create">
              <Button size="sm" className="gap-1.5">Create Event</Button>
            </Link>
          )}
        </div>

        {eventsLoading ? (
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="pl-4 pr-1 py-3 w-8" />
                <th className="px-5 py-3 text-left">Event</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Format</th>
                <th className="px-5 py-3 text-left">RSVP</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>{[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        ) : events.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarX className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-25" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No events found</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              No events are currently linked to this register.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="pl-4 pr-1 py-3 w-8" />
                <th className="px-5 py-3 text-left">Event</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">Format</th>
                <th className="px-5 py-3 text-left">RSVP</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  canLiveControl={canLiveControl}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>
      </div>

      {/* ── Shareholders ── */}
      <RegisterShareholdersSection registerId={id} />

      {/* ── Documents ── */}
      <RegisterDocumentsSection registerId={id} />

    </div>
  );
}

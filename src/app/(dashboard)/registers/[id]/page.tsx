"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useRegisterDetail,
  useSuspendRegister,
  useActivateRegister,
  useStakeholderEvents,
  useRegisterDocuments,
} from "@/api/registers";
import { StatusBadge } from "@/components/custom/status-badge";
import { ModuleBadge } from "@/components/custom/module-badge";
import { DateCell } from "@/components/ui/date-cell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { getEventModule, MODULE_COLORS } from "@/lib/event-module";
import {
  ArrowLeft, Building2, Mail, Hash, Phone,
  User, CalendarX, FileText, Inbox,
  Download, AlertTriangle, CalendarCheck, Calendar, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { RegisterDocumentItem } from "@/types/super-admin";

// ─── Status map ───────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  ACTIVE:    { dot: "#16a34a", label: "Active"    },
  SUSPENDED: { dot: "#dc2626", label: "Suspended" },
  PENDING:   { dot: "#f59e0b", label: "Pending"   },
  REJECTED:  { dot: "#6b7280", label: "Rejected"  },
};

type TabId = "events" | "documents";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a raw byte count into a human-readable KB / MB string.
 * Returns an italicised em-dash when the value is absent.
 */
function formatBytes(bytes?: number | null): React.ReactNode {
  if (bytes == null) return <i className="text-[hsl(var(--muted-foreground))]">—</i>;
  if (bytes === 0)   return "0 B";
  if (bytes < 1_024)     return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Renders an italicised em-dash for null / undefined / empty-string values.
 * Satisfies the spec requirement: "If a value is null, render a clean,
 * italicised dash '—' instead of triggering validation or view errors."
 */
function NullableField({ value }: { value: string | null | undefined }): React.ReactElement {
  if (value == null || value === "") {
    return <i className="text-[hsl(var(--muted-foreground))]">—</i>;
  }
  return <>{value}</>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const router  = useRouter();
  const [tab, setTab] = useState<TabId>("events");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: register, isLoading, isError } = useRegisterDetail(id);
  const {
    data:      events    = [],
    isLoading: eventsLoading,
  } = useStakeholderEvents(id);
  const {
    data:      documents = [],
    isLoading: docsLoading,
    isError:   docsError,
  } = useRegisterDocuments(id);

  // ── Mutations ─────────────────────────────────────────────────────────────
  // PATCH /api/v1/admin/users/{id}/suspend  |  PATCH /api/v1/admin/users/{id}/activate
  const suspendMutation  = useSuspendRegister();
  const activateMutation = useActivateRegister();

  // ── Full-page loading / error states ─────────────────────────────────────
  if (isLoading) return <Loader variant="page" text="Loading register profile…" />;

  if (isError || !register) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 className="h-10 w-10 text-[hsl(var(--muted-foreground))] opacity-30 mb-3" />
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Register not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          This register may have been removed or you may not have access.
        </p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/admin/registers")}>
          <ArrowLeft className="h-4 w-4" /> Back to Registers
        </Button>
      </div>
    );
  }

  const statusKey   = register.status?.toUpperCase() ?? "PENDING";
  const statusInfo  = STATUS_DOT[statusKey] ?? STATUS_DOT["PENDING"];
  const isActive    = statusKey === "ACTIVE";
  const isSuspended = statusKey === "SUSPENDED";

  // GET /api/v1/admin/stakeholders/{id} returns companyName — fall back to name
  const displayName = (register as any).companyName || register.name || "—";
  const initials    = displayName
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  const plan = (register as any).plan as string | undefined;

  // Safely unwrap nullable profile fields (rcNumber & industry can be null from the DB)
  const rcNumber    = register.rcNumber                  ?? (register as any).rcNumber                  ?? null;
  const industry    = register.industry                  ?? (register as any).industry                  ?? null;
  const email       = register.email                     ?? (register as any).contactEmail               ?? null;
  const repName     = register.representativeName        ?? (register as any).representativeName        ?? null;
  const repPhone    = register.representativePhone       ?? (register as any).representativePhone       ?? null;
  // enrolledAt is the spec primary date; approvedAt is the fallback (do NOT use createdAt)
  const enrolledAt  = register.enrolledAt ?? register.approvedAt ?? null;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Back nav ── */}
      <button
        onClick={() => router.push("/admin/registers")}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Registers
      </button>

      {/* ── Profile header card ── */}
      <Card className="attend-card p-6">
        <div className="flex items-start justify-between gap-6">

          {/* Identity block — companyName, plan badge, industry, status */}
          <div className="flex items-center gap-5">
            <div
              className="h-16 w-16 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
              style={{ backgroundColor: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{displayName}</h1>
                {plan && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                    {plan}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                {/* industry is nullable — render italic dash when null */}
                <span><NullableField value={industry} /></span>
                <span>·</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusInfo.dot }} />
                  <span>{statusInfo.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Administrative lifecycle controls
              PATCH /api/v1/admin/users/{id}/suspend  |  activate */}
          <div className="flex items-center gap-2 shrink-0">
            {isActive && (
              <Button
                size="sm" variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                disabled={suspendMutation.isPending}
                onClick={() => suspendMutation.mutate({ id: register.id })}
              >
                {suspendMutation.isPending ? "Suspending…" : "Suspend"}
              </Button>
            )}
            {isSuspended && (
              <Button
                size="sm" variant="outline"
                className="text-green-700 border-green-200 hover:bg-green-50"
                disabled={activateMutation.isPending}
                onClick={() => activateMutation.mutate(register.id)}
              >
                {activateMutation.isPending ? "Activating…" : "Reactivate"}
              </Button>
            )}
          </div>
        </div>

        {/* ── Metadata grid
            rcNumber and industry are nullable — NullableField renders italic "—"
            Grid grows to 6 columns on lg screens to accommodate the Enrolled date ── */}
        <div className="mt-5 pt-5 border-t border-[hsl(var(--border))] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {([
            { icon: Hash,      label: "RC Number",     value: rcNumber },
            { icon: Mail,      label: "Email",          value: email    },
            { icon: Building2, label: "Industry",       value: industry },
            { icon: User,      label: "Representative", value: repName  },
            { icon: Phone,     label: "Rep. Phone",     value: repPhone },
          ] as { icon: React.ElementType; label: string; value: string | null | undefined }[]).map(
            ({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div>
                  <p className="attend-section-title">{label}</p>
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5 break-all">
                    <NullableField value={value} />
                  </p>
                </div>
              </div>
            )
          )}

          {/* Enrolled date — enrolledAt (spec primary) → approvedAt (fallback).
              Never uses createdAt. Rendered as a DateCell, not a plain string. */}
          <div className="flex items-start gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
              <CalendarCheck className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            </div>
            <div>
              <p className="attend-section-title">Enrolled</p>
              <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">
                {enrolledAt
                  ? <DateCell value={enrolledAt} />
                  : <i className="text-[hsl(var(--muted-foreground))]">—</i>
                }
              </p>
            </div>
          </div>
        </div>

        {/* Quick stat */}
        <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums" style={{ color: "#374151" }}>
            {register.eventCount ?? events.length}
          </span>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Events</span>
        </div>
      </Card>

      {/* ── Tab switcher ── */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-fit">
        {(["events", "documents"] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              tab === t
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            )}
          >
            {t === "events" ? "Events Registry" : "Uploaded Document Vault"}
          </button>
        ))}
      </div>

      {/* ── Events Registry tab ── */}
      {tab === "events" && (
        <Card className="attend-card overflow-hidden">
          {/* Header — show count, no endpoint text */}
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Events Registry</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {eventsLoading ? "Loading…" : `${events.length} event${events.length !== 1 ? "s" : ""} for this register`}
              </p>
            </div>
          </div>

          {eventsLoading ? (
            <div className="p-8"><Loader variant="inline" text="Loading events…" /></div>
          ) : events.length === 0 ? (
            <div className="py-14 text-center">
              <CalendarX className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No events created yet.</p>
            </div>
          ) : (
            /* Card grid — one card per event, coloured circle + module badge */
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {events.map((ev: any) => {
                const mod      = getEventModule(ev);
                const dotColor = MODULE_COLORS[mod];
                const rsvp     = ev.registrationCount ?? ev.rsvpCount ?? ev.rsvps?.count ?? 0;
                const isLive   = ev.status?.toUpperCase() === "LIVE";
                return (
                  <Link key={ev.id} href={`/events/${ev.id}`} className="block group">
                    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.02)] transition-all">

                      {/* Top row: circle + module badge + live pill */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <ModuleBadge module={mod} />
                        {isLive && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5 ml-auto">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE
                          </span>
                        )}
                        {!isLive && (
                          <span className="ml-auto">
                            <StatusBadge status={ev.status?.toLowerCase?.()} />
                          </span>
                        )}
                      </div>

                      {/* Event title */}
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-snug line-clamp-2 mb-3">
                        {ev.title || "Untitled Event"}
                      </p>

                      {/* Meta row: date + RSVP count */}
                      <div className="flex items-center gap-4 text-xs text-[hsl(var(--muted-foreground))]">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{formatDate(ev.date || ev.startDate) || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="tabular-nums">{rsvp.toLocaleString()} RSVPs</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      )}


      {/* ── Uploaded Document Vault tab ─────────────────────────────────────────
          ISOLATED error boundary: a failure inside this fetch loop is caught and
          rendered as an inline error panel. It can never crash the root layout
          or the profile header metadata grid above.

          Column contract (GET /api/v1/admin/registers/{id}/documents):
            doc.title         — document filename string
            doc.eventTitle    — meeting context scope name
            doc.fileSizeBytes — raw bytes → formatted KB/MB
            doc.downloadCount — total click metric counter
            doc.uploadedAt    — calendar timestamp string
      ──────────────────────────────────────────────────────────────────────────── */}
      {tab === "documents" && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Uploaded Document Vault</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Legal &amp; compliance documents —{" "}
              <code className="font-mono">GET /api/v1/admin/registers/{"{id}"}/documents</code>
            </p>
          </div>

          {/* Loading state */}
          {docsLoading && (
            <div className="p-8">
              <Loader variant="inline" text="Loading documents…" />
            </div>
          )}

          {/* Isolated error wall — failure here never propagates to the root layout */}
          {!docsLoading && docsError && (
            <div className="py-14 text-center px-6">
              <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-500 opacity-70" />
              <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">
                Could not load documents
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                The document vault is temporarily unavailable. The rest of this profile is unaffected.
              </p>
            </div>
          )}

          {/* Empty state */}
          {!docsLoading && !docsError && documents.length === 0 && (
            <div className="py-14 text-center">
              <Inbox className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No documents uploaded yet.</p>
            </div>
          )}

          {/* Data grid — rendered only when fetch succeeded and returned rows */}
          {!docsLoading && !docsError && documents.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Document</th>
                  <th className="px-5 py-3 text-left">Meeting Context</th>
                  <th className="px-5 py-3 text-left">Size</th>
                  <th className="px-5 py-3 text-left">Downloads</th>
                  <th className="px-5 py-3 text-left">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {(documents as RegisterDocumentItem[]).map((doc) => (
                  <tr key={doc.id} className="attend-table-row">

                    {/* doc.title — document filename string */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {doc.title
                            ? doc.title
                            : <i className="text-[hsl(var(--muted-foreground))]">—</i>
                          }
                        </span>
                      </div>
                    </td>

                    {/* doc.eventTitle — meeting context scope name.
                        Default to "Global Space Notice" when the server returns null. */}
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {doc.eventTitle ?? "Global Space Notice"}
                    </td>

                    {/* doc.fileSizeBytes — formatted to KB / MB */}
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {formatBytes(doc.fileSizeBytes)}
                    </td>

                    {/* doc.downloadCount — total click metric tracking counter */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        <span className="tabular-nums font-medium">{doc.downloadCount ?? 0}</span>
                      </div>
                    </td>

                    {/* doc.uploadedAt — calendar timestamp string */}
                    <td className="px-5 py-3">
                      <DateCell value={doc.uploadedAt} />
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

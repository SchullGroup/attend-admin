"use client";
import { useState } from "react";
import {
  Video,
  Lock,
  RefreshCw,
  Radio,
  AlertTriangle,
  Server,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  Info,
  ExternalLink,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";
import { resolveRole, isSuperAdminRole } from "@/lib/utils";
import { useGetMe } from "@/api/auth/hooks";
import { useEvents } from "@/api/super-admin";
import {
  useAdminZoomSessions,
  useReleaseZoomSession,
  useReleaseZoomSessionsBulk,
  useAssignZoomSession,
  type ZoomSessionRow,
} from "@/api/admin-zoom-sessions";

export default function ZoomSessionsPage() {
  // ── Role gate (backend enforces SUPER_ADMIN too; this is defence-in-depth) ──
  const { data: userResponse, isLoading: meLoading } = useGetMe();
  const currentUser = userResponse?.data;
  const isSuperAdmin = isSuperAdminRole(resolveRole(currentUser));

  // ── Data + mutations (hooks must run before any early return) ───────────────
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    isError,
    isFetching,
    refetch,
  } = useAdminZoomSessions(isSuperAdmin);
  // Event picker for manual assignment — only VIRTUAL/HYBRID events consume a host.
  const { data: eventsPage } = useEvents("", 0, 100, isSuperAdmin);
  const releaseMutation = useReleaseZoomSession();
  const bulkReleaseMutation = useReleaseZoomSessionsBulk();
  const assignMutation = useAssignZoomSession();

  // ── Assign form state ───────────────────────────────────────────────────────
  const [assignEventId, setAssignEventId] = useState<string>("");
  const [assignDuration, setAssignDuration] = useState("120");

  // ── Bulk-selection + diagnostics state ──────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showRaw, setShowRaw] = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleRelease(row: ZoomSessionRow) {
    popup.confirm(
      "Release this Zoom slot?",
      <span>
        This frees the pooled host account holding <b>{row.eventTitle}</b> so another event can use
        it. Anyone currently connected to that meeting will be <b>disconnected</b>. Only release a
        slot that is stranded or no longer needed.
      </span>,
      () =>
        releaseMutation.mutate(
          { eventId: row.eventId },
          {
            onSuccess: () =>
              setSelected((prev) => {
                const next = new Set(prev);
                next.delete(row.eventId);
                return next;
              }),
          },
        ),
      undefined,
      "Release slot",
    );
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Confirm-guarded release of many slots at once (selection or all-stranded).
  function handleReleaseMany(ids: string[]) {
    if (ids.length === 0) {
      popup.error("Nothing selected", "Tick one or more held slots to release them.");
      return;
    }
    popup.confirm(
      `Release ${ids.length} Zoom slot${ids.length === 1 ? "" : "s"}?`,
      <span>
        This frees <b>{ids.length}</b> pooled host slot{ids.length === 1 ? "" : "s"} so other events
        can use them. Anyone still connected to those meetings will be <b>disconnected</b>. Release
        only slots that are stranded or no longer needed.
      </span>,
      () =>
        bulkReleaseMutation.mutate(
          { eventIds: ids },
          { onSuccess: () => setSelected(new Set()) },
        ),
      undefined,
      "Release slots",
    );
  }

  function handleAssign() {
    if (!assignEventId) {
      popup.error("Pick an event", "Choose an event to assign a Zoom host to.");
      return;
    }
    const dur = Number(assignDuration);
    const durationMinutes = Number.isFinite(dur) && dur > 0 ? Math.min(Math.round(dur), 1440) : 120;
    assignMutation.mutate(
      { eventId: assignEventId, durationMinutes },
      { onSuccess: () => setAssignEventId("") },
    );
  }

  // ── Early returns (after all hooks) ─────────────────────────────────────────
  if (meLoading) return <Loader variant="page" text="Loading…" />;

  if (!isSuperAdmin) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-6 w-6 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Restricted</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
          Zoom capacity controls are available to Super Admins only.
        </p>
      </div>
    );
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const available = sessionsData?.available ?? true;
  const sessions = sessionsData?.sessions ?? [];
  const totals = sessionsData?.totals ?? {
    totalCapacity: null,
    slotsInUse: null,
    slotsFree: null,
    strandedSlots: null,
  };
  const capacityReported = sessionsData?.capacityReported ?? false;
  const rawPayload = sessionsData?.raw ?? null;
  const assignableEvents = (eventsPage?.content ?? []).filter((e) => e.format !== "IN_PERSON");
  const releasing = releaseMutation.isPending;
  const bulkReleasing = bulkReleaseMutation.isPending;
  const assigning = assignMutation.isPending;
  const anyBusy = releasing || bulkReleasing;

  // Selection / stranded bookkeeping for the bulk-release actions.
  const strandedIds = sessions.filter((s) => s.stranded).map((s) => s.eventId);
  const selectedIds = sessions.filter((s) => selected.has(s.eventId)).map((s) => s.eventId);
  const allVisibleSelected = sessions.length > 0 && sessions.every((s) => selected.has(s.eventId));
  const someVisibleSelected = sessions.some((s) => selected.has(s.eventId));

  const fmtNum = (n: number | null) => (n == null ? "—" : n.toLocaleString());

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.08)] flex items-center justify-center shrink-0">
            <Video className="h-5 w-5 text-[hsl(var(--primary))]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Zoom Sessions</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Live events share a pool of Zoom host accounts. Monitor who holds a slot, free stranded
              slots, and assign hosts manually.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={sessionsLoading || isFetching}
          className="gap-2 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Not-deployed-yet state (endpoints 404 until certificate.md §7 ships) */}
      {!available ? (
        <Card className="attend-card p-8 text-center">
          <div className="h-12 w-12 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-4">
            <Info className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
          </div>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
            Zoom capacity controls aren't enabled here yet
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2 max-w-md mx-auto">
            This page activates automatically once the backend Zoom host-pool endpoints are deployed.
            Until then, Zoom meetings continue to be provisioned per-event as they are today.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 mt-5">
            <RefreshCw className="h-4 w-4" /> Check again
          </Button>
        </Card>
      ) : isError ? (
        <Card className="attend-card p-8 text-center border-red-100">
          <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
            Couldn't load Zoom sessions
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
            Something went wrong fetching the host pool. Please try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 mt-5">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={<Server className="h-4 w-4" />}
              label="Total capacity"
              value={fmtNum(totals.totalCapacity)}
              note={totals.totalCapacity == null ? "Not reported by backend" : undefined}
            />
            <StatCard
              icon={<Radio className="h-4 w-4" />}
              label="Slots in use"
              value={fmtNum(totals.slotsInUse)}
              note={!capacityReported ? "Derived from held slots" : undefined}
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Slots free"
              value={fmtNum(totals.slotsFree)}
              tone={
                totals.slotsFree == null ? "muted" : totals.slotsFree === 0 ? "danger" : "ok"
              }
              note={totals.slotsFree == null ? "Needs capacity from backend" : undefined}
            />
            <StatCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Stranded"
              value={fmtNum(totals.strandedSlots)}
              tone={totals.strandedSlots && totals.strandedSlots > 0 ? "warn" : "muted"}
            />
          </div>

          {/* Assign a host */}
          <Card className="attend-card p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="h-4 w-4 text-[hsl(var(--primary))]" />
              <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
                Assign a host to an event
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <Label>Event</Label>
                <Select value={assignEventId} onValueChange={setAssignEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a virtual/hybrid event…" />
                  </SelectTrigger>
                  <SelectContent className="w-(--radix-select-trigger-width)">
                    {assignableEvents.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                        No virtual/hybrid events found.
                      </div>
                    ) : (
                      assignableEvents.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.title} · {e.format}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:w-40">
                <Label htmlFor="assign-duration">Duration (min)</Label>
                <Input
                  id="assign-duration"
                  type="number"
                  min={1}
                  max={1440}
                  value={assignDuration}
                  onChange={(e) => setAssignDuration(e.target.value)}
                  placeholder="120"
                />
              </div>
              <Button onClick={handleAssign} disabled={assigning || !assignEventId} className="gap-2">
                {assigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Assigning…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Assign host
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
              Assigns a pooled Zoom host to the event's meeting. If every shared host is busy the
              request is rejected — release a stranded slot below first.
            </p>
          </Card>

          {/* Sessions table */}
          <Card className="attend-card p-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-[hsl(var(--border))]">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[hsl(var(--primary))]" />
                <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
                  Held slots{" "}
                  <span className="text-[hsl(var(--muted-foreground))] font-normal">
                    ({sessions.length})
                  </span>
                </h2>
              </div>
              {sessions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedIds.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReleaseMany(selectedIds)}
                      disabled={anyBusy}
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      {bulkReleasing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Release selected ({selectedIds.length})
                    </Button>
                  )}
                  {strandedIds.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReleaseMany(strandedIds)}
                      disabled={anyBusy}
                      className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                    >
                      {bulkReleasing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      Release all stranded ({strandedIds.length})
                    </Button>
                  )}
                </div>
              )}
            </div>

            {sessionsLoading ? (
              <div className="py-16">
                <Loader text="Loading sessions…" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-16 text-center">
                <div className="h-12 w-12 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-3">
                  <Video className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                </div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                  No Zoom hosts are in use right now
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Held slots appear here while virtual events are live.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                      <th className="w-10 pl-6 pr-2 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all held slots"
                          className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))] align-middle cursor-pointer"
                          checked={allVisibleSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                          }}
                          onChange={() =>
                            setSelected(
                              allVisibleSelected
                                ? new Set()
                                : new Set(sessions.map((s) => s.eventId)),
                            )
                          }
                        />
                      </th>
                      <th className="px-4 py-3">Event</th>
                      <th className="px-4 py-3">Organizer</th>
                      <th className="px-4 py-3">Host account</th>
                      <th className="px-4 py-3">Meeting</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((row) => {
                      const isSel = selected.has(row.eventId);
                      return (
                        <tr
                          key={row.eventId}
                          className={`border-b border-[hsl(var(--border))] last:border-0 ${
                            isSel
                              ? "bg-[hsl(var(--primary)/0.04)]"
                              : row.stranded
                                ? "bg-amber-50/50"
                                : ""
                          }`}
                        >
                          <td className="w-10 pl-6 pr-2 py-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.eventTitle}`}
                              className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))] align-middle cursor-pointer"
                              checked={isSel}
                              onChange={() => toggleRow(row.eventId)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[hsl(var(--foreground))]">
                              {row.eventTitle}
                            </div>
                            {row.eventStatus && (
                              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                                {row.eventStatus}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                            <div>{row.orgName ?? "—"}</div>
                            {row.registrarName && (
                              <div className="text-xs mt-0.5">{row.registrarName}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                            {row.pooledAccount ? (
                              <code className="text-xs break-all">{row.pooledAccount}</code>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                            {row.joinUrl ? (
                              <a
                                href={row.joinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[hsl(var(--primary))] hover:underline"
                              >
                                Join <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : row.meetingId ? (
                              <code className="text-xs">{String(row.meetingId)}</code>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {row.live && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 bg-green-50 text-green-700">
                                  <Radio className="h-3 w-3" /> Live
                                </span>
                              )}
                              {row.stranded && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">
                                  <AlertTriangle className="h-3 w-3" /> Stranded
                                </span>
                              )}
                              {!row.live && !row.stranded && (
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                  Held
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRelease(row)}
                              disabled={anyBusy}
                              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Release
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {totals.strandedSlots != null && totals.strandedSlots > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <b>{totals.strandedSlots}</b> slot(s) are stranded — still held by events that have
                ended or been cancelled. Use <b>Release all stranded</b> above to free capacity for
                live events in one click.
              </span>
            </div>
          )}

          {/* Super-admin diagnostic — the exact backend payload. Handy when totals read "—":
              it shows whether the backend actually returned pool capacity or the FE derived it. */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <Code2 className="h-3.5 w-3.5" />
              {showRaw ? "Hide" : "Show"} raw response
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs leading-relaxed text-[hsl(var(--foreground))]">
                {JSON.stringify(rawPayload, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Small presentational helper ────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  tone = "muted",
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "muted" | "ok" | "warn" | "danger";
  note?: string;
}) {
  const toneCls =
    tone === "danger"
      ? "text-red-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "ok"
          ? "text-green-600"
          : "text-[hsl(var(--foreground))]";
  return (
    <Card className="attend-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
        <span className="text-[hsl(var(--muted-foreground))]">{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</div>
      {note && (
        <div className="mt-0.5 text-[11px] leading-tight text-[hsl(var(--muted-foreground))]">
          {note}
        </div>
      )}
    </Card>
  );
}

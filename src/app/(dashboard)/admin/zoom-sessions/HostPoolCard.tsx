"use client";
import { Fragment, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  Info,
  Check,
  X,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { popup } from "@/lib/popup-store";
import {
  useAddZoomHost,
  useUpdateZoomHostCapacity,
  useRemoveZoomHost,
  type AdminZoomHostsData,
  type ZoomHostRow,
  type ZoomHostType,
} from "@/api/admin-zoom-hosts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CAPACITY = 10; // sane upper bound; a Zoom Business seat realistically delivers 1–2

/**
 * Host-pool management (certificate.md §7d). Lets a super admin add a licensed Zoom
 * seat — "add the email and have 6 slots without ever having to call us" — correct
 * a seat's real capacity, and remove a host. Sums per-host capacity into the pool
 * ceiling, which is also what fills the sessions page's "Total capacity" card when
 * the sessions endpoint itself doesn't report totals (host-pool doc §10.1).
 */
export function HostPoolCard({
  data,
  isLoading,
  derivedUsage,
  unattributedSlots = 0,
}: {
  data: AdminZoomHostsData | undefined;
  isLoading: boolean;
  /**
   * Per-host slots in use, keyed by lower-cased host email, derived from the
   * sessions list. Used when `GET /api/v1/admin/zoom-hosts` reports no usage of
   * its own — otherwise every row reads "0 / 2" while the overview cards above
   * say slots are in use, which reads as a bug in the page rather than a gap in
   * the payload.
   */
  derivedUsage?: Record<string, number>;
  /** Held slots whose host account is not in the pool list — cannot be attributed to a row. */
  unattributedSlots?: number;
}) {
  const addHost = useAddZoomHost();
  const updateCapacity = useUpdateZoomHostCapacity();
  const removeHost = useRemoveZoomHost();

  const [newEmail, setNewEmail] = useState("");
  const [newCapacity, setNewCapacity] = useState("2");
  const [newType,     setNewType]     = useState<ZoomHostType>("MEETING");
  // Per-row capacity drafts, keyed by host id. Absent = not being edited.
  const [capacityDraft, setCapacityDraft] = useState<Record<string, string>>({});

  const available = data?.available ?? true;
  // Meeting seats first, then webinar licences, so the table reads as two
  // sections. They are different resources and get counted separately.
  const meetingHosts = data?.meetingHosts ?? [];
  const webinarHosts = data?.webinarHosts ?? [];
  const hosts = [...meetingHosts, ...webinarHosts];
  // Prefer the backend's own per-host usage; fall back to what the sessions list
  // tells us about which pooled account is holding each slot.
  const usageReported = data?.usageReported ?? false;
  const usageFor = (host: ZoomHostRow): number =>
    usageReported ? host.activeCount : (derivedUsage?.[host.email.trim().toLowerCase()] ?? 0);

  function handleAdd() {
    const email = newEmail.trim();
    if (!EMAIL_RE.test(email)) {
      popup.error("Enter a valid email", "Add the licensed Zoom account's email address, e.g. host@company.com.");
      return;
    }
    if (hosts.some((h) => h.email.toLowerCase() === email.toLowerCase())) {
      popup.error("Already in the pool", `${email} is already a registered host.`);
      return;
    }
    const capNum = Number(newCapacity);
    // A webinar licence runs one webinar at a time. A second licence is a second
    // host row, never a bigger number here, so the field is pinned for webinars.
    const capacity = newType === "WEBINAR"
      ? 1
      : (Number.isFinite(capNum) && capNum >= 1 ? Math.min(Math.round(capNum), MAX_CAPACITY) : 2);
    addHost.mutate(
      { email, capacity, type: newType },
      {
        onSuccess: () => {
          setNewEmail("");
          setNewCapacity("2");
          setNewType("MEETING");
        },
      },
    );
  }

  function handleSaveCapacity(host: ZoomHostRow) {
    const raw = capacityDraft[host.id];
    const capNum = Number(raw);
    if (!Number.isFinite(capNum) || capNum < 1) {
      popup.error("Invalid capacity", "Capacity must be a whole number of 1 or more.");
      return;
    }
    const capacity = Math.min(Math.round(capNum), MAX_CAPACITY);
    if (capacity === host.capacity) {
      // No change — just drop the draft.
      setCapacityDraft((prev) => {
        const next = { ...prev };
        delete next[host.id];
        return next;
      });
      return;
    }
    updateCapacity.mutate(
      { hostId: host.id, capacity },
      {
        onSuccess: () =>
          setCapacityDraft((prev) => {
            const next = { ...prev };
            delete next[host.id];
            return next;
          }),
      },
    );
  }

  function handleRemove(host: ZoomHostRow) {
    popup.confirm(
      "Remove this host from the pool?",
      <span>
        This removes <b>{host.email}</b> from the shared Zoom host pool, lowering total capacity by{" "}
        <b>{host.capacity}</b> slot{host.capacity === 1 ? "" : "s"}. Any meeting currently running on
        this host is unaffected, but no new meetings will be assigned to it.
      </span>,
      () => removeHost.mutate({ hostId: host.id }),
      undefined,
      "Remove host",
    );
  }

  const adding = addHost.isPending;
  const savingCapacity = updateCapacity.isPending;
  const removing = removeHost.isPending;

  return (
    <Card className="attend-card p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-4 w-4 text-[hsl(var(--primary))]" />
        <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Host pool</h2>
        {available && hosts.length > 0 && (
          <span className="text-sm text-[hsl(var(--muted-foreground))] font-normal">
            ({meetingHosts.length} meeting host{meetingHosts.length === 1 ? "" : "s"} ·{" "}
            {meetingHosts.reduce((s, h) => s + h.capacity, 0)} slots
            {webinarHosts.length > 0
              ? ` · ${webinarHosts.length} webinar licence${webinarHosts.length === 1 ? "" : "s"}`
              : " · no webinar licence"})
          </span>
        )}
      </div>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
        Licensed Zoom accounts that live meetings are spread across. Add a seat to raise total
        capacity immediately — no deploy needed.
      </p>

      {!available ? (
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3 text-sm text-[hsl(var(--muted-foreground))]">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Host-pool management activates once the backend{" "}
            <code className="text-xs">/api/v1/admin/zoom-hosts</code> endpoints are deployed. Until
            then, hosts are managed by ops in the Zoom admin console.
          </span>
        </div>
      ) : (
        <>
          {/* Add a host */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-5">
            <div className="space-y-1.5 flex-1 min-w-0">
              <Label htmlFor="host-email">Licensed Zoom email</Label>
              <Input
                id="host-email"
                type="email"
                placeholder="host@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>
            <div className="space-y-1.5 sm:w-40">
              <Label htmlFor="host-type">Runs</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as ZoomHostType)}>
                <SelectTrigger id="host-type" className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEETING">Meetings</SelectItem>
                  <SelectItem value="WEBINAR">Webinars</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:w-32">
              <Label htmlFor="host-capacity">Capacity</Label>
              <Input
                id="host-capacity"
                type="number"
                min={1}
                max={MAX_CAPACITY}
                value={newType === "WEBINAR" ? "1" : newCapacity}
                disabled={newType === "WEBINAR"}
                onChange={(e) => setNewCapacity(e.target.value)}
              />
            </div>
            <Button onClick={handleAdd} disabled={adding || !newEmail.trim()} className="gap-2">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add host
            </Button>
          </div>

          {newType === "WEBINAR" && (
            <p className="-mt-3 mb-5 text-xs text-[hsl(var(--muted-foreground))]">
              The account must hold a Zoom webinar licence, and the API app needs the{" "}
              <code className="text-[11px]">webinar:write:admin</code> scope — Zoom only shows that
              scope once the account has a licence. Capacity is fixed at one; add a second host for
              a second licence. The type cannot be changed after the host is created.
            </p>
          )}

          {/* Host list */}
          {isLoading ? (
            <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading host pool…
            </div>
          ) : hosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[hsl(var(--border))] py-8 text-center">
              <div className="h-10 w-10 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-2">
                <Server className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">The host pool is empty</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Until a licensed host is added, every virtual event launch returns{" "}
                <span className="whitespace-nowrap">no-capacity</span>. Add one above to start.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
                    <th className="px-4 py-2.5">Host account</th>
                    <th className="px-4 py-2.5 w-28">Type</th>
                    <th className="px-4 py-2.5 w-40">Capacity</th>
                    <th className="px-4 py-2.5 w-24">In use</th>
                    <th className="px-4 py-2.5 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hosts.map((host, idx) => {
                    const draft = capacityDraft[host.id];
                    const editing = draft !== undefined;
                    const changed = editing && Number(draft) !== host.capacity;
                    const isWebinar = host.type === "WEBINAR";
                    // First row of each kind opens a labelled section.
                    const startsSection = idx === 0 || hosts[idx - 1].type !== host.type;
                    return (
                      <Fragment key={host.id}>
                      {startsSection && (
                        <tr className="bg-[hsl(var(--muted)/0.4)]">
                          <td colSpan={5} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                            {isWebinar ? "Webinar licences — one webinar at a time each" : "Meeting hosts"}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-[hsl(var(--border))] last:border-0">
                        <td className="px-4 py-3">
                          <code className="text-xs break-all text-[hsl(var(--foreground))]">{host.email}</code>
                          {host.label && (
                            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{host.label}</div>
                          )}
                          {isWebinar && (host.bookedCount ?? 0) > 0 && (
                            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                              {host.bookedCount} booking{host.bookedCount === 1 ? "" : "s"} upcoming
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={isWebinar
                              ? { backgroundColor: "#7c22c91a", color: "#7c22c9" }
                              : { backgroundColor: "#0B5CFF1a", color: "#0B5CFF" }}
                          >
                            {isWebinar ? "Webinar" : "Meeting"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={MAX_CAPACITY}
                              value={editing ? draft : String(host.capacity)}
                              onChange={(e) =>
                                setCapacityDraft((prev) => ({ ...prev, [host.id]: e.target.value }))
                              }
                              className="h-8 w-16"
                            />
                            {changed && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveCapacity(host)}
                                  disabled={savingCapacity}
                                  aria-label="Save capacity"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-green-600 hover:bg-green-50 disabled:opacity-50"
                                >
                                  {savingCapacity ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCapacityDraft((prev) => {
                                      const next = { ...prev };
                                      delete next[host.id];
                                      return next;
                                    })
                                  }
                                  aria-label="Cancel"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-4 py-3 text-[hsl(var(--muted-foreground))]"
                          title={usageReported ? undefined : "Derived from the live sessions list — the host-pool endpoint does not report per-host usage."}
                        >
                          {usageFor(host)} / {host.capacity}
                          {!usageReported && <span className="ml-1 text-[10px] uppercase tracking-wide opacity-60">est.</span>}
                          {!!host.strandedCount && (
                            <span
                              className="ml-1 text-[10px] text-amber-700"
                              title="Slots still held for events that have ended or been cancelled. Cancel them to reclaim the capacity."
                            >
                              · {host.strandedCount} stranded
                            </span>
                          )}
                          {host.ledgerDrift && (
                            <span
                              className="ml-1 text-[10px] text-amber-700"
                              title={`The pool's own counter says ${host.ledgerActiveCount ?? "?"}. Assignment reads that counter, so while it disagrees this host may be over-assigned.`}
                            >
                              · drift
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemove(host)}
                            disabled={removing}
                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </Button>
                        </td>
                      </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!usageReported && hosts.length > 0 && (
            <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
              <b>In use</b> is worked out from the live sessions list — the host-pool endpoint
              does not report per-host usage yet, so these figures are attributed by host email
              rather than counted by the server.
            </p>
          )}
          {unattributedSlots > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              <b>{unattributedSlots}</b> held slot{unattributedSlots === 1 ? " is" : "s are"} not
              attributed to any host above — either the session names an account that is not in
              this pool, or it reports no host account at all. Pool usage will not add up to the
              &ldquo;Slots in use&rdquo; card until that is resolved.
            </p>
          )}

          <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
            Capacity is <b>per host</b> and defaults to <b>2</b>. A Zoom seat without the
            &ldquo;simultaneous meetings&rdquo; setting only delivers 1 — verify each new seat in the
            Zoom admin console and set its real capacity here.
          </p>
        </>
      )}
    </Card>
  );
}

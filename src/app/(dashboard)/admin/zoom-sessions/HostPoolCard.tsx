"use client";
import { useState } from "react";
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
}: {
  data: AdminZoomHostsData | undefined;
  isLoading: boolean;
}) {
  const addHost = useAddZoomHost();
  const updateCapacity = useUpdateZoomHostCapacity();
  const removeHost = useRemoveZoomHost();

  const [newEmail, setNewEmail] = useState("");
  const [newCapacity, setNewCapacity] = useState("2");
  // Per-row capacity drafts, keyed by host id. Absent = not being edited.
  const [capacityDraft, setCapacityDraft] = useState<Record<string, string>>({});

  const available = data?.available ?? true;
  const hosts = data?.hosts ?? [];

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
    const capacity = Number.isFinite(capNum) && capNum >= 1 ? Math.min(Math.round(capNum), MAX_CAPACITY) : 2;
    addHost.mutate(
      { email, capacity },
      {
        onSuccess: () => {
          setNewEmail("");
          setNewCapacity("2");
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
            ({hosts.length} host{hosts.length === 1 ? "" : "s"} ·{" "}
            {hosts.reduce((s, h) => s + h.capacity, 0)} slots)
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
            <div className="space-y-1.5 sm:w-32">
              <Label htmlFor="host-capacity">Capacity</Label>
              <Input
                id="host-capacity"
                type="number"
                min={1}
                max={MAX_CAPACITY}
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
              />
            </div>
            <Button onClick={handleAdd} disabled={adding || !newEmail.trim()} className="gap-2">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add host
            </Button>
          </div>

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
                    <th className="px-4 py-2.5 w-40">Capacity</th>
                    <th className="px-4 py-2.5 w-24">In use</th>
                    <th className="px-4 py-2.5 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hosts.map((host) => {
                    const draft = capacityDraft[host.id];
                    const editing = draft !== undefined;
                    const changed = editing && Number(draft) !== host.capacity;
                    return (
                      <tr key={host.id} className="border-b border-[hsl(var(--border))] last:border-0">
                        <td className="px-4 py-3">
                          <code className="text-xs break-all text-[hsl(var(--foreground))]">{host.email}</code>
                          {host.label && (
                            <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{host.label}</div>
                          )}
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
                        <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                          {host.activeCount} / {host.capacity}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
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

"use client";

/**
 * Walk-in check-in at the gate — for shareholders without a phone and for
 * regulators / guests. Gate staff verify people themselves (a valid photo ID);
 * Attend only records the check-in.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Search, UserCheck, Undo2, Loader2, IdCard, Building2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { popup } from "@/lib/popup-store";
import {
  useRegisterSearch, useCheckInWalkInShareholder, useUndoWalkInShareholder, useCreateWalkInGuest,
  apiErrorOf, type RegisterSearchResult, type CheckInMethod,
} from "@/api/client-walk-ins";
import { WalkInGuestForm } from "@/components/walk-ins/WalkInGuestForm";

const METHOD_LABEL: Record<string, string> = {
  QR_SCAN: "QR scan", SELF: "online", WALK_IN: "walk-in", UNRECORDED: "earlier",
};

function timeOf(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

export function WalkInPanel({
  eventId, color, onCheckedIn,
}: {
  eventId: string;
  color: string;
  /** Adds the person to this session's check-in log. */
  onCheckedIn: (name: string, kind: "shareholder" | "guest") => void;
}) {
  const [tab, setTab] = useState<"shareholder" | "guest">("shareholder");

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Walk-in check-in</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 flex items-center gap-1">
            <IdCard className="h-3.5 w-3.5" /> Ask for a valid photo ID before checking anyone in.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1" role="tablist">
          {([["shareholder", "Shareholder"], ["guest", "Regulator / guest"]] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === k ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5">
        {tab === "shareholder"
          ? <ShareholderWalkIn eventId={eventId} color={color} onCheckedIn={(n) => onCheckedIn(n, "shareholder")} />
          : <GuestWalkIn eventId={eventId} onCheckedIn={(n) => onCheckedIn(n, "guest")} />}
      </div>
    </Card>
  );
}

// ── Shareholder ────────────────────────────────────────────────────────────

function ShareholderWalkIn({ eventId, color, onCheckedIn }: { eventId: string; color: string; onCheckedIn: (name: string) => void }) {
  const [q, setQ] = useState("");
  const term = useDebouncedValue(q.trim(), 300);
  const { data, isFetching, isError, refetch } = useRegisterSearch(eventId, term, 0, 20);
  const checkIn = useCheckInWalkInShareholder();
  const undo    = useUndoWalkInShareholder();
  const [busyId, setBusyId] = useState<string | null>(null);
  const results = term.length >= 2 ? (data?.content ?? []) : [];

  function doCheckIn(r: RegisterSearchResult) {
    setBusyId(r.shareholderId);
    checkIn.mutate(
      { eventId, shareholderId: r.shareholderId },
      {
        onSuccess: ({ message }) => {
          toast.success(message ?? `Checked in. Welcome, ${r.fullName}!`);
          onCheckedIn(r.fullName);
        },
        onError: (err) => {
          const e = apiErrorOf(err);
          if (e.status === 409) {
            toast.error(e.message ?? `${r.fullName} is already checked in.`);
            refetch();
          } else {
            toast.error(e.message ?? "Couldn't check them in. Please try again.");
          }
        },
        onSettled: () => setBusyId(null),
      },
    );
  }

  function doUndo(r: RegisterSearchResult) {
    if (!r.walkInId) return;
    popup.confirm(
      "Undo this check-in?",
      `${r.fullName} will be removed from attendance. You can check them in again.`,
      () => {
        setBusyId(r.shareholderId);
        undo.mutate(
          { eventId, walkInId: r.walkInId! },
          {
            onSuccess: () => toast.success(`Check-in undone for ${r.fullName}`),
            onError: (err) => toast.error(apiErrorOf(err).message ?? "Couldn't undo the check-in."),
            onSettled: () => setBusyId(null),
          },
        );
      },
      undefined, "Undo check-in", "Cancel",
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the register by name…"
          autoComplete="off"
          name="walk-in-search"
          className="pl-9 h-10"
          autoFocus
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />}
      </div>

      {term.length < 2 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-6">
          Type at least 2 letters of the shareholder&apos;s name.
        </p>
      ) : isError ? (
        <p className="text-sm text-[hsl(var(--destructive))] text-center py-6">Couldn&apos;t search the register. Please try again.</p>
      ) : results.length === 0 && !isFetching ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-6">
          No active shareholder on this register matches &ldquo;{term}&rdquo;.
        </p>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] max-h-[420px] overflow-y-auto">
          {results.map((r) => {
            const busy = busyId === r.shareholderId;
            const how = METHOD_LABEL[(r.method ?? "") as string] ?? "";
            return (
              <div key={r.shareholderId} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{r.fullName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                    {r.chn ? <>CHN {r.chn}</> : "No CHN"}
                    {typeof r.units === "number" && <> · {r.units.toLocaleString()} units</>}
                  </p>
                </div>
                {r.checkedIn ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2.5 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      In{r.checkedInAt ? ` at ${timeOf(r.checkedInAt)}` : ""}{how ? ` (${how})` : ""}
                    </span>
                    {r.method === ("WALK_IN" as CheckInMethod) && r.walkInId && (
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" disabled={busy} onClick={() => doUndo(r)}>
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Undo
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button size="sm" className="h-8 gap-1.5 shrink-0 text-white" style={{ backgroundColor: color }} disabled={busy} onClick={() => doCheckIn(r)}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />} Check in
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Regulator / guest ──────────────────────────────────────────────────────

function GuestWalkIn({ eventId, onCheckedIn }: { eventId: string; onCheckedIn: (name: string) => void }) {
  const create = useCreateWalkInGuest();
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5" />
        Regulators, auditors, directors and press. They don&apos;t vote and don&apos;t count toward quorum.
      </p>
      <WalkInGuestForm
        key={formKey}
        submitLabel="Save & check in"
        busy={create.isPending}
        onSubmit={(body) =>
          create.mutate(
            { eventId, body },
            {
              onSuccess: (g) => {
                toast.success(`${g?.fullName ?? body.fullName} checked in`);
                onCheckedIn(g?.fullName ?? body.fullName);
                setFormKey((k) => k + 1); // clear the form for the next person
              },
              onError: (err) => toast.error(apiErrorOf(err).message ?? "Couldn't save the guest. Please try again."),
            },
          )
        }
      />
    </div>
  );
}

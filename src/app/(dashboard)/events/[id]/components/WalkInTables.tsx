"use client";

/**
 * Attendees → Walk-in shareholders / Walk-in guests. Each table has its own
 * search and .xlsx export. Viewers can read and export; undo / edit are hidden
 * for them (the backend refuses those writes with 403 anyway).
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Search, X, ChevronLeft, ChevronRight, Undo2, Pencil, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { popup } from "@/lib/popup-store";
import {
  useWalkInShareholders, useWalkInGuests, useUndoWalkInShareholder, useDeleteWalkInGuest, useUpdateWalkInGuest,
  exportWalkIns, apiErrorOf, GUEST_CATEGORIES, type WalkInGuest,
} from "@/api/client-walk-ins";
import { WalkInGuestForm } from "@/components/walk-ins/WalkInGuestForm";

const PAGE_SIZE = 50;

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const CATEGORY_LABEL = Object.fromEntries(GUEST_CATEGORIES.map((c) => [c.value, c.label])) as Record<string, string>;

// ── Shared bits ────────────────────────────────────────────────────────────

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-56 sm:w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete="off" className="pl-8 pr-8 h-8 text-xs" aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ExportButton({ eventId, kind }: { eventId: string; kind: "shareholders" | "guests" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="outline" className="gap-1.5" disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { await exportWalkIns(eventId, kind); }
        catch (e: any) { toast.error(e?.message || "Couldn't export. Please try again."); }
        finally { setBusy(false); }
      }}>
      {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…</> : <><Download className="h-3.5 w-3.5" /> Export</>}
    </Button>
  );
}

function Pager({ page, total, count, fetching, onPage }: { page: number; total: number; count: number; fetching: boolean; onPage: (p: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = page * PAGE_SIZE + 1;
  const to = page * PAGE_SIZE + count;
  return (
    <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
        Showing <span className="font-semibold text-[hsl(var(--foreground))]">{from.toLocaleString()}–{to.toLocaleString()}</span> of{" "}
        <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span>
        {fetching && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
      </p>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page === 0 || fetching} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums px-2">Page {page + 1} of {totalPages}</span>
        <Button size="sm" variant="outline" className="h-8 gap-1" disabled={page + 1 >= totalPages || fetching} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Empty({ searching, term, what }: { searching: boolean; term: string; what: string }) {
  return (
    <div className="py-14 text-center text-sm text-[hsl(var(--muted-foreground))]">
      <Users className="h-8 w-8 mx-auto mb-3 opacity-25" />
      {searching
        ? <p className="font-medium text-[hsl(var(--foreground))]">Nothing matches &ldquo;{term}&rdquo;</p>
        : <>
            <p className="font-medium text-[hsl(var(--foreground))]">No {what} yet</p>
            <p className="mt-1">They&apos;re added from QR Check-In → Walk-in at the gate.</p>
          </>}
    </div>
  );
}

// ── Walk-in shareholders ───────────────────────────────────────────────────

export function WalkInShareholdersTable({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");
  const term = useDebouncedValue(input.trim(), 350);
  const search = term.length >= 2 ? term : "";
  useEffect(() => { setPage(0); }, [search]);
  const q = useWalkInShareholders(eventId, page, PAGE_SIZE, search);
  const undo = useUndoWalkInShareholder();
  const rows = q.data?.content ?? [];
  const total = q.data?.totalElements ?? 0;

  function confirmUndo(id: string, name: string) {
    popup.confirm("Undo this check-in?", `${name} will be removed from attendance and the counts will drop back. They can be checked in again.`,
      () => undo.mutate({ eventId, walkInId: id }, {
        onSuccess: () => toast.success(`Check-in undone for ${name}`),
        onError: (err) => toast.error(apiErrorOf(err).message ?? "Couldn't undo the check-in."),
      }), undefined, "Undo check-in", "Cancel");
  }

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Walk-in Shareholders</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {search ? <>{total.toLocaleString()} matching &ldquo;{search}&rdquo;</> : <>{total.toLocaleString()} checked in at the gate · counted in attendance and quorum</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBox value={input} onChange={setInput} placeholder="Search name or CHN…" />
          <ExportButton eventId={eventId} kind="shareholders" />
        </div>
      </div>
      {q.isLoading ? (
        <div className="py-14 flex justify-center text-[hsl(var(--muted-foreground))]"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : q.isError ? (
        <p className="py-14 text-center text-sm text-[hsl(var(--destructive))]">Couldn&apos;t load walk-in shareholders.</p>
      ) : rows.length === 0 ? (
        <Empty searching={!!search} term={search} what="walk-in shareholders" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Shareholder</th>
                <th className="px-5 py-3 text-right">Units</th>
                <th className="px-5 py-3 text-left">Registered online</th>
                <th className="px-5 py-3 text-left">Checked in</th>
                <th className="px-5 py-3 text-left">By</th>
                {canEdit && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="attend-table-row">
                  <td className="px-5 py-3 max-w-[260px]">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{r.fullName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate font-mono">{r.chn ? `CHN ${r.chn}` : "—"}</p>
                    {r.notes && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate" title={r.notes}>{r.notes}</p>}
                  </td>
                  <td className="px-5 py-3 text-right text-sm tabular-nums">{typeof r.units === "number" ? r.units.toLocaleString() : "—"}</td>
                  <td className="px-5 py-3 text-sm">{r.registeredOnline ? "Yes" : "No"}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">{when(r.checkedInAt)}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] truncate max-w-[180px]" title={r.checkedInByEmail}>{r.checkedInByName ?? "—"}</td>
                  {canEdit && (
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" disabled={undo.isPending} onClick={() => confirmUndo(r.id, r.fullName)}>
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} count={rows.length} fetching={q.isFetching} onPage={setPage} />
    </Card>
  );
}

// ── Walk-in guests ─────────────────────────────────────────────────────────

export function WalkInGuestsTable({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const [page, setPage] = useState(0);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("");
  const term = useDebouncedValue(input.trim(), 350);
  const search = term.length >= 2 ? term : "";
  useEffect(() => { setPage(0); }, [search, category]);
  const q = useWalkInGuests(eventId, page, PAGE_SIZE, search, category);
  const del = useDeleteWalkInGuest();
  const update = useUpdateWalkInGuest();
  const [editing, setEditing] = useState<WalkInGuest | null>(null);
  const rows = q.data?.content ?? [];
  const total = q.data?.totalElements ?? 0;

  function confirmUndo(g: WalkInGuest) {
    popup.confirm("Remove this guest?", `${g.fullName}'s check-in will be undone and removed from the guest list.`,
      () => del.mutate({ eventId, guestId: g.id }, {
        onSuccess: () => toast.success(`Check-in undone for ${g.fullName}`),
        onError: (err) => toast.error(apiErrorOf(err).message ?? "Couldn't undo the check-in."),
      }), undefined, "Undo check-in", "Cancel");
  }

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Walk-in Guests</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {search ? <>{total.toLocaleString()} matching &ldquo;{search}&rdquo;</> : <>{total.toLocaleString()} regulators and guests · not counted in quorum</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category" wrapperClassName="w-36" className="h-8 text-xs">
            <option value="">All categories</option>
            {GUEST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </NativeSelect>
          <SearchBox value={input} onChange={setInput} placeholder="Search name or organisation…" />
          <ExportButton eventId={eventId} kind="guests" />
        </div>
      </div>
      {q.isLoading ? (
        <div className="py-14 flex justify-center text-[hsl(var(--muted-foreground))]"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : q.isError ? (
        <p className="py-14 text-center text-sm text-[hsl(var(--destructive))]">Couldn&apos;t load walk-in guests.</p>
      ) : rows.length === 0 ? (
        <Empty searching={!!search || !!category} term={search || CATEGORY_LABEL[category] || ""} what="walk-in guests" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Guest</th>
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-5 py-3 text-left">Organisation</th>
                <th className="px-5 py-3 text-left">Contact</th>
                <th className="px-5 py-3 text-left">Checked in</th>
                <th className="px-5 py-3 text-left">By</th>
                {canEdit && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="attend-table-row">
                  <td className="px-5 py-3 max-w-[220px]">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{g.fullName}</p>
                    {g.designation && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{g.designation}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]">
                      {CATEGORY_LABEL[g.category] ?? g.category}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--foreground))] max-w-[220px] truncate" title={g.organisation}>{g.organisation}</td>
                  <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))] max-w-[200px]">
                    {g.phone && <p className="truncate">{g.phone}</p>}
                    {g.email && <p className="truncate">{g.email}</p>}
                    {!g.phone && !g.email && "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">{when(g.checkedInAt)}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] truncate max-w-[160px]" title={g.checkedInByEmail}>{g.checkedInByName ?? "—"}</td>
                  {canEdit && (
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => setEditing(g)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" disabled={del.isPending} onClick={() => confirmUndo(g)}>
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} count={rows.length} fetching={q.isFetching} onPage={setPage} />

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Correct guest details</DialogTitle></DialogHeader>
          {editing && (
            <WalkInGuestForm
              key={editing.id}
              initial={editing}
              submitLabel="Save changes"
              busy={update.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={(body) => update.mutate({ eventId, guestId: editing.id, body }, {
                onSuccess: () => { toast.success("Guest details updated"); setEditing(null); },
                onError: (err) => toast.error(apiErrorOf(err).message ?? "Couldn't save the changes."),
              })}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

"use client";
import { useState } from "react";
import { PlusCircle, Trash2, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { toast } from "sonner";
import {
  useClientEventAgenda,
  useAddAgendaItem,
  useUpdateAgendaItem,
  useDeleteAgendaItem,
} from "@/api/client-events";
import { useAddResolution } from "@/api/client-votes";
import type { LocalAgendaItem } from "./types";

let _uid = 0;
const uid = () => `ag_${++_uid}`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgmResolution {
  id:                  string;
  title:               string;
  description?:        string;
  isSpecialResolution?: boolean;
  specialResolution?:  boolean;
  order?:              number;
}

/** Unsaved row being composed in the AGM resolution form */
interface AgmNewRow {
  id:                string;
  title:             string;
  description:       string;
  specialResolution: boolean;
}

interface Props {
  eventId:        string;
  isAGM:          boolean;
  /** Pre-configured resolutions from agmConfig — passed directly from the API response */
  agmResolutions?: AgmResolution[];
  /** Local state items — used only for non-AGM agenda rows before persisting */
  agendaItems:    LocalAgendaItem[];
  setAgendaItems: React.Dispatch<React.SetStateAction<LocalAgendaItem[]>>;
  /** When true, all write actions (add, edit, delete) are hidden */
  isSuperAdmin?:  boolean;
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide ${className}`}>
      {children}
    </label>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EventResolutionsTab({
  eventId, isAGM, agmResolutions = [], agendaItems, setAgendaItems, isSuperAdmin = false,
}: Props) {

  // ── AGM resolution state (POST /api/v1/client/votes/{eventId}/resolutions) ──
  const [agmNewRows, setAgmNewRows] = useState<AgmNewRow[]>([]);
  const addResolutionMutation = useAddResolution();

  function addAgmRow() {
    setAgmNewRows((prev) => [...prev, { id: uid(), title: "", description: "", specialResolution: false }]);
  }
  function removeAgmRow(id: string) {
    setAgmNewRows((prev) => prev.filter((r) => r.id !== id));
  }
  function updateAgmRow(id: string, field: keyof AgmNewRow, val: string | boolean) {
    setAgmNewRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: val } : r));
  }
  function persistAgmRow(row: AgmNewRow) {
    if (!row.title.trim()) {
      toast.error("Title is required before saving.");
      return;
    }
    addResolutionMutation.mutate(
      {
        eventId,
        data: {
          title:             row.title.trim(),
          description:       row.description.trim() || undefined,
          specialResolution: row.specialResolution,
        },
      },
      { onSuccess: () => setAgmNewRows((prev) => prev.filter((r) => r.id !== row.id)) }
    );
  }

  // ── Non-AGM agenda state (existing agenda endpoint) ───────────────────────
  const { data: serverItems = [], isLoading } = useClientEventAgenda(eventId);
  const addMutation    = useAddAgendaItem();
  const updateMutation = useUpdateAgendaItem();
  const deleteMutation = useDeleteAgendaItem();

  const newUserRows = agendaItems.filter((x) => x.id.startsWith("ag_"));

  function persistAgendaItem(item: LocalAgendaItem) {
    if (!item.title.trim()) {
      toast.error("Title is required before saving.");
      return;
    }
    addMutation.mutate(
      { eventId, item: { time: item.time ?? "", title: item.title, speaker: item.speaker ?? undefined } },
      {
        onSuccess: () => {
          setAgendaItems((a) => a.filter((x) => x.id !== item.id));
          toast.success("Agenda item saved.");
        },
      }
    );
  }
  function addLocalRow() {
    setAgendaItems((a) => [...a, { id: uid(), time: "", title: "", speaker: "" }]);
  }
  function removeLocalRow(id: string) {
    setAgendaItems((a) => a.filter((x) => x.id !== id));
  }
  function updateLocalRow(id: string, field: keyof LocalAgendaItem, val: string) {
    setAgendaItems((a) => a.map((x) => (x.id === id ? { ...x, [field]: val } : x)));
  }

  // ── Loading state (only relevant for non-AGM agenda) ─────────────────────
  if (!isAGM && isLoading) {
    return (
      <Card className="attend-card p-8">
        <Loader variant="inline" text="Loading agenda…" />
      </Card>
    );
  }

  // ── Sort agmConfig resolutions ────────────────────────────────────────────
  const sortedResolutions = [...agmResolutions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ──────────────────────────────────────────────────────────────────────────
  // AGM view
  // ──────────────────────────────────────────────────────────────────────────
  if (isAGM) {
    const isEmpty = sortedResolutions.length === 0 && agmNewRows.length === 0;

    return (
      <Card className="attend-card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Resolutions</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Each resolution will be voted on individually. Voting is initiated from the Live Control Room.
            </p>
          </div>
          {!isSuperAdmin && (
            <Button size="sm" variant="outline" onClick={addAgmRow} className="gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />
              Add Resolution
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3">

          {/* Persisted resolutions from agmConfig */}
          {sortedResolutions.map((res, idx) => {
            const isSpecial = res.isSpecialResolution ?? res.specialResolution ?? false;
            return (
              <div
                key={res.id}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="h-6 w-6 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {res.order ?? idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-snug">
                        {res.title}
                      </p>
                      {res.description && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">
                          {res.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSpecial ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                      <ShieldCheck className="h-3 w-3" /> Special
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                      <CheckCircle2 className="h-3 w-3" /> Ordinary
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Unsaved new resolution rows */}
          {!isSuperAdmin && agmNewRows.map((row, idx) => (
            <div
              key={row.id}
              className="rounded-xl border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.02)] p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[hsl(var(--primary))]">
                  NEW RES. {sortedResolutions.length + idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeAgmRow(row.id)}
                  className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <Label className="mb-1.5">Resolution title <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Adoption of Financial Statements"
                  value={row.title}
                  onChange={(e) => updateAgmRow(row.id, "title", e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-1.5">Description <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
                <textarea
                  rows={2}
                  placeholder="Additional context for shareholders…"
                  value={row.description}
                  onChange={(e) => updateAgmRow(row.id, "description", e.target.value)}
                  className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={row.specialResolution}
                  onChange={(e) => updateAgmRow(row.id, "specialResolution", e.target.checked)}
                  className="h-4 w-4 rounded border-[hsl(var(--border))] accent-amber-600"
                />
                <span className="text-sm text-[hsl(var(--foreground))]">
                  Special resolution{" "}
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">(requires 75% majority)</span>
                </span>
              </label>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  disabled={addResolutionMutation.isPending}
                  onClick={() => persistAgmRow(row)}
                >
                  {addResolutionMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  Save Resolution
                </Button>
              </div>
            </div>
          ))}

          {isEmpty && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] py-6 text-center">
              No resolutions yet. Add resolutions that shareholders will vote on.
            </p>
          )}
        </div>
      </Card>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Non-AGM agenda view (unchanged)
  // ──────────────────────────────────────────────────────────────────────────
  const allItems = [...serverItems, ...newUserRows];

  return (
    <Card className="attend-card p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Agenda Items</h2>
        {!isSuperAdmin && (
          <Button size="sm" variant="outline" onClick={addLocalRow} className="gap-1.5">
            <PlusCircle className="h-3.5 w-3.5" />
            Add Item
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">

        {/* Persisted agenda items */}
        {serverItems.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-2">
              <Label className="mb-1.5">Time</Label>
              <Input
                placeholder="10:00 AM"
                defaultValue={item.time}
                readOnly={isSuperAdmin}
                className={isSuperAdmin ? "opacity-70 cursor-default" : ""}
                onBlur={(e) =>
                  !isSuperAdmin && item.id &&
                  updateMutation.mutate({ eventId, itemId: item.id, data: { time: e.target.value } })
                }
              />
            </div>
            <div className={isSuperAdmin ? "col-span-5" : "col-span-5"}>
              <Label className="mb-1.5">Title</Label>
              <Input
                placeholder="Agenda item title"
                defaultValue={item.title}
                readOnly={isSuperAdmin}
                className={isSuperAdmin ? "opacity-70 cursor-default" : ""}
                onBlur={(e) =>
                  !isSuperAdmin && item.id &&
                  updateMutation.mutate({ eventId, itemId: item.id, data: { title: e.target.value } })
                }
              />
            </div>
            <div className={isSuperAdmin ? "col-span-5" : "col-span-4"}>
              <Label className="mb-1.5">Speaker (optional)</Label>
              <Input
                placeholder="Speaker name"
                defaultValue={item.speaker ?? ""}
                readOnly={isSuperAdmin}
                className={isSuperAdmin ? "opacity-70 cursor-default" : ""}
                onBlur={(e) =>
                  !isSuperAdmin && item.id &&
                  updateMutation.mutate({ eventId, itemId: item.id, data: { speaker: e.target.value } })
                }
              />
            </div>
            {!isSuperAdmin && (
              <div className="col-span-1 flex justify-center pb-1">
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => item.id && deleteMutation.mutate({ eventId, itemId: item.id })}
                  className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  {deleteMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Unsaved new agenda rows */}
        {!isSuperAdmin && newUserRows.map((item, idx) => (
          <div
            key={item.id}
            className="grid grid-cols-12 gap-2 items-end border border-[hsl(var(--primary)/0.2)] rounded-lg p-2 bg-[hsl(var(--primary)/0.02)]"
          >
            <div className="col-span-2">
              <Label className="mb-1.5">Time</Label>
              <Input
                placeholder="10:00 AM"
                value={item.time}
                onChange={(e) => updateLocalRow(item.id, "time", e.target.value)}
              />
            </div>
            <div className="col-span-5">
              <Label className="mb-1.5">Title</Label>
              <Input
                placeholder="Agenda item title"
                value={item.title}
                onChange={(e) => updateLocalRow(item.id, "title", e.target.value)}
              />
            </div>
            <div className="col-span-3">
              <Label className="mb-1.5">Speaker</Label>
              <Input
                placeholder="Speaker name"
                value={item.speaker ?? ""}
                onChange={(e) => updateLocalRow(item.id, "speaker", e.target.value)}
              />
            </div>
            <div className="col-span-1 flex flex-col gap-1 pb-1 items-center">
              <button
                type="button"
                onClick={() => persistAgendaItem(item)}
                disabled={addMutation.isPending}
                className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline disabled:opacity-40"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => removeLocalRow(item.id)}
                className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        {allItems.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] py-6 text-center">
            No agenda items yet. Click &quot;Add Item&quot; to start.
          </p>
        )}
      </div>
    </Card>
  );
}

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
import type { LocalAgendaItem } from "./types";

let _uid = 0;
const uid = () => `ag_${++_uid}`;

export interface AgmResolution {
  id:                  string;
  title:               string;
  description?:        string;
  isSpecialResolution?: boolean;
  order?:              number;
}

interface Props {
  eventId:        string;
  isAGM:          boolean;
  /** Pre-configured resolutions from agmConfig — passed directly from the API response */
  agmResolutions?: AgmResolution[];
  /** Local state items — used only for unsaved new rows before persisting */
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

export function EventResolutionsTab({ eventId, isAGM, agmResolutions = [], agendaItems, setAgendaItems, isSuperAdmin = false }: Props) {
  // Live data from server (agenda endpoint)
  const { data: serverItems = [], isLoading } = useClientEventAgenda(eventId);

  // Sort agmConfig resolutions by `order` so they appear in the right sequence
  const sortedResolutions = [...agmResolutions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Only truly new user-added rows need the editable form
  const newUserRows = agendaItems.filter((x) => x.id.startsWith("ag_"));

  // Combine server-persisted agenda items with user-added unsaved rows
  const allItems = [...serverItems, ...newUserRows];

  const addMutation    = useAddAgendaItem();
  const updateMutation = useUpdateAgendaItem();
  const deleteMutation = useDeleteAgendaItem();

  /** Save a local (unsaved) item to the server */
  function persistNewItem(item: LocalAgendaItem) {
    if (!item.title.trim()) {
      toast.error("Title is required before saving.");
      return;
    }
    addMutation.mutate(
      { eventId, item: { time: item.time ?? "", title: item.title, speaker: item.speaker ?? undefined } },
      {
        onSuccess: () => {
          // Remove the local temp row — server will return it via invalidation
          setAgendaItems((a) => a.filter((x) => x.id !== item.id));
          toast.success(isAGM ? "Resolution saved." : "Agenda item saved.");
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

  if (isLoading) {
    return (
      <Card className="attend-card p-8">
        <Loader variant="inline" text="Loading agenda…" />
      </Card>
    );
  }

  return (
    <Card className="attend-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            {isAGM ? "Resolutions" : "Agenda Items"}
          </h2>
          {isAGM && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Each resolution will be voted on individually. Voting is initiated from the Live Control Room.
            </p>
          )}
        </div>
        {!isSuperAdmin && (
          <Button size="sm" variant="outline" onClick={addLocalRow} className="gap-1.5">
            <PlusCircle className="h-3.5 w-3.5" />
            {isAGM ? "Add Resolution" : "Add Item"}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">

        {/* ── agmConfig resolutions — directly from API, always up-to-date ── */}
        {sortedResolutions.map((res, idx) => (
          <div
            key={res.id}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {/* Numbered circle */}
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
              {/* Resolution type badge */}
              {res.isSpecialResolution ? (
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
        ))}

        {/* Divider between pre-configured resolutions and editable agenda rows */}
        {sortedResolutions.length > 0 && allItems.length > 0 && (
          <div className="border-t border-[hsl(var(--border))] my-1" />
        )}

        {/* ── Persisted server items ── */}
        {serverItems.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
            {isAGM ? (
              <div className="col-span-2 flex items-center pb-1">
                <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">RES. {idx + 1}</span>
              </div>
            ) : (
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
            )}
            <div className={isAGM ? (isSuperAdmin ? "col-span-12" : "col-span-9") : "col-span-5"}>
              <Label className="mb-1.5">{isAGM ? "Resolution title" : "Title"}</Label>
              <Input
                placeholder={isAGM ? "e.g. Adoption of Financial Statements" : "Agenda item title"}
                defaultValue={item.title}
                readOnly={isSuperAdmin}
                className={isSuperAdmin ? "opacity-70 cursor-default" : ""}
                onBlur={(e) =>
                  !isSuperAdmin && item.id &&
                  updateMutation.mutate({ eventId, itemId: item.id, data: { title: e.target.value } })
                }
              />
              {isAGM && !isSuperAdmin && (
                <div className="mt-2">
                  <Label className="mb-1.5">Description <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
                  <textarea
                    rows={2}
                    placeholder="Additional context for shareholders…"
                    defaultValue={item.speaker ?? ""}
                    className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
                    onBlur={(e) =>
                      item.id &&
                      updateMutation.mutate({ eventId, itemId: item.id, data: { speaker: e.target.value } })
                    }
                  />
                </div>
              )}
              {isAGM && isSuperAdmin && item.speaker && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 leading-relaxed">{item.speaker}</p>
              )}
            </div>
            {!isAGM && (
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
            )}
            {!isSuperAdmin && (
              <div className="col-span-1 flex justify-center pb-1">
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => item.id && deleteMutation.mutate({ eventId, itemId: item.id })}
                  className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* ── Unsaved local rows (user-added, not yet persisted) — hidden for super_admin ── */}
        {!isSuperAdmin && newUserRows.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-12 gap-2 items-end border border-[hsl(var(--primary)/0.2)] rounded-lg p-2 bg-[hsl(var(--primary)/0.02)]">
            {isAGM ? (
              <div className="col-span-2 flex items-center pb-1">
                <span className="text-xs font-bold text-[hsl(var(--primary))]">NEW {serverItems.length + idx + 1}</span>
              </div>
            ) : (
              <div className="col-span-2">
                <Label className="mb-1.5">Time</Label>
                <Input placeholder="10:00 AM" value={item.time} onChange={(e) => updateLocalRow(item.id, "time", e.target.value)} />
              </div>
            )}
            <div className={isAGM ? "col-span-8" : "col-span-5"}>
              <Label className="mb-1.5">{isAGM ? "Resolution title" : "Title"}</Label>
              <Input
                placeholder={isAGM ? "e.g. Adoption of Financial Statements" : "Agenda item title"}
                value={item.title}
                onChange={(e) => updateLocalRow(item.id, "title", e.target.value)}
              />
              {isAGM && (
                <div className="mt-2">
                  <Label className="mb-1.5">Description <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]">(optional)</span></Label>
                  <textarea
                    rows={2}
                    placeholder="Additional context for shareholders…"
                    value={item.speaker ?? ""}
                    onChange={(e) => updateLocalRow(item.id, "speaker", e.target.value)}
                    className="flex w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
                  />
                </div>
              )}
            </div>
            {!isAGM && (
              <div className="col-span-3">
                <Label className="mb-1.5">Speaker</Label>
                <Input placeholder="Speaker name" value={item.speaker ?? ""} onChange={(e) => updateLocalRow(item.id, "speaker", e.target.value)} />
              </div>
            )}
            {/* Save unsaved row */}
            <div className="col-span-1 flex flex-col gap-1 pb-1 items-center">
              <button
                type="button"
                onClick={() => persistNewItem(item)}
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

        {sortedResolutions.length === 0 && allItems.length === 0 && (
          <p className="text-sm text-[hsl(var(--muted-foreground))] py-6 text-center">
            {isAGM
              ? "No resolutions yet. Add resolutions that shareholders will vote on."
              : "No agenda items yet. Click \"Add Item\" to start."}
          </p>
        )}
      </div>
    </Card>
  );
}

"use client";
import { useState } from "react";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
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

interface Props {
  eventId:       string;
  isAGM:         boolean;
  /** Local state items — used only for unsaved new rows before persisting */
  agendaItems:   LocalAgendaItem[];
  setAgendaItems: React.Dispatch<React.SetStateAction<LocalAgendaItem[]>>;
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide ${className}`}>
      {children}
    </label>
  );
}

export function EventResolutionsTab({ eventId, isAGM, agendaItems, setAgendaItems }: Props) {
  // Live data from server
  const { data: serverItems = [], isLoading } = useClientEventAgenda(eventId);

  // Merge server items with any local-only (unsaved) additions
  // Server items have a real UUID; local ones have the `ag_` prefix
  const allItems = [
    ...serverItems,
    ...agendaItems.filter((local) => local.id.startsWith("ag_")),
  ];

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
        <Button size="sm" variant="outline" onClick={addLocalRow} className="gap-1.5">
          <PlusCircle className="h-3.5 w-3.5" />
          {isAGM ? "Add Resolution" : "Add Item"}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
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
                  onBlur={(e) =>
                    item.id &&
                    updateMutation.mutate({ eventId, itemId: item.id, data: { time: e.target.value } })
                  }
                />
              </div>
            )}
            <div className={isAGM ? "col-span-9" : "col-span-5"}>
              <Label className="mb-1.5">{isAGM ? "Resolution title" : "Title"}</Label>
              <Input
                placeholder={isAGM ? "e.g. Adoption of Financial Statements" : "Agenda item title"}
                defaultValue={item.title}
                onBlur={(e) =>
                  item.id &&
                  updateMutation.mutate({ eventId, itemId: item.id, data: { title: e.target.value } })
                }
              />
            </div>
            {!isAGM && (
              <div className="col-span-4">
                <Label className="mb-1.5">Speaker (optional)</Label>
                <Input
                  placeholder="Speaker name"
                  defaultValue={item.speaker ?? ""}
                  onBlur={(e) =>
                    item.id &&
                    updateMutation.mutate({ eventId, itemId: item.id, data: { speaker: e.target.value } })
                  }
                />
              </div>
            )}
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
          </div>
        ))}

        {/* ── Unsaved local rows ── */}
        {agendaItems.filter((x) => x.id.startsWith("ag_")).map((item, idx) => (
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

        {allItems.length === 0 && (
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

"use client";
import { useState } from "react";
import { Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  usePublishEvent,
  useGoLiveEvent,
  useEndEvent,
  useCancelEvent,
  useUpdateEventInfo,
} from "@/api/client-events";

interface Props {
  eventId:        string;
  title:          string;
  organiser:      string;
  description?:   string;
  currentStatus:  string;
  onStatusChange: (status: string) => void;
}

export function EventSettingsTab({
  eventId,
  title: initialTitle,
  organiser,
  description: initialDescription = "",
  currentStatus,
  onStatusChange,
}: Props) {
  const [titleVal, setTitleVal]   = useState(initialTitle);
  const [descVal,  setDescVal]    = useState(initialDescription);

  // Lifecycle mutations — all call real API
  const publishMutation  = usePublishEvent();
  const goLiveMutation   = useGoLiveEvent();
  const endMutation      = useEndEvent();
  const cancelMutation   = useCancelEvent();
  const updateInfoMutation = useUpdateEventInfo();

  const anyLifecyclePending =
    publishMutation.isPending ||
    goLiveMutation.isPending  ||
    endMutation.isPending     ||
    cancelMutation.isPending;

  function handleLifecycle(
    status: "published" | "live" | "ended" | "cancelled",
    mutation: { mutate: (id: string, opts?: any) => void; isPending: boolean }
  ) {
    mutation.mutate(eventId, {
      onSuccess: () => onStatusChange(status),
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Event information */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Event Information</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">
              Event Title
            </label>
            <Input
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              placeholder="Event title"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">
              Description
            </label>
            <textarea
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              rows={3}
              placeholder="Event description (optional)"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2">
              Organiser
            </label>
            <Input value={organiser} readOnly className="opacity-70 cursor-not-allowed" />
          </div>
          <Button
            size="sm"
            className="self-start"
            disabled={updateInfoMutation.isPending || !titleVal.trim()}
            onClick={() =>
              updateInfoMutation.mutate({
                id:   eventId,
                data: { title: titleVal.trim(), description: descVal.trim() || undefined },
              })
            }
          >
            {updateInfoMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Card>

      {/* Status controls */}
      <Card className="attend-card p-5">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Status Controls</h2>
        <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
          {[
            {
              label:    "Publish Event",
              desc:     "Make event visible and open RSVPs",
              action:   "Publish",
              status:   "published" as const,
              mutation: publishMutation,
              disabled: ["published", "live", "ended", "cancelled"].includes(currentStatus),
            },
            {
              label:    "Go Live",
              desc:     "Start the live stream and event",
              action:   "Go Live",
              status:   "live" as const,
              mutation: goLiveMutation,
              disabled: ["draft", "live", "ended", "cancelled"].includes(currentStatus),
            },
            {
              label:    "End Event",
              desc:     "Mark event as concluded",
              action:   "End Event",
              status:   "ended" as const,
              mutation: endMutation,
              disabled: ["draft", "published", "ended", "cancelled"].includes(currentStatus),
            },
          ].map(({ label, desc, action, status, mutation, disabled }) => (
            <div key={label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{desc}</p>
              </div>
              <Button
                size="sm"
                variant={status === "live" ? "default" : "outline"}
                disabled={disabled || anyLifecyclePending}
                onClick={() => handleLifecycle(status, mutation)}
              >
                {status === "live" && <Radio className="h-3.5 w-3.5 mr-1.5" />}
                {mutation.isPending ? "…" : action}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="attend-card p-5" style={{ borderColor: "#fecaca" }}>
        <h2 className="font-semibold text-red-600 mb-4">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">Cancel Event</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              This will notify all registered attendees.
            </p>
          </div>
          <Button
            size="sm"
            variant="destructive"
            disabled={
              ["cancelled", "ended"].includes(currentStatus) ||
              anyLifecyclePending
            }
            onClick={() => handleLifecycle("cancelled", cancelMutation)}
          >
            {cancelMutation.isPending ? "Cancelling…" : "Cancel Event"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

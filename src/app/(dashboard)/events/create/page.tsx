"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Vote, Rocket, Lightbulb, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MODULES = [
  { id: "AGM", label: "AGM", desc: "Annual General Meeting", icon: Vote, color: "#1a6b3c", bg: "#edf7f2" },
  { id: "LAUNCH", label: "Launch", desc: "Product Launch Event", icon: Rocket, color: "#ea6c00", bg: "#fff4eb" },
  { id: "HACKATHON", label: "Hackathon", desc: "Innovation Challenge", icon: Lightbulb, color: "#7c22c9", bg: "#f8f0ff" },
  { id: "GENERAL", label: "General", desc: "General Event", icon: CalendarDays, color: "#1d4ed8", bg: "#eff5ff" },
];

const FORMATS = ["virtual", "hybrid", "in-person"];

export default function CreateEventPage() {
  const router = useRouter();
  const [module, setModule] = useState("");
  const [format, setFormat] = useState("virtual");
  const [title, setTitle] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [venue, setVenue] = useState("");
  const [capacity, setCapacity] = useState("");
  const [rsvpDeadline, setRsvpDeadline] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/events");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Create Event</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Configure and publish a new event on the Attend platform</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card className="attend-card p-6">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">Event Details</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5">Select a module type and fill in the basic details</p>

          <div className="mb-5">
            <Label className="mb-3 block attend-section-title">Module Type</Label>
            <div className="grid grid-cols-4 gap-3">
              {MODULES.map((m) => {
                const Icon = m.icon;
                const selected = module === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModule(m.id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-xl border-2 p-4 transition-all text-left",
                      selected ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)]" : "border-[hsl(var(--border))] hover:border-[hsl(var(--ring)/0.4)]"
                    )}
                  >
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: m.bg }}>
                      <Icon className="h-5 w-5" style={{ color: m.color }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{m.label}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="title" className="mb-2 block">Event Title</Label>
              <Input
                id="title"
                placeholder="e.g. Zenith Bank Plc — 2026 Annual General Meeting"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="organiser" className="mb-2 block">Organiser</Label>
              <Input
                id="organiser"
                placeholder="e.g. Zenith Bank Plc"
                value={organiser}
                onChange={(e) => setOrganiser(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="description" className="mb-2 block">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the event"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="attend-card p-6">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">Schedule</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5">Set the date, time, and delivery format for this event</p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="date" className="mb-2 block">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="start" className="mb-2 block">Start Time</Label>
              <Input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="end" className="mb-2 block">End Time</Label>
              <Input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="mt-4">
            <Label className="mb-3 block attend-section-title">Format</Label>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    "px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-all",
                    format === f
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] text-[hsl(var(--primary))]"
                      : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring)/0.3)]"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {(format === "hybrid" || format === "in-person") && (
            <div className="mt-4">
              <Label htmlFor="venue" className="mb-2 block">
                <MapPin className="h-3.5 w-3.5 inline mr-1" />
                Venue Address
              </Label>
              <Input
                id="venue"
                placeholder="e.g. Civic Centre, Victoria Island, Lagos"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            </div>
          )}
        </Card>

        <Card className="attend-card p-6">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">Capacity & Registration</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5">Control attendance limits and registration windows</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="capacity" className="mb-2 block">Maximum Capacity</Label>
              <Input
                id="capacity"
                type="number"
                placeholder="e.g. 5000"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">Leave blank for unlimited</p>
            </div>
            <div>
              <Label htmlFor="rsvpDeadline" className="mb-2 block">RSVP Deadline</Label>
              <Input
                id="rsvpDeadline"
                type="date"
                value={rsvpDeadline}
                onChange={(e) => setRsvpDeadline(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/events")}>Cancel</Button>
          <Button type="submit">Create Event</Button>
        </div>
      </form>
    </div>
  );
}

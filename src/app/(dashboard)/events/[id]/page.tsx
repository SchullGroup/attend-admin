"use client";
import { use } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft, Radio, Calendar, Clock, MapPin, Users,
  Monitor, Users2, FileText, Vote, ShieldCheck,
} from "lucide-react";
import type { EventModule } from "@/lib/mock-data";

function VoteBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums w-20 text-right">{value.toLocaleString()}</span>
    </div>
  );
}

const FORMAT_ICON = { virtual: Monitor, hybrid: Users2, "in-person": MapPin };
const TABS = ["Overview", "Attendees", "Documents", "Vote Results"];

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { events, participants, documents, liveVotes } = useStore();
  const [tab, setTab] = useState("Overview");

  const event = events.find((e) => e.id === id);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Event not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">This event may have been removed.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/events")}>
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Button>
      </div>
    );
  }

  const FormatIcon = FORMAT_ICON[event.format];
  const fill = event.capacity ? Math.round((event.rsvpCount / event.capacity) * 100) : null;
  const eventDocs = documents.filter((d) => d.eventId === event.id);
  const isAGM = event.module === "AGM";
  const visibleTabs = isAGM ? TABS : TABS.filter((t) => t !== "Vote Results");

  return (
    <div>
      {/* Back + header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/events")}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Events
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ModuleBadge module={event.module as EventModule} />
              <StatusBadge status={event.status} />
              {event.status === "live" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] leading-tight">{event.title}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{event.organiser}</p>
          </div>
          {event.status === "live" && (
            <Link href="/events/live">
              <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                <Radio className="h-4 w-4" />
                Control Room
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-fit mb-5">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              tab === t
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "Overview" && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            {/* Stats strip */}
            <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
              {[
                { label: "RSVPs", value: event.rsvpCount.toLocaleString(), icon: Users, color: "#2563eb" },
                { label: "Capacity", value: event.capacity ? event.capacity.toLocaleString() : "Unlimited", icon: Users2, color: "#1a6b3c" },
                { label: "Fill Rate", value: fill !== null ? `${fill}%` : "—", icon: Radio, color: fill !== null && fill >= 80 ? "#dc2626" : "#f97316" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-3 px-5 py-4">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
                    <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Details card */}
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Event Details</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Calendar, label: "Date", value: formatDate(event.date) },
                  { icon: Clock, label: "Time", value: `${event.startTime} – ${event.endTime}` },
                  { icon: FormatIcon, label: "Format", value: event.format.charAt(0).toUpperCase() + event.format.slice(1) },
                  { icon: MapPin, label: "Venue", value: event.venue ?? "Virtual (no physical venue)" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]">
                    <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
                    </div>
                    <div>
                      <p className="attend-section-title">{label}</p>
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* RSVP fill bar */}
            {fill !== null && (
              <Card className="attend-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-[hsl(var(--foreground))]">Registration</h2>
                  <span className="text-sm font-semibold" style={{ color: event.color }}>{fill}% full</span>
                </div>
                <div className="h-3 w-full rounded-full bg-[hsl(var(--muted))]">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(fill, 100)}%`, backgroundColor: event.color }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>{event.rsvpCount.toLocaleString()} registered</span>
                  <span>{event.capacity?.toLocaleString()} capacity</span>
                </div>
              </Card>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Stakeholder</h2>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-sm shrink-0">
                  {event.organiser.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{event.organiser}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Event organiser</p>
                </div>
              </div>
            </Card>
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Documents</h2>
              {eventDocs.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No documents uploaded for this event.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {eventDocs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                      <span className="truncate text-[hsl(var(--foreground))]">{d.title}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{d.fileSize}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setTab("Documents")}
                className="mt-3 text-xs text-[hsl(var(--primary))] hover:underline"
              >
                View all →
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* Attendees */}
      {tab === "Attendees" && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Registered Participants</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{participants.length} participants on platform</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Participant</th>
                <th className="px-5 py-3 text-left">Phone</th>
                <th className="px-5 py-3 text-left">KYC</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Registered</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                        {p.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{p.fullName}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{p.phone}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.kycStatus} /></td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(p.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Documents */}
      {tab === "Documents" && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Event Documents</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{eventDocs.length} documents for this event</p>
          </div>
          {eventDocs.length === 0 ? (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No documents have been uploaded for this event.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Title</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Size</th>
                  <th className="px-5 py-3 text-left">Downloads</th>
                  <th className="px-5 py-3 text-left">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {eventDocs.map((d) => (
                  <tr key={d.id} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{d.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2.5 py-0.5 capitalize font-medium">
                        {d.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-mono text-[hsl(var(--muted-foreground))]">{d.fileSize}</td>
                    <td className="px-5 py-3 text-sm font-medium tabular-nums">{d.downloadCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(d.uploadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Vote Results (AGM only) */}
      {tab === "Vote Results" && (
        <div className="flex flex-col gap-4">
          {liveVotes.length === 0 ? (
            <Card className="attend-card p-12 text-center">
              <Vote className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-[hsl(var(--muted-foreground))]">No vote results available yet.</p>
            </Card>
          ) : (
            liveVotes.map((v, i) => {
              const total = v.for + v.against + v.abstain;
              return (
                <Card key={v.resolutionId} className="attend-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-xs font-bold text-[hsl(var(--muted-foreground))] mb-1">RESOLUTION {i + 1}</div>
                      <div className="text-base font-semibold text-[hsl(var(--foreground))]">{v.title}</div>
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                  {total > 0 ? (
                    <div className="flex flex-col gap-2.5 bg-[hsl(var(--muted)/0.4)] rounded-xl p-4">
                      <VoteBar label="For" value={v.for} total={total} color="#16a34a" />
                      <VoteBar label="Against" value={v.against} total={total} color="#dc2626" />
                      <VoteBar label="Abstain" value={v.abstain} total={total} color="#9ca3af" />
                      <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))]">
                        Total votes: <span className="font-semibold text-[hsl(var(--foreground))]">{total.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[hsl(var(--muted-foreground))] italic">Voting has not commenced for this resolution.</div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

"use client";
import { Vote, CheckCircle2, Users, BookOpen, Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import type { EventShim } from "./types";

interface Props {
  event:        EventShim;
  liveVotes:    any[];
  participants: any[];
}

export function EventPostAgmTab({ event, liveVotes, participants }: Props) {
  return (
    <div className="flex flex-col gap-5">
      {/* Summary strip */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {[
          { label: "Resolutions Passed", value: `${liveVotes.filter((v) => v.for > v.against).length} / ${liveVotes.length}`, icon: Vote, color: "#1a6b3c" },
          { label: "Total Votes Cast",   value: liveVotes.reduce((s, v) => s + v.for + v.against + v.abstain, 0).toLocaleString(), icon: CheckCircle2, color: "#111827" },
          { label: "Attendees Present",  value: event.rsvpCount.toLocaleString(), icon: Users, color: "#7c22c9" },
          { label: "Minutes Status",     value: "Draft", icon: BookOpen, color: "#d97706" },
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

      {/* Draft minutes */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Draft Minutes
          </h2>
          <div className="flex gap-2">
            <button onClick={() => toast.success("Minutes saved as draft")} className="px-3 py-1.5 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
              Save Draft
            </button>
            <button onClick={() => toast.success("Minutes finalised and sent to SEC filing queue")} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[hsl(var(--primary))] text-white hover:opacity-90 transition-opacity">
              Finalise & Distribute
            </button>
          </div>
        </div>
        <textarea
          rows={10}
          defaultValue={`MINUTES OF THE ANNUAL GENERAL MEETING\n\nHeld on ${new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${event.startTime}\n\nATTENDANCE: ${event.rsvpCount.toLocaleString()} shareholders present or represented.\n\nBUSINESS TRANSACTED\n1. ...\n`}
          className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
        />
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: "Vote Audit Log",    desc: "Timestamped record of every vote cast with voter ID",  icon: Vote,  action: "Export CSV" },
          { title: "Attendance Register", desc: "Verified attendees with KYC and share count",          icon: Users, action: "Export CSV" },
          { title: "Statutory Return",  desc: "SEC/CAC-compliant post-AGM filing document",            icon: Award, action: "Generate PDF" },
        ].map(({ title, desc, icon: Icon, action }) => (
          <div key={title} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="h-9 w-9 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-3">
              <Icon className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">{title}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-4">{desc}</div>
            <button onClick={() => toast.success(`${title} export started`)} className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
              <Download className="h-3.5 w-3.5" /> {action}
            </button>
          </div>
        ))}
      </div>

      {/* Certificates */}
      <Card className="attend-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
            <Award className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Attendance Certificates
          </h2>
          <Button size="sm" variant="outline" onClick={() => toast.success("Certificates sent to all verified attendees")}>
            Send All Certificates
          </Button>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--muted)/0.4)]">
          <CheckCircle2 className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
          <div>
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              {participants.filter((p) => p.kycStatus === "full").length} verified attendees eligible for certificates
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Certificates will be delivered to their document vault and email
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

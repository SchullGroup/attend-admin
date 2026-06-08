"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft, Building2, Mail, Globe, Hash,
  CalendarDays, FileText, Eye,
} from "lucide-react";
import type { EventModule } from "@/types/mock";

const PLAN_STYLE = {
  enterprise: { label: "Enterprise", color: "#166534", bg: "#dcfce7" },
  growth:     { label: "Growth",     color: "#374151", bg: "#dbeafe" },
  starter:    { label: "Starter",    color: "#6b7280", bg: "#f3f4f6" },
};

const STATUS_DOT = {
  active:    { dot: "#16a34a", label: "Active" },
  suspended: { dot: "#dc2626", label: "Suspended" },
  pending:   { dot: "#f59e0b", label: "Pending" },
};

export default function RegisterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { organisers, events, documents, enrollOrganiser, suspendOrganiser } = useStore();

  const organiser = organisers.find((s) => s.id === id);

  if (!organiser) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Register not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">This register may have been removed.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/registers")}>
          <ArrowLeft className="h-4 w-4" /> Back to Registers
        </Button>
      </div>
    );
  }

  const plan = PLAN_STYLE[organiser.plan as keyof typeof PLAN_STYLE];
  const statusInfo = STATUS_DOT[organiser.status as keyof typeof STATUS_DOT];
  const orgEvents = events.filter((e) => e.organiser === organiser.name);
  const orgDocs = documents.filter((d) => orgEvents.some((e) => e.id === d.eventId));
  const initials = organiser.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={() => router.push("/registers")}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Registers
      </button>

      {/* Profile header card — full width */}
      <Card className="attend-card p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <div
              className="h-16 w-16 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
              style={{ backgroundColor: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{organiser.name}</h1>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ color: plan.color, backgroundColor: plan.bg }}
                >
                  {plan.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                <span>{organiser.industry}</span>
                <span>·</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
                  <span>{statusInfo.label}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {organiser.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => suspendOrganiser(organiser.id)}
              >
                Suspend
              </Button>
            )}
            {organiser.status === "suspended" && (
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 border-green-200 hover:bg-green-50"
                onClick={() => enrollOrganiser(organiser.id)}
              >
                Reactivate
              </Button>
            )}
          </div>
        </div>

        {/* Detail fields in a horizontal row */}
        <div className="mt-5 pt-5 border-t border-[hsl(var(--border))] grid grid-cols-5 gap-4">
          {[
            { icon: Hash, label: "RC Number", value: organiser.rcNumber },
            { icon: Mail, label: "Contact Email", value: organiser.contactEmail },
            { icon: Building2, label: "Industry", value: organiser.industry },
            { icon: Globe, label: "Plan", value: plan.label },
            { icon: CalendarDays, label: "Enrolled", value: formatDate(organiser.enrolledAt) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="attend-section-title">{label}</p>
                <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] flex items-center gap-6">
          {[
            { label: "Events", value: orgEvents.length, color: "#374151" },
            { label: "Documents", value: orgDocs.length, color: "#111827" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</span>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Events table — full width */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Events</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{orgEvents.length} event{orgEvents.length !== 1 ? "s" : ""} created by this register</p>
        </div>
        {orgEvents.length === 0 ? (
          <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No events created yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Event</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="px-5 py-3 text-left">RSVPs</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {orgEvents.map((e) => (
                <tr key={e.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                      <div>
                        <ModuleBadge module={e.module as EventModule} />
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">{e.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(e.date)}</td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums">{e.rsvpCount.toLocaleString()}</td>
                  <td className="px-5 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-5 py-3">
                    <Link href={`/events/${e.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Documents table — full width */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Documents</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{orgDocs.length} document{orgDocs.length !== 1 ? "s" : ""} uploaded</p>
        </div>
        {orgDocs.length === 0 ? (
          <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No documents uploaded.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Title</th>
                <th className="px-5 py-3 text-left">Event</th>
                <th className="px-5 py-3 text-left">Size</th>
                <th className="px-5 py-3 text-left">Downloads</th>
                <th className="px-5 py-3 text-left">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {orgDocs.map((d) => (
                <tr key={d.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">{d.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{d.eventTitle}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{d.fileSize}</td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums">{d.downloadCount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(d.uploadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

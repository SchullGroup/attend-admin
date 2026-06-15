"use client";

import {
  Building2, Mail, Phone, Globe, Hash, CalendarDays, Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { formatDate } from "@/lib/utils";

interface EventStakeholderTabProps {
  stakeholderName?: string;
  stakeholderData: Record<string, any>;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
        {label}
      </p>
      <p className="text-sm text-[hsl(var(--foreground))]">{value}</p>
    </div>
  );
}

export function EventStakeholderTab({ stakeholderName, stakeholderData }: EventStakeholderTabProps) {
  const d = stakeholderData ?? {};

  // Organiser / register details — handle various API response shapes
  const name      = stakeholderName || d.organizerName || d.stakeholderName || d.registerName || d.companyName || "—";
  const email     = d.organizerEmail || d.stakeholderEmail || d.contactEmail || d.email || d.organizer?.email || "—";
  const phone     = d.organizerPhone || d.stakeholderPhone || d.phone || d.organizer?.phone || "—";
  const industry  = d.industry || d.organizer?.industry || null;
  const rcNumber  = d.rcNumber || d.organizer?.rcNumber || null;
  const website   = d.website || d.organizer?.website || null;
  const status    = d.organizerStatus || d.stakeholderStatus || d.status || null;
  const enrolledAt = d.enrolledAt || d.createdAt || null;

  const eventsCount  = d.eventsCount  ?? d.organizer?.eventsCount  ?? null;

  const logoUrl  = d.logoUrl ?? d.registerLogoUrl ?? d.branding?.logoUrl ?? null;
  const initials = name !== "—"
    ? name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="space-y-5">
      {/* Identity block */}
      <Card className="attend-card p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="h-14 w-14 rounded-2xl bg-[hsl(var(--primary)/0.08)] flex items-center justify-center text-base font-bold text-[hsl(var(--primary))] shrink-0 overflow-hidden border border-[hsl(var(--border))]">
            {logoUrl
              ? <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
              : initials
            }
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-[hsl(var(--foreground))] truncate">{name}</h2>
            {status && (
              <div className="mt-1">
                <StatusBadge status={status.toLowerCase()} />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[hsl(var(--border))] pt-5">
          {/* Contact */}
          {email !== "—" && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <Mail className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Email</p>
                <p className="text-sm text-[hsl(var(--foreground))]">{email}</p>
              </div>
            </div>
          )}

          {phone !== "—" && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <Phone className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Phone</p>
                <p className="text-sm text-[hsl(var(--foreground))]">{phone}</p>
              </div>
            </div>
          )}

          {industry && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Industry</p>
                <p className="text-sm text-[hsl(var(--foreground))]">{industry}</p>
              </div>
            </div>
          )}

          {rcNumber && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <Hash className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">RC Number</p>
                <p className="text-sm text-[hsl(var(--foreground))]">{rcNumber}</p>
              </div>
            </div>
          )}

          {website && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <Globe className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Website</p>
                <a href={website} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[hsl(var(--primary))] hover:underline">{website}</a>
              </div>
            </div>
          )}

          {enrolledAt && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <CalendarDays className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Enrolled</p>
                <p className="text-sm text-[hsl(var(--foreground))]">{formatDate(enrolledAt)}</p>
              </div>
            </div>
          )}

          {eventsCount !== null && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <Users className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Total Events</p>
                <p className="text-sm font-bold text-[hsl(var(--foreground))]">{eventsCount}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Empty state for when no extra organizer data is available */}
      {email === "—" && phone === "—" && !industry && !rcNumber && !website && !enrolledAt && (
        <div className="text-center py-10 text-[hsl(var(--muted-foreground))]">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No additional organizer details available</p>
          <p className="text-xs mt-1">Organizer: <span className="font-semibold text-[hsl(var(--foreground))]">{name}</span></p>
        </div>
      )}
    </div>
  );
}

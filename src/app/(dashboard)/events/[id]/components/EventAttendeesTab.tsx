"use client";

import Link from "next/link";
import { Users, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateCell } from "@/components/ui/date-cell";
import { useExportAttendees } from "@/api/client-events";

// ─── KYC Status badge ─────────────────────────────────────────────────────────

function KycBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  if (s === "full_kyc") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700">
        Full KYC
      </span>
    );
  }
  if (s === "pending_review") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700">
        Pending Review
      </span>
    );
  }
  if (s === "basic_kyc") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700">
        Basic KYC
      </span>
    );
  }
  if (!s || s === "no_kyc") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
        No KYC
      </span>
    );
  }
  // Unknown status — render as-is with neutral chip
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
      {status}
    </span>
  );
}

// ─── Account Status badge ─────────────────────────────────────────────────────

function AccountStatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  if (s === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
        Active
      </span>
    );
  }
  if (s === "suspended") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-600">
        Suspended
      </span>
    );
  }
  if (s === "pending") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700">
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
      {status || "—"}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  participants: any[];
  /** @deprecated Actions column removed — prop kept for call-site compatibility */
  suspendUser?: { mutate: (args: any) => void; isPending: boolean };
  eventId:      string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EventAttendeesTab({ participants, eventId }: Props) {
  const exportMutation = useExportAttendees();

  return (
    <Card className="attend-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Registered Participants</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {participants.length} participant{participants.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button
          size="sm" variant="outline" className="gap-1.5"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate(eventId)}
        >
          {exportMutation.isPending
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…</>
            : <><Download className="h-3.5 w-3.5" /> Export CSV</>
          }
        </Button>
      </div>

      {/* Empty state */}
      {participants.length === 0 ? (
        <div className="py-14 text-center text-sm text-[hsl(var(--muted-foreground))]">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-25" />
          <p className="font-medium text-[hsl(var(--foreground))]">No attendees yet</p>
          <p className="mt-1">Participants who register will appear here.</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Participant</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-left">KYC Status</th>
              <th className="px-5 py-3 text-left">Account Status</th>
              <th className="px-5 py-3 text-left">Date Registered</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, idx) => {
              const pid          = p.id ?? p.participantId ?? p.userId ?? String(idx);
              const fullName     = p.fullName ?? ([p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "—");
              const initials     = p.initials
                || fullName.split(" ").filter(Boolean).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                || "?";
              const kycStatus    = p.kycStatus || p.kycLevel || p.kyc?.status || "NO_KYC";
              const acctStatus   = p.status || p.accountStatus || "ACTIVE";
              const registeredAt = p.registeredAt || p.rsvpDate || p.joinedAt || p.createdAt;

              return (
                <tr key={pid} className="attend-table-row">

                  {/* Participant — avatar + name + email with overflow protection */}
                  <td className="px-5 py-3 max-w-[220px]">
                    <Link href={`/participants/${pid}`} className="flex items-center gap-2.5 group">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: p.avatarColor ? `${p.avatarColor}22` : "hsl(var(--primary)/0.1)",
                          color:           p.avatarColor ?? "hsl(var(--primary))",
                        }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate group-hover:underline">
                          {fullName}
                        </p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{p.email ?? "—"}</p>
                      </div>
                    </Link>
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {p.phone ?? "—"}
                  </td>

                  {/* KYC Status */}
                  <td className="px-5 py-3">
                    <KycBadge status={kycStatus} />
                  </td>

                  {/* Account Status */}
                  <td className="px-5 py-3">
                    <AccountStatusBadge status={acctStatus} />
                  </td>

                  {/* Date Registered */}
                  <td className="px-5 py-3">
                    <DateCell value={registeredAt} payload={p} />
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

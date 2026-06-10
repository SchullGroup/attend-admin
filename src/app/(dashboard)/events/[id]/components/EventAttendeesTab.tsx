"use client";
import Link from "next/link";
import { Users, Download, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { DateCell } from "@/components/ui/date-cell";
import { useExportAttendees } from "@/api/client-events";

interface Props {
  participants: any[];
  suspendUser:  { mutate: (args: any) => void; isPending: boolean };
  eventId:      string;
}

export function EventAttendeesTab({ participants, suspendUser, eventId }: Props) {
  const exportMutation = useExportAttendees();

  return (
    <Card className="attend-card overflow-hidden">
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
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, idx) => {
              const pid          = p.id ?? p.participantId ?? p.userId ?? String(idx);
              const fullName     = p.fullName ?? [p.firstName, p.lastName].filter(Boolean).join(" ") ?? p.name ?? "—";
              const initials     = p.initials || fullName.split(" ").filter(Boolean).map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
              const kycStatus    = p.kycStatus || p.kycLevel || p.kyc?.status || "NO_KYC";
              const acctStatus   = p.status || p.accountStatus || "ACTIVE";
              const registeredAt = p.registeredAt || p.rsvpDate || p.joinedAt || p.createdAt;
              const isSuspended  = acctStatus?.toUpperCase() === "SUSPENDED";
              return (
                <tr key={pid} className="attend-table-row">
                  <td className="px-5 py-3">
                    <Link href={`/participants/${pid}`} className="flex items-center gap-2.5 group">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: p.avatarColor ? `${p.avatarColor}22` : "hsl(var(--primary)/0.1)",
                          color: p.avatarColor ?? "hsl(var(--primary))",
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] group-hover:underline">{fullName}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.email ?? "—"}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{p.phone ?? "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={kycStatus?.toLowerCase?.()} /></td>
                  <td className="px-5 py-3"><StatusBadge status={acctStatus?.toLowerCase?.()} /></td>
                  <td className="px-5 py-3"><DateCell value={registeredAt} payload={p} /></td>
                  <td className="px-5 py-3 text-right">
                    {!isSuspended && (
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={suspendUser.isPending}
                        onClick={() => suspendUser.mutate({ userId: pid })}
                      >
                        <UserMinus className="h-3.5 w-3.5 mr-1" /> Suspend
                      </Button>
                    )}
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

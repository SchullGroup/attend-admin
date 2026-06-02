"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, Calendar, ShieldCheck, CalendarDays, ShieldOff } from "lucide-react";

function maskBVN(bvn?: string) {
  if (!bvn) return "Not provided";
  return bvn.slice(0, 3) + " **** " + bvn.slice(-3);
}

function maskCHN(chn?: string) {
  if (!chn) return "Not provided";
  return chn.slice(0, 3) + " **** " + chn.slice(-3);
}

export default function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { participants, suspendParticipant, restoreParticipant } = useStore();

  const participant = participants.find((p) => p.id === id);

  if (!participant) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">User not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">This user may not exist.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/participants")}>
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Button>
      </div>
    );
  }

  const initials = participant.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const KYC_LEVEL_DESC: Record<string, string> = {
    full: "Full KYC verified — BVN, NIN, and CHN confirmed.",
    basic: "Basic verification complete — email and phone confirmed.",
    pending: "KYC documents submitted and awaiting review.",
    none: "No identity verification has been completed.",
  };

  return (
    <div>
      <button
        onClick={() => router.push("/participants")}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-5 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Users
      </button>

      <div className="grid grid-cols-3 gap-5">
        {/* Profile card */}
        <div className="col-span-1 flex flex-col gap-4">
          <Card className="attend-card p-6 flex flex-col items-center text-center">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold mb-4"
              style={{ backgroundColor: "hsl(var(--primary)/0.12)", color: "hsl(var(--primary))" }}
            >
              {initials}
            </div>
            <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">{participant.fullName}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{participant.email}</p>
            <div className="flex items-center gap-2 mt-3">
              <StatusBadge status={participant.kycStatus} />
              <StatusBadge status={participant.status} />
            </div>
            <div className="mt-4 w-full border-t border-[hsl(var(--border))] pt-4">
              {participant.status === "suspended" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-green-700 border-green-200 hover:bg-green-50 gap-2"
                  onClick={() => restoreParticipant(participant.id)}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Restore Account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-2"
                  onClick={() => suspendParticipant(participant.id)}
                >
                  <ShieldOff className="h-3.5 w-3.5" /> Suspend Account
                </Button>
              )}
            </div>
          </Card>

          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Contact</h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))] truncate">{participant.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))]">{participant.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))]">Joined {formatDate(participant.registeredAt)}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right detail */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* KYC card */}
          <Card className="attend-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">KYC Verification</h2>
            </div>
            <div className="rounded-xl border border-[hsl(var(--border))] p-3 mb-4 flex items-start gap-3 bg-[hsl(var(--muted)/0.3)]">
              <StatusBadge status={participant.kycStatus} />
              <p className="text-sm text-[hsl(var(--muted-foreground))] flex-1">
                {KYC_LEVEL_DESC[participant.kycStatus]}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[hsl(var(--muted)/0.5)] p-4">
                <p className="attend-section-title mb-2">BVN</p>
                <p className="text-sm font-mono font-semibold text-[hsl(var(--foreground))]">{maskBVN(participant.bvn)}</p>
              </div>
              <div className="rounded-xl bg-[hsl(var(--muted)/0.5)] p-4">
                <p className="attend-section-title mb-2">CHN</p>
                <p className="text-sm font-mono font-semibold text-[hsl(var(--foreground))]">{maskCHN(participant.chn)}</p>
              </div>
              <div className="rounded-xl bg-[hsl(var(--muted)/0.5)] p-4">
                <p className="attend-section-title mb-2">NIN</p>
                <p className="text-sm font-mono font-semibold text-[hsl(var(--foreground))]">Not provided</p>
              </div>
            </div>
          </Card>

          {/* Activity */}
          <Card className="attend-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="h-4 w-4 text-[hsl(var(--primary))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Platform Activity</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                <p className="text-3xl font-bold tabular-nums text-[hsl(var(--foreground))]">{participant.eventsAttended}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Events attended</p>
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                <p className="text-3xl font-bold tabular-nums text-[hsl(var(--foreground))]">
                  {participant.kycStatus === "full" ? "3" : participant.kycStatus === "basic" ? "1" : "0"}
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Credentials verified</p>
              </div>
            </div>
          </Card>

          {/* Account info */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Account Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "Account ID", value: participant.id },
                { label: "Account Status", value: participant.status.charAt(0).toUpperCase() + participant.status.slice(1) },
                { label: "Registered", value: formatDate(participant.registeredAt) },
                { label: "KYC Level", value: participant.kycStatus.charAt(0).toUpperCase() + participant.kycStatus.slice(1) },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="attend-section-title">{label}</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

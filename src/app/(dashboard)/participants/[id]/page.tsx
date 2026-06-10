"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  CalendarDays,
  ShieldOff,
} from "lucide-react";
import { 
  useParticipantDetail, 
  useSuspendParticipant, 
  useReactivateParticipant 
} from "@/api/participants";

/**
 * Mask the middle of a submitted KYC credential value.
 * Only call this when the user HAS submitted KYC — returns "—" for empty/missing values.
 */
function maskValue(val?: string) {
  if (!val) return "—";
  return val.length > 6 ? val.slice(0, 3) + " **** " + val.slice(-3) : val;
}

export default function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  
  const { data, isLoading } = useParticipantDetail(id);
  const suspendMutation = useSuspendParticipant();
  const reactivateMutation = useReactivateParticipant();

  const handleSuspend = (id: string, name: string) => {
    popup.confirm(
      "Suspend Participant",
      `Are you sure you want to suspend ${name}?`,
      () => suspendMutation.mutate({ id, data: { reason: "Suspended by admin" } }),
      undefined,
      "Suspend",
      "Cancel"
    );
  };

  const handleReactivate = (id: string, name: string) => {
    popup.confirm(
      "Reactivate Participant",
      `Are you sure you want to reactivate ${name}?`,
      () => reactivateMutation.mutate(id),
    );
  };

  if (isLoading) {
    return <Loader variant="page" text="Loading User Details..." />;
  }

  // Rule 3: hook now returns res.data.data directly — no extra .data unwrap needed
  const participant = data;

  if (!participant) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
          User not found
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          This user may not exist or has been removed.
        </p>
        <Button
          variant="outline"
          className="mt-4 gap-2"
          onClick={() => router.push("/participants")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Button>
      </div>
    );
  }

  const isMutating = suspendMutation.isPending || reactivateMutation.isPending;

  return (
    <div className="relative">
      {isMutating && <Loader variant="overlay" text="Processing..." />}
      
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
              style={{
                backgroundColor: participant.avatarColor || "hsl(var(--primary)/0.12)",
                color: "hsl(var(--primary))",
              }}
            >
              {participant.initials}
            </div>
            <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">
              {participant.fullName}
            </h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {participant.email}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <StatusBadge status={participant.kycStatus} />
              <StatusBadge status={participant.accountStatus} />
            </div>
            <div className="mt-4 w-full border-t border-[hsl(var(--border))] pt-4">
              {participant.accountStatus === "SUSPENDED" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-green-700 border-green-200 hover:bg-green-50 gap-2"
                  onClick={() => handleReactivate(participant.id, participant.fullName)}
                  disabled={isMutating}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Restore Account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-2"
                  onClick={() => handleSuspend(participant.id, participant.fullName)}
                  disabled={isMutating}
                >
                  <ShieldOff className="h-3.5 w-3.5" /> Suspend Account
                </Button>
              )}
            </div>
          </Card>

          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">
              Contact
            </h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))] truncate">
                  {participant.email}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))]">
                  {participant.phone || "Not provided"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))]">
                  Joined {participant.joinedLabel || (participant.joinedAt ? formatDate(participant.joinedAt) : "N/A")}
                </span>
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
              <h2 className="font-semibold text-[hsl(var(--foreground))]">
                KYC Verification
              </h2>
            </div>
            <div className="rounded-xl border border-[hsl(var(--border))] p-3 mb-4 flex items-start gap-3 bg-[hsl(var(--muted)/0.3)]">
              <StatusBadge status={participant.kyc?.status || participant.kycStatus} />
              <p className="text-sm text-[hsl(var(--muted-foreground))] flex-1">
                {participant.kyc?.description || "Verification information unavailable."}
              </p>
            </div>
            {/* Only show masked credential tiles when the user has actually submitted KYC.
                NO_KYC users have no credentials — showing masked tiles would imply hidden data. */}
            {(() => {
              const hasKyc = participant.kycStatus?.toUpperCase() !== "NO_KYC"
                && (participant.kyc?.bvn || participant.kyc?.nin || participant.kyc?.chn);
              if (!hasKyc) {
                return (
                  <p className="text-sm text-[hsl(var(--muted-foreground))] italic">
                    No KYC credentials submitted.
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[hsl(var(--muted)/0.5)] p-4">
                    <p className="attend-section-title mb-2">BVN</p>
                    <p className="text-sm font-mono font-semibold text-[hsl(var(--foreground))]">
                      {maskValue(participant.kyc?.bvn)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[hsl(var(--muted)/0.5)] p-4">
                    <p className="attend-section-title mb-2">CHN</p>
                    <p className="text-sm font-mono font-semibold text-[hsl(var(--foreground))]">
                      {maskValue(participant.kyc?.chn)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[hsl(var(--muted)/0.5)] p-4">
                    <p className="attend-section-title mb-2">NIN</p>
                    <p className="text-sm font-mono font-semibold text-[hsl(var(--foreground))]">
                      {maskValue(participant.kyc?.nin)}
                    </p>
                  </div>
                </div>
              );
            })()}
          </Card>

          {/* Activity */}
          <Card className="attend-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="h-4 w-4 text-[hsl(var(--primary))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">
                Platform Activity
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                <p className="text-3xl font-bold tabular-nums text-[hsl(var(--foreground))]">
                  {participant.platformActivity?.eventsAttended || 0}
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Events attended
                </p>
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                <p className="text-3xl font-bold tabular-nums text-[hsl(var(--foreground))]">
                  {participant.platformActivity?.credentialsVerified || 0}
                </p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                  Credentials verified
                </p>
              </div>
            </div>
          </Card>

          {/* Account info */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">
              Account Information
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "Account ID", value: participant.accountInfo?.accountId || participant.id },
                {
                  label: "Account Status",
                  value: participant.accountInfo?.accountStatus || participant.accountStatus,
                },
                {
                  label: "Registered",
                  value: participant.accountInfo?.registeredLabel || (participant.accountInfo?.registeredAt ? formatDate(participant.accountInfo?.registeredAt) : "N/A"),
                },
                {
                  label: "KYC Level",
                  value: participant.accountInfo?.kycLevel || participant.kycLevel,
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="attend-section-title">{label}</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

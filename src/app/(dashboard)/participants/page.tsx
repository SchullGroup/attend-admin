"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, Shield, Users, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { formatDate } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";
import { 
  useParticipants, 
  useParticipantStats, 
  useSuspendParticipant, 
  useReactivateParticipant 
} from "@/api/participants";

const KYC_FILTERS = [
  { label: "All", value: "" },
  { label: "Full KYC", value: "FULL_KYC" },
  { label: "Basic KYC", value: "BASIC_KYC" },
  { label: "Pending", value: "PENDING" },
  { label: "No KYC", value: "NONE" },
  { label: "Rejected", value: "REJECTED" },
];

export default function ParticipantsPage() {
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data: statsData, isLoading: statsLoading } = useParticipantStats();
  const { data: participantsData, isLoading: participantsLoading } = useParticipants(search, kycFilter, "", page, 20);

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

  if (participantsLoading || statsLoading) {
    return <Loader variant="page" text="Loading Users..." />;
  }

  const isMutating = suspendMutation.isPending || reactivateMutation.isPending;

  const stats = statsData?.data || {};
  const participants = participantsData?.data?.participants || [];
  const totalPages = Math.ceil((participantsData?.data?.totalCount || 0) / (participantsData?.data?.size || 20));

  // Fallback map keys (could be totalParticipants, fullKyc, pendingKyc based on common spring boot naming)
  const totalUsers = stats.totalParticipants || stats.total || 0;
  const fullKYC = stats.fullKyc || stats.verified || 0;
  const pendingKYC = stats.pendingKyc || stats.pending || 0;

  return (
    <div className="relative">
      {isMutating && <Loader variant="overlay" text="Processing..." />}
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Users
        </h1>
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">
                {totalUsers}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Total Users
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-green-50 flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">
                {fullKYC}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Full KYC
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-yellow-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">
                {pendingKYC}
              </div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">
                Pending KYC
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 overflow-x-auto">
          {KYC_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setKycFilter(f.value);
                setPage(0);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                kycFilter === f.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">User</th>
              <th className="px-5 py-3 text-left">KYC Status</th>
              <th className="px-5 py-3 text-left">Registrations</th>
              <th className="px-5 py-3 text-left">Account Status</th>
              <th className="px-5 py-3 text-left">Joined</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="attend-table-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0"
                      style={{ backgroundColor: p.avatarColor || "hsl(var(--primary)/0.1)" }}
                    >
                      {p.initials}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[hsl(var(--foreground))]">
                        {p.fullName}
                      </div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        {p.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={p.kycStatus} />
                </td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">
                  {p.eventsAttended || 0}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={p.accountStatus} />
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {p.joinedLabel || (p.joinedAt ? formatDate(p.joinedAt) : "N/A")}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/participants/${p.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                      >
                        View
                      </Button>
                    </Link>
                    {p.accountStatus === "SUSPENDED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => handleReactivate(p.id, p.fullName)}
                        disabled={isMutating}
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleSuspend(p.id, p.fullName)}
                        disabled={isMutating}
                      >
                        <ShieldOff className="h-3 w-3 mr-1" />
                        Suspend
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {participants.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No users match your search.
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border)/0.6)]">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 0} 
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Page {page + 1} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= totalPages - 1} 
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

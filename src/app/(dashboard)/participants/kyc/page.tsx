"use client";
import { useState } from "react";
import { Check, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { formatDate } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";
import { 
  useKycQueue,
  useApproveKyc,
  useDeclineKyc
} from "@/api/participants";

const TABS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "FULL_KYC" },
  { label: "Rejected", value: "REJECTED" },
];

function maskValue(val?: string, maskedVal?: string) {
  if (maskedVal) return maskedVal;
  if (!val) return "—";
  return val.length > 6 ? val.slice(0, 3) + "****" + val.slice(-3) : val;
}

export default function KYCQueuePage() {
  const [tab, setTab] = useState("PENDING");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useKycQueue(tab, page, 20);
  
  const approveMutation = useApproveKyc();
  const declineMutation = useDeclineKyc();

  const handleApprove = (id: string, name: string) => {
    popup.confirm(
      "Approve KYC",
      `Are you sure you want to approve KYC for ${name}?`,
      () => approveMutation.mutate({ id, data: { notes: "Verified by admin" } })
    );
  };

  const handleReject = (id: string, name: string) => {
    popup.confirm(
      "Reject KYC",
      `Are you sure you want to reject KYC for ${name}?`,
      () => declineMutation.mutate({ id, data: { reason: "Documents do not match." } }),
      undefined,
      "Reject",
      "Cancel"
    );
  };

  const isMutating = approveMutation.isPending || declineMutation.isPending;

  if (isLoading) {
    return <Loader variant="page" text="Loading KYC Queue..." />;
  }

  const queue = data?.data?.content || [];
  const totalPages = data?.data?.totalPages || 1;
  const totalElements = data?.data?.totalElements || 0;

  return (
    <div className="relative">
      {isMutating && <Loader variant="overlay" text="Processing..." />}
      
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            KYC Verification Queue
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            <span className="font-semibold text-[hsl(var(--foreground))]">
              {tab === "PENDING" ? totalElements : "Multiple"}
            </span>{" "}
            {tab === "PENDING" ? "pending verifications require review" : "records found"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center">
            <ShieldAlert className="h-4.5 w-4.5 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-fit mb-6">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setTab(t.value);
              setPage(0);
            }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              tab === t.value
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {queue.length === 0 && (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {tab.toLowerCase()} verifications</p>
          <p className="text-sm mt-1">
            {tab === "PENDING" ? "All KYC submissions have been reviewed." : "No records match this status."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {queue.map((p) => (
          <Card key={p.participantId} className="attend-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-sm shrink-0">
                  {p.fullName
                    ? p.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                    : "?"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {p.fullName || "Unknown User"}
                  </div>
                </div>
              </div>
              <StatusBadge status={p.kycStatus} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] p-3">
                <div className="attend-section-title mb-1">BVN</div>
                <div className="text-sm font-mono font-medium text-[hsl(var(--foreground))]">
                  {maskValue(p.credentials?.bvn?.value, p.credentials?.bvn?.maskedValue)}
                </div>
              </div>
              <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] p-3">
                <div className="attend-section-title mb-1">CHN</div>
                <div className="text-sm font-mono font-medium text-[hsl(var(--foreground))]">
                  {maskValue(p.credentials?.chn?.value, p.credentials?.chn?.maskedValue)}
                </div>
              </div>
              <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] p-3 col-span-2">
                <div className="attend-section-title mb-1">Submitted</div>
                <div className="text-sm text-[hsl(var(--foreground))]">
                  {p.submittedAt ? formatDate(p.submittedAt) : "N/A"}
                </div>
              </div>
            </div>

            {tab === "PENDING" && (
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-8 text-xs gap-1.5"
                  onClick={() => handleApprove(p.participantId, p.fullName)}
                  disabled={isMutating}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-8 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleReject(p.participantId, p.fullName)}
                  disabled={isMutating}
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            )}
            {tab === "FULL_KYC" && (
              <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                <Check className="h-3.5 w-3.5" />
                KYC Verified
              </div>
            )}
            {tab === "REJECTED" && (
              <div className="flex items-center gap-1.5 text-red-600 text-xs font-medium">
                <X className="h-3.5 w-3.5" />
                Rejected
              </div>
            )}
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page === 0 || isMutating} 
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
            disabled={page >= totalPages - 1 || isMutating} 
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

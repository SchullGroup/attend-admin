"use client";
import { useState } from "react";
import { Check, X, ShieldAlert, CheckCircle2, XCircle, Shield } from "lucide-react";
import { useKycQueue, useApproveKyc, useDeclineKyc } from "@/api/participants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { formatDate } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";

// Fix 2: tabs map to the exact status strings the API accepts
const TABS: { label: string; status: string }[] = [
  { label: "Pending KYC", status: "PENDING" },
  { label: "Full KYC",    status: "FULL"    },
  { label: "Basic KYC",   status: "BASIC"   },
  { label: "No KYC",      status: "NONE"    },
];

function maskValue(val?: string) {
  if (!val) return "—";
  return val.length > 6 ? val.slice(0, 3) + "****" + val.slice(-3) : val;
}

export default function KYCQueuePage() {
  // Fix 2: activeStatus drives both the API param AND the React Query cache key
  const [activeStatus, setActiveStatus] = useState("PENDING");

  // Fix 2: key is ["admin", "kycQueue", activeStatus, page, limit] — unique per tab
  // useKycQueue passes status via { params: { status, page, size } } internally
  const { data: queueData, isLoading } = useKycQueue(activeStatus, 0, 50);
  const approveMutation = useApproveKyc();
  const declineMutation = useDeclineKyc();

  // Rule 1: array is under `queue`; fallback to `content` for safety
  const items = queueData?.queue || queueData?.content || [];
  const activeTab = TABS.find((t) => t.status === activeStatus) ?? TABS[0];

  if (isLoading) return <Loader variant="page" text="Loading KYC Queue…" />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">KYC Verification Queue</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            <span className="font-semibold text-[hsl(var(--foreground))]">{items.length}</span>
            {" "}{activeTab.label.toLowerCase()} submissions
          </p>
        </div>
        <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center">
          <ShieldAlert className="h-4.5 w-4.5 text-orange-500" />
        </div>
      </div>

      {/* Fix 2: tab click changes activeStatus → new cache key → fresh API fetch */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-full mb-6">
        {TABS.map((t) => (
          <button
            key={t.status}
            onClick={() => setActiveStatus(t.status)}
            className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
              activeStatus === t.status
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Empty states */}
      {items.length === 0 && activeStatus === "PENDING" && (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-[hsl(var(--foreground))]">No pending verifications</p>
          <p className="text-sm mt-1">All KYC submissions have been reviewed.</p>
        </div>
      )}
      {items.length === 0 && activeStatus === "FULL" && (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400 opacity-40" />
          <p className="font-medium text-[hsl(var(--foreground))]">No fully verified users yet</p>
          <p className="text-sm mt-1">Approved KYC submissions will appear here.</p>
        </div>
      )}
      {items.length === 0 && (activeStatus === "BASIC" || activeStatus === "NONE") && (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-[hsl(var(--foreground))]">No {activeTab.label.toLowerCase()} users</p>
          <p className="text-sm mt-1">Users in this category will appear here.</p>
        </div>
      )}
      {items.length === 0 && !["PENDING","FULL","BASIC","NONE"].includes(activeStatus) && (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <XCircle className="h-10 w-10 mx-auto mb-3 text-red-400 opacity-40" />
          <p className="font-medium text-[hsl(var(--foreground))]">No results</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {items.map((p) => (
          <Card key={p.participantId} className="attend-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-sm shrink-0">
                  {p.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[hsl(var(--foreground))]">{p.fullName}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">ID: {p.participantId}</div>
                </div>
              </div>
              <StatusBadge status={p.kycStatus?.toLowerCase?.() ?? ""} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] p-3">
                <div className="attend-section-title mb-1">BVN</div>
                <div className="text-sm font-medium text-[hsl(var(--foreground))]">{maskValue(p.credentials?.bvn?.value)}</div>
              </div>
              <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] p-3">
                <div className="attend-section-title mb-1">CHN</div>
                <div className="text-sm font-medium text-[hsl(var(--foreground))]">{maskValue(p.credentials?.chn?.value)}</div>
              </div>
              <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] p-3 col-span-2">
                <div className="attend-section-title mb-1">Submitted</div>
                <div className="text-sm text-[hsl(var(--foreground))]">{formatDate(p.submittedAt)}</div>
              </div>
            </div>

            {activeStatus === "PENDING" && (
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-8 text-xs gap-1.5"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate({ id: p.participantId, data: { notes: "Approved by admin" } })}
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-8 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                  disabled={declineMutation.isPending}
                  onClick={() => declineMutation.mutate({ id: p.participantId, data: { reason: "Declined by admin" } })}
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            )}
            {activeStatus === "FULL" && (
              <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Fully Verified
              </div>
            )}
            {(activeStatus === "BASIC" || activeStatus === "NONE") && (
              <div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))] text-xs font-medium">
                <Shield className="h-3.5 w-3.5" />
                {activeStatus === "BASIC" ? "Basic KYC only" : "No KYC on record"}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

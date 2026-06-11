"use client";
import { useState, useEffect } from "react";
import {
  Users, ShieldCheck, ShieldAlert, ShieldOff, ShieldX,
  Search, Eye, X, AlertTriangle, Fingerprint,
  Hash, Clock, CheckCircle2, XCircle, UserX, UserCheck,
  BadgeCheck, BadgeX, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import {
  useParticipantStats,
  useKycQueue,
  useParticipantKycDetail,
  useParticipantDetail,
  useApproveKyc,
  useDeclineKyc,
  useSuspendParticipant,
  useReactivateParticipant,
} from "@/api/participants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { label: "All",         value: ""          },
  { label: "Pending",     value: "PENDING"   },
  { label: "Full KYC",    value: "FULL_KYC"  },
  { label: "Basic KYC",   value: "BASIC_KYC" },
  { label: "No KYC",      value: "NO_KYC"    },
];

const KYC_CHIP: Record<string, { bg: string; text: string; dot: string }> = {
  FULL_KYC:    { bg: "#dcfce7", text: "#15803d", dot: "#16a34a" },
  BASIC_KYC:   { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  PENDING:     { bg: "#fef9c3", text: "#a16207", dot: "#eab308" },
  PENDING_KYC: { bg: "#fef9c3", text: "#a16207", dot: "#eab308" },
  NO_KYC:      { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  SUSPENDED:   { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
};

const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Micro-components
// ─────────────────────────────────────────────────────────────────────────────

function KycChip({ status }: { status?: string }) {
  const key = (status ?? "NO_KYC").toUpperCase().replace(/ /g, "_");
  const s   = KYC_CHIP[key] ?? KYC_CHIP.NO_KYC;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
      {key.replace(/_/g, " ")}
    </span>
  );
}

function BoolChip({ ok, trueLabel, falseLabel }: { ok?: boolean; trueLabel: string; falseLabel: string }) {
  return ok
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">
        <BadgeCheck className="h-3 w-3" />{trueLabel}
      </span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
        <BadgeX className="h-3 w-3" />{falseLabel}
      </span>;
}

function mask(val?: string | null) {
  if (!val) return "—";
  if (val.length <= 4) return "••••";
  return val.slice(0, 2) + "•".repeat(Math.max(val.length - 4, 4)) + val.slice(-2);
}

function initials(name?: string) {
  return (name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, loading }: {
  label: string; value?: number; icon: React.ElementType; color: string; loading?: boolean;
}) {
  return (
    <Card className="attend-card flex items-center gap-4 p-5">
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + "18" }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
        {loading
          ? <div className="h-7 w-16 mt-1 rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
          : <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))] leading-none mt-0.5">
              {(value ?? 0).toLocaleString()}
            </p>
        }
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Modal (approve / decline / suspend / reactivate)
// ─────────────────────────────────────────────────────────────────────────────

function ActionModal({
  title, iconBg, icon, description, confirmLabel, confirmStyle,
  loading, disabled = false, onCancel, onConfirm, children,
}: {
  title: string; iconBg: string; icon: React.ReactNode; description: string;
  confirmLabel: string; confirmStyle: string; loading: boolean; disabled?: boolean;
  onCancel: () => void; onConfirm: () => void; children?: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2
                      rounded-2xl bg-white shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-1">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">{title}</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 leading-relaxed">{description}</p>
          </div>
          <button onClick={onCancel}
            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))]
                       text-[hsl(var(--muted-foreground))] transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}

        <div className="flex gap-2.5 mt-5">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button className={`flex-1 gap-1.5 ${confirmStyle}`}
            onClick={onConfirm} disabled={disabled || loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Drawer
// ─────────────────────────────────────────────────────────────────────────────

type ActionMode = "approve" | "decline" | "suspend" | "reactivate" | null;

function DetailDrawer({
  participantId,
  onClose,
}: {
  participantId: string;
  onClose: () => void;
}) {
  const { data: profile, isLoading: profileLoading } = useParticipantDetail(participantId);
  const { data: kyc,     isLoading: kycLoading     } = useParticipantKycDetail(participantId);

  const approveMutation    = useApproveKyc();
  const declineMutation    = useDeclineKyc();
  const suspendMutation    = useSuspendParticipant();
  const reactivateMutation = useReactivateParticipant();

  const [mode,          setMode]          = useState<ActionMode>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [declineReason, setDeclineReason] = useState("");

  const isLoading   = profileLoading || kycLoading;
  const isSuspended = (profile?.accountStatus ?? "").toUpperCase() === "SUSPENDED";
  const isPending   = ["PENDING", "PENDING_KYC"].includes((profile?.kycStatus ?? "").toUpperCase());
  const anyPending  = approveMutation.isPending || declineMutation.isPending ||
                      suspendMutation.isPending  || reactivateMutation.isPending;

  const bvn = kyc?.credentials?.bvn;
  const chn = kyc?.credentials?.chn;
  const nin = kyc?.credentials?.nin;
  const bvnFallback = profile?.kyc?.bvn;
  const chnFallback = profile?.kyc?.chn;
  const ninFallback = profile?.kyc?.nin;

  function closeModal() { setMode(null); setSuspendReason(""); setDeclineReason(""); }
  function doneAndClose() { closeModal(); onClose(); }

  return (
    <>
      {/* ── Backdrop ── */}
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />

      {/* ── Sliding panel ── */}
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-[520px] bg-white
                        shadow-2xl flex flex-col overflow-hidden
                        animate-in slide-in-from-right duration-300">

        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
          <div>
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">KYC Review</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Identity verification details</p>
          </div>
          <button onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-xl
                       hover:bg-[hsl(var(--muted))] transition-colors text-[hsl(var(--muted-foreground))]">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* ── Identity block ── */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[hsl(var(--muted)/0.5)]">
                <div className="h-14 w-14 rounded-full flex items-center justify-center
                                text-base font-bold text-white shrink-0"
                  style={{ backgroundColor: profile?.avatarColor ?? "#6b7280" }}>
                  {initials(profile?.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
                    {profile?.fullName ?? "—"}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                    {profile?.email ?? "—"}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                    {profile?.phone ?? "—"}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col gap-1.5 items-end">
                  <KycChip status={profile?.kycStatus} />
                  {isSuspended && (
                    <span className="text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                      Suspended
                    </span>
                  )}
                </div>
              </div>

              {/* ── Info grid ── */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Participant ID",  value: profile?.displayId ?? "—" },
                  { label: "KYC Level",       value: profile?.kycLevel  ?? (profile?.kyc as any)?.kycLevel ?? "—" },
                  { label: "Submitted",       value: kyc?.submittedAt ? formatDate(kyc.submittedAt) : "—" },
                  { label: "Events Attended", value: String(profile?.platformActivity?.eventsAttended ?? 0) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-[hsl(var(--border))] p-3">
                    <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))]
                                  uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Credentials ── */}
              <div>
                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]
                               uppercase tracking-widest mb-3">Identity Credentials</p>

                <div className="space-y-2.5">

                  {/* BVN */}
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(var(--border))]">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Fingerprint className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                          BVN
                        </p>
                        {bvn ? (
                          <span className={`text-xs font-semibold ${bvn.verified ? "text-green-600" : "text-amber-600"}`}>
                            {bvn.verified ? "✓ Verified" : "Unverified"}
                          </span>
                        ) : bvnFallback ? (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">Provided</span>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">Not provided</span>
                        )}
                      </div>
                      <p className="text-sm font-mono font-medium text-[hsl(var(--foreground))]">
                        {mask(bvn?.value ?? bvnFallback)}
                      </p>
                      {bvn?.verifiedAt && (
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center gap-1 mt-1.5">
                          <Clock className="h-3 w-3" /> {formatDate(bvn.verifiedAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* NIN */}
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(var(--border))]">
                    <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Hash className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                          NIN
                        </p>
                        {nin ? (
                          <span className={`text-xs font-semibold ${nin.verified ? "text-green-600" : "text-amber-600"}`}>
                            {nin.verified ? "✓ Verified" : "Unverified"}
                          </span>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {ninFallback ? "Provided" : "Not provided"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-mono font-medium text-[hsl(var(--foreground))]">
                        {mask(nin?.value ?? ninFallback)}
                      </p>
                      {nin?.verifiedAt && (
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center gap-1 mt-1.5">
                          <Clock className="h-3 w-3" /> {formatDate(nin.verifiedAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* CHN */}
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(var(--border))]">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                          CHN
                        </p>
                        {chn ? (
                          <span className={`text-xs font-semibold ${chn.verified ? "text-green-600" : "text-amber-600"}`}>
                            {chn.verified ? "✓ Verified" : "Unverified"}
                          </span>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {chnFallback ? "Provided" : "Not provided"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-mono font-medium text-[hsl(var(--foreground))]">
                        {mask(chn?.value ?? chnFallback)}
                      </p>
                      {chn?.verifiedAt && (
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] flex items-center gap-1 mt-1.5">
                          <Clock className="h-3 w-3" /> {formatDate(chn.verifiedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Action footer ── */}
        {!isLoading && (
          <footer className="border-t border-[hsl(var(--border))] px-6 py-4 bg-[hsl(var(--card))] space-y-2.5">

            {/* Approve + Decline — only when pending */}
            {isPending && !isSuspended && (
              <div className="flex gap-2">
                <Button className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  size="sm" disabled={anyPending} onClick={() => setMode("approve")}>
                  <CheckCircle2 className="h-4 w-4" /> Approve KYC
                </Button>
                <Button variant="outline" className="flex-1 gap-1.5" size="sm"
                  disabled={anyPending} onClick={() => setMode("decline")}>
                  <XCircle className="h-4 w-4" /> Decline KYC
                </Button>
              </div>
            )}

            {/* Suspend / Reactivate */}
            {isSuspended ? (
              <Button variant="outline" className="w-full gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                size="sm" disabled={anyPending} onClick={() => setMode("reactivate")}>
                {reactivateMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <UserCheck className="h-4 w-4" />}
                Reactivate Account
              </Button>
            ) : (
              <Button variant="outline" className="w-full gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                size="sm" disabled={anyPending} onClick={() => setMode("suspend")}>
                <UserX className="h-4 w-4" /> Suspend Account
              </Button>
            )}
          </footer>
        )}
      </aside>

      {/* ─── Modals ──────────────────────────────────────────────────── */}

      {/* Approve */}
      {mode === "approve" && (
        <ActionModal
          title="Approve KYC Submission"
          iconBg="bg-green-50"
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          description={`Upgrade ${profile?.fullName ?? "this participant"}'s status to Full KYC and grant complete platform access.`}
          confirmLabel="Approve"
          confirmStyle="bg-green-600 hover:bg-green-700 text-white"
          loading={approveMutation.isPending}
          onCancel={closeModal}
          onConfirm={() =>
            approveMutation.mutate(
              { id: participantId, data: {} },
              { onSuccess: doneAndClose }
            )
          }
        />
      )}

      {/* Decline — requires reason */}
      {mode === "decline" && (
        <ActionModal
          title="Decline KYC Submission"
          iconBg="bg-red-50"
          icon={<XCircle className="h-5 w-5 text-red-600" />}
          description="Provide a reason for declining. The participant will receive a notification."
          confirmLabel="Decline KYC"
          confirmStyle="bg-red-600 hover:bg-red-700 text-white"
          loading={declineMutation.isPending}
          disabled={!declineReason.trim()}
          onCancel={() => { closeModal(); }}
          onConfirm={() =>
            declineMutation.mutate(
              { id: participantId, data: { reason: declineReason } },
              { onSuccess: doneAndClose }
            )
          }
        >
          <div className="mt-4">
            <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))]
                               uppercase tracking-wide mb-1.5">
              Reason for Declining <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. BVN details do not match the submitted documents…"
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]
                         px-3 py-2 text-sm text-[hsl(var(--foreground))]
                         placeholder:text-[hsl(var(--muted-foreground))]
                         focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.25)]
                         resize-none transition-shadow"
            />
          </div>
        </ActionModal>
      )}

      {/* Suspend — mandatory reason, button blocked until filled */}
      {mode === "suspend" && (
        <ActionModal
          title="Suspend Account"
          iconBg="bg-amber-50"
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          description="This immediately blocks the participant from accessing the platform. A reason is required."
          confirmLabel="Suspend Account"
          confirmStyle="bg-amber-600 hover:bg-amber-700 text-white"
          loading={suspendMutation.isPending}
          disabled={!suspendReason.trim()}
          onCancel={closeModal}
          onConfirm={() =>
            suspendMutation.mutate(
              { id: participantId, data: { reason: suspendReason } },
              { onSuccess: doneAndClose }
            )
          }
        >
          <div className="mt-4">
            <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))]
                               uppercase tracking-wide mb-1.5">
              Reason for Suspension <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Suspicious activity — multiple failed KYC attempts detected…"
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]
                         px-3 py-2 text-sm text-[hsl(var(--foreground))]
                         placeholder:text-[hsl(var(--muted-foreground))]
                         focus:outline-none focus:ring-2 focus:ring-amber-300
                         resize-none transition-shadow"
            />
            {suspendReason === "" && (
              <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                <AlertTriangle className="h-3 w-3" /> Reason is mandatory to suspend an account.
              </p>
            )}
          </div>
        </ActionModal>
      )}

      {/* Reactivate */}
      {mode === "reactivate" && (
        <ActionModal
          title="Reactivate Account"
          iconBg="bg-emerald-50"
          icon={<UserCheck className="h-5 w-5 text-emerald-600" />}
          description={`Restore ${profile?.fullName ?? "this participant"}'s access to the platform.`}
          confirmLabel="Reactivate"
          confirmStyle="bg-emerald-600 hover:bg-emerald-700 text-white"
          loading={reactivateMutation.isPending}
          onCancel={closeModal}
          onConfirm={() =>
            reactivateMutation.mutate(participantId, { onSuccess: doneAndClose })
          }
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ParticipantKycDashboard — main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ParticipantKycDashboard() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(0);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [statusFilter]);

  const { data: stats, isLoading: statsLoading } = useParticipantStats();
  const { data: queueData, isLoading: queueLoading } =
    useKycQueue(statusFilter, page, PAGE_SIZE);

  const queue      = (queueData?.queue ?? queueData?.content ?? []) as any[];
  const totalCount = queueData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  const filtered = search.trim()
    ? queue.filter((p: any) =>
        [p.fullName, p.email, p.displayId, p.participantId]
          .some((v) => (v ?? "").toLowerCase().includes(search.toLowerCase()))
      )
    : queue;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">KYC Review Dashboard</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Review identity verification submissions and manage participant KYC status
        </p>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Participants"
          value={stats?.totalParticipants ?? stats?.total}
          icon={Users} color="#374151" loading={statsLoading}
        />
        <StatCard
          label="Full KYC Verified"
          value={stats?.verified ?? stats?.fullKyc ?? stats?.verifiedCount}
          icon={ShieldCheck} color="#16a34a" loading={statsLoading}
        />
        <StatCard
          label="Pending KYC"
          value={stats?.pendingKyc ?? stats?.pending ?? stats?.pendingCount}
          icon={ShieldAlert} color="#d97706" loading={statsLoading}
        />
        <StatCard
          label="Suspended"
          value={stats?.suspended ?? stats?.suspendedCount}
          icon={ShieldOff} color="#dc2626" loading={statsLoading}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
          {STATUS_TABS.map((t) => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                statusFilter === t.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input placeholder="Search by name, email or ID…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      {/* ── Queue table ── */}
      <Card className="attend-card overflow-hidden">
        {queueLoading ? (
          // Skeleton rows
          <div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4
                                      border-b border-[hsl(var(--border)/0.5)] last:border-0">
                <div className="h-9 w-9 rounded-full bg-[hsl(var(--muted))] animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded-md bg-[hsl(var(--muted))] animate-pulse" />
                  <div className="h-3 w-28 rounded-md bg-[hsl(var(--muted))] animate-pulse" />
                </div>
                <div className="h-6 w-20 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Participant</th>
                <th className="px-5 py-3 text-left">Contact</th>
                <th className="px-5 py-3 text-left">KYC Status</th>
                <th className="px-5 py-3 text-left">BVN</th>
                <th className="px-5 py-3 text-left">CHN</th>
                <th className="px-5 py-3 text-left">Submitted</th>
                <th className="px-5 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => {
                const pid    = p.participantId ?? p.id;
                const bvnOk  = p.bvnProvided ?? !!(p.credentials?.bvn ?? p.kyc?.bvn);
                const chnOk  = p.chnProvided ?? !!(p.credentials?.chn ?? p.kyc?.chn);
                return (
                  <tr key={pid}
                    className="attend-table-row cursor-pointer group"
                    onClick={() => setSelectedId(pid)}>
                    {/* Name */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center
                                        text-xs font-bold text-white shrink-0"
                          style={{ backgroundColor: p.avatarColor ?? "#6b7280" }}>
                          {initials(p.fullName)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                            {p.fullName ?? "—"}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {p.displayId ?? pid}
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* Contact */}
                    <td className="px-5 py-3">
                      <p className="text-sm text-[hsl(var(--foreground))]">{p.email ?? "—"}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.phone ?? "—"}</p>
                    </td>
                    {/* Status */}
                    <td className="px-5 py-3">
                      <KycChip status={p.kycStatus} />
                    </td>
                    {/* BVN chip */}
                    <td className="px-5 py-3">
                      <BoolChip ok={bvnOk} trueLabel="Provided" falseLabel="Missing" />
                    </td>
                    {/* CHN chip */}
                    <td className="px-5 py-3">
                      <BoolChip ok={chnOk} trueLabel="Provided" falseLabel="Missing" />
                    </td>
                    {/* Submitted */}
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                      {p.submittedAgo ?? (p.submittedAt ? formatDate(p.submittedAt) : "—")}
                    </td>
                    {/* Review button (visible on hover) */}
                    <td className="px-5 py-3">
                      <Button size="sm" variant="outline"
                        className="h-7 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setSelectedId(pid); }}>
                        <Eye className="h-3 w-3" /> Review
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Empty state */}
        {!queueLoading && filtered.length === 0 && (
          <div className="py-16 text-center">
            <ShieldX className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No records found</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {search
                ? `No participants match "${search}"`
                : `No participants in the "${statusFilter || "All"}" category`}
            </p>
            {(search || statusFilter) && (
              <button onClick={() => { setSearch(""); setStatusFilter(""); }}
                className="mt-3 text-xs text-[hsl(var(--primary))] hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Pagination */}
        {!queueLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5
                          border-t border-[hsl(var(--border)/0.6)] bg-[hsl(var(--muted)/0.3)]">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{" "}
              {totalCount.toLocaleString()} participants
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium px-2 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── Detail drawer ── */}
      {selectedId && (
        <DetailDrawer participantId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

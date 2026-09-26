"use client";
import { use } from "react";
import { UserAvatar } from "@/components/custom/user-avatar";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";
import {
  ArrowLeft, Mail, Phone, Calendar, ShieldCheck, CalendarDays,
  ShieldOff, CheckCircle2, Building2, Tag,
} from "lucide-react";
import {
  useAdminUserDetail,
  useSuspendUser,
  useActivateUser,
} from "@/api/super-admin";
import {
  useParticipantDetail,
  useSuspendParticipant,
  useReactivateParticipant,
} from "@/api/participants";

function maskValue(val?: string) {
  if (!val) return "—";
  const v = val.trim();
  if (!v) return "—";
  // Only mask things that actually look like an identity number. The API used to
  // put prose in these fields — a literal "Not provided" came back as
  // "Not **** ded", because the masker happily chewed on any string over six
  // characters. The backend now returns null (2026-09-18 A3); this is the guard
  // that stops a future placeholder rendering as gibberish.
  const looksLikeIdentityNumber = /^[A-Za-z]{0,4}[\s-]?\d{4,}$/.test(v);
  if (!looksLikeIdentityNumber) return v;
  return v.length > 6 ? v.slice(0, 3) + " **** " + v.slice(-3) : v;
}

// Prefer real browser back-navigation so a user who arrived here from an
// event's Attendees tab (or anywhere else) returns to that exact tab/scroll
// state, instead of always being dumped on the platform-wide "All Users"
// list regardless of where they came from.
function handleBack(router: ReturnType<typeof useRouter>) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  } else {
    router.push("/participants");
  }
}

export default function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // Primary: admin user detail (GET /api/v1/admin/users/{id})
  const { data: adminUser, isLoading: adminLoading } = useAdminUserDetail(id);
  // Secondary: participant detail for KYC/activity data (GET /api/v1/admin/participants/{id})
  const { data: participant, isLoading: partLoading } = useParticipantDetail(id);

  // Mutations from both admin users endpoint and participants endpoint
  const suspendAdminMut    = useSuspendUser();
  const activateAdminMut   = useActivateUser();
  const suspendPartMut     = useSuspendParticipant();
  const reactivatePartMut  = useReactivateParticipant();

  if (adminLoading || partLoading) {
    return <Loader variant="page" text="Loading User Details…" />;
  }

  // Merge data — prefer adminUser fields when present, fall back to participant
  const u     = adminUser;
  const p     = participant;

  if (!u && !p) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">User not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          This user may not exist or has been removed.
        </p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => handleBack(router)}>
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Button>
      </div>
    );
  }

  const fullName   = u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : (p?.fullName ?? "");
  const email      = u?.email ?? p?.email ?? "";
  const phone      = u?.phone ?? p?.phone ?? null;
  const status     = u?.status ?? p?.accountStatus ?? "";
  const kycStatus  = u?.kycStatus ?? p?.kycStatus ?? null;
  const initials   = u
    ? `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || email[0]?.toUpperCase()
    : p?.initials ?? email[0]?.toUpperCase() ?? "?";
  const avatarColor = p?.avatarColor ?? null;
  // Both endpoints can carry a photo; prefer the admin-user one, which is
  // what the detail request actually returns.
  const avatarUrl   = u?.avatarUrl ?? (p as { avatarUrl?: string | null } | undefined)?.avatarUrl ?? null;
  const createdAt  = u?.createdAt ?? p?.joinedAt ?? null;
  const emailVerified = u?.emailVerified ?? null;
  const stakeholderName = u?.stakeholderName ?? null;
  const roles: string[] =
    Array.isArray(u?.roles) && u!.roles!.length > 0
      ? u!.roles!
      : u?.role ? [u.role] : [];

  const isSuspended = status?.toUpperCase() === "SUSPENDED";
  const isMutating = suspendAdminMut.isPending || activateAdminMut.isPending ||
                     suspendPartMut.isPending   || reactivatePartMut.isPending;

  function handleSuspend() {
    if (u) {
      suspendAdminMut.mutate(id);
    } else {
      suspendPartMut.mutate({ id, data: { reason: "Suspended by admin" } });
    }
  }

  function handleRestore() {
    if (u) {
      activateAdminMut.mutate(id);
    } else {
      reactivatePartMut.mutate(id);
    }
  }

  return (
    <div className="relative">
      {isMutating && <Loader variant="overlay" text="Processing…" />}

      <button
        onClick={() => handleBack(router)}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-5 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div className="grid grid-cols-3 gap-5">
        {/* ── Profile card ── */}
        <div className="col-span-1 flex flex-col gap-4">
          <Card className="attend-card p-6 flex flex-col items-center text-center">
            <UserAvatar
              src={avatarUrl}
              initials={initials}
              color={avatarColor}
              size={64}
              className="mb-4"
            />
            <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">{fullName}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{email}</p>

            {/* Status badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {status && <StatusBadge status={status.toLowerCase()} />}
              {kycStatus && <StatusBadge status={kycStatus.toLowerCase()} />}
            </div>

            {/* Email verified */}
            {emailVerified !== null && (
              <div className="mt-2 flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                <CheckCircle2 className={`h-3.5 w-3.5 ${emailVerified ? "text-green-600" : "text-[hsl(var(--muted-foreground))]"}`} />
                {emailVerified ? "Email verified" : "Email not verified"}
              </div>
            )}

            {/* Roles */}
            {roles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1 justify-center">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
                  >
                    {r.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}

            {/* Suspend / restore */}
            <div className="mt-4 w-full border-t border-[hsl(var(--border))] pt-4">
              {isSuspended ? (
                <Button
                  variant="outline" size="sm"
                  className="w-full text-green-700 border-green-200 hover:bg-green-50 gap-2"
                  onClick={handleRestore} disabled={isMutating}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Restore Account
                </Button>
              ) : (
                <Button
                  variant="outline" size="sm"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-2"
                  onClick={handleSuspend} disabled={isMutating}
                >
                  <ShieldOff className="h-3.5 w-3.5" /> Suspend Account
                </Button>
              )}
            </div>
          </Card>

          {/* Contact card */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Contact</h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))] truncate">{email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))]">
                  {phone ?? "Not provided"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                <span className="text-sm text-[hsl(var(--foreground))]">
                  {createdAt ? `Joined ${formatDate(createdAt)}` : "—"}
                </span>
              </div>
              {stakeholderName && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0" />
                  <span className="text-sm text-[hsl(var(--foreground))] truncate">{stakeholderName}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Right panel ── */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Account info */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Account Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "Account Status", value: status || "—" },
                { label: "KYC Status",    value: kycStatus || "—" },
                { label: "Email Verified", value: emailVerified === null ? "—" : emailVerified ? "Yes" : "No" },
                { label: "Stakeholder",   value: stakeholderName || "—" },
                { label: "Registered",    value: createdAt ? formatDate(createdAt) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="attend-section-title">{label}</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Roles card */}
          {roles.length > 0 && (
            <Card className="attend-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="h-4 w-4 text-[hsl(var(--primary))]" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Roles</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]"
                  >
                    {r.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* KYC card — shown when participant data is available */}
          {p && (
            <Card className="attend-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">KYC Verification</h2>
              </div>
              <div className="rounded-xl border border-[hsl(var(--border))] p-3 mb-4 flex items-start gap-3 bg-[hsl(var(--muted)/0.3)]">
                <StatusBadge status={p.kyc?.status || p.kycStatus} />
                <p className="text-sm text-[hsl(var(--muted-foreground))] flex-1">
                  {p.kyc?.description || "Verification information unavailable."}
                </p>
              </div>
              {(() => {
                const hasKyc = p.kycStatus?.toUpperCase() !== "NO_KYC"
                  && (p.kyc?.bvn || p.kyc?.nin || p.kyc?.chn);
                if (!hasKyc) {
                  return (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] italic">
                      No KYC credentials submitted.
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      // `verified` is only meaningful for BVN and NIN — CHN is a
                      // shareholder reference the register supplies, not something
                      // we verify against a provider.
                      { label: "BVN", value: maskValue(p.kyc?.bvn),
                        verified: p.kyc?.bvn ? Boolean((p.kyc as any)?.bvnVerified) : undefined },
                      { label: "CHN", value: maskValue(p.kyc?.chn), verified: undefined },
                      { label: "NIN", value: maskValue(p.kyc?.nin),
                        verified: p.kyc?.nin ? Boolean((p.kyc as any)?.ninVerified) : undefined },
                    ].map(({ label, value, verified }) => (
                      <div key={label} className="rounded-xl bg-[hsl(var(--muted)/0.5)] p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="attend-section-title">{label}</p>
                          {/* Absence of a pill used to mean both "not verified" and
                              "verification does not apply here", which left an admin
                              unable to tell an unverified NIN from a CHN. Both states
                              are now stated; CHN still carries no pill because there
                              is nothing to verify it against. */}
                          {verified === true && (
                            <span
                              className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700"
                              title={label === "NIN"
                                ? "NIN + selfie matched against the NIMC photo. Independent of the BVN ladder, so this user can be NIN-verified and still NO_KYC."
                                : "BVN verified."}
                            >
                              Verified
                            </span>
                          )}
                          {verified === false && (
                            <span
                              className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                              title={label === "NIN"
                                ? "This NIN has been supplied but not matched against the NIMC photo. It counts for nothing until it is."
                                : "This BVN has been supplied but not verified."}
                            >
                              Not verified
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-mono font-semibold text-[hsl(var(--foreground))]">{value}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Card>
          )}

          {/* Activity card — shown when participant data is available */}
          {p && (
            <Card className="attend-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="h-4 w-4 text-[hsl(var(--primary))]" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Platform Activity</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <p className="text-3xl font-bold tabular-nums text-[hsl(var(--foreground))]">
                    {p.platformActivity?.eventsAttended ?? 0}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Events attended</p>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                  <p className="text-3xl font-bold tabular-nums text-[hsl(var(--foreground))]">
                    {p.platformActivity?.credentialsVerified ?? 0}
                  </p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Credentials verified</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

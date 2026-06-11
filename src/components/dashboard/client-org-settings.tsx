"use client";

import { useRef } from "react";
import {
  Upload, Building2, Globe, Mail, Phone, Hash, Briefcase,
  Loader2, ImageIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useOrganisationProfile,
  useUploadOrgLogo,
  useOrganisationRoles,
} from "@/api/client-organisation";

// ─── Skeleton ────────────────────────────────────────────────────────────────

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="h-3 w-20 rounded bg-[hsl(var(--muted))] animate-pulse" />
      <div className="h-10 w-full rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
    </div>
  );
}

// ─── Read-only field ──────────────────────────────────────────────────────────

function ROField({
  id, label, value, icon: Icon, type = "text",
}: {
  id: string;
  label: string;
  value?: string | null;
  icon?: React.ElementType;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]"
      >
        {label}
      </Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        )}
        <Input
          id={id}
          type={type}
          value={value ?? "—"}
          readOnly
          disabled
          className={`${Icon ? "pl-9" : ""} bg-[hsl(var(--muted))] cursor-not-allowed text-[hsl(var(--muted-foreground))]`}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClientOrgSettings() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: profile, isLoading: profileLoading } = useOrganisationProfile();
  const { data: rolesData, isLoading: rolesLoading   } = useOrganisationRoles();
  const uploadMutation = useUploadOrgLogo();

  const logoUrl      = profile?.logoUrl;
  const primaryColor = profile?.primaryColor ?? "#374151";
  const initials     = (profile?.companyName ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    // Reset input so the same file can be re-selected after an error
    e.target.value = "";
  }

  // Normalise roles payload into a flat Record<roleKey, descriptionString>.
  // The API may return several shapes:
  //   • Record<string, string>                  — already flat
  //   • Record<string, { label, value, description?, ... }> — nested object per role
  //   • Array<{ role|key, description|label, ... }>        — list form
  function extractDesc(v: unknown): string {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return String(o.description ?? o.label ?? o.value ?? "");
    }
    return "";
  }

  const rolesMap: Record<string, string> = (() => {
    if (!rolesData) return {};
    if (Array.isArray(rolesData)) {
      return Object.fromEntries(
        (rolesData as any[]).map((r) => {
          const key = r.role ?? r.key ?? r.value ?? String(r);
          return [String(key), extractDesc(r.description ?? r.label ?? r)];
        })
      );
    }
    if (typeof rolesData === "object") {
      return Object.fromEntries(
        Object.entries(rolesData as Record<string, unknown>).map(([k, v]) => [k, extractDesc(v)])
      );
    }
    return {};
  })();

  return (
    <div className="flex flex-col gap-6">

      {/* ─── Section 1: Logo Upload + Read-only Org Info ─────────────── */}
      <Card className="attend-card p-6">
        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-5 text-base">
          Organisation Profile
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Logo upload */}
          <div className="flex flex-col items-center gap-4 lg:border-r lg:border-[hsl(var(--border))] lg:pr-6">
            {/* Logo preview */}
            <div
              className="h-24 w-24 rounded-2xl border border-[hsl(var(--border))] overflow-hidden flex items-center justify-center shrink-0"
              style={{ backgroundColor: logoUrl ? "transparent" : primaryColor }}
            >
              {profileLoading ? (
                <div className="h-full w-full bg-[hsl(var(--muted))] animate-pulse" />
              ) : logoUrl ? (
                <img src={logoUrl} alt="Organisation logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-2xl font-bold text-white">{initials}</span>
              )}
            </div>

            {/* Brand colour chip */}
            {!profileLoading && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] w-full">
                <span
                  className="h-5 w-5 rounded shrink-0 border border-[hsl(var(--border)/0.5)]"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-xs font-mono text-[hsl(var(--foreground))]">{primaryColor}</span>
              </div>
            )}

            {/* Upload button */}
            <div className="flex flex-col items-center gap-2 w-full">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={uploadMutation.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {uploadMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                  : <><Upload className="h-3.5 w-3.5" /> {logoUrl ? "Change Logo" : "Upload Logo"}</>
                }
              </Button>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] text-center leading-snug">
                PNG, JPEG or SVG · max 2 MB
              </p>
            </div>
          </div>

          {/* Right: Read-only org info */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profileLoading
              ? [...Array(6)].map((_, i) => <FieldSkeleton key={i} />)
              : (
                <>
                  <ROField id="companyName"   label="Company Name"     value={profile?.companyName}   icon={Building2}  />
                  <ROField id="industry"      label="Industry"         value={profile?.industry}      icon={Briefcase}  />
                  <ROField id="rcNumber"      label="RC Number"        value={profile?.rcNumber}      icon={Hash}       />
                  <ROField id="contactEmail"  label="Contact Email"    value={profile?.contactEmail}  icon={Mail}       type="email" />
                  <ROField id="phone"         label="Phone"            value={profile?.phone}         icon={Phone}      type="tel" />
                  <ROField id="website"       label="Website"          value={profile?.website}       icon={Globe}      type="url" />
                </>
              )
            }
          </div>
        </div>
      </Card>

      {/* ─── Section 2: Team Roles Table ─────────────────────────────── */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
          <h3 className="font-semibold text-[hsl(var(--foreground))] text-base">Team Roles</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Available roles and their platform permissions
          </p>
        </div>

        {rolesLoading ? (
          <div className="divide-y divide-[hsl(var(--border)/0.5)]">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-4 w-28 rounded bg-[hsl(var(--muted))] animate-pulse shrink-0" />
                <div className="h-3.5 w-64 rounded bg-[hsl(var(--muted))] animate-pulse" />
              </div>
            ))}
          </div>
        ) : Object.keys(rolesMap).length === 0 ? (
          <div className="py-10 text-center">
            <ImageIcon className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No role definitions available.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left w-48">Role</th>
                <th className="px-5 py-3 text-left">Description / Permissions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rolesMap).map(([key, desc]) => (
                <tr key={key} className="attend-table-row">
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                      {key}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {desc || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

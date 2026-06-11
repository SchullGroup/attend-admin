"use client";

import { useRef } from "react";
import {
  Upload, Building2, Globe, Mail, Phone, Hash, Briefcase, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useOrganisationProfile,
  useUploadOrgLogo,
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
  const uploadMutation = useUploadOrgLogo();

  const logoUrl  = profile?.logoUrl;
  const initials = (profile?.companyName ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    // Reset so the same file can be re-selected after an error
    e.target.value = "";
  }

  return (
    <Card className="attend-card p-6">
      <h3 className="font-semibold text-[hsl(var(--foreground))] mb-5 text-base">
        Organisation Profile
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Logo upload */}
        <div className="flex flex-col items-center gap-4 lg:border-r lg:border-[hsl(var(--border))] lg:pr-6">

          {/* Logo preview */}
          <div className="h-24 w-24 rounded-2xl border border-[hsl(var(--border))] overflow-hidden flex items-center justify-center shrink-0 bg-[hsl(var(--muted))]">
            {profileLoading ? (
              <div className="h-full w-full animate-pulse bg-[hsl(var(--muted))]" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Organisation logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl font-bold text-[hsl(var(--muted-foreground))]">{initials}</span>
            )}
          </div>

          {/* Upload controls */}
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
                <ROField id="companyName"  label="Company Name"  value={profile?.companyName}  icon={Building2} />
                <ROField id="industry"     label="Industry"      value={profile?.industry}     icon={Briefcase} />
                <ROField id="rcNumber"     label="RC Number"     value={profile?.rcNumber}     icon={Hash} />
                <ROField id="contactEmail" label="Contact Email" value={profile?.contactEmail} icon={Mail}  type="email" />
                <ROField id="phone"        label="Phone"         value={profile?.phone}        icon={Phone} type="tel" />
                <ROField id="website"      label="Website"       value={profile?.website}      icon={Globe} type="url" />
              </>
            )
          }
        </div>
      </div>
    </Card>
  );
}

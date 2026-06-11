"use client";

import { useState, useEffect } from "react";
import { Loader2, Building2, Globe, Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useOrganisationProfile,
  useUpdateOrganisationInfo,
} from "@/api/client-organisation";
import type { UpdateOrganisationInfoRequest } from "@/api/client-organisation";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="h-3.5 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" />
      <div className="h-10 w-full rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
    </div>
  );
}

// ─── Read-only field ──────────────────────────────────────────────────────────

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
        {label}
      </Label>
      <Input
        value={value ?? "—"}
        readOnly
        disabled
        className="bg-[hsl(var(--muted))] cursor-not-allowed text-[hsl(var(--muted-foreground))]"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrganisationSettings() {
  const { data: profile, isLoading } = useOrganisationProfile();
  const updateMutation = useUpdateOrganisationInfo();

  // Local form state
  const [companyName, setCompanyName] = useState("");
  const [website,     setWebsite]     = useState("");
  const [contactEmail,setContactEmail] = useState("");
  const [phone,       setPhone]       = useState("");

  // Sync form when profile loads
  useEffect(() => {
    if (!profile) return;
    setCompanyName(profile.companyName ?? "");
    setWebsite(profile.website         ?? "");
    setContactEmail(profile.contactEmail ?? "");
    setPhone(profile.phone             ?? "");
  }, [profile]);

  function handleReset() {
    if (!profile) return;
    setCompanyName(profile.companyName ?? "");
    setWebsite(profile.website         ?? "");
    setContactEmail(profile.contactEmail ?? "");
    setPhone(profile.phone             ?? "");
  }

  function handleSave() {
    if (!profile) return;
    const payload: UpdateOrganisationInfoRequest = {
      companyName,
      website:      website      || undefined,
      contactEmail,
      phone:        phone        || undefined,
      // Non-mutable fields sent back unchanged to satisfy API contract
      rcNumber:     profile.rcNumber,
      industry:     profile.industry,
    };
    updateMutation.mutate(payload);
  }

  // Branding values
  const logoUrl      = profile?.logoUrl;
  const primaryColor = profile?.primaryColor ?? "#374151";
  const initials     = (profile?.companyName ?? "?")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const isDirty =
    companyName !== (profile?.companyName ?? "") ||
    website     !== (profile?.website     ?? "") ||
    contactEmail !== (profile?.contactEmail ?? "") ||
    phone       !== (profile?.phone       ?? "");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* ── Left: Branding preview ── */}
      <Card className="attend-card p-6 flex flex-col items-center gap-4 lg:col-span-1">
        <div className="w-full flex items-center justify-between mb-2">
          <h3 className="font-semibold text-[hsl(var(--foreground))]">Brand Identity</h3>
        </div>

        {/* Logo / initials avatar */}
        {isLoading ? (
          <div className="h-20 w-20 rounded-2xl bg-[hsl(var(--muted))] animate-pulse" />
        ) : logoUrl ? (
          <img
            src={logoUrl}
            alt={companyName}
            className="h-20 w-20 rounded-2xl object-contain border border-[hsl(var(--border))]"
          />
        ) : (
          <div
            className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {initials}
          </div>
        )}

        {/* Company name */}
        {isLoading ? (
          <div className="h-4 w-32 rounded bg-[hsl(var(--muted))] animate-pulse" />
        ) : (
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] text-center">
            {profile?.companyName ?? "—"}
          </p>
        )}

        {/* Primary colour swatch */}
        <div className="w-full mt-2">
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
            Brand Colour
          </p>
          {isLoading ? (
            <div className="h-9 w-full rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
          ) : (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
              <span
                className="h-6 w-6 rounded-md shrink-0 border border-[hsl(var(--border)/0.5)]"
                style={{ backgroundColor: primaryColor }}
              />
              <span className="text-sm font-mono text-[hsl(var(--foreground))]">
                {primaryColor}
              </span>
            </div>
          )}
        </div>

        {/* Status badge */}
        {!isLoading && profile?.status && (
          <div className="w-full mt-auto pt-4 border-t border-[hsl(var(--border))]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--muted-foreground))]">Account status</span>
              <span className={`font-semibold ${profile.status === "ACTIVE" ? "text-green-600" : "text-amber-600"}`}>
                {profile.status}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ── Right: Editable form ── */}
      <Card className="attend-card p-6 lg:col-span-2">
        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-5">Organisation Information</h3>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <FieldSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Editable fields */}
            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Company Name
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="pl-9"
                  placeholder="Acme Corporation"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="website" className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Website
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="pl-9"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactEmail" className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Contact Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="pl-9"
                  placeholder="contact@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Phone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-9"
                  placeholder="+234 800 000 0000"
                />
              </div>
            </div>

            {/* Read-only — non-mutable platform assets */}
            <ReadOnlyField label="Industry" value={profile?.industry} />
            <ReadOnlyField label="RC Number" value={profile?.rcNumber} />
          </div>
        )}

        {/* Action row */}
        {!isLoading && (
          <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-[hsl(var(--border))]">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!isDirty || updateMutation.isPending}
            >
              Reset Changes
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
              className="gap-2"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

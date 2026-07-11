"use client";

import { useRef, useState, useEffect } from "react";
import {
  Upload, Building2, Globe, Mail, Hash, Briefcase,
  Loader2, Check, X, Palette,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  useOrganisationProfile,
  useUploadOrgLogo,
  useUpdateOrganisationInfo,
  useUpdateBrandingColor,
  type OrgInfoFields,
} from "@/api/client-organisation";

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <div className="h-3 w-20 rounded bg-[hsl(var(--muted))] animate-pulse" />
      <div className="h-10 w-full rounded-lg bg-[hsl(var(--muted))] animate-pulse" />
    </div>
  );
}

// ─── Field with icon ──────────────────────────────────────────────────────────

function Field({
  id, label, value, onChange, icon: Icon, type = "text",
  readOnly = false, disabled = false, placeholder,
}: {
  id:          string;
  label:       string;
  value?:      string | null;
  onChange?:   (v: string) => void;
  icon?:       React.ElementType;
  type?:       string;
  readOnly?:   boolean;
  disabled?:   boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        )}
        <Input
          id={id}
          type={type}
          value={value ?? ""}
          readOnly={readOnly}
          disabled={disabled || readOnly}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          className={`${Icon ? "pl-9" : ""} ${readOnly ? "bg-[hsl(var(--muted))] cursor-not-allowed text-[hsl(var(--muted-foreground))]" : ""}`}
        />
      </div>
    </div>
  );
}

// ─── Organisation Info Card ────────────────────────────────────────────────────

function OrgInfoCard() {
  const { data: profile, isLoading } = useOrganisationProfile();
  const updateInfo = useUpdateOrganisationInfo();

  const info = profile?.organisationInfo;

  const [phone,   setPhone]   = useState("");
  const [website, setWebsite] = useState("");

  // Sync editable fields when profile loads
  useEffect(() => {
    if (info) {
      setPhone(info.phone   ?? "");
      setWebsite(info.website ?? "");
    }
  }, [info]);

  const isDirty =
    phone   !== (info?.phone   ?? "") ||
    website !== (info?.website ?? "");

  function handleSave() {
    if (!info) return;
    updateInfo.mutate({
      companyName:  info.companyName,
      rcNumber:     info.rcNumber,
      contactEmail: info.contactEmail,
      industry:     info.industry,
      phone:        phone.trim()   || undefined,
      website:      website.trim() || undefined,
    });
  }

  function handleReset() {
    setPhone(info?.phone   ?? "");
    setWebsite(info?.website ?? "");
  }

  const busy = updateInfo.isPending;

  return (
    <Card className="attend-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-[hsl(var(--foreground))] text-base">Organisation Info</h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Company name, registration, and contact details</p>
        </div>
        {!isLoading && isDirty && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleReset} disabled={busy}>
              <X className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading
          ? [...Array(6)].map((_, i) => <FieldSkeleton key={i} />)
          : (
            <>
              {/* Read-only fields */}
              <Field id="companyName"  label="Company Name"  value={info?.companyName}  icon={Building2} readOnly />
              <Field id="industry"     label="Industry"      value={info?.industry}     icon={Briefcase} readOnly />
              <Field id="rcNumber"     label="RC Number"     value={info?.rcNumber}     icon={Hash}      readOnly />
              <Field id="contactEmail" label="Contact Email" value={info?.contactEmail} icon={Mail}      readOnly type="email" />
              {/* Editable fields */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  Phone
                </Label>
                <PhoneInput value={phone} onChange={setPhone} />
              </div>
              <Field id="website" label="Website" value={website} onChange={setWebsite} icon={Globe} type="url" placeholder="https://company.com" />
            </>
          )}
      </div>
    </Card>
  );
}

// ─── Branding Card ─────────────────────────────────────────────────────────────

function BrandingCard() {
  const fileRef        = useRef<HTMLInputElement>(null);
  const colorInputRef  = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useOrganisationProfile();
  const uploadLogo     = useUploadOrgLogo();
  const updateColor    = useUpdateBrandingColor();

  const branding    = profile?.branding;
  const logoUrl     = branding?.logoUrl;
  const logoInitial = branding?.logoInitial ?? profile?.organisationInfo?.companyName?.slice(0, 2).toUpperCase() ?? "?";
  const savedColor  = branding?.primaryColor ?? "#7c22c9";

  const [localColor, setLocalColor] = useState(savedColor);
  const [colorDirty, setColorDirty] = useState(false);

  // Sync color when profile loads
  useEffect(() => {
    if (savedColor) { setLocalColor(savedColor); setColorDirty(false); }
  }, [savedColor]);

  function handleColorChange(v: string) {
    setLocalColor(v);
    setColorDirty(v !== savedColor);
  }

  function handleSaveColor() {
    updateColor.mutate(localColor, { onSuccess: () => setColorDirty(false) });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadLogo.mutate(file);
    e.target.value = "";
  }

  const uploading = uploadLogo.isPending;

  return (
    <Card className="attend-card p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-[hsl(var(--foreground))] text-base">Branding</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Logo, brand colour, and display initials</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Logo upload */}
        <div className="flex flex-col items-center gap-4 lg:border-r lg:border-[hsl(var(--border))] lg:pr-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] self-start">Organisation Logo</p>

          <div
            className="h-24 w-24 rounded-2xl border-2 border-[hsl(var(--border))] overflow-hidden flex items-center justify-center shrink-0"
            style={{ backgroundColor: logoUrl ? "transparent" : (savedColor + "18") }}
          >
            {isLoading ? (
              <div className="h-full w-full animate-pulse bg-[hsl(var(--muted))]" />
            ) : uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Organisation logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl font-bold" style={{ color: savedColor }}>{logoInitial}</span>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline" size="sm" className="w-full gap-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
              : <><Upload className="h-3.5 w-3.5" /> {logoUrl ? "Change Logo" : "Upload Logo"}</>}
          </Button>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] text-center leading-snug">
            PNG, JPEG, SVG or WEBP · max 5 MB
          </p>
        </div>

        {/* Branding details */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Primary color */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] block mb-1.5">
              Primary Colour
            </Label>
            <div className="flex items-center gap-3">
              {/* Color swatch — opens native color picker */}
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                className="h-10 w-10 rounded-lg border-2 border-[hsl(var(--border))] shrink-0 cursor-pointer hover:scale-105 transition-transform"
                style={{ backgroundColor: localColor }}
                title="Pick colour"
              />
              <input
                ref={colorInputRef}
                type="color"
                value={localColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="sr-only"
              />
              <Input
                value={localColor}
                onChange={(e) => handleColorChange(e.target.value)}
                placeholder="#7c22c9"
                className="font-mono uppercase flex-1"
                maxLength={7}
              />
              {colorDirty && (
                <Button
                  size="sm" className="gap-1.5 shrink-0"
                  disabled={updateColor.isPending}
                  onClick={handleSaveColor}
                >
                  {updateColor.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Palette className="h-3.5 w-3.5" />}
                  {updateColor.isPending ? "Saving…" : "Save Colour"}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">
              Used for buttons, accents, and branded emails. Enter a hex value or click the swatch.
            </p>
          </div>

          {/* Logo initial (read-only) */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] block mb-1.5">
              Logo Initial
            </Label>
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: savedColor }}
              >
                {logoInitial}
              </div>
              <Input
                value={logoInitial}
                readOnly
                disabled
                className="bg-[hsl(var(--muted))] cursor-not-allowed text-[hsl(var(--muted-foreground))] flex-1"
              />
            </div>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">
              Auto-generated from your company name. Shown when no logo is uploaded.
            </p>
          </div>

          {/* Current colour preview */}
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ backgroundColor: localColor + "12", border: `1px solid ${localColor}30` }}
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: localColor }}>
              <span className="text-white text-xs font-bold">{logoInitial}</span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: localColor }}>
                {profile?.organisationInfo?.companyName || "Your Organisation"}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Brand colour preview</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ClientOrgSettings() {
  return (
    <>
      <OrgInfoCard />
      <BrandingCard />
    </>
  );
}

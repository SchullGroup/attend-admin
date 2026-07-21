"use client";

/**
 * RegisterBrandingSection — logo + brand colour editor for a register (F4).
 *
 * PATCH /api/v1/client/registers/{registerId}/branding — roles: CLIENT_ADMIN, ADMIN.
 * Any subset of { logoUrl, brandColor }. `logoUrl: null` clears the logo;
 * `brandColor` can never be cleared (omit the key to leave it unchanged).
 *
 * Read everywhere: this same `branding: { logoUrl, brandColor }` object is
 * nested on the register list/detail responses AND inherited live into every
 * event served under this register — a rebrand here restyles the register's
 * events and its live control room immediately, no cache lag.
 *
 * Non-editors (Event Manager / Viewer / Judge) see a read-only preview —
 * the PATCH is CLIENT_ADMIN/ADMIN only, but branding itself isn't secret.
 */

import { useRef, useState, useEffect } from "react";
import { Upload, Loader2, Palette, X, ImageOff, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUploadToCloudinary } from "@/api/registrars";
import { useUpdateRegisterBranding } from "@/api/registers";
import type { RegisterBranding } from "@/types/super-admin";
import { DEFAULT_BRAND_COLOR } from "@/lib/utils";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 5 * 1_048_576; // 5 MB

export function RegisterBrandingSection({
  registerId,
  branding,
  canEdit,
}: {
  registerId: string;
  branding?: RegisterBranding;
  /** True for CLIENT_ADMIN / ADMIN — the two roles the PATCH endpoint allows. */
  canEdit: boolean;
}) {
  const fileRef       = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const logoUrl    = branding?.logoUrl ?? null;
  // brandColor is never null on the wire once backend is live, but guard
  // against an empty string / stale cache the same way the default applies.
  const savedColor = branding?.brandColor || DEFAULT_BRAND_COLOR;

  const [localColor, setLocalColor] = useState(savedColor);
  const [colorError, setColorError] = useState<string | null>(null);
  const [logoError,  setLogoError]  = useState<string | null>(null);

  // Keep the colour input in sync when the register data (re)loads
  useEffect(() => { setLocalColor(savedColor); setColorError(null); }, [savedColor]);

  const uploadFile     = useUploadToCloudinary();
  const updateBranding = useUpdateRegisterBranding();

  const colorDirty  = localColor.toUpperCase() !== savedColor.toUpperCase();
  const savingLogo  = uploadFile.isPending ||
    (updateBranding.isPending && (updateBranding.variables as any)?.logoUrl !== undefined);
  const savingColor = updateBranding.isPending &&
    (updateBranding.variables as any)?.brandColor !== undefined && !savingLogo;

  function handleColorChange(v: string) {
    setLocalColor(v);
    setColorError(v && !HEX_RE.test(v) ? "Enter a valid 6-digit hex colour, e.g. #1a6b3c." : null);
  }

  function handleSaveColor() {
    if (!HEX_RE.test(localColor)) {
      setColorError("Enter a valid 6-digit hex colour, e.g. #1a6b3c.");
      return;
    }
    updateBranding.mutate({ registerId, brandColor: localColor });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setLogoError("Only PNG, JPG, WebP, or SVG images are supported.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLogoError("Image must be 5 MB or smaller.");
      return;
    }

    // Step 1: POST /api/v1/upload → fileUrl. Step 2: PATCH branding { logoUrl }.
    uploadFile.mutate(file, {
      onSuccess: ({ fileUrl }) => {
        if (!fileUrl) { setLogoError("Upload failed — no URL returned."); return; }
        updateBranding.mutate({ registerId, logoUrl: fileUrl });
      },
      onError: () => setLogoError("Upload failed. Please try again."),
    });
  }

  function handleRemoveLogo() {
    updateBranding.mutate({ registerId, logoUrl: null });
  }

  return (
    <Card className="attend-card p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-[hsl(var(--foreground))] text-base">Branding</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
          Logo and brand colour — inherited by every event under this register, live.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Logo ── */}
        <div className="flex flex-col items-center gap-3 lg:border-r lg:border-[hsl(var(--border))] lg:pr-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] self-start">
            Register Logo
          </p>

          <div
            className="h-24 w-24 rounded-2xl border-2 border-[hsl(var(--border))] overflow-hidden flex items-center justify-center shrink-0"
            style={{ backgroundColor: logoUrl ? "transparent" : localColor + "18" }}
          >
            {savingLogo ? (
              <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Register logo" className="h-full w-full object-contain" />
            ) : (
              <ImageOff className="h-6 w-6 text-[hsl(var(--muted-foreground))] opacity-40" />
            )}
          </div>

          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex items-center gap-2 w-full">
                <Button
                  variant="outline" size="sm" className="flex-1 gap-1.5 text-xs"
                  disabled={savingLogo}
                  onClick={() => fileRef.current?.click()}
                >
                  {savingLogo
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                    : <><Upload className="h-3.5 w-3.5" /> {logoUrl ? "Change" : "Upload"}</>}
                </Button>
                {logoUrl && !savingLogo && (
                  <Button
                    variant="outline" size="sm" className="gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleRemoveLogo}
                    title="Clear logo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] text-center leading-snug">
                PNG, JPEG, WEBP or SVG · max 5 MB
              </p>
              {logoError && (
                <p className="text-[11px] text-red-600 text-center leading-snug">{logoError}</p>
              )}
            </>
          )}
        </div>

        {/* ── Brand colour ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] block mb-1.5">
              Brand Colour
            </Label>

            {canEdit ? (
              <>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    className="h-10 w-10 rounded-lg border-2 border-[hsl(var(--border))] shrink-0 cursor-pointer hover:scale-105 transition-transform disabled:cursor-not-allowed"
                    style={{ backgroundColor: HEX_RE.test(localColor) ? localColor : savedColor }}
                    title="Pick colour"
                  />
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={HEX_RE.test(localColor) ? localColor : savedColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="sr-only"
                  />
                  <Input
                    value={localColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    placeholder={DEFAULT_BRAND_COLOR}
                    className="font-mono uppercase flex-1"
                    maxLength={7}
                  />
                  {colorDirty && (
                    <Button
                      size="sm" className="gap-1.5 shrink-0"
                      disabled={savingColor || !!colorError}
                      onClick={handleSaveColor}
                    >
                      {savingColor
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Palette className="h-3.5 w-3.5" />}
                      {savingColor ? "Saving…" : "Save Colour"}
                    </Button>
                  )}
                </div>
                {colorError ? (
                  <p className="text-[11px] text-red-600 mt-1.5">{colorError}</p>
                ) : (
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5">
                    Applied to this register's events and live control room. Defaults to{" "}
                    <span className="font-mono">{DEFAULT_BRAND_COLOR}</span> until changed — this field can't be cleared, only replaced.
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg border-2 border-[hsl(var(--border))] shrink-0"
                  style={{ backgroundColor: savedColor }}
                />
                <span className="text-sm font-mono uppercase text-[hsl(var(--foreground))]">{savedColor}</span>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ backgroundColor: (canEdit ? localColor : savedColor) + "12", border: `1px solid ${(canEdit ? localColor : savedColor)}30` }}
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ backgroundColor: canEdit ? localColor : savedColor }}>
              {logoUrl
                ? <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                : <Check className="h-4 w-4 text-white" />}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: canEdit ? localColor : savedColor }}>
                Event &amp; live-room accent preview
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                This is how the brand colour appears across this register's events.
              </p>
            </div>
          </div>

          {!canEdit && (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Only a Client Admin or Admin on this organisation can change branding.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

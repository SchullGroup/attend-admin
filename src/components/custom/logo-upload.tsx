"use client";

/**
 * LogoUpload — two-step logo uploader for registrar profiles.
 *
 * Flow:
 *   1. User selects an image file (PNG / JPG / WebP, max 5 MB).
 *   2. File is uploaded to Cloudinary: POST /api/v1/upload?folder=logos.
 *   3. Returned fileUrl is saved: PUT /api/v1/admin/registrars/{id}/logo.
 *
 * Props:
 *   registrarId  — target registrar UUID
 *   currentLogoUrl — pre-existing logo URL for preview
 *   initials     — fallback 1–2 letter string shown when no logo is set
 */

import { useRef, useState } from "react";
import { Upload, Loader2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useUploadToCloudinary,
  useUpdateRegistrarLogo,
} from "@/api/registrars";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES     = 5 * 1_048_576; // 5 MB

interface LogoUploadProps {
  registrarId:    string;
  currentLogoUrl?: string | null;
  initials:       string;
  /** Called with the new URL after a successful save, so parent can update its own state. */
  onUploaded?:   (url: string) => void;
}

export function LogoUpload({
  registrarId,
  currentLogoUrl,
  initials,
  onUploaded,
}: LogoUploadProps) {
  const fileRef            = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const cloudinaryMutation = useUploadToCloudinary();
  const logoMutation       = useUpdateRegistrarLogo();

  const isUploading = cloudinaryMutation.isPending || logoMutation.isPending;

  // ── File validation + local preview ──────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PNG, JPG, and WebP images are supported.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Start the two-step upload
    cloudinaryMutation.mutate(file, {
      onSuccess: ({ fileUrl }) => {
        logoMutation.mutate(
          { id: registrarId, logoUrl: fileUrl },
          {
            onSuccess: () => onUploaded?.(fileUrl),
            onError:   () => setPreview(null),
          }
        );
      },
      onError: () => {
        setPreview(null);
        e.target.value = "";
      },
    });
  }

  const displaySrc = preview ?? currentLogoUrl ?? null;

  return (
    <div className="relative group w-fit">
      {/* Avatar / logo preview */}
      <div
        className="h-16 w-16 rounded-2xl overflow-hidden flex items-center justify-center
                   bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))] text-lg font-bold
                   cursor-pointer select-none transition-opacity"
        onClick={() => !isUploading && fileRef.current?.click()}
        title="Click to change logo"
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt="Registrar logo"
            className="h-full w-full object-contain"
          />
        ) : (
          <span>{initials}</span>
        )}

        {/* Hover overlay */}
        {!isUploading && (
          <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100
                          transition-opacity flex items-center justify-center">
            <Camera className="h-5 w-5 text-white" />
          </div>
        )}

        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Upload button — shown below avatar */}
      <Button
        size="sm"
        variant="outline"
        className="mt-2 h-7 text-xs w-full gap-1 px-2"
        disabled={isUploading}
        onClick={() => fileRef.current?.click()}
      >
        {isUploading ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</>
        ) : (
          <><Upload className="h-3 w-3" /> {currentLogoUrl || preview ? "Change" : "Upload"}</>
        )}
      </Button>

      {/* Step indicator */}
      {isUploading && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center mt-1 whitespace-nowrap">
          {cloudinaryMutation.isPending ? "Uploading image…" : "Saving logo…"}
        </p>
      )}

      {/* Validation error */}
      {error && (
        <div className="mt-2 flex items-start gap-1.5 p-2 rounded-lg bg-red-50 border border-red-200">
          <X className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-600 leading-tight">{error}</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { parseAndToastApiError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";

interface ImageUrlUploadProps {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  disabled?: boolean;
  label?: string;
  helpText?: string;
}

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

function resolveImageUrl(url: string): string {
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return new URL(url, apiBaseUrl).toString();
}

export function ImageUrlUpload({
  value = "",
  onChange,
  folder = "event-flyers",
  disabled = false,
  label = "Flyer image",
  helpText = "JPG, PNG or WebP only. Maximum file size: 4 MB.",
}: ImageUrlUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [value, localPreview]);

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    };
  }, []);

  function clearLocalPreview() {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null;
    setLocalPreview("");
  }

  function removeFlyer() {
    clearLocalPreview();
    onChange("");
  }

  async function handleFile(file?: File) {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      parseAndToastApiError(null, "Please choose a JPG, PNG or WebP image.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      parseAndToastApiError(null, "The image must be smaller than 5 MB (maximum 4 MB).");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    clearLocalPreview();
    const objectUrl = URL.createObjectURL(file);
    localPreviewRef.current = objectUrl;
    setLocalPreview(objectUrl);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiClient.post("/api/v1/upload", form, {
        params: { folder },
        headers: { "Content-Type": undefined },
      });
      const data = res.data?.data ?? res.data ?? {};
      const uploadedUrl =
        data.fileUrl ?? data.url ?? data.secure_url ?? data.downloadUrl ?? "";
      const url = uploadedUrl ? resolveImageUrl(uploadedUrl) : "";
      if (!url) throw new Error("The upload completed without returning a file URL.");
      onChange(url);
    } catch (error) {
      clearLocalPreview();
      parseAndToastApiError(error, "Flyer upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{helpText}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="gap-1.5 shrink-0"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
        </Button>
      </div>

      {(value || localPreview) && (
        <div className="overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
          <div className="relative flex h-56 w-full items-center justify-center bg-[hsl(var(--muted)/0.35)]">
            {previewFailed ? (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-[hsl(var(--muted-foreground))]">
                <ImageOff className="h-7 w-7" />
                <p className="text-sm font-medium">Image preview unavailable</p>
                <p className="text-xs">Replace the image or remove it before saving.</p>
              </div>
            ) : (
              <>
                {/* External Cloudinary/API URLs are intentionally rendered with img. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localPreview || resolveImageUrl(value)}
                  alt="Product launch flyer preview"
                  className="h-full w-full object-contain"
                  onError={() => setPreviewFailed(true)}
                />
              </>
            )}
          </div>
          {!disabled && (
            <div className="flex min-h-11 items-center justify-end border-t border-[hsl(var(--border))] px-3 py-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={removeFlyer}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove image
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
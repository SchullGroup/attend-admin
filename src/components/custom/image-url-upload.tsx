"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
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

export function ImageUrlUpload({
  value = "",
  onChange,
  folder = "event-flyers",
  disabled = false,
  label = "Flyer image",
  helpText = "Upload a JPG, PNG or WebP image. The uploaded URL will be saved with the event.",
}: ImageUrlUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      parseAndToastApiError(null, "Please choose an image file.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiClient.post("/api/v1/upload", form, {
        params: { folder },
        headers: { "Content-Type": undefined },
      });
      const data = res.data?.data ?? res.data ?? {};
      const url = data.fileUrl ?? data.url ?? data.secure_url ?? "";
      if (!url) throw new Error("The upload completed without returning a file URL.");
      onChange(url);
    } catch (error) {
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
          accept="image/jpeg,image/png,image/webp,image/gif"
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

      {value && (
        <div className="relative overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.35)]">
          {/* External Cloudinary/API URLs are intentionally rendered with img. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Product launch flyer preview" className="max-h-64 w-full object-contain" />
          {!disabled && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-2 h-8 w-8"
              aria-label="Remove flyer"
              onClick={() => onChange("")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
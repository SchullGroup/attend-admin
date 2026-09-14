"use client";
/**
 * EventLaunchMediaTab — image and video gallery, every event type.
 *
 * The endpoints are still spelled `launch-media`: that is a historical name, not a
 * restriction. The backend dropped the PRODUCT_LAUNCH type guard on 2026-09-14 and the rows
 * key off the event, so AGMs, challenges and general events all use these same paths. The
 * component name is kept for the same reason the path was — renaming buys nothing.
 *
 * Upload is a direct browser PUT to object storage, so a launch film is not
 * bound by the 25MB API limit or the nginx body limit — only by the 15MB image
 * / 500MB video caps the server enforces on the size declared up front.
 *
 * Read URLs are signed and expire in about an hour; the query re-reads them
 * before that happens, so nothing here caches or stores a `url`.
 *
 * Client admin only — there is no /admin read path for this gallery, so the
 * tab is not offered to super admin. Viewer gets it read-only.
 */
import { useRef, useState } from "react";
import { Image as ImageIcon, Film, Upload, Trash2, Lock, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { UploadProgress } from "@/components/ui/upload-progress";
import { toast } from "sonner";
import { popup } from "@/lib/popup-store";
import {
  useLaunchMedia,
  useUploadLaunchMedia,
  useDeleteLaunchMedia,
  validateLaunchMediaFile,
  formatMediaSize,
  LAUNCH_MEDIA_ACCEPT,
  type LaunchMediaAsset,
} from "@/api/client-launch-media";

function MediaTile({
  asset,
  readOnly,
  onDelete,
  deleting,
}: {
  asset:    LaunchMediaAsset;
  readOnly: boolean;
  onDelete: (asset: LaunchMediaAsset) => void;
  deleting: boolean;
}) {
  const label = asset.title || asset.originalFilename || "Untitled";
  const pending = asset.status !== "READY" || !asset.url;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden bg-[hsl(var(--card))] flex flex-col">
      <div className="relative aspect-video bg-[hsl(var(--muted))] flex items-center justify-center">
        {pending ? (
          // An asset whose upload never landed. It is on the organiser list
          // (and nowhere else) precisely so it can be seen and removed.
          <div className="flex flex-col items-center gap-1.5 px-4 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-xs font-medium text-[hsl(var(--foreground))]">Upload didn&apos;t finish</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
              Not visible to attendees. Delete it and upload again.
            </p>
          </div>
        ) : asset.mediaType === "VIDEO" ? (
          <video
            src={asset.url!}
            controls
            preload="metadata"
            className="h-full w-full object-contain bg-black"
          />
        ) : (
          <img src={asset.url!} alt={label} className="h-full w-full object-cover" />
        )}

        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {asset.mediaType === "VIDEO" ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          {asset.mediaType === "VIDEO" ? "Video" : "Image"}
        </span>
      </div>

      <div className="flex items-start gap-2 px-3 py-2.5 border-t border-[hsl(var(--border))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]" title={label}>
            {label}
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
            {[formatMediaSize(asset.sizeBytes), asset.contentType].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            title="Delete"
            disabled={deleting}
            onClick={() => onDelete(asset)}
            className="shrink-0 rounded-md p-1.5 text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function EventLaunchMediaTab({
  eventId,
  readOnly = false,
}: {
  eventId:   string;
  readOnly?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: assets, isLoading } = useLaunchMedia(eventId);
  const uploadMutation = useUploadLaunchMedia();
  const deleteMutation = useDeleteLaunchMedia();

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title,       setTitle]       = useState("");
  const [percent,     setPercent]     = useState(0);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const uploading = uploadMutation.isPending;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const rejection = validateLaunchMediaFile(file);
    if (rejection) {
      toast.error(rejection);
      return;
    }
    setPendingFile(file);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  function handleUpload() {
    if (!pendingFile) return;
    setPercent(0);
    uploadMutation.mutate(
      {
        eventId,
        file: pendingFile,
        title: title.trim() || undefined,
        onUploadProgress: setPercent,
      },
      {
        onSuccess: () => {
          setPendingFile(null);
          setTitle("");
          setPercent(0);
        },
        onSettled: () => setPercent(0),
      }
    );
  }

  function confirmDelete(asset: LaunchMediaAsset) {
    const label = asset.title || asset.originalFilename || "this asset";
    popup.confirm(
      "Delete Media",
      `Delete ${label}? The stored file is removed too, and it disappears from the event page immediately.`,
      () => {
        setDeletingId(asset.id);
        deleteMutation.mutate(
          { eventId, mediaId: asset.id },
          { onSettled: () => setDeletingId(null) }
        );
      },
      undefined,
      "Delete Media"
    );
  }

  if (isLoading) return <Loader variant="page" text="Loading launch media…" />;

  const items    = assets ?? [];
  const pendingCount = items.filter((a) => a.status !== "READY").length;

  return (
    <div className="flex flex-col gap-5">
      <Card className="attend-card">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Launch Media</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {items.length} {items.length === 1 ? "asset" : "assets"}
            {pendingCount > 0 ? ` · ${pendingCount} incomplete` : ""}
          </span>
          {readOnly && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Lock className="h-3 w-3" /> read-only
            </span>
          )}
        </div>

        {!readOnly && (
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex flex-col gap-3">
            <input
              ref={fileRef}
              type="file"
              accept={LAUNCH_MEDIA_ACCEPT}
              className="hidden"
              onChange={handleFileChange}
            />

            {!pendingFile ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> Add Photo or Video
                </Button>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  JPEG, PNG, WebP or GIF up to 15 MB · MP4, WebM or MOV up to 500 MB
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                      Title
                    </label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Teaser film"
                      disabled={uploading}
                      className="mt-1"
                    />
                  </div>
                  <Button size="sm" className="gap-2" disabled={uploading} onClick={handleUpload}>
                    {uploading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                      : <><Upload className="h-3.5 w-3.5" /> Upload</>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={() => { setPendingFile(null); setTitle(""); }}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {pendingFile.name} · {formatMediaSize(pendingFile.size)}
                </p>
                {uploading && <UploadProgress percent={percent} label="Uploading to storage…" />}
              </>
            )}
          </div>
        )}

        <div className="p-5">
          {items.length === 0 ? (
            <div className="py-10 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-[hsl(var(--muted-foreground))] opacity-40" />
              <p className="mt-2 text-sm font-medium text-[hsl(var(--foreground))]">No media yet</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Photos and videos added here appear in the gallery on the event page.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((asset) => (
                <MediaTile
                  key={asset.id}
                  asset={asset}
                  readOnly={readOnly}
                  deleting={deletingId === asset.id}
                  onDelete={confirmDelete}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
        Media is served from private storage through links that expire after about an hour — this page
        refreshes them on its own, so leave it open rather than copying a link out of it. Assets appear
        in upload order; there is no drag-to-reorder yet.
      </p>
    </div>
  );
}

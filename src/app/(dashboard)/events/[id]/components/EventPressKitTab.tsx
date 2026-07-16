"use client";
/**
 * EventPressKitTab — embargoed press materials for Product Launch events (F2).
 *
 * Client admin: upload documents with a release mode (manual or scheduled
 * embargo), release one/all, edit the embargo time before release, delete.
 * Super admin / Viewer: same list, read-only (`readOnly`), super admin reads
 * the /admin endpoint via `isSuperAdmin`.
 */
import { useState } from "react";
import { Upload, FileText, Download, Trash2, Clock, CheckCircle2, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import {
  usePressKit,
  useAdminPressKit,
  useUploadPressKitDoc,
  useUpdatePressKitDoc,
  useReleasePressKitDoc,
  useReleaseAllPressKit,
  useDeletePressKitDoc,
  type ReleaseMode,
  type PressKitDoc,
} from "@/api/client-press-kit";

const MAX_BYTES = 10 * 1_048_576;

function fmtBytes(b?: number) {
  if (!b) return "";
  if (b < 1_048_576) return `${(b / 1_024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function EventPressKitTab({
  eventId,
  readOnly,
  isSuperAdmin,
}: {
  eventId: string;
  readOnly: boolean;
  isSuperAdmin: boolean;
}) {
  const clientQuery = usePressKit(eventId, { enabled: !isSuperAdmin });
  const adminQuery  = useAdminPressKit(eventId, { enabled: isSuperAdmin });
  const { data: docs, isLoading } = isSuperAdmin ? adminQuery : clientQuery;

  const uploadMutation     = useUploadPressKitDoc();
  const updateMutation     = useUpdatePressKitDoc();
  const releaseMutation    = useReleasePressKitDoc();
  const releaseAllMutation = useReleaseAllPressKit();
  const deleteMutation     = useDeletePressKitDoc();

  // ── Upload form state ──
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [title,       setTitle]       = useState("");
  const [releaseMode, setReleaseMode] = useState<ReleaseMode>("MANUAL");
  const [releaseAt,   setReleaseAt]   = useState("");
  const [uploading,   setUploading]   = useState(false);
  // Inline embargo-time edit (docId being edited, or null)
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editTime,    setEditTime]    = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > MAX_BYTES) {
      toast.error("File exceeds the 10 MB limit.");
      return;
    }
    setPendingFile(file);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function handleConfirmUpload() {
    if (!pendingFile || !title.trim()) return;
    if (releaseMode === "SCHEDULED" && !releaseAt) {
      toast.error("Pick a release time, or switch to manual release.");
      return;
    }
    setUploading(true);
    try {
      // Step 1 — binary to the upload proxy (same pattern as event documents)
      const form = new FormData();
      form.append("file", pendingFile);
      const uploadRes = await apiClient.post<any>("/api/v1/upload", form, {
        params: { folder: "press-kit" },
        headers: { "Content-Type": undefined },
        maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 120_000,
      });
      const uploadData = uploadRes.data?.data ?? uploadRes.data ?? {};
      const fileUrl =
        uploadData.fileUrl ?? uploadData.secure_url ?? uploadData.url ?? uploadData.downloadUrl ?? "";
      const cloudinaryPublicId = uploadData.cloudinaryPublicId ?? uploadData.public_id ?? undefined;
      if (!fileUrl) {
        toast.error("Upload failed — no file URL returned.");
        return;
      }

      // Step 2 — metadata to the press-kit endpoint
      uploadMutation.mutate(
        {
          eventId,
          payload: {
            title: title.trim(),
            fileUrl,
            ...(cloudinaryPublicId ? { cloudinaryPublicId } : {}),
            originalFilename: pendingFile.name,
            sizeBytes: pendingFile.size,
            releaseMode,
            ...(releaseMode === "SCHEDULED" ? { releaseAt: new Date(releaseAt).toISOString() } : {}),
          },
        },
        {
          onSuccess: () => {
            setPendingFile(null);
            setTitle("");
            setReleaseMode("MANUAL");
            setReleaseAt("");
          },
        }
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function saveEmbargoTime(doc: PressKitDoc) {
    if (!editTime) return;
    updateMutation.mutate(
      { eventId, docId: doc.id, payload: { releaseMode: "SCHEDULED", releaseAt: new Date(editTime).toISOString() } },
      { onSuccess: () => setEditingId(null) }
    );
  }

  if (isLoading) return <Loader variant="page" text="Loading press kit…" />;

  const embargoedCount = (docs ?? []).filter((d) => !d.released).length;

  return (
    <div className="flex flex-col gap-5">
      <Card className="attend-card">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <FileText className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Digital Press Kit</h2>
          {readOnly && (
            <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Lock className="h-3 w-3" /> read-only
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!readOnly && embargoedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={releaseAllMutation.isPending}
                onClick={() => releaseAllMutation.mutate({ eventId })}
              >
                {releaseAllMutation.isPending ? "Releasing…" : `Release All (${embargoedCount})`}
              </Button>
            )}
            {!readOnly && (
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                  <Upload className="h-3.5 w-3.5" /> Add Document
                </span>
                <input type="file" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>
        </div>

        {/* ── Pending upload form ── */}
        {!readOnly && pendingFile && (
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.3] flex flex-col gap-3">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {pendingFile.name} · {fmtBytes(pendingFile.size)}
            </p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-[hsl(var(--foreground))]">
                <input
                  type="radio"
                  checked={releaseMode === "MANUAL"}
                  onChange={() => setReleaseMode("MANUAL")}
                />
                Embargoed — release manually
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[hsl(var(--foreground))]">
                <input
                  type="radio"
                  checked={releaseMode === "SCHEDULED"}
                  onChange={() => setReleaseMode("SCHEDULED")}
                />
                Scheduled release
              </label>
              {releaseMode === "SCHEDULED" && (
                <input
                  type="datetime-local"
                  value={releaseAt}
                  onChange={(e) => setReleaseAt(e.target.value)}
                  className="px-2 py-1 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPendingFile(null)} disabled={uploading}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmUpload} disabled={uploading || !title.trim()}>
                {uploading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                  </span>
                ) : "Upload"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Document list ── */}
        <div className="divide-y divide-[hsl(var(--border))]">
          {(docs ?? []).length === 0 && (
            <p className="px-5 py-8 text-sm text-[hsl(var(--muted-foreground))] text-center italic">
              No press kit documents yet{readOnly ? "." : " — add embargoed materials for the launch."}
            </p>
          )}
          {(docs ?? []).map((d) => (
            <div key={d.id} className="px-5 py-3.5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{d.title}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {[d.originalFilename, d.sizeBytes ? fmtBytes(d.sizeBytes) : d.sizeLabel, fmtTime(d.createdAt)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              {/* Status chip */}
              {d.released ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 shrink-0">
                  <CheckCircle2 className="h-3 w-3" /> Released{d.releasedAt ? ` ${fmtTime(d.releasedAt)}` : ""}
                </span>
              ) : editingId === d.id && !readOnly ? (
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  <input
                    type="datetime-local"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="px-2 py-1 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={() => saveEmbargoTime(d)} disabled={updateMutation.isPending}>
                    Save
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <button
                  disabled={readOnly}
                  onClick={() => {
                    if (readOnly) return;
                    setEditingId(d.id);
                    setEditTime(d.releaseAt ? d.releaseAt.slice(0, 16) : "");
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 shrink-0 disabled:cursor-default"
                  title={readOnly ? undefined : "Click to set/change the scheduled release time"}
                >
                  <Clock className="h-3 w-3" />
                  {d.releaseMode === "SCHEDULED" && d.releaseAt ? `Embargoed · ${fmtTime(d.releaseAt)}` : "Embargoed"}
                </button>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {d.fileUrl && (
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                )}
                {!readOnly && !d.released && (
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={releaseMutation.isPending}
                    onClick={() => releaseMutation.mutate({ eventId, docId: d.id })}
                  >
                    Release
                  </Button>
                )}
                {!readOnly && (
                  <button
                    onClick={() => deleteMutation.mutate({ eventId, docId: d.id })}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-[hsl(var(--muted))]"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

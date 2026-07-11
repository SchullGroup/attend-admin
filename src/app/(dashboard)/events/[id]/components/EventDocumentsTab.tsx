"use client";
import { useRef, useEffect, useState } from "react";
import { Upload, FileText, Download, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { UploadProgress } from "@/components/ui/upload-progress";
import {
  useClientEventDocuments,
  useUploadEventDocument,
  useDeleteEventDocument,
} from "@/api/client-events";
import {
  useEventDocuments,
  useDownloadEventDocument,
} from "@/api/super-admin";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

// Allowed document type values from the API
const DOC_TYPES = [
  "NOTICE", "AGENDA", "MINUTES", "REPORT",
  "PRESENTATION", "PRESS_KIT", "CERTIFICATE", "OTHER",
] as const;
type DocType = typeof DOC_TYPES[number];

const TYPE_LABEL: Record<DocType, string> = {
  NOTICE: "Notice", AGENDA: "Agenda", MINUTES: "Minutes", REPORT: "Report",
  PRESENTATION: "Presentation", PRESS_KIT: "Press Kit", CERTIFICATE: "Certificate", OTHER: "Other",
};

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

interface Props {
  eventId:       string;
  agmNoticeUrl?: string;
  /** When true, use admin endpoints; otherwise use client endpoints. */
  isAdmin?:      boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1_024)     return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-NG", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function EventDocumentsTab({ eventId, agmNoticeUrl, isAdmin = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile,       setPendingFile]       = useState<File | null>(null);
  const [docType,           setDocType]           = useState<DocType>("REPORT");
  const [uploading,         setUploading]         = useState(false);
  const [uploadProgress,    setUploadProgress]    = useState(0);
  const [noticeRegistered,  setNoticeRegistered]  = useState(false);

  // ── Data hooks — admin vs client ──────────────────────────────────────────
  const {
    data: adminDocs = [],
    isLoading: adminLoading,
  } = useEventDocuments(eventId, { enabled: isAdmin });

  const {
    data: clientDocsRaw,
    isLoading: clientLoading,
  } = useClientEventDocuments(eventId, "", { enabled: !isAdmin });

  const adminDownload  = useDownloadEventDocument();
  const uploadMutation = useUploadEventDocument();
  const deleteMutation = useDeleteEventDocument();

  // Normalise the two possible list shapes
  const docs: any[] = isAdmin
    ? (Array.isArray(adminDocs) ? adminDocs : [])
    : (Array.isArray(clientDocsRaw) ? clientDocsRaw :
       Array.isArray((clientDocsRaw as any)?.documents) ? (clientDocsRaw as any).documents : []);

  const isLoading = isAdmin ? adminLoading : clientLoading;

  // Auto-register AGM notice URL (already on Cloudinary from event creation)
  useEffect(() => {
    if (!agmNoticeUrl || isLoading || noticeRegistered) return;
    const alreadyUploaded = docs.some(
      (d: any) => d.documentType === "NOTICE" || d.title?.toLowerCase().includes("agm notice")
    );
    if (alreadyUploaded) return;
    setNoticeRegistered(true);
    (async () => {
      // Backend 500s (NPE) without sizeBytes, so grab it via a HEAD request
      // to the already-uploaded Cloudinary file before registering it.
      let sizeBytes = 0;
      try {
        const head = await fetch(agmNoticeUrl, { method: "HEAD" });
        const len  = head.headers.get("content-length");
        if (len) sizeBytes = parseInt(len, 10);
      } catch { /* fall back to 0 */ }

      uploadMutation.mutate({
        eventId,
        payload: {
          title: "AGM Notice", documentType: "NOTICE",
          eventId, fileUrl: agmNoticeUrl, originalFilename: "AGM-Notice.pdf",
          sizeBytes,
        },
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agmNoticeUrl, isLoading]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error("Only PDF, DOCX and PPTX files are supported.");
      return;
    }
    if (file.size > 10 * 1_048_576) {
      toast.error("File exceeds the 10 MB limit.");
      return;
    }
    setPendingFile(file);
    setDocType("REPORT");
  }

  async function handleConfirmUpload() {
    if (!pendingFile) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const form = new FormData();
      form.append("file", pendingFile);
      const uploadRes = await apiClient.post<any>(
        "/api/v1/upload", form,
        { params: { folder: "documents" }, headers: { "Content-Type": undefined },
          maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 120_000,
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          },
        }
      );
      const uploadData = uploadRes.data?.data ?? uploadRes.data ?? {};
      const fileUrl    =
        uploadData.fileUrl ?? uploadData.secure_url ??
        uploadData.url     ?? uploadData.downloadUrl ?? "";
      const cloudinaryPublicId =
        uploadData.cloudinaryPublicId ?? uploadData.public_id ?? undefined;

      if (!fileUrl) { toast.error("Upload failed — no file URL returned."); return; }

      const docPayload: Record<string, string | number> = {
        title: pendingFile.name.replace(/\.[^.]+$/, ""),
        documentType: docType, eventId, fileUrl,
        originalFilename: pendingFile.name,
        sizeBytes: pendingFile.size,
      };
      if (cloudinaryPublicId) docPayload.cloudinaryPublicId = cloudinaryPublicId;
      uploadMutation.mutate(
        { eventId, payload: docPayload as any },
        { onSuccess: () => setPendingFile(null) }
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function handleDownload(d: any) {
    // If the list item has a direct URL, use it without a second request
    const directUrl = d.fileUrl ?? d.downloadUrl;
    if (directUrl) {
      const a = document.createElement("a");
      a.href = directUrl;
      a.download = d.originalFilename || d.title;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }
    // Admin path: fetch detail endpoint to get fileUrl
    if (isAdmin) {
      adminDownload.mutate({ eventId, documentId: d.id });
      return;
    }
    // Fallback: open in new tab
    toast.info("No download URL available for this document.");
  }

  const isBusy = uploading || uploadMutation.isPending;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Upload UI — hidden for admin (read-only) ── */}
      {!isAdmin && (
        pendingFile ? (
          <Card className="attend-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{pendingFile.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{formatBytes(pendingFile.size)}</p>
              </div>
              <button
                onClick={() => setPendingFile(null)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
              Document Type
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {DOC_TYPES.map((t) => (
                <button
                  key={t} onClick={() => setDocType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    docType === t
                      ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-transparent hover:border-[hsl(var(--border))]"
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>

            {uploading && (
              <UploadProgress percent={uploadProgress} label={`Uploading ${pendingFile.name}…`} className="mb-4" />
            )}

            <div className="flex gap-2">
              <Button disabled={isBusy} onClick={handleConfirmUpload} className="gap-2">
                {isBusy
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {uploading ? `Uploading… ${uploadProgress}%` : "Saving…"}</>
                  : <><Upload className="h-3.5 w-3.5" /> Upload as {TYPE_LABEL[docType]}</>
                }
              </Button>
              <Button variant="outline" onClick={() => setPendingFile(null)} disabled={isBusy}>
                Cancel
              </Button>
            </div>
          </Card>
        ) : (
          <div
            className="border-2 border-dashed border-[hsl(var(--border))] rounded-2xl p-10 text-center cursor-pointer hover:border-[hsl(var(--primary)/0.5)] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef} type="file" accept=".pdf,.docx,.pptx"
              className="hidden" onChange={handleFileChange}
            />
            <Upload className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">Click to upload a document</p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">PDF, DOCX, PPTX — max 10 MB</p>
          </div>
        )
      )}

      {/* ── Document table ── */}
      <Card className="attend-card overflow-hidden">
        {isLoading ? (
          <div className="p-8"><Loader variant="inline" text="Loading documents…" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Title</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">File Type</th>
                <th className="px-5 py-3 text-left">Size</th>
                <th className="px-5 py-3 text-left">Downloads</th>
                <th className="px-5 py-3 text-left">Uploaded</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const typeKey = ((d.documentType ?? "") as string).toUpperCase() as DocType;
                const label   = TYPE_LABEL[typeKey] ?? d.documentType ?? "—";
                return (
                  <tr key={d.id} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{d.title}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2.5 py-0.5 font-medium">
                        {label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {(d.fileType ?? "—").toUpperCase()}
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {d.sizeLabel || formatBytes(d.sizeBytes)}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium tabular-nums">
                      {(d.downloadCount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {formatDate(d.uploadedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          disabled={adminDownload.isPending}
                          title="Download"
                          onClick={() => handleDownload(d)}
                        >
                          {adminDownload.isPending
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />
                          }
                        </Button>
                        {!isAdmin && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                            disabled={deleteMutation.isPending}
                            title="Delete"
                            onClick={() => deleteMutation.mutate({ eventId, documentId: d.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {docs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    No documents uploaded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

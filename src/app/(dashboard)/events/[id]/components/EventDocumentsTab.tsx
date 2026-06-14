"use client";
import { useRef, useEffect, useState } from "react";
import { Upload, FileText, Download, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import {
  useClientEventDocuments,
  useUploadEventDocument,
  useDeleteEventDocument,
  useDownloadEventDocument,
} from "@/api/client-events";
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
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1_024)     return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function EventDocumentsTab({ eventId, agmNoticeUrl }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pending upload state: file chosen, waiting for type selection
  const [pendingFile,  setPendingFile]  = useState<File | null>(null);
  const [docType,      setDocType]      = useState<DocType>("REPORT");
  const [uploading,    setUploading]    = useState(false);
  const [noticeRegistered, setNoticeRegistered] = useState(false);

  const { data: docs = [], isLoading } = useClientEventDocuments(eventId);
  const uploadMutation   = useUploadEventDocument();
  const deleteMutation   = useDeleteEventDocument();
  const downloadMutation = useDownloadEventDocument();

  // Auto-register AGM notice URL (already on Cloudinary from event creation)
  useEffect(() => {
    if (!agmNoticeUrl || isLoading || noticeRegistered) return;
    const alreadyUploaded = docs.some(
      (d: any) => d.documentType === "NOTICE" || d.title?.toLowerCase().includes("agm notice")
    );
    if (alreadyUploaded) return;
    setNoticeRegistered(true);
    uploadMutation.mutate({
      eventId,
      payload: {
        title: "AGM Notice", documentType: "NOTICE",
        eventId, fileUrl: agmNoticeUrl, originalFilename: "AGM-Notice.pdf",
      },
    });
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
    try {
      // Step 1 — upload to Cloudinary via backend proxy
      const form = new FormData();
      form.append("file", pendingFile);
      const uploadRes = await apiClient.post<any>(
        "/api/v1/upload",
        form,
        {
          params:           { folder: "documents" },
          headers:          { "Content-Type": undefined },
          maxBodyLength:    Infinity,
          maxContentLength: Infinity,
          timeout:          120_000,
        }
      );
      const uploadData         = uploadRes.data?.data ?? uploadRes.data ?? {};
      const fileUrl            =
        uploadData.fileUrl     ?? uploadData.secure_url ??
        uploadData.url         ?? uploadData.downloadUrl ?? "";
      const cloudinaryPublicId =
        uploadData.cloudinaryPublicId ?? uploadData.public_id ?? undefined;

      if (!fileUrl) {
        toast.error("Upload failed — no file URL returned.");
        return;
      }

      // Step 2 — register document with the event
      const docPayload: Record<string, string> = {
        title:            pendingFile.name.replace(/\.[^.]+$/, ""),
        documentType:     docType,
        eventId,
        fileUrl,
        originalFilename: pendingFile.name,
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
    }
  }

  const isBusy = uploading || uploadMutation.isPending;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Type selector (shown after file is picked) ── */}
      {pendingFile ? (
        <Card className="attend-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                {pendingFile.name}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {formatBytes(pendingFile.size)}
              </p>
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
                key={t}
                onClick={() => setDocType(t)}
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

          <div className="flex gap-2">
            <Button
              disabled={isBusy}
              onClick={handleConfirmUpload}
              className="gap-2"
            >
              {isBusy ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-3.5 w-3.5" /> Upload as {TYPE_LABEL[docType]}</>
              )}
            </Button>
            <Button variant="outline" onClick={() => setPendingFile(null)} disabled={isBusy}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        /* ── Drop zone ── */
        <div
          className="border-2 border-dashed border-[hsl(var(--border))] rounded-2xl p-10 text-center cursor-pointer hover:border-[hsl(var(--primary)/0.5)] transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.pptx"
            className="hidden"
            onChange={handleFileChange}
          />
          <Upload className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            Click to upload a document
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            PDF, DOCX, PPTX — max 10 MB
          </p>
        </div>
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
                <th className="px-5 py-3 text-left">Size</th>
                <th className="px-5 py-3 text-left">Downloads</th>
                <th className="px-5 py-3 text-left">Uploaded</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const typeKey = ((d.documentType ?? "") as string).toUpperCase() as DocType;
                const label   = TYPE_LABEL[typeKey] ?? d.documentType ?? d.fileType ?? "—";
                return (
                  <tr key={d.id} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {d.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2.5 py-0.5 font-medium">
                        {label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {d.sizeLabel || formatBytes(d.sizeBytes)}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium tabular-nums">
                      {(d.downloadCount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString("en-NG", {
                        day: "numeric", month: "short", year: "numeric",
                      }) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          disabled={downloadMutation.isPending}
                          title="Download"
                          onClick={() => {
                            const directUrl = (d as any).fileUrl ?? (d as any).downloadUrl;
                            if (directUrl) {
                              const a = document.createElement("a");
                              a.href = directUrl;
                              a.download = d.originalFilename || d.title;
                              a.target = "_blank";
                              a.rel = "noopener noreferrer";
                              a.click();
                            } else {
                              downloadMutation.mutate({ eventId, documentId: d.id });
                            }
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                          disabled={deleteMutation.isPending}
                          title="Delete"
                          onClick={() => deleteMutation.mutate({ eventId, documentId: d.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {docs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
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

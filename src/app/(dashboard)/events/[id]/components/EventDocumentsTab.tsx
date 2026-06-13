"use client";
import { useRef, useEffect, useState } from "react";
import { Upload, FileText, Download, Trash2, Loader2 } from "lucide-react";
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

interface Props {
  eventId:       string;
  /** AGM notice URL from agmConfig — if present, auto-registers on first load */
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
  const [uploading,  setUploading]  = useState(false);
  const [noticeRegistered, setNoticeRegistered] = useState(false);

  const { data: docs = [], isLoading } = useClientEventDocuments(eventId);
  const uploadMutation   = useUploadEventDocument();
  const deleteMutation   = useDeleteEventDocument();
  const downloadMutation = useDownloadEventDocument();

  // Auto-register AGM notice URL (already uploaded to Cloudinary during creation)
  useEffect(() => {
    if (!agmNoticeUrl || isLoading || noticeRegistered) return;
    const alreadyUploaded = docs.some(
      (d: any) => d.documentType === "AGM_NOTICE" || d.title?.toLowerCase().includes("agm notice")
    );
    if (alreadyUploaded) return;

    setNoticeRegistered(true);
    uploadMutation.mutate({
      eventId,
      payload: {
        title:            "AGM Notice",
        documentType:     "AGM_NOTICE",
        eventId,
        fileUrl:          agmNoticeUrl,
        originalFilename: "AGM-Notice.pdf",
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agmNoticeUrl, isLoading]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg", "image/png",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF, DOCX, PPTX, JPG and PNG files are supported.");
      return;
    }
    if (file.size > 50 * 1_048_576) {
      toast.error("File exceeds the 50 MB limit.");
      return;
    }

    setUploading(true);
    try {
      // Step 1 — upload file to Cloudinary via backend proxy
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await apiClient.post<any>(
        "/api/v1/upload",
        form,
        {
          params:           { folder: "documents" },
          headers:          { "Content-Type": "multipart/form-data" },
          maxBodyLength:    Infinity,
          maxContentLength: Infinity,
          timeout:          120_000,
        }
      );
      const uploadData = uploadRes.data?.data ?? uploadRes.data ?? {};
      const fileUrl    = uploadData.fileUrl ?? uploadData.url ?? uploadData.secure_url ?? "";

      if (!fileUrl) {
        toast.error("Upload failed — no file URL returned.");
        return;
      }

      // Step 2 — register the document with the event
      uploadMutation.mutate({
        eventId,
        payload: {
          title:            file.name.replace(/\.[^.]+$/, ""),
          documentType:     "GENERAL",
          eventId,
          fileUrl,
          originalFilename: file.name,
        },
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  const isBusy = uploading || uploadMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-[hsl(var(--border))] rounded-2xl p-10 text-center cursor-pointer hover:border-[hsl(var(--primary)/0.5)] transition-colors"
        onClick={() => !isBusy && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileChange}
        />
        {isBusy ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {uploading ? "Uploading to cloud storage…" : "Registering document…"}
            </p>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">
              Click to upload a document
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              PDF, DOCX, PPTX, JPG, PNG — max 50 MB
            </p>
          </>
        )}
      </div>

      {/* Document table */}
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
              {docs.map((d) => (
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
                    <span className="text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2.5 py-0.5 capitalize font-medium">
                      {(d.documentType ?? d.fileType ?? "—").replace(/_/g, " ")}
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
                      {/* Download — open Cloudinary URL directly if available */}
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
                      {/* Delete */}
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
              ))}
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

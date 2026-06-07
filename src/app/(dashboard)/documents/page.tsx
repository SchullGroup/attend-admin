"use client";
import { useState } from "react";
import {
  Download,
  FileText,
  FileBarChart,
  Bell,
  BookOpen,
  Award,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Loader } from "@/components/ui/Loader";
import {
  useGlobalDocuments,
  useDownloadEventDocument,
} from "@/api/super-admin";

const TYPE_FILTERS = [
  { label: "All", value: "" },
  { label: "Notice", value: "NOTICE" },
  { label: "Agenda", value: "AGENDA" },
  { label: "Minutes", value: "MINUTES" },
  { label: "Report", value: "REPORT" },
  { label: "Press Kit", value: "PRESS_KIT" },
  { label: "Certificate", value: "CERTIFICATE" },
];

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; color: string }
> = {
  NOTICE: { label: "Notice", icon: Bell, bg: "#dbeafe", color: "#1d4ed8" },
  AGENDA: { label: "Agenda", icon: BookOpen, bg: "#dcfce7", color: "#16a34a" },
  MINUTES: {
    label: "Minutes",
    icon: FileText,
    bg: "#f3f4f6",
    color: "#6b7280",
  },
  REPORT: {
    label: "Report",
    icon: FileBarChart,
    bg: "#fef9c3",
    color: "#a16207",
  },
  PRESS_KIT: {
    label: "Press Kit",
    icon: Package,
    bg: "#f3e8ff",
    color: "#7c22c9",
  },
  CERTIFICATE: {
    label: "Certificate",
    icon: Award,
    bg: "#fff4eb",
    color: "#ea6c00",
  },
};

function triggerBase64Download(
  base64Data: string,
  filename: string,
  mimeType: string,
) {
  try {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  } catch (err) {
    console.error("Failed to decode base64 file", err);
    toast.error("Failed to download file. Document file data is invalid.");
  }
}

export default function DocumentsPage() {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useGlobalDocuments("", "", filter, page, 20);
  const downloadDocMutation = useDownloadEventDocument();

  const handleDownload = (
    eventId: string,
    docId: string,
    title: string,
    originalFilename?: string,
    fileType?: string,
    mimeType?: string,
  ) => {
    if (!eventId) {
      toast.error("Event ID is missing for this document.");
      return;
    }
    const filename =
      originalFilename || `${title}.${(fileType || "pdf").toLowerCase()}`;
    const resolvedMime = mimeType || "application/octet-stream";

    toast.loading(`Downloading ${title}...`, { id: docId });
    downloadDocMutation.mutate(
      { eventId, documentId: docId },
      {
        onSuccess: (resData: any) => {
          const base64Content = resData?.data?.fileData;
          if (base64Content) {
            triggerBase64Download(
              base64Content,
              filename,
              resData?.data?.mimeType || resolvedMime,
            );
            toast.dismiss(docId);
          } else {
            toast.error("No file content found in the document.", {
              id: docId,
            });
          }
        },
        onError: (err: any) => {
          toast.error(
            err?.response?.data?.message || "Failed to download document.",
            { id: docId },
          );
        },
      },
    );
  };

  if (isLoading) {
    return <Loader variant="page" text="Loading Documents..." />;
  }

  const documents = data?.data?.content || [];
  const totalElements = data?.data?.totalElements || 0;
  const totalPages = data?.data?.totalPages || 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Global Document Vault
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {totalElements} total documents across all platform events
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-fit mb-4 overflow-x-auto">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(0);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f.value
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Document</th>
              <th className="px-5 py-3 text-left">Type</th>
              <th className="px-5 py-3 text-left">Event</th>
              <th className="px-5 py-3 text-left">File Size</th>
              <th className="px-5 py-3 text-left">Downloads</th>
              <th className="px-5 py-3 text-left">Uploaded</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => {
              const docType = (
                doc.documentType ||
                doc.type ||
                "NOTICE"
              ).toUpperCase();
              const typeConfig = TYPE_CONFIG[docType] ?? TYPE_CONFIG.NOTICE;
              const TypeIcon = typeConfig.icon;
              const eventTitle = doc.eventName || doc.eventTitle || "—";
              const sizeLabel = doc.sizeLabel || doc.fileSize || "—";
              return (
                <tr key={doc.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: typeConfig.bg }}
                      >
                        <TypeIcon
                          className="h-4 w-4"
                          style={{ color: typeConfig.color }}
                        />
                      </div>
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                        {doc.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        backgroundColor: typeConfig.bg,
                        color: typeConfig.color,
                      }}
                    >
                      {typeConfig.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[180px] truncate">
                    {eventTitle}
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-[hsl(var(--muted-foreground))]">
                    {sizeLabel}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums">
                    {doc.downloadCount?.toLocaleString() || 0}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {formatDate(doc.uploadedAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 hover:bg-[hsl(var(--primary)/0.05)] hover:text-[hsl(var(--primary))] transition-colors"
                        onClick={() =>
                          handleDownload(
                            doc.eventId,
                            doc.id,
                            doc.title,
                            doc.originalFilename,
                            doc.fileType,
                            doc.mimeType,
                          )
                        }
                        disabled={downloadDocMutation.isPending}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {documents.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No documents found for this type.
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border)/0.6)]">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

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
import { useGlobalDocuments } from "@/api/super-admin";

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

export default function DocumentsPage() {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useGlobalDocuments("", "", filter, page, 20);

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
              const typeConfig = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.NOTICE;
              const TypeIcon = typeConfig.icon;
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
                    {doc.eventTitle}
                  </td>
                  <td className="px-5 py-3 text-sm font-mono text-[hsl(var(--muted-foreground))]">
                    {doc.fileSize}
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
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          if (doc.url) {
                            window.open(doc.url, "_blank");
                          } else {
                            toast.error("Download URL not available");
                          }
                        }}
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

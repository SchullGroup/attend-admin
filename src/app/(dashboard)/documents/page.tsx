"use client";
import { useState } from "react";
import { Upload, Download, Trash2, FileText, FileBarChart, Bell, BookOpen, Award, Package } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const TYPE_FILTERS = [
  { label: "All", value: "all" },
  { label: "Notice", value: "notice" },
  { label: "Agenda", value: "agenda" },
  { label: "Minutes", value: "minutes" },
  { label: "Report", value: "report" },
  { label: "Press Kit", value: "press_kit" },
  { label: "Certificate", value: "certificate" },
];

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; color: string }> = {
  notice: { label: "Notice", icon: Bell, bg: "#dbeafe", color: "#1d4ed8" },
  agenda: { label: "Agenda", icon: BookOpen, bg: "#dcfce7", color: "#16a34a" },
  minutes: { label: "Minutes", icon: FileText, bg: "#f3f4f6", color: "#6b7280" },
  report: { label: "Report", icon: FileBarChart, bg: "#fef9c3", color: "#a16207" },
  press_kit: { label: "Press Kit", icon: Package, bg: "#f3e8ff", color: "#7c22c9" },
  certificate: { label: "Certificate", icon: Award, bg: "#fff4eb", color: "#ea6c00" },
};

export default function DocumentsPage() {
  const { documents } = useStore();
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? documents : documents.filter((d) => d.type === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Document Vault</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{documents.length} documents · {documents.reduce((s, d) => s + d.downloadCount, 0).toLocaleString()} total downloads</p>
        </div>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-fit mb-4">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
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
            {filtered.map((doc) => {
              const typeConfig = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.notice;
              const TypeIcon = typeConfig.icon;
              return (
                <tr key={doc.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: typeConfig.bg }}
                      >
                        <TypeIcon className="h-4 w-4" style={{ color: typeConfig.color }} />
                      </div>
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}
                    >
                      {typeConfig.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[180px] truncate">{doc.eventTitle}</td>
                  <td className="px-5 py-3 text-sm font-mono text-[hsl(var(--muted-foreground))]">{doc.fileSize}</td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums">{doc.downloadCount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(doc.uploadedAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No documents found for this type.</div>
        )}
      </Card>
    </div>
  );
}

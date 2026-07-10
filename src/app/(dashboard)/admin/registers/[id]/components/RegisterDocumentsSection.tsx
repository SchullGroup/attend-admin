"use client";

import { Download, FolderOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useRegisterDocuments } from "@/api/registers";
import { getDocTypeConfig } from "@/lib/document-type";

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

export function RegisterDocumentsSection({ registerId }: { registerId: string }) {
  const { data: docs = [], isLoading } = useRegisterDocuments(registerId);

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Documents</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            {isLoading ? "Loading…" : `${docs.length} document${docs.length !== 1 ? "s" : ""} on file`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading documents…</div>
      ) : docs.length === 0 ? (
        <div className="py-14 flex flex-col items-center gap-3 text-center">
          <FolderOpen className="h-8 w-8 text-[hsl(var(--muted-foreground))] opacity-25" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No documents on file</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Documents will appear here once uploaded.</p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Document</th>
              <th className="px-5 py-3 text-left hidden md:table-cell">Scope</th>
              <th className="px-5 py-3 text-right hidden sm:table-cell">Size</th>
              <th className="px-5 py-3 text-right hidden md:table-cell">Downloads</th>
              <th className="px-5 py-3 text-left">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {docs.map((doc, i) => {
              const typeConfig = getDocTypeConfig(doc.documentType);
              const TypeIcon   = typeConfig.icon;
              return (
              <tr key={doc.id ?? i} className="attend-table-row">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: typeConfig.bg }}>
                      <TypeIcon className="h-4 w-4" style={{ color: typeConfig.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate max-w-[220px]" title={doc.title}>
                        {doc.title || "Untitled"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-[hsl(var(--muted-foreground))] hidden md:table-cell">
                  {doc.eventTitle ?? "Global Space Notice"}
                </td>
                <td className="px-5 py-3.5 text-right text-xs text-[hsl(var(--muted-foreground))] hidden sm:table-cell tabular-nums">
                  {formatBytes(doc.fileSizeBytes ?? 0)}
                </td>
                <td className="px-5 py-3.5 text-right hidden md:table-cell">
                  <div className="flex items-center justify-end gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                    <Download className="h-3 w-3" />
                    {doc.downloadCount ?? 0}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {doc.uploadedAt ? formatDate(doc.uploadedAt) : "—"}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

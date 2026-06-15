"use client";
import { useState, useRef, useEffect } from "react";
import {
  Upload, Download, Trash2, FileText, FileBarChart, Bell,
  BookOpen, Award, Package, Send, Search, Check, ChevronDown,
  Monitor,
} from "lucide-react";
import { useGetMe } from "@/api/auth/hooks";
import { useGlobalDocuments as useAdminGlobalDocuments } from "@/api/super-admin";
import {
  useGlobalDocuments as useClientGlobalDocuments,
  useDeleteGlobalDocument,
  useDownloadGlobalDocument,
  useUploadGlobalDocument,
  useDocumentEventFilterOptions,
  useDocumentRegisterFilterOptions,
} from "@/api/client-documents";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Allowed documentType values from the API */
const DOC_TYPES = [
  "NOTICE", "AGENDA", "MINUTES", "REPORT",
  "PRESENTATION", "PRESS_KIT", "CERTIFICATE", "OTHER",
] as const;

type DocType = typeof DOC_TYPES[number];

const TYPE_CONFIG: Record<DocType, { label: string; icon: React.ElementType; bg: string; color: string }> = {
  NOTICE:       { label: "Notice",       icon: Bell,        bg: "#dbeafe", color: "#1d4ed8" },
  AGENDA:       { label: "Agenda",       icon: BookOpen,    bg: "#dcfce7", color: "#16a34a" },
  MINUTES:      { label: "Minutes",      icon: FileText,    bg: "#f3f4f6", color: "#6b7280" },
  REPORT:       { label: "Report",       icon: FileBarChart,bg: "#fef9c3", color: "#a16207" },
  PRESENTATION: { label: "Presentation", icon: Monitor,     bg: "#ede9fe", color: "#7c3aed" },
  PRESS_KIT:    { label: "Press Kit",    bg: "#f3e8ff", color: "#7c22c9", icon: Package },
  CERTIFICATE:  { label: "Certificate",  icon: Award,       bg: "#fff4eb", color: "#ea6c00" },
  OTHER:        { label: "Other",        icon: FileText,    bg: "#f3f4f6", color: "#6b7280" },
};

const TYPE_FILTERS = [
  { label: "All",          value: "" },
  { label: "Notice",       value: "NOTICE" },
  { label: "Agenda",       value: "AGENDA" },
  { label: "Minutes",      value: "MINUTES" },
  { label: "Report",       value: "REPORT" },
  { label: "Presentation", value: "PRESENTATION" },
  { label: "Press Kit",    value: "PRESS_KIT" },
  { label: "Certificate",  value: "CERTIFICATE" },
  { label: "Other",        value: "OTHER" },
];

const ADMIN_ROLES = new Set(["super_admin", "event_manager", "kyc_officer", "judge"]);

// ─── EventCombobox ─────────────────────────────────────────────────────────────

function EventCombobox({
  placeholder = "Select an event…",
  options,
  value,
  onChange,
}: {
  placeholder?: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? options.filter((e) => e.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find((e) => e.id === value);

  useEffect(() => {
    function handleOutside(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-left hover:border-[hsl(var(--ring)/0.5)] transition-colors"
      >
        <span className={cn("flex-1 truncate", !selected && "text-[hsl(var(--muted-foreground))]")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 rounded-xl border border-[hsl(var(--border))] bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 px-2 py-0.5">
              <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="flex-1 text-sm bg-transparent outline-none py-1 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">No results.</p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { onChange(e.id); setOpen(false); setQuery(""); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors",
                    value === e.id && "bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))]"
                  )}
                >
                  <span className="w-3.5 shrink-0 flex items-center justify-center">
                    {value === e.id && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className={cn("font-medium", value === e.id ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--foreground))]")}>
                    {e.label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { data: userResponse } = useGetMe();
  const isAdmin = !userResponse?.data || ADMIN_ROLES.has(userResponse.data.role?.toLowerCase() ?? "");

  const [typeFilter,     setTypeFilter]     = useState("");
  const [search,         setSearch]         = useState("");
  const [registerFilter, setRegisterFilter] = useState("");
  const [eventFilter,    setEventFilter]    = useState("");
  const [uploadOpen,     setUploadOpen]     = useState(false);
  const [form,           setForm]           = useState({ title: "", type: "NOTICE" as DocType, eventId: "" });
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client document hooks
  const { data: clientDocsData, isLoading: clientLoading } =
    useClientGlobalDocuments(search, registerFilter, eventFilter, typeFilter, 0, 50);

  // Admin document hook (super admin only)
  const { data: adminDocsData, isLoading: adminLoading } =
    useAdminGlobalDocuments(search, "", typeFilter.toLowerCase(), 0, 50);

  const { data: eventOptions    = [] } = useDocumentEventFilterOptions();
  const { data: registerOptions = [] } = useDocumentRegisterFilterOptions();

  const deleteMutation   = useDeleteGlobalDocument();
  const downloadMutation = useDownloadGlobalDocument();
  const uploadMutation   = useUploadGlobalDocument();

  const isLoading = isAdmin ? adminLoading : clientLoading;

  // Normalise both list response shapes
  const docs: any[] = isAdmin
    ? ((adminDocsData?.data as any)?.content ?? (adminDocsData?.data as any)?.documents ?? [])
    : (clientDocsData?.documents ?? []);

  function handleUpload() {
    if (!form.title || !form.eventId || !selectedFile) return;
    uploadMutation.mutate(
      { file: selectedFile, title: form.title, documentType: form.type, eventId: form.eventId },
      {
        onSuccess: () => {
          setUploadOpen(false);
          setForm({ title: "", type: "NOTICE", eventId: "" });
          setSelectedFile(null);
        },
      }
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Document Vault</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {isLoading ? "Loading…" : `${docs.length} document${docs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {!isAdmin && (
          <Button className="gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        )}
      </div>

      {/* ── Upload dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="attend-section-title mb-1.5 block">Document Title</Label>
              <Input
                placeholder="e.g. Zenith Bank 2026 AGM Notice"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <Label className="attend-section-title mb-1.5 block">Document Type</Label>
              <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      form.type === t
                        ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-transparent hover:border-[hsl(var(--border))]"
                    }`}
                  >
                    {TYPE_CONFIG[t].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="attend-section-title mb-1.5 block">Event</Label>
              <EventCombobox
                options={eventOptions}
                value={form.eventId}
                onChange={(id) => setForm((f) => ({ ...f, eventId: id }))}
              />
            </div>

            <div>
              <Label className="attend-section-title mb-1.5 block">File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <div
                className="border-2 border-dashed border-[hsl(var(--border))] rounded-xl p-6 text-center cursor-pointer hover:border-[hsl(var(--primary)/0.4)] transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))]" />
                {selectedFile ? (
                  <p className="text-sm font-medium text-[hsl(var(--foreground))]">{selectedFile.name}</p>
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">Click to select a file</p>
                )}
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">PDF, DOCX, PPTX — max 10 MB</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button
                disabled={!form.title || !form.eventId || !selectedFile || uploadMutation.isPending}
                onClick={handleUpload}
                className="gap-2"
              >
                {uploadMutation.isPending ? "Uploading…" : <><Send className="h-4 w-4" /> Upload</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Type tabs */}
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 overflow-x-auto">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                typeFilter === f.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Organiser + Event dropdowns (client only) */}
        {!isAdmin && (
          <div className="flex items-center gap-2">
            <select
              value={registerFilter}
              onChange={(e) => setRegisterFilter(e.target.value)}
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              <option value="">All Organisers</option>
              {registerOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              <option value="">All Events</option>
              {eventOptions.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Document</th>
              <th className="px-5 py-3 text-left">Type</th>
              <th className="px-5 py-3 text-left">Event</th>
              <th className="px-5 py-3 text-left">Organiser</th>
              <th className="px-5 py-3 text-left">Size</th>
              <th className="px-5 py-3 text-left">Downloads</th>
              <th className="px-5 py-3 text-left">Uploaded</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc: any) => {
              const typeKey    = ((doc.documentType ?? doc.type ?? "OTHER") as string).toUpperCase() as DocType;
              const typeConfig = TYPE_CONFIG[typeKey] ?? TYPE_CONFIG.OTHER;
              const TypeIcon   = typeConfig.icon;
              return (
                <tr key={doc.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: typeConfig.bg }}>
                        <TypeIcon className="h-4 w-4" style={{ color: typeConfig.color }} />
                      </div>
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">{doc.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}>
                      {typeConfig.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[160px] truncate">
                    {doc.eventName ?? doc.eventTitle ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] max-w-[140px] truncate">
                    {doc.registerName ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {doc.sizeLabel ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums">
                    {(doc.downloadCount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {formatDate(doc.uploadedAt)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs gap-1"
                        disabled={downloadMutation.isPending}
                        onClick={() => {
                          if (doc.fileUrl) {
                            const a = document.createElement("a");
                            a.href = doc.fileUrl;
                            a.download = doc.originalFilename || doc.title;
                            a.target = "_blank";
                            a.rel = "noopener noreferrer";
                            a.click();
                          } else {
                            downloadMutation.mutate(doc.id);
                          }
                        }}
                      >
                        <Download className="h-3 w-3" /> Download
                      </Button>
                      {!isAdmin && (
                        confirmDeleteId === doc.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 bg-red-50 font-semibold hover:bg-red-100"
                              disabled={deleteMutation.isPending}
                              onClick={() => { deleteMutation.mutate(doc.id); setConfirmDeleteId(null); }}
                            >
                              Delete
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setConfirmDeleteId(doc.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {docs.length === 0 && !isLoading && (
          <div className="py-14 text-center">
            <FileText className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No documents found</p>
            {(typeFilter || search || registerFilter || eventFilter) && (
              <button
                onClick={() => { setTypeFilter(""); setSearch(""); setRegisterFilter(""); setEventFilter(""); }}
                className="text-xs text-[hsl(var(--primary))] hover:underline mt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

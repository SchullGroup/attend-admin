"use client";
import { useState, useRef, useEffect } from "react";
import { Upload, Download, Trash2, FileText, FileBarChart, Bell, BookOpen, Award, Package, Send, Search, Check, ChevronDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OrgFilter } from "@/components/custom/org-filter";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  notice: { label: "Notice", icon: Bell, bg: "#dbeafe", color: "#374151" },
  agenda: { label: "Agenda", icon: BookOpen, bg: "#dcfce7", color: "#16a34a" },
  minutes: { label: "Minutes", icon: FileText, bg: "#f3f4f6", color: "#6b7280" },
  report: { label: "Report", icon: FileBarChart, bg: "#fef9c3", color: "#a16207" },
  press_kit: { label: "Press Kit", icon: Package, bg: "#f3e8ff", color: "#7c22c9" },
  certificate: { label: "Certificate", icon: Award, bg: "#fff4eb", color: "#ea6c00" },
};

const DOC_TYPES = ["notice", "agenda", "minutes", "report", "press_kit", "certificate"];

function EventCombobox({
  events,
  value,
  onChange,
}: {
  events: { id: string; title: string; organiser: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? events.filter((e) => `${e.title} ${e.organiser}`.toLowerCase().includes(query.toLowerCase()))
    : events;

  const selected = events.find((e) => e.id === value);

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
          {selected ? selected.title : "Select an event…"}
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
                placeholder="Search events or organiser…"
                className="flex-1 text-sm bg-transparent outline-none py-1 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">No events found.</p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { onChange(e.id); setOpen(false); setQuery(""); }}
                  className={cn(
                    "w-full flex items-start gap-2 px-4 py-2.5 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors",
                    value === e.id && "bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))]"
                  )}
                >
                  <span className="w-3.5 shrink-0 mt-0.5 flex items-center justify-center">
                    {value === e.id && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <div>
                    <p className={cn("font-medium", value === e.id ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--foreground))]")}>{e.title}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{e.organiser}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const { documents, deleteDocument, events } = useStore();
  const [filter, setFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "notice", eventId: "", pushToAttendees: true });
  const [uploading, setUploading] = useState(false);

  const organisers = [...new Set(documents.map((d) => d.organiser).filter(Boolean))].sort() as string[];

  const filtered = documents
    .filter((d) => filter === "all" || d.type === filter)
    .filter((d) => !orgFilter || d.organiser === orgFilter);

  function handleUpload() {
    if (!form.title || !form.eventId) return;
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setUploadOpen(false);
      setForm({ title: "", type: "notice", eventId: "", pushToAttendees: true });
      toast.success("Document uploaded", {
        description: form.pushToAttendees ? "Pushed to all registered attendees' vaults." : "Saved to vault without push.",
      });
    }, 1200);
  }

  const selectedEvent = events?.find?.((e: { id: string }) => e.id === form.eventId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Document Vault</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{documents.length} documents · {documents.reduce((s, d) => s + d.downloadCount, 0).toLocaleString()} total downloads</p>
        </div>
        <Button className="gap-2" onClick={() => setUploadOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">Document Title</Label>
              <Input
                placeholder="e.g. Zenith Bank 2026 AGM Notice"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">Document Type</Label>
              <div className="flex flex-wrap gap-2">
                {DOC_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      form.type === t
                        ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-transparent hover:border-[hsl(var(--border))]"
                    }`}
                  >
                    {t.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">Event</Label>
              <EventCombobox
                events={(events ?? []) as { id: string; title: string; organiser: string }[]}
                value={form.eventId}
                onChange={(id) => setForm((f) => ({ ...f, eventId: id }))}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5 block">File</Label>
              <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-xl p-6 text-center cursor-pointer hover:border-[hsl(var(--primary)/0.4)] transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Click to select a file or drag and drop</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">PDF, DOCX, XLSX up to 50 MB</p>
              </div>
            </div>

            <div
              className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--muted)/0.5)] cursor-pointer"
              onClick={() => setForm((f) => ({ ...f, pushToAttendees: !f.pushToAttendees }))}
            >
              <div>
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">Push to attendee vaults</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  {form.pushToAttendees
                    ? `Will push to ${selectedEvent ? selectedEvent.rsvpCount?.toLocaleString() ?? "all" : "all"} registered attendees`
                    : "Store only — attendees won't be notified"
                  }
                </p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.pushToAttendees ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--border))]"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.pushToAttendees ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
              <Button
                disabled={!form.title || !form.eventId || uploading}
                onClick={handleUpload}
                className="gap-2"
              >
                {uploading ? "Uploading…" : <><Send className="h-4 w-4" />{form.pushToAttendees ? "Upload & Push" : "Upload"}</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
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
        <OrgFilter organisers={organisers} value={orgFilter} onChange={setOrgFilter} />
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
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{doc.fileSize}</td>
                  <td className="px-5 py-3 text-sm font-medium tabular-nums">{doc.downloadCount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(doc.uploadedAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => toast.success(`Downloading "${doc.title}"`, { description: doc.fileSize })}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          deleteDocument(doc.id);
                          toast.success("Document deleted");
                        }}
                      >
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

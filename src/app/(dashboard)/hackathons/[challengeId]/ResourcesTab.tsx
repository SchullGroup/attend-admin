"use client";
/**
 * ResourcesTab — reference materials for Innovation Challenges (F3).
 *
 * Client admin: add PDF/DOC uploads or LINK/VIDEO urls with a category,
 * edit, delete. Backend notifies all challenge participants on every add.
 * Super admin / Viewer: read-only (`readOnly`); super admin reads the
 * /admin endpoint via `isSuperAdmin`.
 */
import { useMemo, useState } from "react";
import { BookOpen, FileText, Link2, Video, Trash2, Plus, Loader2, Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import {
  useChallengeResources,
  useAdminChallengeResources,
  useAddChallengeResource,
  useDeleteChallengeResource,
  type ResourceType,
  type ChallengeResource,
} from "@/api/client-challenge-resources";

const MAX_BYTES = 10 * 1_048_576;
const CATEGORY_SUGGESTIONS = ["Getting Started", "Technical Resources", "Workshops"];

const TYPE_ICON: Record<ResourceType, typeof FileText> = {
  PDF:   FileText,
  DOC:   FileText,
  LINK:  Link2,
  VIDEO: Video,
};

export function ResourcesTab({
  challengeId,
  readOnly,
  isSuperAdmin,
}: {
  challengeId: string;
  readOnly: boolean;
  isSuperAdmin: boolean;
}) {
  const clientQuery = useChallengeResources(challengeId, { enabled: !isSuperAdmin });
  const adminQuery  = useAdminChallengeResources(challengeId, { enabled: isSuperAdmin });
  const { data: resources, isLoading } = isSuperAdmin ? adminQuery : clientQuery;

  const addMutation    = useAddChallengeResource();
  const deleteMutation = useDeleteChallengeResource();

  // ── Add form ──
  const [showForm,    setShowForm]    = useState(false);
  const [type,        setType]        = useState<ResourceType>("LINK");
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file,        setFile]        = useState<File | null>(null);
  const [uploading,   setUploading]   = useState(false);

  const isFileType = type === "PDF" || type === "DOC";
  const canSubmit =
    title.trim().length > 0 &&
    (isFileType ? !!file : externalUrl.trim().length > 0) &&
    !uploading && !addMutation.isPending;

  function resetForm() {
    setShowForm(false);
    setType("LINK");
    setTitle("");
    setDescription("");
    setCategory("");
    setExternalUrl("");
    setFile(null);
  }

  async function submit() {
    if (!canSubmit) return;
    let fileUrl: string | undefined;

    if (isFileType && file) {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const uploadRes = await apiClient.post<any>("/api/v1/upload", form, {
          params: { folder: "challenge-resources" },
          headers: { "Content-Type": undefined },
          maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 120_000,
        });
        const uploadData = uploadRes.data?.data ?? uploadRes.data ?? {};
        fileUrl = uploadData.fileUrl ?? uploadData.secure_url ?? uploadData.url ?? uploadData.downloadUrl ?? "";
        if (!fileUrl) {
          toast.error("Upload failed — no file URL returned.");
          return;
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? err?.message ?? "Upload failed");
        return;
      } finally {
        setUploading(false);
      }
    }

    addMutation.mutate(
      {
        challengeId,
        payload: {
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(category.trim() ? { category: category.trim() } : {}),
          type,
          ...(isFileType ? { fileUrl } : { externalUrl: externalUrl.trim() }),
        },
      },
      { onSuccess: resetForm }
    );
  }

  // Group by category for display (uncategorized last)
  const grouped = useMemo(() => {
    const map = new Map<string, ChallengeResource[]>();
    for (const r of resources ?? []) {
      const key = r.category?.trim() || "Other";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)
    );
  }, [resources]);

  if (isLoading) return <Loader variant="page" text="Loading resources…" />;

  return (
    <div className="flex flex-col gap-5">
      <Card className="attend-card">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Resources</h2>
          {readOnly ? (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Lock className="h-3 w-3" /> read-only
            </span>
          ) : !showForm && (
            <Button size="sm" className="ml-auto h-8 gap-1.5 text-xs" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Resource
            </Button>
          )}
        </div>

        {/* ── Add form ── */}
        {!readOnly && showForm && (
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.3] flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {(["LINK", "VIDEO", "PDF", "DOC"] as ResourceType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    type === t
                      ? "bg-[hsl(var(--primary))] text-white"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title — e.g. Hackathon Rulebook"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (optional) — e.g. Getting Started"
              list="resource-category-suggestions"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
            <datalist id="resource-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>

            {isFileType ? (
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">
                    <FileText className="h-3.5 w-3.5" /> {file ? "Change file" : "Choose file"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept={type === "PDF" ? ".pdf" : ".doc,.docx"}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (f.size > MAX_BYTES) { toast.error("File exceeds the 10 MB limit."); return; }
                      setFile(f);
                      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
                    }}
                  />
                </label>
                {file && <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{file.name}</span>}
              </div>
            ) : (
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder={type === "VIDEO" ? "https://youtube.com/watch?v=…" : "https://docs.example.com/…"}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
              />
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" disabled={!canSubmit} onClick={submit}>
                {uploading || addMutation.isPending ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…
                  </span>
                ) : "Add Resource"}
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Participants get an in-app notification when a resource is added.
            </p>
          </div>
        )}

        {/* ── Grouped list ── */}
        {(resources ?? []).length === 0 ? (
          <p className="px-5 py-8 text-sm text-[hsl(var(--muted-foreground))] text-center italic">
            No resources yet{readOnly ? "." : " — add rulebooks, guides, links or workshop videos."}
          </p>
        ) : (
          <div className="flex flex-col">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <p className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {cat}
                </p>
                <div className="divide-y divide-[hsl(var(--border))]">
                  {items.map((r) => {
                    const Icon = TYPE_ICON[r.type];
                    const href = r.externalUrl ?? r.fileUrl;
                    return (
                      <div key={r.id} className="px-5 py-3.5 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{r.title}</p>
                          {r.description && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{r.description}</p>
                          )}
                        </div>
                        <span className="text-[10px] font-bold uppercase rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[hsl(var(--muted-foreground))] shrink-0">
                          {r.type}
                        </span>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] shrink-0"
                            title="Open"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() => deleteMutation.mutate({ challengeId, resourceId: r.id })}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-red-500 hover:bg-[hsl(var(--muted))] shrink-0"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

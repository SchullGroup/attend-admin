"use client";

import {
  useEffect, useMemo, useRef, useState,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import {
  Upload, Trash2, Save, Plus, AlertTriangle, Info, QrCode, X, FileText, ImageOff, Eye, EyeOff,
} from "lucide-react";
import {
  useCertificateFieldKeys,
  useEventCertificateTemplate,
  useSaveEventCertificateTemplate,
  useDeleteCertificateTemplate,
  useUploadCertificateArtwork,
  defaultFieldForKey,
  fieldKeyLabel,
  resolveArtworkUrl,
  A4_LANDSCAPE_RATIO,
  ARTWORK_MAX_BYTES,
  RECIPIENT_NAME_KEY,
  TEMPLATE_ALIGNS,
  TEMPLATE_FONT_STYLES,
  type TemplateField,
  type TemplateFieldAlign,
  type CertificateTemplate,
} from "@/api/certificate-templates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";

const BRAND = "#7c22c9";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Draft {
  templateId?:          string;
  name:                 string;
  artworkUrl:           string;
  artworkPublicId?:     string;
  artworkResourceType?: string;
  active:               boolean;
  fields:               TemplateField[];
}

const EMPTY_DRAFT: Draft = { name: "", artworkUrl: "", active: true, fields: [] };

function draftFromTemplate(t: CertificateTemplate | null | undefined): Draft {
  if (!t) return { ...EMPTY_DRAFT };
  return {
    templateId:          t.id || undefined,
    name:                t.name ?? "",
    artworkUrl:          t.artworkUrl ?? "",
    artworkPublicId:     t.artworkPublicId,
    artworkResourceType: t.artworkResourceType,
    active:              t.active ?? true,
    fields:              (t.fields ?? []).map((f) => ({ ...f })),
  };
}

function looksLikePdf(url?: string, resourceType?: string): boolean {
  if (resourceType && resourceType.toLowerCase() === "raw") return true;
  if (resourceType && resourceType.toLowerCase() === "pdf") return true;
  return !!url && /\.pdf($|\?)/i.test(url);
}

/** Measure an image File's aspect ratio (natural w/h). Resolves null for non-images. */
function measureAspect(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img.naturalHeight ? img.naturalWidth / img.naturalHeight : null); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// --- draggable field chip ---------------------------------------------------

function anchorTransform(align?: TemplateFieldAlign): string {
  if (align === "LEFT") return "translate(0, -50%)";
  if (align === "RIGHT") return "translate(-100%, -50%)";
  return "translate(-50%, -50%)"; // CENTER / undefined
}

function FieldChip({
  field, selected, readOnly, onSelect, onDragTo,
}: {
  field: TemplateField;
  selected: boolean;
  readOnly?: boolean;
  onSelect: () => void;
  onDragTo: (xPct: number, yPct: number) => void;
}) {
  const dragging = useRef(false);
  const isQr = field.key === "VERIFICATION_QR";

  function findCanvas(el: Element | null): HTMLElement | null {
    let node: Element | null = el;
    while (node && !(node as HTMLElement).dataset?.certCanvas) node = node.parentElement;
    return (node as HTMLElement) ?? null;
  }

  function onPointerDown(e: ReactPointerEvent) {
    onSelect();
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!dragging.current) return;
    const canvas = findCanvas(e.currentTarget as Element);
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100);
    onDragTo(round1(x), round1(y));
  }
  function onPointerUp(e: ReactPointerEvent) {
    dragging.current = false;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  }

  const base: CSSProperties = {
    position: "absolute",
    left: `${field.xPercent}%`,
    top: `${field.yPercent}%`,
    transform: anchorTransform(field.align),
    cursor: readOnly ? "default" : "move",
    touchAction: "none",
  };

  if (isQr) {
    const side = `${field.widthPercent ?? 8}%`;
    return (
      <div
        style={{
          ...base,
          width: side,
          aspectRatio: "1 / 1",
          transform: "translate(-50%, -50%)",
          borderColor: selected ? BRAND : "#00000055",
          background: "#ffffffcc",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`flex items-center justify-center rounded-sm border-2 ${selected ? "ring-2 ring-[#7c22c9] ring-offset-1" : ""}`}
      >
        <QrCode className="h-1/2 w-1/2" style={{ color: "#111" }} />
      </div>
    );
  }

  return (
    <div
      style={base}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <span
        className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold shadow-sm ${selected ? "ring-2 ring-offset-1" : ""}`}
        style={{
          backgroundColor: selected ? BRAND : "#ffffffea",
          color: selected ? "#fff" : "#111",
          border: `1px solid ${selected ? BRAND : "#00000022"}`,
        }}
      >
        {fieldKeyLabel(field.key)}
      </span>
    </div>
  );
}

// --- result preview (sample render of the finished certificate) -------------

/**
 * A4 landscape width in typographic points (297mm). `fontSizePt` on a field is
 * relative to this, so 1pt ≈ 1/841.89 of the page width. The preview sizes text
 * in container-query width units (`cqw`) against the page, so it stays accurate
 * at any rendered width — exactly how the editor treats every coordinate as a
 * percentage.
 */
const A4_LANDSCAPE_WIDTH_PT = (297 / 25.4) * 72; // ≈ 841.89

const PREVIEW_SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const PREVIEW_SERIF = "Georgia, 'Times New Roman', Times, serif";

/**
 * Best-effort mapping of the backend's font styles to web fonts, for the preview
 * only. The server owns the real embedded faces; this just conveys the
 * weight/serif intent so the sample reads right.
 */
function previewFontStyle(style?: string): CSSProperties {
  switch (style) {
    case "BODY_BOLD":    return { fontFamily: PREVIEW_SANS,  fontWeight: 700 };
    case "HEADING":      return { fontFamily: PREVIEW_SERIF, fontWeight: 400 };
    case "HEADING_BOLD": return { fontFamily: PREVIEW_SERIF, fontWeight: 700 };
    default:             return { fontFamily: PREVIEW_SANS,  fontWeight: 400 }; // BODY / unset
  }
}

/** Realistic stand-in values so the layout reads like a real certificate. */
const SAMPLE_FIELD_VALUES: Record<string, string> = {
  RECIPIENT_NAME:     "Ada Lovelace",
  TEAM_NAME:          "Team Nimbus",
  EVENT_TITLE:        "Innovation Challenge 2026",
  EVENT_DATE:         "12 March 2026",
  ISSUED_DATE:        "28 August 2026",
  CERTIFICATE_NUMBER: "ST-2026-000420",
  FINAL_POSITION:     "1st Place",
  ORGANISER_NAME:     "Meristem",
  VERIFICATION_URL:   "verify.schulltech.com/c/AB12CD",
};
function sampleValueForKey(key: string): string {
  return SAMPLE_FIELD_VALUES[key] ?? fieldKeyLabel(key);
}

/** One field rendered with its real value/size/colour/alignment (no dragging). */
function PreviewField({ field }: { field: TemplateField }) {
  const base: CSSProperties = {
    position: "absolute",
    left: `${field.xPercent}%`,
    top:  `${field.yPercent}%`,
    transform: anchorTransform(field.align),
  };

  if (field.key === "VERIFICATION_QR") {
    return (
      <div
        style={{ ...base, width: `${field.widthPercent ?? 8}%`, aspectRatio: "1 / 1", transform: "translate(-50%, -50%)" }}
        className="pointer-events-none flex items-center justify-center rounded-sm border border-black/20 bg-white"
      >
        <QrCode style={{ width: "82%", height: "82%", color: "#111" }} />
      </div>
    );
  }

  const align = field.align ?? "CENTER";
  const style: CSSProperties = {
    ...base,
    // pt → % of A4 width, expressed in container-query width units.
    fontSize:      `${((field.fontSizePt ?? 12) / A4_LANDSCAPE_WIDTH_PT) * 100}cqw`,
    color:         field.colorHex ?? "#1A1A1A",
    textAlign:     align === "LEFT" ? "left" : align === "RIGHT" ? "right" : "center",
    textTransform: field.uppercase ? "uppercase" : "none",
    lineHeight:    1.15,
    ...previewFontStyle(field.fontStyle),
  };
  if (field.widthPercent) {
    style.width = `${field.widthPercent}%`;
    if (field.maxLines) {
      style.display = "-webkit-box";
      style.WebkitBoxOrient = "vertical";
      style.WebkitLineClamp = field.maxLines;
      style.overflow = "hidden";
    }
  } else {
    style.whiteSpace = "nowrap";
  }

  return <div style={style} className="pointer-events-none select-none">{sampleValueForKey(field.key)}</div>;
}

// --- properties panel -------------------------------------------------------

function NumRow({ label, value, onChange, min, max, step, suffix }: {
  label: string; value: number | undefined; onChange: (n: number | undefined) => void;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? ""}
          min={min} max={max} step={step ?? 1}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") return onChange(undefined);
            let n = parseFloat(v);
            if (Number.isNaN(n)) return;
            if (min != null) n = Math.max(min, n);
            if (max != null) n = Math.min(max, n);
            onChange(n);
          }}
          className="w-20 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-right text-xs text-[hsl(var(--foreground))] outline-none focus:border-[#7c22c9]"
        />
        {suffix && <span className="w-3 text-[hsl(var(--muted-foreground))]">{suffix}</span>}
      </span>
    </label>
  );
}

function FieldProperties({ field, onChange, onRemove }: {
  field: TemplateField;
  onChange: (patch: Partial<TemplateField>) => void;
  onRemove: () => void;
}) {
  const isQr = field.key === "VERIFICATION_QR";
  const required = field.key === RECIPIENT_NAME_KEY;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{fieldKeyLabel(field.key)}</p>
        <button
          onClick={onRemove}
          disabled={required}
          title={required ? "Required — a certificate can’t be saved without a recipient name" : "Remove field"}
          className="inline-flex items-center gap-1 text-xs text-[#dc2626] disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <NumRow label="X" value={field.xPercent} onChange={(n) => onChange({ xPercent: clamp(n ?? 0, 0, 100) })} min={0} max={100} step={0.5} suffix="%" />
        <NumRow label="Y" value={field.yPercent} onChange={(n) => onChange({ yPercent: clamp(n ?? 0, 0, 100) })} min={0} max={100} step={0.5} suffix="%" />
        <NumRow label={isQr ? "Size" : "Width"} value={field.widthPercent} onChange={(n) => onChange({ widthPercent: n })} min={1} max={100} step={0.5} suffix="%" />
        {!isQr && <NumRow label="Font" value={field.fontSizePt} onChange={(n) => onChange({ fontSizePt: n })} min={6} max={120} suffix="pt" />}
        {!isQr && <NumRow label="Max lines" value={field.maxLines} onChange={(n) => onChange({ maxLines: n })} min={1} max={10} />}
      </div>

      {!isQr && (
        <>
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[hsl(var(--muted-foreground))]">Align</span>
            <select
              value={field.align ?? "CENTER"}
              onChange={(e) => onChange({ align: e.target.value as TemplateFieldAlign })}
              className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs text-[hsl(var(--foreground))] outline-none focus:border-[#7c22c9]"
            >
              {TEMPLATE_ALIGNS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[hsl(var(--muted-foreground))]">Font style</span>
            <select
              value={field.fontStyle ?? ""}
              onChange={(e) => onChange({ fontStyle: e.target.value || undefined })}
              className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-xs text-[hsl(var(--foreground))] outline-none focus:border-[#7c22c9]"
            >
              <option value="">Default</option>
              {TEMPLATE_FONT_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[hsl(var(--muted-foreground))]">Colour</span>
            <span className="flex items-center gap-2">
              <input
                type="color"
                value={field.colorHex ?? "#1A1A1A"}
                onChange={(e) => onChange({ colorHex: e.target.value.toUpperCase() })}
                className="h-6 w-8 cursor-pointer rounded border border-[hsl(var(--border))] bg-transparent p-0"
              />
              <span className="font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{field.colorHex ?? "#1A1A1A"}</span>
            </span>
          </label>

          <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
            <span className="text-[hsl(var(--muted-foreground))]">Uppercase</span>
            <input
              type="checkbox"
              checked={!!field.uppercase}
              onChange={(e) => onChange({ uppercase: e.target.checked })}
              className="accent-[#7c22c9]"
            />
          </label>
        </>
      )}
    </div>
  );
}

/**
 * Per-event certificate template editor.
 *
 * Upload the organiser's finished artwork (PDF strongly preferred, A4 landscape
 * 1.414), then position the variable fields over it by dragging. Everything is a
 * percentage of the page, so re-exporting at a different DPI doesn't move a
 * field. `fields` is saved wholesale (no partial merge).
 *
 * A per-event template overrides the org-wide (Register) default, which in turn
 * overrides the built-in generated design.
 */
export function CertificateTemplateEditor({ challengeId, readOnly }: { challengeId: string; readOnly?: boolean }) {
  const { data: resolution, isLoading: loadingTemplate } = useEventCertificateTemplate(challengeId);
  const { data: fieldKeys, isLoading: loadingKeys } = useCertificateFieldKeys();
  const upload = useUploadCertificateArtwork();
  const save = useSaveEventCertificateTemplate();
  const del = useDeleteCertificateTemplate();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);
  // Instant on-device preview of a just-uploaded image (a blob: URL). It always
  // renders — even if the stored URL later turns out not to be publicly
  // viewable — so "I uploaded it and nothing showed" can't happen mid-session.
  const [localPreview, setLocalPreview] = useState("");
  // The stored/resolved artwork URL failed to load as an <img> (bad path,
  // storage permissions, CORS). We surface a helpful state instead of a
  // mystery-blank canvas.
  const [previewFailed, setPreviewFailed] = useState(false);
  // The result preview is on by default (it's the whole point of the request),
  // but collapsible so it doesn't force scrolling on a small screen.
  const [showPreview, setShowPreview] = useState(true);
  const seededRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);

  function setLocalPreviewFromFile(file: File | null) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null;
    if (file && file.type.startsWith("image/")) {
      const u = URL.createObjectURL(file);
      localPreviewRef.current = u;
      setLocalPreview(u);
    } else {
      setLocalPreview("");
    }
  }

  // Revoke the object URL on unmount so we don't leak it.
  useEffect(() => () => { if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current); }, []);
  // A new source (freshly uploaded, or re-seeded from the saved template) gets a
  // fresh chance to load before we show the failed state.
  useEffect(() => { setPreviewFailed(false); }, [draft.artworkUrl, localPreview]);

  // Seed the draft from the loaded event template exactly once (don't clobber
  // in-progress edits when the query refetches).
  useEffect(() => {
    if (seededRef.current || !resolution) return;
    seededRef.current = true;
    if (resolution.event) {
      setDraft(draftFromTemplate(resolution.event));
      setSelectedKey(resolution.event.fields[0]?.key ?? null);
    }
  }, [resolution]);

  const artworkIsPdf = useMemo(
    () => looksLikePdf(draft.artworkUrl, draft.artworkResourceType),
    [draft.artworkUrl, draft.artworkResourceType]
  );

  // What the canvas actually renders: the instant on-device blob if we have one,
  // otherwise the stored URL resolved against the API host (relative paths would
  // otherwise 404 against the dashboard origin).
  const artworkSrc = useMemo(
    () => localPreview || resolveArtworkUrl(draft.artworkUrl),
    [localPreview, draft.artworkUrl]
  );

  const usedKeys = useMemo(() => new Set(draft.fields.map((f) => f.key)), [draft.fields]);
  const palette = (fieldKeys ?? []).filter((k) => !usedKeys.has(k.key));
  const selected = draft.fields.find((f) => f.key === selectedKey) ?? null;
  const hasRecipientName = usedKeys.has(RECIPIENT_NAME_KEY);

  function patchField(key: string, patch: Partial<TemplateField>) {
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));
    setDirty(true);
  }
  function addField(key: string) {
    if (usedKeys.has(key)) { setSelectedKey(key); return; }
    setDraft((d) => ({ ...d, fields: [...d.fields, defaultFieldForKey(key)] }));
    setSelectedKey(key);
    setDirty(true);
  }
  function removeField(key: string) {
    setDraft((d) => ({ ...d, fields: d.fields.filter((f) => f.key !== key) }));
    setSelectedKey((cur) => (cur === key ? null : cur));
    setDirty(true);
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    // nginx in front of the API caps the request body at ~1 MB and rejects
    // larger ones with a CORS-less 413 that the browser shows as a bare "Network
    // Error". Catch it here with an actionable message. (Server cap raise tracked
    // in BACKEND_UPLOAD_SIZE_LIMIT_2026-08-28.md.)
    if (file.size > ARTWORK_MAX_BYTES) {
      const limitMb = (ARTWORK_MAX_BYTES / 1024 / 1024).toFixed(1);
      const fileMb = (file.size / 1024 / 1024).toFixed(1);
      popup.error(
        "Artwork is too large",
        `“${file.name}” is ${fileMb} MB, over the server’s current ${limitMb} MB upload limit. A vector PDF (text, logo and border — no full-page photo) is usually well under this and still prints sharp. If it has a raster background, downsample it to ~150 DPI or compress the PDF, then try again.`
      );
      return;
    }

    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

    // Show the picked image straight away (a PDF can't be previewed as an image).
    setLocalPreviewFromFile(isPdf ? null : file);

    if (!isPdf) {
      const ratio = await measureAspect(file);
      if (ratio && Math.abs(ratio - A4_LANDSCAPE_RATIO) / A4_LANDSCAPE_RATIO > 0.02) {
        setAspectWarning(
          `This image is ${ratio.toFixed(2)}:1, not A4 landscape (${A4_LANDSCAPE_RATIO.toFixed(3)}:1). It will be stretched to fill — not letterboxed — which can distort the design. A PDF exported at A4 landscape is strongly preferred.`
        );
      } else setAspectWarning(null);
    } else setAspectWarning(null);

    try {
      const result = await upload.mutateAsync(file);
      if (!result.fileUrl) {
        // 200 but no usable URL — don't leave a "Replace artwork" button pointing
        // at nothing.
        setLocalPreviewFromFile(null);
        popup.error("Upload didn’t return a file", "The server accepted the file but didn’t return a URL. Please try again, or use a different file.");
        return;
      }
      setDraft((d) => ({
        ...d,
        artworkUrl:          result.fileUrl,
        artworkPublicId:     result.cloudinaryPublicId,
        artworkResourceType: result.resourceType,
        name: d.name || file.name.replace(/\.[^.]+$/, ""),
      }));
      setDirty(true);
    } catch {
      // The mutation's onError already toasts the server message; just roll back
      // the optimistic preview. (This await previously had no catch, so a failed
      // upload became an unhandledRejection.)
      setLocalPreviewFromFile(null);
    }
  }

  function handleSave() {
    if (readOnly) return;
    if (!draft.artworkUrl) { popup.error("Artwork required", "Upload the certificate artwork before saving."); return; }
    if (!draft.name.trim()) { popup.error("Name required", "Give this template a name."); return; }
    if (!hasRecipientName) {
      popup.error("Recipient name required", "Add the Recipient Name field — a certificate can’t be issued without it.");
      return;
    }
    save.mutate({
      eventId: challengeId,
      body: {
        name: draft.name.trim(),
        artworkUrl: draft.artworkUrl,
        artworkPublicId: draft.artworkPublicId,
        artworkResourceType: draft.artworkResourceType,
        active: draft.active,
        fields: draft.fields,
      },
    }, { onSuccess: () => setDirty(false) });
  }

  function handleDelete() {
    if (readOnly || !draft.templateId) return;
    popup.confirm(
      "Delete this template?",
      "The event will fall back to your organisation’s default design, or the built-in one. This can’t be undone.",
      () => del.mutate({ templateId: draft.templateId!, eventId: challengeId }, {
        onSuccess: () => {
          setDraft({ ...EMPTY_DRAFT });
          setSelectedKey(null);
          setDirty(false);
          setLocalPreviewFromFile(null);
          setPreviewFailed(false);
          seededRef.current = true; // don't re-seed from the now-stale cache
        },
      }),
      undefined,
      "Delete",
      "Cancel"
    );
  }

  if (loadingTemplate || loadingKeys) return <Loader variant="inline" text="Loading certificate template…" />;

  const effective = resolution?.effectiveScope ?? "BUILTIN";
  const effectiveLabel =
    effective === "EVENT" ? "This event’s template"
    : effective === "REGISTER" ? "Your organisation’s default template"
    : "Built-in generated design";

  return (
    <div className="flex flex-col gap-4">
      {/* Status / context */}
      <Card className="attend-card px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${BRAND}18` }}>
            <FileText className="h-5 w-5" style={{ color: BRAND }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Certificate design</h2>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              Upload your finished certificate and place the variable fields on it. Used for both winner and
              participation certificates. Currently in use: <span className="font-semibold text-[hsl(var(--foreground))]">{effectiveLabel}</span>.
            </p>
            {resolution?.register && effective !== "REGISTER" && (
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Your organisation has a default template; a template saved here overrides it for this event only.
              </p>
            )}
          </div>
        </div>
      </Card>

      {readOnly && (
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>You have read-only access. Ask an organisation admin to change the certificate design.</span>
        </div>
      )}

      {/* Upload + name */}
      <Card className="attend-card px-5 py-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPickFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={readOnly || upload.isPending}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {upload.isPending ? "Uploading…" : draft.artworkUrl ? "Replace artwork" : "Upload artwork"}
          </Button>
          <div className="flex-1 min-w-[200px]">
            <Input
              value={draft.name}
              onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setDirty(true); }}
              disabled={readOnly}
              placeholder="Template name (e.g. Meristem Innovation Challenge 2026)"
            />
          </div>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          A4 landscape, 297×210mm (ratio {A4_LANDSCAPE_RATIO.toFixed(3)}). <span className="font-medium">PDF strongly preferred</span> — it prints sharp at any size. Off-ratio artwork is stretched to fill, not letterboxed.
        </p>
        {aspectWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{aspectWarning}</span>
          </div>
        )}
      </Card>

      {/* Editor: canvas + side panel */}
      {draft.artworkUrl ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          {/* Canvas */}
          <Card className="attend-card p-3">
            <div
              data-cert-canvas="1"
              className="relative w-full overflow-hidden rounded-md border border-[hsl(var(--border))] select-none"
              style={{
                aspectRatio: `${A4_LANDSCAPE_RATIO} / 1`,
                background: artworkIsPdf ? "#f4f4f5" : "#fff",
              }}
              onPointerDown={() => setSelectedKey(null)}
            >
              {/* Artwork layer, beneath the field chips. An <img> (not a CSS
                  background) so we can resolve a relative upload path against the
                  API host AND detect a load failure instead of painting blank.
                  object-fit:fill matches the backend's stretch-to-A4 behaviour. */}
              {!artworkIsPdf && artworkSrc && !previewFailed && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artworkSrc}
                  alt=""
                  draggable={false}
                  onError={() => setPreviewFailed(true)}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none"
                  style={{ objectFit: "fill" }}
                />
              )}

              {!artworkIsPdf && artworkSrc && previewFailed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-6 pointer-events-none">
                  <ImageOff className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-xs font-medium text-[hsl(var(--foreground))]">Artwork preview couldn’t load</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] max-w-xs">
                    The uploaded file isn’t loading from storage. You can still position fields, but re-uploading is recommended — if it won’t display here it may not render onto the certificate either.
                  </p>
                </div>
              )}

              {artworkIsPdf && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-4 pointer-events-none">
                  <FileText className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">PDF artwork uploaded</p>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] max-w-xs">
                    A PDF can’t be previewed here, but the page below is the exact A4 landscape proportion — positions are accurate. Fields render onto your PDF.
                  </p>
                </div>
              )}
              {draft.fields.map((f) => (
                <FieldChip
                  key={f.key}
                  field={f}
                  selected={f.key === selectedKey}
                  readOnly={readOnly}
                  onSelect={() => setSelectedKey(f.key)}
                  onDragTo={(x, y) => patchField(f.key, { xPercent: x, yPercent: y })}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
              {readOnly ? "Read-only preview of field placement." : "Drag a field to position it. Select one to fine-tune its properties."}
            </p>
          </Card>

          {/* Side panel */}
          <div className="flex flex-col gap-4">
            {/* Palette */}
            <Card className="attend-card px-4 py-3">
              <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Add field</p>
              {palette.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">All available fields are placed.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {palette.map((k) => (
                    <button
                      key={k.key}
                      onClick={() => addField(k.key)}
                      disabled={readOnly}
                      title={k.required ? "Required field" : undefined}
                      className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] px-2.5 py-1 text-[11px] font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[#7c22c910] hover:text-[#7c22c9] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-3 w-3" />
                      {k.label || fieldKeyLabel(k.key)}
                      {k.required && <span className="text-[#7c22c9]">*</span>}
                    </button>
                  ))}
                </div>
              )}
              {!hasRecipientName && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>Add <span className="font-semibold">Recipient Name</span> — it’s required to save.</span>
                </div>
              )}
            </Card>

            {/* Properties */}
            <Card className="attend-card px-4 py-3">
              <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Properties</p>
              {selected ? (
                <FieldProperties
                  field={selected}
                  onChange={(patch) => patchField(selected.key, patch)}
                  onRemove={() => removeField(selected.key)}
                />
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Select a field on the certificate to edit it.</p>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <Card className="attend-card px-5 py-12 text-center">
          <Upload className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Upload your certificate artwork to begin</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-md mx-auto">
            Until then, certificates use {effective === "REGISTER" ? "your organisation’s default template" : "the built-in generated design"}.
          </p>
        </Card>
      )}

      {/* Result preview — how a finished, issued certificate will actually look */}
      {draft.artworkUrl && (
        <Card className="attend-card p-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Result preview</p>
              <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                Sample data showing how an issued certificate will look. Fonts are approximate — the server renders the final PDF.
              </p>
            </div>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[hsl(var(--border))] px-2 py-1 text-[11px] font-medium text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted)/0.4)]"
            >
              {showPreview ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
            </button>
          </div>

          {showPreview && (
            <>
              <div
                className="relative w-full overflow-hidden rounded-md border border-[hsl(var(--border))]"
                // container-type lets the sample text size itself in `cqw` against
                // this exact page width (see PreviewField). inline-size keeps the
                // aspect-ratio height intact.
                style={{ aspectRatio: `${A4_LANDSCAPE_RATIO} / 1`, containerType: "inline-size", background: "#fff" }}
              >
                {/* Artwork background: the loaded image (stretched to A4 to match
                    the backend), or a neutral page for PDF / failed loads so the
                    field positions are still visible. */}
                {!artworkIsPdf && artworkSrc && !previewFailed && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artworkSrc}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    style={{ objectFit: "fill" }}
                  />
                )}
                {artworkIsPdf && (
                  <span className="absolute left-2 top-2 z-10 rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                    PDF background isn’t shown here — positions are still exact
                  </span>
                )}
                {!artworkIsPdf && previewFailed && (
                  <span className="absolute left-2 top-2 z-10 rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">
                    Artwork preview unavailable
                  </span>
                )}

                {draft.fields.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Add fields above to see them rendered here.</p>
                  </div>
                ) : (
                  draft.fields.map((f) => <PreviewField key={f.key} field={f} />)
                )}
              </div>
              <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                Sample values only (e.g. recipient <span className="font-medium text-[hsl(var(--foreground))]">Ada Lovelace</span>). Real names, team, dates and a scannable verification QR are filled in per certificate.
              </p>
            </>
          )}
        </Card>
      )}

      {/* Actions */}
      {!readOnly && draft.artworkUrl && (
        <div className="flex items-center gap-2">
          {draft.templateId && (
            <Button variant="outline" onClick={handleDelete} disabled={del.isPending} className="text-[#dc2626] border-[#dc262640] hover:bg-[#dc262610]">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {del.isPending ? "Deleting…" : "Delete template"}
            </Button>
          )}
          <Button onClick={handleSave} disabled={save.isPending || !dirty} className="ml-auto">
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {save.isPending ? "Saving…" : dirty ? "Save template" : "Saved"}
          </Button>
        </div>
      )}
    </div>
  );
}

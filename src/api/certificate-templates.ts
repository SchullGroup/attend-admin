import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import type { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Certificate templates  (backend spec: cert.md §2)
//
//   An organisation uploads its own finished certificate artwork (PDF strongly
//   preferred, A4 landscape 297×210mm, ratio 1.414) and the platform stamps only
//   the values that vary per recipient onto it. The built-in generated design is
//   now just a fallback.
//
//   Scope cascade — the same idea as brandColor/logoUrl:
//       event override  →  Register (org) default  →  built-in generated design
//
//   An INNOVATION_CHALLENGE / HACKATHON event IS the challenge, so `eventId`
//   here doubles as the challengeId used elsewhere.
//
//   Coordinates are PERCENTAGES of the page, top-down from the top-left corner:
//     • xPercent honours `align` — left edge (LEFT) / centre (CENTER) / right
//       edge (RIGHT) of the text.
//     • yPercent is the text baseline.
//     • widthPercent shrink-wraps text, and is the side length for VERIFICATION_QR.
//   `fields` REPLACES the stored layout wholesale — always send the complete set;
//   there is no partial merge (a merge would make deleting a field impossible).
// ---------------------------------------------------------------------------

/** A4 landscape (297×210mm). Artwork off this ratio is stretched, not letterboxed. */
export const A4_LANDSCAPE_RATIO = 297 / 210; // ≈ 1.414

/** The one field a template cannot be saved without. */
export const RECIPIENT_NAME_KEY = "RECIPIENT_NAME";

/**
 * Client-side upload ceiling. The API's nginx sits in front with
 * `client_max_body_size 1m` (the nginx default) — anything larger is rejected
 * with a **413 that carries no CORS header**, which the browser surfaces as an
 * opaque "Network Error". So we guard just under 1 MB and give a real message
 * instead of letting the request die in the network layer.
 *
 * NOTE: the app *intends* a 10 MB limit (see the documents / agm-notices
 * uploads), so this is smaller than it should be. Raising nginx's cap is tracked
 * in BACKEND_UPLOAD_SIZE_LIMIT_2026-08-28.md — bump this to match once it ships.
 */
export const ARTWORK_MAX_BYTES = 1_000_000; // ≈0.95 MiB, leaving room for multipart overhead under the 1 MiB nginx cap

/**
 * The upload endpoint may return a RELATIVE path (e.g. `/uploads/…`) rather than
 * an absolute URL. Rendered raw in an `<img src>` or CSS `url()`, a relative path
 * resolves against the DASHBOARD origin (localhost:3000) and 404s — the artwork
 * has to resolve against the API host instead. Absolute http(s)/data/blob URLs
 * are returned untouched. Mirrors `resolveImageUrl` in the shared image uploader.
 */
export function resolveArtworkUrl(url?: string): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  try {
    return new URL(url, apiBaseUrl).toString();
  } catch {
    return url;
  }
}

export type TemplateFieldAlign = "LEFT" | "CENTER" | "RIGHT";
export const TEMPLATE_ALIGNS: TemplateFieldAlign[] = ["LEFT", "CENTER", "RIGHT"];

// The renderer embeds from a small set of faces (see cert.md §2). The backend is
// authoritative; these are the styles the handoff names/implies. `fontStyle` is
// optional — omit it and the renderer uses its own default for the field.
export const TEMPLATE_FONT_STYLES = [
  "BODY",
  "BODY_BOLD",
  "HEADING",
  "HEADING_BOLD",
] as const;
export type TemplateFontStyle = (typeof TEMPLATE_FONT_STYLES)[number];

/** One placement on the certificate. Percentages are 0–100, top-down from top-left. */
export interface TemplateField {
  key:           string;
  xPercent:      number;
  yPercent:      number;
  widthPercent?: number;
  fontSizePt?:   number;
  fontStyle?:    string;
  align?:        TemplateFieldAlign;
  colorHex?:     string;
  uppercase?:    boolean;
  maxLines?:     number;
}

/** A field the layout editor can place, from GET .../field-keys. */
export interface CertificateFieldKey {
  key:       string;
  label?:    string;      // human label for the palette
  required:  boolean;     // RECIPIENT_NAME is the only required one today
}

export type CertificateTemplateScope = "EVENT" | "REGISTER";

export interface CertificateTemplate {
  id:                   string;
  name:                 string;
  scope?:               CertificateTemplateScope;
  artworkUrl:           string;
  artworkPublicId?:     string;
  artworkResourceType?: string;
  active:               boolean;
  effective?:           boolean;   // true on the one actually in use
  fields:               TemplateField[];
  createdAt?:           string;
  updatedAt?:           string;
}

/** GET .../certificate-template returns both scopes with the effective one flagged. */
export interface CertificateTemplateResolution {
  event:          CertificateTemplate | null;
  register:       CertificateTemplate | null;
  effectiveScope: CertificateTemplateScope | "BUILTIN";
}

export const certificateTemplateKeys = {
  all:       ["certificateTemplates"] as const,
  fieldKeys: () => ["certificateTemplates", "fieldKeys"] as const,
  forEvent:  (eventId: string) => ["certificateTemplates", "event", eventId] as const,
};

// --- parsing (tolerant of snake_case / field-name variants) -----------------

function parseField(raw: any): TemplateField {
  const r = raw ?? {};
  return {
    key:          r.key ?? r.fieldKey ?? "",
    xPercent:     Number(r.xPercent ?? r.x ?? 0),
    yPercent:     Number(r.yPercent ?? r.y ?? 0),
    widthPercent: r.widthPercent ?? r.width ?? undefined,
    fontSizePt:   r.fontSizePt ?? r.fontSize ?? undefined,
    fontStyle:    r.fontStyle ?? undefined,
    align:        (r.align ?? undefined) as TemplateFieldAlign | undefined,
    colorHex:     r.colorHex ?? r.color ?? undefined,
    uppercase:    r.uppercase ?? undefined,
    maxLines:     r.maxLines ?? undefined,
  };
}

function parseTemplate(raw: any): CertificateTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id ?? raw.templateId ?? "";
  const artworkUrl = raw.artworkUrl ?? raw.artwork_url ?? "";
  // A template with neither an id nor artwork is an empty placeholder, not a template.
  if (!id && !artworkUrl) return null;
  return {
    id,
    name:                raw.name ?? "",
    scope:               (raw.scope ?? undefined) as CertificateTemplateScope | undefined,
    artworkUrl,
    artworkPublicId:     raw.artworkPublicId ?? raw.artwork_public_id ?? undefined,
    artworkResourceType: raw.artworkResourceType ?? raw.artwork_resource_type ?? undefined,
    active:              raw.active ?? true,
    effective:           raw.effective,
    fields:              Array.isArray(raw.fields) ? raw.fields.map(parseField) : [],
    createdAt:           raw.createdAt,
    updatedAt:           raw.updatedAt,
  };
}

function parseResolution(raw: any, _eventId: string): CertificateTemplateResolution {
  const r = raw ?? {};
  let event: CertificateTemplate | null = null;
  let register: CertificateTemplate | null = null;

  if (r.event !== undefined || r.register !== undefined) {
    // { event, register }
    event = parseTemplate(r.event);
    register = parseTemplate(r.register);
  } else if (Array.isArray(r.templates) || Array.isArray(r)) {
    // { templates: [...] } | [...]  — discriminate by scope
    const arr: any[] = Array.isArray(r) ? r : r.templates;
    for (const t of arr) {
      const parsed = parseTemplate(t);
      if (!parsed) continue;
      if ((parsed.scope ?? "EVENT").toUpperCase() === "REGISTER") register = parsed;
      else event = parsed;
    }
  } else {
    // single bare template object
    const parsed = parseTemplate(r);
    if (parsed) {
      if ((parsed.scope ?? "EVENT").toUpperCase() === "REGISTER") register = parsed;
      else event = parsed;
    }
  }

  let effectiveScope: CertificateTemplateResolution["effectiveScope"] = "BUILTIN";
  if (event?.effective) effectiveScope = "EVENT";
  else if (register?.effective) effectiveScope = "REGISTER";
  else if (typeof r.effectiveScope === "string") {
    const s = r.effectiveScope.toUpperCase();
    effectiveScope = s === "EVENT" || s === "REGISTER" ? s : "BUILTIN";
  } else if (event) effectiveScope = "EVENT";
  else if (register) effectiveScope = "REGISTER";

  return { event, register, effectiveScope };
}

// --- reads ------------------------------------------------------------------

/**
 * GET /api/v1/client/certificate-templates/field-keys
 * The palette for the layout editor, each key flagged `required`. Rarely changes,
 * so it's cached hard.
 */
export function useCertificateFieldKeys(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: certificateTemplateKeys.fieldKeys(),
    enabled: opts?.enabled ?? true,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CertificateFieldKey[]>>(
        `/api/v1/client/certificate-templates/field-keys`
      );
      const raw: any = res.data.data ?? res.data;
      const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.fieldKeys) ? raw.fieldKeys : [];
      return arr.map((k: any): CertificateFieldKey => {
        const key = typeof k === "string" ? k : k?.key ?? k?.fieldKey ?? "";
        return {
          key,
          label: typeof k === "string" ? undefined : k?.label ?? k?.name,
          required: typeof k === "string" ? key === RECIPIENT_NAME_KEY : !!(k?.required),
        };
      }).filter((k) => !!k.key);
    },
  });
}

/**
 * GET /api/v1/client/events/{eventId}/certificate-template
 * Both the event and register-default templates, with the effective one flagged.
 * 404 ⇒ nothing configured yet → built-in fallback.
 */
export function useEventCertificateTemplate(eventId: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: certificateTemplateKeys.forEvent(eventId),
    enabled: !!eventId && (opts?.enabled ?? true),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<CertificateTemplateResolution> => {
      try {
        const res = await apiClient.get<ApiResponse<CertificateTemplateResolution>>(
          `/api/v1/client/events/${eventId}/certificate-template`
        );
        return parseResolution(res.data.data ?? res.data, eventId);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          return { event: null, register: null, effectiveScope: "BUILTIN" };
        }
        throw err;
      }
    },
  });
}

// --- writes -----------------------------------------------------------------

export interface SaveCertificateTemplateBody {
  name:                 string;
  artworkUrl:           string;
  artworkPublicId?:     string;
  artworkResourceType?: string;
  active:               boolean;
  fields:               TemplateField[];
}

/**
 * POST /api/v1/client/events/{eventId}/certificate-template
 * Save (create or replace) the per-event template. `fields` replaces the stored
 * layout wholesale.
 */
export function useSaveEventCertificateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, body }: { eventId: string; body: SaveCertificateTemplateBody }) => {
      const res = await apiClient.post<ApiResponse<CertificateTemplate>>(
        `/api/v1/client/events/${eventId}/certificate-template`,
        body
      );
      return parseTemplate(res.data.data ?? res.data);
    },
    onSuccess: (_data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: certificateTemplateKeys.forEvent(eventId) });
      popup.success("Template Saved", "This event will now use your uploaded certificate design.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to save the certificate template."),
  });
}

/**
 * POST /api/v1/client/registers/{registerId}/certificate-template
 * Save the org-wide default template (applies to every event without its own).
 * Exposed for completeness; wire it where a registerId is in scope.
 */
export function useSaveRegisterCertificateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ registerId, body }: { registerId: string; body: SaveCertificateTemplateBody }) => {
      const res = await apiClient.post<ApiResponse<CertificateTemplate>>(
        `/api/v1/client/registers/${registerId}/certificate-template`,
        body
      );
      return parseTemplate(res.data.data ?? res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: certificateTemplateKeys.all });
      popup.success("Default Template Saved", "Events without their own template will use this design.", 3000);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to save the default template."),
  });
}

/**
 * DELETE /api/v1/client/certificate-templates/{templateId}
 * Removes the template and its stored artwork; the scope below it takes over.
 * `eventId` is passed only so the event's resolution query can be refreshed.
 */
export function useDeleteCertificateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId }: { templateId: string; eventId?: string }) => {
      const res = await apiClient.delete<ApiResponse<any>>(
        `/api/v1/client/certificate-templates/${templateId}`
      );
      return res.data.data;
    },
    onSuccess: (_data, { eventId }) => {
      if (eventId) queryClient.invalidateQueries({ queryKey: certificateTemplateKeys.forEvent(eventId) });
      else queryClient.invalidateQueries({ queryKey: certificateTemplateKeys.all });
      popup.success("Template Removed", "The certificate design was deleted.", 2500);
    },
    onError: (error: any) => parseAndToastApiError(error, "Failed to delete the template."),
  });
}

/**
 * Artwork upload — step 1 of the two-step upload, matching every other file in
 * this API. POST /api/v1/upload?folder=certificate-templates.
 *
 * Unlike the shared logo uploader, this KEEPS `resourceType` — the template POST
 * needs `artworkResourceType`. Persist `fileUrl` (never `previewUrl`, which is a
 * short-lived signed link that would expire out from under the template).
 */
export function useUploadCertificateArtwork() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiClient.post<ApiResponse<Record<string, string>>>(
        "/api/v1/upload",
        form,
        {
          params:  { folder: "certificate-templates" },
          headers: { "Content-Type": undefined },
          // Certificate artwork is often a multi-MB print-resolution PDF. Match
          // every other file upload in this app (documents, agm-notices,
          // challenge-resources): lift axios's Node-adapter body caps and give
          // the request a real timeout. A small logo slips under the defaults;
          // a large PDF that doesn't can otherwise fail as a bare "Network Error".
          maxBodyLength:    Infinity,
          maxContentLength: Infinity,
          timeout:          120_000,
        }
      );
      const d = res.data.data ?? {};
      return {
        // A PDF stored as a Cloudinary `raw` resource commonly returns its URL
        // under `secure_url`/`downloadUrl` rather than `fileUrl` — read every
        // shape the rest of the app already handles, else a PDF "uploads to
        // nowhere" (fileUrl === "" → the caller silently no-ops).
        fileUrl:            d["fileUrl"] ?? d["secure_url"] ?? d["url"] ?? d["downloadUrl"] ?? "",
        cloudinaryPublicId: d["cloudinaryPublicId"] ?? d["public_id"] ?? "",
        resourceType:       d["resourceType"] ?? d["resource_type"] ?? "",
      };
    },
    onError: (error: any) => parseAndToastApiError(error, "Artwork upload failed. Please try again."),
  });
}

/** Sensible starting placement for a freshly-added field, keyed by its type. */
export function defaultFieldForKey(key: string): TemplateField {
  switch (key) {
    case RECIPIENT_NAME_KEY:
      return { key, xPercent: 50, yPercent: 45, widthPercent: 60, fontSizePt: 34, fontStyle: "BODY_BOLD", align: "CENTER", colorHex: "#1A1A1A", uppercase: true, maxLines: 1 };
    case "TEAM_NAME":
      return { key, xPercent: 50, yPercent: 54, widthPercent: 55, fontSizePt: 18, align: "CENTER", colorHex: "#333333", maxLines: 1 };
    case "EVENT_TITLE":
      return { key, xPercent: 50, yPercent: 30, widthPercent: 70, fontSizePt: 20, align: "CENTER", colorHex: "#333333", maxLines: 2 };
    case "EVENT_DATE":
      return { key, xPercent: 50, yPercent: 62, fontSizePt: 12, align: "CENTER", colorHex: "#555555" };
    case "ISSUED_DATE":
      return { key, xPercent: 18, yPercent: 82, fontSizePt: 11, align: "LEFT", colorHex: "#555555" };
    case "CERTIFICATE_NUMBER":
      return { key, xPercent: 18, yPercent: 88, fontSizePt: 10, align: "LEFT", colorHex: "#777777" };
    case "FINAL_POSITION":
      return { key, xPercent: 50, yPercent: 58, fontSizePt: 14, align: "CENTER", colorHex: "#333333" };
    case "ORGANISER_NAME":
      return { key, xPercent: 82, yPercent: 82, fontSizePt: 11, align: "RIGHT", colorHex: "#555555" };
    case "VERIFICATION_URL":
      return { key, xPercent: 50, yPercent: 94, fontSizePt: 9, align: "CENTER", colorHex: "#999999" };
    case "VERIFICATION_QR":
      return { key, xPercent: 85, yPercent: 82, widthPercent: 8 };
    default:
      return { key, xPercent: 50, yPercent: 50, fontSizePt: 12, align: "CENTER", colorHex: "#333333" };
  }
}

/** Human label fallback for a field key when the palette doesn't supply one. */
export function fieldKeyLabel(key: string): string {
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

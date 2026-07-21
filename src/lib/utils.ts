import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resolve a user's primary role string from a /me API response data object.
 * Handles both `role: "SUPER_ADMIN"` (single string) and `roles: ["SUPER_ADMIN"]`
 * (array) shapes, normalises to lowercase_snake_case.
 */
export function resolveRole(userData: { role?: string; roles?: string[] } | null | undefined): string {
  const raw = userData?.role ?? userData?.roles?.[0] ?? "";
  return raw.toLowerCase().replace(/[-\s]+/g, "_");
}

/**
 * The ONLY role strings that mean "platform-level Super Admin" (SchullTech
 * staff, cross-organisation access). Deliberately does NOT include bare
 * "admin" — that's a client-org team member role (Team Members > role:
 * "Admin"), which is a distinct, org-scoped role that should get the exact
 * same dashboard/permissions as "client_admin". Several places in this
 * codebase used to lump plain "admin" in with "super_admin", which meant a
 * client team member with the "Admin" role would silently get routed to
 * super-admin-only API endpoints and see the super-admin nav/dashboard
 * instead of their own organisation's data. Use this set (or
 * `isSuperAdminRole`) everywhere a super-admin check is needed instead of
 * redeclaring a local role set.
 */
export const SUPER_ADMIN_ROLES = new Set(["super_admin", "superadmin", "super-admin"]);

/** True only for genuine platform Super Admins — see `SUPER_ADMIN_ROLES` above. */
export function isSuperAdminRole(role: string | null | undefined): boolean {
  return SUPER_ADMIN_ROLES.has((role ?? "").toLowerCase().replace(/[-\s]+/g, "_"));
}

/**
 * Platform default brand colour — applied to every register (and, through
 * inheritance, its events/live-room) that hasn't set a custom `brandColor`
 * yet. Matches the backend default (F4 — Register Branding), so a register
 * with no explicit branding renders identically on FE and BE.
 */
export const DEFAULT_BRAND_COLOR = "#0B5CFF";

export function formatCurrency(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  return `₦${n.toLocaleString()}`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Strip everything except digits. Used for registration-ID inputs (CHN, RC
 * number) so the field itself can never contain the prefix — people used to
 * type "chn123", "CHN123", "Chn123", etc. inconsistently, which meant the
 * saved value's casing/format depended entirely on how each person typed it.
 * The prefix is now applied programmatically (see withIdPrefix) instead of
 * trusting free-text input.
 */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Prepend a fixed, uppercase prefix to a digits-only ID number for the
 * payload — e.g. withIdPrefix("CHN", "1234567892") -> "CHN1234567892".
 * Returns "" for an empty value so optional fields stay optional.
 *
 * Pass `{ space: true }` to insert a space between the prefix and the
 * digits instead — e.g. withIdPrefix("RC", "2345678", { space: true })
 * -> "RC 2345678". Used for RC Number fields, which should read "RC 123"
 * rather than "RC123"; other prefixes (e.g. "CHN") keep the no-space form
 * by default since that's the format already in use for those IDs.
 */
export function withIdPrefix(prefix: string, rawDigits: string, opts?: { space?: boolean }): string {
  const clean = digitsOnly(rawDigits);
  if (!clean) return "";
  return `${prefix.toUpperCase()}${opts?.space ? " " : ""}${clean}`;
}

/**
 * Display-time formatter for RC Number values that inserts a space after
 * "RC" if one isn't already there — so legacy values saved before the
 * space format was introduced (e.g. "RC2345678") still render as
 * "RC 2345678" instead of needing a data migration.
 */
export function formatRcNumber(value?: string | null): string {
  if (!value) return "";
  return value.replace(/^RC\s*/i, "RC ");
}

/**
 * Combine a country dial code and a local number into a single E.164-style
 * string, e.g. toE164("+234", "8012345678") -> "+2348012345678". Strips any
 * leading zero from the local number (common in Nigerian numbers written as
 * "0801...") since the dial code already replaces it. Returns "" if the
 * local number is empty.
 */
export function toE164(dialCode: string, localNumber: string): string {
  const digits = digitsOnly(localNumber).replace(/^0+/, "");
  return digits ? `${dialCode}${digits}` : "";
}

/**
 * Wraps an `axios` `onUploadProgress` callback so the UI is only updated a
 * few times a second instead of on every single progress event. Fast
 * connections (e.g. localhost) can fire progress events dozens of times per
 * second for even a small file — each one calling React state setters —
 * which floods the component (and anything else on the page, like a large
 * table) with re-renders and makes the whole page feel sluggish/janky during
 * upload, even though the upload itself is fast. This throttles those calls
 * to roughly every 120ms while always letting the final 100% through
 * immediately so the bar doesn't visibly stall right before completion.
 */
export function throttledProgress(
  onProgress: (percent: number) => void,
  intervalMs = 120
): (evt: { loaded: number; total?: number }) => void {
  let last = 0;
  return (evt) => {
    if (!evt.total) return;
    const now = Date.now();
    const isDone = evt.loaded >= evt.total;
    if (!isDone && now - last < intervalMs) return;
    last = now;
    onProgress(Math.round((evt.loaded / evt.total) * 100));
  };
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Safely decodes a Base64 string and triggers a browser file download.
 * Processes the string in chunks to avoid call-stack overflows on large
 * payloads (documents > ~10 MB can exceed the single atob → Uint8Array
 * direct approach on some engines).
 *
 * @param base64   Raw Base64 string from the API (`fileData` field).
 * @param mimeType MIME type, e.g. "application/pdf" or "image/png".
 * @param filename Suggested filename for the browser's Save dialog.
 */
export function triggerBase64Download(
  base64: string,
  mimeType: string,
  filename: string
): void {
  const CHUNK = 1024;
  const raw   = atob(base64);
  const bytes = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, raw.length);
    for (let j = i; j < end; j++) {
      bytes[j] = raw.charCodeAt(j);
    }
  }

  const blob = new Blob([bytes], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  // Revoke after a tick to give the browser time to initiate the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

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
 */
export function withIdPrefix(prefix: string, rawDigits: string): string {
  const clean = digitsOnly(rawDigits);
  return clean ? `${prefix.toUpperCase()}${clean}` : "";
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

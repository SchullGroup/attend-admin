"use client";
import { digitsOnly, toE164 } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Common dial codes — Nigeria first/default since this platform is built
// for Nigerian AGMs/EGMs (Meristem Registrars, Crafwell Engineering, etc.).
const DIAL_CODES = [
  { code: "+234", label: "🇳🇬 +234" },
  { code: "+1",   label: "🇺🇸 +1"   },
  { code: "+44",  label: "🇬🇧 +44"  },
  { code: "+233", label: "🇬🇭 +233" },
  { code: "+27",  label: "🇿🇦 +27"  },
  { code: "+254", label: "🇰🇪 +254" },
];

/**
 * Splits a stored E.164-ish phone string ("+2348012345678") into its dial
 * code + local number for editing. Falls back to the Nigeria dial code if
 * the value has no recognizable "+" prefix (e.g. legacy data saved without
 * a country code).
 */
function splitPhone(value: string): { dialCode: string; local: string } {
  if (!value) return { dialCode: "+234", local: "" };
  const trimmed = value.trim();
  const match = DIAL_CODES.find((d) => trimmed.startsWith(d.code));
  if (match) return { dialCode: match.code, local: digitsOnly(trimmed.slice(match.code.length)).replace(/^0+/, "") };
  const digits = digitsOnly(trimmed);
  // Country code without the "+" (e.g. "2348012345678")
  const bare = DIAL_CODES.find((d) => d.code !== "+1" && digits.startsWith(d.code.slice(1)) && digits.length > 10);
  if (bare) return { dialCode: bare.code, local: digits.slice(bare.code.length - 1).replace(/^0+/, "") };
  // Local format (e.g. "08012345678") — Nigeria by default, trunk 0 dropped
  return { dialCode: "+234", local: digits.replace(/^0+/, "") };
}

/**
 * Normalise any stored phone ("08012345678", "2348012345678", "+234 801…")
 * to E.164 ("+2348012345678"). Returns "" for empty input.
 */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  const { dialCode, local } = splitPhone(value);
  return toE164(dialCode, local);
}

// Expected national-number length (digits after the country code, no trunk 0).
const PHONE_RULES: Record<string, { len: number[]; start?: RegExp; startMsg?: string; example: string }> = {
  "+234": { len: [10], start: /^[789]/, startMsg: "Nigerian mobile numbers start with 07, 08 or 09.", example: "0801 234 5678" },
  "+1":   { len: [10], start: /^[2-9]/, example: "202 555 0123" },
  "+44":  { len: [10],                  example: "07400 123456" },
  "+233": { len: [9],                   example: "024 123 4567" },
  "+27":  { len: [9],                   example: "082 123 4567" },
  "+254": { len: [9],                   example: "0712 345678" },
};

/**
 * Validate an E.164 phone from <PhoneInput>. Returns an error message for an
 * incomplete / invalid number, or null when it's fine (or empty and optional).
 */
export function phoneError(value: string, opts: { required?: boolean } = {}): string | null {
  if (!value) return opts.required ? "Phone number is required." : null;
  const { dialCode, local } = splitPhone(value);
  const rule = PHONE_RULES[dialCode];
  if (!rule) return local.length < 7 ? "Phone number is incomplete." : null;
  const min = Math.min(...rule.len), max = Math.max(...rule.len);
  if (local.length < min) return `Phone number is incomplete — e.g. ${rule.example}.`;
  if (local.length > max) return `Too many digits — e.g. ${rule.example}.`;
  if (rule.start && !rule.start.test(local)) return rule.startMsg ?? `Enter a valid number — e.g. ${rule.example}.`;
  return null;
}

/**
 * Phone number input that always saves with an explicit country code
 * (E.164-style, e.g. "+2348012345678") instead of trusting free-text entry
 * — people previously typed phone numbers in every format imaginable
 * (with/without +234, with/without leading 0, spaces, dashes...), so
 * whatever was saved depended entirely on how each person typed it.
 *
 * `value` / `onChange` work with the combined E.164 string so this drops
 * into any form the same way a plain <Input type="tel"> would.
 */
export function PhoneInput({
  value,
  onChange,
  placeholder = "801 234 5678",
  className,
  disabled,
  invalid,
  id,
}: {
  value:        string;
  onChange:     (e164: string) => void;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
  /** Red border + aria-invalid (pair with an inline error message). */
  invalid?:     boolean;
  id?:          string;
}) {
  const { dialCode, local } = splitPhone(value);

  function updateDialCode(next: string) {
    onChange(toE164(next, local));
  }

  function updateLocal(next: string) {
    onChange(toE164(dialCode, next));
  }

  return (
    <div className={cn("flex", className)}>
      <select
        value={dialCode}
        disabled={disabled}
        aria-label="Country code"
        aria-invalid={invalid || undefined}
        onChange={(e) => updateDialCode(e.target.value)}
        className={cn("h-9 shrink-0 rounded-l-lg rounded-r-none border border-r-0 bg-[hsl(var(--muted)/0.4)] px-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50",
          invalid ? "border-[hsl(var(--destructive))]" : "border-[hsl(var(--input))]")}
      >
        {DIAL_CODES.map((d) => (
          <option key={d.code} value={d.code}>{d.label}</option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        autoComplete="tel-national"
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        value={local}
        disabled={disabled}
        onChange={(e) => updateLocal(digitsOnly(e.target.value))}
        placeholder={placeholder}
        className={cn("flex h-9 w-full rounded-r-lg rounded-l-none border bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          invalid ? "border-[hsl(var(--destructive))] focus:ring-[hsl(var(--destructive))]" : "border-[hsl(var(--input))]")}
      />
    </div>
  );
}

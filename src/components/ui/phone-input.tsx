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
  const match = DIAL_CODES.find((d) => value.startsWith(d.code));
  if (match) return { dialCode: match.code, local: value.slice(match.code.length) };
  // No "+" / unrecognized prefix — treat the whole thing as a local number
  return { dialCode: "+234", local: digitsOnly(value) };
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
}: {
  value:        string;
  onChange:     (e164: string) => void;
  placeholder?: string;
  className?:   string;
  disabled?:    boolean;
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
        onChange={(e) => updateDialCode(e.target.value)}
        className="h-9 shrink-0 rounded-l-lg rounded-r-none border border-r-0 border-[hsl(var(--input))] bg-[hsl(var(--muted)/0.4)] px-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {DIAL_CODES.map((d) => (
          <option key={d.code} value={d.code}>{d.label}</option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        value={local}
        disabled={disabled}
        onChange={(e) => updateLocal(digitsOnly(e.target.value))}
        placeholder={placeholder}
        className="flex h-9 w-full rounded-r-lg rounded-l-none border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

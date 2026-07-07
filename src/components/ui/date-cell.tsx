"use client";

/**
 * DateCell — defensive table cell for registration / joined dates.
 *
 * Problems it solves:
 *  1. Backend sometimes returns `null`, `undefined`, or an unrecognised key
 *     → falls back to "—" instead of crashing or showing "Invalid Date".
 *  2. `new Date(string)` silently produces NaN for non-ISO strings
 *     → guards with isNaN(parsed.getTime()).
 *  3. Payload shape drifts between endpoints
 *     → logs the actual object keys in dev so you can find the right field fast.
 *
 * Usage:
 *   <DateCell value={p.registeredAt || p.joinedAt || p.createdAt || p.accountInfo?.registeredAt} />
 *   <DateCell value={p.registeredAt || p.joinedAt || p.createdAt || p.accountInfo?.registeredAt} payload={p} />
 */

interface DateCellProps {
  /** The raw date string to parse. Pass the full defensive fallback chain as the value. */
  value: string | null | undefined;
  /**
   * Optional: the raw row payload object.
   * When `value` is missing/invalid and this is provided, the component logs
   * the payload's top-level keys to the console so you can identify the
   * correct field name without guessing.
   */
  payload?: Record<string, unknown>;
  /** Override the placeholder shown when the date cannot be parsed. Defaults to "—". */
  fallback?: string;
}

export function DateCell({ value, payload, fallback = "—" }: DateCellProps) {
  if (!value) {
    if (process.env.NODE_ENV !== "production" && payload) {
      console.warn(
        "[DateCell] No date value found. Available payload keys:",
        Object.keys(payload)
      );
    }
    return (
      <span className="text-sm text-[hsl(var(--muted-foreground))]">{fallback}</span>
    );
  }

  try {
    const parsed = new Date(value);

    if (isNaN(parsed.getTime())) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[DateCell] Could not parse date string: "${value}".`,
          payload ? `Available payload keys: ${Object.keys(payload).join(", ")}` : ""
        );
      }
      return (
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{fallback}</span>
      );
    }

    const formatted = parsed.toLocaleDateString("en-NG", {
      day:   "numeric",
      month: "short",
      year:  "numeric",
    });

    return (
      <span className="text-sm text-[hsl(var(--muted-foreground))]">{formatted}</span>
    );
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[DateCell] Unexpected error parsing date:", err, "value:", value);
    }
    return (
      <span className="text-sm text-[hsl(var(--muted-foreground))]">{fallback}</span>
    );
  }
}

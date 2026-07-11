"use client";

/**
 * Thin, reusable progress bar for file/document uploads. Shared across every
 * upload flow in the app (event documents, global document vault, AGM
 * notice) so they all look and behave the same instead of each screen
 * having its own bespoke "Uploading…" text with no actual progress.
 */
export function UploadProgress({
  percent,
  label = "Uploading…",
  className,
  hideHeader = false,
}: {
  percent:     number;
  label?:      string;
  className?:  string;
  /** Skip the label/percent text row — use when the surrounding UI already shows it. */
  hideHeader?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={className}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-[hsl(var(--foreground))]">{label}</span>
          <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">{pct}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div
          className="h-full rounded-full bg-[hsl(var(--primary))] transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

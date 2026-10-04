export function VoteBar({
  label, value, total, color, shares,
}: {
  label: string; value?: number | null; total?: number | null; color: string;
  /** Share units cast for this option — shown when the resolution is share-weighted. */
  shares?: number | null;
}) {
  // A freshly-opened resolution can arrive before its tally fields are
  // populated, so value/total may be undefined at runtime even though the type
  // says number. Coalesce rather than call .toLocaleString() on undefined.
  const safeValue = value ?? 0;
  const safeTotal = total ?? 0;
  const pct = safeTotal > 0 ? Math.round((safeValue / safeTotal) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[hsl(var(--muted-foreground))] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums w-10 text-right">{pct}%</span>
      <span className="text-sm text-[hsl(var(--muted-foreground))] tabular-nums w-20 text-right">
        {safeValue.toLocaleString()} {safeValue === 1 ? "vote" : "votes"}
      </span>
      {shares != null && (
        <span className="text-sm text-[hsl(var(--foreground))] font-medium tabular-nums w-32 text-right">
          {shares.toLocaleString()} {shares === 1 ? "share" : "shares"}
        </span>
      )}
    </div>
  );
}

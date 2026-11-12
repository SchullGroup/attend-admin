"use client";

/**
 * Quorum by shares — the headline figure plus Meristem's attendance-report
 * breakdown. The breakdown only renders when the response carries share
 * counts (client roles); super admin sees the percentage and status only.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  type QuorumFields, formatQuorumPct, formatThreshold, hasQuorumBreakdown, quorumReportRows, registeredPct,
} from "@/lib/quorum";

/** "81.24%" with "Quorum met · required 25% of share capital" under it. */
export function QuorumFigure({ q, size = "lg" }: { q: QuorumFields; size?: "lg" | "md" }) {
  const noUnits = q.quorumPercentage == null;
  return (
    <>
      <div className={`${size === "lg" ? "text-2xl" : "text-xl"} font-bold tabular-nums`}>{formatQuorumPct(q.quorumPercentage)}</div>
      <div className={`text-xs font-semibold mt-1 ${q.quorumMet ? "text-green-600" : "text-red-500"}`}>
        {noUnits ? "No share units on the register" : q.quorumMet ? "Quorum met" : "Quorum not met"}
        {q.requiredQuorumPercentage != null && ` · required ${formatThreshold(q.requiredQuorumPercentage)}`}
      </div>
      <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">of share capital present</div>
    </>
  );
}

/** Collapsible table with the seven report lines, plus the registered-shares forecast. */
export function QuorumBreakdown({ q, defaultOpen = false }: { q: QuorumFields; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!hasQuorumBreakdown(q)) return null;
  const forecast = registeredPct(q);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        aria-expanded={open}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide breakdown" : "Show breakdown"}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] text-xs">
          {quorumReportRows(q).map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 px-3 py-1.5">
              <span className="text-[hsl(var(--muted-foreground))]">{r.label}</span>
              <span className={`tabular-nums text-[hsl(var(--foreground))] ${r.strong ? "font-bold" : "font-medium"}`}>{r.value}</span>
            </div>
          ))}
          {q.registeredShares != null && (
            <div className="flex items-center justify-between gap-4 px-3 py-1.5 bg-[hsl(var(--muted)/0.4)]">
              <span className="text-[hsl(var(--muted-foreground))]">
                Registered shares <span className="italic">(forecast, doesn&apos;t decide quorum)</span>
              </span>
              <span className="tabular-nums font-medium text-[hsl(var(--foreground))]">
                {Number(q.registeredShares).toLocaleString("en-NG")}
                {forecast != null && <span className="text-[hsl(var(--muted-foreground))]"> · {formatQuorumPct(forecast)}</span>}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

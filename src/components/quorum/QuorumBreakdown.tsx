"use client";

/**
 * Quorum (registered basis) — the deciding figure, the checked-in figure under
 * it, and a breakdown of both. The breakdown only renders when the response
 * carries share counts (client roles); super admin sees percentages only.
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  type QuorumFields, type QuorumRow, formatQuorumPct, formatThreshold, hasQuorumBreakdown, mainTallyRows, checkedInRows,
} from "@/lib/quorum";

/** "84.10%" + met/not met + required, then "Checked in: 81.24%" as a smaller line. */
export function QuorumFigure({ q, size = "lg" }: { q: QuorumFields; size?: "lg" | "md" }) {
  const noUnits = q.quorumPercentage == null;
  return (
    <>
      <div className={`${size === "lg" ? "text-2xl" : "text-xl"} font-bold tabular-nums`}>{formatQuorumPct(q.quorumPercentage)}</div>
      <div className={`text-xs font-semibold mt-1 ${q.quorumMet ? "text-green-600" : "text-red-500"}`}>
        {noUnits ? "No share units on the register" : q.quorumMet ? "Quorum met" : "Quorum not met"}
        {q.requiredQuorumPercentage != null && ` · required ${formatThreshold(q.requiredQuorumPercentage)}`}
      </div>
      <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">of share capital · registered + walk-in + proxy</div>
      {q.checkedInQuorumPercentage != null && (
        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 tabular-nums" title="Shareholders actually present plus proxies marked attended. Information only, doesn't decide quorum.">
          Checked in: <span className="font-semibold text-[hsl(var(--foreground))]">{formatQuorumPct(q.checkedInQuorumPercentage)}</span>
        </div>
      )}
    </>
  );
}

function Rows({ title, note, rows }: { title: string; note?: string; rows: QuorumRow[] }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden text-xs">
      <div className="px-3 py-1.5 bg-[hsl(var(--muted)/0.5)] font-semibold text-[hsl(var(--foreground))] flex items-center justify-between gap-2">
        <span>{title}</span>
        {note && <span className="font-normal text-[hsl(var(--muted-foreground))]">{note}</span>}
      </div>
      <div className="divide-y divide-[hsl(var(--border))]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 px-3 py-1.5">
            <span className="text-[hsl(var(--muted-foreground))]">
              {r.label}
              {r.sub && <span className="ml-1.5 opacity-80">({r.sub})</span>}
            </span>
            <span className={`tabular-nums text-[hsl(var(--foreground))] ${r.strong ? "font-bold" : "font-medium"}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Collapsible: main tally by route, then the checked-in (attendance report) lines. */
export function QuorumBreakdown({ q, defaultOpen = false }: { q: QuorumFields; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!hasQuorumBreakdown(q)) return null;
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
        <div className="mt-2 grid gap-2">
          {q.quorumShares != null && <Rows title="Quorum" note="decides quorum" rows={mainTallyRows(q)} />}
          {q.presentShares != null && <Rows title="Checked in" note="information only" rows={checkedInRows(q)} />}
        </div>
      )}
    </div>
  );
}

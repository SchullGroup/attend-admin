"use client";

/**
 * Quorum (registered basis).
 *  - QuorumFigure: compact, fits a stat card — the deciding %, met/not met, and
 *    one bar (faint = counted for quorum, solid = checked in, tick = required).
 *  - QuorumBreakdown: full-width, collapsible, two tables side by side. Render it
 *    BELOW the stat-card row, never inside a card, so it doesn't stretch the row.
 * Share counts reach client roles only; for super admin the breakdown renders nothing.
 */

import { useState } from "react";
import { ChevronDown, Scale } from "lucide-react";
import {
  type QuorumFields, type QuorumRow, formatQuorumPct, formatThreshold, hasQuorumBreakdown, mainTallyRows, checkedInRows,
} from "@/lib/quorum";

export function QuorumFigure({ q, size = "lg" }: { q: QuorumFields; size?: "lg" | "md" }) {
  const pct      = q.quorumPercentage;
  const required = q.requiredQuorumPercentage;
  const checked  = q.checkedInQuorumPercentage;
  const met      = !!q.quorumMet;
  const accent   = met ? "#16a34a" : "#d97706";

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`${size === "lg" ? "text-2xl" : "text-xl"} font-bold tabular-nums`}>{formatQuorumPct(pct)}</span>
        {pct != null && (
          <span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ backgroundColor: accent + "1a", color: accent }}>
            {met ? "Met" : "Not met"}
          </span>
        )}
      </div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
        {pct == null ? "No share units on the register" : "of share capital"}
        {required != null && <> · {formatThreshold(required)} required</>}
      </div>

      {pct != null && (
        <>
          <div className="relative mt-3">
            <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: accent, opacity: 0.35 }} />
              {checked != null && (
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${Math.min(checked, 100)}%`, backgroundColor: accent }} />
              )}
            </div>
            {required != null && (
              <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-[hsl(var(--foreground))]" style={{ left: `calc(${Math.min(required, 100)}% - 1px)` }} title={`${formatThreshold(required)} required`} />
            )}
          </div>
          {checked != null && (
            <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1.5 tabular-nums" title="Shareholders actually present plus proxies marked attended. Information only.">
              Checked in {formatQuorumPct(checked)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Rows({ title, rows }: { title: string; rows: QuorumRow[] }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden text-sm">
      <div className="px-4 py-2 bg-[hsl(var(--muted)/0.5)] font-semibold text-[hsl(var(--foreground))]">{title}</div>
      <div className="divide-y divide-[hsl(var(--border))]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 px-4 py-2">
            <span className="text-[hsl(var(--muted-foreground))]">
              {r.label}
              {r.sub && <span className="ml-1.5 text-xs opacity-80">{r.sub}</span>}
            </span>
            <span className={`tabular-nums text-[hsl(var(--foreground))] ${r.strong ? "font-bold" : "font-medium"}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuorumBreakdown({
  q, defaultOpen = false, showFigure = false,
}: {
  q: QuorumFields | null | undefined;
  defaultOpen?: boolean;
  /** Put the headline figure + bar at the top of the panel (one full-width card). */
  showFigure?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!q) return null;
  if (showFigure) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3 inline-flex items-center gap-2">
          <Scale className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Quorum
        </p>
        <QuorumFigure q={q} />
        {hasQuorumBreakdown(q) && (
          <div className="mt-5 grid gap-4 md:grid-cols-2 items-start">
            {q.quorumShares != null && <Rows title="Quorum" rows={mainTallyRows(q)} />}
            {q.presentShares != null && <Rows title="Checked in" rows={checkedInRows(q)} />}
          </div>
        )}
      </div>
    );
  }
  if (!hasQuorumBreakdown(q)) return null;
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
          <Scale className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Quorum breakdown
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
          {open ? "Hide" : "Show"} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 grid gap-4 md:grid-cols-2 items-start">
          {q.quorumShares != null && <Rows title="Quorum" rows={mainTallyRows(q)} />}
          {q.presentShares != null && <Rows title="Checked in" rows={checkedInRows(q)} />}
        </div>
      )}
    </div>
  );
}

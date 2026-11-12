/**
 * Quorum by shares (backend 2026-11-11).
 *
 *   quorumPercentage = presentShares / registerShares × 100   (achieved, 2 dp, null if no units)
 *   requiredQuorumPercentage                                    (the configured threshold)
 *   quorumMet                                                   (worked out on the exact figure —
 *                                                                always use it, never recompute
 *                                                                from the rounded percentage)
 *
 * The share breakdown is sent to client roles only. Super admin gets the
 * percentage, threshold and quorumMet, never share counts.
 */
export interface QuorumFields {
  quorumPercentage?:         number | null;
  requiredQuorumPercentage?: number | null;
  quorumMet?:                boolean;
  quorumBasis?:              "SHARES" | string | null;
  /** Issued share capital: Σ units of ACTIVE shareholders on the register. */
  registerShares?:           number | null;
  /** Total shareholder/proxy shares. */
  presentShares?:            number | null;
  shareholdersPresent?:      number | null;
  shareholdersShares?:       number | null;
  proxiesPresent?:           number | null;
  proxiesShares?:            number | null;
  /** Pre-meeting forecast (RSVPs + walk-ins). Never decides quorum. */
  registeredShares?:         number | null;
}

/** "81.24%" — two decimals, since quorum is a statutory figure. */
export function formatQuorumPct(v?: number | null): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Threshold: "25%" or "25.5%". */
export function formatThreshold(v?: number | null): string {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("en-NG", { maximumFractionDigits: 2 })}%`;
}

/** True when the response carries the share breakdown (client roles). */
export function hasQuorumBreakdown(q?: QuorumFields | null): boolean {
  return !!q && q.registerShares != null && q.presentShares != null;
}

/** The lines of Meristem's attendance report, in their order. */
export function quorumReportRows(q: QuorumFields): { label: string; value: string; strong?: boolean }[] {
  const n = (v?: number | null) => (v == null ? "—" : Number(v).toLocaleString("en-NG"));
  return [
    { label: "Issued share capital",           value: n(q.registerShares) },
    { label: "Total shareholder/proxy shares", value: n(q.presentShares) },
    { label: "Attendance % to share capital",  value: formatQuorumPct(q.quorumPercentage), strong: true },
    { label: "Shareholders present",           value: n(q.shareholdersPresent) },
    { label: "Shareholders' shares",           value: n(q.shareholdersShares) },
    { label: "Number of proxies",              value: n(q.proxiesPresent) },
    { label: "Proxies' shares",                value: n(q.proxiesShares) },
  ];
}

/** registeredShares as a % of the register, for the forecast line. */
export function registeredPct(q: QuorumFields): number | null {
  if (q.registeredShares == null || !q.registerShares) return null;
  return (q.registeredShares / q.registerShares) * 100;
}

/**
 * Quorum by shares, registered basis (backend 2026-11-12).
 *
 * MAIN TALLY — decides quorum (quorumBasis "REGISTERED"):
 *   a register holding counts once if it's covered by a registration (RSVP), a walk-in
 *   check-in, or a lodged proxy, and is listed under the first of those that applies.
 *   quorumPercentage = quorumShares / registerShares × 100   (2 dp, null if no units)
 *   quorumMet is worked out on the exact figure — always use it as sent.
 *
 * CHECKED IN — information only:
 *   checkedInQuorumPercentage = presentShares / registerShares × 100
 *   (shareholders actually present + proxies marked attended)
 *
 * Share counts are sent to client roles only. Super admin gets the two
 * percentages, the threshold, quorumMet and quorumBasis.
 */
export interface QuorumFields {
  quorumBasis?:               "REGISTERED" | "SHARES" | string | null;
  /** Main tally: registered + walk-in + proxy. Decides quorum. */
  quorumPercentage?:          number | null;
  requiredQuorumPercentage?:  number | null;
  quorumMet?:                 boolean;
  /** Issued share capital: Σ units of ACTIVE shareholders on the register. */
  registerShares?:            number | null;

  // ── main tally breakdown (adds up to quorumShares) ──
  quorumShares?:              number | null;
  registeredHoldings?:        number | null;
  registeredHoldingsShares?:  number | null;
  walkInHoldings?:            number | null;
  walkInShares?:              number | null;
  /** Proxy holders (people) across every lodged proxy. */
  proxiesCount?:              number | null;
  /** Holdings counted via proxy only (holder neither registered nor walked in). Usually 0. */
  proxyHoldings?:             number | null;
  proxyShares?:               number | null;

  // ── checked in (information only) ──
  checkedInQuorumPercentage?: number | null;
  presentShares?:             number | null;
  shareholdersPresent?:       number | null;
  shareholdersShares?:        number | null;
  proxiesPresent?:            number | null;
  proxiesShares?:             number | null;
}

/** "84.10%" — two decimals, since quorum is a statutory figure. */
export function formatQuorumPct(v?: number | null): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return `${Number(v).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Threshold: "25%" or "25.5%". */
export function formatThreshold(v?: number | null): string {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("en-NG", { maximumFractionDigits: 2 })}%`;
}

const n = (v?: number | null) => (v == null ? "—" : Number(v).toLocaleString("en-NG"));

/** True when the response carries share counts (client roles). */
export function hasQuorumBreakdown(q?: QuorumFields | null): boolean {
  return !!q && q.registerShares != null && (q.quorumShares != null || q.presentShares != null);
}

export interface QuorumRow { label: string; value: string; sub?: string; strong?: boolean }

/** Main tally: how the counted shares split by route. */
export function mainTallyRows(q: QuorumFields): QuorumRow[] {
  return [
    { label: "Issued share capital", value: n(q.registerShares) },
    { label: "Registered shareholders", value: n(q.registeredHoldingsShares), sub: q.registeredHoldings != null ? `${n(q.registeredHoldings)} holdings` : undefined },
    { label: "Walk-in shareholders",    value: n(q.walkInShares),             sub: q.walkInHoldings != null ? `${n(q.walkInHoldings)} holdings` : undefined },
    { label: "Proxies",                 value: n(q.proxyShares),              sub: q.proxiesCount != null ? `${n(q.proxiesCount)} proxies · ${n(q.proxyHoldings)} holdings` : undefined },
    { label: "Shares counted",          value: n(q.quorumShares) },
    { label: "Quorum % to share capital", value: formatQuorumPct(q.quorumPercentage), strong: true },
  ];
}

/** Checked in: the lines of Meristem's attendance report, in their order. */
export function checkedInRows(q: QuorumFields): QuorumRow[] {
  return [
    { label: "Total shareholder/proxy shares", value: n(q.presentShares) },
    { label: "Attendance % to share capital",  value: formatQuorumPct(q.checkedInQuorumPercentage), strong: true },
    { label: "Shareholders present",           value: n(q.shareholdersPresent) },
    { label: "Shareholders' shares",           value: n(q.shareholdersShares) },
    { label: "Number of proxies",              value: n(q.proxiesPresent) },
    { label: "Proxies' shares",                value: n(q.proxiesShares) },
  ];
}

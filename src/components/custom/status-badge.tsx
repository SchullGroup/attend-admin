const config: Record<string, { label: string; bg: string; color: string }> = {
  draft:          { label: "Draft",          bg: "#f3f4f6", color: "#6b7280" },
  published:      { label: "Published",      bg: "#dbeafe", color: "#374151" },
  live:           { label: "Live",           bg: "#dcfce7", color: "#16a34a" },
  ended:          { label: "Ended",          bg: "#f3f4f6", color: "#6b7280" },
  cancelled:      { label: "Cancelled",      bg: "#fee2e2", color: "#dc2626" },
  active:         { label: "Active",         bg: "#dcfce7", color: "#16a34a" },
  pending:        { label: "Pending",        bg: "#fef9c3", color: "#a16207" },
  suspended:      { label: "Suspended",      bg: "#fee2e2", color: "#dc2626" },
  // UserStatus is six values, not three (backend note 2026-09-14 §3.3). INACTIVE is the
  // default for every new signup, so it is the most common status in the table — without
  // an entry here it fell through to the raw fallback and rendered as "inactive".
  inactive:       { label: "Inactive",       bg: "#f3f4f6", color: "#6b7280" },
  rejected:       { label: "Rejected",       bg: "#fee2e2", color: "#dc2626" },
  revoked:        { label: "Revoked",        bg: "#fee2e2", color: "#dc2626" },
  none:           { label: "No KYC",         bg: "#f3f4f6", color: "#6b7280" },
  no_kyc:         { label: "No KYC",         bg: "#f3f4f6", color: "#6b7280" },
  basic:          { label: "Basic KYC",      bg: "#dbeafe", color: "#374151" },
  basic_kyc:      { label: "Basic KYC",      bg: "#dbeafe", color: "#374151" },
  full:           { label: "Full KYC",       bg: "#dcfce7", color: "#16a34a" },
  full_kyc:       { label: "Full KYC",       bg: "#dcfce7", color: "#16a34a" },
  submitted:      { label: "Submitted",      bg: "#dbeafe", color: "#374151" },
  under_review:   { label: "Under Review",   bg: "#fef9c3", color: "#a16207" },
  shortlisted:    { label: "Shortlisted",    bg: "#dcfce7", color: "#16a34a" },
  selected:       { label: "Selected",       bg: "#f3e8ff", color: "#7c22c9" },
  not_progressed: { label: "Not Progressed", bg: "#f3f4f6", color: "#6b7280" },
  open:           { label: "Open",           bg: "#dcfce7", color: "#16a34a" },
  closed:         { label: "Closed",         bg: "#f3f4f6", color: "#6b7280" },
};

/**
 * Last resort for a status this map has never seen. Callers commonly lower-case before
 * passing a value in, so echoing the raw string put "inactive" and "no_kyc" on screen —
 * which reads as an API bug and sent us chasing the backend for a casing problem that was
 * ours. Title-case it instead: a new enum value shows up as "Under Appeal", not "under_appeal".
 */
function humanise(status: string): string {
  return (status ?? "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function StatusBadge({ status }: { status: string }) {
  const key = status?.toLowerCase?.() ?? "";
  const c = config[key] ?? { label: humanise(status), bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span
      // `whitespace-nowrap` matters more than it looks: a two-word label like
      // "Basic KYC" or "Full KYC" wraps inside the pill as soon as its column
      // is tight, which makes the badge two lines tall and drags the whole row
      // with it. The column should give way, not the badge.
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

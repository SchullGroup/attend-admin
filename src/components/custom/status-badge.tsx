const config: Record<string, { label: string; bg: string; color: string }> = {
  draft:          { label: "Draft",          bg: "#f3f4f6", color: "#6b7280" },
  published:      { label: "Published",      bg: "#dbeafe", color: "#1d4ed8" },
  live:           { label: "Live",           bg: "#dcfce7", color: "#16a34a" },
  ended:          { label: "Ended",          bg: "#f3f4f6", color: "#6b7280" },
  cancelled:      { label: "Cancelled",      bg: "#fee2e2", color: "#dc2626" },
  active:         { label: "Active",         bg: "#dcfce7", color: "#16a34a" },
  pending:        { label: "Pending",        bg: "#fef9c3", color: "#a16207" },
  suspended:      { label: "Suspended",      bg: "#fee2e2", color: "#dc2626" },
  none:           { label: "No KYC",         bg: "#f3f4f6", color: "#6b7280" },
  basic:          { label: "Basic KYC",      bg: "#dbeafe", color: "#1d4ed8" },
  full:           { label: "Full KYC",       bg: "#dcfce7", color: "#16a34a" },
  submitted:      { label: "Submitted",      bg: "#dbeafe", color: "#1d4ed8" },
  under_review:   { label: "Under Review",   bg: "#fef9c3", color: "#a16207" },
  shortlisted:    { label: "Shortlisted",    bg: "#dcfce7", color: "#16a34a" },
  selected:       { label: "Selected",       bg: "#f3e8ff", color: "#7c22c9" },
  not_progressed: { label: "Not Progressed", bg: "#f3f4f6", color: "#6b7280" },
  open:           { label: "Open",           bg: "#dcfce7", color: "#16a34a" },
  closed:         { label: "Closed",         bg: "#f3f4f6", color: "#6b7280" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = config[status] ?? { label: status, bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

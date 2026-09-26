/**
 * Filter dropdowns: one rule for the "All …" row.
 *
 * A filter select needs exactly one "All …" entry, and it has to be ours —
 * the list behind it can come back empty, and a Radix Select whose value
 * matches no item renders a blank trigger. But several backend lists ship an
 * All row of their own, so rendering ours plus theirs gives you "All
 * Organisers" twice.
 *
 * This repo has shipped that duplicate more than once: first as a doubled
 * status tab across four screens, then again on the Document Vault filters.
 * The fix each time was local, which is why it came back. Every filter list
 * goes through here instead.
 *
 * Two shapes are covered, because the backends disagree:
 *   - an entry with no id (the empty-string "All" convention), and
 *   - an entry with a real id whose label is just the All row spelled out.
 *
 * It also drops unlabelled rows, which would otherwise render as a blank line
 * in the menu that silently clears the filter when clicked.
 */
export function withoutServerAllRow<T>(
  rows: readonly T[] | null | undefined,
  getId: (row: T) => string | null | undefined,
  getLabel: (row: T) => string | null | undefined,
  /** The label of the All row this select renders itself, e.g. "All Events". */
  allLabel: string,
): T[] {
  const all = allLabel.trim().toLowerCase();
  return (rows ?? []).filter((row) => {
    const id    = (getId(row) ?? "").trim();
    const label = (getLabel(row) ?? "").trim();
    if (!id || !label) return false;
    return label.toLowerCase() !== all;
  });
}

/** The same rule for a list of plain strings (a track name, a tag). */
export function withoutServerAllValue(
  values: readonly string[] | null | undefined,
  allLabel: string,
): string[] {
  const all = allLabel.trim().toLowerCase();
  return (values ?? []).filter((v) => {
    const s = (v ?? "").trim();
    return !!s && s.toLowerCase() !== all;
  });
}

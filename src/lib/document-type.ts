import {
  FileText, FileBarChart, Bell, BookOpen, Award, Package, Monitor,
} from "lucide-react";

/** Allowed documentType values from the API */
export const DOC_TYPES = [
  "NOTICE", "AGENDA", "MINUTES", "REPORT",
  "PRESENTATION", "PRESS_KIT", "CERTIFICATE", "OTHER",
] as const;

export type DocType = typeof DOC_TYPES[number];

/**
 * Shared icon / color config for document types — used anywhere a document
 * row is rendered (global Documents vault, per-register Documents section,
 * per-event Documents tab) so the same file always shows the same icon.
 */
export const DOC_TYPE_CONFIG: Record<DocType, { label: string; icon: React.ElementType; bg: string; color: string }> = {
  NOTICE:       { label: "Notice",       icon: Bell,         bg: "#dbeafe", color: "#1d4ed8" },
  AGENDA:       { label: "Agenda",       icon: BookOpen,     bg: "#dcfce7", color: "#16a34a" },
  MINUTES:      { label: "Minutes",      icon: FileText,     bg: "#f3f4f6", color: "#6b7280" },
  REPORT:       { label: "Report",       icon: FileBarChart, bg: "#fef9c3", color: "#a16207" },
  PRESENTATION: { label: "Presentation", icon: Monitor,      bg: "#ede9fe", color: "#7c3aed" },
  PRESS_KIT:    { label: "Press Kit",    icon: Package,      bg: "#f3e8ff", color: "#7c22c9" },
  CERTIFICATE:  { label: "Certificate",  icon: Award,        bg: "#fff4eb", color: "#ea6c00" },
  OTHER:        { label: "Other",        icon: FileText,     bg: "#f3f4f6", color: "#6b7280" },
};

export function getDocTypeConfig(documentType?: string | null) {
  const key = ((documentType ?? "OTHER").toUpperCase() as DocType);
  return DOC_TYPE_CONFIG[key] ?? DOC_TYPE_CONFIG.OTHER;
}

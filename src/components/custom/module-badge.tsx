import { cn } from "@/lib/utils";

const config = {
  AGM:       { label: "AGM",       bg: "#edf7f2", color: "#1a6b3c" },
  LAUNCH:    { label: "Launch",    bg: "#fff4eb", color: "#ea6c00" },
  HACKATHON: { label: "Hackathon", bg: "#f8f0ff", color: "#7c22c9" },
  GENERAL:   { label: "General",   bg: "#eff5ff", color: "#1d4ed8" },
};

export function ModuleBadge({ module, className }: { module: keyof typeof config; className?: string }) {
  const c = config[module];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

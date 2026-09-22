"use client";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accent?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accent,
}: StatCardProps) {
  return (
    <Card className="attend-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="attend-section-title">{title}</span>
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center",
            accent ? "" : "bg-[hsl(var(--muted))]",
          )}
          style={accent ? { backgroundColor: accent + "18" } : {}}
        >
          <Icon
            className="h-4 w-4"
            style={
              accent
                ? { color: accent }
                : { color: "hsl(var(--muted-foreground))" }
            }
          />
        </div>
      </div>
      <div className="min-w-0">
        {/* Same reason as components/dashboard/stat-card: `value` accepts a
            string, and a long one has to wrap rather than break the tile. */}
        <div className={`font-bold tabular-nums text-foreground ${
          typeof value === "string" && value.length > 12
            ? "text-base leading-snug break-words"
            : "text-3xl"
        }`} title={typeof value === "string" ? value : undefined}>
          {value}
        </div>
        {trend && (
          <div
            className={cn(
              "text-sm mt-1 font-medium",
              trend.positive ? "text-green-600" : "text-red-600",
            )}
          >
            {trend.value}
          </div>
        )}
        {subtitle && !trend && (
          <div className="text-sm mt-1 text-muted-foreground">{subtitle}</div>
        )}
      </div>
    </Card>
  );
}

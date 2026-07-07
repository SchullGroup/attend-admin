"use client";

import type { ElementType } from "react";

export interface StatCardItem {
  label:   string;
  value:   number | string;
  sub:     string;
  icon:    ElementType;
  color:   string;
}

interface StatCardProps extends StatCardItem {
  loading?: boolean;
  /** Opacity multiplier appended to hex color for background tint (default "18") */
  bgOpacity?: string;
}

export function StatCard({ label, value, sub, icon: Icon, color, loading, bgOpacity = "18" }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 px-6 py-5">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + bgOpacity }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium text-[hsl(var(--muted-foreground))] mb-0.5">{label}</p>
        {loading ? (
          <div className="h-7 w-12 rounded-lg bg-[hsl(var(--muted))] animate-pulse mt-0.5" />
        ) : (
          <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))] leading-none">{value}</p>
        )}
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

interface StatGridProps {
  items:    StatCardItem[];
  loading?: boolean;
  bgOpacity?: string;
  cols?:    3 | 4;
}

export function StatGrid({ items, loading, bgOpacity, cols = 4 }: StatGridProps) {
  const colClass = cols === 3 ? "grid-cols-3" : "grid-cols-4";
  return (
    <div
      className={`grid ${colClass} divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden`}
    >
      {items.map((item) => (
        <StatCard key={item.label} {...item} loading={loading} bgOpacity={bgOpacity} />
      ))}
    </div>
  );
}

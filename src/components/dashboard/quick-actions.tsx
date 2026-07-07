"use client";

import Link from "next/link";
import type { ElementType } from "react";

export interface QuickAction {
  label: string;
  href:  string;
  icon:  ElementType;
  color: string;
  bg:    string;
}

interface QuickActionsProps {
  items: QuickAction[];
  /** Number of columns — defaults to items.length (up to 4) */
  cols?: 2 | 3 | 4;
}

const COL_CLASS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function QuickActions({ items, cols }: QuickActionsProps) {
  const gridCols = cols ?? Math.min(items.length, 4);
  const colClass = COL_CLASS[gridCols] ?? "grid-cols-3";

  return (
    <div className={`grid ${colClass} gap-3`}>
      {items.map(({ label, href, icon: Icon, color, bg }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:shadow-sm hover:-translate-y-0.5 transition-all"
        >
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: bg }}
          >
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</span>
        </Link>
      ))}
    </div>
  );
}

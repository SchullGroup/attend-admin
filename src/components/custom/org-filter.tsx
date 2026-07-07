"use client";
import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrgFilter({
  organisers,
  value,
  onChange,
}: {
  organisers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? organisers.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : organisers;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex items-center gap-2 h-9 rounded-lg border px-3 text-sm transition-colors whitespace-nowrap",
          value
            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] text-[hsl(var(--primary))]"
            : "border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground))] hover:border-[hsl(var(--ring)/0.5)]"
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-[180px] truncate">{value || "All Organisers"}</span>
        {value ? (
          <X
            className="h-3 w-3 shrink-0"
            onClick={(e) => { e.stopPropagation(); onChange(""); setQuery(""); setOpen(false); }}
          />
        ) : (
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 min-w-[220px] rounded-xl border border-[hsl(var(--border))] bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2 px-2 py-0.5">
              <Search className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search organisers…"
                className="flex-1 text-sm bg-transparent outline-none py-1 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
              className={cn(
                "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors",
                !value && "bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))] font-medium"
              )}
            >
              <span className="w-3.5 shrink-0 flex items-center justify-center">
                {!value && <Check className="h-3.5 w-3.5" />}
              </span>
              All Organisers
            </button>
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">No results.</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => { onChange(o); setOpen(false); setQuery(""); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-[hsl(var(--muted))] transition-colors",
                    value === o && "bg-[hsl(var(--primary)/0.05)] text-[hsl(var(--primary))] font-medium"
                  )}
                >
                  <span className="w-3.5 shrink-0 flex items-center justify-center">
                    {value === o && <Check className="h-3.5 w-3.5" />}
                  </span>
                  {o}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

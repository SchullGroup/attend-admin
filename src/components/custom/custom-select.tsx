"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomSelectProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ options, value, onChange, placeholder = "Select…", className }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
      >
        <span className={selected ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-[hsl(var(--muted-foreground))] shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg p-1 max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-[hsl(var(--accent))] transition-colors text-left"
            >
              <span className="text-[hsl(var(--foreground))]">{opt.label}</span>
              {value === opt.value && <Check className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

/**
 * NativeSelect — a plain <select> that matches the design system.
 *
 * The app has a Radix `Select` for rich menus, but a lot of screens use a raw
 * <select> instead: it is right inside forms, needs no sentinel for the empty
 * value, and does the correct thing on mobile. The problem was never the
 * element, it was that each one carried its own hand-written classes — so
 * heights drifted between h-8, h-9 and h-10, and the browser's own chevron sat
 * inside our border looking bolted on.
 *
 * This is the same element with one set of styles and our own chevron, so a
 * native select sits beside an Input or a Radix trigger without looking like a
 * different era of the app. Behaviour is unchanged: it forwards every prop,
 * including `value`, `onChange`, `name`, `disabled` and `required`.
 *
 * Use the Radix `Select` when a menu needs rich rows, icons or descriptions.
 * Use this for an ordinary list of options.
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NativeSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Classes for the wrapper — put width here (e.g. `w-40`, `flex-1`). */
  wrapperClassName?: string;
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  function NativeSelect({ className, wrapperClassName, children, ...props }, ref) {
    return (
      <div className={cn("relative inline-flex", wrapperClassName)}>
        <select
          ref={ref}
          // `appearance-none` is what removes the OS control. Without it the
          // browser draws its own arrow as well and you get two.
          className={cn(
            "h-9 w-full appearance-none rounded-lg border border-[hsl(var(--input))]",
            "bg-[hsl(var(--background))] pl-3 pr-8 text-sm text-[hsl(var(--foreground))]",
            "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50"
        />
      </div>
    );
  },
);

export default NativeSelect;

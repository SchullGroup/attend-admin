"use client";

/**
 * TourOverlay — the dimmed screen, the spotlight, and the card.
 *
 * The spotlight is one element with an enormous spread box-shadow: the div sits
 * exactly over the anchor and the shadow paints everything *outside* it. That
 * is one compositor layer and no SVG mask, so it stays smooth while the page
 * scrolls underneath.
 *
 * Nothing here blocks the page. `pointer-events` is off on the dim layer, so a
 * misplaced spotlight can never make the app feel frozen — the tour is a guide,
 * not a modal.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { TourStep } from "@/lib/tour/types";

const BRAND = "#7c22c9";
const CARD_WIDTH = 340;
const GAP = 14;

interface Rect { top: number; left: number; width: number; height: number }

/**
 * Poll for the anchor.
 *
 * Steps cross pages, and a page's data lands after its route does, so the
 * element a step wants often does not exist for several hundred milliseconds.
 * Polling on animation frames costs nothing while idle and gives up after
 * `timeout`, at which point the step renders as a centred card.
 */
function useAnchorRect(target: string | undefined, deps: unknown[]): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  const frame = useRef<number | null>(null);

  const measure = useCallback((el: Element) => {
    const r = el.getBoundingClientRect();
    // A zero-size box means the element is in the DOM but not laid out yet
    // (inside a collapsed parent, or mid-transition). Treat it as not ready.
    if (r.width === 0 && r.height === 0) return false;
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    return true;
  }, []);

  useLayoutEffect(() => {
    setRect(null);
    if (!target) return;

    const selector = `[data-tour="${CSS.escape(target)}"]`;
    const startedAt = performance.now();
    const TIMEOUT = 4000;
    let scrolled = false;
    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        }
        measure(el);
      } else if (performance.now() - startedAt > TIMEOUT) {
        return; // Give up; the card centres itself.
      }
      frame.current = requestAnimationFrame(tick);
    }

    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return rect;
}

export function TourOverlay({
  step,
  stepNumber,
  stepCount,
  tourLabel,
  onNext,
  onBack,
  onSkip,
}: {
  step: TourStep;
  stepNumber: number;
  stepCount: number;
  tourLabel: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const rect = useAnchorRect(step.target, [step.id, step.target]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(0);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [step.id, rect]);

  // Move focus to the card so Tab stays inside it and screen readers announce
  // the step rather than leaving focus wherever the user last clicked.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [step.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")                       { e.preventDefault(); onSkip(); }
      else if (e.key === "ArrowRight")              { e.preventDefault(); onNext(); }
      else if (e.key === "ArrowLeft" && stepNumber > 1) { e.preventDefault(); onBack(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onBack, onSkip, stepNumber]);

  const pad = step.padding ?? 8;

  // ── Card position ────────────────────────────────────────────────────────
  // Without an anchor the card centres itself, which is also the deliberate
  // look for the chapter cards that open each section.
  let cardStyle: React.CSSProperties;

  if (!rect) {
    cardStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: CARD_WIDTH,
    };
  } else {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const h  = cardHeight || 200;

    const spaceBelow = vh - (rect.top + rect.height);
    const spaceRight = vw - (rect.left + rect.width);

    let placement = step.placement ?? "auto";
    if (placement === "auto") {
      if (spaceBelow > h + GAP + 16) placement = "bottom";
      else if (rect.top > h + GAP + 16) placement = "top";
      else if (spaceRight > CARD_WIDTH + GAP) placement = "right";
      else placement = "left";
    }

    let top  = 0;
    let left = 0;

    if (placement === "bottom")      { top = rect.top + rect.height + pad + GAP; left = rect.left; }
    else if (placement === "top")    { top = rect.top - pad - GAP - h;           left = rect.left; }
    else if (placement === "right")  { top = rect.top;                           left = rect.left + rect.width + pad + GAP; }
    else                             { top = rect.top;                           left = rect.left - pad - GAP - CARD_WIDTH; }

    // Keep it on screen whatever the anchor does near an edge.
    left = Math.min(Math.max(12, left), vw - CARD_WIDTH - 12);
    top  = Math.min(Math.max(12, top),  vh - h - 12);

    cardStyle = { top, left, width: CARD_WIDTH };
  }

  const isLast  = stepNumber === stepCount;
  const isFirst = stepNumber === 1;

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* Dim layer + spotlight. pointer-events:none throughout — the tour never
          takes the page hostage. */}
      {rect ? (
        <div
          aria-hidden
          className="absolute rounded-xl transition-all duration-200 ease-out pointer-events-none"
          style={{
            top:    rect.top - pad,
            left:   rect.left - pad,
            width:  rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: `0 0 0 9999px rgba(15,23,42,0.55)`,
            outline: `2px solid ${BRAND}`,
            outlineOffset: 2,
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundColor: "rgba(15,23,42,0.55)" }} />
      )}

      {/* Card */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label={`${tourLabel}: step ${stepNumber} of ${stepCount}`}
        tabIndex={-1}
        className="absolute rounded-2xl bg-white shadow-2xl outline-none"
        style={{ ...cardStyle, padding: 20 }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <span
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: BRAND }}
          >
            {tourLabel} · {stepNumber}/{stepCount}
          </span>
          <button
            type="button"
            onClick={onSkip}
            aria-label="End tour"
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors -mt-1 -mr-1 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1.5">
          {step.title}
        </h3>
        <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
          {step.body}
        </p>

        {/* Progress */}
        <div className="mt-4 h-1 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${(stepNumber / stepCount) * 100}%`, backgroundColor: BRAND }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={onBack}
                className="h-8 px-3 rounded-lg border border-[hsl(var(--border))] text-xs font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              autoFocus
              className="h-8 px-3.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 inline-flex items-center gap-1"
              style={{ backgroundColor: BRAND }}
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

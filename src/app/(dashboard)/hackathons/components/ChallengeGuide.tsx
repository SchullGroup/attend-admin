"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Lightbulb, X } from "lucide-react";

// Remembered per-user (per-browser). Guarded reads/writes — localStorage is
// unavailable during SSR and can throw in privacy modes.
const GUIDE_DISMISS_KEY = "attend:hackathons-guide-dismissed";

const BRAND = "#7c22c9";

type GuideStep = { title: string; detail: string };

// The end-to-end challenge lifecycle, in the order a client admin performs it.
// Mirrors the real controls: Settings (submission fields), Overview
// (applications open/close + End Challenge), Applications (shortlisting),
// Judges (assign + scoring toggle), Leaderboard (ranking), Winners (announce).
const STEPS: GuideStep[] = [
  { title: "Create a challenge",     detail: "In Events → Create Event, choose Innovation Challenge and add the basics." },
  { title: "Set what to submit",     detail: "Open the challenge's Settings tab to pick the fields teams fill in when they apply." },
  { title: "Open applications",      detail: "On the Overview tab, toggle applications Open so teams can start applying." },
  { title: "Review & shortlist",     detail: "On the Applications tab, read submissions and move promising teams to Shortlisted." },
  { title: "Assign judges & scoring", detail: "On the Judges tab, add judges from your org and turn Scoring On." },
  { title: "Score & rank",           detail: "Judges score shortlisted teams; the Leaderboard ranks them automatically." },
  { title: "End & announce winners", detail: "End the challenge on Overview, then publish winners on the Winners tab." },
];

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GUIDE_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * "How Innovation Challenges work" — a numbered walkthrough for the /hackathons
 * landing page.
 *
 * - Dismissible; the choice is remembered per-user via localStorage.
 * - When dismissed, collapses to a compact "How Innovation Challenges work"
 *   button that reopens it.
 * - `alwaysShow` (used for the empty state) forces the full panel open and
 *   hides the dismiss control — with no challenges yet, the guide IS the content.
 */
export function ChallengeGuidePanel({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated]   = useState(false);

  // localStorage is client-only. Defer the read to an effect so the first
  // client render matches the server (nothing) and there's no hydration
  // mismatch; the panel then appears rather than flashing open→collapsed.
  useEffect(() => {
    setDismissed(readDismissed());
    setHydrated(true);
  }, []);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(GUIDE_DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  function reopen() {
    setDismissed(false);
    try { localStorage.removeItem(GUIDE_DISMISS_KEY); } catch { /* ignore */ }
  }

  // Empty state renders deterministically (no storage dependency) so it can
  // paint on the first frame without waiting for hydration.
  if (!alwaysShow) {
    if (!hydrated) return null;
    if (dismissed) {
      return (
        <button
          onClick={reopen}
          className="self-start inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted)/0.5)] hover:text-[hsl(var(--foreground))]"
        >
          <Lightbulb className="h-3.5 w-3.5" style={{ color: BRAND }} />
          How Innovation Challenges work
        </button>
      );
    }
  }

  return (
    <div className="attend-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${BRAND}18` }}
          >
            <Lightbulb className="h-5 w-5" style={{ color: BRAND }} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
              How Innovation Challenges work
            </h2>
            <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
              Run a challenge end to end — from setup to announcing winners.
            </p>
          </div>
        </div>
        {!alwaysShow && (
          <button
            onClick={dismiss}
            title="Dismiss"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"
          >
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: BRAND }}
            >
              {i + 1}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One-line contextual "what to do next" callout shown at the top of a challenge
 * detail tab. Purple-tinted to match the challenge theme; text uses foreground
 * tokens so it stays readable in both light and dark modes.
 */
export function TabHint({ label = "Next", children }: { label?: string; children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs text-[hsl(var(--muted-foreground))]"
      style={{ borderColor: `${BRAND}2e`, backgroundColor: `${BRAND}0d` }}
    >
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: BRAND }} />
      <span className="leading-relaxed">
        <span className="font-semibold text-[hsl(var(--foreground))]">{label}:</span> {children}
      </span>
    </div>
  );
}

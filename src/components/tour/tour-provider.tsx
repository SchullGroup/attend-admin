"use client";

/**
 * TourProvider — the engine behind the guided tour.
 *
 * Responsibilities, in order of how much trouble they caused:
 *
 * 1. Finding the thing a step points at. Steps can move between pages, and a
 *    page's content arrives after its route does, so the engine polls for the
 *    anchor rather than measuring once and hoping.
 * 2. Never trapping anyone. A missing anchor degrades to a centred card, a
 *    step whose route 404s still advances, Escape always exits, and the
 *    overlay never swallows the page when the tour is not running.
 * 3. Remembering. The welcome tour runs once per person per browser; every
 *    tour stays replayable from the header menu afterwards.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useGetMe } from "@/api/auth/hooks";
import { apiClient } from "@/lib/api-client";
import { resolveRole } from "@/lib/utils";
import { TOURS, WELCOME_TOUR_ID } from "@/lib/tour/tours";
import type { Tour, TourRole, TourStep } from "@/lib/tour/types";
import { TourOverlay } from "./tour-overlay";

// Bump the version when the tour content changes enough that returning users
// should be shown it again. Everything is namespaced under it, so an old key
// is simply ignored rather than needing a migration.
const STORAGE_KEY = "attend:tour:completed:v1";

function readCompleted(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    // Private mode, blocked storage, or a value someone hand-edited. Treat it
    // as "nothing seen yet" — showing the tour twice is a far smaller problem
    // than crashing the dashboard shell it is mounted in.
    return [];
  }
}

function writeCompleted(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* Not worth surfacing — the tour simply offers itself again next time. */
  }
}

/** Steps this role can actually see. */
function stepsForRole(tour: Tour, role: TourRole | ""): TourStep[] {
  return tour.steps.filter((s) => !s.roles || (role && s.roles.includes(role as TourRole)));
}

export function toursForRole(role: TourRole | ""): Tour[] {
  return TOURS.filter(
    (t) => (!t.roles || (role && t.roles.includes(role as TourRole))) && stepsForRole(t, role).length > 0
  );
}

interface TourContextValue {
  /** Tours this user can run, for the "Take a tour" menu. */
  available: Tour[];
  /** Currently running tour, or null. */
  activeTour: Tour | null;
  start: (tourId: string) => void;
  stop: () => void;
  /** True once the welcome tour has been completed or skipped. */
  hasSeenWelcome: boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    // A no-op rather than a throw: the header renders in places (tests,
    // storybook, a future public page) where the provider may not be mounted,
    // and a missing tour is not worth a white screen.
    return {
      available: [],
      activeTour: null,
      start: () => {},
      stop: () => {},
      hasSeenWelcome: true,
    };
  }
  return ctx;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { data: userResponse } = useGetMe();
  const role = resolveRole(userResponse?.data) as TourRole | "";

  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated,  setHydrated]  = useState(false);
  const [activeId,  setActiveId]  = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  // localStorage is client-only; deferring the read keeps the first client
  // render identical to the server's and avoids a hydration mismatch.
  useEffect(() => {
    setCompleted(readCompleted());
    setHydrated(true);
  }, []);

  const available = useMemo(() => toursForRole(role), [role]);

  const activeTour = useMemo(
    () => (activeId ? available.find((t) => t.id === activeId) ?? null : null),
    [activeId, available]
  );

  const steps = useMemo(
    () => (activeTour ? stepsForRole(activeTour, role) : []),
    [activeTour, role]
  );

  const markCompleted = useCallback((id: string) => {
    setCompleted((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writeCompleted(next);
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    if (activeId) markCompleted(activeId);
    setActiveId(null);
    setStepIndex(0);
  }, [activeId, markCompleted]);

  const start = useCallback(
    (tourId: string) => {
      if (!available.some((t) => t.id === tourId)) return;
      setActiveId(tourId);
      setStepIndex(0);
    },
    [available]
  );

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= steps.length) {
        // Finished. Defer the teardown so this setState is not interleaved
        // with the one inside stop().
        queueMicrotask(stop);
        return i;
      }
      return i + 1;
    });
  }, [steps.length, stop]);

  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  // ── Auto-start the welcome tour, once ────────────────────────────────────
  // Waits for the role, because the welcome tour a Judge sees is not the one a
  // Super Admin sees, and starting before `useGetMe` resolves would show the
  // wrong one. Also holds off on the login and error routes.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!hydrated || autoStarted.current) return;
    if (!role) return;
    if (completed.includes(WELCOME_TOUR_ID)) return;
    if (!available.some((t) => t.id === WELCOME_TOUR_ID)) return;

    autoStarted.current = true;
    // One frame of delay so the dashboard has painted behind the overlay —
    // opening onto a half-rendered shell reads as a broken page.
    const timer = window.setTimeout(() => setActiveId(WELCOME_TOUR_ID), 600);
    return () => window.clearTimeout(timer);
  }, [hydrated, role, completed, available]);

  // ── Example records ──────────────────────────────────────────────────────
  // The deep tours are far more use standing on a real challenge or a real
  // vote record than describing one from a centred card — "this is where you
  // open applications" lands when the button is under the spotlight.
  //
  // So a step's route may contain :challengeId or :voteEventId, and we look up
  // one example when the tour starts. Deliberately not a react-query hook: a
  // hook here would fire on every dashboard page load for every role, and
  // these are org-scoped endpoints that 403 for roles that cannot see them.
  // One request, only when a tour that needs it begins.
  const [examples, setExamples] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeTour) return;

    const needed = new Set<string>();
    for (const s of activeTour.steps) {
      if (s.route?.includes(":challengeId")) needed.add("challengeId");
      if (s.route?.includes(":voteEventId")) needed.add("voteEventId");
    }
    if (needed.size === 0) return;

    let cancelled = false;

    // Each entry: the param, the endpoint for this role, and how to dig the id
    // out of the several envelope shapes these endpoints use.
    const lookups: { key: string; url: string; pick: (raw: any) => string | undefined }[] = [];

    if (needed.has("challengeId")) {
      const url =
        role === "judge"         ? "/api/v1/judge/challenges"
        : role === "super_admin" ? "/api/v1/admin/challenges"
        :                          "/api/v1/client/challenges";
      lookups.push({
        key: "challengeId",
        url,
        pick: (raw) => (raw?.challenges ?? raw?.content ?? raw?.items ?? [])[0]?.id,
      });
    }

    if (needed.has("voteEventId")) {
      lookups.push({
        key: "voteEventId",
        url: "/api/v1/client/votes",
        pick: (raw) => {
          const row = (raw?.records ?? raw?.events ?? raw?.content ?? [])[0];
          return row?.id ?? row?.eventId;
        },
      });
    }

    Promise.all(
      lookups.map(async ({ key, url, pick }) => {
        try {
          const res = await apiClient.get(url, { params: { page: 0, size: 1 } });
          const raw = (res.data as any)?.data ?? res.data;
          const id  = pick(raw);
          return id ? ([key, id] as const) : null;
        } catch {
          // No example yet, no permission, or the endpoint is down. The step
          // keeps its centred card — never a reason to interrupt the tour.
          return null;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      const found = Object.fromEntries(pairs.filter(Boolean) as (readonly [string, string])[]);
      if (Object.keys(found).length) setExamples((prev) => ({ ...prev, ...found }));
    });

    return () => { cancelled = true; };
  }, [activeTour, role]);

  /** Fill :challengeId / :voteEventId, or return null if we have no example. */
  const resolveRoute = useCallback(
    (route: string | undefined): string | null => {
      if (!route) return null;
      if (!route.includes(":")) return route;
      const id =
        route.includes(":challengeId") ? examples.challengeId :
        route.includes(":voteEventId") ? examples.voteEventId : undefined;
      if (!id) return null;
      return route.replace(":challengeId", id).replace(":voteEventId", id);
    },
    [examples]
  );

  // ── Route the tour needs ─────────────────────────────────────────────────
  const step = steps[stepIndex];

  useEffect(() => {
    const target = resolveRoute(step?.route);
    if (!target) return;
    // Compare without the query string: a step that lands on ?tab=Applications
    // must not re-push every time the page rewrites its own filters.
    if (pathname === target.split("?")[0]) return;
    router.push(target);
  }, [step, pathname, router, resolveRoute]);

  const value = useMemo<TourContextValue>(
    () => ({
      available,
      activeTour,
      start,
      stop,
      hasSeenWelcome: !hydrated || completed.includes(WELCOME_TOUR_ID),
    }),
    [available, activeTour, start, stop, hydrated, completed]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && step && (
        <TourOverlay
          step={step}
          stepNumber={stepIndex + 1}
          stepCount={steps.length}
          tourLabel={activeTour.label}
          onNext={next}
          onBack={back}
          onSkip={stop}
        />
      )}
    </TourContext.Provider>
  );
}

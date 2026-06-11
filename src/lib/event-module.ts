/**
 * event-module.ts — shared event-type colour and label utilities
 *
 * Used by:
 *   - Dashboard event feed
 *   - Events directory table
 *   - Registers/[id] events tab
 */

export type EventModule = "AGM" | "HACKATHON" | "LAUNCH" | "GENERAL";

/**
 * Solid fill colours for the per-event-type indicator circle.
 * Intentionally distinct and accessible.
 */
export const MODULE_COLORS: Record<EventModule, string> = {
  AGM:      "#1e40af",   // blue
  LAUNCH:   "#ea6c00",   // orange
  HACKATHON:"#7c22c9",   // purple
  GENERAL:  "#374151",   // dark-slate
};

/** Derive the module key from an API eventType string. */
export function toEventModule(eventType?: string | null): EventModule {
  if (!eventType) return "GENERAL";
  const t = eventType.toUpperCase();
  if (t === "AGM_EGM" || t === "AGM")                       return "AGM";
  if (t === "PRODUCT_LAUNCH")                                return "LAUNCH";
  if (t === "INNOVATION_CHALLENGE" || t === "HACKATHON")     return "HACKATHON";
  return "GENERAL";
}

/**
 * Derive module from an event object that may carry eventType directly,
 * or fall back to scanning tags.
 */
export function getEventModule(event: {
  eventType?: string | null;
  tags?: string[];
}): EventModule {
  if (event.eventType) return toEventModule(event.eventType);
  const tags = (event.tags ?? []).join(" ").toUpperCase();
  if (tags.includes("AGM") || tags.includes("EGM"))             return "AGM";
  if (tags.includes("LAUNCH") || tags.includes("PRODUCT"))      return "LAUNCH";
  if (tags.includes("HACKATHON") || tags.includes("CHALLENGE")) return "HACKATHON";
  return "GENERAL";
}

/**
 * Extract the organiser (register) name from any event object.
 *
 * Priority per API spec (GET /api/v1/client/events response):
 *   1. registerName   — primary field in client event list response
 *   2. stakeholderName — alias returned by some admin endpoints
 *   3. organizerName  — alias returned by some admin endpoints
 */
export function getEventRegisterName(event: {
  registerName?:    string | null;
  stakeholderName?: string | null;
  organizerName?:   string | null;
}): string {
  return event.registerName || event.stakeholderName || event.organizerName || "";
}

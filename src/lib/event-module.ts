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

/**
 * Derive the module key from any single event-type string.
 * Handles both the enum values from the detail endpoint and the tag strings
 * from the list endpoint (e.g. "AGM_EGM", "PRODUCT_LAUNCH", "INNOVATION_CHALLENGE",
 * "GENERAL_EVENT", "HACKATHON").
 */
export function toEventModule(eventType?: string | null): EventModule {
  if (!eventType) return "GENERAL";
  const t = eventType.toUpperCase().replace(/\s+/g, "_");

  // Exact-match priority (covers all known API enum values)
  if (t === "AGM_EGM"              || t === "AGM")              return "AGM";
  if (t === "PRODUCT_LAUNCH")                                    return "LAUNCH";
  if (t === "INNOVATION_CHALLENGE" || t === "HACKATHON")         return "HACKATHON";
  if (t === "GENERAL_EVENT"        || t === "GENERAL")           return "GENERAL";

  // Substring fallback for any future variants
  if (t.includes("AGM") || t.includes("EGM"))                   return "AGM";
  if (t.includes("LAUNCH") || t.includes("PRODUCT"))            return "LAUNCH";
  if (t.includes("HACKATHON") || t.includes("CHALLENGE") || t.includes("INNOVATION")) return "HACKATHON";

  return "GENERAL";
}

/**
 * Derive module from an event object.
 *
 * Resolution order:
 *  1. event.eventType  — explicit string from detail endpoint
 *  2. event.tags[]     — try each tag as its own type string (list endpoint returns tags, not eventType)
 *  3. Substring scan of joined tags — safety net for unknown future tag formats
 */
export function getEventModule(event: {
  eventType?: string | null;
  tags?: string[];
}): EventModule {
  // 1. Explicit eventType takes precedence
  if (event.eventType) return toEventModule(event.eventType);

  const tags = event.tags ?? [];

  // 2. Treat each tag entry as its own type string — exact matching via toEventModule
  //    e.g. tags: ["AGM_EGM"] → toEventModule("AGM_EGM") → "AGM"
  for (const tag of tags) {
    const mod = toEventModule(tag);
    if (mod !== "GENERAL") return mod; // non-GENERAL means a specific type was matched
    // If toEventModule returned GENERAL, it could be "GENERAL_EVENT" (correct) or
    // an unrecognised tag — check explicitly before accepting it
    const u = tag.toUpperCase();
    if (u === "GENERAL_EVENT" || u === "GENERAL") return "GENERAL";
  }

  // 3. Substring fallback across all tags joined into one string
  const joined = tags.join(" ").toUpperCase();
  if (joined.includes("AGM") || joined.includes("EGM"))         return "AGM";
  if (joined.includes("LAUNCH") || joined.includes("PRODUCT"))  return "LAUNCH";
  if (joined.includes("HACKATHON") || joined.includes("CHALLENGE") || joined.includes("INNOVATION")) return "HACKATHON";

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

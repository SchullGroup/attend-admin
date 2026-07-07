import type { EventDetailResponse } from "@/types/super-admin";

/** Editable agenda row — superset of the API shape used by the Resolutions form */
export interface LocalAgendaItem {
  id: string;
  order?: number;
  title: string;
  description?: string;
  durationMinutes?: number;
  speakerName?: string;
  isCurrent?: boolean;
  time?: string;
  speaker?: string;
}

/**
 * Compatibility shim: maps API fields to legacy UI names.
 *
 * Why Omit instead of plain intersection:
 *   EventDetailResponse.format  is  "VIRTUAL"|"IN_PERSON"|"HYBRID"
 *   EventDetailResponse.status  is  "DRAFT"|"PUBLISHED"|...
 *   EventDetailResponse.agenda  is  AgendaItemResponse[] | undefined
 *
 *   Intersecting those with the lowercase / widened shim variants would
 *   collapse the intersected fields to `never`, making the whole type `never`.
 *   Omit removes the conflicting fields before re-adding them with the correct shim types.
 */
export type EventShim = Omit<EventDetailResponse, "format" | "agenda" | "status"> & {
  /** Lowercase format used for icon lookups: "virtual" | "hybrid" | "in-person" */
  format:   "virtual" | "hybrid" | "in-person";
  /** Widened status string so localStatus overrides compile cleanly */
  status:   string;
  /** Merged agenda (API items + unsaved local rows) */
  agenda:   LocalAgendaItem[];
  /** Display name of the organising register */
  organiser: string;
  /** Physical venue or empty string */
  venue:    string;
  rsvpCount: number;
  capacity:  number | null;
  /** End time — not returned by API; kept for potential future use */
  endTime:  string;
  /** Legacy module key: "AGM" | "LAUNCH" | "HACKATHON" | "GENERAL" */
  module:   string;
  /** Fallback accent colour */
  color:    string;
};

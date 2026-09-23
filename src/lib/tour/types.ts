/**
 * Types for the guided product tour.
 *
 * A tour is a list of steps. A step either points at something on screen (by
 * `target`, matched against a `data-tour` attribute) or stands alone as a
 * centred card that introduces a section. Steps may move between pages.
 */

/** Normalised role strings, as `resolveRole` produces them. */
export type TourRole =
  | "super_admin"
  | "client_admin"
  | "admin"
  | "event_manager"
  | "kyc_officer"
  | "viewer"
  | "judge";

export type TourPlacement = "auto" | "top" | "bottom" | "left" | "right";

export interface TourStep {
  /** Stable id — used for analytics and for resuming, never shown. */
  id: string;

  title: string;

  /**
   * One or two sentences. Written for someone who has never seen the screen:
   * say what the thing is for, not what it is called — the label is already
   * on screen next to it.
   */
  body: string;

  /**
   * Value of the `data-tour` attribute to spotlight. Omit for a centred card.
   *
   * If the element is not on the page after `route` has loaded, the step falls
   * back to a centred card rather than stalling the tour — a missing anchor
   * (a role that cannot see that control, a list that is empty) must never
   * trap someone mid-tour.
   */
  target?: string;

  /** Navigate here before the step runs. Skipped if already on that path. */
  route?: string;

  /** Where the card sits relative to the target. "auto" picks the side with room. */
  placement?: TourPlacement;

  /** Extra pixels of breathing room around the spotlight. */
  padding?: number;

  /**
   * Restrict the step to these roles. Omitted means everyone on the tour sees
   * it. A step whose anchor only exists for Super Admin should say so here, so
   * a Viewer is not shown a card about a button they do not have.
   */
  roles?: TourRole[];
}

/**
 * An example record a tour needs before it is worth offering.
 *
 * Resolved once per session; a tour whose requirement comes back empty is
 * hidden rather than run, and individual steps that need a missing one are
 * dropped. See TourProvider.
 */
export type TourExampleKey = "challengeId" | "voteEventId";

export interface Tour {
  id: string;
  /** Shown in the "Take a tour" menu. */
  label: string;
  /** One line under the label in that menu. */
  description: string;
  /** Roles this tour is offered to. Omitted means everyone. */
  roles?: TourRole[];

  /**
   * Hide this tour until the account actually has one of these to stand on.
   *
   * A certificates tour on an account with no challenges would be seven cards
   * about a screen the person cannot open — worse than not offering it, since
   * they chose it from a menu and got nothing.
   */
  requires?: TourExampleKey[];
  steps: TourStep[];
}

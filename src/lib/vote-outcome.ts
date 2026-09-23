/**
 * How a resolution's outcome is worded.
 *
 * A resolution nobody has voted on yet was reading as "Failed", in red, because
 * 0 for and 0 against is arithmetically not a pass. On a live AGM that put
 * three failed resolutions on screen before the meeting had started — the kind
 * of thing that gets a registrar a phone call.
 *
 * Passed and Failed are outcomes. They only exist once a vote has actually
 * happened, so with no votes the answer is neither: it is that we do not know
 * yet. Every screen that shows an outcome goes through here, so the three
 * slightly different strings that used to exist ("No votes cast", "No votes",
 * and a red "Failed") stay one string from now on.
 */

export type VoteOutcomeTone = "passed" | "failed" | "pending";

export interface VoteOutcome {
  label: string;
  tone:  VoteOutcomeTone;
}

/**
 * @param totalVotes every vote counted for this resolution or candidate —
 *                   for, against and abstain, online and offline combined.
 * @param passed     the backend's own verdict, only consulted once votes exist.
 */
export function voteOutcome(totalVotes: number | null | undefined, passed: boolean): VoteOutcome {
  if (!totalVotes || totalVotes <= 0) return { label: "No votes yet", tone: "pending" };
  return passed
    ? { label: "Passed", tone: "passed" }
    : { label: "Failed", tone: "failed" };
}

/** Text colour per tone. Pending is deliberately muted, never red. */
export const VOTE_OUTCOME_CLASS: Record<VoteOutcomeTone, string> = {
  passed:  "text-green-600",
  failed:  "text-red-500",
  pending: "text-[hsl(var(--muted-foreground))]",
};

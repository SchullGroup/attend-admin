# Backend — reopening a closed resolution: does `/open` do it, or do we need `/reopen`? (2026-09-30)

We want a "Reopen voting" control for a resolution that was closed — most naturally in **Vote
Records**, where corrections happen after the fact, rather than the live control room. Before we
wire it we need to know whether the existing endpoint covers it, because this is a legal AGM tally.

## The core question

`POST /api/v1/client/votes/{eventId}/resolutions/{resolutionId}/open` is what we already call to
open a PENDING resolution. Called on a **CLOSED** one, does it:

1. **Reopen it** (CLOSED → OPEN), or reject it?
2. Preserve the **votes already cast**, or reset them to zero?
3. Let someone who already voted **vote again / change their vote**, or are they locked?
4. Get recorded in the **audit log** (who reopened, when)?

## So: do we need a new endpoint?

- **If `/open` already reopens a closed resolution and preserves the tally** → **no new endpoint.**
  We add a confirm-guarded "Reopen voting" button in Vote Records pointing at the mutation we
  already import there. It's a small change on our side.
- **If `/open` rejects a closed resolution or wipes the tally** → we need it to support reopen
  safely, **or** a dedicated `POST .../resolutions/{id}/reopen`.

Our preference, for what it's worth: a **distinct `/reopen`**, even if `/open` could be made to
work. Reopening a closed AGM vote is a different act from opening a fresh one — it should be its own
audit-log line, so "who reopened this resolution and when" has a clean answer. But that's your call.

## What we will not do

Point a Reopen button at `/open` on a guess. If it silently zeroes the tally or lets shareholders
double-vote, that's a corrupted result on a registrar's record, found after the fact. We need the
answer to the four questions above first.

## Unrelated, already shipped

The live control room now shows the tally the moment voting opens (from zero), keeps it visible
after close, and says "No votes were cast" on a closed resolution nobody voted on. Still no `passed`
field on the resolution, so we show no Passed/Failed verdict — send one (plus the special-resolution
threshold) if you want an official outcome displayed.

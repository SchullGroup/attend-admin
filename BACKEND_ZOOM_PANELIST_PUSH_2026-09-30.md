# Backend — panelist list: resolved, one Zoom scope to add (updated 2026-09-30)

**Status: not a bug. One Zoom Marketplace scope to add, then this is fully closed.**

This note started as "panelists added in Attend aren't reaching Zoom." That turned out to be wrong
in the alarming direction and right in a harmless one:

- **Adding a panelist to Zoom works.** The panelist genuinely lands on the webinar. Nobody joins
  view-only because of this — the earlier worry does not apply.
- **Reading Zoom's panelist list back fails**, which is the only reason every row shows the muted
  "couldn't reach Zoom to confirm this one" (`onZoom: null`).

The backend response now says exactly why:

```jsonc
{
  "message": "Panelists retrieved, but Zoom refused to show its panelist list: \"Invalid access
    token, does not contain scopes:[webinar:read:list_panelists:admin,
    webinar:read:list_panelists].\" (Zoom code 4711). Adding panelists still works; reading them
    back needs the webinar read scope (webinar:read:admin, or granular
    webinar:read:list_panelists:admin) on the Zoom app.",
  "data": [{ "email": "…", "name": "…", "source": "ATTEND", "onZoom": null }],
  "status": true
}
```

## The one action

Add **`webinar:read:admin`** (or the granular **`webinar:read:list_panelists:admin`**) to the
Server-to-Server OAuth app in the Zoom Marketplace. This is an ops/config action, no code — the same
kind of scope add as `user:read:admin` for the host check and `webinar:write:admin` for creating
webinars.

Once it's on:

- `onZoom` populates `true`/`false` correctly instead of `null`.
- The merge with Zoom's own list works, so portal-added panelists show as `source: "ZOOM"`.
- The drift warning we built (`onZoom: false` → "not on Zoom's list, would join view-only") starts
  doing its job. Until the scope is added, that safety check is blind — it can't warn about a real
  drift because it can't read Zoom's side at all.

## Frontend status

Nothing to change on our side. The card already:

- shows the merged list with `source` and `onZoom` (from Dave's merge work),
- renders the `onZoom: false` drift warning and the `source: "ZOOM"` chip,
- shows a single card-level "couldn't reach Zoom" line while `onZoom` is `null` for everyone —
  which is exactly the state the missing scope produces, and which clears itself the moment the
  scope is added. No release needed.

## What "done" looks like

Add the scope, reload the panelist card on a webinar with a panelist: the "couldn't reach Zoom" line
disappears and the panelist shows as confirmed on Zoom. Then this is closed.

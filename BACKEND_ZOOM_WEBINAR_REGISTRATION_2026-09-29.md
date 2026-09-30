# Backend — webinars are being created with registration ON (2026-09-29)

The participant web app cannot join the webinar. Zoom is showing it the
**"Copy the join link from the email… Join link or TK"** screen.

That screen only appears when a webinar has **registration turned on**. `TK` is the registration
token Zoom emails to each person after they register, and Zoom will not let anyone in without it.

**Attend has no way to supply one, by design.** We do not register anyone with Zoom — that was the
agreed decision in §7 of the webinar spec ("webinars are created with registration off"), precisely
so we would never have to mint per-attendee tokens. So while registration is on, the attendee join
is not merely broken, it is impossible: there is no value we can pass that would satisfy Zoom.

---

## The fix

Create webinars with `settings.approval_type = 2` — Zoom's value for **no registration required**.

```jsonc
POST /users/{userId}/webinars
{
  "topic": "…",
  "settings": {
    "approval_type": 2      // 0 = auto-approve registration, 1 = manual, 2 = none
  }
}
```

**Please read the webinar back after creating it and assert `approval_type` is actually 2.** There
is a long-standing, well-reported Zoom quirk where `approval_type` sent on create is ignored and
comes back as the account default instead. If Zoom silently overrides it, we would rather fail loudly
at creation than discover it when 400 shareholders cannot get in. If the read-back disagrees, a
`PATCH` to the webinar to force it is the usual workaround.

Worth checking the **account-level webinar defaults** in the Zoom portal too. If registration is on
by default there, that is the most likely reason this one has it.

## The webinar that already exists

Whatever the cause, the current webinar has registration on and needs fixing in place — either
`PATCH …/webinars/{id}` with `approval_type: 2`, or replace it. New ones will be fine once the
create call is corrected; this one will not fix itself.

## This also breaks panelists

Not just attendees. With registration on, a panelist joining through the SDK needs the `tk` as well
as their email, so the panelist work we both just finished cannot function either. Turning
registration off fixes both at once.

## The host is unaffected

The host starts with a ZAK, which registration does not gate. So the admin dashboard will look
fine while every attendee is locked out — worth knowing, because it means this will not show up in
admin testing.

---

## One small ask, so this is visible before the day

Please expose the flag on `zoomMeeting`:

```jsonc
"zoomMeeting": { "type": "WEBINAR", "registrationRequired": false, /* … */ }
```

If a webinar ever has registration on — created before this fix, made in the portal, or overridden
by an account default — we will show the organiser a warning on the event with a plain explanation,
rather than the first sign being attendees stuck on a TK prompt during an AGM. A boolean is enough;
we do not need the raw `approval_type`.

---

## Verification we would find useful

A test that creates a webinar and asserts the value Zoom actually stored — not just the value sent.
That is the failure mode here: the request looked right and the result was not.

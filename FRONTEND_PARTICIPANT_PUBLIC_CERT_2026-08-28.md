# Frontend handoff — participant & public certificate response changes (2026-08-28)

Source: backend `cert.md` §3 ("Participation certificates — the second type"), the
two items under **⚠️ Two FE-visible response changes**.

## Why this is a separate doc (not built into attend-admin)

`attend-admin` is the **admin dashboard**. Its roles are super_admin, client_admin,
event_manager, kyc_officer, judge, viewer — there is **no participant role and no
public certificate-verification screen** in this app. A grep of this repo confirms it
calls **neither** of the two endpoints below (it only uses
`GET /api/v1/public/certificates/{id}/download` to link the PDF from the Winners /
Certificates tabs — that contract is unchanged).

So these two changes are **not actionable in attend-admin**. They belong to whichever
frontend(s) render:

1. the **public certificate-verification page** (scan-the-QR / open-the-link view), and
2. the **participant portal** (the entrant's own "my certificate" view).

This doc exists so that team has the exact contract. **No code change is required in
attend-admin for these two items.** (The participation *issuance* UI and the certificate
*template editor* — the admin-side of cert.md §2 and §3 — have been built in this repo:
new "Certificates" tab on the challenge detail page.)

---

## Change 1 — public verification: `finalPosition` is now nullable + new `certificateType`

**Endpoint:** `GET /api/v1/public/certificates/{certificateId}`
(the verification/lookup response — **not** the `/download` redirect).

- `finalPosition` changed from `int` → `Integer`. It is now **null / omitted for
  participation certificates** instead of serialising as `0`. Winner certificates are
  unaffected (still a real 1-based position).
- New field **`certificateType`**: `"WINNER"` | `"PARTICIPATION"`.

**FE action (public verify page):**
- Treat `finalPosition` as optional. Do **not** render "0th place" / "Position: 0" —
  when it's null/absent, show no position (it's a participation certificate).
- Use `certificateType` to label the certificate: e.g. "Winner — 1st place" vs
  "Certificate of Participation". Don't infer type from `finalPosition` being 0 anymore.

Illustrative shape:

```json
{
  "certificateId": "…",
  "certificateNumber": "ATP-…",        // ATP- = participation, ATD- = winner
  "certificateType": "PARTICIPATION",   // NEW — WINNER | PARTICIPATION
  "finalPosition": null,                 // null/omitted for PARTICIPATION (was 0)
  "recipientName": "…",
  "eventTitle": "…"
  // …existing fields unchanged
}
```

---

## Change 2 — participant portal: `.../certificate` now returns a real certificate

**Endpoint:** `GET /api/v1/participant/challenges/{id}/certificate`

Previously this endpoint promised a participation certificate that no code path
created — it returned *"Congratulations! You are eligible…"* with no id, no PDF, no
download. It now returns the real thing once one has been issued.

`eligible` still means "would qualify". `issued` means "a certificate actually exists".
Those were previously conflated — that's the bug this fixes.

**New fields when a certificate has been issued:**

| Field               | Meaning |
|---------------------|---------|
| `issued`            | A certificate actually exists (vs merely `eligible`) |
| `certificateId`     | id for the public download/verify links |
| `certificateNumber` | `ATP-…` (participation) or `ATD-…` (winner) |
| `certificateType`   | `"WINNER"` \| `"PARTICIPATION"` |
| `downloadReady`     | `false` ⇒ row exists but the PDF is still generating — **poll again shortly** |
| `downloadPath`      | `/api/v1/public/certificates/{id}/download` |

**FE action (participant "my certificate" view):**
- Gate the download button on `issued && downloadReady`.
- When `issued` is true but `downloadReady` is false, show a "generating…" state and
  poll (a few seconds) until `downloadReady` flips true — don't hand the user a dead link.
- Build the download from `downloadPath` (or `certificateId` +
  `/api/v1/public/certificates/{id}/download`).
- Stop treating `eligible` as "you have a certificate" — use `issued`.

---

## Notes carried over from cert.md §3 (context for both teams)

- Certificate numbers: **`ATP-`** = participation, **`ATD-`** = winner.
- Nobody gets both — winners are skipped from participation (DB-enforced unique
  constraint on `(event, application, member)`).
- Eligibility for participation = members of applications in `SUBMITTED`,
  `UNDER_REVIEW`, `SHORTLISTED`, `SELECTED`, `NOT_PROGRESSED`. `WITHDRAWN` / `REJECTED`
  are excluded. `NOT_PROGRESSED` is deliberately **included**.
- The participation email is a **thank-you, not a congratulation**.
- Legacy rows with a null discriminator read as `WINNER` (so existing winner
  certificates are unaffected).

## Not deployed yet

Per cert.md, all of the above is implemented and test-verified on the backend but
**nothing has been deployed to staging**. Confirm exact field names against staging once
it's up, then wire the two frontends above.

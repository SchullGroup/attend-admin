# Backend — issuing participation certificates rejects an empty body (400 "Request body is missing or malformed")

**Reported by:** admin dashboard (attend-admin), 2026-08-29
**Severity:** high — the "Issue participation certificates" button cannot start a run at all.
**Owner:** backend (Spring / Jackson DTO deserialization on the issue endpoint). **Frontend fix already shipped — see the bottom.**

## Endpoint

```
POST /api/v1/client/events/{eventId}/challenge-participation/issue
```
(reproduced against event `1c10b468-4bad-4291-b8d5-beb01cb0e3e8`, authenticated, `Content-Type: application/json`, header `Idempotency-Key: <uuid>`)

## Symptom

Clicking **Issue** fails with a **400** and the generic envelope:

```json
{ "code": "INVALID_REQUEST", "error": "Invalid request",
  "message": "Request body is missing or malformed.",
  "referenceId": "8725bae2-fea4-4a59-9f44-cf47625d20aa",
  "requestTime": "2026-08-29 12:53:34", "requestType": "Outbound", "status": false }
```

DevTools → Network → the failing `issue` request → **Payload** shows the request body is an **empty object** (`{}`, "No properties"). This is the app's mapping of Spring's **`HttpMessageNotReadableException`** — Jackson could not bind `{}` into the request DTO, i.e. the DTO has **one or more required fields with no value** in an empty body. It is *not* an empty/zero-byte body (a real `{}` was sent) and *not* a `@Valid` field-constraint failure (that would be `MethodArgumentNotValidException` with per-field errors).

## What is proven

1. **The sibling `preview` endpoint accepts an empty body.**
   `POST .../challenge-participation/preview` is called with the exact same `{}` body and returns 200 with the eligibility counts (3 applications / 3 will receive / 0 skipped / 0 with in-app rendered fine). So `{}` is valid JSON and the auth/route/content-type are all correct — **only `issue` rejects `{}`.**
2. **`issue` is documented as mirroring `challenge-winners/announce`** (same 202 + run-job DTO, byte-for-byte). That announce endpoint's **request** DTO requires delivery intent and works in production with this body:

   ```json
   { "applicationIds": ["…"], "message": "…", "sendEmail": true, "sendInApp": true }
   ```
3. **The backend tolerates unknown properties but rejects missing required ones** — established the same day on the certificate-template save endpoint (`artworkPublicId`/`artworkResourceType` were accepted as extras; a missing/'unknown' required enum aborted the whole parse). So the failure here is **missing required field(s)**, not an offending extra one.

**Conclusion:** the `challenge-participation/issue` request DTO requires the delivery flags (at minimum), mirroring winners, and an empty `{}` cannot satisfy them.

## Frontend status — fix shipped 2026-08-29

The issue mutation now sends the delivery flags instead of `{}`:

```json
{ "sendEmail": true, "sendInApp": true }
```

in [src/api/client-challenges.ts](src/api/client-challenges.ts) (`useIssueChallengeParticipation`). Unlike winners we deliberately send **no `message`** (the participation email is a fixed server-side thank-you) and **no `applicationIds`** (recipients are recomputed server-side, per the endpoint's own contract). This is the minimal faithful body.

## Asks (backend)

1. **Publish the authoritative `ParticipationIssueRequest` DTO** (field names + which are required + types) — a `field-keys`-style reference or a note in cert.md. The FE is currently mirroring the winners DTO's field *names* (`sendEmail`/`sendInApp`) by inference; please confirm they match. If the real names differ (e.g. `email`/`inApp`, `notify*`, or a `channels: []` list), the FE will keep 400ing until corrected.
2. **Decide the intended contract and make it consistent.** Either:
   - the endpoint genuinely needs delivery flags → document them (ask #1), **or**
   - issuance is fully server-computed and should take **no body** → make the DTO optional (`@RequestBody(required = false)` / all-nullable with defaults) so an empty `{}` (or no body) is accepted, matching `preview`.
3. **Return a field-specific parse error.** As with the template-save 400, `HttpMessageNotReadableException` should name *which* property/field failed to bind (Jackson's `MismatchedInputException`/`MissingKotlinParameterException` already carries it) instead of the blanket "Request body is missing or malformed." The generic message is why this needed a cross-endpoint comparison to pin.

## Related

- `BACKEND_CERT_TEMPLATE_SAVE_400_2026-08-29.md` — same generic "malformed" message, same subsystem, different root cause (fontStyle enum). Same ask #3 (specific parse errors) applies.

## Update 2026-08-30 — backend handoff `certificate.md` (2026-08-28) received

The backend's `certificate.md` status doc was shared. It **corroborates the shipped body shape** but still **does not spell out the issue request DTO**:

- §3: "`issue` recomputes the recipient list server-side from current application status, exactly like the winner flow" and "**The preview is never submitted back**." → confirms we correctly send **no `applicationIds`**.
- §3: the participation email is "a **thank-you, not a congratulation**" with no organiser message. → confirms we correctly send **no `message`**.
- "exactly like the winner flow" — and the winner `announce` DTO carries `sendEmail`/`sendInApp` — is the basis for the two flags we do send. **The doc never lists the issue body's fields explicitly**, so ask #1 (publish the exact `ParticipationIssueRequest`) still stands.
- Headline caveat: "**Nothing has been deployed to staging.**" The 400 observed on 2026-08-29 against the live API may therefore have been a pre-deploy/older endpoint rather than the DTO described here. Re-test once this pass is deployed.


# Backend — saving a certificate template rejects its own model shape (400 "Request body is missing or malformed")

**Reported by:** admin dashboard (attend-admin), 2026-08-29
**Severity:** high — the certificate template editor cannot save any styled layout; only a bare, unstyled template saves.
**Owner:** backend (Spring / Jackson DTO deserialization on the save endpoint). **Frontend sends the shape documented in cert.md §2.**

## Endpoint

```
POST /api/v1/client/events/{eventId}/certificate-template
```
(reproduced against event `1c10b468-4bad-4291-b8d5-beb01cb0e3e8`, authenticated, `Content-Type: application/json`)

## Symptom

Saving from the editor fails with a **400** and the generic envelope:

```json
{ "code": "INVALID_REQUEST", "error": "Invalid request",
  "message": "Request body is missing or malformed.", "status": false }
```

This is the app's mapping of Spring's **`HttpMessageNotReadableException`** — i.e. **Jackson could not deserialize the JSON into the request DTO**. It is *not* an empty body and *not* a `@Valid` field-constraint failure (that would be `MethodArgumentNotValidException` with per-field errors). The body is well-formed JSON; one or more **values cannot be bound to their target types**.

## Reproduction (Postman, direct to the API — bypasses browser/CORS)

### ✅ Payload A — saves successfully (`status: true`)

```json
{
  "name": "certificate_1x",
  "artworkUrl": "https://attend-assets-prod.obs.af-south-1.myhuaweicloud.com:443/attend%2Fcertificate-templates%2Fd9a814c4-e1de-4223-86e0-c80f9d974b3a.webp",
  "active": true,
  "fields": [ { "key": "RECIPIENT_NAME", "xPercent": 50, "yPercent": 45 } ]
}
```

### ❌ Payload Z — the shape the app actually sends → 400 "malformed"

```json
{
  "name": "certificate_1x",
  "artworkUrl": "https://attend-assets-prod.obs.af-south-1.myhuaweicloud.com:443/attend%2Fcertificate-templates%2Fd9a814c4-e1de-4223-86e0-c80f9d974b3a.webp",
  "artworkPublicId": "attend/certificate-templates/d9a814c4-e1de-4223-86e0-c80f9d974b3a.webp",
  "artworkResourceType": "image",
  "active": true,
  "fields": [
    { "key": "RECIPIENT_NAME", "xPercent": 37.4, "yPercent": 54.5, "widthPercent": 60, "fontSizePt": 34, "fontStyle": "BODY_BOLD", "align": "CENTER", "colorHex": "#1A1A1A", "uppercase": true, "maxLines": 1 },
    { "key": "EVENT_TITLE", "xPercent": 38.1, "yPercent": 72.5, "widthPercent": 70, "fontSizePt": 20, "align": "CENTER", "colorHex": "#333333", "maxLines": 2, "fontStyle": "HEADING_BOLD" }
  ]
}
```

## What is proven

1. **The core contract works** — `name` + `artworkUrl` + `active` + `fields[{key,xPercent,yPercent}]` saves.
2. **Decimal coordinates are fine.** A's success response returns `"xPercent": 50.0` — coords are stored as **doubles**, so `37.4` / `54.5` are not the cause.
3. **The failure is a *parse/bind* failure, not validation.** (Generic "malformed" message = `HttpMessageNotReadableException`.)
4. **Contract divergence — the crux:** Payload A's **success** response body contains every field that Payload Z adds, all as `null`:

   ```jsonc
   // from A's SUCCESS response:
   "artworkPublicId": null, "artworkResourceType": null, "artworkFormat": null,
   "fields": [ { "key": "RECIPIENT_NAME", "xPercent": 50.0, "yPercent": 45.0,
                 "widthPercent": null, "fontSizePt": null, "fontStyle": null,
                 "align": null, "colorHex": null, "uppercase": null, "maxLines": null } ]
   ```

   So the **response model exposes `fontStyle`, `align`, `colorHex`, `uppercase`, `maxLines`, `artworkPublicId`, `artworkResourceType`** — but sending those same properties back on the request makes the body fail to deserialize. **The request DTO and response DTO have diverged.**

## Confirmed root cause

**The backend's `fontStyle` enum only defines the `BODY` family. `HEADING` and `HEADING_BOLD` are not defined server-side, and sending either 400s the entire save** — one unrecognized enum token aborts Jackson's parse of the whole body, which surfaces as the generic "Request body is missing or malformed."

Pinned by isolation testing (each row is Payload A plus exactly one change, same endpoint):

| Test | Change vs A | Result |
|------|-------------|--------|
| **F** | field: `fontStyle: "BODY_BOLD"`, `align: "CENTER"` | ✅ saved |
| **G** | top-level `artworkPublicId` + `artworkResourceType` | ✅ saved (echoed back; also produced a signed `artworkPreviewUrl`) |
| **H** | field: `widthPercent`,`fontSizePt`,`colorHex`,`uppercase`,`maxLines` | ✅ saved |
| **K** | **two** fields, keys `RECIPIENT_NAME` + `EVENT_TITLE`, both `BODY_BOLD` | ✅ saved |
| **I1** | field: `fontStyle: "HEADING_BOLD"` | ❌ **400 malformed** |
| **I2** | field: `fontStyle: "HEADING"` | ❌ **400 malformed** |

So: `align` enum ✅, unknown-property tolerance ✅ (`artworkPublicId`/`artworkResourceType` accepted), all plain field props ✅, multi-field + `EVENT_TITLE` key ✅. The **only** failing variable is `fontStyle ∈ {HEADING, HEADING_BOLD}`. Payload Z failed solely because its `EVENT_TITLE` field used `HEADING_BOLD`.

**Accepted `fontStyle` values (observed):** `BODY_BOLD` (proven), and omitting `fontStyle` (proven). Plain `BODY` was not directly exercised but is assumed valid as the base of the same family — **please confirm the full enum constant list.**

## Asks (backend)

1. **Add `HEADING` and `HEADING_BOLD` to the `fontStyle` enum** — cert.md §2 names/implies a heading face, and without it certificates can't have a distinct serif/heading treatment. Please also **publish the authoritative `fontStyle` constant list** (a `field-keys`-style endpoint, or pin it in cert.md) so the FE picker mirrors the backend exactly instead of guessing.
2. **Deserialize enums defensively.** An unknown `fontStyle` token currently aborts the parse of the *entire* body and takes every other field down with it. Prefer tolerating unknown → null (`@JsonCreator`, or `READ_UNKNOWN_ENUM_VALUES_AS_NULL`) so one stale value can't block a whole template save.
3. **Return a specific parse error.** `HttpMessageNotReadableException` should name *which* property/enum failed (Jackson's `InvalidFormatException` already carries `Cannot deserialize value of type … from String "HEADING_BOLD"`) instead of the blanket "Request body is missing or malformed." The generic message is exactly why pinning this needed a full isolation sweep.

## Frontend status — fix shipped 2026-08-29

The editor's font-style picker no longer offers the unsupported values. `TEMPLATE_FONT_STYLES` in
[src/api/certificate-templates.ts](src/api/certificate-templates.ts) was trimmed from
`[BODY, BODY_BOLD, HEADING, HEADING_BOLD]` to **`[BODY, BODY_BOLD]`**, so a user can no longer
select a value the backend rejects and saving works again. (`align`, the artwork props, and every
other field prop were confirmed fine and are unchanged.)

This is a stopgap that **removes the heading/serif option** from certificate text. Re-add
`HEADING` / `HEADING_BOLD` to that constant the moment the backend enum gains them= (ask #1) — the
editor's preview renderer already knows how to draw them.

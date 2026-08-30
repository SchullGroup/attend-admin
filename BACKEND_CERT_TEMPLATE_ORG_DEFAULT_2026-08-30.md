# Backend — confirm the organisation-default (Register-scope) certificate-template contract

**Raised by:** admin dashboard (attend-admin), 2026-08-30
**Severity:** medium — the admin now exposes the org-wide default template editor (cert.md §2 cascade). It works against the endpoints as documented, but three parts of the contract are **inferred, not yet verified against staging** (backend cert.md is test-passed but not deployed). Please confirm each before we call this done.
**Owner:** backend. **Frontend ships the shape documented in cert.md §2.**

## Context

cert.md §2 defines a three-tier cascade for which artwork a certificate uses:

```
event override  →  Register (org) default  →  built-in generated design
```

Until now the admin only wired the **event override**. The **Register default** tier is now wired too: the Certificates tab shows a "This event | Organisation default" scope toggle, and saving on the "Organisation default" side POSTs to the register endpoint. The toggle only appears once a `registerId` resolves for the event — if it doesn't, the editor silently stays event-only (no regression).

## What the frontend now does

1. Resolves the org from the event: `GET /api/v1/client/events/{eventId}` → reads `registerId` (falls back to `register.id`, then `register_id`).
2. Seeds the org-default editor from the **existing** resolution response `GET /api/v1/client/events/{eventId}/certificate-template` → its `register` template (no second request).
3. Saves the org default: `POST /api/v1/client/registers/{registerId}/certificate-template` with the **same body** as the event save.
4. After a successful save, invalidates every event's cached template resolution so events without their own template pick up the new default.

## Assumptions to confirm (each is a required part of the contract)

### 1. The register save accepts the identical `SaveCertificateTemplateBody`

```
POST /api/v1/client/registers/{registerId}/certificate-template
```
Body — byte-for-byte the same shape the event endpoint accepts:
```jsonc
{
  "name": "Meristem org default",
  "artworkUrl": "https://…obs…/attend%2Fcertificate-templates%2F….webp",
  "artworkPublicId": "attend/certificate-templates/….webp",   // optional
  "artworkResourceType": "image",                              // optional
  "active": true,
  "fields": [ { "key": "RECIPIENT_NAME", "xPercent": 50, "yPercent": 45, /* …styling… */ } ]
  // "certificateType" is intentionally NOT sent yet — see §9 note below
}
```
- **Confirm** it accepts this exactly, and **returns the saved template** in the same envelope the event save returns (`{ status, data: { id, artworkUrl, artworkPreviewUrl, fields, … } }`), so the editor can re-seed with the persisted id + signed preview URL.
- ⚠️ **The `fontStyle` enum gap applies here too.** The event save currently 400s on `fontStyle ∈ {HEADING, HEADING_BOLD}` (whole-body parse abort) — see [BACKEND_CERT_TEMPLATE_SAVE_400_2026-08-29.md](BACKEND_CERT_TEMPLATE_SAVE_400_2026-08-29.md). The FE picker is trimmed to the `BODY` family for both scopes, so this won't bite today, but the register endpoint must share the **same** (eventually widened) enum — don't let the two scopes diverge.

### 2. `GET /api/v1/client/events/{eventId}` returns `registerId`

The admin has no other id for the org in this screen (a challenge/hackathon IS an event; the challenge detail payload does **not** carry a registerId). We read `registerId` ‖ `register.id` ‖ `register_id`.
- **Confirm** at least one of those is present on the client event detail. If none is, the org-default editor can never appear for challenges — please add `registerId` to that payload.

### 3. `GET /api/v1/client/events/{eventId}/certificate-template` returns the `register` template

cert.md §2 says this endpoint returns **both** scopes with `effective:true` on the one in use. The editor relies on the `register` object being present (and carrying the same fields as `event`, incl. a signed `artworkPreviewUrl` since the OBS bucket is private) so it can seed the org-default tier **without a second fetch**.
- **Confirm** the `register` key is populated when an org default exists, with the full template body (not just an id), and a signed `artworkPreviewUrl` like the event template gets.

### 4. Delete is scope-agnostic by templateId

The editor deletes the org default via the same `DELETE /api/v1/client/certificate-templates/{templateId}` used for event templates (the id comes from the seeded `register` template).
- **Confirm** deleting a Register-scoped template by its id is allowed for a client admin, and that events relying on it correctly fall back to the built-in design afterward.

## §9 (certificate types) — still gated OFF, both scopes

`certificateType` is **not** sent on either the event or the register save until the backend advertises support (any `field-keys` entry flagged `winnerOnly`, or any returned template carrying a `certificateType`). Until then both scopes save untyped legacy WINNER templates, exactly as today. When §9 ships, the same `certificateType` field will ride on the register save too — no separate contract.

## Frontend status — shipped 2026-08-30

Wired in [src/app/(dashboard)/hackathons/components/CertificateTemplateEditor.tsx](src/app/(dashboard)/hackathons/components/CertificateTemplateEditor.tsx) via the previously-dead `useSaveRegisterCertificateTemplate` hook in [src/api/certificate-templates.ts](src/api/certificate-templates.ts). Graceful degradation throughout: no `registerId` ⇒ no toggle ⇒ event-only behaviour identical to before. No code change is needed on our side to confirm these assumptions — just verify against staging and flag any mismatch.

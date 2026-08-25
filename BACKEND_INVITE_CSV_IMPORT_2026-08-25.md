# Backend — invite-only CSV import failing on both paths — 2026-08-25

Reproduced from the admin app on **2026-08-25** against production
(`attend-api.schulltech.com`, OBS bucket `attend-assets-prod`, region `af-south-1`).
Two separate import paths, two separate failures. Reference IDs for log correlation are
tabulated at the bottom.

The frontend for both paths has been re-verified and is behaving to contract (details under
each section). Neither failure is fixable from the frontend.

Event under test: `6ff1848f-074a-45e9-b4f6-971a50df9103`.

---

## Path A — large CSV (> 100 rows): direct-to-OBS presigned PUT fails

### What the frontend does (confirmed correct — [client-events.ts:1531-1577](src/api/client-events.ts#L1531-L1577))

1. `POST /api/v1/client/events/{eventId}/invite-imports/upload-session` with an
   `Idempotency-Key` and body `{ filename, contentType: "text/csv", sizeBytes }`.
2. **`PUT` the raw file directly to the returned `uploadUrl`**, using a bare `axios` call
   (not our `apiClient`) so **no Attend bearer token and no JSON default are attached**, and
   sending exactly the `requiredHeaders` the backend returned (`Content-Type: text/csv`).
3. On success, `POST /api/v1/client/events/{eventId}/invite-imports` with `{ uploadId }` to
   finalize the durable import job.

Step 1 **succeeds**. `"Upload session created."`, `status: true`:

```json
{
  "data": {
    "uploadId": "5dc5a3ab-1124-499c-a4de-1a05a52cd325",
    "storageKey": "invite-imports/54be0f16-f79a-4863-ab63-9ac93ac6e78c/6ff1848f-074a-45e9-b4f6-971a50df9103/5dc5a3ab-1124-499c-a4de-1a05a52cd325.csv",
    "uploadUrl": "https://attend-assets-prod.obs.af-south-1.myhuaweicloud.com:443/invite-imports/.../5dc5a3ab-...csv?AccessKeyId=HPUAPRTSEUAPIUYLG8TM&Expires=1787690708&Signature=5ylb…Tsw%3D",
    "expiresAt": "2026-08-25T21:45:08.436110805",
    "requiredHeaders": { "Content-Type": "text/csv" }
  },
  "message": "Upload session created.",
  "referenceId": "93ca93f9-e060-4842-93b7-c2eb0e2047ba",
  "status": true
}
```

Step 2 — the browser's cross-origin `PUT` to the OBS `uploadUrl` — is what fails. DevTools
shows only the General block for that request (Request URL + `Referrer Policy:
strict-origin-when-cross-origin`) with **no status code**, i.e. no HTTP response reached the
page. That signature is the classic **CORS preflight block**, not an OBS error body.

### Most likely cause — bucket CORS not configured for cross-origin PUT

The upload is `admin-app-origin → attend-assets-prod.obs.af-south-1.myhuaweicloud.com`, a
**cross-origin** request. Because `Content-Type: text/csv` is **not** a CORS-safelisted value,
the browser first sends a **preflight `OPTIONS`**. If the bucket has no CORS rule permitting
that origin + method + header, the preflight fails and the browser blocks the `PUT` before any
response — exactly the "Request URL + Referrer Policy, no status code" symptom above.

**Ask:** add a CORS rule to the `attend-assets-prod` bucket permitting the admin dashboard
web origin(s) to `PUT`. Minimum shape:

- **AllowedOrigin:** the admin app's web origin (the dashboard host — please set the real one; it is *not* `attend-api.schulltech.com`, which is the API)
- **AllowedMethod:** `PUT`, `OPTIONS` (and `GET`/`HEAD` for the read/view path)
- **AllowedHeader:** `Content-Type` (and `*` if the SDK adds others)
- **ExposeHeader:** `ETag`
- **MaxAgeSeconds:** e.g. `3600`

### Secondary cause to rule out — `SignatureDoesNotMatch` (note the `:443` in `uploadUrl`)

If, after CORS is fixed, the `PUT` reaches OBS and returns **403 SignatureDoesNotMatch**,
check the presigned-URL signing:

- The returned `uploadUrl` host is `…myhuaweicloud.com**:443**/…`. Browsers omit `:443` from the
  `Host` header on HTTPS, so if the V2 signature was computed over a canonical host that
  **included** `:443`, OBS will recompute a different signature and reject. Sign against the
  bare host (no explicit `:443`).
- The signature must be computed over the **same `Content-Type` (`text/csv`)** that is returned
  in `requiredHeaders` and that the browser sends. Keep them identical.

The frontend already sends only `requiredHeaders` and no extra auth, so if a signature
mismatch occurs it is on the signing side.

---

## Path B — small CSV (≤ 100 rows): import job created but stuck at `PENDING`

### What the frontend does (confirmed correct — [client-events.ts:1508-1525](src/api/client-events.ts#L1508-L1525))

Parses the CSV in-browser and `POST`s the rows as JSON to
`/api/v1/client/events/{eventId}/invites/import`. The backend accepts it and returns an import
job — but the job **never processes**. Polled status (`GET
/api/v1/client/events/{eventId}/invite-imports/{jobId}`, `200 OK`):

```json
{
  "id": "32bb57dd-26b3-466a-9eb6-d51e62e64c3d",
  "eventId": "6ff1848f-074a-45e9-b4f6-971a50df9103",
  "originalFilename": "JSON Import",
  "status": "PENDING",
  "totalRows": 0, "processedRows": 0, "acceptedRows": 0,
  "createdRows": 0, "updatedRows": 0, "duplicateRows": 0, "rejectedRows": 0,
  "errorReportUrl": null,
  "startedAt": "2026-08-25T21:29:21.538068",
  "completedAt": null,
  "lastHeartbeatAt": null,
  "errorCode": null, "errorMessage": null
}
```

`status: PENDING`, `totalRows: 0`, `lastHeartbeatAt: null`, `errorCode: null` — the job row is
persisted but **no worker ever picks it up**. This is the same stalled-worker symptom recorded
in [BACKEND_INCIDENTS_AND_FEATURE_REQUESTS_2026-08-23.md](BACKEND_INCIDENTS_AND_FEATURE_REQUESTS_2026-08-23.md) §1,
still occurring on 2026-08-25 with the reference IDs below.

**Asks:**

- Confirm the invite-import worker is running and consuming jobs on production; trace why
  `32bb57dd-…` was never started (`totalRows` never populated, no heartbeat).
- The 90-second client-side stall detector in
  [EventLaunchInvitesTab.tsx:219-225](src/app/(dashboard)/events/[id]/components/EventLaunchInvitesTab.tsx#L219-L225)
  is the only thing surfacing this to users right now. Please deploy the server-side watchdog
  that transitions a long-`PENDING` job to `FAILED` with an `errorCode` so the UI shows a real
  error instead of an open-ended spinner.
- Note both import paths converge on this same worker: fixing Path A's upload only moves a
  large CSV into the **same** job pipeline that is currently stalling in Path B. The worker fix
  is required for either path to actually import.

---

## Reference IDs for log correlation

| Path | Call | ID |
|------|------|----|
| A | Upload session (`referenceId`) | `93ca93f9-e060-4842-93b7-c2eb0e2047ba` |
| A | `uploadId` | `5dc5a3ab-1124-499c-a4de-1a05a52cd325` |
| A | storageKey | `invite-imports/54be0f16-…/6ff1848f-…/5dc5a3ab-….csv` |
| B | Import job id | `32bb57dd-26b3-466a-9eb6-d51e62e64c3d` |
| B | Status poll (`referenceId`) | `214d0e2c-96e4-4172-90e4-14dacb0ee37d` |
| — | Event id | `6ff1848f-074a-45e9-b4f6-971a50df9103` |

## Security note

The presigned `uploadUrl` legitimately carries `AccessKeyId=HPUAPRTSEUAPIUYLG8TM` in its query
string (that is by design — it is an identifier, not the secret, and the `Signature`/`Expires`
scope it to one object for ~15 min). But this is the **same access key whose secret was exposed
and is pending rotation** — see [BACKEND_MEDIA_VIEWING_OBS_2026-08-25.md](BACKEND_MEDIA_VIEWING_OBS_2026-08-25.md).
After rotation, the upload-session signer will use the new key automatically; no frontend change.

---

## Frontend aligned — 2026-08-26 ✅

Backend replied (mvp.md item 77) and confirmed both paths are **not frontend-fixable** — matching
the analysis above. **No frontend code changed** for this item; the FE was re-verified against
contract:

- **Path A** (large CSV → presigned OBS `PUT`): the FE flow is correct — bare `axios` `PUT`, no
  bearer, only `requiredHeaders`. It is blocked by the **bucket CORS preflight**, an ops /
  Huawei-console change. **Blocker for ops:** the CORS rule needs the **admin dashboard web
  origin** as `AllowedOrigin`, and that value cannot come from FE code — it is the deployed
  dashboard domain (the browser origin, e.g. `https://<dashboard-host>`), **not**
  `attend-api.schulltech.com` (the API). Whoever owns the deploy must supply the exact origin(s)
  for the rule in §Path A. This is the **same** bucket CORS rule the OBS media-viewing blob paths
  need ([BACKEND_MEDIA_VIEWING_OBS_2026-08-25.md](BACKEND_MEDIA_VIEWING_OBS_2026-08-25.md)) — one
  rule (`GET`/`HEAD`/`PUT`/`OPTIONS`) covers both.
- **Path B** (small CSV → JSON import) and, ultimately, Path A both converge on the invite-import
  **worker**. The fix (worker consuming jobs + a server-side watchdog that fails a long-`PENDING`
  job with an `errorCode`) is a **backend deploy-verification** item. The FE's 90-second
  stall detector ([EventLaunchInvitesTab.tsx:219-225](src/app/(dashboard)/events/[id]/components/EventLaunchInvitesTab.tsx#L219-L225))
  already surfaces the stall to users and stays as-is; once the backend emits `FAILED` + `errorCode`,
  the existing error UI renders it with no further FE change.

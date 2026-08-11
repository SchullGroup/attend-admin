# Backend follow-up — 2026-08-11

Thank you for the implementation status in `backend done.md`. The frontend review confirms that the existing API clients already consume the delivered contracts for OTP reset, session revocation, audit filtering/export, uploads, register PATCH, weighted voting, and shareholder search. No frontend changes are required for those response shapes.

## Frontend change made

- Register metadata editing is intentionally **CLIENT_ADMIN-only** in the frontend. `ADMIN` may still edit branding, but does not see the register metadata editor. Please keep the PATCH authorization aligned with this product decision, even though the register controller's approval/activation endpoints now accept both `CLIENT_ADMIN` and `ADMIN`.

## Required backend follow-up

### 1. Deploy and test in staging

Nothing in the handoff has been deployed to staging. Please provide:

- the staging deployment/commit;
- smoke-test results for each changed endpoint;
- the stable error payloads observed in staging; and
- confirmation that the changed code was tested against the frontend environment.

The absence of automated coverage is also still open. At minimum, please add regression tests for session concurrency/revocation, OTP attempt/expiry codes, filtered and selected audit exports, register PATCH/approval, shareholder search, upload failures, weighted voting/amendments, and Post-AGM attendance/certificate flows.

### 2. Production Huawei OBS configuration

Please confirm that these environment variables are set to non-empty values on the production host and that a real upload succeeds:

- `HUAWEI_OBS_ACCESS_KEY`
- `HUAWEI_OBS_SECRET_KEY`

Please also confirm the configured bucket/endpoint/region and whether any existing Cloudinary-backed files remain readable after the provider-default change.

### 3. Shareholder name-search index

Please run and verify the following against the target PostgreSQL database. `CREATE INDEX CONCURRENTLY` must be run outside a transaction:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shareholder_fullname_trgm
    ON register_shareholders USING GIN (full_name gin_trgm_ops);
```

Please provide the resulting query plan or p95 timing for a representative `search` request at the expected scale.

### 4. Super-admin audit-log parity

The platform-wide endpoint is required and was not implemented in this pass. Please add a separate super-admin route (for example `GET /api/v1/admin/audit-logs` plus its export route) with:

- an organisation filter;
- the same date/email/action/category/entity/search/pagination semantics as the client route;
- authorization restricted to super-admin roles; and
- export authorization and CSV columns matching the filtered list.

The current client route must remain organisation-scoped; it must not be broadened as a substitute.

### 5. OTP error-code distinction

The delivered behavior maps a consumed OTP to `OTP_NOT_FOUND`, but the product requires “not requested” and “already used” to be distinct. Please expose a stable consumed/replayed code such as `OTP_ALREADY_USED`, while preserving `OTP_NOT_FOUND` for an address with no reset request. This may require retaining a short-lived consumed marker/tombstone instead of immediately making the state indistinguishable from a missing request; do not retain the plaintext OTP.

### 6. Post-AGM item 9 remains open

The frontend is already wired to:

- `GET /api/v1/client/events/{eventId}/post-agm/summary`;
- `GET /api/v1/client/events/{eventId}/post-agm/certificates/eligibility`; and
- `POST /api/v1/client/events/{eventId}/post-agm/certificates/send`.

Please implement and stage-test the contract in `BACKEND_FIXES_2026-08-10.md`, especially authoritative distinct check-in counts, full-set eligibility totals, idempotent certificate queueing, per-recipient failure/retry state, cross-tenant protection, and stable `409` responses when attendance is not finalised. Please include the deduplication rules for duplicate scans, manual/online attendance, proxy attendance, and revoked check-ins.

### 7. Existing PENDING registers

Please provide a report of currently `PENDING` registers (register ID, organisation, status, created date, and any approval-blocking reason). Do not bulk-activate them. The product team will review the list case by case after the corrected approval permissions are deployed.

## Confirmed as complete from the handoff

- OTP expiry, five-attempt cap, resend cadence, and stable failure codes (subject to the distinction question above).
- Device-aware concurrent-login invalidation and invalidation on password/security access changes.
- Organisation-scoped audit filters, selected-row POST CSV export, CSV injection protection, and relevant indexes.
- Upload response aliases, request-ID correlation, multipart limits, and configuration-vs-unexpected error handling.
- Register PATCH semantics, conflict handling, shared detail response, and changed-field audit logging.
- Server-side weighted-vote capture using email/phone/verified BVN matching and ACTIVE shareholder rows.
- Register approval role correction (`CLIENT_ADMIN` or `ADMIN`) and `409` invalid-status responses.
- Organisation-scoped, paginated shareholder search with a size cap and authoritative page metadata.

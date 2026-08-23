# Backend Incidents and Feature Requests - 2026-08-22

These are the latest production/staging findings from the invite directory and broadcast testing. Nothing below should be treated as fixed until the backend is deployed and the supplied request IDs have been checked in server logs.

## 1. Large invite upload session returns `409 CONFLICT`

**Request**

```text
POST /api/v1/client/events/a7a68420-8946-4053-91b9-560948f08320/invite-imports/upload-session
```

**Observed response**

```json
{
  "code": "CONFLICT",
  "error": "Conflict",
  "message": "This operation conflicts with existing data.",
  "referenceId": "46c6924b-3878-4876-a022-bf1196ed5e40",
  "requestTime": "2026-08-22 23:32:00",
  "requestType": "Outbound",
  "status": false
}
```

Please trace the reference ID and identify the exact unique constraint/entity field that failed. The frontend sends a fresh `Idempotency-Key` and the payload contains `filename`, `contentType`, and `sizeBytes`, so this is not an intentional idempotent replay from the current UI. The endpoint should return a stable, actionable conflict code if the file name/session is already in use, or create the session successfully if the prior session belongs to a different upload attempt.

Also confirm whether an abandoned upload session can be retried or expired, and whether the client should reuse an existing session after a 409. Do not make the frontend blindly retry this request because creating multiple storage sessions can create orphaned objects or duplicate jobs.

## 2. Invite resend and campaign fail on `PROCESSING`

**Resend request**

```text
POST /api/v1/client/events/a7a68420-8946-4053-91b9-560948f08320/invites/f6369b50-e316-473c-8a69-d6b5d5bcf9df/resend
```

**Observed generic response**

```json
{
  "code": "UNEXPECTED_ERROR",
  "error": "Unexpected error",
  "message": "Something went wrong. Please try again later.",
  "referenceId": "a7877a6f-80db-424d-9c84-fe90c3b34c95",
  "requestTime": "2026-08-22 23:33:15",
  "requestType": "Outbound",
  "status": false
}
```

Campaign processing then fails because the application claims an invite using:

```sql
UPDATE event_invite
SET delivery_status = 'PROCESSING'
WHERE id = ?
  AND delivery_status IN ('NOT_SENT', 'FAILED')
  AND registration_status = 'INVITED';
```

but PostgreSQL rejects `PROCESSING` under `event_invite_delivery_status_check`.

**Required backend fix**

1. Add `PROCESSING` to the database check constraint in every environment, or provide a real migration that recreates the constraint with every supported value:
   `NOT_SENT`, `QUEUED`, `PROCESSING`, `SENT`, `DELIVERED`, `BOUNCED`, `FAILED`.
2. Ensure the entity enum, migration/schema constraint, response DTO, list filters, resend flow, and campaign worker use the same vocabulary. The current frontend now uses `NOT_SENT`, not the legacy display label `UNSENT`.
3. Resend must return a domain error rather than `UNEXPECTED_ERROR` for invalid states, for example:
   - `INVITE_REVOKED`
   - `INVITE_ALREADY_REGISTERED`
   - `INVITE_PROCESSING`
   - `INVITE_NOT_FOUND`
4. Resend must atomically claim/reset the invite and send it without allowing a concurrent campaign to send the same invite twice. Please define whether resend is allowed for `FAILED` and `BOUNCED`, and whether it resets `providerMessageId`.

## 3. Revoke and unrevoke invite API

The current frontend has `DELETE /invites/{inviteId}` for revoke. We also need a patch endpoint to reverse or apply the state explicitly:

```http
PATCH /api/v1/client/events/{eventId}/invites/{inviteId}
Content-Type: application/json

{ "registrationStatus": "REVOKED" }
```

and:

```json
{ "registrationStatus": "INVITED" }
```

Please confirm the final route/body contract, or expose separate explicit actions such as `POST .../{inviteId}/revoke` and `POST .../{inviteId}/unrevoke`. Required rules:

- `REGISTERED` must never be reverted to `INVITED`.
- Unrevoking should make the invite eligible for registration and, if appropriate, eligible for sending again.
- A revoked invite must not be claimed by a campaign.
- The operation must be organisation/event scoped and idempotent.
- Return the updated invite row so the directory can update without guessing.

## 4. Broadcast length

The client broadcast composer now permits and submits messages up to **1,000 characters**. Please raise the backend validation/database/API limit to at least 1,000 for `message` on client event broadcasts. Subject remains 255 characters unless product changes that separately.

## 5. New winner announcement after innovation challenge scoring

We need a backend-supported winner announcement workflow for `INNOVATION_CHALLENGE` and `HACKATHON` applications.

### Required behavior

- Admin selects or confirms the winning application/team after judging is complete.
- Backend validates that the application belongs to the event and is eligible to be declared a winner.
- Winner announcement sends:
  - an email congratulations message to every winning team member with an email address;
  - an in-app notification to every winning team member with a matching Attend account;
  - a certificate download link/attachment in the email and a certificate link in-app.
- Sending must be idempotent. A retry after a timeout must not send duplicate winner messages or create duplicate certificates.
- Store winner announcement status, certificate identifier/URL, recipient counts, provider message IDs where available, timestamps, and any failure reason.
- Audit-log the declaration and delivery result without placing sensitive data in the log.

### Suggested API shape

```http
POST /api/v1/client/events/{eventId}/challenge-winners/announce
Content-Type: application/json
Idempotency-Key: <uuid>

{
  "applicationIds": ["<application-id>"],
  "message": "Optional organiser-approved congratulations copy",
  "sendEmail": true,
  "sendInApp": true
}
```

Suggested response: `202 Accepted` with an announcement/job ID and status. Add `GET .../challenge-winners/announcements/{announcementId}` for progress and failures. If the product requires automatic selection from final ranks instead, expose an explicit `finalize-winners` action with a clear tie-resolution rule rather than silently selecting by rank.

Please confirm before implementation:

- whether winners are selected manually or automatically from final scores/ranks;
- whether certificates are generated by the backend or an existing certificate service;
- the certificate content/branding and whether one certificate is issued per team member or per team;
- whether the announcement applies to only first place or multiple prize tiers;
- whether email and in-app copy are fixed templates or organiser-editable.

### Product decisions confirmed by FE/product discussion

- Winner computation is backend-owned and happens after judging is complete and the relevant applications have been moved to `SELECTED`.
- The backend must intersect `SELECTED` status with the final leaderboard placement. The frontend must not calculate or submit the authoritative winner set.
- Tied teams share the same leaderboard position. The backend must not let an admin override judge-derived scores or placement.
- Prize details are intentionally hidden from the winner preview, announcement copy, and certificates. The result should expose the selected team and final position only.
- Every member of every winning team receives an individual certificate. Every member with an email receives the congratulations email; members with a matching Attend account receive the in-app notification.
- Email and in-app delivery are both enabled for the winner announcement. The organiser may edit the congratulations message before sending.
- Recommended flow: provide an explicit backend preview/compute action after scoring and selection are complete, then require an organiser confirmation before the idempotent announcement send. Selecting an application alone must not send winner communications.

### Required preview/send separation

The backend should expose a read-only winner preview before delivery, for example:

```http
POST /api/v1/client/events/{eventId}/challenge-winners/preview
```

The preview should return the server-computed selected winners, final positions, team/member recipients, certificate state, and a generated editable message. It must not expose prize amounts or prize-tier reward text. The send endpoint should accept only the approved message and delivery flags, revalidate the preview/winner state server-side, and persist an idempotency key so retries cannot create duplicate certificates or notifications.

### Final certificate and recipient decisions

- Build both a downloadable PDF certificate and a hosted public verification page for each certificate.
- Issue a separate certificate to every member of every eligible team, not one shared team certificate.
- Every application explicitly changed to `SELECTED` is eligible for winner announcement and certificates, regardless of whether its judge-derived final position is first, second, third, or another position.
- The final leaderboard position is printed on the certificate and shown in the announcement. Tied teams display the same position.
- Certificate content should include at minimum the member name, team name, challenge/event name, final position, organiser branding, a unique certificate ID, and a verification URL/QR code.
- Prize amounts, prize-tier names, and reward text must not appear in the preview, PDF, verification page, email, or in-app notification.
- Public verification must expose only the minimum certificate facts needed to verify authenticity; it must not expose member email addresses or other private application data.

## Deployment and verification checklist

- Check the two request IDs above in backend logs.
- Apply and verify the `PROCESSING` constraint migration.
- Test upload-session creation, repeated idempotent request, abandoned-session retry, resend, revoke, unrevoke, and campaign processing.
- Test a failed/bounced resend and a revoked/registered invite.
- Test broadcast messages at 999, 1,000, and 1,001 characters.
- Confirm no campaign worker records a generic `PROCESSING_ERROR` for a valid invite.
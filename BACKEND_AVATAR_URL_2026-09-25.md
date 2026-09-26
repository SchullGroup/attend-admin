# Backend — `avatarUrl` is on the user, but missing from almost every list (2026-09-25)

Profile pictures exist. `GET /api/v1/admin/users/{id}` returns a real one today:

```jsonc
{
  "avatarUrl": "https://attend-assets-prod.obs.af-south-1.myhuaweicloud.com:443/…",
  "email": "jasperbusiness247@gmail.com",
  "firstName": "Ezepue",
  "lastName": "James",
  "kycStatus": "FULL_KYC"
}
```

So the column is populated and the storage works. The problem is that **almost no other endpoint
serialises it**, so the same person shows a photo on their profile page and grey initials
everywhere else — in the attendee table, in the KYC queue, in global search, in the judge lists.

We have now wired the frontend to display a photo on all of those screens, with the initials
circle kept as the fallback. **Nothing else is needed from us.** Each endpoint below lights up the
moment it starts returning the field — no frontend release required.

**Summary: 1 endpoint returns `avatarUrl` today. 12 need it added. 1 open question about uploads.**

---

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | Returns `avatarUrl` today — confirmed in the network tab |
| ❌ | Confirmed missing — we have the response body |
| ❓ | Not yet observed; listed because the screen renders a person and we have wired it |

---

## 1. Confirmed

### 1.1 ✅ Already correct

```
GET /api/v1/admin/users/{id}
```

Returns `avatarUrl` next to `email`. This is the one that proved the data exists, and it is the
shape we would like everywhere else. Also the source for the User Details profile card.

### 1.2 ❌ Event attendees — confirmed missing

```
GET /api/v1/client/events/{id}/attendees
GET /api/v1/admin/events/{id}/attendees
```

Response today, per attendee:

```jsonc
{
  "avatarColor": "#F3E5F5",
  "createdAt": "2026-09-25T12:48:17.948603",
  "email": "faith_ibitoye@outlook.com",
  "fullName": "Faith Ibitoye",
  "id": "0bcfc7df-6c95-46c0-88ee-3c95968b896c",
  "initials": "FI",
  "kycStatus": "FULL_KYC",
  "phone": "08032000900",
  "rsvpDate": "2026-09-25"
}
```

`avatarColor` and `initials` are there; `avatarUrl` is not. This is the Registered Participants
table on every event — the most visible instance of the gap. (Only the client path is confirmed
from the network tab; the admin path is assumed to share a serialiser.)

### 1.3 ❌ Global search — confirmed missing

```
GET /api/v1/admin/search?q=…
GET /api/v1/client/search?q=…
```

Response today:

```jsonc
{
  "users":        [{ "email": "…", "fullName": "Lucky James", "id": "…", "kycStatus": "FULL_KYC", "role": "ATTENDEE" }],
  "clientAdmins": [{ "email": "…", "fullName": "Ezepue James", "id": "…", "organisationName": "Meristem Registrars LTD", "status": "ACTIVE" }]
}
```

Needed on the `users`, `clientAdmins` and `teamMembers` arrays. Not on `events`, `documents` or
`stakeholders` — those are not people.

---

## 2. Needs `avatarUrl` (❓ — wired, awaiting the field)

| Endpoint | Screen |
|---|---|
| `GET /api/v1/admin/users` | People → All Users table |
| `GET /api/v1/admin/participants/{id}` | User Details profile card (the admin-user call beside it already has it) |
| `GET /api/v1/admin/participants/kyc/queue` | KYC queue rows |
| `GET /api/v1/admin/participants/{id}/kyc` | KYC review panel |
| `GET /api/v1/client/organisation/team` | Settings → Team |
| `GET /api/v1/client/judges` | Judge lists |
| `GET /api/v1/client/challenges/{challengeId}/judges` | Challenge judges |
| `GET /api/v1/admin/challenges/{challengeId}/judges` | Challenge judges (admin) |
| `GET /api/v1/client/live/{eventId}` | Live session → recent attendees |

Every one of these already returns `initials`, and most return `avatarColor`. **Please keep both.**
We still render the initials circle whenever there is no photo, and `avatarColor` is what keeps it
per-person rather than a uniform grey.

---

## 3. Shape we are expecting

Same field name and nullability as the working endpoint:

```jsonc
{ "avatarUrl": "https://…/avatars/abc123.jpg" }   // has a photo
{ "avatarUrl": null }                              // has not set one — we show initials
```

`null` and the key being absent are handled identically, so there is no need to backfill anything.
A URL that 404s or expires also falls back to initials rather than showing a broken image.

---

## 4. Open questions

**4.1 How does a user set a profile picture?** There is no avatar upload anywhere in the admin
app — we checked every API module and route. The only image upload we have is the organisation /
register **logo**. So either avatars are set in attend-mobile, or they were seeded. If there is an
upload endpoint we should be calling, point us at it and we will add the control; if there isn't
one, that is probably the next thing to build after this.

**4.2 Are these URLs presigned or permanent?** The one we can see is an OBS URL with an explicit
port. If it carries an expiry, we would rather know now — a photo that works on load and 403s an
hour later degrades to initials silently, which is survivable but confusing to debug. If they are
presigned, a note on the TTL would help us set cache times sensibly.

**4.3 `SpeakerResponse.avatarUrl`** is declared in our types and, as far as we can tell, never
populated. Is that field live, or dead weight we should delete?

---

## 5. Why it is worth doing in one pass

Individually each of these is a one-line addition to a serialiser. Collectively they are the
difference between "this platform knows who its users are" and a wall of grey circles at an AGM
where a registrar is trying to recognise a shareholder on screen. All the display work is already
merged and the fallback is safe, so this can ship endpoint by endpoint at whatever pace suits —
nothing breaks while it is half done.

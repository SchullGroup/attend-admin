# Backend request — the invitation phone number never reaches Organisation Settings (2026-09-21)

QA defect: *"Phone number used during client invitation is not showing."*

**Steps:** enrol / invite a client with a phone number → log in as that client →
Settings → Organisation Info. The Phone field is empty.

---

## It is not the frontend, on either side

**Sending.** The enrol form collects the number and sends it:

```jsonc
POST /api/v1/admin/registrars/enroll
{ "companyName": "…", "representativeName": "…", "representativeEmail": "…",
  "representativePhone": "+2348109477003", … }
```

(Same on the client-side path, `POST /api/v1/client/registers/enroll`.)

**Reading.** Settings → Organisation Info renders `organisationInfo.phone` from:

```
GET /api/v1/client/organisation/profile
```

and saves it back through the same field on update. The input is wired, the value is just never
populated.

---

## What we think is happening

`representativePhone` is being stored against the **representative user**, and
`organisationInfo.phone` is a **different field on the organisation**. Nothing copies one to the
other, so the number is captured and then invisible everywhere the client can see it.

## What we need

Either is fine — whichever matches how you model it:

1. **Populate `organisationInfo.phone` from the phone supplied at enrolment**, so the organisation
   starts with the number that was already collected; or
2. **Return the representative's phone on the profile payload** under a clearly named field, e.g.

```jsonc
{
  "id": "…",
  "organisationInfo": {
    "companyName": "…", "rcNumber": "…", "contactEmail": "…",
    "phone": "+2348109477003",          // ← currently absent or empty
    "representativePhone": "+234…",     // ← or this, and we render it
    "website": "…"
  },
  "branding": { … }
}
```

If it is already in the payload under a name we are not reading, just say which — that is a
one-line change at our end and needs nothing from you.

## Please also confirm

Whether a client editing Phone in Organisation Settings should write back to the organisation only,
or also update the representative's own contact number. Right now the two can drift apart with
nothing telling the user which one they are editing.

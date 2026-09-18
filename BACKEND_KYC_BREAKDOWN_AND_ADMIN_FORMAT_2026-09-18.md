# Backend request — KYC breakdown now that NIN exists, and Event Format Distribution on super admin (2026-09-18)

Follows `BACKEND_ANALYTICS_RANGE_AND_FORMAT_2026-09-18.md`, which covered the **client** analytics
page. Two of these are the super-admin equivalents; the third is a data-shape problem that makes the
same user look different on three screens.

---

## 1. Event Format Distribution is empty on super admin too

Same symptom as the client page, different endpoint:

```
GET /api/v1/admin/analytics/event-format     → "No format data yet."
GET /api/v1/client/analytics/event-format    → "No format data yet."
```

Both render the empty state on a platform with **45 events**, every one of which has a mandatory
`VIRTUAL | IN_PERSON | HYBRID` format. Both hooks read the response tolerantly
(`formats` / `eventFormats` / `distribution` / bare array / first array found), so this is not a field
naming mismatch on either side.

Expected:

```jsonc
{ "formats": [ { "format": "VIRTUAL", "count": 21 }, { "format": "HYBRID", "count": 15 }, { "format": "IN_PERSON", "count": 9 } ] }
```

Since the admin and client versions fail identically, they are probably the same query — so one fix
likely covers both. Please confirm whether these are implemented at all.

**Useful note for the client-side range work in the other document:** the admin analytics endpoints
*already* accept `?range=`, and our admin hooks already pass it. The client analytics endpoints do
not. Mirroring the admin behaviour on the client endpoints is the whole of that request.

---

## 2. 🔴 The KYC breakdown does not account for NIN, and does not reconcile

### What super-admin Analytics shows today

| Bucket | Count |
|---|---|
| `NO_KYC` | 31 |
| `BASIC_KYC` | 0 |
| `PENDING_REVIEW` | 0 |
| `FULL_KYC` | 10,002 |
| `REJECTED` | 0 |
| **Sum** | **10,033** |

The Users page on the same account reports **10,096 total users**. **63 users are in no bucket.**

Two things to fix, and one to tell us.

### 2.1 Tell us the denominator

`GET /api/v1/admin/analytics/kyc-breakdown` and `GET /api/v1/admin/users` clearly count different
populations. You have already flagged this shape of problem yourself — `/admin/participants` is
ATTENDEE-scoped while `/admin/users` is every user except super admins. If the KYC breakdown is
attendee-scoped, that is fine, but it has to be stated, because a page showing "10,096 users" beside a
KYC chart totalling 10,033 reads as a bug whatever the explanation.

Either return the denominator in the payload:

```jsonc
{ "totalConsidered": 10033, "scope": "ATTENDEE", "breakdown": [ … ] }
```

or make the buckets exhaustive over the same population the Users page counts. Either works; silence
does not.

### 2.2 NIN has no place in the model

NIN verification shipped, but the breakdown has no state that reflects it. Right now a user who has
completed NIN and a user who has done nothing can both land in `NO_KYC`, and nothing on the platform
distinguishes them.

We need the buckets defined against what a user has actually verified. Our reading — correct us:

| Bucket | Means |
|---|---|
| `NO_KYC` | nothing verified |
| `BASIC_KYC` | BVN verified (the AGM shareholder path, step 1–2) |
| `FULL_KYC` | BVN + liveness/step 3 complete |
| `NIN_VERIFIED` | NIN + selfie passed — the Innovation/Launch RSVP path |
| `PENDING_REVIEW` / `REJECTED` | as today |

The open question is whether **NIN is its own bucket or a modifier**. A user can plausibly be
NIN-verified *and* `BASIC_KYC`, in which case a single-value enum cannot express them and we would
rather have counts per verification type:

```jsonc
{
  "totalConsidered": 10096,
  "byStatus":  { "NO_KYC": 63, "BASIC_KYC": 0, "FULL_KYC": 10002, "PENDING_REVIEW": 0, "REJECTED": 0, "REVOKED": 31 },
  "byMethod":  { "bvnVerified": 10002, "ninVerified": 412, "chnProvided": 8800 }
}
```

`byMethod` is the part that makes NIN visible without forcing it into a ladder it does not belong on.
**This is a product decision as much as a data one — tell us how you want to model it and we will
render whatever you choose**, but the current shape cannot express the platform's actual state.

### 2.3 The same vocabulary has to reach the other two screens

The same user currently looks different depending on where you stand:

- **Analytics** says 10,002 `FULL_KYC`.
- **All Users** shows `No KYC` in the KYC column for every visible row.
- **User detail** shows `FULL_KYC`, "Full KYC verified — BVN and CHN confirmed".

The list may simply be sorted newest-first with genuinely unverified recent signups at the top — but
that needs confirming, because if the list's per-user `kycStatus` is not derived from the same field
the breakdown counts, the two disagree by construction and nobody can tell which is right. Whatever
the taxonomy ends up being, please make `kycStatus` on the user list, the user detail, and the
analytics breakdown all use the same field and the same vocabulary.

---

## 3. 🐛 The user detail returns "Not provided" as a data value

On the user detail, **CHN renders as `Not **** ded`.**

That is the literal string `"Not provided"` coming back in the `chn` field, hitting our masking
helper, which keeps the first and last three characters of any value over six characters long:

```ts
val.length > 6 ? val.slice(0, 3) + " **** " + val.slice(-3) : val
```

A human-readable placeholder in a field typed as an identity number is the root cause — **please
return `null` (or omit the field) when there is no CHN**, and let the client decide how to render
absence. NIN already does this correctly: it comes back empty and renders as "—".

We will also harden `maskValue` so a non-numeric value is never masked, but the data should not carry
prose in the first place.

---

## Summary

1. `/admin/analytics/event-format` and `/client/analytics/event-format` both return nothing on 45 events.
2. KYC breakdown: state the denominator, model NIN explicitly, and use one vocabulary across analytics, list and detail.
3. `chn` returns the string "Not provided" where it should return null.

The KYC item is the one worth thinking about rather than just patching — NIN changed what "verified"
means and the data model has not caught up.

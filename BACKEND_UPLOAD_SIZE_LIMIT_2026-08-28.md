# Backend / infra — file uploads fail over 1 MB (nginx `client_max_body_size`)

**Reported by:** admin dashboard (attend-admin), 2026-08-28
**Severity:** high — breaks every large upload in the product, not just certificates
**Owner:** backend / infra (nginx config on the API host). **Not frontend-fixable.**

## Symptom

Uploading certificate artwork (a PDF — the format we *tell* organisers is
"strongly preferred") fails with a generic **"Artwork upload failed. Please try
again."** toast. Small images work; anything ~1 MB or larger fails. In the
browser console the axios error is a bare **`Network Error`** with **no
`response`** — so the frontend has no status code or message to show.

## Root cause (confirmed by direct reproduction)

nginx in front of `https://attend-api.schulltech.com` is using the **default
`client_max_body_size` of 1 MB**. Requests larger than that are rejected by nginx
**before they reach the Spring app**, and nginx's own 413 response **does not
carry the CORS headers** the app adds — so the browser blocks the response and
the frontend sees `Network Error` instead of `413`.

Reproduction (server-side curl, bypassing the browser/CORS), POST to
`/api/v1/upload?folder=certificate-templates` with `Origin: http://localhost:3000`:

| Body size        | Response                              | `Access-Control-Allow-Origin`? |
|------------------|---------------------------------------|--------------------------------|
| ≈512 KB          | `401` (reaches the app — auth check)  | ✅ present                     |
| ≈1.00 MB         | `413 Request Entity Too Large`        | ❌ **absent**                  |
| ≈2 MB / 5 MB / 11 MB | `413 Request Entity Too Large`    | ❌ **absent**                  |

The flip from `401` (app-level) to `413` (nginx-level) happens exactly at 1 MB,
and the `Server: nginx/1.28.3 (Ubuntu)` header on the 413 confirms nginx — not
the app — is generating it.

## Why this matters beyond certificates

The 1 MB cap contradicts what the application intends. Multiple upload features
enforce a **10 MB** client-side limit and show "the server limit is 10 MB":

- `POST /api/v1/upload?folder=documents` (event documents — PDF/DOCX/PPTX)
- `POST /api/v1/upload?folder=agm-notices` (AGM notice PDFs)
- `POST /api/v1/upload?folder=challenge-resources`
- `POST /api/v1/upload?folder=certificate-templates` (new — certificate artwork)

All of these silently fail for any file between 1 MB and 10 MB, surfacing as the
same opaque "Network Error". Certificate artwork just makes it obvious because a
print-quality PDF is essentially always >1 MB.

## Asks (backend / infra)

1. **Raise `client_max_body_size`** on the API server (or at least the
   `/api/v1/upload` location) to match the intended app limit — **≥10 MB**, and
   ideally **20–25 MB** so print-resolution A4 certificate PDFs are comfortable.
   The app already enforces its own per-feature caps, so a generous nginx ceiling
   is safe.

2. **Make the 413 (and other nginx-level errors) return CORS headers**, e.g. via
   an `error_page 413` handler that adds `Access-Control-Allow-Origin` /
   `Access-Control-Allow-Credentials`, or by letting the app handle the size
   rejection. Without this, *any* over-limit upload will keep showing as a
   meaningless "Network Error" in every browser client, hiding the real cause.

## Frontend interim mitigation (already shipped)

Until nginx is raised, attend-admin caps certificate-artwork uploads at **~1 MB**
client-side (`ARTWORK_MAX_BYTES` in `src/api/certificate-templates.ts`) and shows
a clear "over the server's current 1.0 MB limit — use a vector PDF or compress it"
message instead of firing a doomed request. **Bump that constant back to the real
limit once nginx is fixed.** (The other upload features listed above still send
straight through and will keep failing at 1 MB until the server cap is raised.)

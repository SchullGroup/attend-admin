# Backend — uploaded images & documents cannot be viewed (Huawei OBS) — 2026-08-25

## ⚠️ Security first — rotate the exposed production key

A production Huawei OBS **Secret Access Key** for the IAM user `attend-vendor-api-prod`
(Access Key ID `HPUA…8TM`, secret redacted here) was shared in plaintext over a chat
channel while diagnosing this issue. **Treat it as compromised and rotate it now** in the
Huawei Cloud console (IAM → Access Keys → create new, update the backend host, then delete
the old). The secret is deliberately **not** recorded in this file.

These are **server-side** credentials. They belong only on the backend host (the OBS SDK
uses them to PUT objects during `POST /api/v1/upload`, to sign temporary URLs, and to
manage bucket ACL/CORS). They must never be placed in this Next.js admin app or any
`NEXT_PUBLIC_*` variable — anything shipped to the browser is readable by every user.
Nothing in the viewing path uses these keys client-side, so adding them to the frontend
cannot fix this symptom.

---

## Symptom

Admin users cannot view previously **uploaded images and documents** — flyers/logos show
the "Image preview unavailable" fallback, and document/press-kit links fail to open.

## How the frontend actually handles files (for context)

The admin app has **no direct OBS integration**. For every upload it:

1. `POST /api/v1/upload` (multipart) to the backend proxy → expects `{ data: { fileUrl, cloudinaryPublicId? } }`.
2. Persists that `fileUrl` against the entity (event flyer, org/registrar logo, global document, press-kit item, challenge resource, AGM notice).
3. To **view**, it simply renders/opens that stored URL:
   - images: `<img src={fileUrl}>` (plain `img`, no auth header, no `next/image` allowlist) — see [image-url-upload.tsx:154](src/components/custom/image-url-upload.tsx#L154) and [logo-upload.tsx](src/components/custom/logo-upload.tsx);
   - documents: open `fileUrl` directly, or download via the backend counter endpoint `GET /api/v1/client/documents/{id}/download` — see [client-documents.ts](src/api/client-documents.ts).

So the browser fetches the returned `fileUrl` **directly**. If that URL is not
browser-fetchable, viewing fails and there is nothing the frontend can change to fix it.

## Root cause — CONFIRMED with the bucket owners (2026-08-25)

The bucket/objects are **private**. After upload, `/api/v1/upload` returns a **plain object
URL** (`https://<bucket>.obs.<region>.myhuaweicloud.com/<key>`), so an unauthenticated
browser GET returns **403 AccessDenied**. That is the entire symptom.

**The fix is NOT to give the browser the OBS keys.** A web page must never carry the
Access/Secret keys. The correct fix is a **presigned URL** (OBS "temporary signature URL"):
the backend signs the object URL with the AK/SK, and the signature travels in the URL query
string (`?AccessKeyId=…&Expires=…&Signature=…`, time-limited). The browser loads that URL
with **no credentials** and it works until it expires. The bucket stays private.

Fix options, best first:

1. **Presigned GET URL, signed on read (recommended).** Keep the bucket private. Whenever the
   backend serves an entity that references a file (event flyer, document, press-kit item,
   logo, challenge resource), mint a fresh temporary-signature URL at that moment and return
   it as `fileUrl`. TTL long enough to view/download (e.g. 15–60 min).
2. **Authenticated streaming endpoint.** Backend route (e.g. the existing
   `GET /api/v1/client/documents/{id}/download`) fetches the object server-side and streams
   the bytes with the caller's auth. Good for downloads; for inline `<img>` previews a
   presigned URL is simpler.
3. **Public-read ACL — least preferred, do not use for documents.** These are AGM/shareholder
   files; public-read would expose them to anyone with the URL. Acceptable only for
   non-sensitive assets like public event flyers/logos, if at all.

## Critical trap — do NOT persist a presigned URL as the entity's stored URL

The frontend saves whatever `fileUrl` it receives from `/api/v1/upload` **into the entity**
(e.g. the event's `flyerUrl`, the document's `fileUrl`) and re-renders that stored value
later — see [image-url-upload.tsx:99-103](src/components/custom/image-url-upload.tsx#L99-L103)
and [client-documents.ts:234-262](src/api/client-documents.ts#L234-L262). If `/api/v1/upload`
returns a **presigned** URL and the backend stores that string verbatim, it will **work right
after upload and then 403 once the signature expires** — the classic "it worked yesterday" bug.

Therefore the backend must persist the **stable object key**, not a signed URL, and sign
**on read** (option 1). Two clean shapes:

- `/api/v1/upload` returns a stable key/id; the entity stores the key; every read re-signs → **no frontend change needed**; or
- entities keep returning a ready-to-use `fileUrl` that the backend re-signs on each GET → **no frontend change needed**.

Only if you instead expose a separate "mint a view URL" endpoint (call it right before
viewing) would the frontend need a small change — say so and it'll be added.

## Secondary checks (once presigning is in place)

- **CORS on the bucket.** Direct `<img>` rendering is not CORS-gated, but any `fetch`/XHR blob
  path (and canvas use) is — e.g. the "AGM notice re-upload" flow. Add a bucket CORS rule
  allowing the admin origin(s) with `GET`/`HEAD`.
- **Confirm uploads actually persist.** If the OBS credentials/bucket on the host are wrong or
  empty, `POST /api/v1/upload` may return a URL that points at nothing. Ties into the still-open
  upload-session `500`s below. Verify a freshly uploaded object exists in the bucket.

## Asks

- Confirm exactly what `POST /api/v1/upload` returns today for an image and for a document
  (paste one real `data` object), and whether `fileUrl` is a presigned URL or a plain object URL.
- Verify `HUAWEI_OBS_ACCESS_KEY` / `HUAWEI_OBS_SECRET_KEY` (and bucket/endpoint/region) are
  set correctly on the **production** host with the **rotated** key, and that a fresh upload
  round-trips (upload → read back in a browser with no auth).
- Decide the read strategy (presigned-on-read vs authenticated streaming endpoint) and keep
  it consistent for images, documents, press-kit, logos, and challenge resources.
- Confirm whether legacy Cloudinary-backed URLs remain readable after the OBS switch
  (re-raised from 2026-08-11 item #2).

## Related prior items

- Production OBS configuration / credential check — [BACKEND_FOLLOWUP_2026-08-11.md](BACKEND_FOLLOWUP_2026-08-11.md) §2.
- OBS upload-session / signed-URL generation `500`s — [BACKEND_INCIDENTS_AND_FEATURE_REQUESTS_2026-08-22.md](BACKEND_INCIDENTS_AND_FEATURE_REQUESTS_2026-08-22.md) §6.1.
- Backend must generate/scope storage keys; never trust a client-supplied key — [BACKEND_INVITE_DIRECTORY_PRODUCTION_FIXES_2026-08-20.md](BACKEND_INVITE_DIRECTORY_PRODUCTION_FIXES_2026-08-20.md).

## Optional frontend hardening (not the cause)

When the app fetches an **absolute** OBS URL through axios (the "re-upload from URL" and
some blob paths), the request interceptor in [api-client.ts](src/lib/api-client.ts) attaches
`Authorization: Bearer <token>` because the URL is not in `publicEndpoints`. OBS may reject a
request that carries both a bearer header and its own signature. This does **not** affect the
main `<img src>` / direct-open viewing path, so it is not the reported failure — but stripping
`Authorization` for non-API hosts would be a correct robustness fix. Happy to do this on
request.

### Frontend aligned — 2026-08-26 ✅

Backend confirmed (mvp.md item 76) the read path is fixed the right way: the bucket stays
**private** and URLs are **signed on read** (option 1), so the normal view path — load an
entity, render its `fileUrl` in `<img>` / open it — now works with **no frontend change**. The
"stable key, sign on read" trap in the section above was heeded: entities keep returning a
ready-to-use `fileUrl` the backend re-signs per GET, so nothing presigned is persisted.

The one hardening above is now **shipped**, because it was proven to bite a real path, not just
theoretical: `useUploadCloudinaryDocument` (AGM-notice re-upload) does
`apiClient.get<Blob>(sourceUrl)` on an **absolute** OBS URL, so the interceptor was attaching
our bearer alongside OBS's own query-string signature. Fix in
[api-client.ts](src/lib/api-client.ts): a new `isForeignHostUrl()` guard means the request
interceptor attaches `Authorization` **only** to relative URLs and absolute URLs whose host
matches `NEXT_PUBLIC_API_URL`. Foreign hosts (OBS, Cloudinary) now get **no** bearer — removing
both the rejection risk and the token-leak-to-third-party risk. Relative API calls are
unaffected.

Not implemented (correctly not needed): `previewUrl` / a "mint a view URL" endpoint. The
upload components already show an **immediate local preview** ([image-url-upload.tsx](src/components/custom/image-url-upload.tsx)
uses a `URL.createObjectURL` blob; [logo-upload.tsx](src/components/custom/logo-upload.tsx)
uses a FileReader data URL), so there is no post-upload window where a not-yet-persisted signed
URL would be required. If the read strategy ever changes to a separate view-URL endpoint, say
so and the small FE change gets added.

Still **backend / Huawei-console owned, not FE**: rotating the exposed AK/SK (top of this doc);
`Content-Disposition: inline` so documents open in-tab rather than force-download; the delete
**403** (IAM permission on the bucket for the API's service account); and the bucket **CORS**
`GET`/`HEAD` rule for blob/canvas paths (shares the same rule needed by the CSV upload —
see [BACKEND_INVITE_CSV_IMPORT_2026-08-25.md](BACKEND_INVITE_CSV_IMPORT_2026-08-25.md)).

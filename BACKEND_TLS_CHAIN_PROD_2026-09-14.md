# 🔴 Production blocker — `attend-backend-prod` serves an incomplete TLS certificate chain (2026-09-14)

**Nothing that is not a web browser can connect to the production API right now.** The admin
portal at `admin.experienceattend.com` is down because of this, and so is every other
non-browser client. This is a one-line nginx fix.

Please read §3 before replying "but it works for me" — it almost certainly does, and that is
a symptom of this bug rather than evidence against it.

---

## 1. Symptom and evidence

`POST https://admin.experienceattend.com/api/auth/login` returns **500**. That endpoint is
the admin app's own server-side route, which forwards to the Attend API — so the failure is
between our server and yours, not in the browser.

Reproduced locally by pointing a development build at the production backend. With the error
surfaced properly instead of collapsed into a generic 500, the cause is exact:

```
Login Proxy Error — could not reach the API {
  target:  'https://attend-backend-prod.experienceattend.com/api/v1/auth/login',
  code:    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  message: 'unable to verify the first certificate'
}
POST /api/auth/login 502 in 1083ms
```

`UNABLE_TO_VERIFY_LEAF_SIGNATURE` is a TLS handshake failure. **The request never reaches
your application code** — there is nothing to find in the application logs, because no
request arrives.

## 2. Cause

The server presents its **leaf certificate only**. The intermediate certificate that chains
that leaf to a trusted root is not included in the handshake, so a client with only root
certificates in its trust store cannot build a path from your certificate to anything it
trusts.

Confirm in one command:

```bash
echo | openssl s_client -showcerts -servername attend-backend-prod.experienceattend.com \
  -connect attend-backend-prod.experienceattend.com:443 2>/dev/null | grep -c "BEGIN CERTIFICATE"
```

- `1` → leaf only. Broken. This is what production returns today.
- `2` or more → chain complete.

The same command against **`attend-api.schulltech.com` (staging) returns 2 or more** — which
is precisely why staging works and production does not. Same code, same clients, different
certificate installation.

`openssl s_client` will also print `Verify return code: 21 (unable to verify the first
certificate)`, and any public SSL checker will report **"Chain issues: Incomplete"**.

## 3. Why it appears to work — please read this before dismissing it

This misconfiguration is invisible to exactly the two tools most people test with, which is
why it reached production.

- **Browsers hide it.** Chrome and Safari perform **AIA fetching**: when a chain is
  incomplete, they read the "Authority Information Access" field in your certificate, go and
  download the missing intermediate themselves, and complete the chain on your behalf. They
  also cache intermediates encountered on other sites, so a browser that has met this
  intermediate anywhere else already has it. Opening the Swagger UI in a browser therefore
  succeeds and proves nothing about the certificate.
- **Postman hides it too.** Postman ships a setting — Settings → General → **SSL certificate
  verification** — that is very commonly switched off, because people disable it to work
  against self-signed development certificates and never turn it back on. With it off,
  Postman ignores chain errors entirely. **Turn that setting on and retry: the request will
  fail**, which is a ten-second confirmation of everything in this document.
- **Node.js, Java, Android, Go, curl and cron jobs do none of this.** They validate strictly
  against their own trust store, do not fetch missing intermediates, and refuse the
  connection. No configuration on our side can make them accept it, and none should.

The diagnostic rule: when the same certificate is accepted by browsers and rejected by
everything else, the certificate is fine and the **chain** is broken.

## 4. Fix — prod nginx

```nginx
ssl_certificate      /etc/letsencrypt/live/<domain>/fullchain.pem;   # NOT cert.pem
ssl_certificate_key  /etc/letsencrypt/live/<domain>/privkey.pem;
```

```bash
nginx -t && systemctl reload nginx
```

`cert.pem` is the leaf on its own; `fullchain.pem` is the leaf plus the intermediate.
Pointing `ssl_certificate` at the former is the usual cause of this error and is normally the
entire fix. If the certificate came from a commercial CA rather than Let's Encrypt, the
equivalent is concatenating the CA's intermediate bundle onto the leaf, in that order, into
the file `ssl_certificate` points at.

Re-run the `openssl` command in §2 afterwards and expect `2` or more. No application
redeploy is required; this is a TLS-termination change only.

## 5. What it currently breaks

- **The production admin portal** — every server-side call, login included. The deployment
  is unusable.
- **Mobile clients** against prod. Android in particular will not negotiate this at all, and
  offers no user-facing way around it.
- **Any server-to-server integration**: webhooks, monitoring probes, scheduled jobs,
  anything calling the API from a backend rather than a browser tab.

## 6. One thing to check while you are in there

If the prod nginx server block was copied from a template, the same `cert.pem`/`fullchain.pem`
mistake may be sitting in other host configurations, waiting for the next certificate renewal
or the next host to be stood up. Worth a grep across the nginx configs for
`ssl_certificate.*cert\.pem`.

---

## Related

- `BACKEND_PENDING_AND_REQUESTS_2026-09-13.md` — everything else outstanding. All of it is
  untestable in production until this is resolved.

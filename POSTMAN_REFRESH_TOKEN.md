# Postman — Refresh Token Setup

Three pieces: (1) save tokens after login, (2) a Refresh Token request that
rotates them, (3) optional auto-refresh so every request in the collection
refreshes the access token first if it's stale. Uses two environment
variables: `accessToken` and `refreshToken`.

---

## 1. Login request — save tokens on success

On your **Login** request (`POST {{base_url}}/api/v1/auth/login`), open the
**Tests** tab and paste:

```javascript
const res = pm.response.json();
const data = res.data ?? res;

const accessToken  = data.token ?? data.accessToken;
const refreshToken = data.refreshToken;

if (accessToken)  pm.environment.set("accessToken", accessToken);
if (refreshToken) pm.environment.set("refreshToken", refreshToken);

pm.test("Login returned tokens", function () {
    pm.expect(accessToken).to.be.a("string");
    pm.expect(refreshToken).to.be.a("string");
});
```

---

## 2. Refresh Token request

Create a request:

```
POST {{base_url}}/api/v1/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "{{refreshToken}}"
}
```

**Tests** tab — rotate the stored tokens with whatever comes back:

```javascript
const res = pm.response.json();

pm.test("Refresh succeeded", function () {
    pm.expect(pm.response.code).to.equal(200);
    pm.expect(res.status).to.be.true;
});

if (res.status) {
    const data = res.data ?? res;
    const newAccessToken  = data.token ?? data.accessToken;
    const newRefreshToken = data.refreshToken; // may be omitted if not rotating

    if (newAccessToken)  pm.environment.set("accessToken", newAccessToken);
    if (newRefreshToken) pm.environment.set("refreshToken", newRefreshToken);

    console.log("New accessToken:", newAccessToken);
} else {
    console.error("Refresh failed:", res.message ?? res.error);
}
```

Run **Login** once, then **Refresh Token** any time — each run rotates
`accessToken`/`refreshToken` in the environment automatically.

---

## 3. (Optional) Auto-refresh before every request

If you want every request in the collection to silently refresh the access
token first when it's about to expire, add this at the **collection level**
→ **Pre-request Script** tab. It assumes you also store `accessTokenExpiresAt`
(epoch ms) — set that alongside `accessToken` in the Login/Refresh test
scripts above if your login response includes an `expiresIn`:

```javascript
// In Login/Refresh "Tests" tab, also set expiry if the API returns expiresIn (seconds):
// pm.environment.set("accessTokenExpiresAt", Date.now() + (data.expiresIn * 1000));
```

Then the collection-level pre-request script:

```javascript
const expiresAt = parseInt(pm.environment.get("accessTokenExpiresAt") || "0", 10);
const refreshToken = pm.environment.get("refreshToken");

// Refresh if we're within 30s of expiry (or have no expiry recorded but do have a refresh token)
const needsRefresh = refreshToken && (!expiresAt || Date.now() > expiresAt - 30000);

if (needsRefresh) {
    const req = {
        url: pm.environment.get("base_url") + "/api/v1/auth/refresh-token",
        method: "POST",
        header: { "Content-Type": "application/json" },
        body: {
            mode: "raw",
            raw: JSON.stringify({ refreshToken })
        }
    };

    pm.sendRequest(req, function (err, res) {
        if (err) {
            console.error("Auto-refresh failed:", err);
            return;
        }
        const json = res.json();
        if (json.status) {
            const data = json.data ?? json;
            const newAccessToken  = data.token ?? data.accessToken;
            const newRefreshToken = data.refreshToken;
            if (newAccessToken)  pm.environment.set("accessToken", newAccessToken);
            if (newRefreshToken) pm.environment.set("refreshToken", newRefreshToken);
        } else {
            console.error("Auto-refresh rejected:", json.message ?? json.error);
        }
    });
}
```

Then make sure your requests use `Authorization: Bearer {{accessToken}}` in
the collection's Authorization tab (inherit from parent), so the refreshed
token is picked up automatically.

---

## Environment variables used

| Variable | Set by |
|---|---|
| `base_url` | you (e.g. `https://attend-api.schulltech.com`) |
| `accessToken` | Login / Refresh test script |
| `refreshToken` | Login / Refresh test script |
| `accessTokenExpiresAt` | optional, Login/Refresh test script (if `expiresIn` is returned) |

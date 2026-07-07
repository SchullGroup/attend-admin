import axios from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Endpoints that do not require the Authorization header
const publicEndpoints = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/refresh-token",
];

// ── Cross-tab refresh coordination ───────────────────────────────────────────
// Backends that use rotating refresh tokens issue a NEW refresh token on every
// call and invalidate the old one.  When the app is open in multiple tabs (or
// React Query fires a burst of refetches), each tab independently attempts a
// refresh — the second call arrives with an already-consumed token → 401 →
// forced logout.
//
// Fix: the tab that wins the race stamps localStorage with the current time.
// Any tab that loses the race (gets 401 from the refresh endpoint) checks the
// stamp before giving up.  If another tab refreshed within the last 4 seconds
// the shared HttpOnly+JS cookie will already contain the new access token, so
// we just grab it and retry the original request instead of logging out.
const LAST_REFRESH_TS_KEY = "__attend_last_refresh_ts";

function stampRefreshTime(): void {
  try { localStorage.setItem(LAST_REFRESH_TS_KEY, Date.now().toString()); } catch {}
}

function anotherTabJustRefreshed(): boolean {
  try {
    const ts = Number(localStorage.getItem(LAST_REFRESH_TS_KEY) ?? 0);
    return Date.now() - ts < 4_000;
  } catch {
    return false;
  }
}

// ── Shared refresh singleton ──────────────────────────────────────────────────
// All callers within the SAME tab share ONE in-flight Promise so we never fire
// more than one POST /api/auth/refresh concurrently inside a single tab.

let _refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = axios
    .post<{ data?: { token?: string; accessToken?: string }; token?: string; accessToken?: string }>(
      "/api/auth/refresh"
    )
    .then(({ data }) => {
      const tokenData = (data as any)?.data ?? data;
      const token: string | undefined =
        (tokenData as any)?.token ?? (tokenData as any)?.accessToken;
      if (!token) throw new Error("No token in refresh response");
      Cookies.set("accessToken", token, {
        expires:  1,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      // Tell other tabs that we refreshed so they don't try (and fail) with the
      // now-consumed refresh token.
      stampRefreshTime();
      return token;
    })
    .finally(() => {
      _refreshPromise = null;
    });

  return _refreshPromise;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const isPublic = publicEndpoints.some((endpoint) =>
      config.url?.includes(endpoint),
    );

    if (!isPublic) {
      const token = Cookies.get("accessToken");
      if (token && config.headers) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use the shared singleton so concurrent callers (including the layout's
        // silent-refresh effect) never fire more than one POST /api/auth/refresh
        // at the same time (critical for backends with rotating refresh tokens).
        const newAccessToken = await refreshAccessToken();

        apiClient.defaults.headers.common["Authorization"] =
          "Bearer " + newAccessToken;
        originalRequest.headers["Authorization"] = "Bearer " + newAccessToken;

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshError: any) {
        processQueue(refreshError, null);

        const httpStatus = refreshError?.response?.status;
        const isAuthFailure =
          httpStatus === 401 ||
          httpStatus === 403 ||
          refreshError?.message === "No token in refresh response";

        if (isAuthFailure) {
          // ── Cross-tab race recovery ─────────────────────────────────────────
          // Our refresh failed, but another browser tab may have already won the
          // race and set a fresh access token in the shared cookie.  If the
          // localStorage stamp shows a successful refresh happened in the last
          // 4 seconds, grab the cookie (which the winning tab already updated)
          // and retry the original request — no logout needed.
          if (anotherTabJustRefreshed()) {
            const freshToken = Cookies.get("accessToken");
            if (freshToken) {
              apiClient.defaults.headers.common["Authorization"] =
                "Bearer " + freshToken;
              originalRequest.headers["Authorization"] =
                "Bearer " + freshToken;
              // Don't processQueue with the error — let the retried request resolve/reject
              return apiClient(originalRequest);
            }
          }

          // Refresh token is genuinely expired or invalid — send to login.
          Cookies.remove("accessToken");
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

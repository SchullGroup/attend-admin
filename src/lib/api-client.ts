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

// ── Shared refresh singleton ──────────────────────────────────────────────────
// All callers (layout silent-refresh + interceptor) share ONE in-flight request.
// Without this, React StrictMode's double-effect invocation fires two simultaneous
// POST /api/auth/refresh calls. If the backend uses rotating refresh tokens the
// second call arrives with an already-consumed token → 401 → forced logout.

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
        // Only redirect to login on a definitive auth failure (401/403 from the proxy,
        // or an error thrown because the response contained no token).
        // Transient network errors should NOT log the user out.
        const httpStatus = refreshError?.response?.status;
        const isAuthFailure =
          httpStatus === 401 ||
          httpStatus === 403 ||
          refreshError?.message === "No token in refresh response";
        if (isAuthFailure) {
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

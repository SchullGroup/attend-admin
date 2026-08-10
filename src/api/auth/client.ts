import { apiClient } from "@/lib/api-client";
import { AuthApiResponse, LoginRequest, MeApiResponse } from "@/types";
import axios from "axios";

const DEVICE_ID_STORAGE_KEY = "attend_device_id";

function getDeviceId(): string | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;

    if (typeof crypto.randomUUID !== "function") return undefined;

    const deviceId = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    return deviceId;
  } catch {
    // Login remains backward-compatible when browser storage is unavailable.
    return undefined;
  }
}

export const authClient = {
  // Proxied through Next.js for HTTP-Only Cookie
  login: async (data: LoginRequest) => {
    // Note: We call the local Next.js proxy route, NOT the Java backend directly!
    const deviceId = getDeviceId();
    const response = await axios.post<AuthApiResponse>("/api/auth/login", {
      ...data,
      ...(deviceId ? { deviceId } : {}),
    });
    return response.data;
  },

  logout: async () => {
    // Call the local Next.js proxy route to clear the HTTP-Only cookie
    const response = await axios.post<AuthApiResponse>("/api/auth/logout");
    return response.data;
  },

  getMe: async () => {
    // Direct call to Java backend because it uses the access token (via interceptor)
    const response = await apiClient.get<MeApiResponse>("/api/v1/auth/me");
    return response.data;
  },
};

import { apiClient } from "@/lib/api-client";
import { AuthApiResponse, LoginRequest, MeApiResponse } from "@/types";
import axios from "axios";

export const authClient = {
  // Proxied through Next.js for HTTP-Only Cookie
  login: async (data: LoginRequest) => {
    // Note: We call the local Next.js proxy route, NOT the Java backend directly!
    const response = await axios.post<AuthApiResponse>("/api/auth/login", data);
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "./client";
import { apiClient } from "@/lib/api-client";
import Cookies from "js-cookie";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authClient.login,
    onSuccess: (response) => {
      // Access token is saved here manually for the interceptor
      // The Next.js proxy route has already set the refreshToken as an HttpOnly cookie
      const token = response.data.token;
      if (token) {
        Cookies.set("accessToken", token, {
          expires:  1, // 1 day — prevents it becoming a session cookie that vanishes on tab close
          secure:   process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
      }
      // Persist logoUrl from login response — /me endpoint may not return it
      if (typeof window !== "undefined") {
        const logoUrl = response.data.logoUrl;
        if (logoUrl) {
          localStorage.setItem("userLogoUrl", logoUrl);
        } else {
          localStorage.removeItem("userLogoUrl");
        }
      }
      queryClient.invalidateQueries({ queryKey: authKeys.me() });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authClient.logout,
    onSuccess: () => {
      Cookies.remove("accessToken");
      if (typeof window !== "undefined") localStorage.removeItem("userLogoUrl");
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
};

export const useGetMe = (enabled = !!Cookies.get("accessToken")) => {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: authClient.getMe,
    // Callers such as the dashboard layout can enable this after a silent
    // refresh makes a token available without remounting the component.
    enabled,
    retry: false,
  });
};

/** Upload the signed-in user's own profile photo. POST /api/v1/auth/me/avatar (multipart: file). */
export const useUploadMyAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiClient.post("/api/v1/auth/me/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: authKeys.me() }); },
  });
};

/** Remove the signed-in user's own profile photo. DELETE /api/v1/auth/me/avatar. */
export const useRemoveMyAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete("/api/v1/auth/me/avatar");
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: authKeys.me() }); },
  });
};

/** Update the signed-in user's own details. PATCH /api/v1/auth/me — send only changed fields. */
export const useUpdateMe = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { firstName?: string; lastName?: string; phone?: string }) => {
      const res = await apiClient.patch("/api/v1/auth/me", body);
      return res.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: authKeys.me() }); },
  });
};

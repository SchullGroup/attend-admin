import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "./client";
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
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        });
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
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    },
  });
};

export const useGetMe = () => {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: authClient.getMe,
    // only fetch if access token exists
    enabled: !!Cookies.get("accessToken"),
    retry: false,
  });
};

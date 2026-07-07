"use client";

/**
 * auth.ts — Extended Auth API hooks
 *
 * Endpoints:
 *   POST /api/v1/auth/forgot-password
 *   POST /api/v1/auth/reset-password
 *   POST /api/v1/auth/change-password
 *   POST /api/v1/auth/refresh-token
 *   POST /api/v1/auth/verify-email
 *   POST /api/v1/auth/verify-phone
 *   POST /api/v1/auth/resend-email-otp
 *   POST /api/v1/auth/resend-phone-otp
 *
 * Note: login / logout / getMe live in auth/client.ts + auth/hooks.ts.
 */

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { popup } from "@/lib/popup-store";
import { parseAndToastApiError } from "@/lib/api-error";
import { ApiResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token:       string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword:     string;
}

export interface VerifyEmailRequest {
  email: string;
  otp:   string;
}

export interface VerifyPhoneRequest {
  phone: string;
  otp:   string;
}

export interface ResendEmailOtpRequest {
  email: string;
}

export interface ResendPhoneOtpRequest {
  phone: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Forgot password — sends reset link to email
// POST /api/v1/auth/forgot-password
// ---------------------------------------------------------------------------
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data: ForgotPasswordRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/auth/forgot-password",
        data
      );
      return res.data;
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Failed to send reset link. Please try again."),
  });
}

// ---------------------------------------------------------------------------
// Reset password — uses token from email link
// POST /api/v1/auth/reset-password
// ---------------------------------------------------------------------------
export function useResetPassword() {
  return useMutation({
    mutationFn: async (data: ResetPasswordRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/auth/reset-password",
        data
      );
      return res.data;
    },
    onSuccess: () =>
      popup.success("Password Updated", "Your password has been reset. Please log in.", 3500),
    onError: (error: any) =>
      parseAndToastApiError(error, "Reset failed. The link may have expired."),
  });
}

// ---------------------------------------------------------------------------
// Change password — for authenticated users changing their own password
// POST /api/v1/auth/change-password
// ---------------------------------------------------------------------------
export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/auth/change-password",
        data
      );
      return res.data;
    },
    onSuccess: () =>
      popup.success("Password Changed", "Your password has been updated successfully.", 3000),
    onError: (error: any) =>
      parseAndToastApiError(error, "Password change failed. Check your current password."),
  });
}

// ---------------------------------------------------------------------------
// Verify email OTP
// POST /api/v1/auth/verify-email
// ---------------------------------------------------------------------------
export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (data: VerifyEmailRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/auth/verify-email",
        data
      );
      return res.data;
    },
    onSuccess: () =>
      popup.success("Email Verified", "Your email address has been confirmed.", 3000),
    onError: (error: any) =>
      parseAndToastApiError(error, "Verification failed. Check your OTP and try again."),
  });
}

// ---------------------------------------------------------------------------
// Verify phone OTP
// POST /api/v1/auth/verify-phone
// ---------------------------------------------------------------------------
export function useVerifyPhone() {
  return useMutation({
    mutationFn: async (data: VerifyPhoneRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/auth/verify-phone",
        data
      );
      return res.data;
    },
    onSuccess: () =>
      popup.success("Phone Verified", "Your phone number has been confirmed.", 3000),
    onError: (error: any) =>
      parseAndToastApiError(error, "Verification failed. Check your OTP and try again."),
  });
}

// ---------------------------------------------------------------------------
// Resend email OTP
// POST /api/v1/auth/resend-email-otp
// ---------------------------------------------------------------------------
export function useResendEmailOtp() {
  return useMutation({
    mutationFn: async (data: ResendEmailOtpRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/auth/resend-email-otp",
        data
      );
      return res.data;
    },
    onSuccess: () =>
      popup.success("OTP Sent", "A new verification code has been sent to your email.", 3000),
    onError: (error: any) =>
      parseAndToastApiError(error, "Failed to resend OTP. Please try again."),
  });
}

// ---------------------------------------------------------------------------
// Resend phone OTP
// POST /api/v1/auth/resend-phone-otp
// ---------------------------------------------------------------------------
export function useResendPhoneOtp() {
  return useMutation({
    mutationFn: async (data: ResendPhoneOtpRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/auth/resend-phone-otp",
        data
      );
      return res.data;
    },
    onSuccess: () =>
      popup.success("OTP Sent", "A new verification code has been sent to your phone.", 3000),
    onError: (error: any) =>
      parseAndToastApiError(error, "Failed to resend OTP. Please try again."),
  });
}

// ---------------------------------------------------------------------------
// Refresh token — exchange refresh token for new access token
// POST /api/v1/auth/refresh-token
// (Usually handled by the Next.js proxy, but exposed here for direct use)
// ---------------------------------------------------------------------------
export function useRefreshToken() {
  return useMutation({
    mutationFn: async (data: RefreshTokenRequest) => {
      const res = await apiClient.post<ApiResponse<any>>(
        "/api/v1/auth/refresh-token",
        data
      );
      return res.data;
    },
    onError: (error: any) =>
      parseAndToastApiError(error, "Session refresh failed. Please log in again."),
  });
}

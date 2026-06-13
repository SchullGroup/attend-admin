import { ApiResponse } from "@/types/api";

export interface AuthResponse {
  token: string;
  refreshToken: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  logoUrl?: string | null;
  avatarUrl?: string | null;
}

export interface MeResponse {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  role: string;
  email: string;
  avatarUrl: string | null;
  logoUrl?: string | null;
}

export type AuthApiResponse = ApiResponse<AuthResponse>;
export type MeApiResponse = ApiResponse<MeResponse>;

export interface LoginRequest {
  identifier: string;
  password?: string;
  /** Stable identifier for this browser installation, reused across logins. */
  deviceId?: string;
}

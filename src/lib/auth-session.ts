const SESSION_END_REASON_KEY = "attend_session_end_reason";

export const SESSION_INVALIDATED_MESSAGE =
  "You have been logged in from another device.";
export const SESSION_EXPIRED_MESSAGE =
  "Your session expired after 2 hours of inactivity. Please log in again.";

const SESSION_REVOKED_CODES = new Set(["SESSION_REVOKED", "SIGNED_IN_ELSEWHERE"]);
const SESSION_EXPIRED_CODES = new Set(["SESSION_EXPIRED", "IDLE_TIMEOUT"]);

const SUPPORTED_SESSION_END_MESSAGES = new Set([
  SESSION_INVALIDATED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
]);

function responseData(error: unknown): Record<string, unknown> | undefined {
  const data = (error as any)?.response?.data;
  return data && typeof data === "object" ? data : undefined;
}

export function getSessionEndMessage(error: unknown): string | undefined {
  const data = responseData(error);
  const code = typeof data?.code === "string" ? data.code.toUpperCase() : "";
  const errorLabel = typeof data?.error === "string" ? data.error.toLowerCase() : "";
  const message = typeof data?.message === "string" ? data.message : undefined;

  if (SESSION_REVOKED_CODES.has(code) || errorLabel === "session revoked") {
    return SESSION_INVALIDATED_MESSAGE;
  }
  if (SESSION_EXPIRED_CODES.has(code) || errorLabel === "session expired") {
    return SESSION_EXPIRED_MESSAGE;
  }
  return message && SUPPORTED_SESSION_END_MESSAGES.has(message) ? message : undefined;
}

export function isSessionRevokedError(error: unknown): boolean {
  return getSessionEndMessage(error) === SESSION_INVALIDATED_MESSAGE;
}

export function isSessionEndedError(error: unknown): boolean {
  return getSessionEndMessage(error) !== undefined;
}

export function rememberSessionEndReason(error: unknown): boolean {
  if (typeof window === "undefined") return false;

  const message = getSessionEndMessage(error);
  if (!message) return false;

  try {
    window.localStorage.setItem(SESSION_END_REASON_KEY, message);
  } catch {
    return false;
  }
  return true;
}

export function consumeSessionEndReason(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const message = window.localStorage.getItem(SESSION_END_REASON_KEY);
    window.localStorage.removeItem(SESSION_END_REASON_KEY);
    return message && SUPPORTED_SESSION_END_MESSAGES.has(message) ? message : null;
  } catch {
    return null;
  }
}
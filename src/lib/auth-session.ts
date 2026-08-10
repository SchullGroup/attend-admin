const SESSION_END_REASON_KEY = "attend_session_end_reason";

export const SESSION_INVALIDATED_MESSAGE =
  "You have been logged in from another device.";
export const SESSION_EXPIRED_MESSAGE =
  "Your session expired after 2 hours of inactivity. Please log in again.";

const SUPPORTED_SESSION_END_MESSAGES = new Set([
  SESSION_INVALIDATED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
]);

function responseMessage(error: unknown): string | undefined {
  const data = (error as any)?.response?.data;
  return typeof data?.message === "string" ? data.message : undefined;
}

export function rememberSessionEndReason(error: unknown): boolean {
  if (typeof window === "undefined") return false;

  const message = responseMessage(error);
  if (!message || !SUPPORTED_SESSION_END_MESSAGES.has(message)) return false;

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
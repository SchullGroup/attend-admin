import { toast } from "sonner";

/**
 * Unified API error parser for all React Query onError blocks.
 *
 * Tier priority (highest → lowest):
 *  1. Known stable backend error code
 *  2. Explicit server root-level `message` string
 *  3. Structured field-validation `errors[]` array (Spring Boot / NestJS format)
 *  4. HTTP status code fallbacks
 *  5. Supplied `defaultFallback` string
 */
export function parseAndToastApiError(
  error: any,
  defaultFallback = "An unexpected error occurred."
): void {
  console.error("🔴 [Debug API Error Context]:", error);

  const responseData = error?.response?.data;
  const requestId = typeof responseData?.requestId === "string"
    ? ` Request ID: ${responseData.requestId}`
    : "";
  const codeMessages: Record<string, string> = {
    OTP_NOT_FOUND: "OTP not found. Request a new code and try again.",
    OTP_EXPIRED: "OTP expired. Request a new code and try again.",
    INVALID_OTP: "Invalid OTP. Check the code and try again.",
    TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new OTP.",
    ZOOM_END_FAILED: "Zoom could not end the linked meeting, so the event status was not changed. Please try again.",
    INVITE_NOT_FOUND: "This invite no longer exists. Refresh the list and try again.",
    INVITE_REVOKED: "This invite is revoked. Restore it before resending.",
    INVITE_ALREADY_REGISTERED: "This person has already registered — nothing to resend or revoke.",
    INVITE_PROCESSING: "This invite is currently being sent. Wait for it to finish before retrying.",
    SCHEMA_MIGRATION_PENDING: "This action is temporarily unavailable pending a server update. Please try again shortly.",
  };
  const codeMessage = typeof responseData?.code === "string"
    ? codeMessages[responseData.code.toUpperCase()]
    : undefined;

  // Stable codes take priority so UX copy does not depend on server wording.
  const rootMessage =
    codeMessage ||
    (typeof responseData?.message === "string" && responseData.message) ||
    (typeof responseData?.error === "string" && responseData.error);
  if (rootMessage) {
    toast.error(`${rootMessage}${requestId}`);
    return;
  }

  // Tier 2: Array-mapped field validation errors (Spring Boot / NestJS validation)
  if (Array.isArray(responseData?.errors)) {
    const fieldMessages = (responseData.errors as any[])
      .map((err) => `${err.field || "Field"}: ${err.message}`)
      .join(" | ");
    toast.error(`Validation Failure: ${fieldMessages}`, { duration: 5000 });
    return;
  }

  // Tier 3: HTTP status code fallbacks when the response payload is blank
  if (error?.response?.status === 400) {
    toast.error(
      "Bad request (400): The server rejected the payload. Check field names and values."
    );
    return;
  }

  if (error?.response?.status === 403) {
    toast.error("Access denied (403): Your account does not have permission for this action.");
    return;
  }

  if (error?.response?.status === 409) {
    toast.error("The requested change conflicts with the resource's current state.");
    return;
  }

  if (error?.response?.status === 503) {
    toast.error(`The service is temporarily unavailable.${requestId}`, { duration: 6000 });
    return;
  }

  if (error?.response?.status === 500) {
    // Try to surface the actual Spring Boot / NestJS error message buried in the 500 body
    const serverMsg =
      responseData?.message ||
      responseData?.error ||
      responseData?.detail ||
      (typeof responseData === "string" ? responseData : null);
    toast.error(
      serverMsg
        ? `Server error: ${serverMsg}`
        : "Server error (500). Check the browser console for details.",
      { duration: 6000 }
    );
    return;
  }

  // Tier 4: Default fallback
  toast.error(defaultFallback);
}

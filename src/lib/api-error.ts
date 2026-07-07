import { toast } from "sonner";

/**
 * Unified API error parser for all React Query onError blocks.
 *
 * Tier priority (highest → lowest):
 *  1. Explicit server root-level `message` string
 *  2. Structured field-validation `errors[]` array (Spring Boot / NestJS format)
 *  3. HTTP status code fallbacks (400, 403)
 *  4. Supplied `defaultFallback` string
 */
export function parseAndToastApiError(
  error: any,
  defaultFallback = "An unexpected error occurred."
): void {
  console.error("🔴 [Debug API Error Context]:", error);

  const responseData = error?.response?.data;

  // Tier 1: Explicit server root-level message
  if (responseData?.message && typeof responseData.message === "string") {
    toast.error(responseData.message);
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

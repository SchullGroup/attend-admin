export const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  EVENT:                              "#2563eb",
  EVENT_REMINDER:                     "#2563eb",
  RSVP_CONFIRMED:                     "#16a34a",
  RSVP_CONFIRMATION:                  "#16a34a",
  VOTE:                               "#7c22c9",
  PROXY_VOTE_CAST:                    "#7c22c9",
  PROXY_VOTE_BATCH_CAST:              "#7c22c9",
  DOCUMENT:                           "#f59e0b",
  APPLICATION:                        "#16a34a",
  HACKATHON_APPLIED:                  "#16a34a",
  CHALLENGE_APPLICATION_SUBMITTED:    "#16a34a",
  BROADCAST:                          "#0891b2",
  ANNOUNCEMENT:                       "#0891b2",
  SYSTEM:                             "#6b7280",
};

export function notificationTypeColor(type?: string): string {
  return NOTIFICATION_TYPE_COLORS[type?.toUpperCase() ?? ""] ?? "#374151";
}

export function notificationTypeInitial(type?: string): string {
  return (type ?? "N").charAt(0).toUpperCase();
}
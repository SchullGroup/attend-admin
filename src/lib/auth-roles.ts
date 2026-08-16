/**
 * Roles that are allowed to use the Attend Admin portal.
 *
 * The authentication service is shared with the attendee platform, so a valid
 * token does not necessarily mean that the user belongs in this application.
 * Keep this allowlist explicit and fail closed when a new backend role is
 * introduced.
 */
export const ATTEND_ADMIN_ROLES = new Set([
  "super_admin",
  "superadmin",
  "client_admin",
  "admin",
  "event_manager",
  "kyc_officer",
  "viewer",
  "judge",
]);

export const UNSUPPORTED_PORTAL_ROLE_MESSAGE =
  "Access denied. This account does not have access to the Attend Admin Portal.";

export function normalizeAuthRole(role: unknown): string {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

/** Extract role values from the response shapes used by the auth service. */
export function getAuthRoles(payload: unknown): string[] {
  const value = (payload ?? {}) as Record<string, unknown>;
  const nestedUser = (value.user ?? value.account) as Record<string, unknown> | undefined;
  const rawRoles = [
    ...(Array.isArray(value.roles) ? value.roles : []),
    ...(value.role !== undefined ? [value.role] : []),
    ...(Array.isArray(nestedUser?.roles) ? nestedUser.roles : []),
    ...(nestedUser?.role !== undefined ? [nestedUser.role] : []),
  ];

  return rawRoles.map(normalizeAuthRole).filter(Boolean);
}

export function hasAttendAdminRole(payload: unknown): boolean {
  return getAuthRoles(payload).some((role) => ATTEND_ADMIN_ROLES.has(role));
}
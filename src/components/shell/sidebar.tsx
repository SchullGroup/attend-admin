"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Radio,
  Vote,
  Lightbulb,
  FileText as FileApp,
  Star,
  Users,
  FolderOpen,
  BarChart3,
  Settings,
  UserCog,
  LogOut,
  Building2,
  ClipboardList,
  QrCode,
  PlusCircle,
  ScrollText,
  Users2,
  Bell,
} from "lucide-react";
import { cn, resolveRole, isSuperAdminRole } from "@/lib/utils";
import { useGetMe, useLogout } from "@/api/auth/hooks";
import { useClientStakeholder } from "@/api/client-organisation";
import { usePendingEnrollments } from "@/api/super-admin";
import Cookies from "js-cookie";

const JUDGE_ROLES  = new Set(["judge"]);

// ─── RBAC permission engine ──────────────────────────────────────────────────
//
// Each "action" maps to the set of non-super-admin roles that MAY see it.
// Super Admin visibility is handled separately via `superAdminOnly` / `clientOnly`
// section/item flags.  Any role not listed falls back to `client_admin` access.

type PermAction =
  | "create_event"       // Create Event link
  | "live_control_room"  // Live Control Room link
  | "enrol_register";    // Enrol Register link (client-side /registers/enrol)

const PERMITTED_ROLES: Record<PermAction, ReadonlySet<string>> = {
  create_event:      new Set(["client_admin", "event_manager"]),
  live_control_room: new Set(["client_admin", "event_manager"]),
  enrol_register:    new Set(["client_admin"]),
};

/**
 * Returns true when `normalizedRole` is allowed to see an item gated by `action`.
 *
 * Rules:
 *  - Super Admin is always excluded from non-admin items via `clientOnly` flags,
 *    so this function is only ever called for client-side roles.
 *  - Unknown roles (e.g. "kyc_officer") fall back to `client_admin` permissions.
 */
function hasAccess(normalizedRole: string, action: PermAction): boolean {
  const allowed = PERMITTED_ROLES[action];
  // If the role is in the explicit map, honour it; otherwise grant full client access.
  const knownClientRoles = new Set(["client_admin", "event_manager", "viewer"]);
  if (!knownClientRoles.has(normalizedRole)) return allowed.has("client_admin");
  return allowed.has(normalizedRole);
}

// ─── Normalisation helper ────────────────────────────────────────────────────

// ─── Nav config ──────────────────────────────────────────────────────────────
//
// `superAdminOnly` — section/item hidden unless role is super_admin
// `clientOnly`     — section/item hidden when role IS super_admin
// `action`         — optional PermAction gate applied to non-super-admin users

type NavItem = {
  title:          string;
  icon:           React.ElementType;
  href:           string;
  superAdminOnly?: boolean;
  clientOnly?:    boolean;
  judgeHidden?:   boolean;  // hide from JUDGE role
  judgeOnly?:     boolean;  // show ONLY to JUDGE role (within client users)
  /** Hide from these specific normalised roles, e.g. ["event_manager"]. */
  hiddenForRoles?: readonly string[];
  action?:        PermAction;
};

type NavSection = {
  label:           string;
  superAdminOnly?: boolean;
  clientOnly?:     boolean;
  judgeHidden?:    boolean;  // hide entire section from JUDGE role
  /** Hide the entire section from these specific normalised roles. */
  hiddenForRoles?: readonly string[];
  items:           NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    label: "Platform",
    items: [{ title: "Dashboard", icon: LayoutDashboard, href: "/" }],
  },
  {
    label: "Platform Events",
    judgeHidden: true,
    items: [
      { title: "Create Event",      icon: PlusCircle,   href: "/events/create", clientOnly: true, action: "create_event" },
      { title: "All Events",        icon: CalendarDays, href: "/events" },
      { title: "Live Control Room", icon: Radio,        href: "/events/live",   clientOnly: true, action: "live_control_room" },
      { title: "QR Check-In",       icon: QrCode,       href: "/events/qr-checkin", clientOnly: true, hiddenForRoles: ["viewer"] },
      { title: "Vote Records",      icon: Vote,         href: "/votes",         clientOnly: true },
    ],
  },
  {
    label: "Innovation Challenges",
    hiddenForRoles: ["event_manager"],
    items: [
      { title: "Challenges",   icon: Lightbulb, href: "/hackathons" },
      { title: "Applications", icon: FileApp,   href: "/hackathons/applications", clientOnly: true, hiddenForRoles: ["viewer"] },
      { title: "Judging",      icon: Star,      href: "/hackathons/judging",      clientOnly: true, hiddenForRoles: ["viewer"] },
    ],
  },
  {
    label: "Registrars",
    superAdminOnly: true,
    items: [
      { title: "All Registrars",  icon: Building2,  href: "/registrars" },
      { title: "Enrol Registrar", icon: PlusCircle, href: "/registrars/enrol" },
    ],
  },
  {
    label: "Registers",
    clientOnly: true,
    judgeHidden: true,
    items: [
      { title: "All Registers",  icon: ClipboardList, href: "/registers" },
      { title: "Enrol Register", icon: UserCog,       href: "/registers/enrol", action: "enrol_register" },
    ],
  },
  {
    label: "People",
    judgeHidden: true,
    items: [
      { title: "All Users",      icon: Users,   href: "/participants",         superAdminOnly: true },
      { title: "Client Admins",  icon: Users2,  href: "/admin/client-admins",  superAdminOnly: true },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Documents",      icon: FolderOpen, href: "/documents",     judgeHidden: true, clientOnly: true },
      { title: "Analytics",      icon: BarChart3,  href: "/analytics",     judgeHidden: true },
      { title: "Notifications",  icon: Bell,       href: "/notifications",  judgeHidden: true, hiddenForRoles: ["viewer"] },
      { title: "Audit Log",      icon: ScrollText, href: "/audit",          judgeHidden: true, hiddenForRoles: ["event_manager", "viewer"] },
      { title: "Settings",       icon: Settings,   href: "/settings" },
      { title: "Team Members",   icon: Users2,     href: "/settings/team",  clientOnly: true, judgeHidden: true },
    ],
  },
];

// ─── Active-link helpers ──────────────────────────────────────────────────────

const ALL_HREFS = [
  ...SECTIONS.flatMap((s) => s.items.map((i) => i.href)),
  "/registrars", "/registrars/enrol",
  "/registers", "/registers/enrol",
  "/settings/team",
  "/votes", "/notifications",
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname !== href && !pathname.startsWith(href + "/")) return false;
  return !ALL_HREFS.some(
    (other) =>
      other !== href &&
      other.startsWith(href + "/") &&
      (pathname === other || pathname.startsWith(other + "/")),
  );
}

// ─── Display helpers ──────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const ROLE_LABELS: Record<string, string> = {
  super_admin:   "Super Admin",
  event_manager: "Event Manager",
  kyc_officer:   "KYC Officer",
  judge:         "Judge",
  viewer:        "Viewer",
  client_admin:  "Client Admin",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  useRouter(); // kept for future programmatic nav
  const { data: userResponse } = useGetMe();
  const currentUser = userResponse?.data;
  const { mutate: logout } = useLogout();

  // Normalise once — used for both section filters and per-item action gates.
  const normalizedRole = resolveRole(currentUser);
  const isSuperAdmin   = isSuperAdminRole(normalizedRole);
  const isJudge        = JUDGE_ROLES.has(normalizedRole);

  // Only fire super_admin-only endpoint when we know the user has that role
  const { data: pendingEnrollmentsData } = usePendingEnrollments(0, 1, isSuperAdmin);

  // Stakeholder logo — for client users whose avatarUrl is null
  const { data: stakeholder } = useClientStakeholder({ enabled: !!currentUser && !isSuperAdminRole(resolveRole(currentUser)) });
  const pendingCount = pendingEnrollmentsData?.data?.totalCount ?? 0;

  const hasToken      = typeof window !== "undefined" && !!Cookies.get("accessToken");
  // logoUrl persisted at login time (me endpoint may not return it)
  const storedLogoUrl = typeof window !== "undefined" ? (localStorage.getItem("userLogoUrl") ?? null) : null;
  // For client users show the registrar/organisation name; for admins/judges use personal name
  const isClientUser  = !isSuperAdmin && !isJudge;
  const displayName   = isClientUser
    ? (stakeholder?.name || currentUser?.fullName || "Admin User")
    : (currentUser?.fullName || "Admin User");
  const displayRole   = currentUser?.role
    ? (ROLE_LABELS[normalizedRole] ?? currentUser.role)
    : "Administrator";
  const displayInitials = currentUser?.initials || getInitials(displayName);

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-screen w-[272px] flex flex-col"
      style={{ backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0" }}
    >
      {/* Logo */}
      <div
        className="flex items-center px-5 shrink-0"
        style={{ borderBottom: "1px solid #e2e8f0", minHeight: 72 }}
      >
        <div className="flex items-center gap-2">
          <img src="/attend-logo.png" alt="Attend" style={{ height: 26, width: "auto" }} />
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "rgba(17,24,39,0.07)", color: "#6b7280" }}
          >
            Admin
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-5">
        {SECTIONS.map((section) => {
          // Section-level role gates
          if (section.superAdminOnly && !isSuperAdmin) return null;
          if (section.clientOnly     &&  isSuperAdmin) return null;
          if (section.judgeHidden    &&  isJudge)      return null;
          if (section.hiddenForRoles?.includes(normalizedRole)) return null;

          // Item-level role gates
          const visibleItems = section.items.filter((item) => {
            if (item.superAdminOnly && !isSuperAdmin) return false;
            if (item.clientOnly     &&  isSuperAdmin) return false;
            if (item.judgeHidden    &&  isJudge)      return false;
            if (item.judgeOnly      && !isJudge)      return false;
            if (item.hiddenForRoles?.includes(normalizedRole)) return false;
            // Action gate: only apply for non-super-admin users
            if (item.action && !isSuperAdmin && !hasAccess(normalizedRole, item.action)) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              <p
                className="px-3 mb-1 text-xs font-semibold uppercase tracking-widest"
                style={{ color: "#94a3b8" }}
              >
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "font-medium" : "font-normal",
                      )}
                      style={{
                        color:           active ? "#111827" : "#6b7280",
                        backgroundColor: active ? "rgba(17,24,39,0.07)" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(17,24,39,0.04)";
                          (e.currentTarget as HTMLElement).style.color = "#374151";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "#6b7280";
                        }
                      }}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                          style={{ backgroundColor: "#111827" }}
                        />
                      )}
                      <item.icon
                        className="h-4 w-4 shrink-0"
                        style={{ color: active ? "#111827" : "#9ca3af" }}
                      />
                      {item.title}

                      {/* Live pulse indicator */}
                      {item.href === "/events/live" && (
                        <span
                          className="ml-auto h-2 w-2 rounded-full"
                          style={{ backgroundColor: "#ef4444" }}
                        />
                      )}

                      {/* Pending-register badge */}
                      {item.href === "/registers/enrol" && pendingCount > 0 && (
                        <span
                          className="ml-auto h-4 min-w-4 px-1 rounded-full text-xs font-bold flex items-center justify-center"
                          style={{ backgroundColor: "#f59e0b", color: "white" }}
                        >
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      {hasToken && (
        <div className="p-3 shrink-0" style={{ borderTop: "1px solid #e2e8f0" }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            {(currentUser?.avatarUrl || currentUser?.logoUrl || storedLogoUrl || stakeholder?.logoUrl) ? (
              <img
                src={(currentUser?.avatarUrl || currentUser?.logoUrl || storedLogoUrl || stakeholder?.logoUrl)!}
                alt={displayName}
                className="h-8 w-8 rounded-full object-cover shrink-0 ring-2 ring-[hsl(var(--border))]"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: "rgba(17,24,39,0.10)", color: "#111827" }}
              >
                {displayInitials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: "#9ca3af" }}>
                {displayRole}
              </p>
            </div>
            <button
              onClick={() => logout()}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "#9ca3af" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(17,24,39,0.06)";
                (e.currentTarget as HTMLElement).style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                (e.currentTarget as HTMLElement).style.color = "#9ca3af";
              }}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

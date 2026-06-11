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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetMe, useLogout } from "@/api/auth/hooks";
import { usePendingEnrollments } from "@/api/super-admin";
import Cookies from "js-cookie";

/**
 * `superAdminOnly: true`  — item/section is hidden unless the user has SUPER_ADMIN role.
 * Sections with all items hidden are automatically omitted from the nav.
 */
const SECTIONS = [
  {
    label: "Platform",
    items: [{ title: "Dashboard", icon: LayoutDashboard, href: "/" }],
  },
  {
    label: "Platform Events",
    items: [
      // Create Event is hidden for super admin — they don't own events directly
      { title: "Create Event",      icon: PlusCircle,   href: "/events/create", clientOnly: true },
      { title: "All Events",        icon: CalendarDays, href: "/events" },
      { title: "Live Control Room", icon: Radio,        href: "/events/live" },
      { title: "QR Check-In",       icon: QrCode,       href: "/events/qr-checkin" },
      { title: "Vote Results",      icon: Vote,         href: "/events/votes" },
    ],
  },
  {
    label: "Innovation Challenges",
    items: [
      { title: "Challenges",   icon: Lightbulb, href: "/hackathons" },
      { title: "Applications", icon: FileApp,   href: "/hackathons/applications" },
      { title: "Judging",      icon: Star,      href: "/hackathons/judging" },
    ],
  },
  {
    // RBAC: Registrars are the managing firms — SUPER_ADMIN visibility only
    label: "Registrars",
    superAdminOnly: true,
    items: [
      { title: "All Registrars",  icon: Building2, href: "/registrars" },
      { title: "Enrol Registrar", icon: PlusCircle, href: "/registrars/enrol" },
    ],
  },
  {
    // RBAC: Registers are client-scoped organisations — hidden from SUPER_ADMIN
    label: "Registers",
    clientOnly: true,
    items: [
      { title: "All Registers", icon: ClipboardList, href: "/registers" },
      { title: "Enrol Register", icon: UserCog, href: "/registers/enrol" },
    ],
  },
  {
    label: "People",
    items: [
      // RBAC: cross-tenant user roster — SUPER_ADMIN only
      { title: "All Users", icon: Users, href: "/participants", superAdminOnly: true },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Documents",    icon: FolderOpen, href: "/documents" },
      { title: "Analytics",    icon: BarChart3,  href: "/analytics" },
      { title: "Audit Log",    icon: ScrollText, href: "/audit" },
      { title: "Settings",     icon: Settings,   href: "/settings" },
      // Team Members shown only to client/non-super-admin users
      { title: "Team Members", icon: Users2,     href: "/settings/team", clientOnly: true },
    ],
  },
] as Array<{
  label:           string;
  superAdminOnly?: boolean;
  clientOnly?:     boolean;
  items:           Array<{ title: string; icon: React.ElementType; href: string; superAdminOnly?: boolean; clientOnly?: boolean }>;
}>;

const ALL_HREFS = [
  ...SECTIONS.flatMap((s) => s.items.map((i) => i.href)),
  "/registrars",
  "/registrars/enrol",
  "/registers",
  "/registers/enrol",
  "/settings/team",
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const roleLabel: Record<string, string> = {
  super_admin:  "Super Admin",
  SUPER_ADMIN:  "Super Admin",
  event_manager:"Event Manager",
  EVENT_MANAGER:"Event Manager",
  kyc_officer:  "KYC Officer",
  KYC_OFFICER:  "KYC Officer",
  judge:        "Judge",
  JUDGE:        "Judge",
};

/** Normalise any role string to lowercase for consistent comparison. */
function isSuperAdminRole(role?: string | null): boolean {
  return (role ?? "").toLowerCase().replace(/[-\s]/g, "_") === "super_admin";
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: userResponse } = useGetMe();
  const currentUser = userResponse?.data;
  const { mutate: logout } = useLogout();
  
  const { data: pendingEnrollmentsData } = usePendingEnrollments(0, 1);
  const pendingCount = pendingEnrollmentsData?.data?.totalCount ?? 0;

  /**
   * SUPER_ADMIN check — handles all casing variants the backend may return:
   * "super_admin", "SUPER_ADMIN", "Super_Admin", "super-admin", etc.
   * While user is loading (currentUser === undefined), default to false
   * so privileged sections render correctly once the token is verified.
   */
  const isSuperAdmin = isSuperAdminRole(currentUser?.role);

  const hasToken = typeof window !== "undefined" && !!Cookies.get("accessToken");
  const displayName = currentUser?.fullName || "Admin User";
  const displayRole = currentUser?.role ? (roleLabel[currentUser.role] ?? currentUser.role) : "Administrator";
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
          // RBAC: hide section based on role flags
          if (section.superAdminOnly && !isSuperAdmin) return null;  // e.g. Registrars
          if (section.clientOnly     &&  isSuperAdmin) return null;  // e.g. Registers

          // Filter individual items by role flags
          const visibleItems = section.items.filter((item) => {
            if (item.superAdminOnly && !isSuperAdmin) return false; // requires super admin
            if (item.clientOnly     &&  isSuperAdmin) return false; // hidden for super admin
            return true;
          });
          // If all items in this section are hidden, omit the section header too
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
                      color: active ? "#111827" : "#6b7280",
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
                    {item.href === "/events/live" && (
                      <span
                        className="ml-auto h-2 w-2 rounded-full"
                        style={{ backgroundColor: "#ef4444" }}
                      />
                    )}
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

      {hasToken && (
        <div
          className="p-3 shrink-0"
          style={{ borderTop: "1px solid #e2e8f0" }}
        >
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                backgroundColor: "rgba(17,24,39,0.10)",
                color: "#111827",
              }}
            >
              {displayInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
                {displayName}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "#9ca3af" }}
              >
                {displayRole}
              </p>
            </div>
            <button
              onClick={() => {
                logout();
              }}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "#9ca3af" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "rgba(17,24,39,0.06)";
                (e.currentTarget as HTMLElement).style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
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

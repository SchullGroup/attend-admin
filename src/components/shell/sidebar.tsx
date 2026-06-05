"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, Radio, Vote,
  Lightbulb, FileText as FileApp, Star, Users, Users2,
  FolderOpen, BarChart3, Settings, UserCog, LogOut,
  Building2, ClipboardList, QrCode, ScrollText, PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

const SECTIONS = [
  {
    label: "Platform",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, href: "/" },
    ],
  },
  {
    label: "Platform Events",
    items: [
      { title: "Create Event", icon: PlusCircle, href: "/events/create" },
      { title: "All Events", icon: CalendarDays, href: "/events" },
      { title: "Live Control Room", icon: Radio, href: "/events/live" },
      { title: "QR Check-In", icon: QrCode, href: "/events/qr-checkin" },
      { title: "Vote Results", icon: Vote, href: "/events/votes" },
    ],
  },
  {
    label: "Innovation Challenges",
    items: [
      { title: "Challenges", icon: Lightbulb, href: "/hackathons" },
      { title: "Applications", icon: FileApp, href: "/hackathons/applications" },
      { title: "Judging", icon: Star, href: "/hackathons/judging" },
    ],
  },
  {
    label: "Organisers",
    items: [
      { title: "All Organisers", icon: Building2, href: "/organisers" },
      { title: "Pending Enrollments", icon: ClipboardList, href: "/organisers/pending" },
    ],
  },
  {
    label: "People",
    items: [
      { title: "All Users", icon: Users, href: "/participants" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Documents", icon: FolderOpen, href: "/documents" },
      { title: "Analytics", icon: BarChart3, href: "/analytics" },
      { title: "Audit Log", icon: ScrollText, href: "/audit" },
      { title: "Settings", icon: Settings, href: "/settings" },
      { title: "Roles & Access", icon: UserCog, href: "/settings/roles" },
      { title: "Team Members", icon: Users2, href: "/settings/team" },
    ],
  },
];

const ALL_HREFS = [
  ...SECTIONS.flatMap((s) => s.items.map((i) => i.href)),
  "/organisers",
  "/organisers/pending",
  "/settings/team",
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (pathname !== href && !pathname.startsWith(href + "/")) return false;
  return !ALL_HREFS.some(
    (other) => other !== href && other.startsWith(href + "/") && (pathname === other || pathname.startsWith(other + "/"))
  );
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  event_manager: "Event Manager",
  kyc_officer: "KYC Officer",
  judge: "Judge",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout, organisers } = useStore();
  const pendingCount = organisers.filter((s) => s.status === "pending").length;

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
          <img src="/attend-logo.png" alt="Attend" style={{ height: 20, width: "auto" }} />
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
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p
              className="px-3 mb-1 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#94a3b8" }}
            >
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "font-medium" : "font-normal"
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
                    {item.href === "/organisers/pending" && pendingCount > 0 && (
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
        ))}
      </nav>

      {/* User footer */}
      {currentUser && (
        <div
          className="p-3 shrink-0"
          style={{ borderTop: "1px solid #e2e8f0" }}
        >
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "rgba(17,24,39,0.10)", color: "#111827" }}
            >
              {getInitials(currentUser.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>{currentUser.name}</p>
              <p className="text-xs truncate" style={{ color: "#9ca3af" }}>
                {roleLabel[currentUser.role] ?? currentUser.role}
              </p>
            </div>
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "#9ca3af" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(17,24,39,0.06)"; (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "#9ca3af"; }}
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

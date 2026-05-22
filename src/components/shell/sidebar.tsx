"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarDays, PlusCircle, Radio, Vote,
  Lightbulb, FileText as FileApp, Star, Users, ShieldCheck,
  FolderOpen, BarChart3, Settings, UserCog, LogOut,
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
    label: "Events",
    items: [
      { title: "All Events", icon: CalendarDays, href: "/events" },
      { title: "Create Event", icon: PlusCircle, href: "/events/create" },
      { title: "Live Control Room", icon: Radio, href: "/events/live" },
      { title: "Vote Results", icon: Vote, href: "/events/votes" },
    ],
  },
  {
    label: "Hackathons",
    items: [
      { title: "Challenges", icon: Lightbulb, href: "/hackathons" },
      { title: "Applications", icon: FileApp, href: "/hackathons/applications" },
      { title: "Judging", icon: Star, href: "/hackathons/judging" },
    ],
  },
  {
    label: "People",
    items: [
      { title: "All Participants", icon: Users, href: "/participants" },
      { title: "KYC Queue", icon: ShieldCheck, href: "/participants/kyc" },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Documents", icon: FolderOpen, href: "/documents" },
      { title: "Analytics", icon: BarChart3, href: "/analytics" },
      { title: "Settings", icon: Settings, href: "/settings" },
      { title: "Roles & Access", icon: UserCog, href: "/settings/roles" },
    ],
  },
];

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
  const { currentUser, logout } = useStore();

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-screen w-[272px] flex flex-col"
      style={{ backgroundColor: "#0f172a" }}
    >
      {/* Logo */}
      <div
        className="h-14 flex items-center px-5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1a6b3c" }}
          >
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-white tracking-tight">Attend</span>
            <span className="text-[11px] font-medium" style={{ color: "#4ade80" }}>Admin</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p
              className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.28)" }}
            >
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors group",
                      isActive
                        ? "font-medium"
                        : "font-normal"
                    )}
                    style={{
                      color: isActive ? "#ffffff" : "rgba(255,255,255,0.5)",
                      backgroundColor: isActive ? "rgba(255,255,255,0.09)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.05)";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)";
                      }
                    }}
                  >
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                        style={{ backgroundColor: "#4ade80" }}
                      />
                    )}
                    <item.icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: isActive ? "#4ade80" : "rgba(255,255,255,0.4)" }}
                    />
                    {item.title}
                    {item.href === "/events/live" && (
                      <span
                        className="ml-auto h-2 w-2 rounded-full"
                        style={{ backgroundColor: "#ef4444" }}
                      />
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
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "rgba(26,107,60,0.35)", color: "#4ade80" }}
            >
              {getInitials(currentUser.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{currentUser.name}</p>
              <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                {roleLabel[currentUser.role] ?? currentUser.role}
              </p>
            </div>
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "rgba(255,255,255,0.35)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#f87171"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
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

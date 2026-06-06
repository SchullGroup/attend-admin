"use client";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useGetMe, useLogout } from "@/api/auth/hooks";
import { useNotifications, useMarkNotificationRead } from "@/api/super-admin";
import { timeAgo } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/events": "All Events",
  "/events/create": "Create Event",
  "/events/live": "Live Control Room",
  "/events/votes": "Vote Results",
  "/hackathons": "Challenges",
  "/hackathons/applications": "Applications",
  "/hackathons/judging": "Judging",
  "/participants": "All Users",
  "/participants/kyc": "KYC Queue",
  "/documents": "Document Vault",
  "/analytics": "Analytics",
  "/settings": "Platform Settings",
  "/settings/roles": "Roles & Access",
};

function getBreadcrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Dashboard", href: "/" }];

  const crumbs = [{ label: "Dashboard", href: "/" }];
  let current = "";
  for (const part of parts) {
    current += "/" + part;
    const label =
      ROUTE_LABELS[current] ?? part.charAt(0).toUpperCase() + part.slice(1);
    crumbs.push({ label, href: current });
  }
  return crumbs;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: userResponse } = useGetMe();
  const currentUser = userResponse?.data;
  const { mutate: logout } = useLogout();
  const breadcrumbs = getBreadcrumbs(pathname);

  // Live Notifications
  const { data: unreadData } = useNotifications(0, 1, false);
  const unreadCount = unreadData?.data?.totalElements ?? 0;
  const { data: notificationsData } = useNotifications(0, 5);
  const notifications = notificationsData?.data?.content || [];
  const { mutate: markAsRead } = useMarkNotificationRead();

  function handleLogout() {
    logout();
  }

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.95)] backdrop-blur px-6 gap-4">
      <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            )}
            <span
              className={
                i === breadcrumbs.length - 1
                  ? "font-semibold text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </div>

      <div className="hidden md:flex items-center relative w-full max-w-md">
        <Search className="absolute left-3 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
        <Input
          placeholder="Search events, participants..."
          className="pl-9 h-8 text-sm bg-[hsl(var(--muted))] border-transparent focus:bg-white focus:border-[hsl(var(--border))]"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-8 w-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] flex items-center justify-between">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-[hsl(var(--border))]">
              {notifications.length > 0 ? (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markAsRead(n.id);
                    }}
                    className={`p-3 text-left transition-colors cursor-pointer hover:bg-[hsl(var(--muted)/0.4)] ${!n.read ? "bg-[hsl(var(--primary)/0.03)]" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs ${!n.read ? "font-semibold text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))/0.8] mt-1 block">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
                  No notifications.
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none">
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarFallback className="text-xs">
                    {currentUser.initials || getInitials(currentUser.fullName)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>{currentUser.fullName}</DropdownMenuLabel>
              <DropdownMenuLabel className="font-normal -mt-1">
                {currentUser.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

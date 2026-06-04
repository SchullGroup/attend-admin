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
import { useStore } from "@/lib/store";
import { useGetMe, useLogout } from "@/api/auth/hooks";

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
        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
          <Bell className="h-4 w-4" />
        </button>

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

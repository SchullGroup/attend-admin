"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, Search, ChevronRight, CalendarDays, Users, Building2, X } from "lucide-react";
import { NOTIFICATION_SOUND_KEY } from "@/app/(dashboard)/settings/page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useGetMe, useLogout } from "@/api/auth/hooks";
import { useClientStakeholder } from "@/api/client-organisation";
import {
  useAdminNotifications,
  useMarkNotificationRead,
  useClientNotifications,
  useMarkClientNotificationRead,
} from "@/api/notifications";
import { useGlobalSearch } from "@/api/super-admin";
import { timeAgo } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Admin roles set (mirrors events/[id]/page.tsx logic)
// ---------------------------------------------------------------------------
const ADMIN_ROLES = new Set(["super_admin", "admin", "superadmin", "super-admin"]);

// ---------------------------------------------------------------------------
// Web Audio notification chime
// ---------------------------------------------------------------------------
function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Two-tone soft chime: E5 then G#5
    const notes = [659.25, 830.61];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      osc.start(start);
      osc.stop(start + 0.55);
    });
  } catch {
    // AudioContext not available (SSR or blocked)
  }
}

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
  "/votes": "Vote Records",
  "/notifications": "Notifications",
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
    const label = ROUTE_LABELS[current] ?? part.charAt(0).toUpperCase() + part.slice(1);
    crumbs.push({ label, href: current });
  }
  return crumbs;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// Simple debounce hook
function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function Header() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { data: userResponse } = useGetMe();
  const currentUser = userResponse?.data;
  const { mutate: logout } = useLogout();
  const breadcrumbs = getBreadcrumbs(pathname);

  // ── Search state ───────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [searchOpen, setSearchOpen]   = useState(false);
  const debouncedQ = useDebounce(searchInput, 350);
  const searchRef  = useRef<HTMLDivElement>(null);

  // Rule 3: q param bound via params: { q } inside the hook
  const { data: searchResults, isFetching: searching } = useGlobalSearch({
    q: debouncedQ,
    limit: 5,
  });

  // Rule 2: unwrap the three grouped arrays from the payload
  const resultEvents       = searchResults?.events       || [];
  const resultParticipants = searchResults?.participants  || [];
  const resultStakeholders = searchResults?.stakeholders  || [];
  const hasResults = resultEvents.length + resultParticipants.length + resultStakeholders.length > 0;
  const totalResults = searchResults?.totalResults ?? 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSearchNav(href: string) {
    setSearchOpen(false);
    setSearchInput("");
    router.push(href);
  }

  // ── Role detection (for picking the right notifications endpoint) ──────────
  const isAdmin = ADMIN_ROLES.has(currentUser?.role?.toLowerCase() ?? "");

  // ── Stakeholder logo for client users ──────────────────────────────────────
  const { data: stakeholder } = useClientStakeholder({ enabled: !!currentUser && !isAdmin });
  const avatarSrc = currentUser?.avatarUrl || (currentUser as any)?.logoUrl || stakeholder?.logoUrl || null;

  // ── Admin notifications ────────────────────────────────────────────────────
  const { data: adminUnreadData } = useAdminNotifications(0, 1, false);
  const { data: adminNotifData  } = useAdminNotifications(0, 5);
  const { mutate: markAdminRead } = useMarkNotificationRead();

  // ── Client notifications ───────────────────────────────────────────────────
  const { data: clientNotifData  } = useClientNotifications(0, 5);
  const { mutate: markClientRead } = useMarkClientNotificationRead();

  // ── Unified values ─────────────────────────────────────────────────────────
  const unreadCount = isAdmin
    ? (adminUnreadData?.data?.totalElements ?? 0)
    : (clientNotifData?.unreadCount ?? 0);

  const notifications: any[] = isAdmin
    ? (adminNotifData?.data?.content ?? [])
    : (clientNotifData?.notifications ?? []);

  function markAsRead(id: string) {
    if (isAdmin) markAdminRead(id);
    else         markClientRead(id);
  }

  // ── Notification sound — chime when unread count increases ─────────────────
  const prevUnread = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      const soundEnabled = localStorage.getItem(NOTIFICATION_SOUND_KEY) !== "false";
      if (soundEnabled) playNotificationChime();
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  function handleLogout() { logout(); }

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/0.95)] backdrop-blur px-6 gap-4">

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm min-w-0 flex-1">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />}
            <span className={i === breadcrumbs.length - 1 ? "font-semibold text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}>
              {crumb.label}
            </span>
          </span>
        ))}
      </div>

      {/* ── Global Search ──────────────────────────────────────────────────── */}
      <div ref={searchRef} className="hidden md:flex items-center relative w-full max-w-md">
        <Search className="absolute left-3 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none z-10" />
        <Input
          placeholder="Search events, participants, organisations…"
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setSearchOpen(true); }}
          onFocus={() => { if (searchInput) setSearchOpen(true); }}
          className="pl-9 pr-8 h-8 text-sm bg-[hsl(var(--muted))] border-transparent focus:bg-white focus:border-[hsl(var(--border))]"
        />
        {searchInput && (
          <button
            onClick={() => { setSearchInput(""); setSearchOpen(false); }}
            className="absolute right-2 h-4 w-4 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Results dropdown */}
        {searchOpen && debouncedQ.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[hsl(var(--border))] rounded-xl shadow-lg z-50 overflow-hidden max-h-[420px] overflow-y-auto">

            {/* Status bar */}
            <div className="px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] flex items-center justify-between">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {searching ? "Searching…" : hasResults ? `${totalResults} result${totalResults !== 1 ? "s" : ""}` : "No results"}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">"{debouncedQ}"</span>
            </div>

            {!searching && !hasResults && (
              <div className="py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">
                No matches for "{debouncedQ}"
              </div>
            )}

            {/* Events group */}
            {resultEvents.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Events</span>
                </div>
                {resultEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleSearchNav(`/events/${e.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.5)] transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{e.title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{e.date}</p>
                    </div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 capitalize">{e.status?.toLowerCase()}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Participants group */}
            {resultParticipants.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 border-t border-[hsl(var(--border)/0.5)]">
                  <Users className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Participants</span>
                </div>
                {resultParticipants.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSearchNav(`/participants/${p.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.5)] transition-colors text-left"
                  >
                    <div className="h-7 w-7 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))] shrink-0">
                      {p.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{p.fullName}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{p.email}</p>
                    </div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] capitalize shrink-0">{p.kycStatus?.toLowerCase()}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Stakeholders group */}
            {resultStakeholders.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 border-t border-[hsl(var(--border)/0.5)]">
                  <Building2 className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Organisations</span>
                </div>
                {resultStakeholders.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSearchNav(`/registers/${s.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.5)] transition-colors text-left"
                  >
                    <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{s.name}</p>
                      {s.industry && <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.industry}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Notifications */}
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
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">{unreadCount} new</span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-[hsl(var(--border))]">
              {notifications.length > 0 ? (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => { if (!n.read) markAsRead(n.id as string); }}
                    className={`p-3 cursor-pointer hover:bg-[hsl(var(--muted)/0.4)] transition-colors ${!n.read ? "bg-[hsl(var(--primary)/0.03)]" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs ${!n.read ? "font-semibold text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}`}>{n.title}</p>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 mt-1" />}
                    </div>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{n.message}</p>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 block">{timeAgo(n.createdAt)}</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[hsl(var(--muted-foreground))]">No notifications.</div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar */}
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none">
                <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-[hsl(var(--border))]">
                  {avatarSrc && (
                    <AvatarImage src={avatarSrc} alt={currentUser.fullName} className="object-cover" />
                  )}
                  <AvatarFallback className="text-xs bg-[hsl(var(--foreground)/0.1)] text-[hsl(var(--foreground))]">
                    {currentUser.initials || getInitials(currentUser.fullName)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[hsl(var(--border))]">
                <Avatar className="h-9 w-9 shrink-0">
                  {avatarSrc && (
                    <AvatarImage src={avatarSrc} alt={currentUser.fullName} className="object-cover" />
                  )}
                  <AvatarFallback className="text-xs bg-[hsl(var(--foreground)/0.1)] text-[hsl(var(--foreground))]">
                    {currentUser.initials || getInitials(currentUser.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{currentUser.fullName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{currentUser.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}

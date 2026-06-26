"use client";
import { useState } from "react";
import { Bell, BellOff, CheckCheck, X } from "lucide-react";
import { useGetMe } from "@/api/auth/hooks";
import {
  useAdminNotifications,
  useMarkNotificationRead,
  useClientNotifications,
  useMarkClientNotificationRead,
  ClientNotificationItem,
} from "@/api/notifications";
import {
  useJudgeNotifications,
  useMarkJudgeNotificationRead,
} from "@/api/judge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/Loader";
import { timeAgo, resolveRole } from "@/lib/utils";

const ADMIN_ROLES = new Set(["super_admin", "admin", "superadmin", "super-admin"]);
const JUDGE_ROLES = new Set(["judge"]);

// Notification type → accent color
const TYPE_COLORS: Record<string, string> = {
  EVENT:          "#2563eb",
  VOTE:           "#7c22c9",
  DOCUMENT:       "#f59e0b",
  APPLICATION:    "#16a34a",
  SYSTEM:         "#6b7280",
  ANNOUNCEMENT:   "#0891b2",
};

function typeColor(type: string) {
  return TYPE_COLORS[type?.toUpperCase()] ?? "#374151";
}

function typeInitial(type: string) {
  return (type ?? "N").charAt(0).toUpperCase();
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------
function DetailPanel({
  notification,
  onClose,
}: {
  notification: ClientNotificationItem | any;
  onClose: () => void;
}) {
  const color = typeColor(notification.type);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
        <span className="font-semibold text-sm text-[hsl(var(--foreground))]">Notification</span>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] transition-colors"
        >
          <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        </button>
      </div>
      <div className="p-5 flex-1 overflow-y-auto">
        {/* Type badge */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
            style={{ backgroundColor: color + "18", color }}
          >
            {typeInitial(notification.type)}
          </div>
          <div>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: color + "18", color }}
            >
              {notification.type ?? "NOTIFICATION"}
            </span>
            <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
              {timeAgo(notification.createdAt)}
            </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-base font-bold text-[hsl(var(--foreground))] mb-3">
          {notification.title}
        </h2>

        {/* Body */}
        <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">
          {notification.message}
        </p>

        {/* Reference */}
        {notification.referenceId && (
          <div className="mt-5 pt-4 border-t border-[hsl(var(--border))]">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Reference ID</div>
            <div className="text-xs font-mono text-[hsl(var(--foreground))] mt-0.5 break-all">
              {notification.referenceId}
            </div>
          </div>
        )}

        {/* Read status */}
        {notification.read && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <CheckCheck className="h-3.5 w-3.5 text-green-500" />
            Read
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function NotificationsPage() {
  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const role    = resolveRole(userResponse?.data);
  const isAdmin = !userLoading && ADMIN_ROLES.has(role);
  const isJudge = !userLoading && JUDGE_ROLES.has(role);

  const [filter,   setFilter]   = useState<"all" | "unread">("all");
  const [page,     setPage]     = useState(0);
  const [selected, setSelected] = useState<any | null>(null);
  const limit = 20;

  // Admin hooks — only enabled once we know the user is an admin
  const { data: adminData,  isLoading: adminLoading  } = useAdminNotifications(
    page, limit, filter === "unread" ? false : undefined, !userLoading && isAdmin
  );
  const { mutate: markAdmin } = useMarkNotificationRead();

  // Client hooks
  const { data: clientData, isLoading: clientLoading } = useClientNotifications(
    page, limit, filter === "unread" ? false : undefined
  );
  const { mutate: markClient } = useMarkClientNotificationRead();

  // Judge hooks
  const { data: judgeData,  isLoading: judgeLoading  } = useJudgeNotifications(
    page, limit, filter === "unread" ? false : undefined
  );
  const { mutate: markJudge } = useMarkJudgeNotificationRead();

  const isLoading = userLoading || (
    isAdmin ? adminLoading : isJudge ? judgeLoading : clientLoading
  );

  // Unified list — route by role; fall back to `content` if backend uses Spring Page shape
  const notifications: any[] = isAdmin
    ? (adminData?.notifications ?? (adminData as any)?.content ?? [])
    : isJudge
      ? (judgeData?.notifications ?? (judgeData as any)?.content ?? [])
      : (clientData?.notifications ?? (clientData as any)?.content ?? []);

  const unreadCount = isAdmin
    ? (adminData?.unreadCount ?? 0)
    : isJudge
      ? (judgeData?.unreadCount ?? 0)
      : (clientData?.unreadCount ?? 0);

  const totalCount = isAdmin
    ? (adminData?.totalCount ?? (adminData as any)?.totalElements ?? 0)
    : isJudge
      ? (judgeData?.totalCount ?? (judgeData as any)?.totalElements ?? 0)
      : (clientData?.totalCount ?? (clientData as any)?.totalElements ?? 0);

  const totalPages = Math.ceil(totalCount / limit);

  function handleClick(n: any) {
    setSelected(n);
    if (!n.read) {
      if (isAdmin)     markAdmin(n.id);
      else if (isJudge) markJudge(n.id);
      else             markClient(n.id);
    }
  }

  if (isLoading) return <Loader variant="page" text="Loading notifications…" />;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Notifications</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(0); setSelected(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                filter === f
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-5 flex-1 min-h-0" style={{ height: "calc(100vh - 200px)" }}>
        {/* List */}
        <Card
          className={`attend-card overflow-hidden flex flex-col transition-all ${
            selected ? "w-[420px] shrink-0" : "flex-1"
          }`}
        >
          <div className="flex-1 overflow-y-auto divide-y divide-[hsl(var(--border))]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <BellOff className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {filter === "unread" ? "No unread notifications." : "No notifications yet."}
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const color = typeColor(n.type);
                const isSelected = selected?.id === n.id;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[hsl(var(--primary)/0.06)]"
                        : !n.read
                        ? "bg-[hsl(var(--muted)/0.3)] hover:bg-[hsl(var(--muted)/0.5)]"
                        : "hover:bg-[hsl(var(--muted)/0.3)]"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 mt-0.5"
                      style={{ backgroundColor: color + "18", color }}
                    >
                      {typeInitial(n.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm truncate ${
                            !n.read
                              ? "font-semibold text-[hsl(var(--foreground))]"
                              : "font-medium text-[hsl(var(--muted-foreground))]"
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: color + "15", color }}
                        >
                          {n.type ?? "NOTIFICATION"}
                        </span>
                        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => { setPage(p => p - 1); setSelected(null); }}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => { setPage(p => p + 1); setSelected(null); }}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Detail panel */}
        {selected && (
          <Card className="attend-card flex-1 overflow-hidden flex flex-col">
            <DetailPanel notification={selected} onClose={() => setSelected(null)} />
          </Card>
        )}
      </div>
    </div>
  );
}

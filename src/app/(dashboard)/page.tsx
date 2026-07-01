"use client";

import { useRouter } from "next/navigation";
import {
  Lightbulb, CalendarDays,
  Star, UserCheck, CheckCircle2, ChevronRight, Search,
} from "lucide-react";
import { useState } from "react";
import { useGetMe } from "@/api/auth/hooks";
import { useDashboardStats, useAdminDashboard, useEvents, useUsers } from "@/api/super-admin";
import { useClientEvents } from "@/api/client-events";
import { useRegisters } from "@/api/registers";
import { useRegistrars } from "@/api/registrars";
import { useJudgeEvents, type JudgeChallengeItem } from "@/api/judge";
import { Loader } from "@/components/ui/Loader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SuperAdminView } from "@/components/dashboard/super-admin-view";
import { ClientView } from "@/components/dashboard/client-view";
import { formatDate } from "@/lib/utils";
import type { EventSummaryResponse } from "@/types/super-admin";

// ─── Role helpers ─────────────────────────────────────────────────────────────
const ADMIN_ROLES = new Set(["super_admin"]);
const JUDGE_ROLES = new Set(["judge"]);

// ─── Judge dashboard ──────────────────────────────────────────────────────────
function typeLabel(type?: string) {
  const t = (type ?? "").toUpperCase();
  if (t.includes("HACKATHON") || t.includes("EVENT"))
    return { label: "Innovation Challenge", bg: "#7c22c918", color: "#7c22c9", Icon: Lightbulb };
  return { label: "Innovation Challenge", bg: "#7c22c918", color: "#7c22c9", Icon: Lightbulb };
}

function JudgeDashboard({ name }: { name?: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useJudgeEvents();
  const challenges = data?.challenges ?? [];

  const filtered = search
    ? challenges.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.organiserName ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : challenges;

  const totalAssigned = challenges.length;
  const totalScored   = challenges.reduce((s, c) => s + (c.scoredCount ?? 0), 0);
  const totalPending  = challenges.reduce((s, c) =>
    s + (c.pendingCount ?? Math.max(0, (c.shortlistedCount ?? 0) - (c.scoredCount ?? 0))), 0
  );

  function ChallengeRow({ c }: { c: JudgeChallengeItem }) {
    const { bg, color, Icon } = typeLabel(c.type);
    const s = (c.status ?? "").toUpperCase();
    const statusStyle =
      s === "LIVE"      ? { bg: "#16a34a18", color: "#16a34a" } :
      s === "PUBLISHED" ? { bg: "#0891b218", color: "#0891b2" } :
      s === "ENDED"     ? { bg: "#6b728018", color: "#6b7280" } :
                          { bg: "#f59e0b18", color: "#d97706" };
    const pending = c.pendingCount ?? Math.max(0, (c.shortlistedCount ?? 0) - (c.scoredCount ?? 0));

    return (
      <tr
        className="attend-table-row cursor-pointer"
        onClick={() => router.push(`/hackathons/judging?id=${c.id}&title=${encodeURIComponent(c.title)}`)}
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">{c.title}</p>
              {c.organiserName && <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.organiserName}</p>}
            </div>
          </div>
        </td>
        <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{c.date ? formatDate(c.date) : "—"}</td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums text-green-700">{c.scoredCount ?? 0}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">/</span>
            <span className="text-sm tabular-nums text-[hsl(var(--muted-foreground))]">{c.shortlistedCount ?? 0}</span>
            {pending > 0 && (
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#f59e0b18", color: "#d97706" }}>
                {pending} left
              </span>
            )}
          </div>
        </td>
        <td className="px-5 py-4">
          {c.status && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
              {c.status}
            </span>
          )}
        </td>
        <td className="px-5 py-4 text-right">
          <Button
            size="sm" className="h-8 gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/hackathons/judging?id=${c.id}&title=${encodeURIComponent(c.title)}`);
            }}
          >
            Score <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </td>
      </tr>
    );
  }

  function ChallengeTable({ items, title, icon: Icon, color }: { items: JudgeChallengeItem[]; title: string; icon: React.ElementType; color: string }) {
    return (
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <h2 className="font-semibold text-[hsl(var(--foreground))]">{title}</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">{items.length} assigned</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Title</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Progress</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => <ChallengeRow key={c.id} c={c} />)}
          </tbody>
        </table>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Welcome back{name ? `, ${name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Your assigned innovation challenges and hackathon events
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Assigned",       value: totalAssigned, Icon: UserCheck,   color: "#7c22c9" },
          { label: "Teams Scored",   value: totalScored,   Icon: CheckCircle2, color: "#16a34a" },
          { label: "Pending Scores", value: totalPending,  Icon: Star,        color: "#d97706" },
        ].map(({ label, value, Icon, color }) => (
          <Card key={label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {isLoading ? (
        <Loader variant="inline" text="Loading your assignments…" />
      ) : filtered.length === 0 ? (
        <Card className="attend-card p-12 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {search ? "No results match your search." : "No challenges assigned to you yet."}
          </p>
        </Card>
      ) : (
        <ChallengeTable items={filtered} title="Innovation Challenges" icon={Lightbulb} color="#7c22c9" />
      )}
    </div>
  );
}

// ─── Page controller ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const currentUser = userResponse?.data;

  const normalizedRole = (currentUser?.role ?? "").toLowerCase().replace(/[-\s]/g, "_");
  const isSuperAdmin = normalizedRole === "super_admin";
  const isJudge      = JUDGE_ROLES.has(normalizedRole);
  const isAdmin      = userLoading || !currentUser || ADMIN_ROLES.has(normalizedRole);

  // All hooks called unconditionally — Rules of Hooks.
  // Admin-only endpoints are gated with enabled:isSuperAdmin so non-super_admin users
  // never fire requests that would return 403/500.
  const { data: dashStats,        isLoading: statsLoading  } = useDashboardStats(isSuperAdmin);
  const { data: adminDashboard                             } = useAdminDashboard(isSuperAdmin);
  const { data: usersData,        isLoading: usersLoading  } = useUsers("", 0, 10, isSuperAdmin);
  const { data: eventsData,       isLoading: eventsLoading } = useEvents("", 0, 20, isSuperAdmin);
  const { data: publishedData                              } = useEvents("PUBLISHED", 0, 1, isSuperAdmin);
  const { data: registrarsData,   isLoading: regLoading    } = useRegistrars("", 0, 20, isSuperAdmin);
  const { data: registersData                              } = useRegisters("ACTIVE", 0, 6);
  const { data: clientEventsData, isLoading: clientLoading } = useClientEvents("ALL", 0, 20);

  const isLoading = userLoading || (isAdmin && !isJudge ? eventsLoading : clientLoading);
  if (isLoading && !isJudge) return <Loader variant="page" text="Loading Dashboard..." />;

  // Judge gets their own dashboard — no redirect needed
  if (isJudge) return <JudgeDashboard name={currentUser?.fullName} />;

  const stats = dashStats?.data ?? (dashStats as any);

  const allEvents: EventSummaryResponse[] = isAdmin
    ? (eventsData?.content ?? [])
    : (clientEventsData?.events ?? []).map((e) => ({
        id:                     e.id,
        title:                  e.title,
        status:                 e.status,
        date:                   e.date,
        startTime:              "",
        format:                 e.format as "VIRTUAL" | "IN_PERSON" | "HYBRID",
        live:                   e.status === "LIVE",
        registerName:           e.registerName ?? "",
        organizerName:          e.registerName ?? "",
        registrationCount:      e.rsvpCount,
        registrationPercentage: e.fillRate,
        tags:                   e.eventType ? [e.eventType] : [],
        eventType:              e.eventType,
      }));

  const liveEvents   = allEvents.filter((e) => e.status === "live" || e.status === "LIVE");
  const topRegisters = (registersData?.registers ?? []).slice(0, 5);
  const registrars   = registrarsData?.registrars ?? [];

  if (isSuperAdmin) {
    return (
      <SuperAdminView
        currentUser={currentUser}
        stats={stats}
        statsLoading={statsLoading}
        adminDashboard={adminDashboard}
        usersData={usersData}
        usersLoading={usersLoading}
        allEvents={allEvents}
        eventsData={eventsData}
        eventsLoading={eventsLoading}
        registrars={registrars}
        registrarsData={registrarsData}
        regLoading={regLoading}
        liveEvents={liveEvents}
        publishedData={publishedData}
      />
    );
  }

  return (
    <ClientView
      currentUser={currentUser}
      allEvents={allEvents}
      eventsLoading={eventsLoading}
      topRegisters={topRegisters}
      liveEvents={liveEvents}
    />
  );
}

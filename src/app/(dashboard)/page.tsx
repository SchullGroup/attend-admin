"use client";

import { useGetMe } from "@/api/auth/hooks";
import { useDashboardStats, useEvents, useRecentRegistrations } from "@/api/super-admin";
import { useClientEvents } from "@/api/client-events";
import { useRegisters } from "@/api/registers";
import { useRegistrars } from "@/api/registrars";
import { Loader } from "@/components/ui/Loader";
import { SuperAdminView } from "@/components/dashboard/super-admin-view";
import { ClientView } from "@/components/dashboard/client-view";
import type { EventSummaryResponse } from "@/types/super-admin";

// ─── Role helpers ─────────────────────────────────────────────────────────────
const ADMIN_ROLES = new Set(["super_admin", "event_manager", "kyc_officer", "judge"]);

// ─── Page controller ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const currentUser = userResponse?.data;

  // Normalize the role string once to safely handle hyphens ("super-admin") or spaces
  const normalizedRole = (currentUser?.role ?? "").toLowerCase().replace(/[-\s]/g, "_");

  const isSuperAdmin = normalizedRole === "super_admin";
  const isAdmin      = userLoading || !currentUser || ADMIN_ROLES.has(normalizedRole);

  // All hooks called unconditionally — Rules of Hooks
  const { data: dashStats,        isLoading: statsLoading   } = useDashboardStats();
  const { data: eventsData,       isLoading: eventsLoading  } = useEvents("", 0, 20);
  const { data: publishedData                               } = useEvents("PUBLISHED", 0, 1);
  const { data: registrarsData,   isLoading: regLoading     } = useRegistrars("", 0, 20);
  const { data: registersData                               } = useRegisters("ACTIVE", 0, 6);
  const { data: clientEventsData, isLoading: clientLoading  } = useClientEvents("ALL", 0, 20);

  // Gate on user + primary events fetch; stats use per-card skeletons
  const isLoading = userLoading || (isAdmin ? eventsLoading : clientLoading);
  if (isLoading) return <Loader variant="page" text="Loading Dashboard..." />;

  // ── Data preparation ────────────────────────────────────────────────────────
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

  const liveEvents    = allEvents.filter((e) => e.status === "live" || e.status === "LIVE");
  const topRegisters  = (registersData?.registers ?? []).slice(0, 5);
  const registrars    = registrarsData?.registrars ?? [];

  // ── Role-based render ───────────────────────────────────────────────────────
  if (isSuperAdmin) {
    return (
      <SuperAdminView
        currentUser={currentUser}
        stats={stats}
        statsLoading={statsLoading}
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
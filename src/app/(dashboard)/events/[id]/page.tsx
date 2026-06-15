"use client";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEventDetail, useEventDocuments, useEventAttendees } from "@/api/super-admin";
import { useClientEventDetail, useClientEventDocuments, useClientEventAttendees, useExpectedAttendees } from "@/api/client-events";
import { useGetMe } from "@/api/auth/hooks";
import { useSuspendUserAccount } from "@/api/users";
import { ModuleBadge } from "@/components/custom/module-badge";
import { StatusBadge } from "@/components/custom/status-badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/Loader";
import { toast } from "sonner";
import { ArrowLeft, Radio } from "lucide-react";
import type { EventModule } from "@/types/mock";

// ── Tab components ────────────────────────────────────────────────────────────
import { EventOverviewTab }     from "./components/EventOverviewTab";
import { EventAttendeesTab }    from "./components/EventAttendeesTab";
import { EventDocumentsTab }    from "./components/EventDocumentsTab";
import { EventResolutionsTab }  from "./components/EventResolutionsTab";
import { EventBroadcastTab }    from "./components/EventBroadcastTab";
import { EventVoteResultsTab }  from "./components/EventVoteResultsTab";
import { EventPostAgmTab }      from "./components/EventPostAgmTab";
import { EventSettingsTab }     from "./components/EventSettingsTab";
import { EventStakeholderTab }          from "./components/EventStakeholderTab";
import { EventExpectedAttendeesTab }   from "./components/EventExpectedAttendeesTab";
import type { LocalAgendaItem, EventShim } from "./components/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toModule(eventType?: string): string {
  if (!eventType) return "GENERAL";
  if (eventType === "AGM_EGM")                                      return "AGM";
  if (eventType === "PRODUCT_LAUNCH")                               return "LAUNCH";
  if (eventType === "INNOVATION_CHALLENGE" || eventType === "HACKATHON") return "HACKATHON";
  return "GENERAL";
}

function toFormatKey(fmt: string): EventShim["format"] {
  if (fmt === "VIRTUAL") return "virtual";
  if (fmt === "HYBRID")  return "hybrid";
  return "in-person";
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(["super_admin", "admin", "superadmin", "super-admin", "event_manager", "kyc_officer", "judge"]);

function detectIsAdmin(user: { role?: string; roles?: string[] } | null | undefined): boolean {
  if (!user) return false;
  // Check single role string
  const role = (user.role ?? "").toLowerCase().replace(/[-\s]/g, "_");
  if (ADMIN_ROLES.has(role)) return true;
  // Check roles array (some API shapes return this instead)
  if (Array.isArray((user as any).roles)) {
    return (user as any).roles.some((r: string) =>
      ADMIN_ROLES.has((r ?? "").toLowerCase().replace(/[-\s]/g, "_"))
    );
  }
  return false;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // ── Role detection ────────────────────────────────────────────────────────
  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const currentUser  = userResponse?.data;
  // Wait for user to load before deciding; default false while loading so we
  // never fire admin endpoints for client users.
  const userReady    = !userLoading;
  const isAdmin      = userReady && detectIsAdmin(currentUser);
  const isClient     = userReady && !isAdmin;

  // ── Data — each hook only fires for the matching role ────────────────────
  const { data: adminEvent,  isLoading: adminLoading  } = useEventDetail(id, { enabled: isAdmin });
  const { data: clientEvent, isLoading: clientLoading } = useClientEventDetail(id, { enabled: isClient });
  const { data: adminDocs  }                             = useEventDocuments(id, { enabled: isAdmin });
  const { data: clientDocs }                             = useClientEventDocuments(id, "", { enabled: isClient });
  const { data: adminAttendees  }                        = useEventAttendees(id, 0, 50, "", { enabled: isAdmin });
  const { data: clientAttendees }                        = useClientEventAttendees(id, "", 0, 50);
  const { data: expectedAttendeesData }                  = useExpectedAttendees(id);
  const suspendUser = useSuspendUserAccount();

  const apiEvent          = isAdmin ? adminEvent    : clientEvent;
  const docsResponse      = isAdmin ? adminDocs     : clientDocs;
  const attendeesResponse = isAdmin ? adminAttendees : clientAttendees;
  const eventLoading      = !userReady || (isAdmin ? adminLoading : clientLoading);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tab,              setTab]             = useState("Overview");
  const [localStatus,      setLocalStatus]     = useState<string | null>(null);
  const [agendaItems,      setAgendaItems]     = useState<LocalAgendaItem[]>([]);
  const [broadcastMsg,     setBroadcastMsg]    = useState("");
  const [broadcastChannel, setBroadcastChannel] = useState<"push"|"sms"|"email"|"all">("push");
  const [broadcastHistory, setBroadcastHistory] = useState<Array<{ text: string; channel: string; sentAt: string }>>([]);

  // ── Loading / error ───────────────────────────────────────────────────────
  if (eventLoading) return <Loader variant="page" text="Loading Event…" />;

  if (!apiEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Event not found</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">This event may have been removed.</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/events")}>
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </Button>
      </div>
    );
  }

  // ── Build compatibility shim ──────────────────────────────────────────────
  const rsvpCount = apiEvent.overview?.rsvps?.count    ?? apiEvent.rsvpCount          ?? apiEvent.registrationCount ?? 0;
  const capacity  = apiEvent.overview?.rsvps?.capacity ?? apiEvent.maximumCapacity    ?? null;

  const event: EventShim = {
    ...apiEvent,
    // registerName is primary per API spec; fall back to the admin-side aliases.
    organiser: (apiEvent as any).registerName ?? apiEvent.organizerName ?? apiEvent.stakeholderName ?? "",
    venue:     apiEvent.location ?? apiEvent.venue ?? "",
    rsvpCount,
    capacity,
    endTime:   "",
    format:    toFormatKey(apiEvent.format),
    module:    toModule(apiEvent.eventType),
    color:     "#9333ea",
    agenda:    (apiEvent.agenda ?? agendaItems) as LocalAgendaItem[],
  };

  // ── Defensive response unwraps ────────────────────────────────────────────
  const participants: any[] =
    Array.isArray(attendeesResponse)                  ? attendeesResponse :
    Array.isArray((attendeesResponse as any)?.attendees)  ? (attendeesResponse as any).attendees :
    Array.isArray((attendeesResponse as any)?.content)    ? (attendeesResponse as any).content :
    Array.isArray((attendeesResponse as any)?.participants) ? (attendeesResponse as any).participants :
    Array.isArray((attendeesResponse as any)?.data)       ? (attendeesResponse as any).data :
    [];

  const _docsRaw = (docsResponse as any)?.data ?? docsResponse;
  const eventDocs: any[] =
    Array.isArray(_docsRaw)                ? _docsRaw :
    Array.isArray(_docsRaw?.documents)     ? _docsRaw.documents :
    Array.isArray(_docsRaw?.content)       ? _docsRaw.content :
    [];

  const liveVotes: any[] = [];   // live-votes API not yet wired

  // ── Derived flags ─────────────────────────────────────────────────────────
  const fill   = capacity && capacity > 0 ? Math.min(Math.round((rsvpCount / capacity) * 100), 100) : null;
  const isAGM  = event.module === "AGM";
  const isLAUNCH  = event.module === "LAUNCH";
  const isGENERAL = event.module === "GENERAL";
  const currentStatus = localStatus ?? event.status?.toLowerCase();

  function handleStatusChange(status: string) {
    setLocalStatus(status);
    toast.success(`Event status updated to "${status}"`);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const isSuperAdmin =
    (currentUser?.role ?? "").toLowerCase().replace(/[-\s]/g, "_") === "super_admin" ||
    (Array.isArray((currentUser as any)?.roles) && (currentUser as any).roles.some((r: string) =>
      (r ?? "").toLowerCase().replace(/[-\s]/g, "_") === "super_admin"
    ));

  const expectedAttendeesCount = expectedAttendeesData?.totalCount ?? 0;

  const TABS = [
    "Overview",
    "Attendees",
    // Registrar tab only for super admin (overview already shows it for others)
    ...(isSuperAdmin ? ["Registrar"] : []),
    "Documents",
    ...(isAGM ? ["Resolutions", "Stakeholders"] : []),
    ...(isLAUNCH ? ["Stakeholders"] : []),
    "Broadcast",
    ...(isAGM ? ["Vote Results", "Post-AGM"] : []),
    // Super admin is read-only for events — no settings/mutations
    ...(!isSuperAdmin ? ["Settings"] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ── */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/events")}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All Events
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ModuleBadge module={event.module as EventModule} />
              <StatusBadge status={currentStatus} />
              {currentStatus === "live" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] leading-tight">{event.title}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{event.organiser}</p>
          </div>
          {currentStatus === "live" && (
            <Link href="/events/live">
              <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                <Radio className="h-4 w-4" /> Control Room
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-full mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all text-center whitespace-nowrap min-w-[80px] ${
              tab === t
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab panels ── */}
      {tab === "Overview"           && <EventOverviewTab    event={event} fill={fill} eventDocs={eventDocs} agendaItems={agendaItems} isAGM={isAGM} onNavigate={setTab} stakeholderName={apiEvent.stakeholderName || undefined} stakeholderLogoUrl={(apiEvent as any).logoUrl ?? (apiEvent as any).registerLogoUrl ?? (apiEvent as any).branding?.logoUrl ?? undefined} expectedAttendeesCount={expectedAttendeesCount} />}
      {tab === "Attendees"          && <EventAttendeesTab   participants={participants} suspendUser={suspendUser} eventId={id} />}
      {tab === "Registrar" && isSuperAdmin && (
        <EventStakeholderTab
          stakeholderName={apiEvent.stakeholderName || undefined}
          stakeholderData={apiEvent as any}
        />
      )}
      {tab === "Documents"          && <EventDocumentsTab   eventId={id} agmNoticeUrl={(apiEvent as any).agmConfig?.agmNoticeUrl ?? undefined} isAdmin={isAdmin} />}
      {tab === "Resolutions"         && isAGM && <EventResolutionsTab        eventId={id} isAGM={isAGM} agmResolutions={(apiEvent as any).agmConfig?.resolutions ?? []} agendaItems={agendaItems} setAgendaItems={setAgendaItems} />}
      {tab === "Stakeholders"         && (isAGM || isLAUNCH) && <EventExpectedAttendeesTab  eventId={id} />}
      {tab === "Broadcast"          && <EventBroadcastTab   rsvpCount={rsvpCount} broadcastMsg={broadcastMsg} setBroadcastMsg={setBroadcastMsg} broadcastChannel={broadcastChannel} setBroadcastChannel={setBroadcastChannel} broadcastHistory={broadcastHistory} setBroadcastHistory={setBroadcastHistory} />}
      {tab === "Vote Results"       && isAGM && <EventVoteResultsTab liveVotes={liveVotes} />}
      {tab === "Post-AGM"           && isAGM && <EventPostAgmTab     event={event} liveVotes={liveVotes} participants={participants} />}
      {tab === "Settings" && !isSuperAdmin && <EventSettingsTab    eventId={id} title={event.title} organiser={event.organiser} description={apiEvent.description} currentStatus={currentStatus} featured={(apiEvent as any).featured ?? false} onStatusChange={handleStatusChange} />}
    </div>
  );
}

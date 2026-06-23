"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRegisters } from "@/api/registers";
import {
  useCreateAgmEvent,
  useCreateGeneralEvent,
  useCreateInnovationEvent,
  useCreateProductLaunchEvent,
} from "@/api/events";
import { useCreateEvent, type CreateEventRequest } from "@/api/client-events";
import { useGetMe } from "@/api/auth/hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Component imports ────────────────────────────────────────────────────────

import { MODULES, STEPS, STEP_META, type ModuleId } from "./components/types";
import { OrgCombobox, StepPanel, SectionHead } from "./components/shared";
import {
  useAgmState, useLaunchState, useHackState, useGeneralState,
} from "./components/state-hooks";
import {
  AgmStep0, AgmAgendaStep, AgmNoticeStep, AgmResolutionsStep, AgmShareholdersStep, AgmReview,
} from "./components/AgmSteps";
import {
  LaunchStep0, LaunchStep1, LaunchSpeakersStep, LaunchEmbargoStep, LaunchReview,
} from "./components/LaunchSteps";
import {
  HackStep0, HackBriefStep, HackTeamsStep, HackPrizesStep, HackReview,
} from "./components/HackathonSteps";
import {
  GeneralStep0, GeneralAudienceStep, GeneralReview,
} from "./components/GeneralSteps";

// ─── Inner page ───────────────────────────────────────────────────────────────

function CreateEventInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: registersData } = useRegisters("ACTIVE", 0, 100);
  const activeOrganisers = (registersData?.registers ?? []).map((reg) => ({
    id:   reg.id,
    name: reg.name || (reg as any).companyName || reg.id,
  }));

  const [selectedModule, setSelectedModule] = useState<ModuleId | null>(null);
  const [step,           setStep]           = useState(0);
  const [submitting,     setSubmitting]     = useState(false);
  const [organiserId,    setOrganiserId]    = useState("");
  const [showStepErrors, setShowStepErrors] = useState(false);

  useEffect(() => {
    const type = searchParams.get("type") as ModuleId | null;
    if (type && ["AGM", "LAUNCH", "HACKATHON", "GENERAL"].includes(type)) {
      setSelectedModule(type);
      setStep(0);
    }
  }, [searchParams]);

  const agm     = useAgmState();
  const launch  = useLaunchState();
  const hack    = useHackState();
  const general = useGeneralState();

  const { data: userResponse } = useGetMe();
  const currentUser = userResponse?.data;
  const ADMIN_ROLES = new Set(["super_admin", "event_manager", "kyc_officer", "judge"]);
  const isAdmin = !currentUser || ADMIN_ROLES.has(currentUser.role?.toLowerCase() ?? "");

  const createAgm         = useCreateAgmEvent();
  const createGeneral     = useCreateGeneralEvent();
  const createHack        = useCreateInnovationEvent();
  const createLaunch      = useCreateProductLaunchEvent();
  const createClientEvent = useCreateEvent();

  const selectedOrganiser = activeOrganisers.find((o) => o.id === organiserId) ?? null;
  const organiserName     = selectedOrganiser?.name ?? "";
  const mod               = selectedModule ? MODULES.find((m) => m.id === selectedModule)! : null;
  const steps             = selectedModule ? STEPS[selectedModule] : [];
  const meta              = selectedModule ? STEP_META[selectedModule] : [];
  const isLast            = step === steps.length - 1;

  // ─── Step validation ────────────────────────────────────────────────────────

  function getStepValid(module: ModuleId, s: number): boolean {
    if (module === "AGM") {
      if (s === 0) return !!agm.title.trim() && !!agm.date;
      if (s === 1) return true; // agenda optional
      if (s === 2) return true; // notice optional
      if (s === 3) return agm.resolutions.some((r) => r.title.trim());
      return true;
    }
    if (module === "LAUNCH") {
      if (s === 0) return !!launch.title.trim() && !!launch.date;
      if (s === 1) return !!launch.productName.trim();
      return true;
    }
    if (module === "HACKATHON") {
      if (s === 0) return !!hack.title.trim() && !!hack.startDate && hack.description.length >= 30;
      if (s === 1) return hack.problemStatement.length >= 30;
      return true;
    }
    if (module === "GENERAL") {
      if (s === 0) return !!general.title.trim() && !!general.date;
      return true;
    }
    return true;
  }

  const stepValid = selectedModule ? getStepValid(selectedModule, step) : true;

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function next() {
    if (!stepValid) {
      setShowStepErrors(true);
      toast.error("Please fill in all required fields before continuing.");
      return;
    }
    setShowStepErrors(false);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }
  function back() { setShowStepErrors(false); setStep((s) => Math.max(s - 1, 0)); }
  function skip() { setShowStepErrors(false); setStep((s) => Math.min(s + 1, steps.length - 1)); }
  function selectModule(id: ModuleId) { setSelectedModule(id); setStep(0); setShowStepErrors(false); }
  function resetModule()               { setSelectedModule(null); setStep(0); setShowStepErrors(false); }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!organiserId) {
      toast.error("Please select an organiser before creating an event.");
      return;
    }
    if (!selectedModule) return;

    const onDone = () => router.push("/events");
    const fmt = (f: string) => f.toUpperCase() as "VIRTUAL" | "IN_PERSON" | "HYBRID";
    const audience = (mode: string) =>
      mode === "open" ? "OPEN_REGISTRATION" : "INVITE_ONLY" as const;

    // ── Client path ──────────────────────────────────────────────────────────
    if (!isAdmin) {
      setSubmitting(true);

      const eventTypeMap: Record<ModuleId, CreateEventRequest["eventType"]> = {
        AGM:       "AGM_EGM",
        LAUNCH:    "PRODUCT_LAUNCH",
        HACKATHON: "INNOVATION_CHALLENGE",
        GENERAL:   "GENERAL_EVENT",
      };

      const agmConfig = selectedModule === "AGM" ? {
        resolutions: agm.resolutions
          .filter((r) => r.title.trim())
          .map((r) => ({ title: r.title, description: r.description || undefined, isSpecialResolution: r.isSpecial })),
        shareholderTargeting: agm.shareholderTargeting === "all" ? "ALL_REGISTERED" as const : "CUSTOM_LIST" as const,
        enableProxyVoting:    agm.proxyEnabled,
        agmNoticeUrl:         agm.noticeUrl  || undefined,
        agmNoticeFilename:    agm.noticeFile || undefined,
      } : undefined;

      const productLaunchConfig = selectedModule === "LAUNCH" ? {
        audienceTargeting: audience(launch.audienceMode) as import("@/api/client-events").AudienceTargeting,
        embargo: {
          enabled:   launch.embargoEnabled,
          releaseAt: launch.embargoEnabled ? (launch.embargoAt || undefined) : undefined,
        },
      } : undefined;

      const innovationChallengeConfig = selectedModule === "HACKATHON" ? {
        audienceTargeting:   "OPEN_REGISTRATION" as import("@/api/client-events").AudienceTargeting,
        tracks:              hack.theme ? hack.theme.split(",").map((t) => t.trim()).filter(Boolean) : [],
        problemStatement:    hack.problemStatement   || undefined,
        expectedDeliverable: hack.deliverable        || undefined,
        submissionDeadline:  hack.submissionDeadline || undefined,
        allowedTechStack:    hack.techStack          || undefined,
        participationType:   (hack.participationType === "both" ? "SOLO_AND_TEAM" : hack.participationType.toUpperCase()) as "SOLO" | "TEAM" | "SOLO_AND_TEAM",
        minTeamSize:         (hack.participationType !== "solo") ? (parseInt(hack.minTeam, 10) || undefined) : undefined,
        maxTeamSize:         (hack.participationType !== "solo") ? (parseInt(hack.maxTeam, 10) || undefined) : undefined,
        eligibilityCriteria: hack.eligibility || undefined,
        maximumEntries:      parseInt(hack.capacity, 10) || undefined,
        prizeTiers:          hack.prizes.filter((p) => p.reward).map((p) => ({ position: p.place, reward: p.reward })),
        judgingCriteria:     hack.criteria.filter((c) => c.label.trim()).map((c) => ({
          criterion: c.label,
          weight:    parseInt(c.weight.replace("%", ""), 10) || 0,
        })),
      } : undefined;

      const generalEventConfig = selectedModule === "GENERAL" ? {
        audienceTargeting: audience(general.audienceMode) as import("@/api/client-events").AudienceTargeting,
      } : undefined;

      const title = selectedModule === "AGM"      ? agm.title
                  : selectedModule === "LAUNCH"    ? launch.title
                  : selectedModule === "HACKATHON" ? hack.title
                  : general.title;

      const description = selectedModule === "AGM"      ? (agm.description     || undefined)
                        : selectedModule === "LAUNCH"    ? (launch.description  || undefined)
                        : selectedModule === "HACKATHON" ? (hack.description    || undefined)
                        : (general.description || undefined);

      const date = selectedModule === "AGM"      ? agm.date
                 : selectedModule === "LAUNCH"    ? launch.date
                 : selectedModule === "HACKATHON" ? hack.startDate
                 : general.date;

      const endDate = selectedModule === "HACKATHON" ? (hack.endDate || undefined) : undefined;

      const startTime = selectedModule === "AGM"      ? agm.time
                      : selectedModule === "LAUNCH"    ? launch.time
                      : selectedModule === "HACKATHON" ? (hack.time || "09:00")
                      : general.time;

      const endTime = selectedModule === "AGM"      ? (agm.endTime     || undefined)
                    : selectedModule === "LAUNCH"    ? (launch.endTime  || undefined)
                    : selectedModule === "HACKATHON" ? (hack.endTime    || undefined)
                    : (general.endTime || undefined);

      const eventFormat = selectedModule === "AGM"      ? agm.format
                        : selectedModule === "LAUNCH"    ? launch.format
                        : selectedModule === "HACKATHON" ? hack.format
                        : general.format;

      const streamUrl = selectedModule === "AGM"      ? (agm.streamUrl    || undefined)
                      : selectedModule === "LAUNCH"    ? (launch.streamUrl || undefined)
                      : selectedModule === "HACKATHON" ? (hack.streamUrl   || undefined)
                      : (general.streamUrl || undefined);

      const venueValue = selectedModule === "AGM"      ? (agm.venue    || undefined)
                       : selectedModule === "LAUNCH"    ? (launch.venue || undefined)
                       : selectedModule === "HACKATHON" ? (hack.venue   || undefined)
                       : (general.venue || undefined);

      const maximumCapacity = selectedModule === "AGM"      ? (parseInt(agm.capacity,     10) || 0)
                            : selectedModule === "LAUNCH"    ? (parseInt(launch.capacity,  10) || 0)
                            : selectedModule === "HACKATHON" ? (parseInt(hack.capacity,    10) || 0)
                            : (parseInt(general.capacity, 10) || 0);

      const featuredValue = selectedModule === "AGM"      ? agm.featured
                          : selectedModule === "LAUNCH"    ? launch.featured
                          : selectedModule === "HACKATHON" ? hack.featured
                          : general.featured;

      const speakers = selectedModule === "LAUNCH"
        ? launch.speakers.filter((sp) => sp.name.trim()).map((sp) => ({ name: sp.name, roleTitle: sp.role, bio: sp.bio || undefined }))
        : undefined;

      createClientEvent.mutate(
        {
          registerId: organiserId,
          eventType:  eventTypeMap[selectedModule],
          title, description, date, endDate, startTime, endTime,
          format:          fmt(eventFormat),
          streamUrl,
          location:        venueValue,
          venue:           venueValue,
          maximumCapacity,
          featured:        featuredValue || undefined,
          rsvpEnabled:     selectedModule === "AGM" ? agm.rsvpEnabled : undefined,
          speakers,
          // AGM agenda items — only sent when the AGM module is active and items exist
          agenda: selectedModule === "AGM" && agm.agendaItems.some((a) => a.title.trim())
            ? agm.agendaItems.filter((a) => a.title.trim()).map((a) => ({ time: a.time, title: a.title, speaker: a.speaker || undefined }))
            : undefined,
          agmConfig,
          productLaunchConfig,
          innovationChallengeConfig,
          generalEventConfig,
        },
        { onSuccess: onDone, onSettled: () => setSubmitting(false) }
      );
      return;
    }

    // ── Admin path ───────────────────────────────────────────────────────────
    if (selectedModule === "AGM") {
      setSubmitting(true);
      createAgm.mutate(
        {
          registerId:            organiserId,
          title:                 agm.title,
          date:                  agm.date,
          startTime:             agm.time,
          format:                fmt(agm.format),
          streamUrl:             agm.streamUrl            || undefined,
          venue:                 agm.venue                || undefined,
          quorumPercentage:      parseInt(agm.quorum, 10) || undefined,
          eligibilityCutOffDate: agm.cutoff               || undefined,
          enableProxyVoting:     agm.proxyEnabled,
          shareholderTargeting:  agm.shareholderTargeting === "all" ? "ALL_REGISTERED" : "CUSTOM",
          resolutions:           agm.resolutions
            .filter((r) => r.title.trim())
            .map((r) => ({ title: r.title, description: r.description || undefined, specialResolution: r.isSpecial })),
        },
        { onSuccess: onDone, onSettled: () => setSubmitting(false) }
      );
      return;
    }

    if (selectedModule === "GENERAL") {
      setSubmitting(true);
      createGeneral.mutate(
        {
          registerId:        organiserId,
          title:             general.title,
          description:       general.description  || undefined,
          date:              general.date,
          startTime:         general.time,
          format:            fmt(general.format),
          venue:             general.venue         || undefined,
          streamUrl:         general.streamUrl     || undefined,
          maximumCapacity:   parseInt(general.capacity, 10) || undefined,
          audienceTargeting: audience(general.audienceMode),
        },
        { onSuccess: onDone, onSettled: () => setSubmitting(false) }
      );
      return;
    }

    if (selectedModule === "HACKATHON") {
      setSubmitting(true);
      createHack.mutate(
        {
          registerId:           organiserId,
          title:                hack.title,
          eventType:            "INNOVATION_CHALLENGE",
          themeTrack:           hack.theme              || undefined,
          startDate:            hack.startDate,
          endDate:              hack.endDate,
          startTime:            hack.time               || "09:00",
          format:               fmt(hack.format),
          venue:                hack.venue              || undefined,
          streamUrl:            hack.streamUrl          || undefined,
          problemStatement:     hack.problemStatement   || undefined,
          expectedDeliverable:  hack.deliverable        || undefined,
          submissionDeadline:   hack.submissionDeadline || undefined,
          allowedTechStack:     hack.techStack          || undefined,
          participationType:    (hack.participationType === "both" ? "SOLO_AND_TEAM" : hack.participationType.toUpperCase()) as "SOLO" | "TEAM" | "SOLO_AND_TEAM",
          minTeamSize:          parseInt(hack.minTeam, 10) || undefined,
          maxTeamSize:          parseInt(hack.maxTeam, 10) || undefined,
          eligibilityCriteria:  hack.eligibility        || undefined,
          maximumEntries:       parseInt(hack.capacity, 10) || undefined,
          prizeTiers:           hack.prizes.filter((p) => p.reward).map((p) => ({ position: p.place, reward: p.reward })),
          judgingCriteria:      hack.criteria.map((c) => ({
            criterion: c.label,
            weight:    parseInt(c.weight.replace("%", ""), 10) || 0,
          })),
        },
        { onSuccess: onDone, onSettled: () => setSubmitting(false) }
      );
      return;
    }

    if (selectedModule === "LAUNCH") {
      setSubmitting(true);
      createLaunch.mutate(
        {
          registerId:         organiserId,
          title:              launch.title,
          date:               launch.date,
          startTime:          launch.time,
          format:             fmt(launch.format),
          venue:              launch.venue               || undefined,
          streamUrl:          launch.streamUrl           || undefined,
          maximumCapacity:    parseInt(launch.capacity, 10) || undefined,
          productName:        launch.productName          || undefined,
          tagline:            launch.tagline              || undefined,
          productDescription: launch.productDesc          || undefined,
          micrositeSlug:      launch.slug                 || undefined,
          audienceTargeting:  audience(launch.audienceMode),
          embargo: {
            enabled:   launch.embargoEnabled,
            releaseAt: launch.embargoEnabled ? (launch.embargoAt || undefined) : undefined,
          },
          speakers: launch.speakers
            .filter((sp) => sp.name.trim())
            .map((sp) => ({ name: sp.name, roleTitle: sp.role, bio: sp.bio || undefined })),
        },
        { onSuccess: onDone, onSettled: () => setSubmitting(false) }
      );
    }
  }

  // ─── Module selection screen ─────────────────────────────────────────────

  if (!selectedModule) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-[hsl(var(--foreground))]">Create New Event</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1.5">Choose the organiser and event type to begin setup.</p>
        </div>

        <div className="mb-8 rounded-2xl border border-[hsl(var(--border))] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">1</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Select Organiser</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Which organisation is hosting this event?</p>
            </div>
          </div>
          <OrgCombobox value={organiserId} onValueChange={setOrganiserId} organisers={activeOrganisers} />
          {organiserId
            ? <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1"><Check className="h-3 w-3" /> {organiserName} selected</p>
            : <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Required — every event must be linked to an organiser.</p>
          }
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
            organiserId ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted-foreground)/0.3)]")}>
            <span className="text-xs font-bold text-white">2</span>
          </div>
          <div>
            <p className={cn("text-sm font-semibold transition-colors", organiserId ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]")}>Select Event Type</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Each type has its own tailored setup flow.</p>
          </div>
        </div>

        <div className={cn("grid grid-cols-2 gap-5 transition-opacity duration-200", !organiserId && "opacity-50 pointer-events-none select-none")}>
          {MODULES.map((m) => {
            const Icon = m.icon;
            const stepCount = STEPS[m.id].length;
            return (
              <button key={m.id} type="button" onClick={() => {
                if (!organiserId) { toast.error("Please select an organiser first."); return; }
                selectModule(m.id);
              }}
                className="text-left rounded-2xl border border-[hsl(var(--border))] bg-white overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
                <div className="h-1.5" style={{ backgroundColor: m.color }} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: m.bg }}>
                      <Icon className="h-6 w-6" style={{ color: m.color }} />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: m.bg, color: m.color }}>
                      {stepCount} steps
                    </span>
                  </div>
                  <p className="text-lg font-bold text-[hsl(var(--foreground))] mb-1">{m.label}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4 leading-relaxed">{m.desc}</p>
                  <div className="border-t border-[hsl(var(--border))] pt-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{m.detail}</p>
                  </div>
                  <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold group-hover:gap-3 transition-all duration-200" style={{ color: m.color }}>
                    Start setup <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Multi-step flow ─────────────────────────────────────────────────────

  const stepMeta = meta[step];

  function renderStep() {
    if (selectedModule === "AGM") {
      if (step === 0) return <AgmStep0          s={agm}    organiserName={organiserName} showErrors={showStepErrors} />;
      if (step === 1) return <AgmAgendaStep      s={agm} />;
      if (step === 2) return <AgmNoticeStep      s={agm} />;
      if (step === 3) return <AgmResolutionsStep s={agm}    showErrors={showStepErrors} />;
      if (step === 4) return <AgmShareholdersStep s={agm} />;
      return           <AgmReview           s={agm}    organiserName={organiserName} />;
    }
    if (selectedModule === "LAUNCH") {
      if (step === 0) return <LaunchStep0         s={launch} organiserName={organiserName} showErrors={showStepErrors} />;
      if (step === 1) return <LaunchStep1         s={launch} showErrors={showStepErrors} />;
      if (step === 2) return <LaunchSpeakersStep  s={launch} />;
      if (step === 3) return <LaunchEmbargoStep   s={launch} />;
      return           <LaunchReview        s={launch} organiserName={organiserName} />;
    }
    if (selectedModule === "HACKATHON") {
      if (step === 0) return <HackStep0     s={hack} organiserName={organiserName} showErrors={showStepErrors} />;
      if (step === 1) return <HackBriefStep s={hack} showErrors={showStepErrors} />;
      if (step === 2) return <HackTeamsStep s={hack} />;
      if (step === 3) return <HackPrizesStep s={hack} />;
      return           <HackReview    s={hack} organiserName={organiserName} />;
    }
    if (selectedModule === "GENERAL") {
      if (step === 0) return <GeneralStep0        s={general} organiserName={organiserName} showErrors={showStepErrors} />;
      if (step === 1) return <GeneralAudienceStep s={general} />;
      return           <GeneralReview       s={general} organiserName={organiserName} />;
    }
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Create Event</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{stepMeta.subtitle}</p>
      </div>

      <div className="flex gap-6 items-start">
        <StepPanel steps={steps} current={step} moduleId={selectedModule} organiserName={organiserName} onReset={resetModule} />

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <Card className="attend-card p-6">
            <SectionHead title={stepMeta.title} subtitle={stepMeta.subtitle} />
            {renderStep()}
          </Card>

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-white px-5 py-4 flex items-center justify-between gap-3">
            <div>
              {step > 0
                ? <Button type="button" variant="outline" onClick={back} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
                : <Button type="button" variant="outline" onClick={resetModule} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Change type</Button>
              }
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-3">
                {steps[step]?.optional && (
                  <button type="button" onClick={skip} className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline transition-colors">
                    Skip this step
                  </button>
                )}
                {!isLast
                  ? <Button type="button" onClick={next} className={cn("gap-1.5 px-6", !stepValid && "opacity-50 cursor-not-allowed")}>
                      Continue <ChevronRight className="h-4 w-4" />
                    </Button>
                  : <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-1.5 px-6" style={{ backgroundColor: mod!.color }}>
                      {submitting ? "Creating…" : <><Check className="h-4 w-4" /> Create {mod!.label}</>}
                    </Button>
                }
              </div>
              {!isLast && !stepValid && showStepErrors && (
                <p className="text-xs text-red-500">Complete the required fields above to continue.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateEventPage() {
  return (
    <Suspense>
      <CreateEventInner />
    </Suspense>
  );
}

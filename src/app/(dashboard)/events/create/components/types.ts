// ─── Core types ───────────────────────────────────────────────────────────────

export type ModuleId = "AGM" | "LAUNCH" | "HACKATHON" | "GENERAL";
export type Format   = "virtual" | "in_person" | "hybrid";

export interface SpeakerItem { id: string; name: string; role: string; bio: string; }
export interface Resolution  { id: string; title: string; description: string; isSpecial: boolean; }
export interface Prize       { id: string; place: string; reward: string; }
export interface Criterion   { id: string; label: string; weight: string; }
export interface AgendaRow   { id: string; time: string; title: string; speaker: string; }

// ─── Module catalogue ─────────────────────────────────────────────────────────

import { Vote, Rocket, Zap, CalendarDays } from "lucide-react";

export const MODULES: {
  id: ModuleId; label: string; desc: string; detail: string;
  icon: React.ElementType; color: string; bg: string;
}[] = [
  {
    id: "AGM",
    label: "AGM / EGM",
    desc: "Annual or Extraordinary General Meeting",
    detail: "Resolutions, proxy voting, shareholder register, quorum tracking",
    icon: Vote, color: "#374151", bg: "#f3f4f6",
  },
  {
    id: "LAUNCH",
    label: "Product Launch",
    desc: "Brand or product launch event",
    detail: "Microsite, press kit, embargo settings, speaker profiles",
    icon: Rocket, color: "#b45309", bg: "#fffbeb",
  },
  {
    id: "HACKATHON",
    label: "Innovation Challenge",
    desc: "Innovation challenge or competition",
    detail: "Team registration, judging criteria, prize tiers, submission portal",
    icon: Zap, color: "#7c22c9", bg: "#faf5ff",
  },
  {
    id: "GENERAL",
    label: "General Event",
    desc: "Investor day, conference, workshop or other",
    detail: "Speakers, audience targeting, capacity management",
    icon: CalendarDays, color: "#0f766e", bg: "#f0fdfa",
  },
];

export const STEPS: Record<ModuleId, { label: string; optional?: true }[]> = {
  AGM: [
    { label: "Meeting Basics" },
    { label: "Agenda", optional: true },
    { label: "Notice", optional: true },
    { label: "Resolutions" },
    { label: "Shareholders" },
    { label: "Review" },
  ],
  LAUNCH: [
    { label: "Event Basics" },
    { label: "Product Details" },
    { label: "Speakers", optional: true },
    { label: "Embargo & Audience" },
    { label: "Review" },
  ],
  HACKATHON: [
    { label: "Challenge Basics" },
    { label: "Brief & Rules" },
    { label: "Teams & Eligibility" },
    { label: "Prizes & Judging" },
    { label: "Review" },
  ],
  GENERAL: [
    { label: "Event Basics" },
    { label: "Audience & Settings" },
    { label: "Review" },
  ],
};

export const STEP_META: Record<ModuleId, { title: string; subtitle: string }[]> = {
  AGM: [
    { title: "Meeting Basics",          subtitle: "Core details for your Annual or Extraordinary General Meeting" },
    { title: "Agenda",                  subtitle: "Build the meeting agenda — add items or skip to configure later" },
    { title: "Notice",                  subtitle: "Upload the statutory notice for the meeting" },
    { title: "Resolutions",             subtitle: "List all ordinary and special resolutions to be voted on" },
    { title: "Shareholders & Voting",   subtitle: "Configure shareholder targeting, proxy voting and KYC" },
    { title: "Review & Publish",        subtitle: "Confirm all details before creating the meeting" },
  ],
  LAUNCH: [
    { title: "Event Basics",            subtitle: "Core details for your product launch event" },
    { title: "Product Details",         subtitle: "Tell us about the product and the microsite slug" },
    { title: "Speakers",                subtitle: "Add presenters or keynote speakers — skip if none yet" },
    { title: "Embargo & Audience",      subtitle: "Set document release timing and who can register" },
    { title: "Review & Publish",        subtitle: "Confirm all details before creating the launch" },
  ],
  HACKATHON: [
    { title: "Challenge Basics",        subtitle: "Core details for your Innovation Challenge" },
    { title: "Brief & Rules",           subtitle: "Define the problem statement and expected deliverable" },
    { title: "Teams & Eligibility",     subtitle: "Who can participate and in what formation" },
    { title: "Prizes & Judging",        subtitle: "Set up prize tiers and judging criteria" },
    { title: "Review & Publish",        subtitle: "Confirm all details before creating the challenge" },
  ],
  GENERAL: [
    { title: "Event Basics",            subtitle: "Core details for your event" },
    { title: "Audience & Settings",     subtitle: "Who can register and how many" },
    { title: "Review & Publish",        subtitle: "Confirm all details before creating the event" },
  ],
};

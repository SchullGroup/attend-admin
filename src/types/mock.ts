import { Type } from "lucide-react";

export type EventModule = "AGM" | "LAUNCH" | "HACKATHON" | "GENERAL";
export type EventStatus =
  | "draft"
  | "published"
  | "live"
  | "ended"
  | "cancelled";
export type ParticipantStatus = "active" | "pending" | "suspended";
export type KYCStatus = "none" | "basic" | "pending" | "full";
export type ApplicationStatus =
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "selected"
  | "not_progressed";
export type StakeholderStatus = "active" | "suspended" | "pending";

export type Organiser = {
  name: string;
  rcNumber: string;
  email: string;
  contactEmail: string;
  phone: string;
  logo: string;
  id: string;
  status: string;
  industry: string;
  plan: string;
  enrolledAt: string;
  eventsCount: number;
};
export interface Stakeholder {
  id: string;
  name: string;
  industry: string;
  rcNumber: string;
  contactEmail: string;
  plan: "enterprise" | "growth" | "starter";
  eventsCount: number;
  status: StakeholderStatus;
  enrolledAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "event_manager" | "kyc_officer" | "judge";
  avatar?: string;
}

export interface AttendEvent {
  id: string;
  module: EventModule;
  title: string;
  organiser: string;
  status: EventStatus;
  date: string;
  startTime: string;
  endTime: string;
  format: "virtual" | "hybrid" | "in-person";
  venue?: string;
  rsvpCount: number;
  capacity?: number;
  color: string;
  createdAt: string;
}

export interface Participant {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  kycStatus: KYCStatus;
  status: ParticipantStatus;
  eventsAttended: number;
  registeredAt: string;
  bvn?: string;
  chn?: string;
}

export interface HackathonApplication {
  id: string;
  eventId: string;
  teamName: string;
  ideaTitle: string;
  track: string;
  status: ApplicationStatus;
  memberCount: number;
  submittedAt: string;
  score?: number;
}

export interface AppDocument {
  id: string;
  title: string;
  type:
    | "notice"
    | "agenda"
    | "minutes"
    | "report"
    | "certificate"
    | "press_kit";
  eventId: string;
  eventTitle: string;
  fileSize: string;
  uploadedAt: string;
  downloadCount: number;
}

export type AgendaItem = {
  id: string;
  title: string;
  durationMinutes?: number;
  isCurrent?: boolean;
  time?: string;
  speaker?: string;

  // Type '(AgendaItem | { id: string; time: string; title: string; speaker: string; })[]' is not assignable to type 'AgendaItem[]'.
  // Type 'AgendaItem | { id: string; time: string; title: string; speaker: string; }' is not assignable to type 'AgendaItem'.
  //   Type '{ id: string; time: string; title: string; speaker: string; }' is missing the following properties from type 'AgendaItem': durationMinutes, isCurrentts(2345)
};

export interface LiveVote {
  resolutionId: string;
  title: string;
  for: number;
  against: number;
  abstain: number;
  status: "pending" | "open" | "closed";
  durationSeconds?: number;
  proxyVotes?: { for: number; against: number; abstain: number };
  totalVotes?: number;
  result?: string | null;
}

export interface LivePoll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
  status: "draft" | "active" | "closed";
}

export interface LiveAgendaItem {
  id: string;
  title: string;
  durationMinutes: number;
  isCurrent: boolean;
}

export interface LiveQAItem {
  id: string;
  name: string;
  question: string;
  approved: boolean | null;
  time: string;
}

export interface LiveRecentJoin {
  name: string;
  time: string;
  method: "Virtual" | "In-person";
}

export interface LiveSession {
  id: string;
  eventId: string;
  eventTitle: string;
  organiser: string;
  module: EventModule;
  color: string;
  format: "virtual" | "hybrid" | "in-person";
  venue?: string;
  attendees: number;
  capacity?: number;
  elapsedMinutes: number;
  quorumPct: number | null;
  votes: LiveVote[];
  polls: LivePoll[];
  agendaItems: LiveAgendaItem[];
  pressKitReleased?: boolean;
  winnerTeam?: string;
  qaQueue: LiveQAItem[];
  recentJoins: LiveRecentJoin[];
  status?: string;
}

export type ProxyVoteEntry = {
  for: number;
  against: number;
  abstain: number;
  minutes?: number;
  forUnits?: number;
  againstUnits?: number;
  abstainUnits?: number;
};

export type Registrar = {
  id: string;
  name: string;
  repName: string;
  repEmail: string;
  repPhone: string;
  rcNumber: string;
  email: string;
  contactEmail: string;
  phone: string;
  logo: string;
  status: StakeholderStatus;
  industry: string;
  plan: string;
  enrolledAt: string;
  eventsCount: number;
  registersCount: number;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "Viewer" | "Admin" | "Editor" | "Judge" | "Event Manager";
  avatar?: string;
  joinedAt: string;
};

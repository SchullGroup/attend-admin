export type EventModule = "AGM" | "LAUNCH" | "HACKATHON" | "GENERAL";
export type EventStatus = "draft" | "published" | "live" | "ended" | "cancelled";
export type ParticipantStatus = "active" | "pending" | "suspended";
export type KYCStatus = "none" | "basic" | "pending" | "full";
export type ApplicationStatus = "submitted" | "under_review" | "shortlisted" | "selected" | "not_progressed";

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
  type: "notice" | "agenda" | "minutes" | "report" | "certificate" | "press_kit";
  eventId: string;
  eventTitle: string;
  fileSize: string;
  uploadedAt: string;
  downloadCount: number;
}

export interface LiveVote {
  resolutionId: string;
  title: string;
  for: number;
  against: number;
  abstain: number;
  status: "pending" | "open" | "closed";
}

export const CURRENT_ADMIN: AdminUser = {
  id: "adm_001",
  name: "Stanley Jacob",
  email: "stanley.jacob@meristem.com",
  role: "super_admin",
};

export const MOCK_EVENTS: AttendEvent[] = [
  { id: "evt_001", module: "AGM", title: "Zenith Bank Plc — 2026 Annual General Meeting", organiser: "Zenith Bank Plc", status: "published", date: "2026-05-28", startTime: "10:00", endTime: "14:00", format: "hybrid", venue: "Civic Centre, Victoria Island", rsvpCount: 2847, capacity: 5000, color: "#1a6b3c", createdAt: "2026-04-01T09:00:00Z" },
  { id: "evt_002", module: "AGM", title: "GTCo Holdings — 2026 EGM: Rights Issue Approval", organiser: "GTCo Holdings", status: "published", date: "2026-06-10", startTime: "11:00", endTime: "13:00", format: "virtual", rsvpCount: 6102, capacity: 10000, color: "#f97316", createdAt: "2026-04-15T09:00:00Z" },
  { id: "evt_003", module: "AGM", title: "Dangote Cement Plc — 2026 Annual General Meeting", organiser: "Dangote Cement Plc", status: "draft", date: "2026-07-05", startTime: "10:00", endTime: "13:00", format: "hybrid", venue: "Transcorp Hilton, Abuja", rsvpCount: 1200, capacity: 3000, color: "#6366f1", createdAt: "2026-05-01T09:00:00Z" },
  { id: "evt_004", module: "LAUNCH", title: "Meristem Wealth — MeriSave Product Launch", organiser: "Meristem Wealth Management", status: "published", date: "2026-06-15", startTime: "14:00", endTime: "16:30", format: "virtual", rsvpCount: 1843, color: "#f97316", createdAt: "2026-04-20T09:00:00Z" },
  { id: "evt_005", module: "HACKATHON", title: "MeriHack 2026 — FinTech Innovation Challenge", organiser: "Meristem Innovation Hub", status: "published", date: "2026-07-20", startTime: "09:00", endTime: "18:00", format: "in-person", venue: "Victoria Island, Lagos", rsvpCount: 412, capacity: 500, color: "#9333ea", createdAt: "2026-03-01T09:00:00Z" },
  { id: "evt_006", module: "GENERAL", title: "FintechNGR Regulatory Roundtable 2026", organiser: "FintechNGR Association", status: "live", date: "2026-05-21", startTime: "09:00", endTime: "17:00", format: "hybrid", venue: "Eko Hotel, Lagos", rsvpCount: 340, capacity: 400, color: "#2563eb", createdAt: "2026-04-10T09:00:00Z" },
];

export const MOCK_PARTICIPANTS: Participant[] = [
  { id: "usr_001", fullName: "Ngozi Okafor", email: "ngozi.okafor@email.com", phone: "+2348012345678", kycStatus: "full", status: "active", eventsAttended: 4, registeredAt: "2026-01-15T10:00:00Z", bvn: "22312345678", chn: "CHN123456789" },
  { id: "usr_002", fullName: "Emeka Eze", email: "emeka.eze@gtco.com", phone: "+2348023456789", kycStatus: "full", status: "active", eventsAttended: 2, registeredAt: "2026-02-10T10:00:00Z", bvn: "22398765432", chn: "CHN987654321" },
  { id: "usr_003", fullName: "Chidera Obi", email: "chidera.obi@fintech.ng", phone: "+2348034567890", kycStatus: "basic", status: "active", eventsAttended: 1, registeredAt: "2026-03-05T10:00:00Z" },
  { id: "usr_004", fullName: "Tolu Adeyemi", email: "tolu@unilag.edu.ng", phone: "+2348045678901", kycStatus: "none", status: "pending", eventsAttended: 0, registeredAt: "2026-04-20T10:00:00Z" },
  { id: "usr_005", fullName: "Biodun Adeola", email: "biodun.adeola@insurance.ng", phone: "+2348056789012", kycStatus: "pending", status: "active", eventsAttended: 3, registeredAt: "2026-01-30T10:00:00Z" },
  { id: "usr_006", fullName: "Adaeze Nwosu", email: "adaeze.nwosu@gmail.com", phone: "+447890123456", kycStatus: "full", status: "active", eventsAttended: 6, registeredAt: "2025-12-01T10:00:00Z", bvn: "22311111111", chn: "CHN111111111" },
  { id: "usr_007", fullName: "Kola Adesanya", email: "kola.adesanya@bank.ng", phone: "+2348067890123", kycStatus: "pending", status: "pending", eventsAttended: 0, registeredAt: "2026-05-10T10:00:00Z" },
  { id: "usr_008", fullName: "Funmi Bello", email: "funmi.bello@corp.com", phone: "+2348078901234", kycStatus: "basic", status: "active", eventsAttended: 2, registeredAt: "2026-02-28T10:00:00Z" },
];

export const MOCK_APPLICATIONS: HackathonApplication[] = [
  { id: "app_001", eventId: "evt_005", teamName: "FinFlow", ideaTitle: "InvestEasy — Fractional Share Platform", track: "Capital Market Access", status: "shortlisted", memberCount: 3, submittedAt: "2026-07-01T10:30:00Z", score: 82 },
  { id: "app_002", eventId: "evt_005", teamName: "SaveMore", ideaTitle: "AutoSave — AI-Powered Savings Coach", track: "Digital Savings & Investment", status: "shortlisted", memberCount: 4, submittedAt: "2026-07-02T14:00:00Z", score: 78 },
  { id: "app_003", eventId: "evt_005", teamName: "RegGuard", ideaTitle: "ComplianceAI — Real-Time Regulatory Monitoring", track: "RegTech & Compliance", status: "under_review", memberCount: 2, submittedAt: "2026-07-03T09:00:00Z" },
  { id: "app_004", eventId: "evt_005", teamName: "NGX Direct", ideaTitle: "DirectInvest — Zero-Commission NGX Trading App", track: "Capital Market Access", status: "under_review", memberCount: 3, submittedAt: "2026-07-03T16:00:00Z" },
  { id: "app_005", eventId: "evt_005", teamName: "PocketVault", ideaTitle: "PocketVault — Community Savings & Lending", track: "Digital Savings & Investment", status: "submitted", memberCount: 5, submittedAt: "2026-07-05T11:00:00Z" },
  { id: "app_006", eventId: "evt_005", teamName: "AuditBot", ideaTitle: "AuditBot — Automated ESG Compliance Reporter", track: "RegTech & Compliance", status: "submitted", memberCount: 2, submittedAt: "2026-07-06T08:30:00Z" },
];

export const MOCK_DOCUMENTS: AppDocument[] = [
  { id: "doc_001", title: "Zenith Bank 2026 AGM Notice", type: "notice", eventId: "evt_001", eventTitle: "Zenith Bank Plc — 2026 AGM", fileSize: "1.2 MB", uploadedAt: "2026-05-01T09:00:00Z", downloadCount: 1423 },
  { id: "doc_002", title: "Zenith Bank 2026 AGM Agenda", type: "agenda", eventId: "evt_001", eventTitle: "Zenith Bank Plc — 2026 AGM", fileSize: "0.4 MB", uploadedAt: "2026-05-01T09:00:00Z", downloadCount: 1201 },
  { id: "doc_003", title: "Zenith Bank 2025 Annual Report", type: "report", eventId: "evt_001", eventTitle: "Zenith Bank Plc — 2026 AGM", fileSize: "8.7 MB", uploadedAt: "2026-04-28T09:00:00Z", downloadCount: 890 },
  { id: "doc_004", title: "GTCo EGM Rights Issue Circular", type: "notice", eventId: "evt_002", eventTitle: "GTCo Holdings — 2026 EGM", fileSize: "2.1 MB", uploadedAt: "2026-05-15T09:00:00Z", downloadCount: 3201 },
  { id: "doc_005", title: "MeriSave Press Kit", type: "press_kit", eventId: "evt_004", eventTitle: "MeriSave Product Launch", fileSize: "15.4 MB", uploadedAt: "2026-06-10T09:00:00Z", downloadCount: 0 },
  { id: "doc_006", title: "MeriHack 2026 Challenge Brief", type: "notice", eventId: "evt_005", eventTitle: "MeriHack 2026", fileSize: "3.2 MB", uploadedAt: "2026-06-01T09:00:00Z", downloadCount: 567 },
];

export const MOCK_LIVE_VOTES: LiveVote[] = [
  { resolutionId: "res_001", title: "Adoption of Financial Statements", for: 4200000, against: 50000, abstain: 20000, status: "closed" },
  { resolutionId: "res_002", title: "Declaration of Final Dividend of ₦3.50/share", for: 4180000, against: 70000, abstain: 20000, status: "closed" },
  { resolutionId: "res_003", title: "Re-election of Directors", for: 2100000, against: 340000, abstain: 95000, status: "open" },
  { resolutionId: "res_004", title: "Appointment of PricewaterhouseCoopers as Auditors", for: 0, against: 0, abstain: 0, status: "pending" },
];

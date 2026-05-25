export type EventModule = "AGM" | "LAUNCH" | "HACKATHON" | "GENERAL";
export type EventStatus = "draft" | "published" | "live" | "ended" | "cancelled";
export type ParticipantStatus = "active" | "pending" | "suspended";
export type KYCStatus = "none" | "basic" | "pending" | "full";
export type ApplicationStatus = "submitted" | "under_review" | "shortlisted" | "selected" | "not_progressed";
export type StakeholderStatus = "active" | "suspended" | "pending";

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
  qaQueue: LiveQAItem[];
  recentJoins: LiveRecentJoin[];
}

export const CURRENT_ADMIN: AdminUser = {
  id: "adm_001",
  name: "Stanley Jacob",
  email: "stanley.jacob@meristem.com",
  role: "super_admin",
};

export const MOCK_STAKEHOLDERS: Stakeholder[] = [
  { id: "stk_001", name: "Zenith Bank Plc", industry: "Banking", rcNumber: "RC 84269", contactEmail: "corp@zenithbank.com", plan: "enterprise", eventsCount: 3, status: "active", enrolledAt: "2025-11-01" },
  { id: "stk_002", name: "GTCo Holdings", industry: "Banking", rcNumber: "RC 152321", contactEmail: "ir@gtcoplc.com", plan: "enterprise", eventsCount: 2, status: "active", enrolledAt: "2025-12-01" },
  { id: "stk_003", name: "Dangote Cement Plc", industry: "Manufacturing", rcNumber: "RC 177839", contactEmail: "investor.relations@dangote.com", plan: "growth", eventsCount: 1, status: "active", enrolledAt: "2026-01-15" },
  { id: "stk_004", name: "Meristem Innovation Hub", industry: "Financial Services", rcNumber: "RC 400201", contactEmail: "hub@meristem.com", plan: "enterprise", eventsCount: 2, status: "active", enrolledAt: "2026-02-01" },
  { id: "stk_005", name: "FintechNGR Association", industry: "FinTech", rcNumber: "RC 510044", contactEmail: "admin@fintechngr.org", plan: "starter", eventsCount: 1, status: "active", enrolledAt: "2026-04-10" },
  { id: "stk_006", name: "Access Bank Plc", industry: "Banking", rcNumber: "RC 125384", contactEmail: "ir@accessbankplc.com", plan: "enterprise", eventsCount: 2, status: "active", enrolledAt: "2025-10-15" },
  { id: "stk_007", name: "Stanbic IBTC Holdings", industry: "Banking & Insurance", rcNumber: "RC 327058", contactEmail: "stakeholders@stanbicibtc.com", plan: "growth", eventsCount: 2, status: "active", enrolledAt: "2026-01-05" },
  { id: "stk_008", name: "Nigerian Breweries Plc", industry: "FMCG", rcNumber: "RC 613", contactEmail: "investorrelations@nb.heineken.com", plan: "growth", eventsCount: 1, status: "suspended", enrolledAt: "2025-12-20" },
  { id: "stk_009", name: "Meristem Wealth Management", industry: "Financial Services", rcNumber: "RC 400199", contactEmail: "wealth@meristem.com", plan: "growth", eventsCount: 2, status: "active", enrolledAt: "2026-01-20" },
  { id: "stk_010", name: "AIICO Insurance Plc", industry: "Insurance", rcNumber: "RC 2479", contactEmail: "cosec@aiicoplc.com", plan: "starter", eventsCount: 0, status: "pending", enrolledAt: "2026-05-22" },
  { id: "stk_011", name: "Seplat Energy Plc", industry: "Oil & Gas", rcNumber: "RC 908631", contactEmail: "investors@seplatnigeria.com", plan: "enterprise", eventsCount: 1, status: "active", enrolledAt: "2026-03-10" },
  { id: "stk_012", name: "BUA Foods Plc", industry: "FMCG", rcNumber: "RC 1762", contactEmail: "investorrelations@buafoods.com", plan: "starter", eventsCount: 0, status: "pending", enrolledAt: "2026-05-24" },
];

export const MOCK_EVENTS: AttendEvent[] = [
  { id: "evt_001", module: "AGM", title: "Zenith Bank Plc — 2026 Annual General Meeting", organiser: "Zenith Bank Plc", status: "live", date: "2026-05-25", startTime: "10:00", endTime: "14:00", format: "hybrid", venue: "Civic Centre, Victoria Island", rsvpCount: 2847, capacity: 5000, color: "#1a6b3c", createdAt: "2026-04-01T09:00:00Z" },
  { id: "evt_002", module: "AGM", title: "GTCo Holdings — 2026 EGM: Rights Issue Approval", organiser: "GTCo Holdings", status: "published", date: "2026-06-10", startTime: "11:00", endTime: "13:00", format: "virtual", rsvpCount: 6102, capacity: 10000, color: "#f97316", createdAt: "2026-04-15T09:00:00Z" },
  { id: "evt_003", module: "AGM", title: "Dangote Cement Plc — 2026 Annual General Meeting", organiser: "Dangote Cement Plc", status: "draft", date: "2026-07-05", startTime: "10:00", endTime: "13:00", format: "hybrid", venue: "Transcorp Hilton, Abuja", rsvpCount: 1200, capacity: 3000, color: "#6366f1", createdAt: "2026-05-01T09:00:00Z" },
  { id: "evt_004", module: "LAUNCH", title: "Meristem Wealth — MeriSave Product Launch", organiser: "Meristem Wealth Management", status: "published", date: "2026-06-15", startTime: "14:00", endTime: "16:30", format: "virtual", rsvpCount: 1843, color: "#f97316", createdAt: "2026-04-20T09:00:00Z" },
  { id: "evt_005", module: "HACKATHON", title: "MeriHack 2026 — FinTech Innovation Challenge", organiser: "Meristem Innovation Hub", status: "published", date: "2026-07-20", startTime: "09:00", endTime: "18:00", format: "in-person", venue: "Victoria Island, Lagos", rsvpCount: 412, capacity: 500, color: "#9333ea", createdAt: "2026-03-01T09:00:00Z" },
  { id: "evt_006", module: "GENERAL", title: "FintechNGR Regulatory Roundtable 2026", organiser: "FintechNGR Association", status: "live", date: "2026-05-25", startTime: "09:00", endTime: "17:00", format: "hybrid", venue: "Eko Hotel, Lagos", rsvpCount: 340, capacity: 400, color: "#2563eb", createdAt: "2026-04-10T09:00:00Z" },
  { id: "evt_007", module: "AGM", title: "Access Bank Plc — 2026 Annual General Meeting", organiser: "Access Bank Plc", status: "published", date: "2026-06-20", startTime: "10:00", endTime: "14:00", format: "hybrid", venue: "Lagos Continental Hotel, VI", rsvpCount: 4510, capacity: 8000, color: "#1a6b3c", createdAt: "2026-04-05T09:00:00Z" },
  { id: "evt_008", module: "AGM", title: "Stanbic IBTC Holdings — 2025 Annual General Meeting", organiser: "Stanbic IBTC Holdings", status: "ended", date: "2025-12-10", startTime: "10:00", endTime: "13:30", format: "hybrid", venue: "MUSON Centre, Onikan", rsvpCount: 3120, capacity: 5000, color: "#6366f1", createdAt: "2025-10-01T09:00:00Z" },
  { id: "evt_009", module: "LAUNCH", title: "Access Bank — DigiCredit SME Loan Launch", organiser: "Access Bank Plc", status: "draft", date: "2026-07-01", startTime: "13:00", endTime: "15:00", format: "virtual", rsvpCount: 0, color: "#f97316", createdAt: "2026-05-10T09:00:00Z" },
  { id: "evt_010", module: "GENERAL", title: "Capital Market Development Forum 2026", organiser: "FintechNGR Association", status: "ended", date: "2026-04-18", startTime: "09:00", endTime: "16:00", format: "in-person", venue: "Sheraton Hotels, Abuja", rsvpCount: 627, capacity: 700, color: "#2563eb", createdAt: "2026-03-15T09:00:00Z" },
  { id: "evt_011", module: "HACKATHON", title: "RegTech Challenge 2026 — Open Banking Edition", organiser: "Meristem Innovation Hub", status: "draft", date: "2026-09-15", startTime: "09:00", endTime: "18:00", format: "hybrid", venue: "Co-Creation Hub, Yaba", rsvpCount: 0, capacity: 300, color: "#9333ea", createdAt: "2026-05-15T09:00:00Z" },
  { id: "evt_012", module: "AGM", title: "Nigerian Breweries Plc — 2025 Annual General Meeting", organiser: "Nigerian Breweries Plc", status: "ended", date: "2025-11-25", startTime: "10:00", endTime: "12:30", format: "virtual", rsvpCount: 8940, capacity: 15000, color: "#6366f1", createdAt: "2025-09-10T09:00:00Z" },
  { id: "evt_013", module: "LAUNCH", title: "Meristem Securities — NextGen Trading Platform Launch", organiser: "Meristem Wealth Management", status: "published", date: "2026-08-05", startTime: "14:00", endTime: "16:00", format: "virtual", rsvpCount: 924, color: "#f97316", createdAt: "2026-05-05T09:00:00Z" },
  { id: "evt_014", module: "GENERAL", title: "ESG Investment Summit — Nigeria 2026", organiser: "Seplat Energy Plc", status: "published", date: "2026-06-28", startTime: "09:00", endTime: "17:00", format: "in-person", venue: "Transcorp Hilton, Abuja", rsvpCount: 412, capacity: 600, color: "#2563eb", createdAt: "2026-04-25T09:00:00Z" },
  { id: "evt_015", module: "AGM", title: "GTCo Holdings — 2025 Annual General Meeting", organiser: "GTCo Holdings", status: "ended", date: "2025-10-22", startTime: "10:00", endTime: "13:00", format: "hybrid", venue: "Civic Centre, Victoria Island", rsvpCount: 7280, capacity: 12000, color: "#f97316", createdAt: "2025-08-15T09:00:00Z" },
  { id: "evt_016", module: "AGM", title: "Zenith Bank Plc — 2025 Annual General Meeting", organiser: "Zenith Bank Plc", status: "ended", date: "2025-05-30", startTime: "10:00", endTime: "14:00", format: "hybrid", venue: "Civic Centre, Victoria Island", rsvpCount: 5102, capacity: 8000, color: "#1a6b3c", createdAt: "2025-03-20T09:00:00Z" },
  { id: "evt_017", module: "AGM", title: "Stanbic IBTC Holdings — 2026 Annual General Meeting", organiser: "Stanbic IBTC Holdings", status: "published", date: "2026-07-15", startTime: "10:00", endTime: "13:30", format: "hybrid", venue: "Balmoral Convention Centre, Lagos", rsvpCount: 2670, capacity: 5000, color: "#6366f1", createdAt: "2026-05-01T09:00:00Z" },
  { id: "evt_018", module: "GENERAL", title: "Seplat Energy — Investor Day 2026", organiser: "Seplat Energy Plc", status: "live", date: "2026-05-25", startTime: "10:00", endTime: "16:00", format: "virtual", rsvpCount: 1180, color: "#2563eb", createdAt: "2026-04-20T09:00:00Z" },
  { id: "evt_019", module: "LAUNCH", title: "Zenith Bank — Zenith SME Connect Launch", organiser: "Zenith Bank Plc", status: "cancelled", date: "2026-05-15", startTime: "10:00", endTime: "12:00", format: "virtual", rsvpCount: 340, color: "#f97316", createdAt: "2026-04-10T09:00:00Z" },
];

export const MOCK_PARTICIPANTS: Participant[] = [
  { id: "usr_001", fullName: "Ngozi Okafor", email: "ngozi.okafor@email.com", phone: "+2348012345678", kycStatus: "full", status: "active", eventsAttended: 7, registeredAt: "2026-01-15T10:00:00Z", bvn: "22312345678", chn: "CHN123456789" },
  { id: "usr_002", fullName: "Emeka Eze", email: "emeka.eze@gtco.com", phone: "+2348023456789", kycStatus: "full", status: "active", eventsAttended: 4, registeredAt: "2026-02-10T10:00:00Z", bvn: "22398765432", chn: "CHN987654321" },
  { id: "usr_003", fullName: "Chidera Obi", email: "chidera.obi@fintech.ng", phone: "+2348034567890", kycStatus: "basic", status: "active", eventsAttended: 2, registeredAt: "2026-03-05T10:00:00Z" },
  { id: "usr_004", fullName: "Tolu Adeyemi", email: "tolu@unilag.edu.ng", phone: "+2348045678901", kycStatus: "none", status: "pending", eventsAttended: 0, registeredAt: "2026-04-20T10:00:00Z" },
  { id: "usr_005", fullName: "Biodun Adeola", email: "biodun.adeola@insurance.ng", phone: "+2348056789012", kycStatus: "pending", status: "active", eventsAttended: 3, registeredAt: "2026-01-30T10:00:00Z" },
  { id: "usr_006", fullName: "Adaeze Nwosu", email: "adaeze.nwosu@gmail.com", phone: "+447890123456", kycStatus: "full", status: "active", eventsAttended: 9, registeredAt: "2025-12-01T10:00:00Z", bvn: "22311111111", chn: "CHN111111111" },
  { id: "usr_007", fullName: "Kola Adesanya", email: "kola.adesanya@bank.ng", phone: "+2348067890123", kycStatus: "pending", status: "pending", eventsAttended: 0, registeredAt: "2026-05-10T10:00:00Z" },
  { id: "usr_008", fullName: "Funmi Bello", email: "funmi.bello@corp.com", phone: "+2348078901234", kycStatus: "basic", status: "active", eventsAttended: 2, registeredAt: "2026-02-28T10:00:00Z" },
  { id: "usr_009", fullName: "Babatunde Lawal", email: "babatunde.lawal@access.ng", phone: "+2348089012345", kycStatus: "full", status: "active", eventsAttended: 5, registeredAt: "2025-11-20T10:00:00Z", bvn: "22344455566", chn: "CHN444555666" },
  { id: "usr_010", fullName: "Yetunde Abiodun", email: "yetunde.abiodun@stanbic.com", phone: "+2348090123456", kycStatus: "full", status: "active", eventsAttended: 6, registeredAt: "2025-10-15T10:00:00Z", bvn: "22377788899", chn: "CHN777888999" },
  { id: "usr_011", fullName: "Chukwuemeka Ogbu", email: "c.ogbu@dangote.com", phone: "+2348011234567", kycStatus: "basic", status: "active", eventsAttended: 1, registeredAt: "2026-04-01T10:00:00Z" },
  { id: "usr_012", fullName: "Aisha Musa", email: "aisha.musa@seplat.com", phone: "+2347022334455", kycStatus: "full", status: "active", eventsAttended: 3, registeredAt: "2026-02-15T10:00:00Z", bvn: "22366677788", chn: "CHN666777888" },
  { id: "usr_013", fullName: "Oluwaseun Adeleke", email: "seun.adeleke@nb.com", phone: "+2347033445566", kycStatus: "pending", status: "suspended", eventsAttended: 2, registeredAt: "2026-01-10T10:00:00Z" },
  { id: "usr_014", fullName: "Ifeanyi Chukwu", email: "ifeanyi.c@merithack.ng", phone: "+2347044556677", kycStatus: "none", status: "active", eventsAttended: 0, registeredAt: "2026-05-01T10:00:00Z" },
  { id: "usr_015", fullName: "Chiamaka Eze", email: "chiamaka.eze@uba.com", phone: "+2347055667788", kycStatus: "full", status: "active", eventsAttended: 4, registeredAt: "2026-01-05T10:00:00Z", bvn: "22355544433", chn: "CHN555444333" },
  { id: "usr_016", fullName: "Musa Abdullahi", email: "musa.abdullahi@jaiz.com", phone: "+2347066778899", kycStatus: "basic", status: "active", eventsAttended: 1, registeredAt: "2026-03-20T10:00:00Z" },
  { id: "usr_017", fullName: "Rukayat Oduola", email: "rukayat.oduola@gmail.com", phone: "+2347077889900", kycStatus: "none", status: "pending", eventsAttended: 0, registeredAt: "2026-05-18T10:00:00Z" },
  { id: "usr_018", fullName: "Gbenga Falola", email: "gbenga.falola@fintechngr.org", phone: "+2347088990011", kycStatus: "full", status: "active", eventsAttended: 8, registeredAt: "2025-09-10T10:00:00Z", bvn: "22322233344", chn: "CHN222333444" },
  { id: "usr_019", fullName: "Obiageli Onuoha", email: "obi.onuoha@aiico.com", phone: "+2347099001122", kycStatus: "basic", status: "active", eventsAttended: 2, registeredAt: "2026-04-12T10:00:00Z" },
  { id: "usr_020", fullName: "Chinyere Okonkwo", email: "chinyere.okonkwo@zenith.ng", phone: "+2348100112233", kycStatus: "full", status: "active", eventsAttended: 5, registeredAt: "2025-12-10T10:00:00Z", bvn: "22388899900", chn: "CHN888999000" },
  { id: "usr_021", fullName: "Samuel Adedokun", email: "samuel.adedokun@outlook.com", phone: "+2348111223344", kycStatus: "pending", status: "active", eventsAttended: 1, registeredAt: "2026-05-05T10:00:00Z" },
  { id: "usr_022", fullName: "Fatima Al-Hassan", email: "fatima.alhassan@abuja.gov.ng", phone: "+2348122334455", kycStatus: "none", status: "pending", eventsAttended: 0, registeredAt: "2026-05-20T10:00:00Z" },
  { id: "usr_023", fullName: "Tosin Ogunleye", email: "tosin.ogunleye@gtco.com", phone: "+2348133445566", kycStatus: "full", status: "active", eventsAttended: 6, registeredAt: "2025-11-01T10:00:00Z", bvn: "22311122233", chn: "CHN111222333" },
  { id: "usr_024", fullName: "Nnamdi Obi", email: "nnamdi.obi@cchub.io", phone: "+2348144556677", kycStatus: "basic", status: "active", eventsAttended: 3, registeredAt: "2026-03-01T10:00:00Z" },
  { id: "usr_025", fullName: "Sola Akintunde", email: "sola.akintunde@accessbank.ng", phone: "+2348155667788", kycStatus: "pending", status: "active", eventsAttended: 1, registeredAt: "2026-04-28T10:00:00Z" },
];

export const MOCK_APPLICATIONS: HackathonApplication[] = [
  { id: "app_001", eventId: "evt_005", teamName: "FinFlow", ideaTitle: "InvestEasy — Fractional Share Platform", track: "Capital Market Access", status: "shortlisted", memberCount: 3, submittedAt: "2026-07-01T10:30:00Z", score: 82 },
  { id: "app_002", eventId: "evt_005", teamName: "SaveMore", ideaTitle: "AutoSave — AI-Powered Savings Coach", track: "Digital Savings & Investment", status: "shortlisted", memberCount: 4, submittedAt: "2026-07-02T14:00:00Z", score: 78 },
  { id: "app_003", eventId: "evt_005", teamName: "RegGuard", ideaTitle: "ComplianceAI — Real-Time Regulatory Monitoring", track: "RegTech & Compliance", status: "under_review", memberCount: 2, submittedAt: "2026-07-03T09:00:00Z" },
  { id: "app_004", eventId: "evt_005", teamName: "NGX Direct", ideaTitle: "DirectInvest — Zero-Commission NGX Trading App", track: "Capital Market Access", status: "under_review", memberCount: 3, submittedAt: "2026-07-03T16:00:00Z" },
  { id: "app_005", eventId: "evt_005", teamName: "PocketVault", ideaTitle: "PocketVault — Community Savings & Lending", track: "Digital Savings & Investment", status: "submitted", memberCount: 5, submittedAt: "2026-07-05T11:00:00Z" },
  { id: "app_006", eventId: "evt_005", teamName: "AuditBot", ideaTitle: "AuditBot — Automated ESG Compliance Reporter", track: "RegTech & Compliance", status: "submitted", memberCount: 2, submittedAt: "2026-07-06T08:30:00Z" },
  { id: "app_007", eventId: "evt_005", teamName: "CreditSense", ideaTitle: "CreditSense — Alternative Credit Scoring Engine", track: "Capital Market Access", status: "selected", memberCount: 4, submittedAt: "2026-06-30T14:00:00Z", score: 91 },
  { id: "app_008", eventId: "evt_005", teamName: "YieldX", ideaTitle: "YieldX — Municipal Bond Aggregation Platform", track: "Capital Market Access", status: "shortlisted", memberCount: 3, submittedAt: "2026-07-01T16:30:00Z", score: 75 },
  { id: "app_009", eventId: "evt_005", teamName: "InsureBase", ideaTitle: "InsureBase — Microinsurance Distribution API", track: "Digital Savings & Investment", status: "submitted", memberCount: 3, submittedAt: "2026-07-06T12:00:00Z" },
  { id: "app_010", eventId: "evt_005", teamName: "TaxIQ", ideaTitle: "TaxIQ — SME Tax Automation & Filing Platform", track: "RegTech & Compliance", status: "not_progressed", memberCount: 2, submittedAt: "2026-07-07T09:00:00Z" },
  { id: "app_011", eventId: "evt_005", teamName: "PensionLink", ideaTitle: "PensionLink — RSA Transfer & Tracking Dashboard", track: "Digital Savings & Investment", status: "under_review", memberCount: 4, submittedAt: "2026-07-04T10:00:00Z" },
  { id: "app_012", eventId: "evt_005", teamName: "BorderPay", ideaTitle: "BorderPay — Intra-Africa FX & Remittance Rail", track: "Capital Market Access", status: "submitted", memberCount: 5, submittedAt: "2026-07-07T15:30:00Z" },
];

export const MOCK_DOCUMENTS: AppDocument[] = [
  { id: "doc_001", title: "Zenith Bank 2026 AGM Notice", type: "notice", eventId: "evt_001", eventTitle: "Zenith Bank Plc — 2026 AGM", fileSize: "1.2 MB", uploadedAt: "2026-05-01T09:00:00Z", downloadCount: 1423 },
  { id: "doc_002", title: "Zenith Bank 2026 AGM Agenda", type: "agenda", eventId: "evt_001", eventTitle: "Zenith Bank Plc — 2026 AGM", fileSize: "0.4 MB", uploadedAt: "2026-05-01T09:00:00Z", downloadCount: 1201 },
  { id: "doc_003", title: "Zenith Bank 2025 Annual Report", type: "report", eventId: "evt_001", eventTitle: "Zenith Bank Plc — 2026 AGM", fileSize: "8.7 MB", uploadedAt: "2026-04-28T09:00:00Z", downloadCount: 890 },
  { id: "doc_004", title: "GTCo EGM Rights Issue Circular", type: "notice", eventId: "evt_002", eventTitle: "GTCo Holdings — 2026 EGM", fileSize: "2.1 MB", uploadedAt: "2026-05-15T09:00:00Z", downloadCount: 3201 },
  { id: "doc_005", title: "GTCo EGM Proxy Form", type: "agenda", eventId: "evt_002", eventTitle: "GTCo Holdings — 2026 EGM", fileSize: "0.3 MB", uploadedAt: "2026-05-15T09:00:00Z", downloadCount: 2874 },
  { id: "doc_006", title: "MeriSave Press Kit", type: "press_kit", eventId: "evt_004", eventTitle: "MeriSave Product Launch", fileSize: "15.4 MB", uploadedAt: "2026-06-10T09:00:00Z", downloadCount: 0 },
  { id: "doc_007", title: "MeriHack 2026 Challenge Brief", type: "notice", eventId: "evt_005", eventTitle: "MeriHack 2026", fileSize: "3.2 MB", uploadedAt: "2026-06-01T09:00:00Z", downloadCount: 567 },
  { id: "doc_008", title: "MeriHack 2026 Judging Criteria", type: "agenda", eventId: "evt_005", eventTitle: "MeriHack 2026", fileSize: "0.8 MB", uploadedAt: "2026-06-01T09:00:00Z", downloadCount: 412 },
  { id: "doc_009", title: "Access Bank 2026 AGM Notice of Meeting", type: "notice", eventId: "evt_007", eventTitle: "Access Bank Plc — 2026 AGM", fileSize: "1.8 MB", uploadedAt: "2026-05-20T09:00:00Z", downloadCount: 2108 },
  { id: "doc_010", title: "Access Bank 2026 AGM Agenda & Resolutions", type: "agenda", eventId: "evt_007", eventTitle: "Access Bank Plc — 2026 AGM", fileSize: "0.5 MB", uploadedAt: "2026-05-20T09:00:00Z", downloadCount: 1750 },
  { id: "doc_011", title: "Access Bank 2025 Annual Report & Accounts", type: "report", eventId: "evt_007", eventTitle: "Access Bank Plc — 2026 AGM", fileSize: "12.3 MB", uploadedAt: "2026-05-18T09:00:00Z", downloadCount: 980 },
  { id: "doc_012", title: "FintechNGR Roundtable Summary Report", type: "report", eventId: "evt_006", eventTitle: "FintechNGR Regulatory Roundtable 2026", fileSize: "2.4 MB", uploadedAt: "2026-05-23T09:00:00Z", downloadCount: 133 },
  { id: "doc_013", title: "Capital Market Forum 2026 — Minutes", type: "minutes", eventId: "evt_010", eventTitle: "Capital Market Development Forum 2026", fileSize: "1.1 MB", uploadedAt: "2026-04-25T09:00:00Z", downloadCount: 348 },
  { id: "doc_014", title: "ESG Investment Summit — Programme", type: "agenda", eventId: "evt_014", eventTitle: "ESG Investment Summit — Nigeria 2026", fileSize: "0.6 MB", uploadedAt: "2026-05-20T09:00:00Z", downloadCount: 204 },
  { id: "doc_015", title: "Stanbic IBTC 2025 AGM Meeting Minutes", type: "minutes", eventId: "evt_008", eventTitle: "Stanbic IBTC Holdings — 2025 AGM", fileSize: "1.9 MB", uploadedAt: "2025-12-20T09:00:00Z", downloadCount: 1620 },
  { id: "doc_016", title: "Stanbic IBTC 2026 AGM Notice", type: "notice", eventId: "evt_017", eventTitle: "Stanbic IBTC Holdings — 2026 AGM", fileSize: "1.4 MB", uploadedAt: "2026-05-15T09:00:00Z", downloadCount: 890 },
  { id: "doc_017", title: "MeriSave Investor Factsheet", type: "press_kit", eventId: "evt_004", eventTitle: "MeriSave Product Launch", fileSize: "4.2 MB", uploadedAt: "2026-06-12T09:00:00Z", downloadCount: 0 },
  { id: "doc_018", title: "MeriHack 2026 Participation Certificate Template", type: "certificate", eventId: "evt_005", eventTitle: "MeriHack 2026", fileSize: "0.2 MB", uploadedAt: "2026-06-15T09:00:00Z", downloadCount: 89 },
];

export const MOCK_LIVE_VOTES: LiveVote[] = [
  { resolutionId: "res_001", title: "Adoption of Financial Statements", for: 4200000, against: 50000, abstain: 20000, status: "closed" },
  { resolutionId: "res_002", title: "Declaration of Final Dividend of ₦3.50/share", for: 4180000, against: 70000, abstain: 20000, status: "closed" },
  { resolutionId: "res_003", title: "Re-election of Directors", for: 2100000, against: 340000, abstain: 95000, status: "open" },
  { resolutionId: "res_004", title: "Appointment of PricewaterhouseCoopers as Auditors", for: 0, against: 0, abstain: 0, status: "pending" },
];

export const MOCK_LIVE_SESSIONS: LiveSession[] = [
  {
    id: "sess_001",
    eventId: "evt_001",
    eventTitle: "Zenith Bank Plc — 2026 AGM",
    organiser: "Zenith Bank Plc",
    module: "AGM",
    color: "#1a6b3c",
    format: "hybrid",
    venue: "Civic Centre, Victoria Island",
    attendees: 1247,
    capacity: 5000,
    elapsedMinutes: 83,
    quorumPct: 58.4,
    votes: [
      { resolutionId: "res_001", title: "Adoption of Financial Statements", for: 4200000, against: 50000, abstain: 20000, status: "closed" },
      { resolutionId: "res_002", title: "Declaration of Final Dividend of ₦3.50/share", for: 4180000, against: 70000, abstain: 20000, status: "closed" },
      { resolutionId: "res_003", title: "Re-election of Directors", for: 2100000, against: 340000, abstain: 95000, status: "open" },
      { resolutionId: "res_004", title: "Appointment of PricewaterhouseCoopers as Auditors", for: 0, against: 0, abstain: 0, status: "pending" },
    ],
    qaQueue: [
      { id: "qa_s1_001", name: "Ngozi Okafor", question: "What is the plan for dividend payments in Q3 2026 given the current forex environment?", approved: null, time: "2m ago" },
      { id: "qa_s1_002", name: "Emeka Eze", question: "Can management comment on the NPL ratio improvement mentioned in the annual report?", approved: null, time: "5m ago" },
      { id: "qa_s1_003", name: "Biodun Adeola", question: "What are the Board's plans for digital banking expansion in francophone West Africa?", approved: null, time: "8m ago" },
    ],
    recentJoins: [
      { name: "Ngozi Okafor", time: "just now", method: "Virtual" },
      { name: "Emeka Eze", time: "1m ago", method: "Virtual" },
      { name: "Chidera Obi", time: "2m ago", method: "In-person" },
      { name: "Tolu Adeyemi", time: "3m ago", method: "Virtual" },
      { name: "Biodun Adeola", time: "4m ago", method: "Virtual" },
    ],
  },
  {
    id: "sess_002",
    eventId: "evt_006",
    eventTitle: "FintechNGR Regulatory Roundtable 2026",
    organiser: "FintechNGR Association",
    module: "GENERAL",
    color: "#2563eb",
    format: "hybrid",
    venue: "Eko Hotel, Lagos",
    attendees: 289,
    capacity: 400,
    elapsedMinutes: 135,
    quorumPct: null,
    votes: [],
    qaQueue: [
      { id: "qa_s2_001", name: "Gbenga Falola", question: "How will the proposed Open Banking framework affect PFI licensing timelines?", approved: null, time: "4m ago" },
      { id: "qa_s2_002", name: "Aisha Musa", question: "Is there a timeline for the SEC digital asset regulations to be gazetted?", approved: true, time: "12m ago" },
      { id: "qa_s2_003", name: "Nnamdi Obi", question: "What safeguards are being introduced to prevent SASE adoption from fragmenting the CAMA framework?", approved: null, time: "18m ago" },
    ],
    recentJoins: [
      { name: "Gbenga Falola", time: "just now", method: "In-person" },
      { name: "Rukayat Oduola", time: "3m ago", method: "Virtual" },
      { name: "Tosin Ogunleye", time: "7m ago", method: "In-person" },
      { name: "Obiageli Onuoha", time: "11m ago", method: "Virtual" },
    ],
  },
  {
    id: "sess_003",
    eventId: "evt_018",
    eventTitle: "Seplat Energy — Investor Day 2026",
    organiser: "Seplat Energy Plc",
    module: "GENERAL",
    color: "#0f766e",
    format: "virtual",
    attendees: 1042,
    elapsedMinutes: 55,
    quorumPct: null,
    votes: [],
    qaQueue: [
      { id: "qa_s3_001", name: "Chiamaka Eze", question: "What is Seplat's hedging strategy for crude oil prices below $70/bbl for the rest of 2026?", approved: null, time: "1m ago" },
      { id: "qa_s3_002", name: "Babatunde Lawal", question: "Can you provide an update on the MPNU acquisition integration timeline and expected synergies?", approved: null, time: "9m ago" },
    ],
    recentJoins: [
      { name: "Chiamaka Eze", time: "just now", method: "Virtual" },
      { name: "Musa Abdullahi", time: "2m ago", method: "Virtual" },
      { name: "Babatunde Lawal", time: "6m ago", method: "Virtual" },
      { name: "Yetunde Abiodun", time: "10m ago", method: "Virtual" },
      { name: "Sola Akintunde", time: "14m ago", method: "Virtual" },
    ],
  },
];

export const ACTIVITY_LOG = [
  { action: "Event published", actor: "Zenith Bank Plc", context: "2026 Annual General Meeting", time: "2026-05-01T09:00:00Z" },
  { action: "Document uploaded", actor: "Zenith Bank Plc", context: "AGM Notice & Proxy Form", time: "2026-05-03T11:00:00Z" },
  { action: "KYC approved", actor: "Admin", context: "Ngozi Okafor — full verification", time: "2026-04-30T14:30:00Z" },
  { action: "Event published", actor: "GTCo Holdings", context: "2026 EGM: Rights Issue Approval", time: "2026-04-15T10:00:00Z" },
  { action: "Document uploaded", actor: "GTCo Holdings", context: "Rights Issue Circular (2.1 MB)", time: "2026-05-15T09:00:00Z" },
  { action: "Event created (draft)", actor: "Dangote Cement Plc", context: "2026 Annual General Meeting", time: "2026-05-01T09:00:00Z" },
  { action: "Stakeholder enrolled", actor: "Admin", context: "FintechNGR Association", time: "2026-04-10T08:30:00Z" },
  { action: "Application shortlisted", actor: "Admin", context: "FinFlow — MeriHack 2026", time: "2026-07-01T11:00:00Z" },
  { action: "Application selected", actor: "Admin", context: "CreditSense — MeriHack 2026 (score: 91)", time: "2026-07-01T14:00:00Z" },
  { action: "Event published", actor: "Access Bank Plc", context: "2026 Annual General Meeting", time: "2026-05-20T09:00:00Z" },
  { action: "KYC submitted", actor: "Kola Adesanya", context: "Pending review — BVN & CHN uploaded", time: "2026-05-10T10:00:00Z" },
  { action: "Stakeholder enrolled", actor: "Admin", context: "AIICO Insurance Plc — pending review", time: "2026-05-22T08:30:00Z" },
  { action: "Event went live", actor: "System", context: "FintechNGR Regulatory Roundtable 2026", time: "2026-05-25T09:00:00Z" },
  { action: "Event went live", actor: "System", context: "Seplat Energy — Investor Day 2026", time: "2026-05-25T10:00:00Z" },
  { action: "Document uploaded", actor: "Stanbic IBTC Holdings", context: "2026 AGM Notice (1.4 MB)", time: "2026-05-15T09:00:00Z" },
];

"use client";
import { create } from "zustand";
import { CURRENT_ADMIN, MOCK_EVENTS, MOCK_PARTICIPANTS, MOCK_APPLICATIONS, MOCK_DOCUMENTS, MOCK_LIVE_VOTES, MOCK_LIVE_SESSIONS, MOCK_ORGANISERS, MOCK_REGISTRARS, MOCK_AUDIT_LOG, MOCK_TEAM, type AdminUser, type AttendEvent, type Participant, type HackathonApplication, type AppDocument, type LiveVote, type LiveSession, type Organiser, type Registrar, type AuditLogEntry, type AuditSeverity, type AuditCategory, type TeamMember, type ProxyVoteEntry } from "./mock-data";


interface AttendAdminStore {
  currentUser: AdminUser | null;
  events: AttendEvent[];
  participants: Participant[];
  applications: HackathonApplication[];
  documents: AppDocument[];
  // Flat live data kept for backward-compat (votes/page, analytics, [id]/page)
  liveVotes: LiveVote[];
  liveAttendees: number;
  organisers: Organiser[];
  registrars: Registrar[];
  // Multi-session live control room
  liveSessions: LiveSession[];
  selectedLiveSessionId: string;
  auditLog: AuditLogEntry[];
  team: TeamMember[];
  addAuditEntry: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => void;
  setSelectedLiveSession: (id: string) => void;
  login: (email: string) => void;
  logout: () => void;
  seedStore: () => void;
  openVoting: (sessionId: string, resolutionId: string, durationSeconds?: number) => void;
  closeVoting: (sessionId: string, resolutionId: string) => void;
  submitProxyVotes: (sessionId: string, resolutionId: string, proxyVotes: ProxyVoteEntry) => void;
  approveQA: (sessionId: string, qaId: string) => void;
  rejectQA: (sessionId: string, qaId: string) => void;
  updateApplicationStatus: (id: string, status: HackathonApplication["status"]) => void;
  deleteDocument: (id: string) => void;
  uploadOrgLogo: (url: string) => void;
  enrollOrganiser: (id: string) => void;
  suspendOrganiser: (id: string) => void;
  enrollRegistrar: (id: string) => void;
  suspendRegistrar: (id: string) => void;
  suspendParticipant: (id: string) => void;
  restoreParticipant: (id: string) => void;
  launchPoll: (sessionId: string, pollId: string) => void;
  closePoll: (sessionId: string, pollId: string) => void;
  releasePressKit: (sessionId: string) => void;
  declareWinner: (sessionId: string, teamName: string) => void;
  addTeamMember: (m: TeamMember) => void;
  removeTeamMember: (id: string) => void;
}

export const useStore = create<AttendAdminStore>((set) => ({
  currentUser: null,
  events: [],
  participants: [],
  applications: [],
  documents: [],
  liveVotes: [],
  organisers: MOCK_ORGANISERS,
  registrars: MOCK_REGISTRARS,
  liveAttendees: MOCK_LIVE_SESSIONS.reduce((s, sess) => s + sess.attendees, 0),
  liveSessions: MOCK_LIVE_SESSIONS,
  selectedLiveSessionId: MOCK_LIVE_SESSIONS[0]?.id ?? "",
  auditLog: MOCK_AUDIT_LOG,
  team: MOCK_TEAM,
  setSelectedLiveSession: (id) => set({ selectedLiveSessionId: id }),
  addAuditEntry: (entry) => set((s) => ({
    auditLog: [{ ...entry, id: `aud_${Date.now()}`, timestamp: new Date().toISOString() }, ...s.auditLog],
  })),
  login: (email) => set({ currentUser: { ...CURRENT_ADMIN, email } }),
  logout: () => set({ currentUser: null }),
  seedStore: () => set({
    currentUser: CURRENT_ADMIN,
    events: MOCK_EVENTS,
    participants: MOCK_PARTICIPANTS,
    applications: MOCK_APPLICATIONS,
    documents: MOCK_DOCUMENTS,
    liveVotes: MOCK_LIVE_VOTES,
    liveSessions: MOCK_LIVE_SESSIONS,
    organisers: MOCK_ORGANISERS,
    registrars: MOCK_REGISTRARS,
    auditLog: MOCK_AUDIT_LOG,
    team: MOCK_TEAM,
  }),
  openVoting: (sessionId, resolutionId, durationSeconds) => set((s) => ({
    liveVotes: s.liveVotes.map((v) => v.resolutionId === resolutionId ? { ...v, status: "open" as const, ...(durationSeconds ? { countdownSeconds: durationSeconds } : {}) } : v),
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, votes: sess.votes.map((v) => v.resolutionId === resolutionId ? { ...v, status: "open" as const, ...(durationSeconds ? { countdownSeconds: durationSeconds } : {}) } : v) }
        : sess
    ),
  })),
  closeVoting: (sessionId, resolutionId) => set((s) => ({
    liveVotes: s.liveVotes.map((v) => v.resolutionId === resolutionId ? { ...v, status: "closed" as const, result: (v.for + (v.proxyVotes?.for ?? 0)) > (v.against + (v.proxyVotes?.against ?? 0)) ? "passed" as const : "failed" as const } : v),
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, votes: sess.votes.map((v) => v.resolutionId === resolutionId ? { ...v, status: "closed" as const, result: (v.for + (v.proxyVotes?.for ?? 0)) > (v.against + (v.proxyVotes?.against ?? 0)) ? "passed" as const : "failed" as const } : v) }
        : sess
    ),
  })),
  submitProxyVotes: (sessionId, resolutionId, proxyVotes) => set((s) => ({
    liveVotes: s.liveVotes.map((v) => v.resolutionId === resolutionId ? { ...v, proxyVotes } : v),
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, votes: sess.votes.map((v) => v.resolutionId === resolutionId ? { ...v, proxyVotes } : v) }
        : sess
    ),
  })),
  approveQA: (sessionId, qaId) => set((s) => ({
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, qaQueue: sess.qaQueue.map((q) => q.id === qaId ? { ...q, approved: true } : q) }
        : sess
    ),
  })),
  rejectQA: (sessionId, qaId) => set((s) => ({
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, qaQueue: sess.qaQueue.map((q) => q.id === qaId ? { ...q, approved: false } : q) }
        : sess
    ),
  })),
  updateApplicationStatus: (id, status) => set((s) => ({ applications: s.applications.map((a) => a.id === id ? { ...a, status } : a) })),
  deleteDocument: (id) => set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
  uploadOrgLogo: (url) => set((s) => ({ currentUser: s.currentUser ? { ...s.currentUser, logoUrl: url } : null })),
  enrollOrganiser: (id) => set((s) => ({ organisers: s.organisers.map((stk) => stk.id === id ? { ...stk, status: "active" as const } : stk) })),
  suspendOrganiser: (id) => set((s) => ({ organisers: s.organisers.map((stk) => stk.id === id ? { ...stk, status: "suspended" as const } : stk) })),
  enrollRegistrar: (id) => set((s) => ({ registrars: s.registrars.map((r) => r.id === id ? { ...r, status: "active" as const } : r) })),
  suspendRegistrar: (id) => set((s) => ({ registrars: s.registrars.map((r) => r.id === id ? { ...r, status: "suspended" as const } : r) })),
  suspendParticipant: (id) => set((s) => ({ participants: s.participants.map((p) => p.id === id ? { ...p, status: "suspended" as const } : p) })),
  restoreParticipant: (id) => set((s) => ({ participants: s.participants.map((p) => p.id === id ? { ...p, status: "active" as const } : p) })),
  launchPoll: (sessionId, pollId) => set((s) => ({
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, polls: sess.polls.map((p) => p.id === pollId ? { ...p, status: "active" as const } : p) }
        : sess
    ),
  })),
  closePoll: (sessionId, pollId) => set((s) => ({
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, polls: sess.polls.map((p) => p.id === pollId ? { ...p, status: "closed" as const } : p) }
        : sess
    ),
  })),
  releasePressKit: (sessionId) => set((s) => ({
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId ? { ...sess, pressKitReleased: true } : sess
    ),
  })),
  declareWinner: (sessionId, teamName) => set((s) => ({
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId ? { ...sess, winnerTeam: teamName } : sess
    ),
  })),
  addTeamMember: (m) => set((s) => ({ team: [...s.team, m] })),
  removeTeamMember: (id) => set((s) => ({ team: s.team.filter((m) => m.id !== id) })),
}));

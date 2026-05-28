"use client";
import { create } from "zustand";
import { CURRENT_ADMIN, MOCK_EVENTS, MOCK_PARTICIPANTS, MOCK_APPLICATIONS, MOCK_DOCUMENTS, MOCK_LIVE_VOTES, MOCK_LIVE_SESSIONS, MOCK_STAKEHOLDERS, type AdminUser, type AttendEvent, type Participant, type HackathonApplication, type AppDocument, type LiveVote, type LiveSession, type Stakeholder } from "./mock-data";


interface AttendAdminStore {
  currentUser: AdminUser | null;
  events: AttendEvent[];
  participants: Participant[];
  applications: HackathonApplication[];
  documents: AppDocument[];
  // Flat live data kept for backward-compat (votes/page, analytics, [id]/page)
  liveVotes: LiveVote[];
  liveAttendees: number;
  stakeholders: Stakeholder[];
  // Multi-session live control room
  liveSessions: LiveSession[];
  selectedLiveSessionId: string;
  setSelectedLiveSession: (id: string) => void;
  login: (email: string) => void;
  logout: () => void;
  seedStore: () => void;
  openVoting: (sessionId: string, resolutionId: string) => void;
  closeVoting: (sessionId: string, resolutionId: string) => void;
  approveQA: (sessionId: string, qaId: string) => void;
  rejectQA: (sessionId: string, qaId: string) => void;
  updateApplicationStatus: (id: string, status: HackathonApplication["status"]) => void;
  deleteDocument: (id: string) => void;
  enrollStakeholder: (id: string) => void;
  suspendStakeholder: (id: string) => void;
  launchPoll: (sessionId: string, pollId: string) => void;
  closePoll: (sessionId: string, pollId: string) => void;
  releasePressKit: (sessionId: string) => void;
  declareWinner: (sessionId: string, teamName: string) => void;
}

export const useStore = create<AttendAdminStore>((set) => ({
  currentUser: null,
  events: [],
  participants: [],
  applications: [],
  documents: [],
  liveVotes: [],
  stakeholders: [],
  liveAttendees: MOCK_LIVE_SESSIONS.reduce((s, sess) => s + sess.attendees, 0),
  liveSessions: MOCK_LIVE_SESSIONS,
  selectedLiveSessionId: MOCK_LIVE_SESSIONS[0]?.id ?? "",
  setSelectedLiveSession: (id) => set({ selectedLiveSessionId: id }),
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
    stakeholders: MOCK_STAKEHOLDERS,
  }),
  openVoting: (sessionId, resolutionId) => set((s) => ({
    liveVotes: s.liveVotes.map((v) => v.resolutionId === resolutionId ? { ...v, status: "open" as const } : v),
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, votes: sess.votes.map((v) => v.resolutionId === resolutionId ? { ...v, status: "open" as const } : v) }
        : sess
    ),
  })),
  closeVoting: (sessionId, resolutionId) => set((s) => ({
    liveVotes: s.liveVotes.map((v) => v.resolutionId === resolutionId ? { ...v, status: "closed" as const } : v),
    liveSessions: s.liveSessions.map((sess) =>
      sess.id === sessionId
        ? { ...sess, votes: sess.votes.map((v) => v.resolutionId === resolutionId ? { ...v, status: "closed" as const } : v) }
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
  enrollStakeholder: (id) => set((s) => ({ stakeholders: s.stakeholders.map((stk) => stk.id === id ? { ...stk, status: "active" as const } : stk) })),
  suspendStakeholder: (id) => set((s) => ({ stakeholders: s.stakeholders.map((stk) => stk.id === id ? { ...stk, status: "suspended" as const } : stk) })),
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
}));

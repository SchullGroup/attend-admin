"use client";
import { create } from "zustand";
import {
  MOCK_EVENTS,
  MOCK_PARTICIPANTS,
  MOCK_APPLICATIONS,
  MOCK_DOCUMENTS,
  MOCK_LIVE_VOTES,
  MOCK_LIVE_SESSIONS,
  MOCK_STAKEHOLDERS,
} from "./mock-data";
import type {
  AppDocument,
  LiveVote,
  LiveSession,
  Stakeholder,
} from "@/types/mock";

interface AttendAdminStore {
  currentOrg: any | null;
  stakeholders: Stakeholder[];
  events: any[];
  attendees: any[];
  documents: any[];
  applications: any[];
  participants: any[];
  // Flat live data kept for backward-compat (votes/page, analytics, [id]/page)
  liveVotes: LiveVote[];
  liveAttendees: number;
  // Multi-session live control room
  liveSessions: LiveSession[];
  selectedLiveSessionId: string;
  setSelectedLiveSession: (id: string) => void;
  seedStore: () => void;
  openVoting: (sessionId: string, resolutionId: string) => void;
  closeVoting: (sessionId: string, resolutionId: string) => void;
  approveQA: (sessionId: string, qaId: string) => void;
  rejectQA: (sessionId: string, qaId: string) => void;
  updateApplicationStatus: (id: string, status: string) => void;
  deleteDocument: (id: string) => void;
  enrollStakeholder: (id: string) => void;
  suspendStakeholder: (id: string) => void;
  suspendParticipant: (id: string) => void;
  restoreParticipant: (id: string) => void;
  launchPoll: (sessionId: string, pollId: string) => void;
  closePoll: (sessionId: string, pollId: string) => void;
  releasePressKit: (sessionId: string) => void;
  declareWinner: (sessionId: string, teamName: string) => void;
}

export const useStore = create<AttendAdminStore>((set) => ({
  currentOrg: null,
  stakeholders: [],
  events: [],
  attendees: [],
  documents: [],
  applications: [],
  participants: [],
  liveVotes: [],
  liveAttendees: MOCK_LIVE_SESSIONS.reduce((s, sess) => s + sess.attendees, 0),
  liveSessions: MOCK_LIVE_SESSIONS,
  selectedLiveSessionId: MOCK_LIVE_SESSIONS[0]?.id ?? "",
  setSelectedLiveSession: (id) => set({ selectedLiveSessionId: id }),
  seedStore: () =>
    set({
      currentOrg: null,
      stakeholders: MOCK_STAKEHOLDERS as any[],
      events: MOCK_EVENTS as any[],
      attendees: MOCK_PARTICIPANTS as any[],
      documents: MOCK_DOCUMENTS as any[],
      applications: MOCK_APPLICATIONS as any[],
      participants: MOCK_PARTICIPANTS as any[],
      liveVotes: MOCK_LIVE_VOTES,
      liveSessions: MOCK_LIVE_SESSIONS,
    }),
  openVoting: (sessionId, resolutionId) =>
    set((s) => ({
      liveVotes: s.liveVotes.map((v) =>
        v.resolutionId === resolutionId ? { ...v, status: "open" as const } : v,
      ),
      liveSessions: s.liveSessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              votes: sess.votes.map((v) =>
                v.resolutionId === resolutionId
                  ? { ...v, status: "open" as const }
                  : v,
              ),
            }
          : sess,
      ),
    })),
  closeVoting: (sessionId, resolutionId) =>
    set((s) => ({
      liveVotes: s.liveVotes.map((v) =>
        v.resolutionId === resolutionId
          ? { ...v, status: "closed" as const }
          : v,
      ),
      liveSessions: s.liveSessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              votes: sess.votes.map((v) =>
                v.resolutionId === resolutionId
                  ? { ...v, status: "closed" as const }
                  : v,
              ),
            }
          : sess,
      ),
    })),
  approveQA: (sessionId, qaId) =>
    set((s) => ({
      liveSessions: s.liveSessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              qaQueue: sess.qaQueue.map((q) =>
                q.id === qaId ? { ...q, approved: true } : q,
              ),
            }
          : sess,
      ),
    })),
  rejectQA: (sessionId, qaId) =>
    set((s) => ({
      liveSessions: s.liveSessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              qaQueue: sess.qaQueue.map((q) =>
                q.id === qaId ? { ...q, approved: false } : q,
              ),
            }
          : sess,
      ),
    })),
  updateApplicationStatus: (id, status) =>
    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === id ? { ...a, status } : a,
      ),
    })),
  deleteDocument: (id) =>
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),
  enrollStakeholder: (id) =>
    set((s) => ({
      stakeholders: s.stakeholders.map((stk) =>
        stk.id === id ? { ...stk, status: "active" as const } : stk,
      ),
    })),
  suspendStakeholder: (id) =>
    set((s) => ({
      stakeholders: s.stakeholders.map((stk) =>
        stk.id === id ? { ...stk, status: "suspended" as const } : stk,
      ),
    })),
  suspendParticipant: (id) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.id === id ? { ...p, status: "suspended" as const } : p,
      ),
    })),
  restoreParticipant: (id) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.id === id ? { ...p, status: "active" as const } : p,
      ),
    })),
  launchPoll: (sessionId, pollId) =>
    set((s) => ({
      liveSessions: s.liveSessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              polls: sess.polls.map((p) =>
                p.id === pollId ? { ...p, status: "active" as const } : p,
              ),
            }
          : sess,
      ),
    })),
  closePoll: (sessionId, pollId) =>
    set((s) => ({
      liveSessions: s.liveSessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              polls: sess.polls.map((p) =>
                p.id === pollId ? { ...p, status: "closed" as const } : p,
              ),
            }
          : sess,
      ),
    })),
  releasePressKit: (sessionId) =>
    set((s) => ({
      liveSessions: s.liveSessions.map((sess) =>
        sess.id === sessionId ? { ...sess, pressKitReleased: true } : sess,
      ),
    })),
  declareWinner: (sessionId, teamName) =>
    set((s) => ({
      liveSessions: s.liveSessions.map((sess) =>
        sess.id === sessionId ? { ...sess, winnerTeam: teamName } : sess,
      ),
    })),
}));

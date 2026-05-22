"use client";
import { create } from "zustand";
import { CURRENT_ADMIN, MOCK_EVENTS, MOCK_PARTICIPANTS, MOCK_APPLICATIONS, MOCK_DOCUMENTS, MOCK_LIVE_VOTES, type AdminUser, type AttendEvent, type Participant, type HackathonApplication, type AppDocument, type LiveVote } from "./mock-data";

interface AttendAdminStore {
  currentUser: AdminUser | null;
  events: AttendEvent[];
  participants: Participant[];
  applications: HackathonApplication[];
  documents: AppDocument[];
  liveVotes: LiveVote[];
  liveAttendees: number;
  liveQaQueue: { id: string; name: string; question: string; approved: boolean | null; time: string }[];
  login: (email: string) => void;
  logout: () => void;
  seedStore: () => void;
  openVoting: (resolutionId: string) => void;
  closeVoting: (resolutionId: string) => void;
  approveQA: (id: string) => void;
  rejectQA: (id: string) => void;
  updateApplicationStatus: (id: string, status: HackathonApplication["status"]) => void;
}

export const useStore = create<AttendAdminStore>((set) => ({
  currentUser: null,
  events: [],
  participants: [],
  applications: [],
  documents: [],
  liveVotes: [],
  liveAttendees: 1247,
  liveQaQueue: [
    { id: "qa_001", name: "Ngozi Okafor", question: "What is the plan for dividend payments in Q3 2026 given the current forex environment?", approved: null, time: "2m ago" },
    { id: "qa_002", name: "Emeka Eze", question: "Can management comment on the non-performing loan ratio improvement mentioned in the annual report?", approved: null, time: "5m ago" },
    { id: "qa_003", name: "Biodun Adeola", question: "What are the Board's plans for digital banking expansion in francophone West Africa?", approved: null, time: "8m ago" },
  ],
  login: (email) => set({ currentUser: { ...CURRENT_ADMIN, email } }),
  logout: () => set({ currentUser: null }),
  seedStore: () => set({
    currentUser: CURRENT_ADMIN,
    events: MOCK_EVENTS,
    participants: MOCK_PARTICIPANTS,
    applications: MOCK_APPLICATIONS,
    documents: MOCK_DOCUMENTS,
    liveVotes: MOCK_LIVE_VOTES,
  }),
  openVoting: (id) => set((s) => ({ liveVotes: s.liveVotes.map((v) => v.resolutionId === id ? { ...v, status: "open" } : v) })),
  closeVoting: (id) => set((s) => ({ liveVotes: s.liveVotes.map((v) => v.resolutionId === id ? { ...v, status: "closed" } : v) })),
  approveQA: (id) => set((s) => ({ liveQaQueue: s.liveQaQueue.map((q) => q.id === id ? { ...q, approved: true } : q) })),
  rejectQA: (id) => set((s) => ({ liveQaQueue: s.liveQaQueue.map((q) => q.id === id ? { ...q, approved: false } : q) })),
  updateApplicationStatus: (id, status) => set((s) => ({ applications: s.applications.map((a) => a.id === id ? { ...a, status } : a) })),
}));

"use client";

/**
 * useLiveWebSocket
 *
 * Connects to the backend STOMP/SockJS WebSocket and subscribes to
 * /topic/live.{eventId} for real-time Q&A and live-poll updates.
 *
 * Both SockJS and @stomp/stompjs are bundled via npm — no CDN dependency.
 */

import { useEffect, useRef } from "react";
import Cookies from "js-cookie";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LiveWsMessage =
  | {
      type: "QUESTION_SUBMITTED";
      payload: {
        questionId:   string;
        content:      string;
        askerName:    string;
        anonymous?:   boolean;
        submittedAt?: string;
        status:       "PENDING";
      };
    }
  | {
      type: "QUESTION_MODERATED";
      payload: { questionId: string; status: "APPROVED" | "REJECTED" };
    }
  | {
      type: "QUESTION_ANSWERED";
      payload: {
        questionId: string;
        status:     "ANSWERED";
        answer:     string;
        answeredBy: string;
        answeredAt: string;
      };
    }
  // ── Live polls (F1, backend 2026-07-15) — same topic as Q&A ──
  | {
      type: "POLL_OPENED";
      payload: {
        pollId:   string;
        question: string;
        options:  { id: string; label: string }[];
        type:     "SINGLE_CHOICE";
        closesAt?: string | null;
      };
    }
  | {
      type: "POLL_RESULTS_UPDATED";
      payload: {
        pollId:     string;
        results:    { optionId: string; votes: number; percentage: number }[];
        totalVotes: number;
      };
    }
  | {
      type: "POLL_CLOSED";
      payload: {
        pollId:       string;
        finalResults: { optionId: string; votes: number; percentage: number }[];
      };
    };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLiveWebSocket(
  eventId:   string | null | undefined,
  onMessage: (msg: LiveWsMessage) => void,
) {
  const onMsgRef = useRef(onMessage);
  onMsgRef.current = onMessage;

  useEffect(() => {
    if (!eventId) return;

    let destroyed    = false;
    let stompClient: any = null;

    async function connect() {
      try {
        const token = Cookies.get("accessToken") ?? "";

        // Dynamic imports keep these large libs out of the initial JS bundle
        const [{ Client }, SockJSModule] = await Promise.all([
          import("@stomp/stompjs"),
          import("sockjs-client"),
        ]);

        if (destroyed) return;

        const SockJS = SockJSModule.default ?? SockJSModule;

        stompClient = new Client({
          webSocketFactory: () =>
            new (SockJS as any)("http://54.215.201.4:8080/ws"),
          connectHeaders:   { Authorization: `Bearer ${token}` },
          reconnectDelay:   5_000,
          onConnect: () => {
            stompClient.subscribe(
              `/topic/live.${eventId}`,
              (frame: any) => {
                try {
                  const msg: LiveWsMessage = JSON.parse(frame.body);
                  onMsgRef.current(msg);
                } catch {
                  // malformed frame — ignore
                }
              }
            );
          },
          onStompError: (frame: any) => {
            console.warn("[WS] STOMP error", frame.headers?.message);
          },
        });

        stompClient.activate();
      } catch (e) {
        if (!destroyed) console.warn("[WS] Connection failed:", e);
      }
    }

    connect();

    return () => {
      destroyed = true;
      try { stompClient?.deactivate(); } catch { /* noop */ }
    };
  }, [eventId]);
}

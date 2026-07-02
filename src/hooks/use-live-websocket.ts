"use client";

/**
 * useLiveWebSocket
 *
 * Connects to the backend STOMP/SockJS WebSocket and subscribes to
 * /topic/live.{eventId} for real-time Q&A updates.
 *
 * SockJS and @stomp/stompjs are loaded from CDN at runtime so no extra
 * npm packages are required.
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
        questionId:  string;
        content:     string;
        askerName:   string;
        anonymous?:  boolean;
        submittedAt?: string;
        status:      "PENDING";
      };
    }
  | {
      type: "QUESTION_MODERATED";
      payload: { questionId: string; status: "APPROVED" | "REJECTED" };
    }
  | {
      type: "QUESTION_ANSWERED";
      payload: {
        questionId:  string;
        status:      "ANSWERED";
        answer:      string;
        answeredBy:  string;
        answeredAt:  string;
      };
    };

// ---------------------------------------------------------------------------
// CDN loader helper
// ---------------------------------------------------------------------------

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

const SOCKJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js";
const STOMP_CDN  = "https://cdn.jsdelivr.net/npm/@stomp/stompjs@7.0.0/bundles/stomp.umd.min.js";

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

    let destroyed   = false;
    let stompClient: any = null;

    async function connect() {
      try {
        // Polyfill `global` so SockJS UMD wrapper resolves to window, not a
        // bare object — without this, `window.SockJS` ends up as a plain object
        // instead of the constructor function in some bundler environments.
        if (typeof (window as any).global === "undefined") {
          (window as any).global = window;
        }

        await loadScript(SOCKJS_CDN);
        await loadScript(STOMP_CDN);
        if (destroyed) return;

        const token   = Cookies.get("accessToken") ?? "";
        // Some CDN bundles hoist the export to `.default`; handle both shapes.
        const SockJSRaw = (window as any).SockJS;
        const SockJS    = typeof SockJSRaw === "function" ? SockJSRaw : SockJSRaw?.default;
        const StompJs   = (window as any).StompJs;

        if (typeof SockJS !== "function") {
          throw new Error("SockJS failed to load from CDN");
        }

        stompClient = new StompJs.Client({
          webSocketFactory: () =>
            new SockJS("http://54.215.201.4:8080/ws"),
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

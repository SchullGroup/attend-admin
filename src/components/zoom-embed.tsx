"use client";
/**
 * ZoomEmbed — renders a Zoom meeting inline via an iframe pointing to /zoom-meeting.html.
 *
 * The iframe hosts Zoom's CLIENT VIEW (the full Zoom web client: native
 * toolbar, Participants panel with waiting-room admits, Settings, view
 * switching). Client view takes over its page by design — the iframe scopes
 * that takeover to this card. The iframe also isolates the SDK's bundled
 * React from the app's React (the original reason this page exists: the SDK
 * touches React 16/17 internals removed in React 18+).
 *
 * Communication:
 *   Parent → iframe: ZOOM_JOIN      (join params)
 *   Parent → iframe: ZOOM_LEAVE     (request leave)
 *   Parent → iframe: ZOOM_SEND_CHAT (accepted but IGNORED — client view has
 *                                    no programmatic chat API; Q&A reaches
 *                                    the host via parent-rendered toasts)
 *   iframe → Parent: ZOOM_READY     (SDK scripts loaded, ready to receive join params)
 *   iframe → Parent: ZOOM_JOINED    (join succeeded)
 *   iframe → Parent: ZOOM_ERROR     (join failed; carries .message)
 *   iframe → Parent: ZOOM_LEFT      (meeting left — fires for BOTH our Leave
 *                                    button and Zoom's own toolbar Leave,
 *                                    via the client view leaveUrl redirect)
 *
 * Imperative API (via forwardRef):
 *   ref.sendChat(message) — no-op under client view; kept so callers don't break.
 */
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Loader2, AlertTriangle, Video, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Imperative handle exposed to parent components via ref */
export interface ZoomEmbedHandle {
  /**
   * Historically forwarded a chat message into the Zoom meeting (component
   * view). The client view has no chat-send API, so this is now a no-op —
   * kept so existing callers (Q&A forwarding in SessionDetail) don't break.
   */
  sendChat: (message: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseZoomUrl(url: string): { meetingNumber: string; password: string } | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/j\/(\d+)/);
    if (!match) return null;
    return { meetingNumber: match[1], password: u.searchParams.get("pwd") ?? "" };
  } catch {
    return null;
  }
}

/**
 * ZAKs are JWTs — decode the payload and check `exp` so we can refresh
 * proactively instead of joining with a dead token, eating SDK error 200,
 * and silently retrying (the old behavior; it made every first launch on a
 * stale event a hidden fail-and-retry).
 * Returns false when the token can't be decoded — in that case we just try
 * the join and let the error-200 retry path handle it.
 */
function zakLooksExpired(zak: string): boolean {
  try {
    const part = zak.split(".")[1];
    if (!part) return false;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    if (typeof payload.exp === "number") {
      return payload.exp * 1000 < Date.now() + 60_000; // 60 s safety margin
    }
  } catch { /* undecodable — assume usable */ }
  return false;
}

/** Subset of ZoomMeetingDto returned by /api/zoom/refresh-meeting. */
export interface RefreshedZoomMeeting {
  meetingId?: number | string;
  password?:  string;
  joinUrl?:   string;
  startUrl?:  string;
  /** Fresh host ZAK — returned directly since the backend's 2026-07-15
   *  idempotency fix (before that it only travelled inside startUrl). */
  hostZak?:   string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "idle" | "loading" | "joined" | "error";

interface ZoomEmbedProps {
  /** Display name shown inside the meeting. */
  userName: string;
  /** Height in px for the meeting panel. Minimum 600 recommended for Zoom SDK controls. */
  height?: number;

  // Option A — pass backend zoomMeeting fields directly (preferred):
  meetingNumber?: string | number;
  password?:      string;
  /**
   * Host ZAK token (from zoomMeeting.startUrl). May be stale — if eventId is
   * also provided the component will always fetch a fresh ZAK before joining.
   */
  zak?:           string;
  /**
   * When provided, the component calls /api/zoom/refresh-meeting before a
   * host join whenever the ZAK is missing or expired. Since the backend's
   * 2026-07-15 idempotency fix this returns the SAME meeting with a fresh
   * ZAK; we still only refresh when needed and still adopt whatever meeting
   * identity comes back, as a belt-and-braces guard for older backends
   * (which rotated the meeting on every refresh).
   */
  eventId?:       string;
  /**
   * Called after /api/zoom/refresh-meeting returns. Parents should
   * invalidate cached queries holding zoomMeeting/streamUrl so the UI stays
   * in sync (a no-op now that the backend returns the same meeting; matters
   * against older backends that rotated it).
   */
  onMeetingRefreshed?: (meeting: RefreshedZoomMeeting) => void;

  // Option B — parse from a raw Zoom join URL (fallback):
  streamUrl?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const ZoomEmbed = forwardRef<ZoomEmbedHandle, ZoomEmbedProps>(function ZoomEmbed({
  userName,
  height = 680,
  meetingNumber: meetingNumberProp,
  password: passwordProp,
  zak: zakProp,
  eventId,
  onMeetingRefreshed,
  streamUrl,
}: ZoomEmbedProps, ref) {
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const listenerRef  = useRef<((e: MessageEvent) => void) | null>(null);
  const [status,  setStatus]  = useState<Status>("idle");
  const [errMsg,  setErrMsg]  = useState("");

  // Expose sendChat so parent components can push Q&A questions into Zoom chat
  useImperativeHandle(ref, () => ({
    sendChat: (message: string) => {
      iframeRef.current?.contentWindow?.postMessage({ type: "ZOOM_SEND_CHAT", message }, "*");
    },
  }));

  // Resolve meeting params — direct props take priority over URL parsing
  const resolved: { meetingNumber: string; password: string; zak: string } | null =
    meetingNumberProp != null
      ? { meetingNumber: String(meetingNumberProp), password: passwordProp ?? "", zak: zakProp ?? "" }
      : streamUrl
        ? (() => {
            const p = parseZoomUrl(streamUrl);
            return p ? { meetingNumber: p.meetingNumber, password: p.password, zak: "" } : null;
          })()
        : null;

  function cleanupListener() {
    if (listenerRef.current) {
      window.removeEventListener("message", listenerRef.current);
      listenerRef.current = null;
    }
  }

  const handleLaunch = useCallback(async (forceRefresh = false) => {
    if (!resolved || !iframeRef.current) return;
    setStatus("loading");
    setErrMsg("");
    cleanupListener();

    try {
      // Use stored meeting data by default. Refresh ONLY when the ZAK is
      // missing/expired or explicitly requested (after error 200) — the
      // backend ROTATES the meeting on refresh, so an unnecessary refresh
      // would orphan attendees already sitting in the current meeting.
      let joinNumber   = resolved.meetingNumber;
      let joinPassword = resolved.password;
      let joinZak      = resolved.zak;

      if (eventId && (forceRefresh || !joinZak || zakLooksExpired(joinZak))) {
        try {
          const refreshRes = await fetch("/api/zoom/refresh-meeting", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ eventId }),
          });
          if (refreshRes.ok) {
            const meeting = await refreshRes.json() as RefreshedZoomMeeting;
            // ADOPT the refreshed meeting identity. Idempotent backends
            // (2026-07-15+) return the same meeting so this is a no-op;
            // older backends rotated the meeting on refresh, and pinning
            // the OLD meetingNumber stranded the host in a meeting nobody
            // else could reach. Adopting is correct either way.
            if (meeting.meetingId) joinNumber = String(meeting.meetingId);
            if (typeof meeting.password === "string") joinPassword = meeting.password;
            // Fresh ZAK: prefer the dedicated hostZak field (new), fall
            // back to extracting it from startUrl's query params (old).
            if (meeting.hostZak) {
              joinZak = meeting.hostZak;
            } else if (meeting.startUrl) {
              try {
                const freshZak = new URL(meeting.startUrl).searchParams.get("zak");
                if (freshZak) joinZak = freshZak;
              } catch { /* ignore malformed url */ }
            }
            onMeetingRefreshed?.(meeting);
          } else {
            const errBody = await refreshRes.json().catch(() => ({})) as { error?: string };
            throw new Error(errBody.error ?? `Meeting refresh failed (${refreshRes.status})`);
          }
        } catch (refreshErr: unknown) {
          if (refreshErr instanceof Error) throw refreshErr;
        }
      }

      // Fetch Meeting SDK signature (always role 1 = host)
      const res = await fetch("/api/zoom/signature", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ meetingNumber: joinNumber, role: 1 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Signature request failed");
      }
      const { signature, sdkKey } = await res.json() as { signature: string; sdkKey: string };

      // Set up message listener before loading the iframe
      const listener = (event: MessageEvent) => {
        if (!event.data) return;
        const { type, message: errMessage } = event.data as { type: string; message?: string };

        if (type === "ZOOM_READY") {
          iframeRef.current?.contentWindow?.postMessage(
            {
              type: "ZOOM_JOIN",
              sdkKey,
              signature,
              meetingNumber: joinNumber,
              password:      joinPassword,
              userName:      userName || "Host",
              ...(joinZak ? { zak: joinZak } : {}),
            },
            "*"
          );
        } else if (type === "ZOOM_JOINED") {
          setStatus("joined");
          cleanupListener();
        } else if (type === "ZOOM_ERROR") {
          cleanupListener();
          const msg = typeof errMessage === "string" && errMessage
            ? errMessage
            : (() => { try { return JSON.stringify(errMessage); } catch { return "Failed to join Zoom meeting"; } })();

          // ZAK expired/invalid — reported as code 200 by the old component
          // view and code 3265 ("Token error") by the client view.
          // Silently refresh and retry once.
          const isTokenError =
            typeof msg === "string" &&
            (/\b(200|3265)\b/.test(msg) || /token error/i.test(msg));
          if (isTokenError && eventId && !forceRefresh) {
            handleLaunch(true);
            return;
          }

          setStatus("error");
          setErrMsg(msg || "Failed to join Zoom meeting");
        }
      };

      listenerRef.current = listener;
      window.addEventListener("message", listener);

      // Load the iframe (cache-bust so re-launch always gets a fresh page)
      iframeRef.current.src = `/zoom-meeting.html?t=${Date.now()}`;

    } catch (e: unknown) {
      setStatus("error");
      setErrMsg(e instanceof Error ? e.message : "Failed to start meeting");
      cleanupListener();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, userName, eventId, onMeetingRefreshed]);

  function handleLeave() {
    cleanupListener();

    // Wait for the iframe to confirm leaveMeeting() actually completed
    // before tearing it down — destroying the iframe (and its network
    // connection) immediately after posting ZOOM_LEAVE cuts the async leave
    // request off mid-flight, leaving a "zombie" participant session on
    // Zoom's servers. That's what was causing duplicate self-entries in the
    // Participants panel after repeated Leave→relaunch cycles. A short
    // timeout still tears it down even if the confirmation never arrives
    // (e.g. connection already dropped), so Leave never hangs.
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onLeft);
      clearTimeout(timeout);
      if (iframeRef.current) iframeRef.current.src = "";
      setStatus("idle");
    };
    const onLeft = (event: MessageEvent) => {
      if (event.data?.type === "ZOOM_LEFT") finish();
    };
    window.addEventListener("message", onLeft);
    const timeout = setTimeout(finish, 1500);

    iframeRef.current?.contentWindow?.postMessage({ type: "ZOOM_LEAVE" }, "*");
  }

  // Cleanup listener on unmount
  useEffect(() => () => cleanupListener(), []);

  // The client view navigates the iframe to ?left=1 after ANY leave —
  // including Zoom's own toolbar Leave button, which never goes through
  // handleLeave(). Catch that ZOOM_LEFT here and reset to the idle launch
  // card instead of leaving a dead blank iframe behind the "joined" state.
  useEffect(() => {
    if (status !== "joined") return;
    const onNativeLeft = (event: MessageEvent) => {
      if (event.data?.type === "ZOOM_LEFT") {
        if (iframeRef.current) iframeRef.current.src = "";
        setStatus("idle");
      }
    };
    window.addEventListener("message", onNativeLeft);
    return () => window.removeEventListener("message", onNativeLeft);
  }, [status]);

  if (!resolved) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 text-sm text-[hsl(var(--muted-foreground))]">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        No Zoom meeting configured.
      </div>
    );
  }

  return (
    <div className="relative w-full bg-black overflow-hidden" style={{ minHeight: height }}>
      {/*
        Iframe always occupies real, non-zero space — even before "joined".
        Why: zoom-meeting.html measures its container's offsetWidth/offsetHeight
        when initializing the Zoom SDK. If the iframe were `display: none` at
        that point (as it used to be while status !== "joined"), the iframe's
        own content window collapses to a 0×0 viewport, so the Zoom SDK inits
        its video/control-bar layout at 0×0. That leaves invisible, misplaced
        elements once the iframe becomes visible — the exact "can't click on
        anything else" symptom, since a stray 0-sized-turned-stale element can
        end up covering parts of the page. The opaque idle/loading/error
        overlays below (all solid `bg-black`) visually hide the iframe until
        it's actually joined, without ever un-rendering it.
      */}
      <iframe
        ref={iframeRef}
        title="Zoom Meeting"
        allow="camera; microphone; display-capture; fullscreen; autoplay"
        style={{
          position: "absolute",
          inset:    0,
          width:    "100%",
          height:   "100%",
          border:   "none",
        }}
      />

      {/* ── Idle ── */}
      {status === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
          <div className="rounded-2xl bg-[#0B5CFF]/15 p-4">
            <Video className="h-10 w-10 text-[#0B5CFF]" />
          </div>
          <p className="text-sm font-semibold text-white">Meeting #{resolved.meetingNumber}</p>
          <Button
            onClick={() => handleLaunch()}
            className="gap-2 bg-[#0B5CFF] hover:bg-[#0B5CFF]/90 text-white"
          >
            <Video className="h-4 w-4" /> Launch In-Page Meeting
          </Button>
          <p className="text-xs text-gray-500 max-w-xs text-center">
            Joins as <strong className="text-gray-300">{userName || "Host"}</strong> with host privileges.
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-[#0B5CFF]" />
          <p className="text-xs text-gray-400">Connecting to Zoom…</p>
        </div>
      )}

      {/* ── Error ── */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-black">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-white mb-1">Failed to join meeting</p>
            <p className="text-xs text-gray-400 max-w-xs">{errMsg}</p>
            {(errMsg.includes("200") || errMsg.includes("3265") || /token/i.test(errMsg)) && (
              <p className="text-xs text-amber-400 max-w-xs mt-2">
                Host token expired or invalid. Click Try again — a fresh token will be fetched automatically.
              </p>
            )}
            {errMsg.includes("3000") && (
              <div className="mt-2 rounded-lg bg-amber-900/40 border border-amber-700/50 px-4 py-3 text-left max-w-xs">
                <p className="text-xs font-semibold text-amber-300 mb-1">Another meeting is still running</p>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Open <a href="https://zoom.us/meeting" target="_blank" rel="noreferrer" className="underline text-amber-300 hover:text-white">zoom.us/meeting</a>, find the active meeting, click <strong>End</strong>, then come back and try again.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // On token errors, retry WITH a forced refresh — going back
                // to idle and relaunching would reuse the same stale ZAK.
                const tokenErr = /\b(200|3265)\b/.test(errMsg) || /token/i.test(errMsg);
                setErrMsg("");
                if (tokenErr && eventId) handleLaunch(true);
                else setStatus("idle");
              }}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* ── Leave button (overlaid on joined iframe) ── */}
      {status === "joined" && (
        <button
          onClick={handleLeave}
          className="absolute top-3 right-3 z-50 flex items-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Leave
        </button>
      )}
    </div>
  );
});

export default ZoomEmbed;

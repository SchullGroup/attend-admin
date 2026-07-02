"use client";
/**
 * ZoomEmbed — renders a Zoom meeting inline via an iframe pointing to /zoom-meeting.html.
 *
 * Why iframe:
 *   @zoom/meetingsdk/embedded bundles its own React and accesses React 16/17 internals
 *   (ReactCurrentOwner) that were removed in React 18, causing a crash on module evaluation.
 *   The iframe loads the SDK from the Zoom CDN in an isolated context with no React conflict.
 *
 * Communication:
 *   Parent → iframe: ZOOM_JOIN      (join params)
 *   Parent → iframe: ZOOM_LEAVE     (request leave)
 *   Parent → iframe: ZOOM_SEND_CHAT (send a chat message inside the meeting)
 *   iframe → Parent: ZOOM_READY     (SDK scripts loaded, ready to receive join params)
 *   iframe → Parent: ZOOM_JOINED    (join() resolved successfully)
 *   iframe → Parent: ZOOM_ERROR     (join() rejected; carries .message)
 *
 * Imperative API (via forwardRef):
 *   ref.sendChat(message) — forwards a chat message into the live Zoom meeting.
 *   Only works while status === "joined".
 */
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Loader2, AlertTriangle, Video, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Imperative handle exposed to parent components via ref */
export interface ZoomEmbedHandle {
  /** Send a chat message visible to all participants inside the Zoom meeting. */
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
   * When provided, the component calls /api/zoom/refresh-meeting before every
   * host join to ensure the ZAK is always fresh (ZAKs expire after ~24 h).
   */
  eventId?:       string;

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
      // Use stored meeting data by default — avoids creating a new meeting ID
      // which would cause error 3000 if the previous meeting is still running.
      // Only refresh when ZAK is missing or explicitly requested (after error 200).
      let joinNumber   = resolved.meetingNumber;
      let joinPassword = resolved.password;
      let joinZak      = resolved.zak;

      if (eventId && (forceRefresh || !joinZak)) {
        try {
          const refreshRes = await fetch("/api/zoom/refresh-meeting", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ eventId }),
          });
          if (refreshRes.ok) {
            const meeting = await refreshRes.json() as {
              meetingId?: number | string;
              password?:  string;
              startUrl?:  string;
            };
            // Only take the meeting ID if we don't already have one.
            // Preserving the existing meetingNumber is critical: the backend's
            // POST /zoom may create a new meeting on some calls; if the OLD
            // meeting is still running, starting a different meeting causes
            // error 3000. We just need a fresh ZAK, not a new meeting.
            if (meeting.meetingId && !joinNumber) joinNumber = String(meeting.meetingId);
            if (meeting.password  !== undefined && !joinPassword) joinPassword = meeting.password;
            if (meeting.startUrl) {
              try {
                const freshZak = new URL(meeting.startUrl).searchParams.get("zak");
                if (freshZak) joinZak = freshZak;
              } catch { /* ignore malformed url */ }
            }
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

          // Error 200 = ZAK expired. Silently refresh and retry once.
          if (typeof msg === "string" && msg.includes("200") && eventId && !forceRefresh) {
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
  }, [resolved, userName]);

  function handleLeave() {
    cleanupListener();
    iframeRef.current?.contentWindow?.postMessage({ type: "ZOOM_LEAVE" }, "*");
    if (iframeRef.current) iframeRef.current.src = "";
    setStatus("idle");
  }

  // Cleanup listener on unmount
  useEffect(() => () => cleanupListener(), []);

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
      {/* Iframe always in DOM — only visible when joined */}
      <iframe
        ref={iframeRef}
        title="Zoom Meeting"
        allow="camera; microphone; display-capture; fullscreen; autoplay"
        style={{
          width:   "100%",
          height,
          border:  "none",
          display: status === "joined" ? "block" : "none",
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
            {errMsg.includes("200") && (
              <p className="text-xs text-amber-400 max-w-xs mt-2">
                Host token expired. Go to Event Settings → Refresh Meeting Token, then try again.
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
            <Button variant="outline" size="sm" onClick={() => { setStatus("idle"); setErrMsg(""); }}>
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

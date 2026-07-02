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
 *   Parent → iframe: ZOOM_JOIN  (join params)
 *   Parent → iframe: ZOOM_LEAVE (request leave)
 *   iframe → Parent: ZOOM_READY  (SDK scripts loaded, ready to receive join params)
 *   iframe → Parent: ZOOM_JOINED (join() resolved successfully)
 *   iframe → Parent: ZOOM_ERROR  (join() rejected; carries .message)
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, Video, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  /** Height in px for the meeting panel. */
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

export default function ZoomEmbed({
  userName,
  height = 680,
  meetingNumber: meetingNumberProp,
  password: passwordProp,
  zak: zakProp,
  eventId,
  streamUrl,
}: ZoomEmbedProps) {
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const listenerRef  = useRef<((e: MessageEvent) => void) | null>(null);
  const [status,  setStatus]  = useState<Status>("idle");
  const [errMsg,  setErrMsg]  = useState("");

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

  const handleLaunch = useCallback(async () => {
    if (!resolved || !iframeRef.current) return;
    setStatus("loading");
    setErrMsg("");
    cleanupListener();

    try {
      // 1. Always refresh the meeting before joining to get a fresh ZAK.
      //    The ZAK in startUrl expires (~24 h). If the backend recreates the
      //    meeting we also need the new meetingId and password, so we carry
      //    the full fresh dto — not just the zak.
      let joinNumber   = resolved.meetingNumber;
      let joinPassword = resolved.password;
      let joinZak      = resolved.zak;

      if (eventId) {
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
            // Use the fresh meetingId so signature and join are always in sync
            if (meeting.meetingId) joinNumber   = String(meeting.meetingId);
            if (meeting.password  !== undefined) joinPassword = meeting.password;
            if (meeting.startUrl) {
              try {
                const freshZak = new URL(meeting.startUrl).searchParams.get("zak");
                if (freshZak) joinZak = freshZak;
              } catch { /* ignore malformed url */ }
            }
          } else {
            const errBody = await refreshRes.json().catch(() => ({})) as { error?: string };
            // Refresh failed — surface it so the user knows to act (e.g. re-login)
            throw new Error(errBody.error ?? `Meeting refresh failed (${refreshRes.status})`);
          }
        } catch (refreshErr: unknown) {
          if (refreshErr instanceof Error && refreshErr.message !== "Meeting refresh failed") throw refreshErr;
          // Otherwise fall through with cached values and let Zoom report the real error
        }
      }

      // 2. Fetch Meeting SDK signature (always role 1 = host)
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

      // 2. Set up message listener before setting iframe src
      const listener = (event: MessageEvent) => {
        if (!event.data) return;
        const { type, message: errMessage } = event.data as { type: string; message?: string };

        if (type === "ZOOM_READY") {
          // Iframe SDK is ready — send join params (use fresh values from refresh)
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
          setStatus("error");
          const msg = typeof errMessage === "string" && errMessage
            ? errMessage
            : (() => { try { return JSON.stringify(errMessage); } catch { return "Failed to join Zoom meeting"; } })();
          setErrMsg(msg || "Failed to join Zoom meeting");
          cleanupListener();
        }
      };

      listenerRef.current = listener;
      window.addEventListener("message", listener);

      // 3. Load the iframe (cache-bust so re-launch always gets a fresh page)
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
            onClick={handleLaunch}
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
            {/* Contextual hints for the most common SDK error codes */}
            {errMsg.includes("3000") && (
              <p className="text-xs text-amber-400 max-w-xs mt-2">
                Another Zoom meeting is already running on this account. End that meeting first, then try again.
              </p>
            )}
            {errMsg.includes("200") && (
              <p className="text-xs text-amber-400 max-w-xs mt-2">
                Host token expired. Go to Event Settings → Refresh Meeting Token, then try again.
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => { setStatus("idle"); setErrMsg(""); }}>
            Try again
          </Button>
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
}

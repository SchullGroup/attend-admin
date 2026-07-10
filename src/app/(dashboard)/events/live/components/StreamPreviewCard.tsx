"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tv2, Link2, ExternalLink } from "lucide-react";
import ZoomEmbed from "@/components/zoom-embed";
import type { useUpdateStreamUrl } from "@/api/client-events";
import { isZoomUrl, isGoogleMeetUrl, isUnembeddableYoutubeUrl } from "./stream-helpers";

export function StreamPreviewCard({
  color,
  eventType,
  streamUrl,
  streamInput,
  setStreamInput,
  streamSaved,
  applyStream,
  updateStreamUrlMutation,
  hostName,
}: {
  color: string;
  eventType: string;
  streamUrl: string;
  streamInput: string;
  setStreamInput: (v: string) => void;
  streamSaved: boolean;
  applyStream: () => void;
  updateStreamUrlMutation: ReturnType<typeof useUpdateStreamUrl>;
  hostName: string;
}) {
  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <Tv2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Stream Preview</h2>
        <span
          className="ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full"
          style={{ backgroundColor: color + "18", color }}
        >
          {eventType}
        </span>
      </div>
      <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
        {streamUrl ? (
          isZoomUrl(streamUrl) ? (
            <ZoomEmbed streamUrl={streamUrl} userName={hostName} height={480} />
          ) : isGoogleMeetUrl(streamUrl) ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="rounded-2xl bg-[#1A73E8]/15 p-4">
                {/* Google Meet icon */}
                <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none">
                  <rect width="40" height="40" rx="8" fill="#1A73E8"/>
                  <path d="M23 20c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" fill="white"/>
                  <path d="M28 15l-5 3.5V15h-9a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h9v-3.5l5 3.5V15z" fill="white"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Google Meet</p>
                <p className="text-xs text-gray-400 mt-1">Cannot be previewed inline. Use the Q&amp;A panel to manage attendee questions.</p>
              </div>
              <a
                href={streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1A73E8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1A73E8]/90"
              >
                <ExternalLink className="h-4 w-4" /> Join Google Meet
              </a>
            </div>
          ) : isUnembeddableYoutubeUrl(streamUrl) ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="rounded-2xl bg-red-500/15 p-4">
                {/* YouTube icon */}
                <svg viewBox="0 0 40 40" className="h-10 w-10" fill="none">
                  <rect width="40" height="40" rx="8" fill="#FF0000"/>
                  <path d="M27.5 15.5c-.2-1-1-1.7-2-1.9-1.8-.3-5.5-.3-5.5-.3s-3.7 0-5.5.3c-1 .2-1.8.9-2 1.9-.3 1.6-.3 5-.3 5s0 3.4.3 5c.2 1 1 1.7 2 1.9 1.8.3 5.5.3 5.5.3s3.7 0 5.5-.3c1-.2 1.8-.9 2-1.9.3-1.6.3-5 .3-5s0-3.4-.3-5z" fill="white"/>
                  <path d="M18 17.5v6l5-3-5-3z" fill="#FF0000"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">YouTube Live</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  This link doesn't point to a specific video, so YouTube won't allow it to load inline. Use the exact video/live URL (e.g. from the Share button on the live stream) for an inline preview, or open it directly.
                </p>
              </div>
              <a
                href={streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                <ExternalLink className="h-4 w-4" /> Open in YouTube
              </a>
            </div>
          ) : (
            <iframe
              key={streamUrl}
              src={streamUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              // @ts-expect-error -- `credentialless` is a valid HTML iframe
              // attribute (not yet in React's IframeHTMLAttributes types).
              // Required so this cross-origin YouTube iframe can still load
              // once the parent page (/events/live) carries
              // Cross-Origin-Embedder-Policy for the Zoom iframe's
              // isolation — without it, COEP would block this embed since
              // YouTube doesn't send back a Cross-Origin-Resource-Policy
              // header. `credentialless` lets it load in an ephemeral,
              // credential-less context instead of being blocked outright.
              credentialless=""
            />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Tv2 className="h-12 w-12 text-gray-600" />
            <p className="text-sm text-gray-400">No stream configured</p>
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-[hsl(var(--border))]">
        <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wide">
          Stream URL
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              value={streamInput}
              onChange={(e) => setStreamInput(e.target.value)}
              placeholder="Paste YouTube, Zoom, or Google Meet URL…"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
              onKeyDown={(e) => e.key === "Enter" && applyStream()}
            />
          </div>
          <Button
            size="sm"
            onClick={applyStream}
            disabled={updateStreamUrlMutation.isPending}
            className="px-4 shrink-0"
          >
            {updateStreamUrlMutation.isPending ? "Saving…" : streamSaved ? "Saved ✓" : "Apply"}
          </Button>
        </div>
        {streamSaved && (
          <p className="text-xs text-green-600 mt-1.5">Stream URL saved — all viewers will see this link.</p>
        )}
      </div>
    </Card>
  );
}

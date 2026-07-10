"use client";
import { Card } from "@/components/ui/card";
import { MessageSquare, ExternalLink } from "lucide-react";
import ZoomEmbed, { type ZoomEmbedHandle } from "@/components/zoom-embed";
import type { ZoomMeetingDto } from "@/api/client-events";
import type { RefObject } from "react";

export function ZoomMeetingCard({
  zoomMeeting,
  zak,
  eventId,
  hostName,
  zoomEmbedRef,
  zoomToasts,
}: {
  zoomMeeting: ZoomMeetingDto;
  zak: string;
  eventId: string;
  hostName: string;
  zoomEmbedRef: RefObject<ZoomEmbedHandle | null>;
  zoomToasts: { id: string; name: string; text: string }[];
}) {
  return (
    <Card className="attend-card">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
        <svg viewBox="0 0 40 40" className="h-4 w-4 shrink-0" fill="none">
          <rect width="40" height="40" rx="8" fill="#0B5CFF"/>
          <path d="M7 14a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5.5l6-4v9l-6-4V26a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V14z" fill="white"/>
        </svg>
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Zoom Meeting</h2>
        <span className="text-xs text-[hsl(var(--muted-foreground))] ml-1">#{zoomMeeting.meetingId}</span>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={zoomMeeting.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Open in Zoom
          </a>
        </div>
      </div>
      <div className="relative overflow-visible">
        <ZoomEmbed
          ref={zoomEmbedRef}
          meetingNumber={zoomMeeting.meetingId}
          password={zoomMeeting.password}
          zak={zak}
          eventId={eventId}
          userName={hostName}
          height={640}
        />
        {/* Q&A toasts — float over the meeting when new questions arrive */}
        {zoomToasts.length > 0 && (
          <div className="absolute bottom-12 left-3 right-3 z-50 flex flex-col gap-2 pointer-events-none">
            {zoomToasts.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-2.5 rounded-xl bg-black/80 backdrop-blur-sm border border-white/10 px-3.5 py-2.5 shadow-lg animate-in slide-in-from-bottom-2 duration-300"
              >
                <div className="h-5 w-5 rounded-full bg-[#0B5CFF] flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare className="h-3 w-3 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white leading-none mb-1">{t.name}</p>
                  <p className="text-xs text-gray-300 leading-snug line-clamp-2">{t.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

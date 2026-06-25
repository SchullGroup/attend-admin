"use client";
import { useState } from "react";
import { Bell, Send, FileText, Megaphone, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import {
  useBroadcastRecipients,
  useBroadcastHistory,
  useSendBroadcast,
  type SendBroadcastRequest,
} from "@/api/client-events";

type Channel = "EMAIL" | "SMS" | "ALL";

const CHANNEL_CONFIG: { key: Channel; label: string; icon: React.ElementType; needsSubject: boolean }[] = [
  { key: "SMS",   label: "SMS",          icon: Send,      needsSubject: false },
  { key: "EMAIL", label: "Email",        icon: FileText,  needsSubject: true  },
  { key: "ALL",   label: "All Channels", icon: Megaphone, needsSubject: true  },
];

interface Props { eventId: string }

export function EventBroadcastTab({ eventId }: Props) {
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: recipientCount = 0 } = useBroadcastRecipients(eventId);
  const { data: historyData, isLoading: historyLoading } = useBroadcastHistory(eventId);
  const sendMutation = useSendBroadcast();

  const history = historyData?.content ?? [];
  const needsSubject = CHANNEL_CONFIG.find((c) => c.key === channel)?.needsSubject ?? false;
  const canSend = !!message.trim() && message.length <= 500 && (!needsSubject || !!subject.trim()) && !sendMutation.isPending;

  function handleSend() {
    const payload: SendBroadcastRequest = {
      channel,
      message: message.trim(),
      ...(needsSubject && subject.trim() ? { subject: subject.trim() } : {}),
    };
    sendMutation.mutate({ eventId, data: payload }, {
      onSuccess: () => { setMessage(""); setSubject(""); },
    });
  }

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* ── Compose ─────────────────────────────────────────── */}
      <div className="col-span-2">
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Send Broadcast</h2>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
              <Users className="h-3.5 w-3.5" />
              {recipientCount.toLocaleString()} recipients
            </div>
          </div>
          <div className="px-5 py-5 flex flex-col gap-4">
            {/* Channel */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                Delivery Channel
              </label>
              <div className="flex gap-2 flex-wrap">
                {CHANNEL_CONFIG.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setChannel(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      channel === key
                        ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-transparent hover:border-[hsl(var(--border))]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
              {channel === "ALL" && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5">
                  Sends via Email + SMS. PUSH is not yet available.
                </p>
              )}
            </div>

            {/* Subject (email / all) */}
            {needsSubject && (
              <div>
                <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Important update about your event"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Write an update for ${recipientCount.toLocaleString()} registered attendees…`}
                rows={4}
                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs ${message.length > 500 ? "text-red-500 font-medium" : "text-[hsl(var(--muted-foreground))]"}`}>
                  {message.length} / 500
                </span>
                {message.length > 500 && <span className="text-xs text-red-500 font-medium">Too long</span>}
              </div>
            </div>

            <Button
              className="self-start gap-2"
              disabled={!canSend}
              onClick={handleSend}
            >
              {sendMutation.isPending ? (
                "Sending…"
              ) : (
                <><Send className="h-4 w-4" /> Send to {recipientCount.toLocaleString()} attendees</>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* ── History ─────────────────────────────────────────── */}
      <div>
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Sent Broadcasts</h2>
          </div>
          {historyLoading ? (
            <Loader variant="inline" text="Loading history…" />
          ) : history.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No broadcasts sent yet.
            </div>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {history.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2 py-0.5">
                      {item.channel}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                      <Clock className="h-3 w-3" />{item.timeAgo}
                    </div>
                  </div>
                  {item.subject && (
                    <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">{item.subject}</p>
                  )}
                  <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed line-clamp-3">{item.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{item.totalRecipients} recipients</span>
                    {item.emailSent > 0 && <span>{item.emailSent} email</span>}
                    {item.smsSent > 0   && <span>{item.smsSent} SMS</span>}
                    {item.skipped > 0   && <span>{item.skipped} skipped</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

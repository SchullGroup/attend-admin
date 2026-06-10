"use client";
import { Bell, Send, FileText, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface BroadcastItem { text: string; channel: string; sentAt: string }

interface Props {
  rsvpCount:         number;
  broadcastMsg:      string;
  setBroadcastMsg:   (v: string) => void;
  broadcastChannel:  "push" | "sms" | "email" | "all";
  setBroadcastChannel: (v: "push" | "sms" | "email" | "all") => void;
  broadcastHistory:  BroadcastItem[];
  setBroadcastHistory: React.Dispatch<React.SetStateAction<BroadcastItem[]>>;
}

export function EventBroadcastTab({
  rsvpCount,
  broadcastMsg, setBroadcastMsg,
  broadcastChannel, setBroadcastChannel,
  broadcastHistory, setBroadcastHistory,
}: Props) {
  function handleSend() {
    setBroadcastHistory((prev) => [
      {
        text: broadcastMsg.trim(),
        channel: broadcastChannel === "all" ? "Push + SMS + Email" : broadcastChannel.charAt(0).toUpperCase() + broadcastChannel.slice(1),
        sentAt: "just now",
      },
      ...prev,
    ]);
    setBroadcastMsg("");
    toast.success("Broadcast sent!");
  }

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2">
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Send Broadcast</h2>
            <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">{rsvpCount.toLocaleString()} recipients</span>
          </div>
          <div className="px-5 py-5 flex flex-col gap-4">
            {/* Channel selector */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Delivery Channel</label>
              <div className="flex gap-2 flex-wrap mt-2">
                {([
                  { key: "push" as const, label: "Push",         icon: Bell },
                  { key: "sms"  as const, label: "SMS",          icon: Send },
                  { key: "email"as const, label: "Email",        icon: FileText },
                  { key: "all"  as const, label: "All Channels", icon: Megaphone },
                ]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setBroadcastChannel(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      broadcastChannel === key
                        ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-transparent hover:border-[hsl(var(--border))]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">Message</label>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder={`Write an update for ${rsvpCount.toLocaleString()} registered attendees…`}
                rows={4}
                className="mt-2 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{broadcastMsg.length} / 500</span>
                {broadcastMsg.length > 500 && <span className="text-xs text-red-500 font-medium">Too long</span>}
              </div>
            </div>

            <Button
              className="self-start gap-2"
              disabled={!broadcastMsg.trim() || broadcastMsg.length > 500}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
              Send to {rsvpCount.toLocaleString()} attendees
            </Button>
          </div>
        </Card>
      </div>

      {/* Sent history */}
      <div>
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Sent Broadcasts</h2>
          </div>
          {broadcastHistory.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No broadcasts sent yet.</div>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {broadcastHistory.map((item, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2 py-0.5">{item.channel}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0">{item.sentAt}</span>
                  </div>
                  <p className="text-sm text-[hsl(var(--foreground))] leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

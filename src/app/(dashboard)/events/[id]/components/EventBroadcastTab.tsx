"use client";
import { useRef, useState } from "react";
import { Bell, Send, FileText, Megaphone, Clock, Users, Smartphone, Eye, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import {
  useBroadcastRecipients,
  useBroadcastHistory,
  useSendBroadcast,
  type SendBroadcastRequest,
  type BroadcastHistoryItem,
} from "@/api/client-events";

type Channel = "EMAIL" | "SMS" | "PUSH" | "IN_APP" | "ALL";

// Email allows a longer body; SMS (and any channel that includes SMS, i.e. ALL)
// plus push/in-app are capped shorter to stay within SMS-safe length.
// Backend raised the email body limit to 10,000 characters (2026-10-12).
const EMAIL_MESSAGE_LIMIT = 10_000;
const SHORT_MESSAGE_LIMIT = 500;

function messageLimitFor(channel: Channel) {
  return channel === "EMAIL" ? EMAIL_MESSAGE_LIMIT : SHORT_MESSAGE_LIMIT;
}

const CHANNEL_CONFIG: { key: Channel; label: string; icon: React.ElementType; needsSubject: boolean }[] = [
  { key: "SMS",   label: "SMS",          icon: Send,      needsSubject: false },
  { key: "EMAIL", label: "Email",        icon: FileText,  needsSubject: true  },
  { key: "PUSH",  label: "Push",         icon: Smartphone, needsSubject: false },
  { key: "IN_APP", label: "In-app",      icon: Bell,       needsSubject: false },
  { key: "ALL",   label: "All Channels", icon: Megaphone, needsSubject: true  },
];

interface Props { eventId: string }

export function EventBroadcastTab({ eventId }: Props) {
  const [channel, setChannel] = useState<Channel>("EMAIL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // Sent broadcast opened in the preview dialog (null = closed)
  const [preview, setPreview] = useState<BroadcastHistoryItem | null>(null);
  const retryRef = useRef<{ signature: string; key: string } | null>(null);

  const { data: recipients } = useBroadcastRecipients(eventId);
  const recipientCount = recipients?.recipientCount ?? 0;

  // How many of the audience this channel can actually reach. Undefined until the
  // backend's per-channel counts are deployed — in that case we fall back to the
  // total and say nothing, which is the old behaviour.
  const reachable: number | undefined =
    channel === "EMAIL"  ? recipients?.emailCount  :
    channel === "SMS"    ? recipients?.smsCount    :
    channel === "PUSH"   ? recipients?.pushCount   :
    channel === "IN_APP" ? recipients?.inAppCount  :
    undefined;                                    // ALL — no single number applies

  const sendCount = reachable ?? recipientCount;
  const skipped   = reachable === undefined ? 0 : Math.max(0, recipientCount - reachable);

  // The specific reason this channel skips people, so the warning names it.
  const skipReason: string | null =
    channel === "EMAIL"  ? "have no email address" :
    channel === "SMS"    ? "have no phone number"  :
    channel === "PUSH"   ? "have no registered device" :
    channel === "IN_APP" ? "have no Attend account" :
    null;
  const { data: historyData, isLoading: historyLoading } = useBroadcastHistory(eventId);
  const sendMutation = useSendBroadcast();

  const history = historyData?.content ?? [];
  const needsSubject = CHANNEL_CONFIG.find((c) => c.key === channel)?.needsSubject ?? false;
  const maxMessageLength = messageLimitFor(channel);
  const canSend = !!message.trim() && message.length <= maxMessageLength && (!needsSubject || (!!subject.trim() && subject.trim().length <= 255)) && !sendMutation.isPending;

  function handleSend() {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    const signature = JSON.stringify({ eventId, channel, subject: trimmedSubject, message: trimmedMessage });
    const idempotencyKey = retryRef.current?.signature === signature
      ? retryRef.current.key
      : crypto.randomUUID();
    retryRef.current = { signature, key: idempotencyKey };

    const payload: SendBroadcastRequest = {
      channel,
      message: trimmedMessage,
      idempotencyKey,
      ...(needsSubject && trimmedSubject ? { subject: trimmedSubject } : {}),
    };
    sendMutation.mutate({ eventId, data: payload }, {
      onSuccess: () => {
        retryRef.current = null;
        setMessage("");
        setSubject("");
      },
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
              {channel === "ALL" ? (
                <div className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <p>Sends through every channel — each person gets it wherever they are reachable.</p>
                  {recipients?.emailCount !== undefined && (
                    <p className="mt-1 tabular-nums">
                      Reach per channel: {recipients.emailCount?.toLocaleString()} email ·{" "}
                      {recipients.smsCount?.toLocaleString()} SMS ·{" "}
                      {recipients.pushCount?.toLocaleString()} push ·{" "}
                      {recipients.inAppCount?.toLocaleString()} in-app
                    </p>
                  )}
                </div>
              ) : skipped > 0 && skipReason ? (
                // Said BEFORE the send, not discovered afterwards from the history card.
                <p className="mt-1.5 text-xs text-amber-700">
                  <b className="tabular-nums">{skipped.toLocaleString()}</b> of{" "}
                  <span className="tabular-nums">{recipientCount.toLocaleString()}</span> {skipReason} and
                  will be skipped.
                </p>
              ) : null}
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
                  maxLength={255}
                />
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] text-right">
                  {subject.length} / 255
                </p>
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
                placeholder={`Write an update for ${sendCount.toLocaleString()} recipients…`}
                rows={4}
                maxLength={maxMessageLength}
                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
              />
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs ${message.length > maxMessageLength ? "text-red-500 font-medium" : "text-[hsl(var(--muted-foreground))]"}`}>
                  {message.length.toLocaleString()} / {maxMessageLength.toLocaleString()}
                  {(channel === "SMS" || channel === "ALL") && <span className="ml-1.5 text-[hsl(var(--muted-foreground))]">· SMS-safe length</span>}
                </span>
                {message.length > maxMessageLength && <span className="text-xs text-red-500 font-medium">Too long</span>}
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
                <>
                  <Send className="h-4 w-4" />
                  Send to {sendCount.toLocaleString()}
                  {reachable !== undefined && channel !== "ALL" ? ` via ${CHANNEL_CONFIG.find((c) => c.key === channel)?.label}` : " attendees"}
                </>
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
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreview(item)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreview(item); } }}
                  className="px-5 py-4 cursor-pointer hover:bg-[hsl(var(--muted)/0.5)] focus:outline-none focus-visible:bg-[hsl(var(--muted)/0.6)] transition-colors group"
                  title="Open the full message"
                >
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full px-2 py-0.5">
                      {item.channel}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                      <span className="hidden group-hover:inline-flex items-center gap-1 text-[hsl(var(--primary))] font-medium">
                        <Eye className="h-3 w-3" /> Preview
                      </span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{item.timeAgo}</span>
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
                    {(item.pushSent ?? 0) > 0 && <span>{item.pushSent} push</span>}
                    {(item.inAppSent ?? 0) > 0 && <span>{item.inAppSent} in-app</span>}
                    {item.skipped > 0   && <span>{item.skipped} skipped</span>}
                  </div>
                  {/* §15 — explain WHY recipients were skipped (no phone, unsubscribed, …). */}
                  {item.skipped > 0 && (item.failureReason ?? (item as any).failure_reason ?? (item as any).skipReason) && (
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="font-medium">Skipped:</span>{" "}
                      {item.failureReason ?? (item as any).failure_reason ?? (item as any).skipReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <BroadcastPreviewDialog item={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "Email", SMS: "SMS", PUSH: "Push", IN_APP: "In-app", ALL: "All channels",
};

/** Full view of a sent broadcast: subject, the whole message, when and to whom. */
function BroadcastPreviewDialog({ item, onClose }: { item: BroadcastHistoryItem | null; onClose: () => void }) {
  const sentAt = item?.sentAt ? new Date(item.sentAt) : null;
  const sentLabel = sentAt && !Number.isNaN(sentAt.getTime())
    ? sentAt.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : item?.timeAgo;
  const stats = item
    ? ([
        ["Recipients", item.totalRecipients],
        ["Email", item.emailSent],
        ["SMS", item.smsSent],
        ["Push", item.pushSent ?? 0],
        ["In-app", item.inAppSent ?? 0],
        ["Skipped", item.skipped],
      ] as [string, number][]).filter(([label, n]) => label === "Recipients" || n > 0)
    : [];
  const skipReason = item && (item.failureReason ?? (item as any).failure_reason ?? (item as any).skipReason);

  function copy() {
    if (!item) return;
    const text = item.subject ? `${item.subject}\n\n${item.message}` : item.message;
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Message copied"),
      () => toast.error("Couldn't copy the message"),
    );
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* Header / scrolling body / fixed footer: a long message scrolls in the
          middle while the title and the actions stay put. */}
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
        <DialogHeader className="px-6 pt-6 pb-4 mb-0 border-b border-[hsl(var(--border))]">
          <DialogTitle className="pr-8 text-lg leading-snug break-words">
            {item?.subject || "Broadcast message"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-semibold bg-[hsl(var(--muted))] rounded-full px-2.5 py-0.5">
                {item ? CHANNEL_LABEL[item.channel] ?? item.channel : ""}
              </span>
              {sentLabel && (
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Sent {sentLabel}</span>
              )}
              {stats.map(([label, n]) => (
                <span key={label} className="inline-flex items-center gap-1">
                  <span className="text-[hsl(var(--border))]">·</span>
                  <span className="font-semibold text-[hsl(var(--foreground))] tabular-nums">{n.toLocaleString()}</span>
                  {label === "Recipients" ? (n === 1 ? "recipient" : "recipients") : label.toLowerCase()}
                </span>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* The message as sent: line breaks kept, the body scrolls. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <p className="text-sm text-[hsl(var(--foreground))] leading-7 whitespace-pre-wrap break-words">
            {item?.message}
          </p>
          {skipReason && (
            <p className="mt-5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">Skipped:</span> {skipReason}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)]">
          <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
            {item ? `${item.message.length.toLocaleString()} characters` : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copy}>
              <Copy className="h-3.5 w-3.5" /> Copy message
            </Button>
            <Button type="button" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

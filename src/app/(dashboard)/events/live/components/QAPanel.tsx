"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, MessageSquare, Clock } from "lucide-react";
import type { useApproveQuestion, useRejectQuestion, useAnswerQuestion, LiveQuestion } from "@/api/client-live";
import { formatTime } from "./helpers";

export function QAPanel({
  questions,
  qaBadgeFlash,
  eventId,
  approveMutation,
  rejectMutation,
  answerMutation,
  onStatusChange,
}: {
  questions:      LiveQuestion[];
  qaBadgeFlash:   boolean;
  eventId:        string;
  approveMutation: ReturnType<typeof useApproveQuestion>;
  rejectMutation:  ReturnType<typeof useRejectQuestion>;
  answerMutation:  ReturnType<typeof useAnswerQuestion>;
  onStatusChange?: (questionId: string, status: LiveQuestion["status"]) => void;
}) {
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({});

  const pending  = questions.filter((q) => q.status === "PENDING");
  const approved = questions.filter((q) => q.status === "APPROVED");
  const answered = questions.filter((q) => q.status === "ANSWERED");

  return (
    <Card className="attend-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2 shrink-0">
        <MessageSquare className={`h-4 w-4 transition-colors ${qaBadgeFlash ? "text-red-500" : "text-[hsl(var(--muted-foreground))]"}`} />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Q&amp;A</h2>
        {pending.length > 0 && (
          <span className={`ml-auto text-xs rounded-full px-2 py-0.5 font-semibold transition-all duration-300 ${
            qaBadgeFlash ? "bg-red-500 text-white animate-pulse" : "bg-amber-100 text-amber-700"
          }`}>
            {pending.length} pending
          </span>
        )}
      </div>

      <div className="overflow-y-auto flex-1">

        {/* ── Moderation queue ── */}
        {pending.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Awaiting moderation ({pending.length})</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {pending.map((q) => (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      {q.anonymous ? "Anonymous" : q.askerName}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(q.submittedAt)}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">{q.content}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1 gap-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => approveMutation.mutate(
                        { eventId, questionId: q.id },
                        { onSuccess: () => onStatusChange?.(q.id, "APPROVED") }
                      )}
                    >
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      onClick={() => rejectMutation.mutate(
                        { eventId, questionId: q.id },
                        { onSuccess: () => onStatusChange?.(q.id, "REJECTED") }
                      )}
                    >
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Approved — awaiting answer ── */}
        {approved.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-blue-50 border-t border-b border-blue-100 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">Approved — answer these ({approved.length})</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {approved.map((q) => (
                <div key={q.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      {q.anonymous ? "Anonymous" : q.askerName}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(q.submittedAt)}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3 leading-relaxed">{q.content}</p>
                  <div className="flex flex-col gap-2">
                    <textarea
                      rows={2}
                      value={answerDraft[q.id] ?? ""}
                      onChange={(e) => setAnswerDraft((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Type your answer…"
                      className="w-full text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs self-end gap-1"
                      disabled={!answerDraft[q.id]?.trim() || answerMutation.isPending}
                      onClick={() =>
                        answerMutation.mutate(
                          { eventId, questionId: q.id, answer: answerDraft[q.id]!.trim() },
                          { onSuccess: () => setAnswerDraft((prev) => { const n = { ...prev }; delete n[q.id]; return n; }) }
                        )
                      }
                    >
                      <Check className="h-3 w-3" /> Post Answer
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Answered ── */}
        {answered.length > 0 && (
          <div>
            <div className="px-5 py-2 bg-green-50 border-t border-green-100 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Answered ({answered.length})</span>
            </div>
            <div className="divide-y divide-[hsl(var(--border))]">
              {answered.map((q) => (
                <div key={q.id} className="px-5 py-3 bg-green-50/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                      {q.anonymous ? "Anonymous" : q.askerName}
                    </span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(q.submittedAt)}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2 leading-relaxed">{q.content}</p>
                  <div className="rounded-lg bg-green-100/60 border border-green-200 px-3 py-2">
                    <p className="text-xs font-semibold text-green-800 mb-0.5">
                      {q.answeredBy ?? "Host"}{q.answeredAt ? ` · ${formatTime(q.answeredAt)}` : ""}
                    </p>
                    <p className="text-xs text-green-900 leading-relaxed">{q.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {questions.length === 0 && (
          <p className="px-5 py-8 text-sm text-[hsl(var(--muted-foreground))] text-center italic">
            No questions yet.
          </p>
        )}
      </div>
    </Card>
  );
}

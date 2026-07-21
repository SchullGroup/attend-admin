"use client";
/**
 * EventGuestAccessCard — manage guest access codes for an event (AGM #2).
 *
 * Guests (directors, regulators, auditors) join view-only with a code — no
 * account, no voting/polls/chat. The join page itself lives on the
 * participant platform; this card only creates/lists/revokes codes and
 * copies them for sharing.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck, Plus, Copy, Check, Ban, Loader2 } from "lucide-react";
import {
  useGuestAccessCodes,
  useCreateGuestAccess,
  useRevokeGuestAccess,
} from "@/api/client-guest-access";

function fmtWhen(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function EventGuestAccessCard({ eventId }: { eventId: string }) {
  const { data: codes, isLoading } = useGuestAccessCodes(eventId);
  const createMutation = useCreateGuestAccess();
  const revokeMutation = useRevokeGuestAccess();

  const [showForm,  setShowForm]  = useState(false);
  const [label,     setLabel]     = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses,   setMaxUses]   = useState("");
  const [copiedId,  setCopiedId]  = useState<string | null>(null);

  function copyCode(id: string, code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function submit() {
    createMutation.mutate(
      {
        eventId,
        payload: {
          ...(label.trim() ? { label: label.trim() } : {}),
          // Backend expects a plain LocalDateTime ("2026-08-01T18:00:00" —
          // no millis, no Z). Sending toISOString() ("…T10:45:00.000Z")
          // made deserialization blow up as a 500 "Unexpected error".
          // datetime-local inputs give "YYYY-MM-DDTHH:mm" — just add :00.
          ...(expiresAt ? { expiresAt: expiresAt.length === 16 ? `${expiresAt}:00` : expiresAt } : {}),
          ...(maxUses ? { maxUses: parseInt(maxUses, 10) } : {}),
        },
      },
      { onSuccess: () => { setShowForm(false); setLabel(""); setExpiresAt(""); setMaxUses(""); } }
    );
  }

  return (
    <Card className="attend-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <UserCheck className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Guest Access</h2>
        {!showForm && (
          <Button size="sm" variant="outline" className="ml-auto h-8 gap-1.5 text-xs" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> New Code
          </Button>
        )}
      </div>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
        View/join-only access for non-shareholder guests (directors, regulators, auditors) — no login,
        no voting or chat. Share the code; guests enter it on the attendee platform&apos;s guest page.
      </p>

      {showForm && (
        <div className="rounded-xl border border-[hsl(var(--border))] p-4 mb-4 flex flex-col gap-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional) — e.g. Board observers"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              Expires
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="px-2 py-1 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
              />
            </label>
            <label className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-2">
              Max uses
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="∞"
                className="w-20 px-2 py-1 text-xs rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
              />
            </label>
          </div>
          <p className="text-xs text-amber-600">
            Tip: keep expiry and max-uses conservative — the guest join endpoint has no rate-limiting yet.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Code"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading codes…
        </div>
      ) : (codes ?? []).length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))] italic">No guest codes yet.</p>
      ) : (
        <div className="divide-y divide-[hsl(var(--border))]">
          {(codes ?? []).map((c) => (
            <div key={c.id} className="py-3 flex items-center gap-3">
              <button
                onClick={() => copyCode(c.id, c.code)}
                className="font-mono text-sm font-bold tracking-wider text-[hsl(var(--foreground))] inline-flex items-center gap-1.5 hover:text-[hsl(var(--primary))]"
                title="Copy code"
              >
                {c.code}
                {copiedId === c.id
                  ? <Check className="h-3.5 w-3.5 text-green-600" />
                  : <Copy className="h-3.5 w-3.5 opacity-50" />}
              </button>
              <div className="min-w-0 flex-1">
                {c.label && <p className="text-xs text-[hsl(var(--foreground))] truncate">{c.label}</p>}
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {c.useCount}{c.maxUses ? `/${c.maxUses}` : ""} uses
                  {c.expiresAt ? ` · expires ${fmtWhen(c.expiresAt)}` : ""}
                </p>
              </div>
              {c.revoked ? (
                <span className="text-xs font-semibold text-red-500 shrink-0">Revoked</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs text-red-600 hover:text-red-700 shrink-0"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate({ eventId, accessId: c.id })}
                >
                  <Ban className="h-3 w-3" /> Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

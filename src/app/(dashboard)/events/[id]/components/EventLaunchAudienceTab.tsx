"use client";

import { useState } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Send,
  Download,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import {
  useListTiers,
  useCreateTier,
  useUpdateTier,
  useDeleteTier,
  useSendInvite,
  useBulkInvite,
  useExportInvites,
  AudienceTier,
} from "@/api/client-events";

// ── helpers ───────────────────────────────────────────────────────────────────

function tierBadgeClass(type: string) {
  return type === "INVITE_ONLY"
    ? "bg-purple-50 text-purple-700"
    : "bg-gray-100 text-gray-600";
}

function tierIconBg(type: string) {
  return type === "INVITE_ONLY" ? "bg-purple-100" : "bg-gray-100";
}

function tierIconColor(type: string) {
  return type === "INVITE_ONLY" ? "text-purple-600" : "text-gray-500";
}

function tierLabel(type: string) {
  return type === "INVITE_ONLY" ? "Invite-only" : type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
}

function inviteCountColor(count: number) {
  if (count === 0) return "text-[hsl(var(--muted-foreground))]";
  if (count >= 1000) return "text-[hsl(var(--foreground))]";
  return "text-purple-600";
}

// ── Tier form ─────────────────────────────────────────────────────────────────

interface TierFormState {
  name: string;
  description: string;
  tierType: string;
  displayOrder: number;
}
const EMPTY_FORM: TierFormState = { name: "", description: "", tierType: "INVITE_ONLY", displayOrder: 1 };

function TierFormPanel({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: TierFormState;
  onSave: (f: TierFormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<TierFormState>(initial);

  return (
    <div className="mt-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            placeholder="e.g. VIP Guests"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Type</label>
          <select
            value={form.tierType}
            onChange={(e) => setForm((p) => ({ ...p, tierType: e.target.value }))}
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          >
            <option value="INVITE_ONLY">Invite Only</option>
            <option value="OPEN">Open</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Description</label>
        <input
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
          placeholder="Short description (optional)"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Display Order</label>
        <input
          type="number"
          min={1}
          value={form.displayOrder}
          onChange={(e) => setForm((p) => ({ ...p, displayOrder: Number(e.target.value) }))}
          className="h-9 w-24 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Inline invite panel ───────────────────────────────────────────────────────

function SendInvitePanel({
  eventId,
  preselectedTierId,
  tiers,
  onClose,
}: {
  eventId: string;
  preselectedTierId: string;
  tiers: AudienceTier[];
  onClose: () => void;
}) {
  const [mode,    setMode]    = useState<"single" | "bulk">("single");
  const [email,   setEmail]   = useState("");
  const [tierId,  setTierId]  = useState(preselectedTierId);
  const [bulk,    setBulk]    = useState("");
  const sendInvite = useSendInvite();
  const bulkInvite = useBulkInvite();

  function handleSingle() {
    if (!email.trim() || !tierId) return;
    sendInvite.mutate({ eventId, email: email.trim(), tierId }, {
      onSuccess: () => { setEmail(""); },
    });
  }

  function handleBulk() {
    if (!tierId || !bulk.trim()) return;
    const emails = bulk.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    bulkInvite.mutate({ eventId, invites: emails.map((e) => ({ email: e, tierId })) }, {
      onSuccess: () => setBulk(""),
    });
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Send Invite</p>
        <button
          onClick={onClose}
          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 w-fit">
        {(["single", "bulk"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMode(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all capitalize ${
              mode === t
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {t === "single" ? "Single" : "Bulk"}
          </button>
        ))}
      </div>

      {/* Tier select */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Tier</label>
        <select
          value={tierId}
          onChange={(e) => setTierId(e.target.value)}
          className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
        >
          {tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {mode === "single" ? (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="attendee@example.com"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            />
          </div>
          <Button
            size="sm"
            className="gap-1.5 w-fit"
            onClick={handleSingle}
            disabled={sendInvite.isPending || !email.trim() || !tierId}
          >
            <Send className="h-3.5 w-3.5" />
            {sendInvite.isPending ? "Sending…" : "Send Invite"}
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Emails <span className="font-normal text-[hsl(var(--muted-foreground))]">(one per line or comma-separated)</span>
            </label>
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={4}
              placeholder={"alice@example.com\nbob@example.com"}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
            />
          </div>
          <Button
            size="sm"
            className="gap-1.5 w-fit"
            onClick={handleBulk}
            disabled={bulkInvite.isPending || !bulk.trim() || !tierId}
          >
            <Upload className="h-3.5 w-3.5" />
            {bulkInvite.isPending ? "Sending…" : "Bulk Upload CSV"}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EventLaunchAudienceTab({ eventId }: { eventId: string }) {
  const { data: tiers = [], isLoading } = useListTiers(eventId);
  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const deleteTier = useDeleteTier();
  const { refetch: exportCsv, isFetching: exporting } = useExportInvites(eventId);

  const [activeTier,  setActiveTier]  = useState<string | null>(null); // tierId whose invite panel is open
  const [showNewForm, setShowNewForm] = useState(false);
  const [editTier,    setEditTier]    = useState<AudienceTier | null>(null);

  function openInvite(tierId: string) {
    setActiveTier((prev) => (prev === tierId ? null : tierId));
  }

  async function handleExport() {
    const result = await exportCsv();
    const csv = result.data;
    if (!csv) return;
    const blob = new Blob([csv as string], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `invites-${eventId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <Loader variant="inline" text="Loading audience tiers…" />;

  return (
    <div className="flex flex-col gap-5">
      <Card className="attend-card p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Audience Tiers</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport} disabled={exporting}>
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setShowNewForm(true); setEditTier(null); }}>
              <Plus className="h-3.5 w-3.5" /> Add Tier
            </Button>
          </div>
        </div>

        {/* New tier form */}
        {showNewForm && (
          <TierFormPanel
            initial={EMPTY_FORM}
            saving={createTier.isPending}
            onCancel={() => setShowNewForm(false)}
            onSave={(f) =>
              createTier.mutate({ eventId, body: f }, { onSuccess: () => setShowNewForm(false) })
            }
          />
        )}

        {/* Tier list */}
        {tiers.length === 0 && !showNewForm ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-[hsl(var(--border))]">
            <Users className="h-8 w-8 text-[hsl(var(--muted-foreground))] mb-2" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No audience tiers yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            {tiers.map((tier) => (
              <div key={tier.id}>
                <div className="flex items-center gap-4 px-5 py-4 bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted)/0.2)] transition-colors">
                  {/* Icon */}
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tierIconBg(tier.tierType)}`}>
                    <Users className={`h-4.5 w-4.5 ${tierIconColor(tier.tierType)}`} style={{ width: 18, height: 18 }} />
                  </div>

                  {/* Name + badge + description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{tier.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tierBadgeClass(tier.tierType)}`}>
                        {tierLabel(tier.tierType)}
                      </span>
                    </div>
                    {tier.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{tier.description}</p>
                    )}
                  </div>

                  {/* Count */}
                  <div className="text-right shrink-0 mr-4 hidden sm:block">
                    <p className={`text-xl font-bold leading-none ${inviteCountColor(tier.invitedCount ?? 0)}`}>
                      {(tier.invitedCount ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">invited</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => openInvite(tier.id)}
                    >
                      <Send className="h-3 w-3" />
                      Send Invite
                    </Button>
                    <button
                      onClick={() => { setEditTier(tier); setShowNewForm(false); }}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteTier.mutate({ eventId, tierId: tier.id })}
                      disabled={deleteTier.isPending}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-[hsl(var(--muted-foreground))] hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Edit form inline */}
                {editTier?.id === tier.id && (
                  <div className="px-5 pb-4 bg-[hsl(var(--card))]">
                    <TierFormPanel
                      initial={{
                        name: tier.name,
                        description: tier.description ?? "",
                        tierType: tier.tierType,
                        displayOrder: tier.displayOrder,
                      }}
                      saving={updateTier.isPending}
                      onCancel={() => setEditTier(null)}
                      onSave={(f) =>
                        updateTier.mutate(
                          { eventId, tierId: tier.id, body: f },
                          { onSuccess: () => setEditTier(null) }
                        )
                      }
                    />
                  </div>
                )}

                {/* Invite panel inline */}
                {activeTier === tier.id && (
                  <div className="px-5 pb-4 bg-[hsl(var(--card))]">
                    <SendInvitePanel
                      eventId={eventId}
                      preselectedTierId={tier.id}
                      tiers={tiers}
                      onClose={() => setActiveTier(null)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add to Invite List — always visible shortcut */}
      <Card className="attend-card p-5">
        <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-4">Add to Invite List</h2>
        {tiers.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Create a tier above before sending invites.</p>
        ) : (
          <SendInvitePanel
            eventId={eventId}
            preselectedTierId={tiers[0]?.id ?? ""}
            tiers={tiers}
            onClose={() => {}}
          />
        )}
      </Card>
    </div>
  );
}

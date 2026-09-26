"use client";

/**
 * EventPanelistsCard — who is allowed to speak in a webinar.
 *
 * Zoom decides panelist vs view-only attendee purely by matching the email a
 * person joins with against the webinar's panelist list. That one fact drives
 * the whole design of this card:
 *
 *   - We pick PEOPLE, not email addresses. Choosing "Chinedu Stephen" from the
 *     event's own attendees sends the exact address on his Attend account, so
 *     the match Zoom needs is right by construction. A typed address is one
 *     transposed character away from a board member silently joining muted, and
 *     nobody finds out until the AGM is live.
 *   - Free text stays, because an external guest speaker may have no Attend
 *     account at all — but it is the exception, not the default path.
 *
 * Mid-webinar promotion is deliberately absent. Zoom's API cannot do it: adding
 * a panelist while the webinar runs only takes effect after that person leaves
 * and rejoins. The host promotes from the Participants panel inside the live
 * Zoom view instead, which is seamless, so the note below points them there.
 */

import { useMemo, useState } from "react";
import { Mic, Plus, Trash2, Search, UserPlus, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { UserAvatar } from "@/components/custom/user-avatar";
import {
  useZoomPanelists,
  useAddZoomPanelist,
  useRemoveZoomPanelist,
  useClientEventAttendees,
} from "@/api/client-events";
import { useOrganisationTeam } from "@/api/client-organisation";
import { popup } from "@/lib/popup-store";

interface Candidate {
  name:   string;
  email:  string;
  source: string;
}

function initialsOf(name: string, email: string) {
  const fromName = name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return fromName || email[0]?.toUpperCase() || "?";
}

export function EventPanelistsCard({
  eventId,
  readOnly = false,
}: {
  eventId: string;
  readOnly?: boolean;
}) {
  const { data: panelists = [], isLoading } = useZoomPanelists(eventId);
  const addPanelist    = useAddZoomPanelist();
  const removePanelist = useRemoveZoomPanelist();

  const [query,      setQuery]      = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualMail, setManualMail] = useState("");

  // Candidates: the people this event already knows about.
  const { data: attendeeData } = useClientEventAttendees(eventId, "", 0, 100);
  const { data: teamData }     = useOrganisationTeam("", "", 0, 100);

  const candidates: Candidate[] = useMemo(() => {
    const rows: Candidate[] = [];
    const seen = new Set<string>();

    const push = (name: string, email: string, source: string) => {
      const key = (email || "").trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      rows.push({ name: name || key, email: key, source });
    };

    for (const m of (teamData as any)?.members ?? (teamData as any)?.content ?? []) {
      push(m.fullName ?? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim(), m.email, "Team");
    }
    for (const a of (attendeeData as any)?.attendees ?? (attendeeData as any)?.content ?? []) {
      push(a.fullName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(), a.email, "Attendee");
    }
    return rows;
  }, [teamData, attendeeData]);

  // Emails already on the list, so we never offer the same person twice. The
  // backend lowercases on store, so compare lowercased.
  const alreadyPanelist = useMemo(
    () => new Set(panelists.map((p) => p.email.toLowerCase())),
    [panelists],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return candidates
      .filter((c) => !alreadyPanelist.has(c.email))
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.includes(q))
      .slice(0, 6);
  }, [query, candidates, alreadyPanelist]);

  function add(name: string, email: string) {
    addPanelist.mutate(
      { eventId, email: email.trim().toLowerCase(), name: name.trim() },
      { onSuccess: () => { setQuery(""); setManualName(""); setManualMail(""); setManualOpen(false); } },
    );
  }

  function addManual() {
    const email = manualMail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      popup.error("Check the email", "That does not look like a valid email address.", 4000);
      return;
    }
    if (alreadyPanelist.has(email)) {
      popup.error("Already a panelist", "That email is already on the list.", 4000);
      return;
    }
    add(manualName || email, email);
  }

  function confirmRemove(id: string, name: string) {
    popup.confirm(
      "Remove panelist?",
      `${name} will join as a view-only attendee instead — no microphone, no video. You can add them back at any time before the webinar starts.`,
      () => removePanelist.mutate({ eventId, panelistId: id }),
      undefined,
      "Remove",
      "Cancel",
    );
  }

  return (
    <Card className="attend-card p-5">
      <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2 mb-1">
        <Mic className="h-4 w-4 text-[#7c22c9]" />
        Panelists
      </h2>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
        Panelists can speak, share video and answer Q&amp;A. Everyone else joins view-only.
        They must sign in with the same email listed here.
      </p>

      {isLoading ? (
        <Loader />
      ) : (
        <>
          {panelists.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
              No panelists yet. Only the host will be able to speak.
            </p>
          ) : (
            <div className="rounded-xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] mb-4">
              {panelists.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <UserAvatar initials={initialsOf(p.name, p.email)} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate" title={p.name}>{p.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate" title={p.email}>{p.email}</p>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => confirmRemove(p.id, p.name)}
                      disabled={removePanelist.isPending}
                      className="text-[hsl(var(--muted-foreground))] hover:text-red-600 transition-colors p-1 shrink-0"
                      aria-label={`Remove ${p.name} as a panelist`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!readOnly && (
            <>
              {/* Pick a person — the safe path */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your team and this event's attendees…"
                  className="h-9 pl-9 text-sm"
                />
              </div>

              {query.trim().length >= 2 && (
                <div className="mt-2 rounded-xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] overflow-hidden">
                  {matches.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                      Nobody matching. If they have no Attend account, add them by email below.
                    </p>
                  ) : matches.map((c) => (
                    <button
                      key={c.email}
                      type="button"
                      disabled={addPanelist.isPending}
                      onClick={() => add(c.name, c.email)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.5)] transition-colors text-left disabled:opacity-50"
                    >
                      <UserAvatar initials={initialsOf(c.name, c.email)} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{c.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{c.email}</p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] shrink-0">
                        {c.source}
                      </span>
                      <Plus className="h-3.5 w-3.5 text-[#7c22c9] shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {/* Escape hatch for an external speaker with no Attend account */}
              {manualOpen ? (
                <div className="mt-3 rounded-xl border border-[hsl(var(--border))] p-3 flex flex-col gap-2">
                  <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                    Add someone without an Attend account
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Full name"
                      className="h-8 text-sm"
                    />
                    <Input
                      type="email"
                      value={manualMail}
                      onChange={(e) => setManualMail(e.target.value)}
                      placeholder="email@example.com"
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-[#7c22c9] hover:bg-[#7c22c9]/90 text-white shrink-0"
                      disabled={addPanelist.isPending}
                      onClick={addManual}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    They must join using exactly this address, or Zoom will treat them as a
                    view-only attendee.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#7c22c9] hover:underline"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add someone without an Attend account
                </button>
              )}

              <p className="mt-4 pt-3 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--muted-foreground))] flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
                Adding a panelist once the webinar is live does not promote them — Zoom only
                applies it after they leave and rejoin. To let someone speak mid-session, promote
                them from the Participants panel in the live view instead.
              </p>
            </>
          )}
        </>
      )}
    </Card>
  );
}

export default EventPanelistsCard;

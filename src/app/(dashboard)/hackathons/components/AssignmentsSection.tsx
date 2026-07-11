"use client";
import React, { useState } from "react";
import { Award, ChevronDown, Star, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import {
  useClientChallengeApplications,
  useApplicationJudgeAssignments,
  useBulkAssignJudges,
  useAutoDistributeJudges,
  useAddCoJudge,
  useRemoveCoJudge,
  type ApplicationItem,
  type JudgeItem,
  type JudgeAssignment,
} from "@/api/client-challenges";

// ---------------------------------------------------------------------------
// Co-judges expandable row
// ---------------------------------------------------------------------------
function CoJudgePanel({
  challengeId,
  applicationId,
  judges,
  appTrack,
  onClose,
}: {
  challengeId:   string;
  applicationId: string;
  judges:        JudgeItem[];
  appTrack?:     string;
  onClose:       () => void;
}) {
  const { data: rawAssignments, isLoading } = useApplicationJudgeAssignments(challengeId, applicationId);
  const addCoJudge    = useAddCoJudge();
  const removeCoJudge = useRemoveCoJudge();
  const [addOpen, setAddOpen] = useState(false);

  // API returns either a flat array or { judges: [] } depending on version
  const assignments: JudgeAssignment[] = Array.isArray(rawAssignments)
    ? (rawAssignments as unknown as JudgeAssignment[])
    : ((rawAssignments as any)?.judges ?? []);
  const primaryId = assignments.find((a) => a.role === "PRIMARY")?.judgeId;
  const coJudges  = assignments.filter((a) => a.role === "CO_JUDGE");

  const assignedJudgeIds = new Set(assignments.map((a) => a.judgeId));
  const eligible = judges.filter((j) => {
    if (assignedJudgeIds.has(j.id) || j.id === primaryId) return false;
    // Apply track restriction: a judge with a specialty can only co-judge their track
    if (j.specialtyTrack && appTrack) {
      return j.specialtyTrack.trim().toLowerCase() === appTrack.trim().toLowerCase();
    }
    return true;
  });

  return (
    <tr className="bg-[hsl(var(--muted)/0.4)] border-t border-[hsl(var(--border))]">
      <td colSpan={5} className="px-5 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Co-Judges</p>
            <button onClick={onClose} className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
              ✕ Close
            </button>
          </div>

          {isLoading ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : coJudges.length === 0 && !addOpen ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No co-judges. Add one to enable collaborative scoring.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {coJudges.map((cj) => {
                const judge = judges.find((j) => j.id === cj.judgeId);
                const name  = cj.judgeName ?? cj.name ?? judge?.name ?? cj.judgeId.slice(0, 8);
                return (
                  <span
                    key={cj.judgeId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: "#7c22c918", color: "#7c22c9", border: "1px solid #e9d5ff" }}
                  >
                    {name}
                    <button
                      disabled={removeCoJudge.isPending}
                      onClick={() => removeCoJudge.mutate({ challengeId, applicationId, judgeId: cj.judgeId })}
                      className="ml-0.5 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors p-0.5"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {!addOpen ? (
            <button
              onClick={() => setAddOpen(true)}
              disabled={eligible.length === 0}
              className="self-start text-xs font-semibold px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-40"
            >
              + Add Co-Judge
            </button>
          ) : (
            <div className="flex flex-wrap gap-1.5 items-center">
              {eligible.length === 0 ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No more eligible judges to add.</p>
              ) : (
                eligible.map((j) => (
                  <button
                    key={j.id}
                    disabled={addCoJudge.isPending}
                    onClick={() => {
                      addCoJudge.mutate({ challengeId, applicationId, judgeId: j.id });
                      setAddOpen(false);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg border border-[hsl(var(--border))] hover:bg-[#7c22c9] hover:text-white hover:border-[#7c22c9] transition-colors"
                  >
                    {j.name}
                  </button>
                ))
              )}
              <button
                onClick={() => setAddOpen(false)}
                className="text-xs px-2 py-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Single assignment row — loads its own saved primary judge on mount
// ---------------------------------------------------------------------------
function AppAssignmentRow({
  challengeId,
  app,
  judges,
  draft,
  onDraftChange,
  expanded,
  onToggleExpand,
  selected,
  onToggleSelect,
}: {
  challengeId:    string;
  app:            ApplicationItem;
  judges:         JudgeItem[];
  draft:          string | undefined;
  onDraftChange:  (judgeId: string) => void;
  expanded:       boolean;
  onToggleExpand: () => void;
  selected:       boolean;
  onToggleSelect: () => void;
}) {
  // Load the saved assignment for this application so the dropdown is
  // pre-populated on page load / after reload.
  const { data: rawAssignments } = useApplicationJudgeAssignments(challengeId, app.id);
  // API returns either a flat array or { judges: [] }
  const assignmentList: JudgeAssignment[] = Array.isArray(rawAssignments)
    ? (rawAssignments as unknown as JudgeAssignment[])
    : ((rawAssignments as any)?.judges ?? []);
  const savedPrimaryId = assignmentList.find((a) => a.role === "PRIMARY")?.judgeId ?? "";

  // Draft takes priority over the saved value
  const selectValue = draft !== undefined ? draft : savedPrimaryId;
  const isDirty     = draft !== undefined && draft !== savedPrimaryId;

  const eligibleJudges = judges.filter((j) => {
    // Judges with no track restriction can be assigned anywhere
    if (!j.specialtyTrack) return true;
    // App has no track → any judge is fine
    if (!app.track) return true;
    // Case-insensitive match (handles minor casing differences in data)
    return j.specialtyTrack.trim().toLowerCase() === app.track.trim().toLowerCase();
  });

  return (
    <React.Fragment>
      <tr className={`attend-table-row ${selected ? "bg-[hsl(var(--muted)/0.6)]" : ""}`}>
        {/* Checkbox */}
        <td className="pl-4 pr-2 py-3 w-8">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[#7c22c9] cursor-pointer"
          />
        </td>
        {/* Team */}
        <td className="px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: app.teamInitialColor || "#7c22c9" }}
            >
              {app.teamInitial || app.teamName?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">{app.teamName}</p>
              {app.ideaTitle && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{app.ideaTitle}</p>
              )}
            </div>
          </div>
        </td>
        {/* Track */}
        <td className="px-5 py-3">
          {app.track ? (
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}
            >
              {app.track}
            </span>
          ) : (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
          )}
        </td>
        {/* Primary judge selector */}
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <select
              value={selectValue}
              onChange={(e) => onDraftChange(e.target.value)}
              className={`text-xs h-8 rounded-lg border px-2 min-w-[160px] focus:outline-none focus:ring-1 focus:ring-[#7c22c9] bg-[hsl(var(--background))] ${
                isDirty
                  ? "border-amber-400 ring-1 ring-amber-300"
                  : "border-[hsl(var(--border))]"
              }`}
            >
              <option value="">— Select judge —</option>
              {eligibleJudges.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
            {isDirty && (
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                Unsaved
              </span>
            )}
            {!isDirty && savedPrimaryId && (
              <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                Saved
              </span>
            )}
          </div>
        </td>
        {/* Co-judges indicator */}
        <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">
          {expanded ? (
            <span className="text-[#7c22c9] font-medium">Editing…</span>
          ) : (
            <span className="italic">Click →</span>
          )}
        </td>
        {/* Co-judges toggle */}
        <td className="px-5 py-3 text-right">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={onToggleExpand}>
            Co-Judges
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </td>
      </tr>
      {expanded && (
        <CoJudgePanel
          challengeId={challengeId}
          applicationId={app.id}
          judges={judges}
          appTrack={app.track}
          onClose={onToggleExpand}
        />
      )}
    </React.Fragment>
  );
}

// ---------------------------------------------------------------------------
// Assignments section — shared between the challenge detail page's Judges
// tab and the standalone /hackathons/judging page's Assignments tab. Both
// used to have their own separate, drifted implementations (different
// columns, no inline Primary Judge visibility on one of them) even though
// they hit the same backend endpoints — this single component is now the
// source of truth for both, so what you see on one page always matches
// the other.
// ---------------------------------------------------------------------------
export function AssignmentsSection({
  challengeId,
  judges,
  tracks,
}: {
  challengeId: string;
  judges:      JudgeItem[];
  tracks:      string[];
}) {
  const { data: appsData, isLoading: appsLoading } =
    useClientChallengeApplications(challengeId, "SHORTLISTED", "", 0, 200);

  const bulkAssign     = useBulkAssignJudges();
  const autoDistribute = useAutoDistributeJudges();

  // Only stores CHANGED values — saved state comes from per-row query
  const [draftMap,     setDraftMap]    = useState<Record<string, string>>({});
  const [autoTrack,    setAutoTrack]   = useState("");
  const [expandedApp,  setExpandedApp] = useState<string | null>(null);
  // Bulk-select state
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [bulkJudgeId,  setBulkJudgeId]  = useState("");

  const apps     = appsData?.applications ?? [];
  const hasDraft = Object.values(draftMap).some((v) => v !== undefined);

  const allSelected  = apps.length > 0 && apps.every((a) => selectedApps.has(a.id));
  const someSelected = selectedApps.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedApps(new Set());
    } else {
      setSelectedApps(new Set(apps.map((a) => a.id)));
    }
  }

  function toggleSelectApp(id: string) {
    setSelectedApps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleBulkAssign() {
    if (!bulkJudgeId || selectedApps.size === 0) return;
    const assignments = Array.from(selectedApps).map((applicationId) => ({
      applicationId,
      judgeId: bulkJudgeId,
    }));
    bulkAssign.mutate(
      { challengeId, assignments },
      {
        onSuccess: () => {
          setSelectedApps(new Set());
          setBulkJudgeId("");
        },
      }
    );
  }

  function handleSave() {
    const assignments = Object.entries(draftMap)
      .filter(([, judgeId]) => !!judgeId)
      .map(([applicationId, judgeId]) => ({ applicationId, judgeId }));
    if (assignments.length === 0) return;
    bulkAssign.mutate(
      { challengeId, assignments },
      { onSuccess: () => setDraftMap({}) }   // clear draft after save
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#7c22c9]" />
            Application Assignments
          </h3>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Assign a primary judge per application. Once saved, each judge only sees their assigned apps.
          </p>
        </div>
        {/* Auto-distribute */}
        <div className="flex items-center gap-2 flex-wrap">
          {tracks.length > 0 && (
            <select
              value={autoTrack}
              onChange={(e) => setAutoTrack(e.target.value)}
              className="text-xs h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 focus:outline-none"
            >
              <option value="">All tracks</option>
              {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <Button
            size="sm" variant="outline" className="gap-1.5"
            disabled={autoDistribute.isPending || judges.length === 0}
            onClick={() => autoDistribute.mutate({ challengeId, track: autoTrack || undefined })}
          >
            <Award className="h-3.5 w-3.5" />
            {autoDistribute.isPending ? "Distributing…" : "Auto-Distribute"}
          </Button>
        </div>
      </div>

      {appsLoading ? (
        <Loader variant="inline" text="Loading shortlisted applications…" />
      ) : apps.length === 0 ? (
        <Card className="attend-card p-8 text-center">
          <Star className="h-7 w-7 mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No shortlisted applications</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            Move applications to SHORTLISTED status first, then assign judges here.
          </p>
        </Card>
      ) : (
        <>
          {/* Bulk-assign bar — visible when rows are selected */}
          {someSelected && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-[#7c22c9]/30 bg-[#faf5ff] flex-wrap">
              <span className="text-xs font-semibold text-[#7c22c9]">
                {selectedApps.size} selected
              </span>
              <select
                value={bulkJudgeId}
                onChange={(e) => setBulkJudgeId(e.target.value)}
                className="text-xs h-8 rounded-lg border border-[hsl(var(--border))] bg-white px-2 flex-1 min-w-[180px] max-w-[260px] focus:outline-none focus:ring-1 focus:ring-[#7c22c9]"
              >
                <option value="">— Select judge to assign —</option>
                {judges.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}{j.specialtyTrack ? ` (${j.specialtyTrack})` : ""}</option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!bulkJudgeId || bulkAssign.isPending}
                onClick={handleBulkAssign}
                className="gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" />
                {bulkAssign.isPending ? "Assigning…" : "Assign Selected"}
              </Button>
              <button
                onClick={() => setSelectedApps(new Set())}
                className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] ml-auto"
              >
                Clear selection
              </button>
            </div>
          )}

          <Card className="attend-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[#7c22c9] cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-3 text-left">Team</th>
                  <th className="px-5 py-3 text-left">Track</th>
                  <th className="px-5 py-3 text-left">Primary Judge</th>
                  <th className="px-5 py-3 text-left">Co-Judges</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <AppAssignmentRow
                    key={app.id}
                    challengeId={challengeId}
                    app={app}
                    judges={judges}
                    draft={draftMap[app.id]}
                    onDraftChange={(judgeId) =>
                      setDraftMap((prev) => ({ ...prev, [app.id]: judgeId }))
                    }
                    expanded={expandedApp === app.id}
                    onToggleExpand={() =>
                      setExpandedApp(expandedApp === app.id ? null : app.id)
                    }
                    selected={selectedApps.has(app.id)}
                    onToggleSelect={() => toggleSelectApp(app.id)}
                  />
                ))}
              </tbody>
            </table>
          </Card>

          {/* Save bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {hasDraft
                ? `${Object.values(draftMap).filter(Boolean).length} unsaved change(s)`
                : "All assignments saved."}
            </p>
            <Button
              size="sm"
              disabled={!hasDraft || bulkAssign.isPending}
              onClick={handleSave}
            >
              {bulkAssign.isPending ? "Saving…" : "Save Assignments"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

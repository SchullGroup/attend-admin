"use client";
import { useEffect, useState } from "react";
import { Vote, CheckCircle2, Users, BookOpen, Award, Download, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useExportResolutions } from "@/api/client-votes";
import type { VoteResultsResponse } from "@/api/client-votes";
import {
  usePostAgmSummary,
  useAgmMinutes,
  useSaveDraftMinutes,
  useFinaliseMinutes,
  useCertificateEligibility,
  useSendCertificates,
  useExportAttendanceRegister,
  useExportVoteAuditLog,
  useStatutoryReturn,
  downloadCsvText,
} from "@/api/client-post-agm";
import type { EventShim } from "./types";

interface Props {
  event:        EventShim;
  voteResults:  VoteResultsResponse | null | undefined;
  participants: any[];
  eventId:      string;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function EventPostAgmTab({ event, voteResults, participants, eventId }: Props) {
  // ── Summary ──────────────────────────────────────────────────────────────
  const { data: summary, isLoading: summaryLoading } = usePostAgmSummary(eventId);

  const resolutions    = voteResults?.resolutions ?? [];
  const passed         = summary?.resolutionsPassed ?? resolutions.filter((r) => r.passed).length;
  const totalRes       = summary?.totalResolutions ?? resolutions.length;
  const totalVotesCast = voteResults?.totalVotesCast
    ?? resolutions.reduce((s, r) => s + (r.combinedForCount ?? 0) + (r.combinedAgainstCount ?? 0) + (r.combinedAbstainCount ?? 0), 0);

  // ── Draft minutes ────────────────────────────────────────────────────────
  const { data: minutes, isLoading: minutesLoading } = useAgmMinutes(eventId);
  const saveDraft  = useSaveDraftMinutes();
  const finalise   = useFinaliseMinutes();
  const [content, setContent] = useState("");
  const [touchedContent, setTouchedContent] = useState(false);

  useEffect(() => {
    if (minutes && !touchedContent) setContent(minutes.content ?? "");
  }, [minutes, touchedContent]);

  const isFinalised = (minutes?.status ?? "").toUpperCase() === "FINALISED";

  // ── Certificates ─────────────────────────────────────────────────────────
  const { data: certEligibility, isLoading: certLoading } = useCertificateEligibility(eventId);
  const sendCertificates = useSendCertificates();

  // ── Exports ──────────────────────────────────────────────────────────────
  const [exportingLegacy, setExportingLegacy] = useState(false);
  const { refetch: fetchVoteAuditCsv }   = useExportVoteAuditLog(eventId);
  const { refetch: fetchAttendanceCsv }  = useExportAttendanceRegister(eventId);
  const { refetch: fetchStatutoryReturn } = useStatutoryReturn(eventId);
  const { refetch: fetchExportLegacy }   = useExportResolutions(eventId); // fallback if post-agm route 404s
  const [exportingVotes,      setExportingVotes]      = useState(false);
  const [exportingAttendance, setExportingAttendance] = useState(false);
  const [exportingStatutory,  setExportingStatutory]  = useState(false);

  async function handleExportVoteAudit() {
    setExportingVotes(true);
    try {
      const result = await fetchVoteAuditCsv();
      if (result.data) {
        downloadCsvText(`${event.title ?? eventId}-vote-audit.csv`, result.data);
        return;
      }
      // Fallback to the structured votes export if the post-agm CSV route isn't available.
      setExportingLegacy(true);
      const legacy = await fetchExportLegacy();
      const exp = legacy.data;
      if (!exp) return;
      const header = ["Order", "Title", "Special", "Status", "For (count)", "Against (count)", "Abstain (count)", "For (shares)", "Against (shares)", "Abstain (shares)", "Total Votes", "Result"];
      const rows   = exp.resolutions.map((r) => [
        String(r.order), r.title, r.specialResolution ? "Yes" : "No", r.status,
        String(r.forCount), String(r.againstCount), String(r.abstainCount),
        String(r.forShares), String(r.againstShares), String(r.abstainShares),
        String(r.totalVotes), r.result,
      ]);
      downloadCsv(`${exp.eventTitle ?? eventId}-vote-audit.csv`, [header, ...rows]);
    } finally {
      setExportingVotes(false);
      setExportingLegacy(false);
    }
  }

  async function handleExportAttendance() {
    setExportingAttendance(true);
    try {
      const result = await fetchAttendanceCsv();
      if (result.data) downloadCsvText(`${event.title ?? eventId}-attendance-register.csv`, result.data);
    } finally {
      setExportingAttendance(false);
    }
  }

  async function handleExportStatutoryReturn() {
    setExportingStatutory(true);
    try {
      const result = await fetchStatutoryReturn();
      if (result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = `${event.title ?? eventId}-statutory-return.json`; a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExportingStatutory(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Summary strip */}
      <div className="grid grid-cols-4 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        {[
          { label: "Resolutions Passed", value: summaryLoading ? "…" : `${passed} / ${totalRes}`, icon: Vote, color: "#1a6b3c" },
          { label: "Total Votes Cast",   value: (summary?.totalVotesCastShares ?? totalVotesCast).toLocaleString(), icon: CheckCircle2, color: "#111827" },
          { label: "Attendees Present",  value: (summary?.totalCheckedIn ?? event.rsvpCount).toLocaleString(), icon: Users, color: "#7c22c9" },
          { label: "Minutes Status",     value: summaryLoading ? "…" : (summary?.minutesStatus ?? minutes?.status ?? "Not Started"), icon: BookOpen, color: "#d97706" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-4">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "15" }}>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</p>
              <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Draft minutes */}
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Draft Minutes
            {isFinalised && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] rounded-full px-2 py-0.5">
                <Lock className="h-3 w-3" /> Finalised
              </span>
            )}
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={isFinalised || saveDraft.isPending || minutesLoading}
              onClick={() => saveDraft.mutate({ eventId, content }, { onSuccess: () => setTouchedContent(false) })}
            >
              {saveDraft.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Draft"}
            </Button>
            <Button
              size="sm"
              disabled={isFinalised || finalise.isPending || minutesLoading || !content.trim()}
              onClick={() => finalise.mutate(eventId)}
            >
              {finalise.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Finalise & Distribute"}
            </Button>
          </div>
        </div>
        {minutesLoading ? (
          <div className="h-40 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
        ) : (
          <textarea
            rows={10}
            value={content}
            disabled={isFinalised}
            onChange={(e) => { setContent(e.target.value); setTouchedContent(true); }}
            placeholder={`MINUTES OF THE ANNUAL GENERAL MEETING\n\nHeld on ${new Date(event.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${event.startTime}\n\nATTENDANCE: ${event.rsvpCount.toLocaleString()} shareholders present or represented.\n\nBUSINESS TRANSACTED\n1. ...\n`}
            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
        )}
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="h-9 w-9 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-3">
            <Vote className="h-4 w-4 text-[hsl(var(--primary))]" />
          </div>
          <div className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">Vote Audit Log</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-4">All vote records: resolution, voter, choice, and share count</div>
          <button
            disabled={exportingVotes || exportingLegacy}
            onClick={handleExportVoteAudit}
            className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {(exportingVotes || exportingLegacy) ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="h-9 w-9 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-3">
            <Users className="h-4 w-4 text-[hsl(var(--primary))]" />
          </div>
          <div className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">Attendance Register</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-4">All registrants with check-in status and KYC status</div>
          <button
            disabled={exportingAttendance}
            onClick={handleExportAttendance}
            className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {exportingAttendance ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
          <div className="h-9 w-9 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center mb-3">
            <Award className="h-4 w-4 text-[hsl(var(--primary))]" />
          </div>
          <div className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">Statutory Return</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))] mb-4">Attendance, quorum, and per-resolution vote totals for SEC/CAC filing</div>
          <button
            disabled={exportingStatutory}
            onClick={handleExportStatutoryReturn}
            className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {exportingStatutory ? "Exporting…" : "Export Data"}
          </button>
        </div>
      </div>

      {/* Certificates */}
      <Card className="attend-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
            <Award className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> Attendance Certificates
          </h2>
          <Button
            size="sm" variant="outline"
            disabled={sendCertificates.isPending || certLoading || (certEligibility?.totalPending ?? 0) === 0}
            onClick={() => sendCertificates.mutate(eventId)}
          >
            {sendCertificates.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send All Certificates"}
          </Button>
        </div>
        {certLoading ? (
          <div className="h-16 rounded-xl bg-[hsl(var(--muted))] animate-pulse" />
        ) : (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--muted)/0.4)]">
            <CheckCircle2 className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                {certEligibility?.totalEligible ?? participants.filter((p) => p.kycStatus === "full").length} verified attendees eligible for certificates
              </p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                {certEligibility
                  ? `${certEligibility.totalSent} sent · ${certEligibility.totalPending} pending`
                  : "Certificates will be delivered to their document vault and email"}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

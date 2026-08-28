"use client";

import { useEffect, useRef, useState } from "react";
import {
  GraduationCap, Mail, Bell, Download, Send, CheckCircle2, AlertTriangle, X, Users,
} from "lucide-react";
import {
  useChallengeParticipationPreview,
  useIssueChallengeParticipation,
  useChallengeParticipationRun,
  useLatestChallengeParticipationRun,
  useClientChallengeDetail,
  certificateDownloadUrl,
  isWinnerAnnouncementTerminal,
  isChallengeEnded,
  type ParticipationMember,
  type ParticipationApplication,
  type ParticipationRun,
  type ParticipationSkipReason,
} from "@/api/client-challenges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";

const BRAND = "#7c22c9";

const SKIP_LABEL: Record<ParticipationSkipReason, string> = {
  ALREADY_ISSUED: "Already issued",
  IS_WINNER:      "Winner — gets a winner certificate",
  NO_EMAIL:       "No email on file",
};

/** Progress card for the issuance run. The run body is identical to a winner
 *  announcement, so the shape matches — only the wording differs (issue, not
 *  announce; a thank-you, not a congratulation). */
function ParticipationRunProgress({ progress, onDismiss }: { progress: ParticipationRun; onDismiss?: () => void }) {
  const status = progress.status?.toUpperCase();
  const terminal = isWinnerAnnouncementTerminal(status);
  const failed = status === "FAILED";
  const withErrors = status === "COMPLETED_WITH_ERRORS";

  const tone = failed
    ? { bg: "#dc262612", fg: "#dc2626", label: "Failed", Icon: AlertTriangle }
    : withErrors
    ? { bg: "#f59e0b12", fg: "#b45309", label: "Completed with errors", Icon: AlertTriangle }
    : terminal
    ? { bg: "#16a34a12", fg: "#16a34a", label: "Certificates issued", Icon: CheckCircle2 }
    : { bg: `${BRAND}12`, fg: BRAND, label: "Issuing…", Icon: Send };

  const stat = (label: string, value?: number) => (
    <div className="text-center">
      <p className="text-lg font-black tabular-nums text-[hsl(var(--foreground))]">{value ?? 0}</p>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{label}</p>
    </div>
  );

  return (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-3 border-b border-[hsl(var(--border))] flex items-center gap-2" style={{ backgroundColor: tone.bg }}>
        <tone.Icon className={`h-4 w-4 ${terminal ? "" : "animate-pulse"}`} style={{ color: tone.fg }} />
        <span className={`text-sm font-semibold ${terminal ? "" : "animate-pulse"}`} style={{ color: tone.fg }}>{tone.label}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-auto p-1 rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="px-5 py-4 grid grid-cols-4 gap-3">
        {stat("Certificates", progress.certificatesIssued)}
        {stat("Emails sent", progress.emailsSent)}
        {stat("In-app sent", progress.inAppSent)}
        {stat("Emails failed", progress.emailsFailed)}
      </div>
      {!terminal && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Issuance runs in the background — you can safely leave this page and come back.
            If it hasn’t started after a few minutes, it will be marked failed automatically so you can retry.
          </p>
        </div>
      )}
      {(failed || withErrors) && (progress.errorMessage || progress.errorCode) && (
        <div className="px-5 pb-3 text-xs text-[#dc2626]">
          {progress.errorMessage || progress.errorCode}
        </div>
      )}
      {Array.isArray(progress.failures) && progress.failures.length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-1.5">Delivery failures</p>
          <ul className="flex flex-col gap-1">
            {progress.failures.map((f, i) => (
              <li key={i} className="text-xs text-[hsl(var(--muted-foreground))]">
                <span className="text-[hsl(var(--foreground))]">{f.recipient || "Recipient"}</span>
                {f.reason ? ` — ${f.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ParticipationMemberRow({ member }: { member: ParticipationMember }) {
  const willReceive = member.willReceive !== false && !member.skipReason;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className={`text-sm truncate ${willReceive ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}`}>
          {member.name || "Unnamed member"}
        </p>
        {member.email && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{member.email}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {willReceive ? (
          <>
            {member.email && (
              <span title="Will receive the thank-you email" className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND}10`, color: BRAND }}>
                <Mail className="h-3 w-3" /> Email
              </span>
            )}
            {member.hasAttendAccount && (
              <span title="Will receive an in-app notification" className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#16a34a12] text-[#16a34a]">
                <Bell className="h-3 w-3" /> In-app
              </span>
            )}
            {member.certificateId && (
              <a
                href={certificateDownloadUrl(member.certificateId)}
                target="_blank"
                rel="noopener noreferrer"
                title="Download certificate PDF"
                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:opacity-80 transition-opacity"
              >
                <Download className="h-3 w-3" /> Certificate
              </a>
            )}
          </>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
            {member.skipReason ? SKIP_LABEL[member.skipReason] : "Skipped"}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Participation-certificate issuance for a challenge.
 *
 * Mirrors the Winners flow (preview → issue → poll → restore) but there is no
 * organiser message: the participation email is a fixed server-side thank-you,
 * and the recipient list is recomputed on issue rather than submitted from the
 * preview. Gated on the challenge being ENDED, exactly like winners.
 */
export function ParticipationCertificates({ challengeId, readOnly }: { challengeId: string; readOnly?: boolean }) {
  const { data, isLoading, isError, error } = useChallengeParticipationPreview(challengeId);
  const { data: challenge } = useClientChallengeDetail(challengeId);
  const issue = useIssueChallengeParticipation();

  const [runId, setRunId] = useState<string | null>(null);
  const idemRef = useRef<string | null>(null);
  const restoredRef = useRef(false);

  // Restore the last run's progress after a reload without persisting the id.
  const { data: latest } = useLatestChallengeParticipationRun(challengeId);
  useEffect(() => {
    if (restoredRef.current) return;
    if (runId) { restoredRef.current = true; return; }
    if (latest?.announcementId) {
      restoredRef.current = true;
      setRunId(latest.announcementId);
    }
  }, [latest?.announcementId, runId]);

  const { data: progress } = useChallengeParticipationRun(challengeId, runId);

  if (isLoading) return <Loader variant="inline" text="Checking eligibility…" />;

  if (isError) {
    const serverMsg = (error as any)?.response?.data?.message;
    return (
      <Card className="attend-card px-5 py-12 text-center">
        <GraduationCap className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Participation isn’t available yet</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-md mx-auto">
          {serverMsg || "Participation certificates can be issued once the challenge has ended."}
        </p>
      </Card>
    );
  }

  const applications: ParticipationApplication[] = data?.applications ?? [];
  const allMembers = applications.flatMap((a) => a.members ?? []);
  const willReceive = allMembers.filter((m) => m.willReceive !== false && !m.skipReason);
  const skipped = allMembers.filter((m) => m.willReceive === false || !!m.skipReason);

  const recipientCount = data?.totalRecipients ?? data?.willReceiveCount ?? willReceive.length;
  const skippedCount = data?.skippedCount ?? skipped.length;

  const ended = isChallengeEnded(challenge?.status);
  const alreadyIssued = isWinnerAnnouncementTerminal(progress?.status);
  const canIssue = !readOnly && ended && recipientCount > 0 && !issue.isPending;

  const summary = [
    { label: "Eligible applications", value: data?.totalApplications ?? applications.length },
    { label: "Will receive",          value: recipientCount },
    { label: "Skipped",               value: skippedCount },
    { label: "With in-app",           value: willReceive.filter((m) => m.hasAttendAccount).length },
  ];

  function handleIssue() {
    if (!ended) return;
    if (!idemRef.current) idemRef.current = crypto.randomUUID();
    const key = idemRef.current;
    popup.confirm(
      alreadyIssued ? "Re-run Issuance?" : "Issue Participation Certificates?",
      `This will issue thank-you certificates to ${recipientCount} participant(s) who didn’t win. Winners and anyone already issued are skipped automatically.`,
      () => {
        issue.mutate(
          { challengeId, idempotencyKey: key },
          {
            onSuccess: (res) => {
              idemRef.current = null;
              if (res?.announcementId) setRunId(res.announcementId);
            },
          }
        );
      },
      undefined,
      alreadyIssued ? "Re-run" : "Issue",
      "Cancel"
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Progress (if a run has been kicked off) */}
      {runId && progress && (
        <ParticipationRunProgress progress={progress} onDismiss={() => setRunId(null)} />
      )}

      {applications.length === 0 ? (
        <Card className="attend-card px-5 py-12 text-center">
          <GraduationCap className="h-8 w-8 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">No eligible participants yet</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 max-w-md mx-auto">
            Participation certificates go to entrants whose applications were submitted and assessed
            (including those not progressed) — but not winners, withdrawals or rejections.
          </p>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {summary.map((s) => (
              <Card key={s.label} className="attend-card px-4 py-3 text-center">
                <p className="text-xl font-black tabular-nums text-[hsl(var(--foreground))]">{s.value ?? "—"}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Eligible applications */}
          <div className="flex flex-col gap-3">
            {applications.map((app) => (
              <Card key={app.applicationId} className="attend-card overflow-hidden">
                <div className="px-5 py-3 border-b border-[hsl(var(--border))] flex items-center gap-3">
                  <span className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND}12` }}>
                    <Users className="h-4 w-4" style={{ color: BRAND }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[hsl(var(--foreground))] truncate">{app.teamName}</p>
                    {app.ideaTitle && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{app.ideaTitle}</p>
                    )}
                  </div>
                  {app.status && (
                    <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#faf5ff", color: BRAND, border: "1px solid #e9d5ff" }}>
                      {app.status}
                    </span>
                  )}
                </div>
                <div className="px-5 py-2 divide-y divide-[hsl(var(--border))]">
                  {(app.members ?? []).map((m, i) => (
                    <ParticipationMemberRow key={m.memberId ?? m.email ?? i} member={m} />
                  ))}
                  {(!app.members || app.members.length === 0) && (
                    <p className="py-2 text-xs text-[hsl(var(--muted-foreground))]">No members on record.</p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Issue */}
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Issue participation certificates</h2>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Each eligible participant receives a certificate (numbered <span className="font-mono text-xs">ATP-…</span>) and a
                thank-you email. Winners are never included — nobody gets both. The list is recomputed at issue time,
                and anyone already holding a certificate is skipped, so re-running is safe.
              </p>

              {!readOnly && !ended && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Participation certificates can only be issued after the challenge has ended. Open the{" "}
                    <span className="font-semibold">Overview</span> tab and use <span className="font-semibold">End Challenge</span> to
                    finalize results.
                    {challenge?.status && (<> Current status: <span className="font-semibold">{challenge.status}</span>.</>)}
                  </span>
                </div>
              )}

              {!readOnly ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {recipientCount} will receive · {skippedCount} skipped
                  </p>
                  <Button onClick={handleIssue} disabled={!canIssue} className="ml-auto">
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {issue.isPending ? "Issuing…" : alreadyIssued ? "Re-run issuance" : ended ? "Issue certificates" : "End challenge to issue"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  You have read-only access. Ask an organisation admin to issue participation certificates.
                </p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

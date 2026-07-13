"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, ChevronDown, ArrowLeft, ChevronRight, Search,
  Users, Trophy, Lightbulb, ExternalLink, Code, Target, ClipboardList,
  Video, Link2, Globe, Download, X,
} from "lucide-react";
import {
  useClientChallenges,
  useClientChallengeApplications,
  useClientChallengeApplication,
  useUpdateClientApplicationStatus,
  useExportChallengeApplications,
  type ApplicationStatus,
  type ApplicationItem,
  type ExportApplicationItem,
} from "@/api/client-challenges";
import { useGetMe } from "@/api/auth/hooks";
import {
  useJudgeChallenges,
  useJudgeChallengeApplications,
  useJudgeApplication,
} from "@/api/judge";
import { useAdminChallenges } from "@/api/admin-challenges";
import { EventChallengeApplicationsTab } from "../../events/[id]/components/EventChallengeApplicationsTab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import { popup } from "@/lib/popup-store";

/** Build an Excel-compatible XML workbook (no external dependency). */
function buildExcelXml(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const cell = (v: unknown) => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  const xmlRow = (cells: (string | number | null | undefined)[]) =>
    `<Row>${cells.map(cell).join("")}</Row>`;
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Applications"><Table>
${xmlRow(headers)}
${rows.map(xmlRow).join("\n")}
</Table></Worksheet></Workbook>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure a URL has an absolute protocol so it doesn't open as a relative path */
function ensureAbsoluteUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function statusChip(status: string) {
  const s = status?.toUpperCase();
  const map: Record<string, { bg: string; color: string }> = {
    SUBMITTED:      { bg: "#3b82f618", color: "#3b82f6" },
    UNDER_REVIEW:   { bg: "#f59e0b18", color: "#d97706" },
    SHORTLISTED:    { bg: "#0891b218", color: "#0891b2" },
    SELECTED:       { bg: "#16a34a18", color: "#16a34a" },
    NOT_PROGRESSED: { bg: "#6b728018", color: "#6b7280" },
  };
  const style = map[s] ?? { bg: "#7c22c918", color: "#7c22c9" };
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}

const STATUS_OPTIONS: ApplicationStatus[] = [
  "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "SELECTED", "NOT_PROGRESSED",
];

const VALID_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED:      ["UNDER_REVIEW", "NOT_PROGRESSED"],
  UNDER_REVIEW:   ["SHORTLISTED", "NOT_PROGRESSED"],
  SHORTLISTED:    ["SELECTED", "NOT_PROGRESSED"],
  SELECTED:       [],
  NOT_PROGRESSED: [],
};

// ---------------------------------------------------------------------------
// Application detail view
// ---------------------------------------------------------------------------
function ApplicationDetail({
  challengeId,
  applicationId,
  onBack,
  readOnly = false,
}: {
  challengeId:   string;
  applicationId: string;
  onBack:        () => void;
  readOnly?:     boolean;
}) {
  const { data: app, isLoading } = useClientChallengeApplication(challengeId, applicationId);
  const updateStatus = useUpdateClientApplicationStatus();

  if (isLoading) return <Loader variant="inline" text="Loading application…" />;
  if (!app) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Not found.</p>;

  const validNext = VALID_TRANSITIONS[app.status?.toUpperCase()] ?? [];

  // Collect all submission links from the new API fields
  const links = [
    { label: "Pitch Deck",      url: app.pitchDeckUrl,           icon: FileText,     desc: "PDF / PPTX"           },
    { label: "Pitch Video",     url: app.pitchVideoUrl,          icon: Video,        desc: "YouTube or Loom"      },
    { label: "Idea Video",      url: app.ideaVideoUrl,           icon: Video,        desc: "Idea walkthrough"     },
    { label: "Demo Video",      url: app.demoVideoUrl,           icon: Video,        desc: "Product demo"         },
    { label: "Source Code",     url: app.sourceCodeUrl,          icon: Code,         desc: "GitHub / GitLab"      },
    { label: "Live Demo",       url: app.liveDemoUrl,            icon: Globe,        desc: "Deployed app"         },
    { label: "Supporting Doc",  url: app.ideaSupportingDocUrl,   icon: FileText,     desc: "Idea support file"    },
    { label: "Additional Docs", url: app.additionalDocumentsUrl, icon: Link2,        desc: "Extra documents"      },
    // Legacy fallbacks
    { label: "GitHub",          url: app.githubUrl,              icon: Code,         desc: "Repository"           },
    { label: "Website",         url: app.websiteUrl,             icon: ExternalLink, desc: "Website"              },
    { label: "Video",           url: app.videoUrl,               icon: Video,        desc: "Video"                },
    { label: "Presentation",    url: app.presentationUrl,        icon: ExternalLink, desc: "Presentation file"    },
  ].filter((l) => !!l.url) as { label: string; url: string; icon: React.ElementType; desc: string }[];

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors self-start"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Applications
      </button>

      <div className="grid grid-cols-3 gap-5">
        {/* ── Left column ── */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Header card */}
          <Card className="attend-card p-5">
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ backgroundColor: app.teamInitialColor || "#7c22c9" }}
              >
                {app.teamInitial || app.teamName?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">{app.teamName}</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{app.ideaTitle}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{app.challengeTitle}</p>
                {app.track && (
                  <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
                    {app.track}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {statusChip(app.status)}
                {app.hasScore && app.score != null && (
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-black text-[hsl(var(--foreground))] tabular-nums">
                      {app.score}<span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">/{app.scoreOutOf || 100}</span>
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">avg. score</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Idea description */}
          {app.ideaDescription && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Idea
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.ideaDescription}</p>
            </Card>
          )}

          {/* Project description */}
          {app.projectDescription && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Project Description
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.projectDescription}</p>
            </Card>
          )}

          {/* Problem statement */}
          {app.problemStatement && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" /> Problem Statement
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.problemStatement}</p>
            </Card>
          )}

          {/* Solution */}
          {app.solutionDescription && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Solution
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.solutionDescription}</p>
            </Card>
          )}

          {/* Tech stack */}
          {app.techStack && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <Code className="h-4 w-4" /> Tech Stack
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.techStack}</p>
            </Card>
          )}

          {/* Submission links */}
          {links.length > 0 && (
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <ExternalLink className="h-4 w-4" style={{ color: "#7c22c9" }} />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Submission Links</h2>
              </div>
              <div className="divide-y divide-[hsl(var(--border))]">
                {[0, 2, 4, 6, 8, 10].map((startIdx) => {
                  const pair = links.slice(startIdx, startIdx + 2);
                  if (pair.length === 0) return null;
                  return (
                    <div key={startIdx} className={`grid gap-0 ${pair.length === 2 ? "grid-cols-2 divide-x divide-[hsl(var(--border))]" : "grid-cols-1"}`}>
                      {pair.map((l) => (
                        <a
                          key={l.label}
                          href={ensureAbsoluteUrl(l.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-5 py-4 hover:bg-[hsl(var(--accent))] transition-colors group"
                        >
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c22c918" }}>
                            <l.icon className="h-4 w-4" style={{ color: "#7c22c9" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))] group-hover:text-[#7c22c9] transition-colors">{l.label}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{l.desc}</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                        </a>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Team members */}
          {app.members?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Team Members ({app.members.length})
              </h2>
              <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                {app.members.map((m) => {
                  const raw = m as any;
                  const memberName = m.name || m.fullName || raw.memberName ||
                    [raw.firstName, raw.lastName].filter(Boolean).join(" ") ||
                    m.email?.split("@")[0] || "Unknown";
                  return (
                  <div key={m.id} className="py-2.5 flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-bold shrink-0">
                      {memberName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">{memberName}</p>
                      {m.email && <p className="text-xs text-[hsl(var(--muted-foreground))]">{m.email}</p>}
                    </div>
                    {(m.role || m.lead) && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: "#faf5ff", color: "#7c22c9" }}>
                        {m.lead ? "Lead" : m.role}
                      </span>
                    )}
                  </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Criteria scores */}
          {app.criteriaScores?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Judging Criteria Scores
              </h2>
              <div className="flex flex-col gap-3">
                {app.criteriaScores.map((c) => {
                  const pct = c.weight > 0 ? Math.min(Math.round((c.score / c.weight) * 100), 100) : 0;
                  return (
                    <div key={c.criterion}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-[hsl(var(--foreground))]">{c.criterion}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{c.score}/{c.weight}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#7c22c9" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-5">

          {/* Update status — hidden for Viewer (read-only) */}
          {!readOnly && (
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-1">Update Status</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Current: {statusChip(app.status)}</p>
            {validNext.length > 0 ? (
              <div className="flex flex-col gap-2">
                {validNext.map((s) => (
                  <button
                    key={s}
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ challengeId, applicationId: app.id, status: s })}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors hover:bg-[hsl(var(--accent))] border border-[hsl(var(--border))]"
                  >
                    Move to {statusChip(s)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No further transitions available.</p>
            )}
          </Card>
          )}

          {/* Details */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">Details</h2>
            <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
              <div className="py-2 flex justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Track</span>
                <span className="text-xs font-medium text-[hsl(var(--foreground))] text-right">{app.track || "—"}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Submitted</span>
                <span className="text-xs font-medium text-[hsl(var(--foreground))] text-right">
                  {app.submittedAt
                    ? new Date(app.submittedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Members</span>
                <span className="text-xs font-medium text-[hsl(var(--foreground))] text-right">{app.members?.length ?? 0}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Avg. Score</span>
                <span className="text-xs font-bold text-[hsl(var(--foreground))] text-right tabular-nums">
                  {app.hasScore && app.score != null ? `${app.score} / ${app.scoreOutOf || 100}` : "—"}
                </span>
              </div>
            </div>
          </Card>

          {/* Status history */}
          {app.statusHistory?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3">History</h2>
              <div className="flex flex-col gap-3">
                {app.statusHistory.map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#7c22c9] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))]">{h.status}</p>
                      {h.by   && <p className="text-xs text-[hsl(var(--muted-foreground))]">by {h.by}</p>}
                      {h.note && <p className="text-xs text-[hsl(var(--muted-foreground))] italic">{h.note}</p>}
                      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        {new Date(h.timestamp).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applications list for a single challenge
// ---------------------------------------------------------------------------
function ChallengeApplications({
  challengeId,
  onViewDetail,
  readOnly = false,
}: {
  challengeId:  string;
  onViewDetail: (appId: string) => void;
  readOnly?:    boolean;
}) {
  const [activeStatus, setActiveStatus] = useState("");
  const [activeTrack,  setActiveTrack]  = useState("");
  const [openMenu,     setOpenMenu]     = useState<string | null>(null);
  const [showExport,   setShowExport]   = useState(false);
  const [exportFrom,   setExportFrom]   = useState("");
  const [exportTo,     setExportTo]     = useState("");
  const updateStatus = useUpdateClientApplicationStatus();

  const { data, isLoading } = useClientChallengeApplications(challengeId, activeStatus, activeTrack, 0, 100);
  const { refetch: fetchExport, isFetching: exporting } = useExportChallengeApplications(
    challengeId, exportFrom || undefined, exportTo || undefined
  );

  const apps   = data?.applications ?? [];
  const tabs   = data?.tabs ?? [];

  // Track options must stay independent of the active track filter — see
  // matching fix in hackathons/[challengeId]/page.tsx's ApplicationsTab.
  const { data: allTracksData } = useClientChallengeApplications(challengeId, activeStatus, "", 0, 100);
  const tracks = Array.from(new Set((allTracksData?.applications ?? []).map((a) => a.track).filter(Boolean)));

  async function handleExport() {
    const result = await fetchExport();
    const d = result.data;
    if (!d) {
      popup.error("Export Failed", "No data returned for the selected range.", 3000);
      return;
    }
    const headers = [
      "Team", "Track", "Idea Title", "Idea Description", "Lead Name", "Lead Email",
      "Members", "Status", "Score", "Submitted",
      "Pitch Deck", "Pitch Video", "Idea Video", "Demo Video", "Source Code",
      "Live Demo", "Supporting Doc", "Additional Docs",
    ];
    const rows = d.applications.map((a: ExportApplicationItem) => [
      a.teamName, a.track ?? "", a.ideaTitle ?? "", a.ideaDescription ?? "",
      a.leadName ?? "", a.leadEmail ?? "", String(a.memberCount ?? ""), a.status,
      a.score != null ? String(a.score) : "", a.submittedAt ?? "",
      a.pitchDeckUrl ?? "", a.pitchVideoUrl ?? "", a.ideaVideoUrl ?? "", a.demoVideoUrl ?? "",
      a.sourceCodeUrl ?? "", a.liveDemoUrl ?? "", a.ideaSupportingDocUrl ?? "", a.additionalDocumentsUrl ?? "",
    ]);
    const xml  = buildExcelXml(headers, rows);
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url  = URL.createObjectURL(blob);
    const el   = document.createElement("a");
    const rangeSuffix = exportFrom || exportTo ? `-${exportFrom || "start"}_to_${exportTo || "end"}` : "";
    el.href = url;
    el.download = `${(d.challengeTitle ?? challengeId).replace(/\s+/g, "-")}-applications${rangeSuffix}.xls`;
    el.click();
    URL.revokeObjectURL(url);
    popup.success("Export Ready", `Exported ${d.total ?? d.applications.length} application(s).`, 2500);
    setShowExport(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Applications {data?.totalCount ? `(${data.totalCount})` : ""}
          </h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
            Review submissions and export the full list to Excel
          </p>
        </div>
        <Button
          size="sm" variant="outline" className="gap-1.5"
          onClick={() => setShowExport((v) => !v)}
        >
          <Download className="h-3.5 w-3.5" /> Export Applications
        </Button>
      </div>

      {/* Export panel */}
      {showExport && (
        <Card className="attend-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[hsl(var(--foreground))]">Export Applications</h3>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Optionally filter by submission date, then download an Excel file with full application details.
              </p>
            </div>
            <button
              onClick={() => setShowExport(false)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">From</label>
              <Input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                max={exportTo || undefined}
                className="h-9 w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">To</label>
              <Input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                min={exportFrom || undefined}
                className="h-9 w-40"
              />
            </div>
            {(exportFrom || exportTo) && (
              <Button
                size="sm" variant="ghost" className="h-9 text-xs"
                onClick={() => { setExportFrom(""); setExportTo(""); }}
              >
                Clear dates
              </Button>
            )}
            <Button
              size="sm" className="h-9 gap-1.5 ml-auto"
              disabled={exporting}
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Download .xls"}
            </Button>
          </div>
        </Card>
      )}

      {tabs.length > 0 && (
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
          <button
            onClick={() => setActiveStatus("")}
            className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-center ${
              activeStatus === "" ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            All
          </button>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all text-center ${
                activeStatus === tab.key ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 text-[10px] font-bold bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))] rounded-full px-1.5 py-0.5">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {tracks.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[hsl(var(--muted-foreground))]">Track:</span>
          {["", ...tracks].map((t) => (
            <button
              key={t || "all"}
              onClick={() => setActiveTrack(t)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                activeTrack === t
                  ? "bg-[#7c22c9] text-white"
                  : "bg-[#faf5ff] text-[#7c22c9] border border-[#e9d5ff] hover:bg-[#f3e8ff]"
              }`}
            >
              {t || "All tracks"}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Loader variant="inline" text="Loading applications…" />
      ) : (
        <Card className="attend-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Team</th>
                <th className="px-5 py-3 text-left">Idea</th>
                <th className="px-5 py-3 text-left">Track</th>
                <th className="px-5 py-3 text-left">Members</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Avg. Score</th>
                <th className="px-5 py-3 text-left">Submitted</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: app.teamInitialColor || "#7c22c9" }}
                      >
                        {app.teamInitial || app.teamName?.slice(0, 2).toUpperCase()}
                      </div>
                      <button
                        className="text-sm font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))] transition-colors text-left"
                        onClick={() => onViewDetail(app.id)}
                      >
                        {app.teamName}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--foreground))] max-w-[180px] truncate">{app.ideaTitle}</td>
                  <td className="px-5 py-3">
                    <span
                      className="text-xs rounded-full px-2.5 py-0.5 font-medium"
                      style={{
                        backgroundColor: app.trackColor ? app.trackColor + "18" : "#faf5ff",
                        color: app.trackColor || "#7c22c9",
                      }}
                    >
                      {app.track || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-center tabular-nums">{app.memberCount}</td>
                  <td className="px-5 py-3">{statusChip(app.status)}</td>
                  <td className="px-5 py-3 text-sm font-semibold tabular-nums">
                    {app.hasScore && app.score != null
                      ? <span>{app.score}<span className="text-[hsl(var(--muted-foreground))] font-normal">/{app.scoreOutOf || 100}</span></span>
                      : <span className="text-[hsl(var(--muted-foreground))]">—</span>}
                  </td>
                  <td className="px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                    {app.submittedLabel || formatDate(app.submittedAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="relative inline-flex items-center gap-1">
                      <Button
                        size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2"
                        onClick={() => onViewDetail(app.id)}
                      >
                        View <ChevronRight className="h-3 w-3" />
                      </Button>
                      {!readOnly && (VALID_TRANSITIONS[app.status?.toUpperCase()] ?? []).length > 0 && (
                        <div className="relative">
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => setOpenMenu(openMenu === app.id ? null : app.id)}
                          >
                            Status <ChevronDown className="h-3 w-3" />
                          </Button>
                          {openMenu === app.id && (
                            <div className="absolute right-0 top-8 z-50 min-w-[170px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg p-1">
                              {(VALID_TRANSITIONS[app.status?.toUpperCase()] ?? []).map((s) => (
                                <button
                                  key={s}
                                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
                                  onClick={() => {
                                    updateStatus.mutate({ challengeId, applicationId: app.id, status: s });
                                    setOpenMenu(null);
                                  }}
                                >
                                  {statusChip(s)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {apps.length === 0 && !isLoading && (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No applications found.</div>
          )}
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge application detail panel
// ---------------------------------------------------------------------------
function JudgeAppDetail({ challengeId, applicationId, onBack }: { challengeId: string; applicationId: string; onBack: () => void }) {
  const { data: app, isLoading } = useJudgeApplication(challengeId, applicationId);

  if (isLoading) return <Loader variant="inline" text="Loading application…" />;
  if (!app) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Application not found.</p>;

  const links = [
    { label: "Pitch Deck",      url: app.pitchDeckUrl,           icon: FileText,     desc: "PDF / PPTX"        },
    { label: "Pitch Video",     url: app.pitchVideoUrl,          icon: Video,        desc: "YouTube or Loom"   },
    { label: "Idea Video",      url: app.ideaVideoUrl,           icon: Video,        desc: "Idea walkthrough"  },
    { label: "Demo Video",      url: app.demoVideoUrl,           icon: Video,        desc: "Product demo"      },
    { label: "Source Code",     url: app.sourceCodeUrl,          icon: Code,         desc: "GitHub / GitLab"   },
    { label: "Live Demo",       url: app.liveDemoUrl,            icon: Globe,        desc: "Deployed app"      },
    { label: "Supporting Doc",  url: app.ideaSupportingDocUrl,   icon: FileText,     desc: "Idea support file" },
    { label: "Additional Docs", url: app.additionalDocumentsUrl, icon: Link2,        desc: "Extra documents"   },
  ].filter((l) => !!l.url) as { label: string; url: string; icon: React.ElementType; desc: string }[];

  return (
    <div className="flex flex-col gap-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors self-start">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Applications
      </button>

      <div className="grid grid-cols-3 gap-5">
        {/* Main */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Header */}
          <Card className="attend-card p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                   style={{ backgroundColor: app.teamInitialColor || "#7c22c9" }}>
                {app.teamInitial || app.teamName?.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-[hsl(var(--foreground))]">{app.teamName}</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{app.ideaTitle}</p>
                {app.track && (
                  <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-medium" style={{ backgroundColor: "#faf5ff", color: "#7c22c9", border: "1px solid #e9d5ff" }}>
                    {app.track}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {statusChip(app.status)}
                {app.hasScore && app.score != null && (
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-black text-[hsl(var(--foreground))] tabular-nums">
                      {app.score}<span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">/{app.scoreOutOf || 100}</span>
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">avg. score</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Idea */}
          {app.ideaDescription && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Idea
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.ideaDescription}</p>
            </Card>
          )}

          {/* Project description */}
          {app.projectDescription && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Project Description
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed whitespace-pre-wrap">{app.projectDescription}</p>
            </Card>
          )}

          {/* Submission links — 2-per-row card grid matching client admin */}
          {links.length > 0 && (
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <ExternalLink className="h-4 w-4" style={{ color: "#7c22c9" }} />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Submission Links</h2>
              </div>
              <div className="divide-y divide-[hsl(var(--border))]">
                {[0, 2, 4, 6, 8, 10].map((startIdx) => {
                  const pair = links.slice(startIdx, startIdx + 2);
                  if (pair.length === 0) return null;
                  return (
                    <div key={startIdx} className={`grid gap-0 ${pair.length === 2 ? "grid-cols-2 divide-x divide-[hsl(var(--border))]" : "grid-cols-1"}`}>
                      {pair.map((l) => (
                        <a key={l.label} href={ensureAbsoluteUrl(l.url)} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-3 px-5 py-4 hover:bg-[hsl(var(--accent))] transition-colors group">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c22c918" }}>
                            <l.icon className="h-4 w-4" style={{ color: "#7c22c9" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[hsl(var(--foreground))] group-hover:text-[#7c22c9] transition-colors">{l.label}</p>
                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{l.desc}</p>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))] shrink-0" />
                        </a>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Criteria scores */}
          {app.criteriaScores?.length > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Judging Criteria Scores
              </h2>
              <div className="flex flex-col gap-3">
                {app.criteriaScores.map((c) => {
                  const pct = c.weight > 0 ? Math.min(Math.round((c.score / c.weight) * 100), 100) : 0;
                  return (
                    <div key={c.criterion}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-[hsl(var(--foreground))]">{c.criterion}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{c.score}/{c.weight}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#7c22c9" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5">
          <Card className="attend-card p-5">
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">Details</p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Track</span><span className="font-medium">{app.track || "—"}</span></div>
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Submitted</span><span className="font-medium">{formatDate(app.submittedAt)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-[hsl(var(--muted-foreground))] shrink-0">Challenge</span><span className="font-medium text-right truncate">{app.challengeTitle}</span></div>
              <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Status</span><span>{statusChip(app.status)}</span></div>
              {app.hasScore && app.score != null && (
                <div className="flex justify-between items-center pt-1 border-t border-[hsl(var(--border))]">
                  <span className="text-[hsl(var(--muted-foreground))]">Avg. Score</span>
                  <span className="font-bold tabular-nums text-[hsl(var(--foreground))]">{app.score}<span className="font-normal text-[hsl(var(--muted-foreground))]">/{app.scoreOutOf || 100}</span></span>
                </div>
              )}
            </div>
          </Card>

          {/* Team members */}
          {(app.members?.length ?? 0) > 0 && (
            <Card className="attend-card p-5">
              <h2 className="font-semibold text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Team Members ({app.members.length})
              </h2>
              <div className="flex flex-col divide-y divide-[hsl(var(--border))]">
                {app.members.map((m) => {
                  const raw = m as any;
                  const memberName = m.fullName || raw.name || raw.memberName ||
                    [raw.firstName, raw.lastName].filter(Boolean).join(" ") ||
                    m.email?.split("@")[0] || "Unknown";
                  return (
                    <div key={m.id} className="py-2.5 flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-bold shrink-0">
                        {memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{memberName}</p>
                        {m.email && <p className="text-xs text-[hsl(var(--muted-foreground))]">{m.email}</p>}
                      </div>
                      {m.role && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: "#faf5ff", color: "#7c22c9" }}>
                          {m.role}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Judge applications view — GET /api/v1/judge/challenges/{id}/applications
// ---------------------------------------------------------------------------
function JudgeApplicationsView() {
  const [search,               setSearch]               = useState("");
  const [selectedChallengeId,  setSelectedChallengeId]  = useState<string | null>(null);
  const [selectedAppId,        setSelectedAppId]        = useState<string | null>(null);

  const { data: challengeData, isLoading: challengesLoading } = useJudgeChallenges("", "", 0, 100);
  const challenges = challengeData?.challenges ?? [];
  const summary    = challengeData?.summary;

  const { data: appData, isLoading: appsLoading } = useJudgeChallengeApplications(
    selectedChallengeId ?? "", "", "", 0, 100
  );
  const applications = appData?.applications ?? [];

  const selectedChallenge = challenges.find((c) => c.id === selectedChallengeId);

  // Application detail view
  if (selectedChallengeId && selectedAppId) {
    return (
      <JudgeAppDetail
        challengeId={selectedChallengeId}
        applicationId={selectedAppId}
        onBack={() => setSelectedAppId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Applications</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          {selectedChallenge ? selectedChallenge.title : "Select a challenge to view its applications"}
        </p>
      </div>

      {/* Summary stats */}
      {summary && !selectedChallengeId && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Challenges",  value: summary.activeChallenges,  color: "#7c22c9" },
            { label: "Total Applications", value: summary.totalApplications, color: "#0891b2" },
            { label: "Shortlisted",        value: summary.shortlisted ?? summary.teamsToScore ?? 0, color: "#d97706" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="attend-card p-4">
              <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value ?? 0}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-3 gap-5">
        {/* Challenge list */}
        <Card className="attend-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Challenges</p>
          </div>
          {challengesLoading ? (
            <div className="p-4"><Loader variant="inline" text="Loading…" /></div>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {challenges.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedChallengeId(c.id); setSelectedAppId(null); }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[hsl(var(--accent))] ${selectedChallengeId === c.id ? "bg-[hsl(var(--accent))]" : ""}`}
                >
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "#7c22c918" }}>
                    <Lightbulb className="h-4 w-4" style={{ color: "#7c22c9" }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{c.title}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.shortlistedCount ?? 0} shortlisted</p>
                  </div>
                </button>
              ))}
              {challenges.length === 0 && (
                <p className="px-4 py-6 text-sm text-center text-[hsl(var(--muted-foreground))]">No challenges assigned.</p>
              )}
            </div>
          )}
        </Card>

        {/* Applications list */}
        <div className="col-span-2 flex flex-col gap-4">
          {!selectedChallengeId ? (
            <div className="flex items-center justify-center h-40 text-sm text-[hsl(var(--muted-foreground))]">
              Select a challenge to view applications
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <Input placeholder="Search applications…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Card className="attend-card overflow-hidden">
                {appsLoading ? (
                  <div className="p-6"><Loader variant="inline" text="Loading applications…" /></div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="attend-table-header">
                        <th className="px-4 py-3 text-left">Team</th>
                        <th className="px-4 py-3 text-left">Track</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Avg. Score</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications
                        .filter((a: ApplicationItem) =>
                          !search ||
                          a.teamName.toLowerCase().includes(search.toLowerCase()) ||
                          a.ideaTitle.toLowerCase().includes(search.toLowerCase())
                        )
                        .map((a: ApplicationItem) => (
                          <tr key={a.id} className="attend-table-row">
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{a.teamName}</p>
                              <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[180px]">{a.ideaTitle}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{a.track}</td>
                            <td className="px-4 py-3">{statusChip(a.status)}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                              {a.score !== null && a.score !== undefined ? a.score : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setSelectedAppId(a.id)}>
                                View <ChevronRight className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
                {!appsLoading && applications.length === 0 && (
                  <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">No applications yet.</div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ApplicationsPage() {
  const router = useRouter();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [selectedAppId,       setSelectedAppId]       = useState<string | null>(null);
  const [search,              setSearch]              = useState("");

  const { data: userResponse } = useGetMe();
  const normalizedRole = (userResponse?.data?.role ?? "").toLowerCase().replace(/[-\s]/g, "_");
  const isJudge      = normalizedRole === "judge";
  const isViewer     = normalizedRole === "viewer";
  const isSuperAdmin = normalizedRole === "super_admin";

  const { data, isLoading } = useClientChallenges("", "", 0, 100);
  const challenges = data?.challenges ?? [];
  const summary    = data?.summary;

  const selectedChallenge = challenges.find((c) => c.id === selectedChallengeId);

  if (isJudge)      return <JudgeApplicationsView />;
  if (isSuperAdmin) return <SuperAdminApplicationsView />;

  if (isLoading) return <Loader variant="page" text="Loading Applications…" />;

  if (selectedChallengeId && selectedAppId) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <button
            onClick={() => setSelectedAppId(null)}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Applications
          </button>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Application Detail</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{selectedChallenge?.title}</p>
        </div>
        <ApplicationDetail
          challengeId={selectedChallengeId}
          applicationId={selectedAppId}
          onBack={() => setSelectedAppId(null)}
          readOnly={isViewer}
        />
      </div>
    );
  }

  if (selectedChallengeId) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <button
            onClick={() => setSelectedChallengeId(null)}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Challenges
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{selectedChallenge?.title}</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                {selectedChallenge?.organiserName} · {formatDate(selectedChallenge?.date ?? "")} · Applications
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(`/hackathons/${selectedChallengeId}`)}>
              Open Challenge <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ChallengeApplications
          challengeId={selectedChallengeId}
          onViewDetail={(appId) => setSelectedAppId(appId)}
          readOnly={isViewer}
        />
      </div>
    );
  }

  const filtered = search
    ? challenges.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        (c.organiserName ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : challenges;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button
          onClick={() => router.push("/hackathons")}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-2 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Innovation Challenges
        </button>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Applications</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Review and manage applications across all challenges
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Applications", value: summary.totalApplications,                        icon: FileText,  color: "#7c22c9" },
            { label: "Active Challenges",  value: summary.activeChallenges,                         icon: Lightbulb, color: "#0891b2" },
            { label: "Shortlisted",        value: summary.shortlisted ?? summary.teamsToScore ?? 0, icon: Trophy,    color: "#d97706" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="attend-card p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-[hsl(var(--foreground))]">{value}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <Input placeholder="Search challenges…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Select a Challenge</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Click a challenge to review its applications</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Challenge</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Applications</th>
              <th className="px-5 py-3 text-left">Shortlisted</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const s = c.status?.toUpperCase();
              const style = s === "LIVE"      ? { bg: "#16a34a18", color: "#16a34a" }
                : s === "PUBLISHED"           ? { bg: "#0891b218", color: "#0891b2" }
                : s === "ENDED"              ? { bg: "#6b728018", color: "#6b7280" }
                : { bg: "#7c22c918", color: "#7c22c9" };
              return (
                <tr key={c.id} className="attend-table-row cursor-pointer" onClick={() => setSelectedChallengeId(c.id)}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c22c918" }}>
                        <Lightbulb className="h-4 w-4" style={{ color: "#7c22c9" }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[240px]">{c.title}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.organiserName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{formatDate(c.date)}</td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.applicationCount ?? 0}</td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedCount ?? c.shortlistedTeams ?? 0}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.color }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedChallengeId(c.id); }}>
                      View Applications <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {search ? "No challenges match your search." : "No challenges found."}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Super admin applications view — platform-wide challenge picker + read-only
// applications table (GET /api/v1/admin/challenges, GET /api/v1/admin/challenges/{id}/applications).
// This used to be entirely hidden from Super Admin in the sidebar; the previous
// "Applications" nav item was clientOnly and there was no admin-scoped view.
// ---------------------------------------------------------------------------
function SuperAdminApplicationsView() {
  const router = useRouter();
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [search,              setSearch]              = useState("");

  const { data, isLoading } = useAdminChallenges(search, "", "", 0, 100);
  const challenges = data?.challenges ?? [];
  const summary    = data?.summary;

  const selectedChallenge = challenges.find((c) => c.id === selectedChallengeId);

  if (isLoading) return <Loader variant="page" text="Loading Applications…" />;

  if (selectedChallengeId) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <button
            onClick={() => setSelectedChallengeId(null)}
            className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Challenges
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{selectedChallenge?.title}</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                {selectedChallenge?.organiserName} · {formatDate(selectedChallenge?.date ?? "")} · Applications
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(`/hackathons/${selectedChallengeId}`)}>
              Open Challenge <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <EventChallengeApplicationsTab challengeId={selectedChallengeId} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Applications</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Review applications across all challenges, platform-wide
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Applications", value: summary.totalApplications,                        icon: FileText,  color: "#7c22c9" },
            { label: "Active Challenges",  value: summary.activeChallenges,                         icon: Lightbulb, color: "#0891b2" },
            { label: "Shortlisted",        value: summary.shortlisted ?? summary.teamsToScore ?? 0, icon: Trophy,    color: "#d97706" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="attend-card p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + "18" }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-[hsl(var(--foreground))]">{value}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <Input placeholder="Search challenges…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Select a Challenge</h2>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">Click a challenge to review its applications</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Challenge</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Shortlisted</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c) => {
              const s = c.status?.toUpperCase();
              const style = s === "LIVE"      ? { bg: "#16a34a18", color: "#16a34a" }
                : s === "PUBLISHED"           ? { bg: "#0891b218", color: "#0891b2" }
                : s === "ENDED"              ? { bg: "#6b728018", color: "#6b7280" }
                : { bg: "#7c22c918", color: "#7c22c9" };
              return (
                <tr key={c.id} className="attend-table-row cursor-pointer" onClick={() => setSelectedChallengeId(c.id)}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c22c918" }}>
                        <Lightbulb className="h-4 w-4" style={{ color: "#7c22c9" }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[240px]">{c.title}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.organiserName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{formatDate(c.date)}</td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedTeams ?? 0}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.color }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedChallengeId(c.id); }}>
                      View Applications <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {challenges.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {search ? "No challenges match your search." : "No challenges found."}
          </div>
        )}
      </Card>
    </div>
  );
}

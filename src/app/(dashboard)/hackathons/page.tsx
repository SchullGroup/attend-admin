"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb, ArrowRight, Trophy, Users, FileText, ChevronRight, Search, Star,
} from "lucide-react";
import { useClientChallenges } from "@/api/client-challenges";
import { useAdminChallenges } from "@/api/admin-challenges";
import { useJudgeChallenges } from "@/api/judge";
import { useGetMe } from "@/api/auth/hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

const SUPER_ADMIN_ROLES = new Set(["super_admin", "superadmin", "super-admin"]);
const JUDGE_ROLES       = new Set(["judge"]);

const STATUS_FILTERS = [
  { label: "All",       value: "" },
  { label: "Draft",     value: "DRAFT" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Live",      value: "LIVE" },
  { label: "Ended",     value: "ENDED" },
];

function statusStyle(status: string): { bg: string; color: string } {
  const s = status?.toUpperCase();
  if (s === "LIVE")      return { bg: "#16a34a18", color: "#16a34a" };
  if (s === "PUBLISHED") return { bg: "#0891b218", color: "#0891b2" };
  if (s === "ENDED")     return { bg: "#6b728018", color: "#6b7280" };
  return { bg: "#7c22c918", color: "#7c22c9" };
}

// ---------------------------------------------------------------------------
// Judge challenges view — GET /api/v1/judge/challenges
// ---------------------------------------------------------------------------
function JudgeChallengesView() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useJudgeChallenges(search, "", 0, 100);

  if (isLoading) return <Loader variant="page" text="Loading Challenges…" />;

  const summary    = data?.summary;
  const challenges = data?.challenges ?? [];
  const featured   = challenges.find((c) => c.status?.toUpperCase() === "LIVE") ?? challenges[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Innovation Challenges</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Your assigned challenges
        </p>
      </div>

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #9333ea 0%, #7c22c9 60%, #5b21b6 100%)" }}>
        <div className="p-6 text-white">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Lightbulb className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-purple-200">Innovation Challenge</span>
              </div>
              {featured ? (
                <>
                  <h2 className="text-2xl font-bold mb-1 truncate">{featured.title}</h2>
                  <p className="text-purple-200 text-sm mb-4">
                    {featured.organiserName} · {formatDate(featured.date ?? "")}
                  </p>
                  <Button
                    className="h-9 text-sm bg-white text-purple-700 hover:bg-white/90 gap-2"
                    onClick={() => router.push(`/hackathons/applications?id=${featured.id}`)}
                  >
                    View Applications <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <h2 className="text-2xl font-bold mb-1">No challenges assigned yet</h2>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {[
                { label: "Active Challenges",  value: summary?.activeChallenges  ?? 0, icon: Lightbulb },
                { label: "Total Applications", value: summary?.totalApplications ?? 0, icon: FileText  },
                { label: "Shortlisted",        value: summary?.shortlisted ?? summary?.teamsToScore ?? 0, icon: Trophy },
                { label: "Challenges",         value: challenges.length,                icon: Users },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white/10 p-3 min-w-[110px]">
                  <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-xs text-purple-200 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
        <Input
          placeholder="Search challenges…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Table */}
      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Challenge</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Format</th>
              <th className="px-5 py-3 text-left">Shortlisted</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c) => {
              const ss = statusStyle(c.status ?? "");
              return (
                <tr key={c.id} className="attend-table-row">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c22c918" }}>
                        <Lightbulb className="h-4 w-4" style={{ color: "#7c22c9" }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">{c.title}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.organiserName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{formatDate(c.date ?? "")}</td>
                  <td className="px-5 py-4 text-xs capitalize text-[hsl(var(--muted-foreground))]">{(c.format ?? "—").toLowerCase()}</td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedCount ?? 0}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: ss.bg, color: ss.color }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => router.push(`/hackathons/applications?id=${c.id}`)}>
                        Applications
                      </Button>
                      <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => router.push(`/hackathons/judging?id=${c.id}`)}>
                        Score <Star className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {challenges.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No challenges assigned yet.</div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function HackathonsPage() {
  const router = useRouter();
  const [search,    setSearch]    = useState("");
  const [statusTab, setStatusTab] = useState("");

  const { data: userResponse } = useGetMe();
  const normalizedRole = (userResponse?.data?.role ?? "").toLowerCase().replace(/[-\s]/g, "_");
  const isSuperAdmin   = SUPER_ADMIN_ROLES.has(normalizedRole);
  const isJudge        = JUDGE_ROLES.has(normalizedRole);

  // Always call these — hooks must not be conditional
  const { data: clientData, isLoading: clientLoading, isFetching: clientFetching } = useClientChallenges(search, statusTab, 0, 50);
  const { data: adminData,  isLoading: adminLoading,  isFetching: adminFetching  } = useAdminChallenges(search, "", statusTab, 0, 50);

  // Judge gets its own view
  if (isJudge) return <JudgeChallengesView />;

  const isLoading  = isSuperAdmin ? adminLoading  : clientLoading;
  const isFetching = isSuperAdmin ? adminFetching : clientFetching;
  const data       = isSuperAdmin ? adminData     : clientData;

  if (isLoading) return <Loader variant="page" text="Loading Challenges…" />;

  const summary    = data?.summary;
  const allChallenges = (data?.challenges ?? []) as Array<{ id: string; title: string; organiserName?: string; date?: string; format?: string; shortlistedTeams?: number; shortlistedCount?: number; status?: string }>;
  const challenges = statusTab
    ? allChallenges.filter((c) => c.status?.toUpperCase() === statusTab.toUpperCase())
    : allChallenges;
  const featured   = challenges.find((c) => c.status?.toUpperCase() === "LIVE") ?? challenges[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Innovation Challenges</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Manage hackathons, review applications, and coordinate judging
          </p>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #9333ea 0%, #7c22c9 60%, #5b21b6 100%)" }}>
        <div className="p-6 text-white">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Lightbulb className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-purple-200">Innovation Challenge</span>
              </div>
              {featured ? (
                <>
                  <h2 className="text-2xl font-bold mb-1 truncate">{featured.title}</h2>
                  <p className="text-purple-200 text-sm mb-4">
                    {featured.organiserName} · {formatDate(featured.date ?? "")}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-1">No active challenges yet</h2>
                  <p className="text-purple-200 text-sm mb-4">Create your first innovation challenge from Events.</p>
                </>
              )}
              {featured && (
                <Button
                  className="h-9 text-sm bg-white text-purple-700 hover:bg-white/90 gap-2"
                  onClick={() => router.push(`/hackathons/${featured.id}`)}
                >
                  Open Challenge <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {[
                { label: "Active Challenges",  value: summary?.activeChallenges  ?? 0, icon: Lightbulb },
                { label: "Total Applications", value: summary?.totalApplications ?? 0, icon: FileText  },
                { label: "Teams to Score",     value: summary?.teamsToScore ?? summary?.shortlisted ?? 0, icon: Trophy },
                { label: "Shortlisted",        value: challenges.reduce((s, c) => s + (c.shortlistedCount ?? c.shortlistedTeams ?? 0), 0), icon: Users },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-white/10 p-3 min-w-[110px]">
                  <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                  <div className="text-xs text-purple-200 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            placeholder="Search challenges…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusTab(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusTab === f.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="attend-card overflow-hidden relative">
        {isFetching && !isLoading && (
          <div className="absolute inset-0 bg-[hsl(var(--background))]/60 flex items-center justify-center z-10 rounded-xl">
            <div className="h-5 w-5 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          </div>
        )}
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Challenge</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Format</th>
              <th className="px-5 py-3 text-left">Shortlisted</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {challenges.map((c) => {
              const ss = statusStyle(c.status ?? "");
              return (
                <tr key={c.id} className="attend-table-row">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#7c22c918" }}>
                        <Lightbulb className="h-4 w-4" style={{ color: "#7c22c9" }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">{c.title}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{c.organiserName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))]">{formatDate(c.date ?? "")}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs capitalize text-[hsl(var(--muted-foreground))]">{(c.format ?? "—").toLowerCase()}</span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold tabular-nums">{c.shortlistedCount ?? c.shortlistedTeams ?? 0}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: ss.bg, color: ss.color }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => router.push(`/hackathons/${c.id}`)}>
                      Open <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {challenges.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No challenges found.</div>
        )}
      </Card>
    </div>
  );
}

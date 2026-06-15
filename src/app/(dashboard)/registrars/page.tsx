"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, Users, CalendarDays, Eye, ImageOff } from "lucide-react";
import {
  useRegistrars,
  useSuspendRegistrar,
  useActivateRegistrar,
  useApproveRegistrar,
  getRegistrarEnrolledAt,
  type RegistrarItem,
} from "@/api/registrars";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { DateCell } from "@/components/ui/date-cell";

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  ACTIVE:    { dot: "#16a34a", label: "Active"    },
  SUSPENDED: { dot: "#dc2626", label: "Suspended" },
  PENDING:   { dot: "#f59e0b", label: "Pending"   },
};

const TABS = [
  { label: "All",       value: "all"       },
  { label: "Active",    value: "active"    },
  { label: "Suspended", value: "suspended" },
];

function getDisplayName(r: RegistrarItem)  { return r.companyName || r.name || "—"; }
function getRepName(r: RegistrarItem)      { return r.representativeName || r.repName || "—"; }
function getRepEmail(r: RegistrarItem)     { return r.contactEmail || r.repEmail || "—"; }
function getRepPhone(r: RegistrarItem)     { return r.representativePhone || r.repPhone || null; }

export default function RegistrarsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const statusParam = activeTab === "all" ? "" : activeTab.toUpperCase();
  const { data, isLoading } = useRegistrars(statusParam, 0, 50);

  const suspendMutation  = useSuspendRegistrar();
  const activateMutation = useActivateRegistrar();
  const approveMutation  = useApproveRegistrar();

  const registrars     = data?.registrars ?? [];
  const active         = registrars.filter((r) => r.status?.toUpperCase() === "ACTIVE").length;
  const totalRegisters = registrars.reduce((s, r) => s + (r.registersCount ?? 0), 0);
  const totalEvents    = registrars.reduce((s, r) => s + (r.eventCount   ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Registrars</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Platform operators authorised to manage registers and events
          </p>
        </div>
        <Link href="/registrars/enrol">
          <Button className="gap-2">Enrol Registrar</Button>
        </Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 divide-x divide-[hsl(var(--border))] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden mb-6">
        {[
          { label: "Active Registrars",  value: active,         icon: Building2,    color: "#111827" },
          { label: "Registers Managed",  value: totalRegisters, icon: Users,        color: "#374151" },
          { label: "Events Created",     value: totalEvents,    icon: CalendarDays, color: "#374151" },
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

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 px-4 py-1.5 rounded-full text-sm font-medium transition-all text-center ${
              activeTab === tab.value
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loader variant="inline" text="Loading registrars…" />
      ) : (
        <Card className="attend-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left w-10"></th>
                <th className="px-5 py-3 text-left">Registrar</th>
                <th className="px-5 py-3 text-left">RC Number</th>
                <th className="px-5 py-3 text-left">Plan</th>
                <th className="px-5 py-3 text-left">Representative</th>
                <th className="px-5 py-3 text-left">Registers</th>
                <th className="px-5 py-3 text-left">Events</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Enrolled</th>
                <th className="px-5 py-3 text-left">Actions</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {registrars.map((r) => {
                const statusKey  = r.status?.toUpperCase() ?? "PENDING";
                const statusInfo = STATUS_DOT[statusKey] ?? STATUS_DOT["PENDING"];
                const isActive    = statusKey === "ACTIVE";
                const isSuspended = statusKey === "SUSPENDED";
                const isPending   = statusKey === "PENDING";
                return (
                  <tr key={r.id} className="attend-table-row">
                    {/* Logo avatar */}
                    <td className="px-3 py-3">
                      <div className="h-9 w-9 rounded-xl overflow-hidden bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                        {r.logoUrl ? (
                          <img src={r.logoUrl} alt={getDisplayName(r)} className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">
                            {getDisplayName(r).slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-[160px]">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate" title={getDisplayName(r)}>{getDisplayName(r)}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] truncate" title={r.industry ?? "—"}>{r.industry ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{r.rcNumber ?? "—"}</td>
                    <td className="px-5 py-3">
                      {r.plan
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] capitalize">{r.plan}</span>
                        : <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                      }
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-[hsl(var(--foreground))]">{getRepName(r)}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">{getRepEmail(r)}</p>
                      {getRepPhone(r) && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{getRepPhone(r)}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">{r.registersCount ?? 0}</td>
                    <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">{r.eventCount ?? 0}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusInfo.dot }} />
                        <span className="text-sm text-[hsl(var(--foreground))]">{statusInfo.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <DateCell value={getRegistrarEnrolledAt(r)} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        {isActive && (
                          confirmId === r.id ? (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-red-600 bg-red-50 font-semibold"
                              disabled={suspendMutation.isPending}
                              onClick={() => suspendMutation.mutate(r.id, { onSuccess: () => setConfirmId(null) })}
                            >
                              Confirm?
                            </Button>
                          ) : (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setConfirmId(r.id)}
                            >
                              Suspend
                            </Button>
                          )
                        )}
                        {isSuspended && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                            disabled={activateMutation.isPending}
                            onClick={() => activateMutation.mutate(r.id)}
                          >
                            Activate
                          </Button>
                        )}
                        {isPending && (
                          <Button
                            size="sm" className="h-7 text-xs"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(r.id)}
                          >
                            Approve
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/registrars/${r.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 opacity-60 hover:opacity-100">
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {registrars.length === 0 && (
            <div className="py-14 text-center">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No registrars match this filter</p>
              {activeTab !== "all" && (
                <button onClick={() => setActiveTab("all")} className="text-xs text-[hsl(var(--primary))] hover:underline mt-1">
                  Clear filter
                </button>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

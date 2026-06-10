"use client";

/**
 * /admin/registers — Register Directory
 *
 * Data source : GET /api/v1/client/registers  (via useRegisters)
 * Status      : Explicit string from API (PENDING | ACTIVE | SUSPENDED | REJECTED)
 * Lifecycle   : POST /api/v1/client/registers/{id}/approve|reject|suspend|activate
 * Navigation  : All routes prefixed /admin to prevent dashboard framing 404s.
 */

import { useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import {
  useRegisters,
  useApproveRegister,
  useRejectRegister,
  useSuspendRegister,
  useActivateRegister,
} from "@/api/registers";
import type { RegisterItem } from "@/types/super-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { DateCell } from "@/components/ui/date-cell";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { label: "All",       value: "all"       },
  { label: "Active",    value: "active"    },
  { label: "Pending",   value: "pending"   },
  { label: "Suspended", value: "suspended" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const STATUS_META: Record<string, { dot: string; label: string }> = {
  ACTIVE:    { dot: "#16a34a", label: "Active"    },
  SUSPENDED: { dot: "#dc2626", label: "Suspended" },
  PENDING:   { dot: "#f59e0b", label: "Pending"   },
  REJECTED:  { dot: "#6b7280", label: "Rejected"  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegistersPage() {
  const [activeTab,  setActiveTab]  = useState<TabValue>("all");
  /**
   * Confirm guard for both suspend (double-confirm) and reject (double-confirm).
   * First click sets confirmId + action, second click executes.
   */
  const [confirmId,     setConfirmId]     = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"suspend" | "reject" | null>(null);

  // Server-side status filter — "all" sends no status param
  const statusParam = activeTab === "all" ? "" : activeTab.toUpperCase();
  const { data, isLoading } = useRegisters(statusParam, 0, 50);

  const approveMutation = useApproveRegister();
  const rejectMutation  = useRejectRegister();
  const suspendMutation = useSuspendRegister();
  const activateMutation = useActivateRegister();

  const registers: RegisterItem[] = data?.registers ?? [];

  function requestConfirm(id: string, action: "suspend" | "reject") {
    setConfirmId(id);
    setConfirmAction(action);
  }

  function clearConfirm() {
    setConfirmId(null);
    setConfirmAction(null);
  }

  function handleTabChange(tab: TabValue) {
    setActiveTab(tab);
    clearConfirm();
  }

  return (
    <div>

      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Registers</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Companies whose meetings and events are managed on the platform
          </p>
        </div>
        <Link href="/admin/registers/enrol">
          <Button className="gap-2">Enrol New Register</Button>
        </Link>
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-full">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
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

      {/* ── Directory grid ── */}
      {isLoading ? (
        <Loader variant="inline" text="Loading registers…" />
      ) : (
        <Card className="attend-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Register</th>
                <th className="px-5 py-3 text-left">RC Number</th>
                <th className="px-5 py-3 text-left">Events</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Enrolled</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registers.map((reg) => {
                const statusKey  = (reg.status ?? "PENDING").toUpperCase();
                const statusMeta = STATUS_META[statusKey] ?? STATUS_META["PENDING"];
                const isActive    = statusKey === "ACTIVE";
                const isSuspended = statusKey === "SUSPENDED";
                const isPending   = statusKey === "PENDING";

                const isConfirming    = confirmId === reg.id;
                const isSuspendConf   = isConfirming && confirmAction === "suspend";
                const isRejectConf    = isConfirming && confirmAction === "reject";

                return (
                  <tr key={reg.id} className="attend-table-row">

                    {/* Name + industry */}
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                        {reg.name || reg.companyName || "—"}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {reg.industry != null && reg.industry !== "" ? reg.industry : <i>—</i>}
                      </p>
                    </td>

                    {/* RC Number */}
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {reg.rcNumber != null && reg.rcNumber !== "" ? reg.rcNumber : <i>—</i>}
                    </td>

                    {/* Events count */}
                    <td className="px-5 py-3 text-sm font-medium tabular-nums text-[hsl(var(--foreground))]">
                      {reg.eventCount ?? 0}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: statusMeta.dot }} />
                        <span className="text-sm text-[hsl(var(--foreground))]">{statusMeta.label}</span>
                      </div>
                    </td>

                    {/* Enrolled date */}
                    <td className="px-5 py-3">
                      {reg.enrolledAt
                        ? <DateCell value={reg.enrolledAt} />
                        : <i className="text-xs text-[hsl(var(--muted-foreground))]">—</i>}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">

                        <Link href={`/admin/registers/${reg.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                        </Link>

                        {/* PENDING — Approve (single click) + Reject (double-confirm) */}
                        {isPending && (
                          <>
                            <Button
                              size="sm" className="h-7 text-xs"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(reg.id)}
                            >
                              {approveMutation.isPending ? "…" : "Approve"}
                            </Button>

                            {isRejectConf ? (
                              <>
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-7 text-xs text-red-600 bg-red-50 font-semibold"
                                  disabled={rejectMutation.isPending}
                                  onClick={() => rejectMutation.mutate({ id: reg.id }, { onSuccess: clearConfirm })}
                                >
                                  {rejectMutation.isPending ? "…" : "Confirm?"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearConfirm}>
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => requestConfirm(reg.id, "reject")}
                              >
                                Reject
                              </Button>
                            )}
                          </>
                        )}

                        {/* ACTIVE — Suspend (double-confirm) */}
                        {isActive && (
                          isSuspendConf ? (
                            <>
                              <Button
                                size="sm" variant="ghost"
                                className="h-7 text-xs text-red-600 bg-red-50 font-semibold"
                                disabled={suspendMutation.isPending}
                                onClick={() => suspendMutation.mutate({ id: reg.id }, { onSuccess: clearConfirm })}
                              >
                                {suspendMutation.isPending ? "…" : "Confirm?"}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearConfirm}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => requestConfirm(reg.id, "suspend")}
                            >
                              Suspend
                            </Button>
                          )
                        )}

                        {/* SUSPENDED — Activate (single click) */}
                        {isSuspended && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                            disabled={activateMutation.isPending}
                            onClick={() => activateMutation.mutate(reg.id)}
                          >
                            {activateMutation.isPending ? "…" : "Activate"}
                          </Button>
                        )}

                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>

          {registers.length === 0 && (
            <div className="py-14 text-center">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
              <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                No registers match this filter
              </p>
              {activeTab !== "all" && (
                <button
                  onClick={() => handleTabChange("all")}
                  className="text-xs text-[hsl(var(--primary))] hover:underline mt-1"
                >
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

"use client";

/**
 * /admin/registers — Register Directory
 *
 * Data source : GET /api/v1/client/registers  (via useAllRegisters)
 * Status      : Explicit string from API (PENDING | ACTIVE | SUSPENDED | REJECTED)
 * Lifecycle   : POST /api/v1/client/registers/{id}/approve|reject|suspend|activate
 * Navigation  : All routes prefixed /admin to prevent dashboard framing 404s.
 */

import { useState } from "react";
import Link from "next/link";
import { Building2, Search, X } from "lucide-react";
import {
  useAllRegisters,
  useApproveRegister,
  useRejectRegister,
  useSuspendRegister,
  useActivateRegister,
} from "@/api/registers";
import type { RegisterItem } from "@/types/super-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/Loader";
import { useGetMe } from "@/api/auth/hooks";
import { resolveRole } from "@/lib/utils";

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

function getRegisterStatus(register: RegisterItem) {
  const status = register.status?.trim().toUpperCase();
  return status && STATUS_META[status] ? status : "PENDING";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegistersPage() {
  const [activeTab,  setActiveTab]  = useState<TabValue>("all");
  const [searchQuery, setSearchQuery] = useState("");
  /**
   * Suspend retains its compact double-confirm interaction. Reject uses a
   * modal confirmation because it is destructive and easy to trigger in a
   * dense action row.
   */
  const [suspendConfirmId, setSuspendConfirmId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RegisterItem | null>(null);

  // Only the organisation's actual Client Admin (owner) may suspend a
  // register — other team roles (Admin, Event Manager, Viewer, Judge) get
  // the same read/manage view otherwise, but this destructive action stays
  // owner-only.
  const { data: userResponse } = useGetMe();
  const isClientAdmin = resolveRole(userResponse?.data) === "client_admin";

  // Load the complete paginated directory once, then filter locally. This keeps
  // every tab accurate even when the backend caps page size or ignores a status
  // query parameter.
  const { data, isLoading } = useAllRegisters();

  const approveMutation = useApproveRegister();
  const rejectMutation  = useRejectRegister();
  const suspendMutation = useSuspendRegister();
  const activateMutation = useActivateRegister();

  const allRegisters: RegisterItem[] = data?.registers ?? [];
  const statusFilteredRegisters = activeTab === "all"
    ? allRegisters
    : allRegisters.filter(
        (register) => getRegisterStatus(register) === activeTab.toUpperCase()
      );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const registers = normalizedSearchQuery
    ? statusFilteredRegisters.filter((register) =>
        [
          register.name,
          register.companyName,
          register.rcNumber,
          register.industry,
          register.email,
          register.phone,
          register.representativeName,
          register.representativePhone,
        ].some((value) => value?.toLowerCase().includes(normalizedSearchQuery))
      )
    : statusFilteredRegisters;

  const tabCounts = allRegisters.reduce<Record<TabValue, number>>(
    (counts, register) => {
      counts.all += 1;
      const status = getRegisterStatus(register).toLowerCase();
      if (status === "active" || status === "pending" || status === "suspended") {
        counts[status] += 1;
      }
      return counts;
    },
    { all: 0, active: 0, pending: 0, suspended: 0 }
  );

  function clearConfirm() {
    setSuspendConfirmId(null);
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
        {isClientAdmin && (
          <Link href="/admin/registers/enrol">
            <Button className="gap-2">Enrol New Register</Button>
          </Link>
        )}
      </div>

      {/* ── Directory search ── */}
      <div className="relative mb-4 w-full sm:max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search registers"
          aria-label="Search registers"
          className="h-10 pl-9 pr-10"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear register search"
            title="Clear search"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
            {tab.label} <span className="tabular-nums">({tabCounts[tab.value]})</span>
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
                <th className="px-5 py-3 text-left">Industry</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registers.map((reg) => {
                const statusKey  = getRegisterStatus(reg);
                const statusMeta = STATUS_META[statusKey] ?? STATUS_META["PENDING"];
                const isActive    = statusKey === "ACTIVE";
                const isSuspended = statusKey === "SUSPENDED";
                const isPending   = statusKey === "PENDING";

                const isSuspendConf = suspendConfirmId === reg.id;

                return (
                  <tr key={reg.id} className="attend-table-row">

                    {/* Name + industry */}
                    <td className="px-5 py-3 max-w-[160px]">
                      <p
                        className="text-sm font-medium text-[hsl(var(--foreground))] truncate"
                        title={reg.name || reg.companyName || "—"}
                      >
                        {reg.name || reg.companyName || "—"}
                      </p>
                      <p
                        className="text-xs text-[hsl(var(--muted-foreground))] truncate"
                        title={reg.industry != null && reg.industry !== "" ? reg.industry : "—"}
                      >
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

                    {/* Industry */}
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {reg.industry != null && reg.industry !== ""
                        ? reg.industry
                        : <i>—</i>
                      }
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">

                        <Link href={`/admin/registers/${reg.id}`}>
                          <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                        </Link>

                        {/* PENDING — Approve + confirmed Reject */}
                        {isPending && (
                          <>
                            <Button
                              size="sm" className="h-7 text-xs"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(reg.id)}
                            >
                              {approveMutation.isPending ? "…" : "Approve"}
                            </Button>

                            <Button
                              size="sm" variant="ghost"
                              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setRejectTarget(reg)}
                            >
                              Reject
                            </Button>
                          </>
                        )}

                        {/* ACTIVE — Suspend (double-confirm), Client Admin only */}
                        {isActive && isClientAdmin && (
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
                              onClick={() => setSuspendConfirmId(reg.id)}
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
                {normalizedSearchQuery
                  ? `No registers found for “${searchQuery.trim()}”`
                  : "No registers match this filter"}
              </p>
              {normalizedSearchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-[hsl(var(--primary))] hover:underline mt-1"
                >
                  Clear search
                </button>
              ) : activeTab !== "all" && (
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

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open && !rejectMutation.isPending) setRejectTarget(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-lg">
          <DialogHeader className="pr-6">
            <DialogTitle>Reject register?</DialogTitle>
            <DialogDescription className="leading-6">
              This will reject the enrolment request for{" "}
              <strong className="font-semibold text-[hsl(var(--foreground))] break-words [overflow-wrap:anywhere]">
                {rejectTarget?.name || rejectTarget?.companyName || "this register"}
              </strong>
              . The register will not be activated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={rejectMutation.isPending}
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!rejectTarget || rejectMutation.isPending}
              onClick={() => {
                if (!rejectTarget) return;
                rejectMutation.mutate(
                  { id: rejectTarget.id },
                  { onSuccess: () => setRejectTarget(null) }
                );
              }}
            >
              {rejectMutation.isPending ? "Rejecting…" : "Reject register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

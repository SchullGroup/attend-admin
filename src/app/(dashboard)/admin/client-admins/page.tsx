"use client";
import { useState } from "react";
import Link from "next/link";
import { Users2, Building2, Globe, Search, ShieldOff } from "lucide-react";
import { useClientAdmins, useSuspendUser, useActivateUser } from "@/api/super-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";
import type { ClientAdminItem } from "@/types/super-admin";

const STATUS_FILTERS = [
  { label: "All",       value: "" },
  { label: "Active",    value: "ACTIVE" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Pending",   value: "PENDING" },
];

export default function ClientAdminsPage() {
  const [search,       setSearch]       = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [page,         setPage]         = useState(0);
  const LIMIT = 20;

  const { data, isLoading } = useClientAdmins(page, LIMIT);
  const suspendMutation  = useSuspendUser();
  const activateMutation = useActivateUser();

  if (isLoading) return <Loader variant="page" text="Loading Client Admins…" />;

  const raw = data as any;
  const allItems: ClientAdminItem[] =
    Array.isArray(raw?.content) ? raw.content :
    Array.isArray(raw)          ? raw          : [];

  const filtered = allItems
    .filter((c) => !activeStatus || c.status?.toUpperCase() === activeStatus)
    .filter((c) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(s) ||
        (c.email ?? "").toLowerCase().includes(s) ||
        (c.industry ?? "").toLowerCase().includes(s)
      );
    });

  const totalElements = raw?.totalElements ?? (raw as any)?.totalCount ?? allItems.length;
  const totalPages    = raw?.totalPages    ?? Math.ceil(totalElements / LIMIT);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Client Admins</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Registered client organisations and their admin users
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
          <Users2 className="h-4 w-4" />
          <span className="font-semibold text-[hsl(var(--foreground))]">{totalElements}</span> total
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or industry…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          />
        </div>
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveStatus(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeStatus === f.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Organisation</th>
              <th className="px-5 py-3 text-left">Industry</th>
              <th className="px-5 py-3 text-left">Website</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Created</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const isSuspended = c.status?.toUpperCase() === "SUSPENDED";
              const isConfirm   = confirmId === c.id;

              // For suspend/activate we need the admin user's ID (the user account)
              const adminUserId = c.admin?.id ?? c.id;

              return (
                <tr key={c.id} className="attend-table-row">
                  {/* Organisation */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-[hsl(var(--primary)/0.08)] flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">{c.name}</div>
                        {c.address && (
                          <div className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[160px]">{c.address}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Industry */}
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {c.industry ?? "—"}
                  </td>

                  {/* Website */}
                  <td className="px-5 py-3">
                    {c.website ? (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[hsl(var(--primary))] hover:underline truncate max-w-[140px]"
                      >
                        <Globe className="h-3 w-3 shrink-0" />
                        {c.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="text-sm text-[hsl(var(--muted-foreground))]">—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3">
                    <StatusBadge status={c.status?.toLowerCase()} />
                  </td>

                  {/* Created */}
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {c.createdAt ? formatDate(c.createdAt) : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/admin/client-admins/${adminUserId}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                      </Link>

                      {isSuspended ? (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                          disabled={activateMutation.isPending}
                          onClick={() => activateMutation.mutate(adminUserId)}
                        >
                          Restore
                        </Button>
                      ) : isConfirm ? (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-400 bg-red-50"
                          disabled={suspendMutation.isPending}
                          onClick={() => { suspendMutation.mutate(adminUserId); setConfirmId(null); }}
                        >
                          Confirm?
                        </Button>
                      ) : (
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setConfirmId(c.id)}
                        >
                          <ShieldOff className="h-3 w-3 mr-1" /> Suspend
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-14 text-center">
            <Users2 className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No client admins found</p>
            {(search || activeStatus) && (
              <button
                onClick={() => { setSearch(""); setActiveStatus(""); }}
                className="text-xs text-[hsl(var(--primary))] hover:underline mt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

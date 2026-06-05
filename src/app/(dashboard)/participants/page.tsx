"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, Shield, Users, ShieldCheck, ShieldOff } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { formatDate } from "@/lib/utils";

const KYC_FILTERS = [
  { label: "All", value: "all" },
  { label: "Full KYC", value: "full" },
  { label: "Basic KYC", value: "basic" },
  { label: "Pending", value: "pending" },
  { label: "No KYC", value: "none" },
];

export default function ParticipantsPage() {
  const { participants, suspendParticipant, restoreParticipant } = useStore();
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const fullKYC = participants.filter((p) => p.kycStatus === "full").length;
  const pendingKYC = participants.filter((p) => p.kycStatus === "pending").length;

  const filtered = participants.filter((p) => {
    const matchSearch =
      !search ||
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    const matchKYC = kycFilter === "all" || p.kycStatus === kycFilter;
    return matchSearch && matchKYC;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Users</h1>
        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">{participants.length}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Total Users</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-green-50 flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">{fullKYC}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Full KYC</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-yellow-600" />
            </div>
            <div>
              <div className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">{pendingKYC}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))]">Pending KYC</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1">
          {KYC_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setKycFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                kycFilter === f.value
                  ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">User</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-left">KYC Status</th>
              <th className="px-5 py-3 text-left">Events Attended</th>
              <th className="px-5 py-3 text-left">Account Status</th>
              <th className="px-5 py-3 text-left">Registered</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="attend-table-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                      {p.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[hsl(var(--foreground))]">{p.fullName}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">{p.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{p.phone}</td>
                <td className="px-5 py-3"><StatusBadge status={p.kycStatus} /></td>
                <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">{p.eventsAttended}</td>
                <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{formatDate(p.registeredAt)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/participants/${p.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                    </Link>
                    {p.status === "suspended" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                        onClick={() => restoreParticipant(p.id)}
                      >
                        Restore
                      </Button>
                    ) : confirmId === p.id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-400 bg-red-50"
                        onClick={() => { suspendParticipant(p.id); setConfirmId(null); }}
                      >
                        Confirm?
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setConfirmId(p.id)}
                      >
                        <ShieldOff className="h-3 w-3 mr-1" />Suspend
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">No users match your search.</div>
        )}
      </Card>
    </div>
  );
}

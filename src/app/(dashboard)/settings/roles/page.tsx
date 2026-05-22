"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Shield, Settings, Vote, FileText, Users } from "lucide-react";

const ROLES = [
  {
    id: "super_admin",
    name: "Super Admin",
    desc: "Full platform access including settings, user management, and all modules",
    permissions: ["Events", "Participants", "KYC", "Documents", "Analytics", "Settings", "Roles"],
    color: "#1a6b3c",
    bg: "#edf7f2",
    icon: Shield,
  },
  {
    id: "event_manager",
    name: "Event Manager",
    desc: "Create and manage events, upload documents, control live sessions",
    permissions: ["Events", "Documents", "Analytics (read)"],
    color: "#2563eb",
    bg: "#eff5ff",
    icon: Settings,
  },
  {
    id: "kyc_officer",
    name: "KYC Officer",
    desc: "Review and approve or reject participant KYC submissions",
    permissions: ["KYC Queue", "Participants (read)"],
    color: "#f97316",
    bg: "#fff4eb",
    icon: Users,
  },
  {
    id: "judge",
    name: "Judge",
    desc: "Access hackathon applications and submit scores for assigned challenges",
    permissions: ["Hackathon Applications (read)", "Judging"],
    color: "#9333ea",
    bg: "#f8f0ff",
    icon: Vote,
  },
];

const MOCK_TEAM = [
  { id: "u1", name: "Stanley Jacob", email: "stanley.jacob@meristem.com", role: "super_admin" },
  { id: "u2", name: "Adaeze Williams", email: "adaeze.w@meristem.com", role: "event_manager" },
  { id: "u3", name: "Chinedu Obi", email: "chinedu.obi@meristem.com", role: "kyc_officer" },
  { id: "u4", name: "Prof. Adeola Taiwo", email: "adeola.t@university.ng", role: "judge" },
];

export default function RolesPage() {
  const [team] = useState(MOCK_TEAM);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Roles & Access</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Manage admin team members and their permission levels</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Invite Team Member
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const count = team.filter((u) => u.role === role.id).length;
          return (
            <Card key={role.id} className="attend-card p-5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: role.bg }}>
                  <Icon className="h-4.5 w-4.5" style={{ color: role.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{role.name}</span>
                    <span className="text-xs tabular-nums font-medium" style={{ color: role.color }}>{count} member{count !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 mb-2">{role.desc}</p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <span key={p} className="text-[10px] font-medium rounded-full px-2 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">{p}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="attend-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Team Members</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Member</th>
              <th className="px-5 py-3 text-left">Role</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {team.map((u) => {
              const role = ROLES.find((r) => r.id === u.role);
              return (
                <tr key={u.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">{u.name}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {role && (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: role.bg, color: role.color }}
                      >
                        {role.name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs">Edit Role</Button>
                      {u.id !== "u1" && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50">Remove</Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

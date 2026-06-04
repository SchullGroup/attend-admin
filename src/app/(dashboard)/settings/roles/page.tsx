"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus, Shield, Settings, Vote, Users } from "lucide-react";
import { toast } from "sonner";

const ROLES = [
  {
    id: "super_admin",
    name: "Super Admin",
    desc: "Full platform access including settings, user management, and all modules",
    permissions: [
      "Events",
      "Participants",
      "KYC",
      "Documents",
      "Analytics",
      "Settings",
      "Roles",
    ],
    color: "#374151",
    bg: "#f3f4f6",
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
    permissions: ["Innovation Challenge Applications (read)", "Judging"],
    color: "#9333ea",
    bg: "#f8f0ff",
    icon: Vote,
  },
];

type RoleId = "super_admin" | "event_manager" | "kyc_officer" | "judge";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: RoleId;
}

const INITIAL_TEAM: TeamMember[] = [
  {
    id: "u1",
    name: "Stanley Jacob",
    email: "stanley.jacob@meristem.com",
    role: "super_admin",
  },
  {
    id: "u2",
    name: "Adaeze Williams",
    email: "adaeze.w@meristem.com",
    role: "event_manager",
  },
  {
    id: "u3",
    name: "Chinedu Obi",
    email: "chinedu.obi@meristem.com",
    role: "kyc_officer",
  },
  {
    id: "u4",
    name: "Prof. Adeola Taiwo",
    email: "adeola.t@university.ng",
    role: "judge",
  },
];

export default function RolesPage() {
  const [team, setTeam] = useState<TeamMember[]>(INITIAL_TEAM);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleId>("event_manager");

  // Edit role dialog
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<RoleId>("event_manager");

  function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const newMember: TeamMember = {
      id: `u${Date.now()}`,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: inviteRole,
    };
    setTeam((prev) => [...prev, newMember]);
    toast.success(`Invitation sent to ${inviteEmail.trim()}`);
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("event_manager");
  }

  function openEditDialog(member: TeamMember) {
    setEditMember(member);
    setEditRole(member.role);
  }

  function handleEditRole() {
    if (!editMember) return;
    setTeam((prev) =>
      prev.map((m) => (m.id === editMember.id ? { ...m, role: editRole } : m)),
    );
    const roleName = ROLES.find((r) => r.id === editRole)?.name ?? editRole;
    toast.success(`${editMember.name}'s role updated to ${roleName}`);
    setEditMember(null);
  }

  function handleRemove(member: TeamMember) {
    setTeam((prev) => prev.filter((m) => m.id !== member.id));
    toast.success(`${member.name} removed from the team`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Roles & Access
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Manage admin team members and their permission levels
          </p>
        </div>
        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" />
          Invite Team Member
        </Button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const count = team.filter((u) => u.role === role.id).length;
          return (
            <Card key={role.id} className="attend-card p-5">
              <div className="flex items-start gap-3">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: role.bg }}
                >
                  <Icon className="h-4 w-4" style={{ color: role.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      {role.name}
                    </span>
                    <span
                      className="text-xs tabular-nums font-medium"
                      style={{ color: role.color }}
                    >
                      {count} member{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 mb-2">
                    {role.desc}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <span
                        key={p}
                        className="text-xs font-medium rounded-full px-2 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Team table */}
      <Card className="attend-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            Team Members
          </h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {team.length} members
          </span>
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
              const isSelf = u.id === "u1";
              return (
                <tr key={u.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                        {u.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 text-xs font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)] rounded-full px-1.5 py-0.5">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {u.email}
                        </div>
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
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => openEditDialog(u)}
                      >
                        Edit Role
                      </Button>
                      {!isSelf && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemove(u)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {team.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No team members yet.
          </div>
        )}
      </Card>

      {/* ── Invite Dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to a new admin. They will receive an email with
              a link to set their password.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="inv-name" className="mb-2 block">
                Full Name
              </Label>
              <Input
                id="inv-name"
                placeholder="e.g. Emeka Okafor"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inv-email" className="mb-2 block">
                Email Address
              </Label>
              <Input
                id="inv-email"
                type="email"
                placeholder="e.g. emeka@meristem.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-2 block">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as RoleId)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {r.desc}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role preview */}
            {(() => {
              const selected = ROLES.find((r) => r.id === inviteRole);
              return selected ? (
                <div
                  className="rounded-xl p-3 flex flex-wrap gap-1"
                  style={{ backgroundColor: selected.bg }}
                >
                  <span
                    className="text-xs font-semibold w-full mb-1"
                    style={{ color: selected.color }}
                  >
                    {selected.name} permissions:
                  </span>
                  {selected.permissions.map((p) => (
                    <span
                      key={p}
                      className="text-xs font-medium rounded-full px-2 py-0.5 bg-white/70 border border-white"
                      style={{ color: selected.color }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleInvite}
              disabled={!inviteName.trim() || !inviteEmail.trim()}
            >
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Role Dialog ── */}
      <Dialog
        open={!!editMember}
        onOpenChange={(open) => {
          if (!open) setEditMember(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Change the permission level for
              {editMember ? ` ${editMember.name}` : " this member"}.
            </DialogDescription>
          </DialogHeader>

          {editMember && (
            <div className="flex flex-col gap-4">
              {/* Member preview */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]">
                <div className="h-9 w-9 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                  {editMember.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {editMember.name}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {editMember.email}
                  </p>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">New Role</Label>
                <Select
                  value={editRole}
                  onValueChange={(v) => setEditRole(v as RoleId)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            {r.desc}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Role preview */}
              {(() => {
                const selected = ROLES.find((r) => r.id === editRole);
                return selected ? (
                  <div
                    className="rounded-xl p-3 flex flex-wrap gap-1"
                    style={{ backgroundColor: selected.bg }}
                  >
                    <span
                      className="text-xs font-semibold w-full mb-1"
                      style={{ color: selected.color }}
                    >
                      {selected.name} permissions:
                    </span>
                    {selected.permissions.map((p) => (
                      <span
                        key={p}
                        className="text-xs font-medium rounded-full px-2 py-0.5 bg-white/70 border border-white"
                        style={{ color: selected.color }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleEditRole}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

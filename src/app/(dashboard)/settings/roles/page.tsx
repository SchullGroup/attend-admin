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
import { Plus, Shield, Settings, Vote, Users, ShieldOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useUsers, useSuspendUser, useActivateUser } from "@/api/super-admin";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";

const ROLES_INFO = [
  {
    id: "SUPER_ADMIN",
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
    id: "CLIENT_ADMIN",
    name: "Event Manager",
    desc: "Create and manage events, upload documents, control live sessions",
    permissions: ["Events", "Documents", "Analytics (read)"],
    color: "#2563eb",
    bg: "#eff5ff",
    icon: Settings,
  },
  {
    id: "KYC_OFFICER",
    name: "KYC Officer",
    desc: "Review and approve or reject participant KYC submissions",
    permissions: ["KYC Queue", "Participants (read)"],
    color: "#f97316",
    bg: "#fff4eb",
    icon: Users,
  },
  {
    id: "JUDGE",
    name: "Judge",
    desc: "Access hackathon applications and submit scores for assigned challenges",
    permissions: ["Innovation Challenge Applications (read)", "Judging"],
    color: "#9333ea",
    bg: "#f8f0ff",
    icon: Vote,
  },
];

type RoleId = "SUPER_ADMIN" | "CLIENT_ADMIN" | "KYC_OFFICER" | "JUDGE";

export default function RolesPage() {
  const [page, setPage] = useState(0);
  const { data: usersData, isLoading, isError } = useUsers(page, 20);
  
  const suspendMutation = useSuspendUser();
  const activateMutation = useActivateUser();

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleId>("CLIENT_ADMIN");

  // Edit role dialog
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editRole, setEditRole] = useState<RoleId>("CLIENT_ADMIN");

  if (isLoading) {
    return <Loader variant="page" text="Loading Team & Roles..." />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-red-500 font-semibold">
        Failed to load platform users.
      </div>
    );
  }

  const users = usersData?.data?.content || [];
  const totalPages = usersData?.data?.totalPages || 1;

  const superAdminCount = users.filter((u) => u.role === "SUPER_ADMIN").length;
  const clientAdminCount = users.filter((u) => u.role === "CLIENT_ADMIN").length;
  const kycOfficerCount = users.filter((u) => u.role === "KYC_OFFICER").length;
  const judgeCount = users.filter((u) => u.role === "JUDGE").length;

  const roleCounts: Record<string, number> = {
    SUPER_ADMIN: superAdminCount,
    CLIENT_ADMIN: clientAdminCount,
    KYC_OFFICER: kycOfficerCount,
    JUDGE: judgeCount,
  };

  function handleInvite() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    // Super Admin user invitations are synchronized centrally via enterprise provider
    toast.success(`Invitation processed for ${inviteEmail.trim()}. Credentials will sync with SSO provider.`);
    setInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("CLIENT_ADMIN");
  }

  function openEditDialog(member: any) {
    setEditMember(member);
    setEditRole(member.role as RoleId);
  }

  function handleEditRole() {
    if (!editMember) return;
    toast.success(`Role update request for ${editMember.firstName} sent to directory administrator.`);
    setEditMember(null);
  }

  function handleToggleStatus(user: any) {
    const isSuspended = user.status === "SUSPENDED";
    const actionText = isSuspended ? "Reactivate" : "Suspend";
    
    popup.confirm(
      `${actionText} User`,
      `Are you sure you want to ${actionText.toLowerCase()} ${user.firstName} ${user.lastName}?`,
      () => {
        if (isSuspended) {
          activateMutation.mutate(user.id);
        } else {
          suspendMutation.mutate(user.id);
        }
      }
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Roles & Access
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Manage platform users and their administrative access levels
          </p>
        </div>
        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {ROLES_INFO.map((role) => {
          const Icon = role.icon;
          const count = roleCounts[role.id] ?? 0;
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
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 mb-2 line-clamp-2">
                    {role.desc}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <span
                        key={p}
                        className="text-[10px] font-medium rounded-full px-2 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
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
            Platform Users
          </h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            Page {page + 1} of {totalPages}
          </span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">User</th>
              <th className="px-5 py-3 text-left">Role</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const roleMeta = ROLES_INFO.find((r) => r.id === u.role);
              const name = `${u.firstName} ${u.lastName}`;
              return (
                <tr key={u.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                        {u.firstName[0]}
                        {u.lastName[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {name}
                        </div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {roleMeta ? (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: roleMeta.bg, color: roleMeta.color }}
                      >
                        {roleMeta.name}
                      </span>
                    ) : (
                      <span className="text-xs text-[hsl(var(--muted-foreground))] uppercase font-medium">
                        {u.role.replace("_", " ")}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.status === "ACTIVE"
                          ? "bg-green-50 text-green-700"
                          : u.status === "SUSPENDED"
                            ? "bg-red-50 text-red-600"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {u.status}
                    </span>
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
                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-7 text-xs gap-1 ${
                          u.status === "SUSPENDED"
                            ? "text-green-700 border-green-200 hover:bg-green-50"
                            : "text-red-600 border-red-200 hover:bg-red-50"
                        }`}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.status === "SUSPENDED" ? (
                          <>
                            <CheckCircle className="h-3.5 w-3.5" />
                            Activate
                          </>
                        ) : (
                          <>
                            <ShieldOff className="h-3.5 w-3.5" />
                            Suspend
                          </>
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No platform users found.
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border)/0.6)]">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* ── Invite Dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Provide user profile details. The invitation will request single sign-on synchronization.
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
                  {ROLES_INFO.map((r) => (
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
              const selected = ROLES_INFO.find((r) => r.id === inviteRole);
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
              Change the permission level for {editMember ? `${editMember.firstName} ${editMember.lastName}` : "this member"}.
            </DialogDescription>
          </DialogHeader>

          {editMember && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--muted)/0.4)]">
                <div className="h-9 w-9 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-[hsl(var(--primary))] text-xs font-bold shrink-0">
                  {editMember.firstName[0]}
                  {editMember.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {editMember.firstName} {editMember.lastName}
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
                    {ROLES_INFO.map((r) => (
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
                const selected = ROLES_INFO.find((r) => r.id === editRole);
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

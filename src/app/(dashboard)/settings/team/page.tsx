"use client";
import { useState } from "react";
import {
  useOrganisationTeam,
  useInviteTeamMember,
  useRevokeTeamMember,
  useReactivateTeamMember,
  type TeamMember,
  type TeamMemberRole,
} from "@/api/client-organisation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPlus, Users2, RotateCcw, ShieldOff } from "lucide-react";
import { formatDate, resolveRole } from "@/lib/utils";
import { useGetMe } from "@/api/auth/hooks";

// ─── Style maps ──────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  ADMIN:         { bg: "#f3f4f6", color: "#374151", label: "Admin" },
  EVENT_MANAGER: { bg: "#dbeafe", color: "#1d4ed8", label: "Event Manager" },
  VIEWER:        { bg: "#f3f4f6", color: "#6b7280", label: "Viewer" },
  JUDGE:         { bg: "#faf5ff", color: "#7c22c9", label: "Judge" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:  { bg: "#dcfce7", color: "#16a34a", label: "Active" },
  INVITED: { bg: "#fef9c3", color: "#b45309", label: "Invited" },
  REVOKED: { bg: "#fee2e2", color: "#dc2626", label: "Revoked" },
};

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? { bg: "#f3f4f6", color: "#6b7280", label: role };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const key = status?.toUpperCase();
  const s = STATUS_STYLE[key] ?? { bg: "#f3f4f6", color: "#6b7280", label: status };
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

function Avatar({ member, role }: { member: TeamMember; role: string }) {
  const s = ROLE_STYLE[role] ?? { bg: "#f3f4f6", color: "#6b7280" };
  const initials = member.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ backgroundColor: s.bg, color: s.color }}>
      {initials}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { data, isLoading, isError } = useOrganisationTeam("", "", 0, 50);
  const inviteMutation     = useInviteTeamMember();
  const revokeMutation     = useRevokeTeamMember();
  const reactivateMutation = useReactivateTeamMember();

  // Only the organisation's actual Client Admin (owner) may revoke another
  // team member's access — every other role (Admin, Event Manager, Viewer,
  // Judge) can view the team list but shouldn't see the revoke control.
  const { data: userResponse } = useGetMe();
  const isClientAdmin = resolveRole(userResponse?.data) === "client_admin";

  const [inviteOpen,    setInviteOpen]    = useState(false);
  const [firstName,     setFirstName]     = useState("");
  const [lastName,      setLastName]      = useState("");
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState<TeamMemberRole>("VIEWER");
  const [confirmId,     setConfirmId]     = useState<string | null>(null);

  const members = data?.members ?? [];
  const active  = members.filter((m) => m.status?.toUpperCase() !== "REVOKED");
  const revoked = members.filter((m) => m.status?.toUpperCase() === "REVOKED");

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail || !firstName || !lastName) return;
    inviteMutation.mutate(
      { firstName, lastName, email: inviteEmail, role: inviteRole },
      {
        onSuccess: () => {
          setInviteOpen(false);
          setFirstName(""); setLastName(""); setInviteEmail(""); setInviteRole("VIEWER");
        },
      }
    );
  }

  function handleRevoke(id: string) {
    revokeMutation.mutate(id, { onSuccess: () => setConfirmId(null) });
  }

  function MemberRow({ member, revoked: isRevoked }: { member: TeamMember; revoked?: boolean }) {
    return (
      <tr key={member.id} className={`attend-table-row${isRevoked ? " opacity-60" : ""}`}>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar member={member} role={member.role} />
            <span className={`text-sm font-medium text-[hsl(var(--foreground))]${isRevoked ? " line-through" : ""}`}>
              {member.fullName}
            </span>
          </div>
        </td>
        <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{member.email}</td>
        <td className="px-5 py-3"><RoleBadge role={member.role} /></td>
        {!isRevoked && <td className="px-5 py-3"><StatusBadge status={member.status} /></td>}
        {!isRevoked && (
          <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
            {member.joinedAt
              ? formatDate(member.joinedAt)
              : member.invitedAt
              ? `Invited ${formatDate(member.invitedAt)}`
              : "—"}
          </td>
        )}
        <td className={`px-5 py-3 text-right${isRevoked ? " col-span-2" : ""}`}>
          {isRevoked ? (
            isClientAdmin && (
              <Button
                size="sm" variant="outline"
                className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                disabled={reactivateMutation.isPending}
                onClick={() => reactivateMutation.mutate(member.id)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {reactivateMutation.isPending ? "Restoring…" : "Reactivate"}
              </Button>
            )
          ) : !isClientAdmin ? null : confirmId === member.id ? (
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">Remove access?</span>
              <Button
                size="sm" variant="destructive"
                disabled={revokeMutation.isPending}
                onClick={() => handleRevoke(member.id)}
              >
                {revokeMutation.isPending ? "Revoking…" : "Confirm"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmId(null)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm" variant="ghost"
              className="gap-1.5 text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50"
              onClick={() => setConfirmId(member.id)}
            >
              <ShieldOff className="h-3.5 w-3.5" /> Revoke
            </Button>
          )}
        </td>
      </tr>
    );
  }

  if (isLoading) return <Loader variant="page" text="Loading Team…" />;
  if (isError)   return <p className="text-center py-12 text-red-500">Failed to load team members.</p>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Team Members</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {active.length} active · {revoked.length} revoked
          </p>
        </div>

        {isClientAdmin && (
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Invite Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-2 block">First Name</Label>
                  <Input placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div>
                  <Label className="mb-2 block">Last Name</Label>
                  <Input placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Email Address</Label>
                <Input type="email" placeholder="jane@organisation.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              </div>
              <div>
                <Label className="mb-2 block">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamMemberRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin — Full access</SelectItem>
                    <SelectItem value="EVENT_MANAGER">Event Manager — Create &amp; manage events</SelectItem>
                    <SelectItem value="VIEWER">Viewer — Read-only access</SelectItem>
                    <SelectItem value="JUDGE">Judge — Score innovation challenges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Sending…" : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Active members */}
      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Active Members</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Member</th>
              <th className="px-5 py-3 text-left">Email</th>
              <th className="px-5 py-3 text-left">Role</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Joined</th>
              <th className="px-5 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {active.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-14 text-center">
                <Users2 className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
                <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No active members</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Invite colleagues to manage the platform together.</p>
                {isClientAdmin && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> Invite someone
                  </Button>
                )}
              </td></tr>
            ) : (
              active.map((m) => <MemberRow key={m.id} member={m} />)
            )}
          </tbody>
        </table>
      </Card>

      {/* Revoked members */}
      {revoked.length > 0 && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">Revoked Members</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">These members no longer have access. You can reactivate them at any time.</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Member</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {revoked.map((m) => <MemberRow key={m.id} member={m} revoked />)}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

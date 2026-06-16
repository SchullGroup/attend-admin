"use client";
import { useState } from "react";
import {
  useOrganisationTeam,
  useInviteTeamMember,
  useRevokeTeamMember,
  useReactivateTeamMember,
  type TeamMemberRole,
} from "@/api/client-organisation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPlus, Trash2, Users2, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  ADMIN:         { bg: "#f3f4f6", color: "#374151" },
  EVENT_MANAGER: { bg: "#dbeafe", color: "#374151" },
  VIEWER:        { bg: "#f3f4f6", color: "#6b7280" },
  JUDGE:         { bg: "#faf5ff", color: "#7c22c9" },
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin", EVENT_MANAGER: "Event Manager", VIEWER: "Viewer", JUDGE: "Judge",
};

export default function TeamPage() {
  const { data, isLoading, isError } = useOrganisationTeam("", "", 0, 50);
  const inviteMutation      = useInviteTeamMember();
  const revokeMutation      = useRevokeTeamMember();
  const reactivateMutation  = useReactivateTeamMember();

  const [inviteOpen,    setInviteOpen]    = useState(false);
  const [firstName,     setFirstName]     = useState("");
  const [lastName,      setLastName]      = useState("");
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState<TeamMemberRole>("VIEWER");
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const members = data?.members ?? [];

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail || !firstName || !lastName) return;
    inviteMutation.mutate(
      { firstName, lastName, email: inviteEmail, role: inviteRole },
      { onSuccess: () => { setInviteOpen(false); setFirstName(""); setLastName(""); setInviteEmail(""); setInviteRole("VIEWER"); } }
    );
  }

  if (isLoading) return <Loader variant="page" text="Loading Team…" />;
  if (isError)   return <p className="text-center py-12 text-red-500">Failed to load team members.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Team Members</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""} · manage access to the platform
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Invite Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-2 block">First Name</Label><Input placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
                <div><Label className="mb-2 block">Last Name</Label><Input placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
              </div>
              <div><Label className="mb-2 block">Email Address</Label><Input type="email" placeholder="jane@organisation.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required /></div>
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
                <Button type="submit" disabled={inviteMutation.isPending}>{inviteMutation.isPending ? "Sending…" : "Send Invitation"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(ROLE_LABELS).map(([key, label]) => {
          const c = ROLE_COLORS[key] ?? { bg: "#f3f4f6", color: "#6b7280" };
          return <div key={key} className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.color }}>{label}</div>;
        })}
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const c = ROLE_COLORS[member.role] ?? { bg: "#f3f4f6", color: "#6b7280" };
              const isRevoked = member.status === "REVOKED";
              return (
                <tr key={member.id} className="attend-table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: c.bg, color: c.color }}>
                        {member.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">{member.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{member.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: c.bg, color: c.color }}>
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium" style={{ color: isRevoked ? "#dc2626" : member.status === "INVITED" ? "#d97706" : "#16a34a" }}>{member.status}</td>
                  <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {member.joinedAt ? formatDate(member.joinedAt) : member.invitedAt ? `Invited ${formatDate(member.invitedAt)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isRevoked ? (
                      <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50" disabled={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate(member.id)}>
                        <RefreshCw className="h-3.5 w-3.5" /> Reactivate
                      </Button>
                    ) : confirmRevoke === member.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Confirm?</span>
                        <Button size="sm" variant="destructive" disabled={revokeMutation.isPending} onClick={() => { revokeMutation.mutate(member.id); setConfirmRevoke(null); }}>Revoke</Button>
                        <Button size="sm" variant="outline" onClick={() => setConfirmRevoke(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="gap-1.5 text-[hsl(var(--muted-foreground))] hover:text-red-600" onClick={() => setConfirmRevoke(member.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Revoke Access
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-14 text-center">
                <Users2 className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
                <p className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">No team members yet</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">Invite colleagues to manage the platform together.</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setInviteOpen(true)}><UserPlus className="h-3.5 w-3.5" /> Invite someone</Button>
              </td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

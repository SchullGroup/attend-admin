"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { TeamRole, TeamMember } from "@/lib/mock-data";

const ROLE_COLORS: Record<TeamRole, { bg: string; color: string }> = {
  "Admin": { bg: "#f3f4f6", color: "#374151" },
  "Event Manager": { bg: "#dbeafe", color: "#374151" },
  "Viewer": { bg: "#f3f4f6", color: "#6b7280" },
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function TeamPage() {
  const { team, addTeamMember, removeTeamMember } = useStore();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("Viewer");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    const newMember: TeamMember = {
      id: `tm_${genId()}`,
      name: inviteEmail.split("@")[0].replace(".", " "),
      email: inviteEmail,
      role: inviteRole,
      joinedAt: new Date().toISOString(),
    };
    addTeamMember(newMember);
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("Viewer");
  }

  function handleRemove(memberId: string) {
    removeTeamMember(memberId);
    setConfirmRemove(null);
    toast.success("Access revoked.");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Team Members</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {team.length} member{team.length !== 1 ? "s" : ""} · manage access to the admin platform
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" /> Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <Label className="mb-2 block">Email Address</Label>
                <Input
                  type="email"
                  placeholder="colleague@meristem.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="mb-2 block">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin — Full access</SelectItem>
                    <SelectItem value="Event Manager">Event Manager — Create &amp; manage events</SelectItem>
                    <SelectItem value="Viewer">Viewer — Read-only access</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-3 p-3 rounded-xl bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))] space-y-1">
                  <p><span className="font-semibold text-[hsl(var(--foreground))]">Admin:</span> Full control including team management and billing.</p>
                  <p><span className="font-semibold text-[hsl(var(--foreground))]">Event Manager:</span> Can create, edit, and manage events and documents.</p>
                  <p><span className="font-semibold text-[hsl(var(--foreground))]">Viewer:</span> Can view events and analytics, no editing access.</p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button type="submit">Send Invitation</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {(Object.entries(ROLE_COLORS) as [TeamRole, { bg: string; color: string }][]).map(([role, colors]) => (
          <div
            key={role}
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: colors.bg, color: colors.color }}
          >
            {role}
          </div>
        ))}
      </div>

      {/* Team table */}
      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {team.map((member) => {
              const colors = ROLE_COLORS[member.role] ?? { bg: "#f3f4f6", color: "#6b7280" };
              return (
                <tr key={member.id} className="attend-table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: colors.bg, color: colors.color }}
                      >
                        {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-[hsl(var(--foreground))]">{member.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{member.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: colors.bg, color: colors.color }}
                    >
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {formatDate(member.joinedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {confirmRemove === member.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Confirm?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemove(member.id)}
                        >
                          Revoke
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmRemove(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-[hsl(var(--muted-foreground))] hover:text-red-600"
                        onClick={() => setConfirmRemove(member.id)}
                        disabled={member.role === "Admin" && team.filter((m) => m.role === "Admin").length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Revoke Access
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {team.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Permission matrix */}
      <Card className="attend-card">
        <div className="p-5 border-b border-[hsl(var(--border))]">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Role Permissions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="attend-table-header">
                <th className="px-4 py-3 text-left">Permission</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-center">Event Manager</th>
                <th className="px-4 py-3 text-center">Viewer</th>
              </tr>
            </thead>
            <tbody>
              {[
                { perm: "View Events & Analytics", admin: true, manager: true, viewer: true },
                { perm: "Create & Edit Events", admin: true, manager: true, viewer: false },
                { perm: "Upload Documents", admin: true, manager: true, viewer: false },
                { perm: "Manage Participants", admin: true, manager: true, viewer: false },
                { perm: "Publish / Go Live Events", admin: true, manager: true, viewer: false },
                { perm: "Manage Organisers", admin: true, manager: false, viewer: false },
                { perm: "Manage Team Members", admin: true, manager: false, viewer: false },
                { perm: "Platform Settings", admin: true, manager: false, viewer: false },
              ].map((row) => (
                <tr key={row.perm} className="attend-table-row">
                  <td className="px-4 py-3 text-sm text-[hsl(var(--foreground))]">{row.perm}</td>
                  {[row.admin, row.manager, row.viewer].map((allowed, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {allowed ? (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">✓</span>
                      ) : (
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-xs">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

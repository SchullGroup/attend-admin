"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGetMe } from "@/api/auth/hooks";
import { isSuperAdminRole, resolveRole } from "@/lib/utils";
import { ProfileSettingsView } from "../settings/page";
import { Loader } from "@/components/ui/Loader";

/** Pretty-print a raw role token like "client_admin" -> "Client Admin". */
function prettyRole(role?: string | null): string {
  if (!role) return "—";
  return role
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function ProfilePage() {
  const { data: me, isLoading } = useGetMe();
  const user = (me?.data ?? {}) as Record<string, any>;
  const router = useRouter();
  // Super admin has no personal profile page — send them to the dashboard.
  const isSuperAdmin = !isLoading && isSuperAdminRole(resolveRole(me?.data as any));
  useEffect(() => { if (isSuperAdmin) router.replace("/"); }, [isSuperAdmin, router]);

  if (isLoading || isSuperAdmin) return <Loader variant="page" text="Loading profile…" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">My Profile</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Your photo and personal details.
        </p>
      </div>
      <ProfileSettingsView user={user} roleLabel={prettyRole(user?.role)} showAccountCards={false} />
    </div>
  );
}

"use client";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Mail, Phone, Globe, MapPin,
  Briefcase, Calendar, User,
} from "lucide-react";
import { useClientAdminDetail } from "@/api/super-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/custom/status-badge";
import { Loader } from "@/components/ui/Loader";
import { formatDate } from "@/lib/utils";

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
          {label}
        </p>
        <p className="text-sm text-[hsl(var(--foreground))]">{value}</p>
      </div>
    </div>
  );
}

export default function ClientAdminDetailPage() {
  const params = useParams();
  const id     = params.id as string;
  const router = useRouter();

  const { data, isLoading } = useClientAdminDetail(id);

  if (isLoading) return <Loader variant="page" text="Loading Client Admin…" />;

  const c = data as any;

  if (!c) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Not found</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/admin/client-admins")}>
          <ArrowLeft className="h-4 w-4" /> Back to Client Admins
        </Button>
      </div>
    );
  }

  const adminName = c.admin
    ? `${c.admin.firstName ?? ""} ${c.admin.lastName ?? ""}`.trim()
    : null;

  return (
    <div>
      {/* Back nav */}
      <button
        onClick={() => router.push("/admin/client-admins")}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-5 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Client Admins
      </button>

      <div className="grid grid-cols-3 gap-5">
        {/* ── Identity card ── */}
        <div className="col-span-1 flex flex-col gap-4">
          <Card className="attend-card p-6 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-[hsl(var(--primary)/0.08)] flex items-center justify-center text-xl font-bold text-[hsl(var(--primary))] mb-4">
              {(c.name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">{c.name ?? "—"}</h1>
            {c.industry && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{c.industry}</p>
            )}
            <div className="mt-3">
              <StatusBadge status={c.status?.toLowerCase()} />
            </div>
            <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] w-full text-xs text-[hsl(var(--muted-foreground))]">
              Created {c.createdAt ? formatDate(c.createdAt) : "—"}
            </div>
          </Card>
        </div>

        {/* ── Detail panel ── */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Organisation details */}
          <Card className="attend-card p-5">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="h-4 w-4 text-[hsl(var(--primary))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Organisation Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <Field icon={Mail}     label="Email"    value={c.email} />
              <Field icon={Phone}    label="Phone"    value={c.phone} />
              <Field icon={Briefcase} label="Industry" value={c.industry} />
              <Field icon={MapPin}   label="Address"  value={c.address} />
              <Field icon={Globe}    label="Website"  value={c.website} />
              <Field icon={Calendar} label="Created"  value={c.createdAt ? formatDate(c.createdAt) : null} />
            </div>

            {/* Website as link */}
            {c.website && (
              <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                <a
                  href={c.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--primary))] hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {c.website}
                </a>
              </div>
            )}
          </Card>

          {/* Admin user card */}
          {(adminName || c.admin?.email || c.admin?.phone) && (
            <Card className="attend-card p-5">
              <div className="flex items-center gap-2 mb-5">
                <User className="h-4 w-4 text-[hsl(var(--primary))]" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Admin User</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-[hsl(var(--primary)/0.08)] flex items-center justify-center text-sm font-bold text-[hsl(var(--primary))] shrink-0">
                  {adminName
                    ? adminName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                    : "?"}
                </div>
                <div className="flex-1 min-w-0">
                  {adminName && (
                    <p className="font-semibold text-[hsl(var(--foreground))]">{adminName}</p>
                  )}
                  {c.admin?.email && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{c.admin.email}</p>
                  )}
                  {c.admin?.phone && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{c.admin.phone}</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Status summary */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Record Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: "Status",      value: c.status },
                { label: "Admin Email", value: c.admin?.email ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="attend-section-title">{label}</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{value ?? "—"}</span>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}

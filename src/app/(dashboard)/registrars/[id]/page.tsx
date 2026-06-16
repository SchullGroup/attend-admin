"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Building2, Mail, Phone, Hash, Globe,
  CalendarDays, Users, Eye, ClipboardList, MapPin,
  UserCheck, X,
} from "lucide-react";
import {
  useRegistrarDetail,
  useRegistrarRegisters,
  useRegistrarEvents,
  useActivateRegistrar,
  useSuspendRegistrar,
  useRejectRegistrar,
  getRegistrarDisplayName,
  getRegistrarEnrolledAt,
} from "@/api/registrars";
import { Input } from "@/components/ui/input";
import { LogoUpload } from "@/components/custom/logo-upload";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { StatusBadge } from "@/components/custom/status-badge";
import { ModuleBadge } from "@/components/custom/module-badge";
import { DateCell } from "@/components/ui/date-cell";
import { formatDate } from "@/lib/utils";
import { getEventModule, MODULE_COLORS } from "@/lib/event-module";

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  ACTIVE:    { dot: "#16a34a", label: "Active"    },
  SUSPENDED: { dot: "#dc2626", label: "Suspended" },
  PENDING:   { dot: "#f59e0b", label: "Pending"   },
};

export default function RegistrarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const router  = useRouter();

  const { data: registrar, isLoading, isError } = useRegistrarDetail(id);
  const { data: registrarRegisters } = useRegistrarRegisters(id);
  const { data: registrarEvents    } = useRegistrarEvents(id);
  const activateMutation = useActivateRegistrar();
  const suspendMutation  = useSuspendRegistrar();
  const rejectMutation   = useRejectRegistrar();
  const [rejectOpen,  setRejectOpen]  = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (isLoading) return <Loader variant="page" text="Loading registrar…" />;

  if (isError || !registrar) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">Registrar not found</p>
        <Button variant="outline" className="mt-4 gap-2" onClick={() => router.push("/registrars")}>
          <ArrowLeft className="h-4 w-4" /> Back to Registrars
        </Button>
      </div>
    );
  }

  const displayName  = getRegistrarDisplayName(registrar);
  const statusKey    = (registrar.status ?? "PENDING").toUpperCase();
  const statusInfo   = STATUS_DOT[statusKey] ?? STATUS_DOT.PENDING;
  const isActive     = statusKey === "ACTIVE";
  const isSuspended  = statusKey === "SUSPENDED";
  const isPending    = statusKey === "PENDING";

  // Handle both flat fields and nested `representative` object from API
  const rep = (registrar as any).representative ?? {};
  const repName  = registrar.representativeName || registrar.repName || rep?.name || rep?.fullName || "—";
  const repEmail = registrar.contactEmail || registrar.repEmail || rep?.email || rep?.contactEmail || "—";
  const repPhone = registrar.representativePhone || registrar.phone || rep?.phone || rep?.phoneNumber || "—";

  // Use embedded arrays first; fall back to dedicated sub-resource calls
  const registers = (registrar.registers?.length ? registrar.registers : null)
    ?? (registrar as any).organisations
    ?? (registrar as any).registeredOrgs
    ?? registrarRegisters
    ?? [];
  const events = (registrar.events?.length ? registrar.events : null)
    ?? (registrar as any).managedEvents
    ?? (registrar as any).associatedEvents
    ?? registrarEvents
    ?? [];

  const initials = displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-6">

      {/* ── Back nav ── */}
      <button onClick={() => router.push("/registrars")}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors w-fit">
        <ArrowLeft className="h-3.5 w-3.5" /> All Registrars
      </button>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <LogoUpload
            registrarId={id}
            currentLogoUrl={registrar.logoUrl}
            initials={initials}
          />
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{displayName}</h1>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusInfo.dot }} />
                <span className="text-sm text-[hsl(var(--muted-foreground))]">{statusInfo.label}</span>
              </div>
              {registrar.plan && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] capitalize">
                  {registrar.plan}
                </span>
              )}
              {registrar.industry && (
                <span className="text-sm text-[hsl(var(--muted-foreground))]">· {registrar.industry}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPending && (
            <Button variant="outline" size="sm"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => { setRejectOpen(true); setRejectReason(""); }}>
              <X className="h-3.5 w-3.5" /> Reject
            </Button>
          )}
          {isActive && (
            <Button variant="outline" size="sm"
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
              disabled={suspendMutation.isPending}
              onClick={() => suspendMutation.mutate(id)}>
              Suspend
            </Button>
          )}
          {isSuspended && (
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              disabled={activateMutation.isPending}
              onClick={() => activateMutation.mutate(id)}>
              Activate
            </Button>
          )}
        </div>
      </div>  {/* end header flex */}

      {/* ── Reject modal ── */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[hsl(var(--card))] rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">Reject Registrar</h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
              A rejection notice will be sent to the representative. Provide a reason below (optional).
            </p>
            <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] mb-1.5">Reason</label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Incomplete documentation"
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(
                  { id, reason: rejectReason.trim() || undefined },
                  { onSuccess: () => { setRejectOpen(false); router.push("/registrars"); } }
                )}
              >
                {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Left: details */}
        <div className="col-span-1 flex flex-col gap-4">

          {/* Organisation info */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Organisation</h2>
            <div className="flex flex-col gap-3">
              {([
                { icon: Hash,      label: "RC Number", value: registrar.rcNumber ?? "—"  },
                { icon: Globe,     label: "Industry",  value: registrar.industry  ?? "—" },
                { icon: Building2, label: "Plan",      value: registrar.plan      ?? "—" },
                { icon: MapPin,    label: "Address",   value: (registrar as any).address  ?? null },
                { icon: Globe,     label: "Website",   value: (registrar as any).website  ?? null },
              ] as { icon: React.ElementType; label: string; value: string | null }[]).filter((f) => f.value).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">{label}</p>
                    <p className="text-sm text-[hsl(var(--foreground))] mt-0.5">{value}</p>
                  </div>
                </div>
              ))}

              {/* Enrolled date — DateCell handles formatting + null fallback */}
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarDays className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Enrolled</p>
                  <p className="text-sm text-[hsl(var(--foreground))] mt-0.5">
                    {getRegistrarEnrolledAt(registrar)
                      ? <DateCell value={getRegistrarEnrolledAt(registrar)} />
                      : <span className="text-[hsl(var(--muted-foreground))]">—</span>
                    }
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Representative info */}
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">Representative</h2>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))] shrink-0">
                  {repName !== "—" ? repName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                </div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{repName}</p>
              </div>
              {[
                { icon: Mail,  value: repEmail, label: "email" },
                { icon: Phone, value: repPhone, label: "phone" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-sm text-[hsl(var(--muted-foreground))]">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Registers", value: registrar.registersCount ?? registers.length, icon: ClipboardList, color: "#374151" },
              { label: "Events",    value: registrar.eventsCount    ?? events.length,    icon: CalendarDays,  color: "#374151" },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label} className="attend-card p-4 text-center">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: color + "15" }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <p className="text-xl font-bold tabular-nums text-[hsl(var(--foreground))]">{value}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{label}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: registers + events */}
        <div className="col-span-2 flex flex-col gap-5">

          {/* Registers */}
          <Card className="attend-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Registers</h2>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{registers.length} total</span>
            </div>
            {registers.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))] opacity-30" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No registers enrolled yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="attend-table-header">
                    <th className="px-5 py-3 text-left">Organisation</th>
                    <th className="px-5 py-3 text-left">Industry</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Events</th>
                    <th className="px-5 py-3 text-left">Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {(registers as any[]).map((reg) => (
                    <tr key={reg.id} className="attend-table-row">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{reg.name}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                        {reg.industry ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={(reg.status ?? "").toLowerCase()} />
                      </td>
                      <td className="px-5 py-3 text-sm font-medium tabular-nums text-center">
                        {reg.eventCount ?? 0}
                      </td>
                      <td className="px-5 py-3">
                        <DateCell value={reg.enrolledAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* ── Admin User card ── */}
          {(registrar as any).adminUser && (() => {
            const au = (registrar as any).adminUser;
            const auName = au.fullName || au.name || au.email;
            return (
              <Card className="attend-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <UserCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <h2 className="font-semibold text-[hsl(var(--foreground))]">Admin Account</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-sm font-bold text-[hsl(var(--primary))] shrink-0">
                    {auName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{auName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{au.email}</p>
                    {au.role && <p className="text-xs text-[hsl(var(--muted-foreground))] capitalize">{au.role.toLowerCase().replace(/_/g, " ")}</p>}
                  </div>
                  {au.status && (
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        backgroundColor: au.status === "ACTIVE" ? "#16a34a18" : "#6b728018",
                        color: au.status === "ACTIVE" ? "#16a34a" : "#6b7280",
                      }}>
                      {au.status}
                    </span>
                  )}
                </div>
              </Card>
            );
          })()}

          {/* ── Team members ── */}
          {Array.isArray((registrar as any).team) && (registrar as any).team.length > 0 && (
            <Card className="attend-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Team</h2>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{(registrar as any).team.length} members</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="attend-table-header">
                    <th className="px-5 py-3 text-left">Name</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">Role</th>
                    <th className="px-5 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(registrar as any).team.map((member: any) => (
                    <tr key={member.id} className="attend-table-row">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center text-xs font-bold text-[hsl(var(--muted-foreground))] shrink-0">
                            {(member.fullName || member.email).slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]">{member.fullName || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{member.email}</td>
                      <td className="px-5 py-3">
                        {member.role
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] capitalize">{member.role.toLowerCase().replace(/_/g, " ")}</span>
                          : <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>
                        }
                      </td>
                      <td className="px-5 py-3">
                        {member.status && (
                          <span className="text-xs font-semibold"
                            style={{ color: member.status === "ACTIVE" ? "#16a34a" : "#6b7280" }}>
                            {member.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Events */}
          <Card className="attend-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border)/0.6)]">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Events</h2>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{events.length} total</span>
            </div>
            {events.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--muted-foreground))] opacity-30" />
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No events created yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="attend-table-header">
                    <th className="px-5 py-3 text-left">Event</th>
                    <th className="px-5 py-3 text-left">Format</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">RSVPs</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {(events as any[]).map((evt) => {
                    const mod      = getEventModule({ eventType: evt.eventType });
                    const dotColor = MODULE_COLORS[mod];
                    return (
                      <tr key={evt.id} className="attend-table-row">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: dotColor }} />
                            <div>
                              <ModuleBadge module={mod} />
                              <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5 truncate max-w-[200px]">
                                {evt.title}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                          {evt.format
                            ? <span className="capitalize text-xs">{evt.format.toLowerCase().replace(/_/g, " ")}</span>
                            : "—"
                          }
                        </td>
                        <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                          {formatDate(evt.date)}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium tabular-nums">
                          {(evt.registrationCount ?? 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={(evt.status ?? "").toLowerCase()} />
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/events/${evt.id}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <Eye className="h-3 w-3" /> View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

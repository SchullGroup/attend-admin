"use client";

import { useState } from "react";
import {
  Users, UserPlus, Trash2, Loader2, Hash, Mail, Phone, X, Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useExpectedAttendees,
  useUploadExpectedAttendees,
  useDeleteExpectedAttendee,
  useDeleteAllExpectedAttendees,
  type ExpectedAttendee,
} from "@/api/client-events";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddForm {
  firstName:      string;
  lastName:       string;
  email:          string;
  phone:          string;
  shareholderRef: string;
}

const EMPTY_FORM: AddForm = {
  firstName: "", lastName: "", email: "", phone: "", shareholderRef: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function displayName(a: ExpectedAttendee): string {
  if (a.firstName || a.lastName) return `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
  return a.fullName ?? "—";
}

function initials(a: ExpectedAttendee): string {
  const n = displayName(a);
  return n === "—" ? "?" : n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="attend-table-row">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--muted))] animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-[hsl(var(--muted))] animate-pulse" />
            <div className="h-3 w-44 rounded bg-[hsl(var(--muted))] animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5"><div className="h-3.5 w-24 rounded bg-[hsl(var(--muted))] animate-pulse" /></td>
      <td className="px-5 py-3.5"><div className="h-3.5 w-28 rounded bg-[hsl(var(--muted))] animate-pulse" /></td>
      <td className="px-5 py-3.5"><div className="h-7 w-16 rounded-lg bg-[hsl(var(--muted))] animate-pulse" /></td>
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventExpectedAttendeesTab({ eventId }: { eventId: string }) {
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState<AddForm>(EMPTY_FORM);
  const [touched,      setTouched]      = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // ── Queries & mutations ──────────────────────────────────────────────────
  const { data, isLoading } = useExpectedAttendees(eventId);
  const addMutation    = useUploadExpectedAttendees();
  const deleteMutation = useDeleteExpectedAttendee();
  const clearMutation  = useDeleteAllExpectedAttendees();

  const attendees: ExpectedAttendee[] = data?.attendees ?? [];

  // ── Form validation ──────────────────────────────────────────────────────
  const errors = {
    firstName: !form.firstName.trim(),
    lastName:  !form.lastName.trim(),
    email:     !form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function handleChange(field: keyof AddForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAdd() {
    setTouched(true);
    if (hasErrors) return;

    addMutation.mutate(
      {
        eventId,
        payload: {
          attendees: [{
            firstName:      form.firstName.trim(),
            lastName:       form.lastName.trim(),
            email:          form.email.trim().toLowerCase(),
            phone:          form.phone.trim() || undefined,
            shareholderRef: form.shareholderRef.trim() || undefined,
          }],
        },
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setTouched(false);
          setShowForm(false);
        },
      }
    );
  }

  function handleDelete(attendeeId: string) {
    deleteMutation.mutate({ eventId, attendeeId });
  }

  function handleClearAll() {
    if (!confirmClear) { setConfirmClear(true); return; }
    clearMutation.mutate(eventId, { onSuccess: () => setConfirmClear(false) });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header card with stat + actions ── */}
      <Card className="attend-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.08)] flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Expected Attendees</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {isLoading
                  ? "Loading…"
                  : `${attendees.length} shareholder${attendees.length !== 1 ? "s" : ""} on the expected list`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clear all — double-confirm */}
            {attendees.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 text-xs text-red-600 bg-red-50 font-semibold"
                    disabled={clearMutation.isPending}
                    onClick={handleClearAll}
                  >
                    {clearMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm clear all?"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm" variant="ghost"
                  className="h-7 text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50"
                  onClick={() => setConfirmClear(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear all
                </Button>
              )
            )}

            {/* Add attendee toggle */}
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => { setShowForm((p) => !p); setTouched(false); setForm(EMPTY_FORM); }}
            >
              {showForm
                ? <><X className="h-3.5 w-3.5" /> Cancel</>
                : <><UserPlus className="h-3.5 w-3.5" /> Add Attendee</>
              }
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Inline add form ── */}
      {showForm && (
        <Card className="attend-card p-5">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">New Expected Attendee</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* First Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                placeholder="Ekezie"
                className={cn(touched && errors.firstName && "border-red-400 focus-visible:ring-red-200")}
              />
              {touched && errors.firstName && (
                <p className="text-xs text-red-500">First name is required</p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                placeholder="Chinonyerem"
                className={cn(touched && errors.lastName && "border-red-400 focus-visible:ring-red-200")}
              />
              {touched && errors.lastName && (
                <p className="text-xs text-red-500">Last name is required</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="shareholder@company.ng"
                  className={cn("pl-9", touched && errors.email && "border-red-400 focus-visible:ring-red-200")}
                />
              </div>
              {touched && errors.email && (
                <p className="text-xs text-red-500">Valid email is required</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Phone <span className="text-[hsl(var(--muted-foreground))] normal-case font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="08012345678"
                  className="pl-9"
                />
              </div>
            </div>

            {/* Shareholder Ref — full width */}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Shareholder Reference <span className="text-[hsl(var(--muted-foreground))] normal-case font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  value={form.shareholderRef}
                  onChange={(e) => handleChange("shareholderRef", e.target.value)}
                  placeholder="ZNB/2024/005678"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[hsl(var(--border))]">
            <Button
              variant="outline" size="sm"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setTouched(false); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={addMutation.isPending}
              onClick={handleAdd}
              className="gap-1.5"
            >
              {addMutation.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</>
                : <><Check className="h-3.5 w-3.5" /> Add to List</>
              }
            </Button>
          </div>
        </Card>
      )}

      {/* ── Attendees table ── */}
      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Shareholder</th>
              <th className="px-5 py-3 text-left">Phone</th>
              <th className="px-5 py-3 text-left">Shareholder Ref</th>
              <th className="px-5 py-3 text-left w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
              : attendees.length === 0
                ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-14 text-center">
                      <Users className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-25" />
                      <p className="text-sm font-medium text-[hsl(var(--foreground))]">No expected attendees yet</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                        Add shareholders who are expected to attend this AGM.
                      </p>
                    </td>
                  </tr>
                )
                : attendees.map((a) => (
                  <tr key={a.id} className="attend-table-row">

                    {/* Name + email */}
                    <td className="px-5 py-3 max-w-[220px]">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))] shrink-0">
                          {initials(a)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate" title={displayName(a)}>
                            {displayName(a)}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate" title={a.email}>
                            {a.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                      {a.phone || <span className="italic">—</span>}
                    </td>

                    {/* Shareholder ref */}
                    <td className="px-5 py-3">
                      {a.shareholderRef
                        ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-[hsl(var(--foreground))] bg-[hsl(var(--muted))] px-2 py-0.5 rounded-md">
                            <Hash className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                            {a.shareholderRef}
                          </span>
                        )
                        : <span className="italic text-sm text-[hsl(var(--muted-foreground))]">—</span>
                      }
                    </td>

                    {/* Delete */}
                    <td className="px-5 py-3">
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(a.id)}
                        title="Remove from list"
                      >
                        {deleteMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </Button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </Card>
    </div>
  );
}

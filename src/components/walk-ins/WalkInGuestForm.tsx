"use client";

/**
 * Regulator / guest details captured at the gate. Used to check a guest in
 * (QR Check-In → Walk-in) and to correct one later (Attendees → Walk-in guests).
 * The PUT that corrects a guest replaces every field, so this always submits
 * the whole form.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { PhoneInput, phoneError, normalizePhone } from "@/components/ui/phone-input";
import { GUEST_CATEGORIES, type GuestCategory, type WalkInGuestInput } from "@/api/client-walk-ins";

const EMPTY: WalkInGuestInput = { fullName: "", category: "REGULATOR", organisation: "", designation: "", phone: "", email: "", notes: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<keyof WalkInGuestInput, string>>;

function validate(f: WalkInGuestInput): Errors {
  const e: Errors = {};
  if (!f.fullName.trim())     e.fullName = "Full name is required.";
  if (!f.organisation.trim()) e.organisation = "Organisation is required.";
  if (f.email?.trim() && !EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address.";
  const pe = f.phone ? phoneError(f.phone) : null;
  if (pe) e.phone = pe;
  if ((f.notes ?? "").length > 1000) e.notes = "Notes can be up to 1,000 characters.";
  return e;
}

const labelCls = "text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]";
const errCls   = "text-xs text-[hsl(var(--destructive))]";
const badCls   = "border-[hsl(var(--destructive))] focus-visible:ring-[hsl(var(--destructive))]";

export function WalkInGuestForm({
  initial, submitLabel, busy, onSubmit, onCancel, serverErrors,
}: {
  initial?: Partial<WalkInGuestInput>;
  submitLabel: string;
  busy?: boolean;
  /** Called with the whole form once it validates. To clear it after a save, re-mount with a new `key`. */
  onSubmit: (body: WalkInGuestInput) => void;
  onCancel?: () => void;
  serverErrors?: Errors;
}) {
  const [form, setForm] = useState<WalkInGuestInput>({
    ...EMPTY,
    ...initial,
    phone: normalizePhone(initial?.phone ?? ""),
  });
  const [tried, setTried] = useState(false);
  const errors: Errors = { ...(tried ? validate(form) : {}), ...(serverErrors ?? {}) };
  const set = <K extends keyof WalkInGuestInput>(k: K, v: WalkInGuestInput[K]) => setForm((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(validate(form)).length) return;
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="wg-name" className={labelCls}>Full name *</Label>
          <Input id="wg-name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} disabled={busy}
            autoComplete="off" className={errors.fullName ? badCls : undefined} />
          {errors.fullName && <p className={errCls}>{errors.fullName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wg-cat" className={labelCls}>Category *</Label>
          <NativeSelect id="wg-cat" value={form.category} onChange={(e) => set("category", e.target.value as GuestCategory)}
            disabled={busy} wrapperClassName="w-full">
            {GUEST_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wg-org" className={labelCls}>Organisation *</Label>
          <Input id="wg-org" value={form.organisation} onChange={(e) => set("organisation", e.target.value)} disabled={busy}
            placeholder="e.g. Securities and Exchange Commission" autoComplete="off" className={errors.organisation ? badCls : undefined} />
          {errors.organisation && <p className={errCls}>{errors.organisation}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wg-desig" className={labelCls}>Designation</Label>
          <Input id="wg-desig" value={form.designation ?? ""} onChange={(e) => set("designation", e.target.value)} disabled={busy}
            placeholder="e.g. Director, Market Supervision" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wg-phone" className={labelCls}>Phone</Label>
          <PhoneInput id="wg-phone" value={form.phone ?? ""} onChange={(v) => set("phone", v)} disabled={busy} invalid={!!errors.phone} />
          {errors.phone && <p className={errCls}>{errors.phone}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wg-email" className={labelCls}>Email</Label>
          <Input id="wg-email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} disabled={busy}
            autoComplete="off" className={errors.email ? badCls : undefined} />
          {errors.email && <p className={errCls}>{errors.email}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="wg-notes" className={labelCls}>Notes</Label>
          <textarea id="wg-notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} disabled={busy}
            rows={2} maxLength={1000}
            className="w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]" />
          {errors.notes && <p className={errCls}>{errors.notes}</p>}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>}
        <Button type="submit" size="sm" disabled={busy} className="gap-2">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export const EMPTY_WALK_IN_GUEST = EMPTY;

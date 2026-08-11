"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { useUpdateRegister, type UpdateRegisterPayload } from "@/api/registers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientRegisterDetailResponse } from "@/types/super-admin";

type FormState = Record<
  "name" | "email" | "rcNumber" | "industry" | "representativeName" |
  "representativePhone" | "website" | "address",
  string
>;

function toForm(register: ClientRegisterDetailResponse): FormState {
  return {
    name: register.name ?? "",
    email: register.email ?? "",
    rcNumber: register.rcNumber ?? "",
    industry: register.industry ?? "",
    representativeName: register.representativeName ?? "",
    representativePhone: register.representativePhone ?? "",
    website: register.website ?? "",
    address: register.address ?? "",
  };
}

export function RegisterDetailsEditor({
  register,
  canEdit,
}: {
  register: ClientRegisterDetailResponse;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => toForm(register));
  const updateRegister = useUpdateRegister();

  useEffect(() => setForm(toForm(register)), [register]);

  if (!canEdit) return null;

  const requiredMissing = !form.name.trim() || !form.email.trim();

  function setField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requiredMissing) return;

    const optional = (value: string) => value.trim() || null;
    const updates: UpdateRegisterPayload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      rcNumber: optional(form.rcNumber),
      industry: optional(form.industry),
      representativeName: optional(form.representativeName),
      representativePhone: optional(form.representativePhone),
      website: optional(form.website),
      address: optional(form.address),
    };

    updateRegister.mutate(
      { registerId: register.id, updates },
      { onSuccess: () => setOpen(false) }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) setForm(toForm(register));
    }}>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit details
      </Button>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit register details</DialogTitle>
            <DialogDescription>
              Empty optional fields will be cleared when you save.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Register name" required value={form.name} onChange={(value) => setField("name", value)} />
            <Field label="Email" type="email" required value={form.email} onChange={(value) => setField("email", value)} />
            <Field label="RC number" value={form.rcNumber} onChange={(value) => setField("rcNumber", value)} />
            <Field label="Industry" value={form.industry} onChange={(value) => setField("industry", value)} />
            <Field label="Representative" value={form.representativeName} onChange={(value) => setField("representativeName", value)} />
            <Field label="Representative phone" type="tel" value={form.representativePhone} onChange={(value) => setField("representativePhone", value)} />
            <Field label="Website" type="url" placeholder="https://example.com" value={form.website} onChange={(value) => setField("website", value)} />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="register-address">Address</Label>
              <textarea
                id="register-address"
                value={form.address}
                onChange={(event) => setField("address", event.target.value)}
                rows={3}
                className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ring))]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={updateRegister.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={requiredMissing || updateRegister.isPending} className="gap-1.5">
              {updateRegister.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
}) {
  const id = `register-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input
        id={id}
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
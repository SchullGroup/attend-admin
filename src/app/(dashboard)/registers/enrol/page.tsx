"use client";

/**
 * /admin/registers/enrol — Enrol New Register
 *
 * Enrollment : POST /api/v1/client/registers/enroll
 *   body: { name, email, rcNumber?, industry?, representativeName?, representativePhone? }
 *
 * Pending queue: GET /api/v1/client/registers?status=PENDING
 *   Actions: POST /api/v1/client/registers/{id}/approve
 *            POST /api/v1/client/registers/{id}/reject  body: { reason? }
 */

import { useState } from "react";
import {
  useRegisters,
  useEnrollRegister,
  useApproveRegister,
  useRejectRegister,
  type EnrollRegisterPayload,
} from "@/api/registers";
import type { RegisterItem } from "@/types/super-admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomSelect } from "@/components/custom/custom-select";
import { Loader } from "@/components/ui/Loader";
import { DateCell } from "@/components/ui/date-cell";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn, digitsOnly, withIdPrefix } from "@/lib/utils";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  "Banking & Finance", "Insurance", "Oil & Gas", "FMCG", "Telecommunications",
  "Technology / Fintech", "Healthcare", "Real Estate", "Manufacturing", "Agriculture",
  "Financial Services", "Education", "Other",
];

// ─── Form state — matches swagger enroll body exactly ─────────────────────────

interface EnrolForm {
  name:                string;   // → name          (required)
  email:               string;   // → email         (required)
  rcNumber:            string;   // → rcNumber      (nullable — send null if blank)
  industry:            string;   // → industry      (nullable — send null if blank)
  representativeName:  string;   // → representativeName  (optional)
  representativePhone: string;   // → representativePhone (optional)
}

const EMPTY_FORM: EnrolForm = {
  name: "", email: "", rcNumber: "", industry: "",
  representativeName: "", representativePhone: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fieldClass(error: boolean) {
  return cn(
    "h-9 w-full rounded-lg border bg-[hsl(var(--background))] px-3 text-sm",
    "text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 transition-shadow",
    error
      ? "border-red-400 focus:ring-red-200 bg-red-50/10"
      : "border-[hsl(var(--border))] focus:ring-[hsl(var(--ring))]"
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnrolRegisterPage() {

  // ── Hooks ─────────────────────────────────────────────────────────────────
  // Pending queue — filter the directory by PENDING status
  const { data: pendingData, isLoading: pendingLoading } = useRegisters("PENDING", 0, 50);
  const enrollMutation  = useEnrollRegister();
  const approveMutation = useApproveRegister();
  const rejectMutation  = useRejectRegister();

  const pending: RegisterItem[] = pendingData?.registers ?? [];

  // ── Local state ───────────────────────────────────────────────────────────
  const [form,         setForm]         = useState<EnrolForm>(EMPTY_FORM);
  const [showErrors,   setShowErrors]   = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    id: string; name: string; action: "approve" | "reject";
  } | null>(null);

  // ── Validation ────────────────────────────────────────────────────────────
  const errors = {
    name:  !form.name.trim(),
    email: !form.email.trim(),
  };
  const hasErrors = errors.name || errors.email;

  function handleChange<K extends keyof EnrolForm>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ── Enroll submit ─────────────────────────────────────────────────────────
  function handleEnrol() {
    if (hasErrors) {
      setShowErrors(true);
      toast.error("Complete all required fields (*) before submitting.");
      return;
    }

    const payload: EnrollRegisterPayload = {
      name:                form.name.trim(),
      email:               form.email.trim(),
      // form.rcNumber is digits-only from the input — "RC" is prefixed here
      // so it always saves consistently no matter how it was typed.
      // form.representativePhone is already a full E.164 string from
      // PhoneInput.
      rcNumber:            withIdPrefix("RC", form.rcNumber, { space: true }) || null,
      industry:            form.industry                   || null,
      representativeName:  form.representativeName.trim()  || undefined,
      representativePhone: form.representativePhone         || undefined,
    };

    enrollMutation.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setShowErrors(false);
      },
    });
  }

  // ── Approve / Reject ──────────────────────────────────────────────────────
  function handleApprove(id: string) {
    approveMutation.mutate(id, { onSuccess: () => setPendingConfirm(null) });
  }

  function handleReject(id: string) {
    rejectMutation.mutate({ id }, { onSuccess: () => setPendingConfirm(null) });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Enrol New Register</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Add an organisation. It starts in PENDING status — approve it before creating events.
        </p>
      </div>

      {/* ── Enrolment form ── */}
      <Card className="attend-card p-6">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-5">Organisation Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* name — required */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Organisation Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Zenith Bank Plc"
              className={fieldClass(showErrors && errors.name)}
            />
            {showErrors && errors.name && (
              <p className="text-xs text-red-500">Name is required.</p>
            )}
          </div>

          {/* email — required */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Organisation Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="e.g. ir@company.com"
              className={fieldClass(showErrors && errors.email)}
            />
            {showErrors && errors.email && (
              <p className="text-xs text-red-500">Email is required.</p>
            )}
          </div>

          {/* industry — optional, nullable */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Industry</label>
            <CustomSelect
              value={form.industry}
              onChange={(v) => handleChange("industry", v)}
              placeholder="Select industry… (optional)"
              options={INDUSTRY_OPTIONS.map((i) => ({ label: i, value: i }))}
            />
          </div>

          {/* rcNumber — optional, nullable. Numbers only; "RC" is added
              automatically on submit so it always saves consistently. */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">RC Number</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[hsl(var(--muted-foreground))] pointer-events-none">
                RC
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={form.rcNumber}
                onChange={(e) => handleChange("rcNumber", digitsOnly(e.target.value))}
                placeholder="125384 (optional)"
                className={cn(fieldClass(false), "pl-9")}
              />
            </div>
          </div>

          {/* representativeName — optional */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Representative Name
            </label>
            <input
              type="text"
              value={form.representativeName}
              onChange={(e) => handleChange("representativeName", e.target.value)}
              placeholder="e.g. Dr. Adaeze Okonkwo (optional)"
              className={fieldClass(false)}
            />
          </div>

          {/* representativePhone — optional */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Representative Phone
            </label>
            <PhoneInput
              value={form.representativePhone}
              onChange={(e164) => handleChange("representativePhone", e164)}
            />
          </div>

        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleEnrol} disabled={enrollMutation.isPending}>
            {enrollMutation.isPending ? "Enrolling…" : "Enrol Register"}
          </Button>
        </div>
      </Card>

      {/* ── Pending queue ── */}
      {pendingLoading ? (
        <Loader variant="inline" text="Loading pending requests…" />
      ) : pending.length > 0 ? (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">
              Pending Requests
              <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">
                ({pendingData?.totalCount ?? pending.length})
              </span>
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Register</th>
                <th className="px-5 py-3 text-left">RC Number</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Representative</th>
                <th className="px-5 py-3 text-left">Enrolled</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((reg) => (
                <tr key={reg.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {reg.name || reg.companyName || "—"}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {reg.industry ?? <i>—</i>}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {reg.rcNumber ?? <i>—</i>}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {reg.email ?? <i>—</i>}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {reg.representativeName ?? <i>—</i>}
                  </td>
                  <td className="px-5 py-3">
                    {reg.enrolledAt
                      ? <DateCell value={reg.enrolledAt} />
                      : <i className="text-xs text-[hsl(var(--muted-foreground))]">—</i>}
                  </td>
                  <td className="px-5 py-3">
                    {pendingConfirm?.id === reg.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[hsl(var(--muted-foreground))] mr-1">
                          {pendingConfirm.action === "approve" ? "Approve?" : "Reject?"}
                        </span>
                        <Button
                          size="sm"
                          className={cn(
                            "h-7 text-xs",
                            pendingConfirm.action === "reject" && "bg-red-600 hover:bg-red-700 text-white"
                          )}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          onClick={() =>
                            pendingConfirm.action === "approve"
                              ? handleApprove(reg.id)
                              : handleReject(reg.id)
                          }
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setPendingConfirm(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm" className="h-7 text-xs"
                          onClick={() => setPendingConfirm({ id: reg.id, name: reg.name || "—", action: "approve" })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setPendingConfirm({ id: reg.id, name: reg.name || "—", action: "reject" })}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        !pendingLoading && (
          <Card className="attend-card p-10 text-center">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No pending enrolment requests.</p>
          </Card>
        )
      )}
    </div>
  );
}

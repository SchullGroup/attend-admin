"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEnrollRegistrar } from "@/api/registrars";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomSelect } from "@/components/custom/custom-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { cn, digitsOnly, withIdPrefix } from "@/lib/utils";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const PLAN_OPTIONS = [
  { label: "Starter",    value: "STARTER"    },
  { label: "Growth",     value: "GROWTH"     },
  { label: "Enterprise", value: "ENTERPRISE" },
];

const INDUSTRY_OPTIONS = [
  "Financial Services", "Banking & Finance", "Insurance", "Oil & Gas", "FMCG",
  "Telecommunications", "Technology / Fintech", "Healthcare", "Real Estate",
  "Manufacturing", "Agriculture", "Education", "Other",
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface EnrolForm {
  name:     string;  // → companyName
  industry: string;
  rcNumber: string;
  plan:     string;  // → plan
  address:  string;
  website:  string;
  repName:  string;  // → representativeName
  repEmail: string;  // → contactEmail
  repPhone: string;  // → representativePhone
  password: string;
}

const EMPTY_FORM: EnrolForm = {
  name: "", industry: "", rcNumber: "", plan: "STARTER",
  address: "", website: "",
  repName: "", repEmail: "", repPhone: "", password: "",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function fieldClass(error: boolean) {
  return cn(
    "h-9 rounded-lg border bg-[hsl(var(--background))] px-3 text-sm w-full",
    "text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 transition-shadow",
    error
      ? "border-red-400 focus:ring-red-200 bg-red-50/10"
      : "border-[hsl(var(--border))] focus:ring-[hsl(var(--ring))]"
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EnrolRegistrarPage() {
  const router = useRouter();
  const enrollMutation = useEnrollRegistrar();

  const [form, setForm]             = useState<EnrolForm>(EMPTY_FORM);
  const [showPassword, setShowPass] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Validation
  const errors = {
    name:     !form.name.trim(),
    repName:  !form.repName.trim(),
    repEmail: !form.repEmail.trim(),
    password: !form.password.trim(),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function handleChange(field: keyof EnrolForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    if (hasErrors) {
      setShowErrors(true);
      toast.error("Gating Restriction: Complete all mandatory fields marked (*) to unlock the next view step.");
      return;
    }

    enrollMutation.mutate(
      {
        companyName:         form.name.trim(),
        representativeName:  form.repName.trim(),
        representativeEmail: form.repEmail.trim(),
        representativePhone: form.repPhone || undefined,
        password:            form.password.trim(),
        plan:                form.plan,
        // Digits-only from the input — "RC" prefixed here so it always
        // saves consistently no matter how it was typed.
        rcNumber:            withIdPrefix("RC", form.rcNumber) || null,
        industry:            form.industry        || null,
        address:             form.address.trim()  || null,
        website:             form.website.trim()  || null,
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setShowErrors(false);
          router.push("/registrars");
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Enrol Registrar</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Add a new platform operator that can create and manage registers and events.
        </p>
      </div>

      <Card className="attend-card p-6 space-y-5">

        {/* Company information */}
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Company Information</h2>
          <div className="grid grid-cols-2 gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g. DataPort Registrars Ltd"
                className={fieldClass(showErrors && errors.name)}
              />
              {showErrors && errors.name && <p className="text-xs text-red-500">Company name is required.</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Industry</label>
              <CustomSelect
                value={form.industry}
                onChange={(v) => handleChange("industry", v)}
                placeholder="Select industry…"
                options={INDUSTRY_OPTIONS.map((i) => ({ label: i, value: i }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Plan <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={form.plan}
                onChange={(v) => handleChange("plan", v)}
                placeholder="Select plan…"
                options={PLAN_OPTIONS}
              />
            </div>

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
                  placeholder="287640"
                  className={cn(fieldClass(false), "pl-9")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Website</label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="e.g. https://dataport.ng"
                className={fieldClass(false)}
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="e.g. 12 Marina Road, Lagos"
                className={fieldClass(false)}
              />
            </div>

          </div>
        </div>

        {/* Representative details */}
        <div className="border-t border-[hsl(var(--border))] pt-5">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Representative Details</h2>
          <div className="grid grid-cols-2 gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Representative Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.repName}
                onChange={(e) => handleChange("repName", e.target.value)}
                placeholder="e.g. Adaeze Okonkwo"
                className={fieldClass(showErrors && errors.repName)}
              />
              {showErrors && errors.repName && <p className="text-xs text-red-500">Representative name is required.</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Representative Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                autoComplete="off"
                value={form.repEmail}
                onChange={(e) => handleChange("repEmail", e.target.value)}
                placeholder="e.g. adaeze@dataport.ng"
                className={fieldClass(showErrors && errors.repEmail)}
              />
              {showErrors && errors.repEmail && <p className="text-xs text-red-500">Email is required.</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Representative Phone</label>
              <PhoneInput
                value={form.repPhone}
                onChange={(e164) => handleChange("repPhone", e164)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="Set initial password"
                  className={cn(fieldClass(showErrors && errors.password), "pr-9")}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {showErrors && errors.password && <p className="text-xs text-red-500">Password is required.</p>}
            </div>

          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setForm(EMPTY_FORM); setShowErrors(false); }}>
            Clear
          </Button>
          <Button onClick={handleSubmit} disabled={enrollMutation.isPending}>
            {enrollMutation.isPending ? "Sending…" : "Send Invitation"}
          </Button>
        </div>

      </Card>
    </div>
  );
}

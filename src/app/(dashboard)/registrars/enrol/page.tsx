"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CustomSelect } from "@/components/custom/custom-select";
import { Eye, EyeOff } from "lucide-react";

const INDUSTRY_OPTIONS = [
  "Financial Services","Banking & Finance","Insurance","Oil & Gas","FMCG",
  "Telecommunications","Technology / Fintech","Healthcare","Real Estate",
  "Manufacturing","Agriculture","Education","Other",
];

export default function EnrolRegistrarPage() {
  const [form, setForm] = useState({
    name: "", industry: "", rcNumber: "",
    repName: "", repEmail: "", repPhone: "", password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.rcNumber.trim() || !form.repName.trim() || !form.repEmail.trim() || !form.password.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    toast.success(`Invitation sent to ${form.name}`, {
      description: `${form.repName} will receive login credentials at ${form.repEmail}.`,
    });
    setForm({ name: "", industry: "", rcNumber: "", repName: "", repEmail: "", repPhone: "", password: "" });
  }

  const inputClass = "h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow w-full";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Enrol Registrar</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Add a new platform operator that can create and manage registers and events</p>
      </div>

      <Card className="attend-card p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Company Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Company Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="e.g. DataPort Registrars Ltd" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Industry</label>
              <CustomSelect value={form.industry} onChange={(v) => handleChange("industry", v)} placeholder="Select industry…" options={INDUSTRY_OPTIONS.map((i) => ({ label: i, value: i }))} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">RC Number <span className="text-red-500">*</span></label>
              <input type="text" value={form.rcNumber} onChange={(e) => handleChange("rcNumber", e.target.value)} placeholder="e.g. RC 287640" className={inputClass} />
            </div>
          </div>
        </div>

        <div className="border-t border-[hsl(var(--border))] pt-5">
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-3">Representative Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Representative Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.repName} onChange={(e) => handleChange("repName", e.target.value)} placeholder="e.g. Adaeze Okonkwo" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Representative Email <span className="text-red-500">*</span></label>
              <input type="email" value={form.repEmail} onChange={(e) => handleChange("repEmail", e.target.value)} placeholder="e.g. adaeze@dataport.ng" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Representative Phone</label>
              <input type="tel" value={form.repPhone} onChange={(e) => handleChange("repPhone", e.target.value)} placeholder="e.g. 08023456789" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => handleChange("password", e.target.value)} placeholder="Set initial password" className={inputClass + " pr-9"} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[hsl(var(--border))] pt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setForm({ name: "", industry: "", rcNumber: "", repName: "", repEmail: "", repPhone: "", password: "" })}>Clear</Button>
          <Button onClick={handleSubmit}>Send Invitation</Button>
        </div>
      </Card>
    </div>
  );
}

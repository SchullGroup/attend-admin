"use client";

import { useState, useRef } from "react";
import {
  Users, UserPlus, Upload, Trash2, Hash, Mail,
  Check, X, FileText, AlertCircle, Loader2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  useRegisterShareholders,
  useAddShareholder,
  useBulkAddShareholders,
  useUpdateShareholder,
  useDeleteShareholder,
  type Shareholder,
  type ShareholderUploadItem,
} from "@/api/registers";
import { cn, digitsOnly, withIdPrefix, resolveRole } from "@/lib/utils";
import { useGetMe } from "@/api/auth/hooks";
import Papa from "papaparse";

// ── CSV row type ──────────────────────────────────────────────────────────────

interface CsvRow {
  fullName:  string;
  email:     string;
  phone?:    string;
  chn?:      string;
  units?:    number;
  status?:   "ACTIVE" | "INACTIVE";
  _error?:   string;
}

// ── CSV auto-mapper ───────────────────────────────────────────────────────────

function nk(k: string) { return k.toLowerCase().replace(/[\s_\-\.]/g, ""); }

function mapCsvRow(raw: Record<string, string>): CsvRow {
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) norm[nk(k)] = (v ?? "").trim();

  // Name — handles "Full Name", "fullname", "name", "First Name"+"Last Name"
  let fullName = norm["fullname"] ?? norm["name"] ?? norm["shareholdername"] ?? "";
  if (!fullName) {
    const first = norm["firstname"] ?? norm["first"] ?? norm["fname"] ?? "";
    const last  = norm["lastname"]  ?? norm["last"]  ?? norm["lname"] ?? norm["surname"] ?? "";
    fullName = [first, last].filter(Boolean).join(" ");
  }

  const email     = norm["email"]    ?? norm["emailaddress"] ?? norm["mail"] ?? "";
  const phoneRaw  = norm["phone"]    ?? norm["phonenumber"]  ?? norm["mobile"] ?? norm["tel"] ?? "";
  const chnRaw    = norm["chn"]      ?? norm["holdernumber"] ?? norm["shareholderno"] ?? norm["ref"] ?? "";
  const unitsRaw  = norm["units"]    ?? norm["shares"]       ?? norm["shareunits"] ?? "";
  const units     = unitsRaw ? Number(unitsRaw.replace(/,/g, "")) : undefined;
  const rawStatus = (norm["status"] ?? "").toUpperCase();
  const status: "ACTIVE" | "INACTIVE" | undefined =
    rawStatus === "INACTIVE" ? "INACTIVE" : rawStatus === "ACTIVE" ? "ACTIVE" : undefined;

  // Whatever a person typed in the CSV — "chn123", "CHN 123", "Chn-123",
  // just "123" — always saves as "CHN123". digitsOnly strips the letters
  // entirely so casing/spelling in the source file can't matter.
  const chn = withIdPrefix("CHN", chnRaw);

  // Phone: always save with an explicit country code. If the CSV value
  // already starts with "+", trust it as-is (person may be entering a
  // non-Nigerian number); otherwise assume Nigeria and prepend +234,
  // stripping a leading 0 (common local format: "0801...").
  const phone = phoneRaw
    ? (phoneRaw.trim().startsWith("+")
        ? `+${digitsOnly(phoneRaw)}`
        : `+234${digitsOnly(phoneRaw).replace(/^0+/, "")}`)
    : "";

  const missingEmail = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const missingName  = !fullName;

  return {
    fullName, email,
    phone:  phone  || undefined,
    chn:    chn    || undefined,
    units:  units  || undefined,
    status: status ?? "ACTIVE",
    _error: missingEmail ? "Invalid email" : missingName ? "Name missing" : undefined,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(s: Shareholder) {
  if (s.fullName) return s.fullName;
  if (s.firstName || s.lastName) return `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
  return "—";
}

function avatarInitials(s: Shareholder) {
  const n = displayName(s);
  return n === "—" ? "?" : n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Add form ──────────────────────────────────────────────────────────────────

interface AddForm {
  fullName: string;
  email:    string;
  phone:    string;
  chn:      string;
  units:    string;
}
const EMPTY_FORM: AddForm = { fullName: "", email: "", phone: "", chn: "", units: "" };

// ── Component ─────────────────────────────────────────────────────────────────

export function RegisterShareholdersSection({ registerId }: { registerId: string }) {
  const { data, isLoading } = useRegisterShareholders(registerId);
  const addOne  = useAddShareholder();
  const bulkAdd = useBulkAddShareholders();
  const update  = useUpdateShareholder();
  const remove  = useDeleteShareholder();

  // Only the organisation's owner (client_admin) may add/upload/edit/delete
  // shareholders — every other team role (Admin, Event Manager, Viewer,
  // Judge) gets read-only access to this list.
  const { data: userResponse } = useGetMe();
  const isClientAdmin = resolveRole(userResponse?.data) === "client_admin";

  const shareholders: Shareholder[] = data?.shareholders ?? [];

  // Manual add form
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState<AddForm>(EMPTY_FORM);
  const [touched,   setTouched]   = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm,  setEditForm]  = useState<AddForm>(EMPTY_FORM);

  function startEdit(s: Shareholder) {
    setEditingId(s.id);
    setEditForm({
      fullName: displayName(s) === "—" ? "" : displayName(s),
      email:    s.email ?? "",
      phone:    s.phone ?? "",
      chn:      digitsOnly(s.chn ?? ""),
      units:    s.units != null ? String(s.units) : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  function saveEdit() {
    if (!editingId) return;
    update.mutate(
      {
        registerId,
        shareholderId: editingId,
        updates: {
          fullName: editForm.fullName.trim(),
          email:    editForm.email.trim().toLowerCase(),
          phone:    editForm.phone || undefined,
          chn:      withIdPrefix("CHN", editForm.chn) || undefined,
          units:    editForm.units ? Number(editForm.units) : undefined,
        },
      },
      { onSuccess: () => cancelEdit() }
    );
  }

  // CSV import
  const [csvRows,        setCsvRows]        = useState<CsvRow[]>([]);
  const [csvFileName,    setCsvFileName]    = useState("");
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [csvImporting,   setCsvImporting]   = useState(false);
  const [replaceAll,     setReplaceAll]     = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  // ── Form validation ────────────────────────────────────────────────────────

  const errors = {
    fullName: !form.fullName.trim(),
    email:    !form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function handleAdd() {
    setTouched(true);
    if (hasErrors) return;
    addOne.mutate(
      {
        registerId,
        shareholder: {
          fullName: form.fullName.trim(),
          email:    form.email.trim().toLowerCase(),
          // form.phone is already a full E.164 string from PhoneInput;
          // form.chn is digits-only from the input — prefix applied here so
          // it always saves as "CHN..." no matter how it was typed.
          phone:    form.phone || undefined,
          chn:      withIdPrefix("CHN", form.chn) || undefined,
          units:    form.units ? Number(form.units) : undefined,
          status:   "ACTIVE",
        },
      },
      { onSuccess: () => { setForm(EMPTY_FORM); setTouched(false); setShowForm(false); } }
    );
  }

  // ── CSV ────────────────────────────────────────────────────────────────────

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        setCsvRows(result.data.map(mapCsvRow));
        setShowCsvPreview(true);
      },
    });
    e.target.value = "";
  }

  function handleCsvImport() {
    const valid = csvRows.filter((r) => !r._error);
    if (!valid.length) return;
    setCsvImporting(true);
    bulkAdd.mutate(
      {
        registerId,
        replace: replaceAll,
        shareholders: valid.map((r) => ({
          fullName: r.fullName,
          email:    r.email.toLowerCase(),
          phone:    r.phone,
          chn:      r.chn,
          units:    r.units,
          status:   r.status ?? "ACTIVE",
        })),
      },
      {
        onSuccess: () => { setCsvRows([]); setCsvFileName(""); setShowCsvPreview(false); setCsvImporting(false); setReplaceAll(false); },
        onError:   () => setCsvImporting(false),
      }
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header card ── */}
      <Card className="attend-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.08)] flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Shareholders</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {isLoading
                  ? "Loading…"
                  : `${data?.totalCount ?? shareholders.length} enrolled · eligible for AGM voting and RSVP`}
              </p>
            </div>
          </div>

          {isClientAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => csvRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload CSV
              </Button>
              <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => { setShowForm((p) => !p); setTouched(false); setForm(EMPTY_FORM); }}
              >
                {showForm ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><UserPlus className="h-3.5 w-3.5" /> Add Manually</>}
              </Button>
            </div>
          )}
        </div>

        {isClientAdmin && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">
            <span className="font-medium">CSV format: Full Name, CHN, Email, Phone, Units, Status</span>
            {" "}· CHN is used for upsert deduplication.
          </p>
        )}
      </Card>

      {/* ── CSV preview ── */}
      {isClientAdmin && showCsvPreview && csvRows.length > 0 && (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[hsl(var(--primary))]" />
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{csvFileName}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {csvRows.filter((r) => !r._error).length} valid · {csvRows.filter((r) => r._error).length} with errors
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={(e) => setReplaceAll(e.target.checked)}
                  className="accent-red-600"
                />
                Replace all existing
              </label>
              <Button
                size="sm" variant="ghost" className="h-7 text-xs text-[hsl(var(--muted-foreground))]"
                onClick={() => { setCsvRows([]); setCsvFileName(""); setShowCsvPreview(false); setReplaceAll(false); }}
              >
                <X className="h-3.5 w-3.5 mr-1" /> Discard
              </Button>
              <Button
                size="sm" className="h-7 gap-1.5 text-xs"
                disabled={csvImporting || csvRows.filter((r) => !r._error).length === 0}
                onClick={handleCsvImport}
              >
                {csvImporting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…</>
                  : <><Check className="h-3.5 w-3.5" /> Import {csvRows.filter((r) => !r._error).length} shareholders</>
                }
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-4 py-2.5 text-left">#</th>
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Email</th>
                  <th className="px-4 py-2.5 text-left">CHN</th>
                  <th className="px-4 py-2.5 text-left">Units</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {csvRows.map((row, i) => (
                  <tr key={i} className={cn("attend-table-row", row._error && "bg-red-50")}>
                    <td className="px-4 py-2.5 text-[hsl(var(--muted-foreground))] tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-[hsl(var(--foreground))]">
                      {row.fullName || <span className="italic text-[hsl(var(--muted-foreground))]">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[hsl(var(--muted-foreground))]">{row.email || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[hsl(var(--muted-foreground))]">{row.chn || "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[hsl(var(--muted-foreground))]">{row.units?.toLocaleString() ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {row._error
                        ? <span className="flex items-center gap-1 text-xs text-red-600 font-semibold"><AlertCircle className="h-3.5 w-3.5" />{row._error}</span>
                        : <span className="flex items-center gap-1 text-xs text-green-600 font-semibold"><Check className="h-3.5 w-3.5" />Ready</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Manual add form ── */}
      {isClientAdmin && showForm && (
        <Card className="attend-card p-5">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Add Shareholder</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Ngozi Okafor"
                className={cn(touched && errors.fullName && "border-red-400 focus-visible:ring-red-200")}
              />
              {touched && errors.fullName && <p className="text-xs text-red-500">Required</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  type="email" value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="shareholder@company.ng"
                  className={cn("pl-9", touched && errors.email && "border-red-400 focus-visible:ring-red-200")}
                />
              </div>
              {touched && errors.email && <p className="text-xs text-red-500">Valid email required</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Phone <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]">(optional)</span>
              </Label>
              <PhoneInput
                value={form.phone}
                onChange={(e164) => setForm((p) => ({ ...p, phone: e164 }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                CHN <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]">(optional)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-9 top-1/2 -translate-y-1/2 text-xs font-semibold text-[hsl(var(--muted-foreground))] pointer-events-none">
                  CHN
                </span>
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  value={form.chn}
                  onChange={(e) => setForm((p) => ({ ...p, chn: digitsOnly(e.target.value) }))}
                  placeholder="123456789" className="pl-16"
                  inputMode="numeric"
                />
              </div>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Numbers only — "CHN" is added automatically.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Units <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]">(optional)</span>
              </Label>
              <Input
                type="number" min={0} value={form.units}
                onChange={(e) => setForm((p) => ({ ...p, units: e.target.value }))}
                placeholder="150000"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[hsl(var(--border))]">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setTouched(false); }}>
              Cancel
            </Button>
            <Button size="sm" disabled={addOne.isPending} onClick={handleAdd} className="gap-1.5">
              {addOne.isPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</>
                : <><Check className="h-3.5 w-3.5" /> Add Shareholder</>
              }
            </Button>
          </div>
        </Card>
      )}

      {/* ── Shareholder table ── */}
      <Card className="attend-card overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading shareholders…</div>
        ) : shareholders.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <Users className="h-9 w-9 text-[hsl(var(--muted-foreground))] opacity-25" />
            <p className="text-sm font-medium text-[hsl(var(--foreground))]">No shareholders enrolled</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Upload a CSV or add shareholders manually.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Shareholder</th>
                <th className="px-5 py-3 text-left hidden sm:table-cell">Phone</th>
                <th className="px-5 py-3 text-left">CHN</th>
                <th className="px-5 py-3 text-right">Units</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {shareholders.map((s) => {
                if (editingId === s.id) {
                  return (
                    <tr key={s.id} className="attend-table-row bg-[hsl(var(--primary)/0.03)]">
                      <td className="px-5 py-3" colSpan={5}>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                          <div className="sm:col-span-1">
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Name</Label>
                            <Input
                              value={editForm.fullName}
                              onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                              className="h-8 text-sm mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Email</Label>
                            <Input
                              type="email" value={editForm.email}
                              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                              className="h-8 text-sm mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Phone</Label>
                            <PhoneInput
                              value={editForm.phone}
                              onChange={(e164) => setEditForm((p) => ({ ...p, phone: e164 }))}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">CHN</Label>
                            <Input
                              value={editForm.chn}
                              onChange={(e) => setEditForm((p) => ({ ...p, chn: digitsOnly(e.target.value) }))}
                              inputMode="numeric"
                              className="h-8 text-sm mt-1 font-mono"
                            />
                          </div>
                          <div className="flex items-end gap-1.5">
                            <div className="flex-1">
                              <Label className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Units</Label>
                              <Input
                                type="number" min={0} value={editForm.units}
                                onChange={(e) => setEditForm((p) => ({ ...p, units: e.target.value }))}
                                className="h-8 text-sm mt-1"
                              />
                            </div>
                            <Button size="sm" className="h-8 px-2" disabled={update.isPending} onClick={saveEdit}>
                              {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 px-2" onClick={cancelEdit}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                <tr key={s.id} className="attend-table-row">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-[hsl(var(--primary)/0.1)] flex items-center justify-center text-xs font-bold text-[hsl(var(--primary))] shrink-0">
                        {avatarInitials(s)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{displayName(s)}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[hsl(var(--muted-foreground))] hidden sm:table-cell">
                    {s.phone || <span className="italic">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {s.chn
                      ? <span className="inline-flex items-center gap-1 text-xs font-mono bg-[hsl(var(--muted))] px-2 py-0.5 rounded-md"><Hash className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />{s.chn}</span>
                      : <span className="italic text-sm text-[hsl(var(--muted-foreground))]">—</span>
                    }
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums text-[hsl(var(--foreground))]">
                    {s.units != null ? s.units.toLocaleString() : <span className="italic text-[hsl(var(--muted-foreground))]">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {isClientAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)]"
                          onClick={() => startEdit(s)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate({ registerId, shareholderId: s.id })}
                        >
                          {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

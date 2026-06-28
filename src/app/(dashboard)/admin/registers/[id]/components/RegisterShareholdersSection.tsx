"use client";

import { useState, useRef } from "react";
import {
  Users, UserPlus, Upload, Trash2, Hash, Mail, Phone,
  Check, X, FileText, AlertCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useRegisterShareholders,
  useAddShareholder,
  useBulkAddShareholders,
  useDeleteShareholder,
  type Shareholder,
} from "@/api/registers";
import { cn } from "@/lib/utils";
import Papa from "papaparse";

// ── CSV row type ──────────────────────────────────────────────────────────────

interface CsvRow {
  firstName: string;
  lastName:  string;
  email:     string;
  phone?:    string;
  chn?:      string;
  units?:    number;
  _error?:   string;
}

// ── CSV auto-mapper ───────────────────────────────────────────────────────────

function nk(k: string) { return k.toLowerCase().replace(/[\s_\-\.]/g, ""); }

function mapCsvRow(raw: Record<string, string>): CsvRow {
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) norm[nk(k)] = (v ?? "").trim();

  // Name — handles "Full Name", "fullname", "name", "First Name"+"Last Name"
  let firstName = norm["firstname"] ?? norm["first"] ?? norm["fname"] ?? "";
  let lastName  = norm["lastname"]  ?? norm["last"]  ?? norm["lname"] ?? norm["surname"] ?? "";
  if (!firstName && !lastName) {
    const full = norm["fullname"] ?? norm["name"] ?? norm["shareholdername"] ?? "";
    if (full) {
      const parts = full.split(/\s+/);
      firstName = parts[0] ?? "";
      lastName  = parts.slice(1).join(" ");
    }
  }

  const email = norm["email"] ?? norm["emailaddress"] ?? norm["mail"] ?? "";
  const phone = norm["phone"] ?? norm["mobile"] ?? norm["tel"] ?? "";
  // CHN = Central Securities Clearing System Holder Number
  const chn   = norm["chn"] ?? norm["holdernumber"] ?? norm["shareholderno"] ?? norm["ref"] ?? "";
  const unitsRaw = norm["units"] ?? norm["shares"] ?? norm["shareunits"] ?? "";
  const units = unitsRaw ? Number(unitsRaw.replace(/,/g, "")) : undefined;

  const missingEmail = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const missingName  = !firstName && !lastName;

  return {
    firstName, lastName, email, phone: phone || undefined,
    chn: chn || undefined, units: units || undefined,
    _error: missingEmail ? "Invalid email" : missingName ? "Name missing" : undefined,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(s: Shareholder) {
  if (s.firstName || s.lastName) return `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim();
  return s.fullName ?? "—";
}

function avatarInitials(s: Shareholder) {
  const n = displayName(s);
  return n === "—" ? "?" : n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Add form ──────────────────────────────────────────────────────────────────

interface AddForm {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
  chn:       string;
  units:     string;
}
const EMPTY_FORM: AddForm = { firstName: "", lastName: "", email: "", phone: "", chn: "", units: "" };

// ── Component ─────────────────────────────────────────────────────────────────

export function RegisterShareholdersSection({ registerId }: { registerId: string }) {
  const { data, isLoading } = useRegisterShareholders(registerId);
  const addOne  = useAddShareholder();
  const bulkAdd = useBulkAddShareholders();
  const remove  = useDeleteShareholder();

  const shareholders: Shareholder[] = data?.shareholders ?? [];

  // Manual add form
  const [showForm,  setShowForm]  = useState(false);
  const [form,      setForm]      = useState<AddForm>(EMPTY_FORM);
  const [touched,   setTouched]   = useState(false);

  // CSV import
  const [csvRows,        setCsvRows]        = useState<CsvRow[]>([]);
  const [csvFileName,    setCsvFileName]    = useState("");
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [csvImporting,   setCsvImporting]   = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);

  // ── Form validation ────────────────────────────────────────────────────────

  const errors = {
    firstName: !form.firstName.trim(),
    lastName:  !form.lastName.trim(),
    email:     !form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function handleAdd() {
    setTouched(true);
    if (hasErrors) return;
    addOne.mutate(
      {
        registerId,
        shareholder: {
          firstName: form.firstName.trim(),
          lastName:  form.lastName.trim(),
          email:     form.email.trim().toLowerCase(),
          phone:     form.phone.trim() || undefined,
          chn:       form.chn.trim()   || undefined,
          units:     form.units ? Number(form.units) : undefined,
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
        shareholders: valid.map((r) => ({
          firstName: r.firstName,
          lastName:  r.lastName,
          email:     r.email.toLowerCase(),
          phone:     r.phone,
          chn:       r.chn,
          units:     r.units,
        })),
      },
      {
        onSuccess: () => { setCsvRows([]); setCsvFileName(""); setShowCsvPreview(false); setCsvImporting(false); },
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
        </div>

        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">
          Shareholders can also be added via the backend API.{" "}
          <span className="font-medium">CSV format: Full Name, CHN, Email, Units</span>
        </p>
      </Card>

      {/* ── CSV preview ── */}
      {showCsvPreview && csvRows.length > 0 && (
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
              <Button
                size="sm" variant="ghost" className="h-7 text-xs text-[hsl(var(--muted-foreground))]"
                onClick={() => { setCsvRows([]); setCsvFileName(""); setShowCsvPreview(false); }}
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
                      {[row.firstName, row.lastName].filter(Boolean).join(" ") || <span className="italic text-[hsl(var(--muted-foreground))]">—</span>}
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
      {showForm && (
        <Card className="attend-card p-5">
          <h3 className="text-sm font-semibold text-[hsl(var(--foreground))] mb-4">Add Shareholder</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                placeholder="Ekezie"
                className={cn(touched && errors.firstName && "border-red-400 focus-visible:ring-red-200")}
              />
              {touched && errors.firstName && <p className="text-xs text-red-500">Required</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                placeholder="Chinonyerem"
                className={cn(touched && errors.lastName && "border-red-400 focus-visible:ring-red-200")}
              />
              {touched && errors.lastName && <p className="text-xs text-red-500">Required</p>}
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
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  type="tel" value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="08012345678" className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                CHN <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]">(optional)</span>
              </Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  value={form.chn}
                  onChange={(e) => setForm((p) => ({ ...p, chn: e.target.value }))}
                  placeholder="0123456789" className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Units <span className="font-normal normal-case text-[hsl(var(--muted-foreground))]">(optional)</span>
              </Label>
              <Input
                type="number" min={0} value={form.units}
                onChange={(e) => setForm((p) => ({ ...p, units: e.target.value }))}
                placeholder="50000"
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
                <th className="px-5 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {shareholders.map((s) => (
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
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-[hsl(var(--muted-foreground))] hover:text-red-600 hover:bg-red-50"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ registerId, shareholderId: s.id })}
                    >
                      {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

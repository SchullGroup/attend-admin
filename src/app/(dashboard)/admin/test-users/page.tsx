"use client";
import { useState } from "react";
import {
  FlaskConical,
  ShieldAlert,
  Database,
  Trash2,
  Copy,
  Check,
  Download,
  Loader2,
  KeyRound,
  Mail,
  Users,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";
import { resolveRole, isSuperAdminRole } from "@/lib/utils";
import { useGetMe } from "@/api/auth/hooks";
import { useAdminAllRegisters } from "@/api/registrars";
import {
  useSeedTestUsers,
  usePurgeTestUsers,
  type SeedTestUsersRequest,
  type SeedTestUsersResponse,
} from "@/api/super-admin";

const NONE = "__none__";
const DEFAULT_PREFIX = "loadtest";
const DEFAULT_PASSWORD = "StressTest#2026";
const CONFIRM_THRESHOLD = 100; // seeds of this size (or any that create shareholders) prompt a confirm

export default function TestUsersPage() {
  // ── Role gate (backend enforces SUPER_ADMIN too; this is defence-in-depth) ──
  const { data: userResponse, isLoading: meLoading } = useGetMe();
  const currentUser = userResponse?.data;
  const isSuperAdmin = isSuperAdminRole(resolveRole(currentUser));

  // ── Seed form state ────────────────────────────────────────────────────────
  const [count, setCount] = useState("100");
  const [registerSel, setRegisterSel] = useState<string>(NONE);
  const [emailPrefix, setEmailPrefix] = useState(DEFAULT_PREFIX);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [units, setUnits] = useState("1000");

  const [result, setResult] = useState<SeedTestUsersResponse | null>(null);
  const [lastSeed, setLastSeed] = useState<{ count: number; prefix: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // ── Purge state ─────────────────────────────────────────────────────────────
  const [purgePrefix, setPurgePrefix] = useState(DEFAULT_PREFIX);

  // ── Data + mutations (hooks must run before any early return) ───────────────
  const { data: registers = [], isLoading: registersLoading } = useAdminAllRegisters(isSuperAdmin);
  const seedMutation = useSeedTestUsers();
  const purgeMutation = usePurgeTestUsers();

  const registerId = registerSel === NONE ? undefined : registerSel;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      popup.error("Copy failed", "Could not copy to the clipboard.");
    }
  }

  function seedErrorMessage(err: any) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message;
    if (status === 404)
      return "Test seeding isn't enabled on this environment. Ask the backend to set app.test-seeding.enabled=true for this test window (non-production only).";
    if (status === 403)
      return "Seeding test accounts requires a SUPER_ADMIN account on an allowed (non-production) profile.";
    return msg || "An error occurred while seeding test accounts.";
  }

  function runSeed(n: number) {
    const prefix = emailPrefix.trim() || DEFAULT_PREFIX;
    const payload: SeedTestUsersRequest = {
      count: n,
      ...(registerId ? { registerId } : {}),
      ...(prefix ? { emailPrefix: prefix } : {}),
      ...(password ? { password } : {}),
      // units only makes sense alongside shareholder rows (needs a register)
      ...(registerId && units.trim() !== "" && Number(units) >= 0 ? { units: Number(units) } : {}),
    };
    seedMutation.mutate(payload, {
      onSuccess: (data) => {
        setResult(data);
        setLastSeed({ count: n, prefix });
        setShowRaw(false);
        popup.success("Seeded", `Requested ${n.toLocaleString()} test account(s).`, 3000);
      },
      onError: (err) => popup.error("Seeding failed", seedErrorMessage(err)),
    });
  }

  function handleSeed() {
    const n = parseCount();
    if (n == null) return;
    const needsConfirm = n >= CONFIRM_THRESHOLD || !!registerId;
    if (!needsConfirm) {
      runSeed(n);
      return;
    }
    popup.confirm(
      "Seed test accounts?",
      <span>
        This creates <b>{n.toLocaleString()}</b> fake, KYC-bypassed account(s)
        {registerId ? (
          <>
            {" "}
            and matching <b>active shareholder rows</b> on the selected register (making them
            AGM-eligible and able to vote)
          </>
        ) : null}
        . Only do this on a <b>non-production</b> environment, and never on a register with a live AGM.
      </span>,
      () => runSeed(n),
      undefined,
      "Seed accounts",
    );
  }

  function handlePurge() {
    const prefix = purgePrefix.trim();
    if (!prefix) {
      popup.error("Prefix required", "Enter the email prefix whose test accounts should be purged.");
      return;
    }
    popup.confirm(
      "Purge test accounts?",
      <span>
        This permanently deletes every seeded account whose email begins with{" "}
        <b>{prefix}+</b> (e.g. <code>{prefix}+1@example.com</code>) and their shareholder rows. This
        cannot be undone.
      </span>,
      () => {
        purgeMutation.mutate(prefix, {
          onSuccess: (data) => {
            const removed =
              data?.deleted ?? data?.purged ?? data?.count ?? data?.removed ?? data?.deletedCount;
            popup.success(
              "Purged",
              typeof removed === "number"
                ? `Removed ${removed.toLocaleString()} test account(s) matching "${prefix}+".`
                : `Purge request completed for "${prefix}+".`,
              3000,
            );
            // Clear the result panel if we just deleted what it describes.
            if (lastSeed && lastSeed.prefix === prefix) {
              setResult(null);
              setLastSeed(null);
            }
          },
          onError: (err) => popup.error("Purge failed", seedErrorMessage(err)),
        });
      },
      undefined,
      "Purge accounts",
    );
  }

  function parseCount(): number | null {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 5000) {
      popup.error("Invalid count", "Count must be a whole number between 1 and 5,000.");
      return null;
    }
    return n;
  }

  // The account set is fully deterministic from (prefix, count, password): the seed
  // response only returns a few samples, so we regenerate every row from the pattern.
  // Phones follow the documented 080-prefixed, zero-padded sequence (080 + i → 11 digits).
  function downloadCsv(n: number, prefix: string, pw: string) {
    const rows = ["email,phone,password"];
    for (let i = 1; i <= n; i++) {
      rows.push(`${prefix}+${i}@example.com,080${String(i).padStart(8, "0")},${pw}`);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}-accounts-${n}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Generate the CSV straight from the current form values — works even before a
  // successful seed (e.g. while the backend flag is still off), since the credentials
  // are known ahead of time.
  function handleDownloadFromForm() {
    const n = parseCount();
    if (n == null) return;
    downloadCsv(n, emailPrefix.trim() || DEFAULT_PREFIX, password || DEFAULT_PASSWORD);
  }

  // ── Early returns (after all hooks) ─────────────────────────────────────────
  if (meLoading) return <Loader variant="page" text="Loading…" />;

  if (!isSuperAdmin) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-6 w-6 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Restricted</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
          The QA seeding tools are available to Super Admins only.
        </p>
      </div>
    );
  }

  // ── Derived result fields (defensive against unknown response keys) ─────────
  const seededPassword = result?.password ?? result?.sharedPassword ?? password ?? DEFAULT_PASSWORD;
  const sampleEmails: string[] =
    result?.sampleEmails ?? result?.samples ?? result?.emails ?? [];
  const emailPattern =
    result?.emailPattern ??
    result?.pattern ??
    (lastSeed ? `${lastSeed.prefix}+{1..${lastSeed.count}}@example.com` : undefined);
  const shareholderRowsCreated =
    result?.shareholderRowsCreated ?? result?.shareholdersCreated ?? result?.shareholderRows;

  const seeding = seedMutation.isPending;
  const purging = purgeMutation.isPending;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.08)] flex items-center justify-center shrink-0">
          <FlaskConical className="h-5 w-5 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">QA Test Accounts</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
            Seed and purge verified, login-ready load-test accounts for stress testing.
          </p>
        </div>
      </div>

      {/* Safety banner */}
      <Card className="attend-card border-amber-200 bg-amber-50 p-4 mb-6">
        <div className="flex gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 space-y-1.5">
            <p className="font-semibold">Non-production use only.</p>
            <ul className="list-disc pl-4 space-y-1 text-amber-800">
              <li>
                Seeding <b>bypasses KYC</b> and creates real, voting-eligible accounts — enable the
                backend flag per test window, never in the base config.
              </li>
              <li>
                Staging runs against the <b>real</b> Huawei bucket, the <b>billed</b> Dojah API and
                <b> real</b> Zoom. Seed onto a <b>throwaway register</b>, never one with a live AGM.
              </li>
              <li>
                Use one distinct account per concurrent virtual user — accounts enforce a single
                active session.
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* ── Seed ──────────────────────────────────────────────────────────── */}
      <Card className="attend-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Database className="h-4 w-4 text-[hsl(var(--primary))]" />
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Seed accounts</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Count */}
          <div className="space-y-1.5">
            <Label htmlFor="count">
              Count <span className="text-red-500">*</span>
            </Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={5000}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="500"
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Number of accounts to create (1–5,000).</p>
          </div>

          {/* Register */}
          <div className="space-y-1.5">
            <Label>Register (AGM)</Label>
            <Select value={registerSel} onValueChange={setRegisterSel}>
              <SelectTrigger>
                <SelectValue placeholder="Users only — no AGM" />
              </SelectTrigger>
              <SelectContent className="w-(--radix-select-trigger-width)">
                <SelectItem value={NONE}>Users only — no shareholder rows</SelectItem>
                {registers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {registersLoading
                ? "Loading registers…"
                : "Pick a throwaway register to make accounts AGM-eligible, or leave as users-only."}
            </p>
          </div>

          {/* Email prefix */}
          <div className="space-y-1.5">
            <Label htmlFor="prefix">Email prefix</Label>
            <Input
              id="prefix"
              value={emailPrefix}
              onChange={(e) => setEmailPrefix(e.target.value)}
              placeholder={DEFAULT_PREFIX}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Emails become <code>{(emailPrefix.trim() || DEFAULT_PREFIX)}+1@example.com</code> …
            </p>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Shared password</Label>
            <Input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={DEFAULT_PASSWORD}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Same password for every account.</p>
          </div>

          {/* Units */}
          <div className="space-y-1.5">
            <Label htmlFor="units">Units (vote weight)</Label>
            <Input
              id="units"
              type="number"
              min={0}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="1000"
              disabled={!registerId}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {registerId ? "Share units per seeded shareholder row." : "Select a register to set units."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button onClick={handleSeed} disabled={seeding} className="gap-2">
            {seeding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Seeding…
              </>
            ) : (
              <>
                <Database className="h-4 w-4" /> Seed accounts
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleDownloadFromForm} className="gap-2">
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        </div>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          CSV lists every <code>{(emailPrefix.trim() || DEFAULT_PREFIX)}+1…N</code> account
          (email, phone, password) — you can generate it before seeding too.
        </p>
      </Card>

      {/* ── Result ────────────────────────────────────────────────────────── */}
      {result && (
        <Card className="attend-card p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Seeded credentials</h2>
            </div>
            {lastSeed && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() =>
                  downloadCsv(lastSeed.count, lastSeed.prefix, result?.password || password || DEFAULT_PASSWORD)
                }
              >
                <Download className="h-3.5 w-3.5" /> Download {lastSeed.count.toLocaleString()} accounts (CSV)
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Password */}
            <div className="rounded-lg border border-[hsl(var(--border))] p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Shared password
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-semibold text-[hsl(var(--foreground))] break-all">
                  {seededPassword}
                </code>
                <button
                  onClick={() => copy(seededPassword, "pw")}
                  className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  title="Copy password"
                >
                  {copied === "pw" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Pattern */}
            <div className="rounded-lg border border-[hsl(var(--border))] p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                <Mail className="h-3.5 w-3.5" /> Email pattern
              </div>
              <div className="flex items-center justify-between gap-2">
                <code className="text-sm font-semibold text-[hsl(var(--foreground))] break-all">
                  {emailPattern ?? "—"}
                </code>
                {emailPattern && (
                  <button
                    onClick={() => copy(emailPattern, "pattern")}
                    className="shrink-0 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    title="Copy pattern"
                  >
                    {copied === "pattern" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Shareholder rows */}
            <div className="rounded-lg border border-[hsl(var(--border))] p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                <Users className="h-3.5 w-3.5" /> Shareholder rows
              </div>
              <span
                className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${
                  shareholderRowsCreated
                    ? "bg-green-50 text-green-700"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {shareholderRowsCreated === undefined
                  ? "Unknown"
                  : shareholderRowsCreated
                    ? "Created — AGM-eligible"
                    : "Not created — users only"}
              </span>
            </div>

            {/* Samples */}
            {sampleEmails.length > 0 && (
              <div className="rounded-lg border border-[hsl(var(--border))] p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                  <Mail className="h-3.5 w-3.5" /> Sample emails
                </div>
                <div className="space-y-0.5">
                  {sampleEmails.slice(0, 4).map((e) => (
                    <code key={e} className="block text-xs text-[hsl(var(--foreground))] break-all">
                      {e}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Raw response — the contract isn't fully pinned, so show everything. */}
          <button
            onClick={() => setShowRaw((s) => !s)}
            className="mt-4 text-xs text-[hsl(var(--primary))] hover:underline"
          >
            {showRaw ? "Hide" : "Show"} raw response
          </button>
          {showRaw && (
            <pre className="mt-2 text-xs bg-[hsl(var(--muted))] rounded-lg p-3 overflow-x-auto text-[hsl(var(--foreground))]">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </Card>
      )}

      {/* ── Purge ─────────────────────────────────────────────────────────── */}
      <Card className="attend-card p-6 border-red-100">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="h-4 w-4 text-red-500" />
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Purge accounts</h2>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
          Delete every seeded account (and its shareholder rows) whose email starts with the given
          prefix. Use this to clean up after a test window.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label htmlFor="purge-prefix">Email prefix</Label>
            <Input
              id="purge-prefix"
              value={purgePrefix}
              onChange={(e) => setPurgePrefix(e.target.value)}
              placeholder={DEFAULT_PREFIX}
              className="w-56"
            />
          </div>
          <Button
            variant="outline"
            onClick={handlePurge}
            disabled={purging}
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            {purging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Purging…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Purge "{purgePrefix.trim() || DEFAULT_PREFIX}+"
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

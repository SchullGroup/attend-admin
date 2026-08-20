"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Download, Mail, Plus, Search, Send, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  InviteInput,
  useCreateInviteCampaign,
  useCreateInvites,
  useExportAudienceInvites,
  useImportInvites,
  useInviteCampaignProgress,
  useInviteImportProgress,
  useListInvites,
  useListTiers,
} from "@/api/client-events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";

const PAGE_SIZE = 50;
const STATUS_OPTIONS = ["UNSENT", "QUEUED", "SENT", "DELIVERED", "FAILED", "BOUNCED", "REGISTERED", "REVOKED"];

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseInviteCsv(text: string): InviteInput[] {
  const [headerRow, ...dataRows] = csvRows(text.replace(/^\uFEFF/, ""));
  if (!headerRow) throw new Error("The CSV is empty.");

  const headers = headerRow.map(normalizeHeader);
  const emailIndex = headers.indexOf("email");
  if (emailIndex < 0) throw new Error('CSV must include an "email" column.');

  const index = (name: string) => headers.indexOf(name);
  const value = (row: string[], name: string) => {
    const position = index(name);
    return position >= 0 ? row[position]?.trim() || undefined : undefined;
  };

  const invites = dataRows
    .map((row) => ({
      email: row[emailIndex]?.trim() ?? "",
      firstName: value(row, "firstname"),
      lastName: value(row, "lastname"),
      phone: value(row, "phone"),
      tierId: value(row, "tierid"),
      tierName: value(row, "tiername"),
    }))
    .filter((invite) => invite.email);

  if (invites.length === 0) throw new Error("The CSV does not contain any invite email addresses.");
  return invites;
}

function downloadCsv(csv: string, eventId: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invites-${eventId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function progressPercent(processed: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
}

export function EventLaunchInvitesTab({ eventId }: { eventId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tierId, setTierId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newTierId, setNewTierId] = useState("");
  const [newTierName, setNewTierName] = useState("");
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const filters = { page, size: PAGE_SIZE, search, status, tierId };
  const { data, isLoading, isFetching } = useListInvites(eventId, filters);
  const { data: tiers = [] } = useListTiers(eventId);
  const createInvites = useCreateInvites();
  const importInvites = useImportInvites();
  const createCampaign = useCreateInviteCampaign();
  const importProgress = useInviteImportProgress(eventId, importJobId);
  const campaignProgress = useInviteCampaignProgress(eventId, campaignId);
  const queryClient = useQueryClient();
  const { refetch: exportInvites, isFetching: exporting } = useExportAudienceInvites(eventId, { search, status, tierId });

  // Campaign delivery is asynchronous. Refresh the invite list whenever the
  // polled campaign snapshot changes so summary cards do not remain stale
  // while the mail worker is sending.
  useEffect(() => {
    if (campaignProgress.data) {
      void queryClient.invalidateQueries({ queryKey: ["clientEvents", "invites", eventId] });
    }
  }, [campaignProgress.data, eventId, queryClient]);

  const summary = data?.summary;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  function resetPageAndFilters(next: { status?: string; tierId?: string }) {
    if (next.status !== undefined) setStatus(next.status);
    if (next.tierId !== undefined) setTierId(next.tierId);
    setPage(0);
  }

  function handleAddInvite() {
    if (!email.trim()) return;
    createInvites.mutate(
      {
        eventId,
        invites: [{
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          tierId: newTierId || undefined,
          tierName: !newTierId && newTierName.trim() ? newTierName.trim() : undefined,
        }],
      },
      {
        onSuccess: () => {
          setFirstName(""); setLastName(""); setEmail(""); setPhone("");
          setShowAdd(false);
        },
      }
    );
  }

  async function handleCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      popup.error("Invalid File", "Please choose a CSV file.", 3000);
      return;
    }
    try {
      const invites = parseInviteCsv(await file.text());
      importInvites.mutate(
        { eventId, invites, defaultTierId: newTierId || undefined },
        { onSuccess: (job) => setImportJobId(job.id) }
      );
    } catch (error) {
      popup.error("CSV Could Not Be Read", error instanceof Error ? error.message : "Check the CSV and try again.", 4000);
    }
  }

  async function handleExport() {
    const result = await exportInvites();
    if (result.data) downloadCsv(result.data, eventId);
  }

  function handleCampaign() {
    if ((summary?.unsent ?? 0) === 0) return;
    popup.confirm(
      "Send All Unsent Invites",
      `Queue invitation emails for ${summary?.unsent.toLocaleString() ?? 0} unsent invite(s)?`,
      () => createCampaign.mutate(
        { eventId, body: { selection: "ALL_UNSENT" } },
        { onSuccess: (campaign) => setCampaignId(campaign.campaignId) }
      ),
      undefined,
      "Start Campaign"
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Total", summary?.total ?? 0], ["Unsent", summary?.unsent ?? 0],
          ["Queued", summary?.queued ?? 0], ["Delivered", summary?.delivered ?? 0],
          ["Registered", summary?.registered ?? 0], ["Sent", summary?.sent ?? 0],
          ["Failed", summary?.failed ?? 0], ["Bounced", summary?.bounced ?? 0],
          ["Revoked", summary?.revoked ?? 0],
        ].map(([label, count]) => (
          <Card key={String(label)} className="attend-card p-4">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
            <p className="mt-1 text-xl font-bold text-[hsl(var(--foreground))]">{Number(count).toLocaleString()}</p>
          </Card>
        ))}
      </div>

      <Card className="attend-card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Invite Directory</h2>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Add invitees first, then send all unsent invitations as a tracked campaign.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={importInvites.isPending}>
              <Upload className="h-3.5 w-3.5" /> {importInvites.isPending ? "Importing…" : "Import CSV"}
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsv} />
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport} disabled={exporting}>
              <Download className="h-3.5 w-3.5" /> {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAdd((value) => !value)}>
              <Plus className="h-3.5 w-3.5" /> Add Invite
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleCampaign} disabled={createCampaign.isPending || (summary?.unsent ?? 0) === 0}>
              <Send className="h-3.5 w-3.5" /> {createCampaign.isPending ? "Starting…" : "Send All Unsent"}
            </Button>
          </div>
        </div>

        <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
          CSV headers: <span className="font-medium">email</span> (required), firstName, lastName, phone, tierId, tierName. The selected default tier below is used where a row has no tier.
        </p>

        {showAdd && (
          <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.25)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Add one invite</p>
              <button type="button" aria-label="Close add invite form" onClick={() => setShowAdd(false)} className="rounded-md p-1 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email *" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
              <select value={newTierId} onChange={(e) => setNewTierId(e.target.value)} className="h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm">
                <option value="">No/default tier</option>
                {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
              </select>
            </div>
            {!newTierId && (
              <Input
                value={newTierName}
                onChange={(e) => setNewTierName(e.target.value)}
                placeholder="Tier name (optional, e.g. VIP)"
                className="mt-3 max-w-sm"
              />
            )}
            <Button size="sm" className="mt-3" onClick={handleAddInvite} disabled={!email.trim() || createInvites.isPending}>
              {createInvites.isPending ? "Adding…" : "Add to Invite List"}
            </Button>
          </div>
        )}

        {importProgress.data && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Import {importProgress.data.status.replace(/_/g, " ")}</span>
              <span>{importProgress.data.processedRows.toLocaleString()} / {importProgress.data.totalRows.toLocaleString()} processed</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progressPercent(importProgress.data.processedRows, importProgress.data.totalRows)}%` }} /></div>
            <p className="mt-2 text-xs">Accepted {importProgress.data.acceptedRows} · Updated {importProgress.data.updatedRows} · Duplicates {importProgress.data.duplicateRows} · Rejected {importProgress.data.rejectedRows}</p>
          </div>
        )}

        {campaignProgress.data && (
          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-purple-950">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">Campaign {campaignProgress.data.status.replace(/_/g, " ")}</span>
              <span>{campaignProgress.data.sentCount.toLocaleString()} / {campaignProgress.data.selectedCount.toLocaleString()} sent</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-purple-100"><div className="h-full bg-purple-600 transition-all" style={{ width: `${progressPercent(campaignProgress.data.sentCount + campaignProgress.data.failedCount + campaignProgress.data.skippedCount, campaignProgress.data.selectedCount)}%` }} /></div>
            <p className="mt-2 text-xs">Queued {campaignProgress.data.queuedCount} · Failed {campaignProgress.data.failedCount} · Skipped {campaignProgress.data.skippedCount}</p>
          </div>
        )}

        <form className="mt-5 grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]" onSubmit={(event) => { event.preventDefault(); setSearch(searchText.trim()); setPage(0); }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search invitees" className="pl-9" />
          </div>
          <select value={status} onChange={(e) => resetPageAndFilters({ status: e.target.value })} className="h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm">
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option.charAt(0) + option.slice(1).toLowerCase()}</option>)}
          </select>
          <select value={tierId} onChange={(e) => resetPageAndFilters({ tierId: e.target.value })} className="h-10 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm">
            <option value="">All tiers</option>
            {tiers.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
          </select>
          <Button type="submit" variant="outline">Search</Button>
        </form>

        {isLoading ? (
          <Loader variant="inline" text="Loading invites…" />
        ) : data?.items.length ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
            <table className="attend-table min-w-[720px]">
              <thead><tr><th>Invitee</th><th>Email</th><th>Phone</th><th>Tier</th></tr></thead>
              <tbody>
                {data.items.map((invite, index) => (
                  <tr key={`${invite.email}-${index}`} className="attend-table-row">
                    <td><span className="font-medium text-[hsl(var(--foreground))]">{[invite.firstName, invite.lastName].filter(Boolean).join(" ") || "—"}</span></td>
                    <td>{invite.email}</td><td>{invite.phone || "—"}</td><td>{invite.tierName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-[hsl(var(--border))] py-12 text-center">
            <Mail className="mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm font-medium">No invites match these filters</p>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Add an invite or import a CSV to build this event&apos;s audience.</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>{(data?.total ?? 0).toLocaleString()} invite(s){isFetching && !isLoading ? " · Refreshing…" : ""}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button>
            <span>Page {page + 1} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
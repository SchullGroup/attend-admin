"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Ban, Download, Mail, Plus, RefreshCw, Search, Send, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import {
  InviteInput,
  useCreateInviteCampaign,
  useCreateInvites,
  useExportAudienceInvites,
  useImportInviteCsv,
  useImportInvites,
  useInviteCampaignProgress,
  useInviteImportProgress,
  useListInvites,
  useListTiers,
  useResendInvite,
  useRevokeInvite,
} from "@/api/client-events";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";

const PAGE_SIZE = 50;
const BROWSER_IMPORT_LIMIT = 100;
const STATUS_OPTIONS = ["NOT_SENT", "QUEUED", "PROCESSING", "SENT", "DELIVERED", "FAILED", "BOUNCED", "REGISTERED", "REVOKED"];

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function inspectInviteCsv(file: File): Promise<{ invites: InviteInput[]; exceedsBrowserLimit: boolean }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      preview: BROWSER_IMPORT_LIMIT + 1,
      transformHeader: normalizeHeader,
      complete: ({ data, errors, meta }) => {
        if (!meta.fields?.includes("email")) {
          reject(new Error('CSV must include an "email" column.'));
          return;
        }
        const fatal = errors.find((error) => error.type === "Quotes" || error.type === "Delimiter");
        if (fatal) {
          reject(new Error(`CSV row ${fatal.row != null ? fatal.row + 2 : ""} could not be parsed: ${fatal.message}`));
          return;
        }
        const invites = data
          .map((row) => ({
            email: row.email?.trim() ?? "",
            firstName: row.firstname?.trim() || undefined,
            lastName: row.lastname?.trim() || undefined,
            phone: row.phone?.trim() || undefined,
            tierId: row.tierid?.trim() || undefined,
            tierName: row.tiername?.trim() || undefined,
          }))
          .filter((invite) => invite.email);
        if (invites.length === 0) {
          reject(new Error("The CSV does not contain any invite email addresses."));
          return;
        }
        resolve({ invites, exceedsBrowserLimit: data.length > BROWSER_IMPORT_LIMIT });
      },
      error: (error) => reject(error),
    });
  });
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

function selectedCountForCampaign(
  selection: "ALL_UNSENT" | "SELECTED" | "TIER" | "IMPORT_JOB",
  selectedIds: string[],
  unsentCount: number,
  importedCount: number
) {
  if (selection === "SELECTED") return selectedIds.length;
  if (selection === "IMPORT_JOB") return importedCount;
  return unsentCount;
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
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [campaignSelection, setCampaignSelection] = useState<"ALL_UNSENT" | "SELECTED" | "TIER" | "IMPORT_JOB">("ALL_UNSENT");
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);

  const filters = { page, size: PAGE_SIZE, search, status, tierId };
  const { data, isLoading, isFetching } = useListInvites(eventId, filters);
  const { data: tiers = [] } = useListTiers(eventId);
  const createInvites = useCreateInvites();
  const importInvites = useImportInvites();
  const importInviteCsv = useImportInviteCsv();
  const createCampaign = useCreateInviteCampaign();
  const resendInvite = useResendInvite();
  const revokeInvite = useRevokeInvite();
  const importProgress = useInviteImportProgress(eventId, importJobId);
  const campaignProgress = useInviteCampaignProgress(eventId, campaignId);
  const queryClient = useQueryClient();
  const { refetch: exportInvites, isFetching: exporting } = useExportAudienceInvites(eventId, { search, status, tierId });

  useEffect(() => {
    setImportJobId(window.localStorage.getItem(`attend:invite-import:${eventId}`));
    setCampaignId(window.localStorage.getItem(`attend:invite-campaign:${eventId}`));
  }, [eventId]);

  useEffect(() => {
    if (importJobId) window.localStorage.setItem(`attend:invite-import:${eventId}`, importJobId);
  }, [eventId, importJobId]);

  useEffect(() => {
    if (campaignId) window.localStorage.setItem(`attend:invite-campaign:${eventId}`, campaignId);
  }, [campaignId, eventId]);

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
  const visibleInviteIds = (data?.items ?? []).map((invite) => invite.id).filter((id): id is string => Boolean(id));
  const allVisibleSelected = visibleInviteIds.length > 0 && visibleInviteIds.every((id) => selectedInviteIds.includes(id));

  function toggleVisibleInvites(checked: boolean) {
    setSelectedInviteIds((current) => checked
      ? [...new Set([...current, ...visibleInviteIds])]
      : current.filter((id) => !visibleInviteIds.includes(id)));
  }

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
      const { invites, exceedsBrowserLimit } = await inspectInviteCsv(file);
      if (!exceedsBrowserLimit) {
        importInvites.mutate(
          { eventId, invites, defaultTierId: newTierId || undefined },
          { onSuccess: (job) => setImportJobId(job.id) }
        );
        return;
      }

      setUploadPercent(0);
      importInviteCsv.mutate(
        { eventId, file, defaultTierId: newTierId || undefined, onUploadProgress: setUploadPercent },
        {
          onSuccess: (job) => {
            setImportJobId(job.id);
            setUploadPercent(null);
          },
          onError: () => setUploadPercent(null),
        }
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
    const selectedCount = campaignSelection === "SELECTED"
      ? selectedInviteIds.length
      : campaignSelection === "TIER"
        ? (summary?.unsent ?? 0)
        : campaignSelection === "IMPORT_JOB"
          ? (importProgress.data?.acceptedRows ?? 0)
          : (summary?.unsent ?? 0);
    if (selectedCount === 0) return;
    if (campaignSelection === "TIER" && !tierId) {
      popup.error("Choose a tier", "Select a tier before starting a tier campaign.", 3000);
      return;
    }
    if (campaignSelection === "IMPORT_JOB" && !importJobId) {
      popup.error("No import job", "Upload an audience CSV before starting an import campaign.", 3000);
      return;
    }
    popup.confirm(
      "Start Invitation Campaign",
      `Queue invitation emails for ${selectedCount.toLocaleString()} invite(s)?`,
      () => createCampaign.mutate(
        {
          eventId,
          body: {
            selection: campaignSelection,
            ...(campaignSelection === "SELECTED" ? { inviteIds: selectedInviteIds } : {}),
            ...(campaignSelection === "TIER" ? { tierId } : {}),
            ...(campaignSelection === "IMPORT_JOB" && importJobId ? { importJobId } : {}),
          },
        },
        { onSuccess: (campaign) => setCampaignId(campaign.campaignId) }
      ),
      undefined,
      "Start Campaign"
    );
  }

  function confirmRevokeInvite(inviteId: string, inviteEmail: string) {
    popup.confirm(
      "Revoke Invitation",
      `Revoke the invitation for ${inviteEmail}? They will no longer be able to register with it.`,
      () => revokeInvite.mutate({ eventId, inviteId }),
      undefined,
      "Revoke Invite"
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
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Add invitees first, then send all not-sent invitations as a tracked campaign.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={importInvites.isPending || importInviteCsv.isPending}>
              <Upload className="h-3.5 w-3.5" /> {importInvites.isPending || importInviteCsv.isPending ? "Importing…" : "Import CSV"}
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsv} />
            <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport} disabled={exporting}>
              <Download className="h-3.5 w-3.5" /> {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAdd((value) => !value)}>
              <Plus className="h-3.5 w-3.5" /> Add Invite
            </Button>
            <div className="flex items-center gap-1.5">
              <select
                value={campaignSelection}
                onChange={(event) => setCampaignSelection(event.target.value as typeof campaignSelection)}
                aria-label="Campaign audience"
                className="h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 text-xs"
              >
                <option value="ALL_UNSENT">All unsent</option>
                <option value="SELECTED">Selected ({selectedInviteIds.length})</option>
                <option value="TIER">Tier</option>
                <option value="IMPORT_JOB" disabled={!importJobId}>Latest import</option>
              </select>
              <Button size="sm" className="gap-1.5" onClick={handleCampaign} disabled={createCampaign.isPending || selectedCountForCampaign(campaignSelection, selectedInviteIds, summary?.unsent ?? 0, importProgress.data?.acceptedRows ?? 0) === 0}>
                <Send className="h-3.5 w-3.5" /> {createCampaign.isPending ? "Starting…" : "Start Campaign"}
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
          CSV headers: <span className="font-medium">email</span> (required), firstName, lastName, phone, tierId, tierName. Files with more than {BROWSER_IMPORT_LIMIT} records upload directly to secure document storage for background processing.
        </p>

        {uploadPercent !== null && (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-cyan-950">
            <div className="flex items-center justify-between text-sm"><span className="font-semibold">Uploading CSV securely</span><span>{uploadPercent}%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-cyan-100"><div className="h-full bg-cyan-600 transition-all" style={{ width: `${uploadPercent}%` }} /></div>
          </div>
        )}

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
            <p className="mt-2 text-xs">Accepted {importProgress.data.acceptedRows} · Created {importProgress.data.createdRows ?? 0} · Updated {importProgress.data.updatedRows} · Duplicates {importProgress.data.duplicateRows} · Rejected {importProgress.data.rejectedRows}</p>
            {importProgress.data.errorMessage && <p className="mt-2 text-xs font-medium text-red-700">{importProgress.data.errorCode ? `${importProgress.data.errorCode}: ` : ""}{importProgress.data.errorMessage}</p>}
            {importProgress.data.errorReportUrl && <a className="mt-2 inline-block text-xs font-semibold underline" href={importProgress.data.errorReportUrl} target="_blank" rel="noreferrer">Download rejected-row report</a>}
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
            {campaignProgress.data.errorMessage && <p className="mt-2 text-xs font-medium text-red-700">{campaignProgress.data.errorCode ? `${campaignProgress.data.errorCode}: ` : ""}{campaignProgress.data.errorMessage}</p>}
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
            <table className="attend-table min-w-[1080px]">
              <thead><tr><th className="w-10"><input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleVisibleInvites(event.target.checked)} aria-label="Select all invites on this page" /></th><th>Invitee</th><th>Email</th><th>Phone</th><th>Tier</th><th>Delivery</th><th>Registration</th><th>Provider ID</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {data.items.map((invite, index) => (
                  <tr key={invite.id ?? `${invite.email}-${index}`} className="attend-table-row">
                    <td>
                      {invite.id ? (
                        <input
                          type="checkbox"
                          checked={selectedInviteIds.includes(invite.id)}
                          onChange={(event) => setSelectedInviteIds((current) => event.target.checked ? [...new Set([...current, invite.id!])] : current.filter((id) => id !== invite.id))}
                          aria-label={`Select ${invite.email}`}
                        />
                      ) : null}
                    </td>
                    <td><span className="font-medium text-[hsl(var(--foreground))]">{[invite.firstName, invite.lastName].filter(Boolean).join(" ") || "—"}</span></td>
                    <td>{invite.email}</td>
                    <td>{invite.phone || "—"}</td>
                    <td>{invite.tierName || "—"}</td>
                    <td><span className="text-xs font-medium">{invite.deliveryStatus?.replace(/_/g, " ") || "NOT SENT"}</span></td>
                    <td><span className="text-xs font-medium">{invite.registrationStatus?.replace(/_/g, " ") || "INVITED"}</span></td>
                    <td className="max-w-[150px] truncate font-mono text-xs" title={invite.providerMessageId}>{invite.providerMessageId || "—"}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {invite.id && invite.registrationStatus !== "REVOKED" && invite.registrationStatus !== "REGISTERED" && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs"
                              disabled={resendInvite.isPending || revokeInvite.isPending || invite.deliveryStatus === "PROCESSING"}
                              onClick={() => resendInvite.mutate({ eventId, inviteId: invite.id! })}
                            >
                              <RefreshCw className={`h-3 w-3 ${resendInvite.isPending && resendInvite.variables?.inviteId === invite.id ? "animate-spin" : ""}`} /> Resend
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 px-2 text-xs text-red-600 hover:text-red-700"
                              disabled={resendInvite.isPending || revokeInvite.isPending || invite.deliveryStatus === "PROCESSING"}
                              onClick={() => confirmRevokeInvite(invite.id!, invite.email)}
                            >
                              <Ban className="h-3 w-3" /> Revoke
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
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
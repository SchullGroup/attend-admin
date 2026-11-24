"use client";

/**
 * Add / correct a paper proxy form (2026-11-20).
 *
 * Registrar staff enter the physical forms shareholders without an Attend
 * account return to them: find the holding on the register, then the proxy
 * (the Chairman or a named person), and an optional form reference / notes. Saved forms count toward quorum straight away, and as
 * checked in once the event is LIVE. A form replaces any proxy the same
 * shareholder lodged in the app.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Check, Hash, MapPin, Mail, Phone, AlertTriangle, Gavel, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PhoneInput, phoneError } from "@/components/ui/phone-input";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useRegisterSearch, type RegisterSearchResult } from "@/api/client-walk-ins";
import {
  useEventProxies, useSaveProxyForm,
  type EventProxy, type ProxyType,
} from "@/api/client-proxies";

interface Holder {
  shareholderId: string;
  fullName:      string;
  chn?:          string | null;
  units?:        number | null;
  accountNo?:    string | null;
  address?:      string | null;
  email?:        string | null;
  phone?:        string | null;
  registered?:   boolean;
  checkedIn?:    boolean;
  method?:       string | null;
  votedCount?:   number;
}

const LBL = "text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]";

function idsOf(h: { accountNo?: string | null; chn?: string | null }) {
  return [h.accountNo ? `Acct ${h.accountNo}` : null, h.chn ? `CHN ${h.chn}` : null].filter(Boolean).join(" · ") || "No CHN";
}

export function ProxyFormDialog({
  eventId, open, onOpenChange, editing, onEditExisting,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A FORM row to correct; null/undefined to enter a new form. */
  editing?: EventProxy | null;
  /** Called when the holding already has a form (409) and staff choose to edit that one. */
  onEditExisting: (proxy: EventProxy) => void;
}) {
  const save = useSaveProxyForm();
  const queryClient = useQueryClient();

  const [holder,    setHolder]    = useState<Holder | null>(null);
  const [q,         setQ]         = useState("");
  const [proxyType, setProxyType] = useState<ProxyType>("CHAIRMAN");
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [reference, setReference] = useState("");
  const [notes,     setNotes]     = useState("");
  const [touched,   setTouched]   = useState(false);
  const [existing,  setExisting]  = useState<EventProxy | null>(null);
  const [busy,      setBusy]      = useState(false);

  // Reset whenever the dialog opens (fresh form, or the row being corrected).
  useEffect(() => {
    if (!open) return;
    setQ(""); setTouched(false); setExisting(null); setBusy(false);
    if (editing) {
      setHolder({ shareholderId: editing.shareholderId ?? "", fullName: editing.grantorName, chn: editing.chn, units: editing.units ?? editing.sharesRepresented });
      const chair = editing.proxyType === "CHAIRMAN";
      setProxyType(chair ? "CHAIRMAN" : "NAMED");
      setName(chair ? "" : editing.proxyName ?? "");
      setEmail(editing.proxyEmail ?? "");
      setPhone(editing.proxyPhone ?? "");
      setReference(editing.formReference ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setHolder(null); setProxyType("CHAIRMAN"); setName(""); setEmail(""); setPhone(""); setReference(""); setNotes("");
    }
  }, [open, editing]);

  // Register search (same endpoint as the walk-in screen).
  const term = useDebouncedValue(q.trim(), 300);
  const { data: found, isFetching: searching } = useRegisterSearch(eventId, holder ? "" : term, 0, 20);
  const results = !holder && term.length >= 2 ? (found?.content ?? []) : [];

  // Heads-up before saving: an app proxy for someone with this name will be replaced.
  const { data: appMatches } = useEventProxies(eventId, {
    search: holder?.fullName ?? "", source: "APP", size: 5, enabled: open && !!holder && !editing,
  });
  const appProxy = (appMatches?.proxies ?? []).find(
    (p) => p.source === "APP" && p.status !== "SUPERSEDED" && p.grantorName.trim().toLowerCase() === holder?.fullName.trim().toLowerCase(),
  );

  const emailBad = !!email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneBad = !!phone && !!phoneError(phone);
  const errors = {
    holder: !holder,
    name:   proxyType === "NAMED" && !name.trim(),
    email:  emailBad,
    phone:  phoneBad,
  };
  const invalid = Object.values(errors).some(Boolean);

  function pick(r: RegisterSearchResult) {
    setHolder({
      shareholderId: r.shareholderId, fullName: r.fullName, chn: r.chn, units: r.units,
      accountNo: r.accountNo, address: r.address, email: r.email, phone: r.phone,
      registered: !!r.registered, checkedIn: !!r.checkedIn, method: r.method ?? null,
      votedCount: r.votedResolutionIds?.length ?? 0,
    });
    setExisting(null);
  }

  async function submit() {
    setTouched(true);
    if (invalid || !holder) return;
    setBusy(true);
    try {
      const saved = await save.mutateAsync({
        eventId,
        proxyId: editing?.id,
        body: {
          shareholderId: holder.shareholderId,
          proxyType,
          proxy: proxyType === "NAMED" ? { fullName: name, email, phone } : undefined,
          formReference: reference,
          notes,
        },
      });
      toast.success(
        saved.superseded
          ? `Proxy form saved. Replaced the proxy lodged in the app (${saved.superseded.proxyName}).`
          : editing ? "Proxy form updated." : "Proxy form saved. It counts toward quorum now.",
      );
      onOpenChange(false);
    } catch (err: any) {
      const r = err?.response;
      if (r?.status === 409 && r?.data?.code === "PROXY_EXISTS" && r?.data?.data?.proxy) {
        const raw = r.data.data.proxy;
        setExisting({
          id: String(raw.id), grantorName: raw.grantorName ?? holder.fullName, proxyName: raw.proxyName ?? "",
          proxyEmail: raw.proxyEmail ?? undefined, proxyPhone: raw.proxyPhone ?? undefined,
          status: "PENDING", source: "FORM", proxyType: raw.proxyType, shareholderId: raw.shareholderId ?? holder.shareholderId,
          chn: raw.chn ?? holder.chn, units: raw.units ?? holder.units, formReference: raw.formReference ?? null,
          notes: raw.notes ?? null, sharesRepresented: raw.sharesRepresented,
        });
      } else if (r?.status === 409 && r?.data?.code === "PROXY_EXISTS") {
        // Two saves for the same holding raced — no data.proxy here.
        toast.error("Someone just saved a form for this shareholder. The list has been refreshed. Check it before trying again.");
        queryClient.invalidateQueries({ queryKey: ["proxies", "list"] });
      } else if (r?.data?.code === "VALIDATION_FAILED") {
        const d = r.data.data;
        const msgs: string[] = Array.isArray(d) ? d.map((x: any) => (typeof x === "string" ? x : x?.message)).filter(Boolean)
          : d && typeof d === "object" ? Object.values(d).map(String) : [];
        toast.error(msgs.length ? msgs.join(" ") : (r.data.message ?? "Please check the form and try again."));
      } else {
        // DATABASE_NOT_MIGRATED, PROXY_FORM_NOT_SAVED, NOT_FOUND, BAD_REQUEST… — messages are written for staff.
        toast.error(r?.data?.message ?? "Couldn't save the proxy form. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Correct proxy form" : "Add proxy form"}</DialogTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            For a shareholder who returned a paper proxy form. It counts toward quorum as soon as it&apos;s saved, and as checked in once the event is live.
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-2">
          {/* 1. Shareholder */}
          <section className="space-y-2">
            <Label className={LBL}>Shareholder <span className="text-red-500">*</span></Label>
            {holder ? (
              <div className="rounded-xl border border-[hsl(var(--border))] px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{holder.fullName}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                    {idsOf(holder)}{typeof holder.units === "number" && <> · {holder.units.toLocaleString()} units</>}
                  </p>
                  {holder.address && <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">{holder.address}</p>}
                </div>
                {!editing && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => { setHolder(null); setExisting(null); }}>
                    Change
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <Input
                    value={q} onChange={(e) => setQ(e.target.value)} autoFocus autoComplete="off"
                    placeholder="Search the register by name…" className="pl-9"
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />}
                </div>
                {touched && errors.holder && <p className="text-xs text-red-500">Pick the shareholder from the register.</p>}
                {term.length >= 2 && !searching && results.length === 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] py-2">No active shareholder on this register matches &ldquo;{term}&rdquo;.</p>
                )}
                {results.length > 0 && (
                  <div className="rounded-xl border border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))] max-h-64 overflow-y-auto">
                    {results.map((r) => (
                      <button
                        key={r.shareholderId} type="button" onClick={() => pick(r)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
                      >
                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{r.fullName}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                          {idsOf(r)}{typeof r.units === "number" && <> · {r.units.toLocaleString()} units</>}
                        </p>
                        {(r.address || r.email || r.phone) && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] flex flex-wrap gap-x-3 mt-0.5">
                            {r.address && <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate max-w-[260px]">{r.address}</span></span>}
                            {r.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>}
                            {r.phone && <span className="inline-flex items-center gap-1 tabular-nums"><Phone className="h-3 w-3" />{r.phone}</span>}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {holder && !editing && (holder.registered || holder.checkedIn) && (
              <p className="text-xs rounded-lg bg-sky-50 border border-sky-200 text-sky-900 px-3 py-2 flex gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {holder.fullName} is already {holder.method === "WALK_IN" ? "checked in at the gate" : holder.checkedIn ? "registered and checked in" : "registered"}
                  {holder.votedCount ? <> and has voted on {holder.votedCount} resolution{holder.votedCount === 1 ? "" : "s"}</> : null}.
                  {" "}The form will be kept on file, but it won&apos;t add to quorum: they&apos;re already counted as the shareholder
                  {holder.votedCount ? <>, and their votes stand, so the proxy can&apos;t vote those resolutions</> : null}.
                </span>
              </p>
            )}
            {holder && appProxy && (
              <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 flex gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {appProxy.grantorName} already lodged a proxy in the app ({appProxy.proxyName}). Saving this form replaces it, because the paper form takes priority.
                </span>
              </p>
            )}
            {existing && (
              <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 flex items-center gap-2 flex-wrap">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 min-w-[200px]">
                  This holding already has a proxy form ({existing.proxyName}{existing.formReference ? `, ${existing.formReference}` : ""}).
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEditExisting(existing)}>Edit that form</Button>
              </div>
            )}
          </section>

          {/* 2. Proxy */}
          <section className="space-y-2">
            <Label className={LBL}>Proxy <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {([
                ["CHAIRMAN", "Chairman of the meeting", Gavel],
                ["NAMED",    "A named person",          UserRound],
              ] as const).map(([k, label, Icon]) => (
                <button
                  key={k} type="button" role="radio" aria-checked={proxyType === k} onClick={() => setProxyType(k)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    proxyType === k
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] text-[hsl(var(--foreground))]"
                      : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </button>
              ))}
            </div>
            {proxyType === "NAMED" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="col-span-2 space-y-1">
                  <Label className={LBL}>Full name <span className="text-red-500">*</span></Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="As written on the form"
                    className={touched && errors.name ? "border-red-400" : undefined} />
                  {touched && errors.name && <p className="text-xs text-red-500">Enter the proxy&apos;s name.</p>}
                </div>
                <div className="space-y-1">
                  <Label className={LBL}>Email <span className="font-normal normal-case">(optional)</span></Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className={touched && errors.email ? "border-red-400" : undefined} />
                  {touched && errors.email && <p className="text-xs text-red-500">Enter a valid email.</p>}
                </div>
                <div className="space-y-1">
                  <Label className={LBL}>Phone <span className="font-normal normal-case">(optional)</span></Label>
                  <PhoneInput value={phone} onChange={setPhone} invalid={touched && errors.phone} />
                  {touched && errors.phone && <p className="text-xs text-red-500">{phoneError(phone)}</p>}
                </div>
              </div>
            )}
          </section>

          {/* 3. Form details */}
          <section className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className={LBL}>Form reference <span className="font-normal normal-case">(optional)</span></Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="e.g. PF-00123" className="pl-8" />
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className={LBL}>Notes <span className="font-normal normal-case">(optional)</span></Label>
              <textarea
                value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="e.g. Received by post on 12 Nov"
                className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] resize-none"
              />
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-3 border-t border-[hsl(var(--border))]">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5" disabled={busy} onClick={submit}>
              {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Check className="h-3.5 w-3.5" /> {editing ? "Save changes" : "Save proxy form"}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

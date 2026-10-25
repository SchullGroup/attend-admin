"use client";
import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useUrlState } from "@/lib/use-url-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { toast } from "sonner";
import {
  QrCode, CheckCircle2, ShieldCheck, Clock, Users, ChevronRight,
  Camera, CameraOff, XCircle, UserCheck, ExternalLink, Volume2, VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useClientScanQr, useClientEvents, useClientEventAttendees } from "@/api/client-events";
import { useLiveAttendance } from "@/api/client-live";
import { toEventModule, MODULE_COLORS } from "@/lib/event-module";
import { CachedImage } from "@/components/custom/cached-image";
import { UserAvatar } from "@/components/custom/user-avatar";
import { playCheckInSuccess, playCheckInError, isCheckInSoundOn, setCheckInSoundOn } from "@/lib/checkin-sound";
import { WalkInPanel } from "./WalkInPanel";
import { useWalkInShareholders, useWalkInGuests } from "@/api/client-walk-ins";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KYC_COLORS: Record<string, { bg: string; text: string }> = {
  "Full KYC":  { bg: "#16a34a18", text: "#16a34a" },
  "Basic KYC": { bg: "#11182718", text: "#111827" },
  "Pending":   { bg: "#f59e0b18", text: "#d97706" },
  "None":      { bg: "#9ca3af18", text: "#6b7280" },
  "Unknown":   { bg: "#9ca3af18", text: "#6b7280" },
  "Walk-in":   { bg: "#2563eb14", text: "#1d4ed8" },
  "Guest":     { bg: "#7c22c914", text: "#7c22c9" },
  "Registered":{ bg: "#16a34a18", text: "#16a34a" },
};

function eventColor(eventType?: string | null): string {
  return MODULE_COLORS[toEventModule(eventType)];
}

function isPhysicalCheckInEvent(format?: string | null): boolean {
  const normalised = (format ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return normalised === "IN_PERSON" || normalised === "HYBRID";
}

export interface CheckIn {
  name:      string;
  time:      string;
  status:    string;
  kycStatus: string;
  /** Profile photo for registered attendees, when known. */
  avatarUrl?: string | null;
  /** Stable id for rows from the server, so two people with the same name both show. */
  key?:      string;
  /** ISO time of the check-in, for ordering the log newest first. */
  at?:       string;
}

/** Walk-ins loaded for the log (the API's page maximum). The log lists everything loaded and scrolls. */
const WALK_IN_LOG_SIZE = 100;
/** Registered Attendees card shows the latest few registrations. */
const REGISTERED_LIMIT = 10;

/** "FULL_KYC" / "full_kyc" / "Full KYC" → the label KYC_COLORS uses. */
function kycLabel(raw?: string | null): string {
  const k = (raw ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (k === "FULL_KYC") return "Full KYC";
  if (k === "BASIC_KYC") return "Basic KYC";
  if (k === "PENDING" || k === "PENDING_REVIEW") return "Pending";
  if (!k || k === "NO_KYC" || k === "NONE") return "None";
  return raw ?? "None";
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

// ---------------------------------------------------------------------------
// Live camera QR scanner
// ---------------------------------------------------------------------------

interface QrScannerProps {
  color:    string;
  onScan:   (token: string) => void;
  disabled: boolean;
}

function LiveQrScanner({ color, onScan, disabled }: QrScannerProps) {
  const [active, setActive]   = useState(false);
  const [error,  setError]    = useState<string | null>(null);
  const scannerRef            = useRef<any>(null);
  const lastTokenRef          = useRef<string>("");
  const cooldownRef           = useRef(false);

  const startScanner = useCallback(async () => {
    setError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode("qr-camera-feed");
      scannerRef.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          if (cooldownRef.current) return;
          if (decodedText === lastTokenRef.current) return;
          lastTokenRef.current = decodedText;
          cooldownRef.current  = true;
          setTimeout(() => { cooldownRef.current = false; }, 3000);
          onScan(decodedText);
        },
        () => {}
      );
      setActive(true);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setError(
        msg.toLowerCase().includes("permission")
          ? "Camera permission denied. Please allow camera access in your browser settings."
          : "Could not start camera. Make sure no other app is using it."
      );
    }
  }, [onScan]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (_) {}
      scannerRef.current = null;
    }
    setActive(false);
  }, []);

  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative rounded-2xl overflow-hidden border-2"
        style={{ borderColor: active ? color : "hsl(var(--border))", aspectRatio: "1 / 1", background: "#000" }}
      >
        <div id="qr-camera-feed" className="w-full h-full" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ backgroundColor: "#00000090" }}>
            {error ? (
              <><XCircle className="h-10 w-10 text-red-400" /><p className="text-xs text-red-300 text-center px-4">{error}</p></>
            ) : (
              <><QrCode className="h-12 w-12 text-white/60" /><p className="text-sm text-white/70">Camera off</p></>
            )}
          </div>
        )}
        {active && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="h-[220px] w-[220px] rounded-2xl border-2" style={{ borderColor: color, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }} />
          </div>
        )}
        {active && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            <span className="text-xs text-white font-semibold">Live</span>
          </div>
        )}
      </div>
      <Button className="w-full gap-2 text-white" style={{ backgroundColor: active ? "#6b7280" : color }} disabled={disabled} onClick={active ? stopScanner : startScanner}>
        {active ? <><CameraOff className="h-4 w-4" /> Stop Camera</> : <><Camera className="h-4 w-4" /> Start Camera Scan</>}
      </Button>
      <p className="text-xs text-center text-[hsl(var(--muted-foreground))]">
        Point the camera at the attendee&apos;s QR code on their phone
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scanner view (Level 2)
// Props accept checkins from the parent and an onCheckin callback so state
// persists when navigating back to the event list and returning.
// ---------------------------------------------------------------------------

interface ScannerViewProps {
  event:      any;
  color:      string;
  checkins:   CheckIn[];
  onCheckin:  (c: CheckIn) => void;
  onBack:     () => void;
}

function ScannerView({ event, color, checkins, onCheckin, onBack }: ScannerViewProps) {
  const [lastScan,   setLastScan]   = useState<{ name: string; email: string; seatRef: string; kycStatus: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [hwToken,    setHwToken]    = useState("");
  const hwInputRef                  = useRef<HTMLInputElement>(null);
  // "scan" = QR scanner; "walkin" = search the register / capture a guest at the gate.
  const [mode, setMode] = useState<"scan" | "walkin">("scan");
  // Check-in sounds on/off — remembered on this browser.
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => { setSoundOn(isCheckInSoundOn()); }, []);
  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setCheckInSoundOn(next);
    if (next) playCheckInSuccess(); // a quick preview so staff hear it's back on
  }

  const scanQr     = useClientScanQr();
  const isLive     = event.status === "LIVE";

  // Seed check-in log from server (live events only).
  // useLiveAttendance polls every 10 s, giving real-time updates.
  const { data: liveAttendance = [] } = useLiveAttendance(isLive ? event.id : null);

  // Server-seeded rows (only shown when local log is empty for this session)
  const serverRows: CheckIn[] = liveAttendance.map((a) => ({
    name:      a.name,
    time:      formatTime(a.joinedAt),
    status:    "Verified",
    kycStatus: "Unknown",
    avatarUrl: a.avatarUrl ?? null,
    at:        a.joinedAt,
  }));

  // Walk-in history from the server, so it survives a page refresh. Only the latest few are
  // needed for the log; the totals come from the server's counts.
  // Walk-ins are refused only on VIRTUAL events, so load history for anything else.
  const physical = !/virtual/i.test(String(event.format ?? ""));
  const { data: walkInSh } = useWalkInShareholders(event.id, 0, WALK_IN_LOG_SIZE, "", { enabled: physical });
  const { data: walkInGu } = useWalkInGuests(event.id, 0, WALK_IN_LOG_SIZE, "", "", { enabled: physical });
  const walkInRows: CheckIn[] = [
    ...(walkInSh?.content ?? []).map((w) => ({ key: `wsh-${w.id}`, name: w.fullName, at: w.checkedInAt, kycStatus: "Walk-in" })),
    ...(walkInGu?.content ?? []).map((g) => ({ key: `wgu-${g.id}`, name: g.fullName, at: g.checkedInAt, kycStatus: "Guest" })),
  ]
    .sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
    .map((r) => ({ key: r.key, name: r.name, time: formatTime(r.at), status: "Verified", kycStatus: r.kycStatus, at: r.at }));

  const { data: attendeeData, isLoading: attendeesLoading } = useClientEventAttendees(event.id, "", 0, 50);

  // Photo + KYC for registered attendees, looked up by name from the attendee list.
  // (Live attendance rows carry neither KYC nor always a photo — that's why they
  // showed "Unknown".)
  const attendeeByName = new Map<string, { avatarUrl?: string | null; kycStatus?: string }>();
  for (const a of attendeeData?.attendees ?? []) {
    if (a.fullName) attendeeByName.set(a.fullName.trim().toLowerCase(), { avatarUrl: (a as any).avatarUrl, kycStatus: a.kycStatus });
  }
  const withAvatar = (c: CheckIn): CheckIn => {
    if (c.kycStatus === "Walk-in" || c.kycStatus === "Guest") return c;
    const hit = attendeeByName.get(c.name.trim().toLowerCase());
    return {
      ...c,
      avatarUrl: c.avatarUrl || hit?.avatarUrl || null,
      kycStatus: c.kycStatus === "Unknown" ? (hit?.kycStatus ? kycLabel(hit.kycStatus) : "Registered") : kycLabel(c.kycStatus),
    };
  };

  // Merge: this session's QR check-ins on top, then every walk-in from the server (each keyed
  // by its own id, so two guests called "John Doe" both show), then live attendance for anyone
  // not already listed.
  const seen = new Set([...checkins, ...walkInRows].map((c) => c.name));
  const liveExtra = serverRows.filter((r) => !seen.has(r.name));
  const allLog: CheckIn[] = [...checkins, ...walkInRows, ...liveExtra]
    .map(withAvatar)
    .sort((a, b) => (Date.parse(b.at ?? "") || 0) - (Date.parse(a.at ?? "") || 0));
  // Everything loaded, newest first — the card scrolls, about five rows tall.
  const mergedLog = allLog;
  // Real total: walk-ins from the server's counts (not just the rows loaded) + QR / online check-ins.
  const totalCheckIns =
    checkins.length + liveExtra.length +
    (walkInSh?.totalElements ?? walkInSh?.content.length ?? 0) +
    (walkInGu?.totalElements ?? walkInGu?.content.length ?? 0);

  // Latest registrations first; only a handful are shown here.
  const allAttendees = attendeeData?.attendees ?? [];
  const regTime = (a: any) => Date.parse(a.registeredAt ?? a.rsvpDate ?? a.joinedAt ?? a.createdAt ?? "") || 0;
  const attendees = [...allAttendees].sort((a, b) => regTime(b) - regTime(a)).slice(0, REGISTERED_LIMIT);
  const totalRegistered: number = (attendeeData as any)?.totalCount ?? (attendeeData as any)?.totalElements ?? allAttendees.length;

  const verified    = allLog.filter((c) => c.status === "Verified").length;
  const pending     = allLog.filter((c) => c.status !== "Verified").length;
  const verifiedPct = allLog.length > 0 ? Math.round((verified / allLog.length) * 100) : null;

  const handleTokenScanned = useCallback((token: string) => {
    if (processing) return;
    setProcessing(true);
    scanQr.mutate(
      { eventId: event.id, qrToken: token },
      {
        onSuccess: (data) => {
          const name      = data?.fullName  ?? "Attendee";
          const kycStatus = data?.kycStatus ?? "Unknown";
          const time      = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
          const entry: CheckIn = {
            name,
            time,
            at:        new Date().toISOString(),
            status:    kycStatus === "None" ? "Pending KYC" : "Verified",
            kycStatus,
            avatarUrl: data?.avatarUrl ?? null,
          };
          setLastScan({ name, email: data?.email ?? "", seatRef: data?.seatRef ?? "—", kycStatus });
          onCheckin(entry);
          playCheckInSuccess();
          toast.success(`✓ ${name} checked in`);
          setProcessing(false);
        },
        onError: () => { playCheckInError(); setProcessing(false); },
      }
    );
  }, [event.id, processing, scanQr, onCheckin]);

  // Compact rows so the log reads well in the narrow walk-in sidebar and the wide scan view alike.
  const logCard = (
    <Card className="attend-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[hsl(var(--foreground))]">Check-In Log</h2>
        <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{totalCheckIns.toLocaleString()} checked in</span>
      </div>
      {mergedLog.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
          {mode === "walkin"
            ? "No check-ins yet. Walk-ins you check in will appear here."
            : "No check-ins yet. Start the camera and scan an attendee\u2019s QR code."}
        </div>
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] max-h-[340px] overflow-y-auto overscroll-contain">
          {mergedLog.map((c, i) => {
            const chip = KYC_COLORS[c.kycStatus] ?? { bg: "#9ca3af18", text: "#4b5563" };
            return (
              <li key={c.key ?? `${c.name}-${i}`} className="flex items-center gap-3 px-5 py-3">
                <UserAvatar src={c.avatarUrl ?? null} initials={initials(c.name)} color={color} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[hsl(var(--foreground))] truncate" title={c.name}>{c.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: chip.bg, color: chip.text }}>
                      {c.kycStatus}
                    </span>
                    {c.status !== "Verified" && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-50 text-amber-700">{c.status}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums shrink-0">{c.time}</span>
              </li>
            );
          })}
        </ul>
      )}
      {totalCheckIns > 0 && (
        <div className="px-5 py-3 border-t border-[hsl(var(--border))] text-xs">
          <span className="text-[hsl(var(--muted-foreground))] tabular-nums">
            {totalCheckIns > mergedLog.length
              ? `Showing the latest ${mergedLog.length.toLocaleString()} of ${totalCheckIns.toLocaleString()}`
              : `${totalCheckIns.toLocaleString()} total`}{mergedLog.length > 5 ? " · scroll for more" : ""}
          </span>
        </div>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Back + header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Events
        </button>
        <div className="flex items-center gap-3">
          {(event as any).branding?.logoUrl ? (
            <CachedImage src={(event as any).branding.logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover border border-[hsl(var(--border))] shrink-0" fallback={
              <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: color }}>{initials(event.registerName ?? event.title)}</div>
            } />
          ) : (
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: color }}>
              {initials(event.registerName ?? event.title)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{event.title}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {event.organiser || event.registerName} · {event.format}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={!soundOn}
            title={soundOn ? "Turn check-in sounds off" : "Turn check-in sounds on"}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />}
            {soundOn ? "Sound on" : "Sound off"}
          </button>
          <Link
            href={`/events/${event.id}`}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open event
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Check-Ins",   value: totalCheckIns,                                icon: Users,       accent: color     },
          { label: "Verified %",  value: verifiedPct != null ? `${verifiedPct}%` : "—",  icon: ShieldCheck, accent: "#16a34a" },
          { label: "Pending KYC", value: pending,                                          icon: Clock,       accent: "#f59e0b" },
        ].map((s) => (
          <Card key={s.label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.accent + "18" }}>
              <s.icon className="h-4 w-4" style={{ color: s.accent }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{s.value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* QR scan vs walk-in */}
      <div className="flex items-center gap-1 bg-[hsl(var(--muted))] rounded-full p-1 self-start" role="tablist">
        {([["scan", "Scan QR", QrCode], ["walkin", "Walk-in", UserCheck]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === k ? "bg-white shadow-sm text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === "walkin" ? (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <WalkInPanel
              eventId={event.id}
              color={color}
              // Walk-ins come back from the server list (refetched after each
              // check-in), so nothing is added locally — that kept duplicates out.
              onCheckedIn={() => {}}
            />
          </div>
          <div className="col-span-1">{logCard}</div>
        </div>
      ) : (
      /* Main grid */
      <div className="grid grid-cols-3 gap-5">

        {/* Left: camera + last scan + hardware input */}
        <div className="col-span-1 flex flex-col gap-4">
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Camera className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Camera Scanner</h2>
            </div>
            <div className="p-4">
              <LiveQrScanner color={color} onScan={handleTokenScanned} disabled={processing} />

              {/* Hardware scanner input */}
              <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                <p className="text-xs font-medium text-[hsl(var(--foreground))] mb-0.5">Using a handheld scanner?</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                  Click the box below once, then scan — the code goes in automatically.
                </p>
                <input
                  ref={hwInputRef}
                  value={hwToken}
                  onChange={(e) => setHwToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && hwToken.trim()) {
                      handleTokenScanned(hwToken.trim());
                      setHwToken("");
                    }
                  }}
                  onClick={() => hwInputRef.current?.focus()}
                  placeholder="Click here, then scan attendee code…"
                  disabled={processing}
                  className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]"
                />
              </div>

              {processing && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold" style={{ color }}>
                  <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: color, borderTopColor: "transparent" }} />
                  Checking in…
                </div>
              )}
            </div>
          </Card>

          {/* Last scan */}
          {lastScan && (
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Last Check-In</h2>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[hsl(var(--foreground))]">{lastScan.name}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: KYC_COLORS[lastScan.kycStatus]?.bg ?? "#9ca3af18", color: KYC_COLORS[lastScan.kycStatus]?.text ?? "#6b7280" }}>
                    {lastScan.kycStatus}
                  </span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{lastScan.email}</p>
                {lastScan.seatRef !== "—" && (
                  <p className="text-xs">
                    <span className="text-[hsl(var(--muted-foreground))]">Seat: </span>
                    <span className="font-semibold text-[hsl(var(--foreground))]">{lastScan.seatRef}</span>
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Checked in successfully
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right: check-in log + RSVP list */}
        <div className="col-span-2 flex flex-col gap-5">
          {logCard}

          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Registered Attendees</h2>
              <span className="text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
                {totalRegistered > attendees.length
                  ? `Latest ${attendees.length} of ${totalRegistered.toLocaleString()}`
                  : `${totalRegistered.toLocaleString()} registered`}
              </span>
            </div>
            {attendeesLoading ? (
              <div className="py-8 flex items-center justify-center"><Loader variant="inline" text="Loading…" /></div>
            ) : attendees.length === 0 ? (
              <div className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No registered attendees yet.</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="attend-table-header">
                    <th className="px-5 py-3 text-left">Name</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">KYC</th>
                  </tr>
                </thead>
                <tbody>
                  {attendees.map((a) => {
                    const kycText = kycLabel(a.kycStatus);
                    const kyc = KYC_COLORS[kycText] ?? KYC_COLORS["Unknown"];
                    return (
                      <tr key={a.id} className="attend-table-row">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <UserAvatar
                              src={(a as any).avatarUrl ?? null}
                              initials={a.initials ?? initials(a.fullName)}
                              color={a.avatarColor ?? color}
                              size={28}
                            />
                            <span className="text-sm font-medium text-[hsl(var(--foreground))]">{a.fullName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{a.email}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: kyc.bg, color: kyc.text }}>
                            {kycText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event list (Level 1)
// Checkins state is lifted here, keyed by eventId, so it persists when
// navigating back to this list and re-entering the same event's scanner.
// ---------------------------------------------------------------------------

function QRCheckInPageInner() {
  const { data: eventsData, isLoading } = useClientEvents("ALL", 0, 100);
  const allEvents  = eventsData?.events ?? [];
  const liveEvents = allEvents.filter(
    (e) => e.status?.toUpperCase() === "LIVE" && isPhysicalCheckInEvent(e.format)
  );

  // ?eventId= — a phone at the door that reloads (or sleeps and wakes) should
  // come back to the scanner it was on, not to the event picker.
  const [eventIdParam, setEventIdParam] = useUrlState("eventId");
  const selectedEventId = eventIdParam || null;
  const setSelectedEventId = setEventIdParam;
  // Keyed by eventId so checkins survive navigating back and forth
  const [checkinsByEvent, setCheckinsByEvent]         = useState<Record<string, CheckIn[]>>({});

  const selectedEvent = liveEvents.find((e) => e.id === selectedEventId);

  function addCheckin(eventId: string, entry: CheckIn) {
    setCheckinsByEvent((prev) => ({
      ...prev,
      [eventId]: [entry, ...(prev[eventId] ?? [])],
    }));
  }

  if (selectedEvent) {
    const color = eventColor(selectedEvent.eventType);
    return (
      <ScannerView
        event={{ ...selectedEvent, organiser: selectedEvent.registerName ?? "" }}
        color={color}
        checkins={checkinsByEvent[selectedEvent.id] ?? []}
        onCheckin={(entry) => addCheckin(selectedEvent.id, entry)}
        onBack={() => setSelectedEventId(null)}
      />
    );
  }

  if (isLoading) return <Loader variant="page" text="Loading events…" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">QR Check-In</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Select an event to open the camera scanner</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Live Events",   value: liveEvents.length,                                                     icon: QrCode,      accent: "#dc2626" },
          { label: "Total RSVPs",   value: liveEvents.reduce((n, e) => n + (e.rsvpCount ?? 0), 0),               icon: Users,       accent: "#7c22c9" },
          { label: "Checked In",    value: Object.values(checkinsByEvent).reduce((n, arr) => n + arr.length, 0),  icon: ShieldCheck, accent: "#16a34a" },
        ].map((s) => (
          <Card key={s.label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.accent + "18" }}>
              <s.icon className="h-4 w-4" style={{ color: s.accent }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{s.value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="attend-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Events</h2>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{liveEvents.length} available</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Event</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Format</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">RSVPs</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {liveEvents.map((evt) => {
                const modColor = eventColor(evt.eventType);
                const isLive   = evt.status === "LIVE";
                const sessionCount = (checkinsByEvent[evt.id] ?? []).length;
                return (
                  <tr key={evt.id} className="attend-table-row">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {(evt as any).branding?.logoUrl ? (
                          <CachedImage src={(evt as any).branding.logoUrl} alt="" className="h-9 w-9 rounded-xl object-cover border border-[hsl(var(--border))] shrink-0" fallback={
                            <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: modColor }}>{initials(evt.registerName ?? evt.title)}</div>
                          } />
                        ) : (
                          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: modColor }}>
                            {initials(evt.registerName ?? evt.title)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">{evt.title}</p>
                          {evt.registerName && <p className="text-xs text-[hsl(var(--muted-foreground))]">{evt.registerName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: modColor }}>
                        {evt.eventType ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm capitalize text-[hsl(var(--foreground))]">
                      {evt.format?.toLowerCase() ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={isLive ? { backgroundColor: "#16a34a18", color: "#16a34a" } : { backgroundColor: "#11182710", color: "#374151" }}>
                        {isLive && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
                        {evt.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">
                      {evt.rsvpCount ?? 0}
                      {sessionCount > 0 && (
                        <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">
                          · {sessionCount} checked in
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Button size="sm" className="h-8 gap-1.5 text-xs text-white" style={{ backgroundColor: modColor }}
                        onClick={() => setSelectedEventId(evt.id)}>
                        <Camera className="h-3.5 w-3.5" /> Open Scanner
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {liveEvents.length === 0 && (
            <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
              No live hybrid or in-person events are available for check-in.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * useSearchParams needs a Suspense boundary — without one this route opts out
 * of static rendering and the build errors.
 */
export default function QRCheckInPage() {
  return (
    <Suspense fallback={<Loader variant="page" text="Loading events…" />}>
      <QRCheckInPageInner />
    </Suspense>
  );
}

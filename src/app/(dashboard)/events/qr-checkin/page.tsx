"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { toast } from "sonner";
import {
  QrCode, CheckCircle2, ShieldCheck, Clock, Users, ChevronRight,
  Camera, CameraOff, XCircle,
} from "lucide-react";
import { useClientScanQr, useClientEvents, useClientEventAttendees } from "@/api/client-events";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KYC_COLORS: Record<string, { bg: string; text: string }> = {
  "Full KYC":  { bg: "#16a34a18", text: "#16a34a" },
  "Basic KYC": { bg: "#11182718", text: "#111827" },
  "Pending":   { bg: "#f59e0b18", text: "#d97706" },
  "None":      { bg: "#9ca3af18", text: "#6b7280" },
  "Unknown":   { bg: "#9ca3af18", text: "#6b7280" },
};

const MODULE_COLORS: Record<string, string> = {
  AGM:                  "#7c22c9",
  AGM_EGM:              "#7c22c9",
  LAUNCH:               "#ea6c00",
  PRODUCT_LAUNCH:       "#ea6c00",
  HACKATHON:            "#7c22c9",
  INNOVATION_CHALLENGE: "#7c22c9",
  GENERAL:              "#7c22c9",
  GENERAL_EVENT:        "#7c22c9",
};

interface CheckIn { name: string; time: string; status: string; kycStatus: string; }

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Live camera QR scanner component
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
      // Dynamically import so Next.js SSR doesn't choke on browser-only lib
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode("qr-camera-feed");
      scannerRef.current = qr;

      await qr.start(
        { facingMode: "environment" },          // rear camera on mobile; webcam on desktop
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          // Debounce: ignore the same token within 3 s
          if (cooldownRef.current) return;
          if (decodedText === lastTokenRef.current) return;

          lastTokenRef.current = decodedText;
          cooldownRef.current  = true;
          setTimeout(() => { cooldownRef.current = false; }, 3000);

          onScan(decodedText);
        },
        () => { /* frame decode errors — ignore */ }
      );
      setActive(true);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.toLowerCase().includes("permission")) {
        setError("Camera permission denied. Please allow camera access in your browser settings.");
      } else {
        setError("Could not start camera. Make sure no other app is using it.");
      }
    }
  }, [onScan]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (_) {}
      scannerRef.current = null;
    }
    setActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  return (
    <div className="flex flex-col gap-3">
      {/* Camera viewport */}
      <div
        className="relative rounded-2xl overflow-hidden border-2"
        style={{
          borderColor: active ? color : "hsl(var(--border))",
          aspectRatio: "1 / 1",
          background: "#000",
        }}
      >
        {/* html5-qrcode mounts the <video> tag into this div */}
        <div id="qr-camera-feed" className="w-full h-full" />

        {/* Overlay when camera is off */}
        {!active && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
            style={{ backgroundColor: "#00000090" }}
          >
            {error ? (
              <>
                <XCircle className="h-10 w-10 text-red-400" />
                <p className="text-xs text-red-300 text-center px-4">{error}</p>
              </>
            ) : (
              <>
                <QrCode className="h-12 w-12 text-white/60" />
                <p className="text-sm text-white/70">Camera off</p>
              </>
            )}
          </div>
        )}

        {/* Scanning crosshair overlay */}
        {active && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="h-[220px] w-[220px] rounded-2xl border-2"
              style={{ borderColor: color, boxShadow: `0 0 0 9999px rgba(0,0,0,0.45)` }}
            />
          </div>
        )}

        {/* Live indicator */}
        {active && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1">
            <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            <span className="text-xs text-white font-semibold">Live</span>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <Button
        className="w-full gap-2 text-white"
        style={{ backgroundColor: active ? "#6b7280" : color }}
        disabled={disabled}
        onClick={active ? stopScanner : startScanner}
      >
        {active ? (
          <><CameraOff className="h-4 w-4" /> Stop Camera</>
        ) : (
          <><Camera className="h-4 w-4" /> Start Camera Scan</>
        )}
      </Button>

      <p className="text-xs text-center text-[hsl(var(--muted-foreground))]">
        Point the camera at the attendee&apos;s QR code on their phone
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scanner detail view (Level 2)
// ---------------------------------------------------------------------------

function ScannerView({ event, color, onBack }: { event: any; color: string; onBack: () => void }) {
  const [lastScan, setLastScan]     = useState<{ name: string; email: string; seatRef: string; kycStatus: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [checkins, setCheckins]     = useState<CheckIn[]>([]);
  const [hwToken, setHwToken]       = useState("");
  const hwInputRef                  = useRef<HTMLInputElement>(null);

  const scanQr = useClientScanQr();
  const { data: attendeeData, isLoading: attendeesLoading } = useClientEventAttendees(event.id, "", 0, 50);
  const attendees = attendeeData?.attendees ?? [];

  const verified    = checkins.filter((c) => c.status === "Verified").length;
  const pending     = checkins.filter((c) => c.status !== "Verified").length;
  const verifiedPct = checkins.length > 0 ? Math.round((verified / checkins.length) * 100) : null;

  const handleTokenScanned = useCallback((token: string) => {
    if (processing) return;
    setProcessing(true);

    scanQr.mutate(
      { eventId: event.id, qrToken: token },
      {
        onSuccess: (data) => {
          const name      = data?.fullName  ?? "Attendee";
          const kycStatus = data?.kycStatus ?? "Unknown";
          setLastScan({
            name,
            email:     data?.email   ?? "",
            seatRef:   data?.seatRef ?? "—",
            kycStatus,
          });
          const time = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
          setCheckins((prev) => [
            { name, time, status: kycStatus === "None" ? "Pending KYC" : "Verified", kycStatus },
            ...prev,
          ]);
          toast.success(`✓ ${name} checked in`);
          setProcessing(false);
        },
        onError: () => { setProcessing(false); },
      }
    );
  }, [event.id, processing, scanQr]);

  return (
    <div className="flex flex-col gap-6">
      {/* Back + header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Back to Events
        </button>
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: color }}
          >
            {initials(event.registerName ?? event.title)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{event.title}</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              {event.organiser || event.registerName} · {event.format}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Check-Ins Today",  value: checkins.length,                                       icon: Users,       accent: color     },
          { label: "Verified %",        value: verifiedPct != null ? `${verifiedPct}%` : "—",        icon: ShieldCheck, accent: "#16a34a" },
          { label: "Pending KYC",       value: pending,                                               icon: Clock,       accent: "#f59e0b" },
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

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-5">

        {/* Left: camera + last scan */}
        <div className="col-span-1 flex flex-col gap-4">
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <Camera className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Camera Scanner</h2>
            </div>
            <div className="p-4">
              <LiveQrScanner color={color} onScan={handleTokenScanned} disabled={processing} />

              {/* Hardware scanner input — always visible, always focused */}
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
                  style={{ focusRingColor: color } as any}
                />
              </div>

              {/* Processing overlay pill */}
              {processing && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold" style={{ color }}>
                  <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: color, borderTopColor: "transparent" }} />
                  Checking in…
                </div>
              )}
            </div>
          </Card>

          {/* Last scan result */}
          {lastScan && (
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Last Check-In</h2>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[hsl(var(--foreground))]">{lastScan.name}</span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: KYC_COLORS[lastScan.kycStatus]?.bg ?? "#9ca3af18", color: KYC_COLORS[lastScan.kycStatus]?.text ?? "#6b7280" }}
                  >
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
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Check-In Log</h2>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{checkins.length} this session</span>
            </div>
            {checkins.length === 0 ? (
              <div className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No check-ins yet — start the camera and scan an attendee&apos;s QR code.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="attend-table-header">
                    <th className="px-5 py-3 text-left">Attendee</th>
                    <th className="px-5 py-3 text-left">Time</th>
                    <th className="px-5 py-3 text-left">KYC</th>
                    <th className="px-5 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {checkins.map((c, i) => (
                    <tr key={i} className="attend-table-row">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: color }}>
                            {initials(c.name)}
                          </div>
                          <span className="text-sm font-medium text-[hsl(var(--foreground))]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] tabular-nums">{c.time}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: KYC_COLORS[c.kycStatus]?.bg ?? "#9ca3af18", color: KYC_COLORS[c.kycStatus]?.text ?? "#6b7280" }}>
                          {c.kycStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={c.status === "Verified"
                            ? { backgroundColor: "#16a34a18", color: "#16a34a" }
                            : { backgroundColor: "#f59e0b18", color: "#d97706" }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Registered Attendees</h2>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{attendees.length} registered</span>
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
                    const kyc = KYC_COLORS[a.kycStatus] ?? KYC_COLORS["Unknown"];
                    return (
                      <tr key={a.id} className="attend-table-row">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ backgroundColor: a.avatarColor ?? color }}>
                              {a.initials ?? initials(a.fullName)}
                            </div>
                            <span className="text-sm font-medium text-[hsl(var(--foreground))]">{a.fullName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{a.email}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: kyc.bg, color: kyc.text }}>
                            {a.kycStatus}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event list (Level 1)
// ---------------------------------------------------------------------------

export default function QRCheckInPage() {
  const { data: eventsData, isLoading } = useClientEvents("ALL", 0, 100);
  const allEvents  = eventsData?.events ?? [];
  const liveEvents = allEvents.filter((e) => e.status === "LIVE" || e.status === "PUBLISHED");

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = liveEvents.find((e) => e.id === selectedEventId);

  if (selectedEvent) {
    const color = MODULE_COLORS[selectedEvent.eventType] ?? "#7c22c9";
    return (
      <ScannerView
        event={{ ...selectedEvent, organiser: selectedEvent.registerName ?? "" }}
        color={color}
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
          { label: "Available Events", value: liveEvents.length,                                      icon: QrCode,      accent: "#7c22c9" },
          { label: "Live Now",          value: allEvents.filter(e => e.status === "LIVE").length,     icon: Users,       accent: "#7c22c9" },
          { label: "Published",         value: allEvents.filter(e => e.status === "PUBLISHED").length, icon: ShieldCheck, accent: "#16a34a" },
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
                const modColor = MODULE_COLORS[evt.eventType] ?? "#7c22c9";
                const isLive   = evt.status === "LIVE";
                return (
                  <tr key={evt.id} className="attend-table-row">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: modColor }}>
                          {initials(evt.registerName ?? evt.title)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">{evt.title}</p>
                          {evt.registerName && <p className="text-xs text-[hsl(var(--muted-foreground))]">{evt.registerName}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: modColor }}>
                        {evt.eventType ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm capitalize text-[hsl(var(--foreground))]">
                      {evt.format?.toLowerCase() ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={isLive
                          ? { backgroundColor: "#16a34a18", color: "#16a34a" }
                          : { backgroundColor: "#11182710", color: "#374151" }}>
                        {isLive && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
                        {evt.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">
                      {evt.rsvpCount ?? 0}
                    </td>
                    <td className="px-5 py-4">
                      <Button size="sm" className="h-8 gap-1.5 text-xs text-white"
                        style={{ backgroundColor: modColor }}
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
              No live or published events available for check-in.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

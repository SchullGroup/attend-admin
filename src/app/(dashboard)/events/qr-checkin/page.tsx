"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/Loader";
import { toast } from "sonner";
import { QrCode, CheckCircle2, ShieldCheck, Clock, Users, Wifi, ChevronRight } from "lucide-react";
import { useClientScanQr, useClientEvents } from "@/api/client-events";

const MOCK_ATTENDEES = [
  { name: "Ngozi Okafor",    email: "ngozi.okafor@email.com",     seatRef: "A-14", kycStatus: "Full KYC" },
  { name: "Emeka Eze",       email: "emeka.eze@gtco.com",         seatRef: "B-07", kycStatus: "Full KYC" },
  { name: "Chidera Obi",     email: "chidera.obi@fintech.ng",     seatRef: "C-22", kycStatus: "Basic KYC" },
  { name: "Tolu Adeyemi",    email: "tolu@unilag.edu.ng",         seatRef: "D-03", kycStatus: "None" },
  { name: "Biodun Adeola",   email: "biodun.adeola@insurance.ng", seatRef: "A-31", kycStatus: "Pending" },
  { name: "Adaeze Nwosu",    email: "adaeze.nwosu@gmail.com",     seatRef: "B-19", kycStatus: "Full KYC" },
  { name: "Babatunde Lawal", email: "babatunde.lawal@access.ng",  seatRef: "E-08", kycStatus: "Full KYC" },
];

const SEED_CHECKINS = [
  { name: "Yetunde Abiodun", time: "09:14 AM", method: "QR Scan", status: "Verified" },
  { name: "Gbenga Falola",   time: "09:11 AM", method: "QR Scan", status: "Verified" },
  { name: "Aisha Musa",      time: "09:08 AM", method: "QR Scan", status: "Verified" },
  { name: "Chiamaka Eze",    time: "09:05 AM", method: "QR Scan", status: "Verified" },
  { name: "Nnamdi Obi",      time: "09:01 AM", method: "QR Scan", status: "Verified" },
];

const KYC_COLORS: Record<string, { bg: string; text: string }> = {
  "Full KYC":  { bg: "#16a34a18", text: "#16a34a" },
  "Basic KYC": { bg: "#11182718", text: "#111827" },
  "Pending":   { bg: "#f59e0b18", text: "#d97706" },
  "None":      { bg: "#9ca3af18", text: "#6b7280" },
};

const MODULE_COLORS: Record<string, string> = {
  AGM: "#111827", LAUNCH: "#ea6c00", HACKATHON: "#7c22c9", GENERAL: "#0891b2",
};

interface CheckIn { name: string; time: string; method: string; status: string; }
interface ScannedAttendee { name: string; email: string; seatRef: string; kycStatus: string; }

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ── Level 2: scanner detail ───────────────────────────────────────────────────

function ScannerView({ event, onBack }: { event: any; onBack: () => void }) {
  const [scanIndex, setScanIndex]   = useState(0);
  const [qrToken, setQrToken]       = useState("");
  const [lastScan, setLastScan]     = useState<ScannedAttendee | null>(null);
  const [scanning, setScanning]     = useState(false);
  const [checkins, setCheckins]     = useState<CheckIn[]>(SEED_CHECKINS);
  const [totalToday, setTotalToday] = useState(SEED_CHECKINS.length);

  const scanQr = useClientScanQr();

  function handleScan(tokenOverride?: string) {
    const token = tokenOverride ?? qrToken.trim();

    // If a real token is provided, call the API
    if (token) {
      setScanning(true);
      scanQr.mutate(
        { eventId: event.id, qrToken: token },
        {
          onSuccess: (data) => {
            const name = data?.fullName ?? "Attendee";
            const attendee: ScannedAttendee = {
              name,
              email:     data?.email     ?? "",
              seatRef:   data?.seatRef   ?? "—",
              kycStatus: data?.kycStatus ?? "Unknown",
            };
            setLastScan(attendee);
            setQrToken("");
            setScanning(false);
            const time = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
            setCheckins((prev) => [
              { name, time, method: "QR Scan", status: "Verified" },
              ...prev,
            ]);
            setTotalToday((n) => n + 1);
            toast.success(`${name} checked in successfully`);
          },
          onError: () => { setScanning(false); },
        }
      );
      return;
    }

    // Fallback: simulate scan for demo purposes
    setScanning(true);
    setTimeout(() => {
      const attendee = MOCK_ATTENDEES[scanIndex % MOCK_ATTENDEES.length];
      setScanIndex((i) => i + 1);
      setLastScan(attendee);
      setScanning(false);
      const time = new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
      setCheckins((prev) => [
        { name: attendee.name, time, method: "QR Scan", status: attendee.kycStatus === "None" ? "Pending KYC" : "Verified" },
        ...prev,
      ]);
      setTotalToday((n) => n + 1);
      toast.success(`${attendee.name} checked in successfully`);
    }, 900);
  }

  const verified    = checkins.filter((c) => c.status === "Verified").length;
  const pending     = checkins.filter((c) => c.status === "Pending KYC").length;
  const verifiedPct = checkins.length > 0 ? Math.round((verified / checkins.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Back + header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-4 transition-colors"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to Events
        </button>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">{event.title}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">{event.organiser} · {event.format}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Today's Check-Ins", value: totalToday,         icon: Users,       accent: "#111827" },
          { label: "Verified %",         value: `${verifiedPct}%`, icon: ShieldCheck, accent: "#16a34a" },
          { label: "Pending KYC",        value: pending,           icon: Clock,       accent: "#f59e0b" },
        ].map((stat) => (
          <Card key={stat.label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stat.accent + "18" }}>
              <stat.icon className="h-4.5 w-4.5" style={{ color: stat.accent }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{stat.value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-1 flex flex-col gap-4">
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Scanner</h2>
              <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-semibold">
                <Wifi className="h-3 w-3" /> Ready
              </span>
            </div>
            <div className="p-5">
              <div
                className="aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 mb-4"
                style={{ borderColor: "#16a34a", backgroundColor: "#16a34a08" }}
              >
                {scanning ? (
                  <>
                    <div className="h-16 w-16 rounded-2xl animate-pulse flex items-center justify-center" style={{ backgroundColor: "#16a34a18" }}>
                      <QrCode className="h-8 w-8" style={{ color: "#16a34a" }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "#16a34a" }}>Scanning…</p>
                  </>
                ) : (
                  <>
                    <QrCode className="h-12 w-12" style={{ color: "#16a34a" }} />
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Scan Attendee QR Code</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] text-center px-4">
                      Point scanner at attendee&apos;s QR code to check in
                    </p>
                  </>
                )}
              </div>
              {/* QR token input for real scans */}
              <Input
                placeholder="Paste QR token…"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && qrToken.trim()) handleScan(); }}
                className="mb-2 text-sm"
              />
              <Button className="w-full" disabled={scanning} onClick={() => handleScan()} style={{ backgroundColor: "#16a34a", color: "white" }}>
                <QrCode className="h-4 w-4 mr-2" />
                {scanning ? "Scanning…" : qrToken.trim() ? "Check In" : "Simulate Scan"}
              </Button>
            </div>
          </Card>

          {lastScan && (
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Last Scan</h2>
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
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Seat:</span>
                  <span className="text-xs font-semibold text-[hsl(var(--foreground))]">{lastScan.seatRef}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Check-in successful
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="col-span-2">
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">Recent Check-Ins</h2>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{checkins.length} total</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Attendee</th>
                  <th className="px-5 py-3 text-left">Time</th>
                  <th className="px-5 py-3 text-left">Method</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c, i) => (
                  <tr key={i} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: "#16a34a" }}>
                          {initials(c.name)}
                        </div>
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] tabular-nums">{c.time}</td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">{c.method}</td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={c.status === "Verified"
                          ? { backgroundColor: "#16a34a18", color: "#16a34a" }
                          : { backgroundColor: "#f59e0b18", color: "#d97706" }}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Level 1: events table ─────────────────────────────────────────────────────

export default function QRCheckInPage() {
  const { data: eventsData, isLoading } = useClientEvents("ALL", 0, 100);
  const allEvents  = eventsData?.events ?? [];
  // Show LIVE and PUBLISHED events — check-in makes sense for both
  const liveEvents = allEvents.filter(
    (e) => e.status === "LIVE" || e.status === "PUBLISHED"
  );

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const selectedEvent = liveEvents.find((e) => e.id === selectedEventId);
  if (selectedEvent) return <ScannerView event={{ ...selectedEvent, organiser: selectedEvent.registerName ?? "", module: selectedEvent.eventType ?? "GENERAL" }} onBack={() => setSelectedEventId(null)} />;

  if (isLoading) return <Loader variant="page" text="Loading events…" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">QR Check-In</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Select an event to open the check-in scanner</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Available Events", value: liveEvents.length, icon: QrCode,      accent: "#111827" },
          { label: "Live Now",         value: allEvents.filter(e => e.status === "LIVE").length, icon: Users, accent: "#7c22c9" },
          { label: "Published",        value: allEvents.filter(e => e.status === "PUBLISHED").length, icon: ShieldCheck, accent: "#16a34a" },
        ].map((stat) => (
          <Card key={stat.label} className="attend-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: stat.accent + "18" }}>
              <stat.icon className="h-4.5 w-4.5" style={{ color: stat.accent }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[hsl(var(--foreground))]">{stat.value}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{stat.label}</p>
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
                <th className="px-5 py-3 text-left">Module</th>
                <th className="px-5 py-3 text-left">Format</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Check-Ins</th>
                <th className="px-5 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {liveEvents.map((evt) => {
                const modColor = MODULE_COLORS[evt.eventType ?? "GENERAL"] ?? "#111827";
                const isLive   = evt.status === "LIVE";
                return (
                  <tr key={evt.id} className="attend-table-row">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: modColor }}
                        >
                          {initials(evt.registerName ?? evt.title)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate max-w-[220px]">{evt.title}</p>
                          {evt.registerName && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{evt.registerName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: modColor }}
                      >
                        {evt.eventType ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[hsl(var(--foreground))] capitalize">
                      {evt.format?.toLowerCase() ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={isLive
                          ? { backgroundColor: "#16a34a18", color: "#16a34a" }
                          : { backgroundColor: "#11182710", color: "#374151" }}
                      >
                        {isLive && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
                        <span className="capitalize">{evt.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold tabular-nums text-[hsl(var(--foreground))]">
                      {evt.rsvpCount ?? 0}
                    </td>
                    <td className="px-5 py-4">
                      <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setSelectedEventId(evt.id)}>
                        Open Check-In <ChevronRight className="h-3.5 w-3.5" />
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

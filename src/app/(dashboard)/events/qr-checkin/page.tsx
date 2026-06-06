"use client";
import { useState, useEffect } from "react";
import { useEvents, useEventAttendees } from "@/api/super-admin";
import { useApproveKyc, useDeclineKyc } from "@/api/participants";
import { Loader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  QrCode,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Users,
  Wifi,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CheckIn {
  id?: string;
  name: string;
  time: string;
  method: string;
  status: string;
}

interface ScannedAttendee {
  id: string;
  name: string;
  email: string;
  seatRef: string;
  kycStatus: string;
}

const KYC_COLORS: Record<string, { bg: string; text: string }> = {
  "Full KYC": { bg: "#16a34a18", text: "#16a34a" },
  "Basic KYC": { bg: "#2563eb18", text: "#2563eb" },
  Pending: { bg: "#f59e0b18", text: "#d97706" },
  None: { bg: "#9ca3af18", text: "#6b7280" },
};

function getEventStatusColor(status: string) {
  const s = status.toLowerCase();
  if (s === "live") return "#16a34a";
  if (s === "published") return "#1d4ed8";
  return "#6b7280";
}


export default function QRCheckInPage() {
  const { data: eventsData, isLoading: isEventsLoading } = useEvents("", 0, 100);
  const liveEvents = eventsData?.data?.content?.filter(
    (e: any) => e.status === "LIVE" || e.status === "PUBLISHED"
  ) || [];

  const [selectedEventId, setSelectedEventId] = useState("");
  const { data: attendeesData } = useEventAttendees(selectedEventId, 0, 100);

  const approveKycMutation = useApproveKyc();
  const declineKycMutation = useDeclineKyc();
  const isKycMutating = approveKycMutation.isPending || declineKycMutation.isPending;

  const [scanIndex, setScanIndex] = useState(0);
  const [lastScan, setLastScan] = useState<ScannedAttendee | null>(null);
  const [scanning, setScanning] = useState(false);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [totalToday, setTotalToday] = useState(0);

  useEffect(() => {
    if (liveEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(liveEvents[0].id);
    }
  }, [liveEvents, selectedEventId]);

  const handleApproveKyc = (participantId: string) => {
    approveKycMutation.mutate({
      id: participantId,
      data: {
        kycLevel: "FULL_KYC",
        note: "Approved via QR Check-in scanner",
      },
    }, {
      onSuccess: () => {
        setLastScan((prev) => prev && prev.id === participantId ? { ...prev, kycStatus: "Full KYC" } : prev);
        setCheckins((prev) =>
          prev.map((c) =>
            c.id === participantId ? { ...c, status: "Verified" } : c
          )
        );
      }
    });
  };

  const handleDeclineKyc = (participantId: string) => {
    declineKycMutation.mutate({
      id: participantId,
      data: {
        reason: "Declined via QR Check-in scanner",
      },
    }, {
      onSuccess: () => {
        setLastScan((prev) => prev && prev.id === participantId ? { ...prev, kycStatus: "None" } : prev);
        setCheckins((prev) =>
          prev.map((c) =>
            c.id === participantId ? { ...c, status: "Pending KYC" } : c
          )
        );
      }
    });
  };

  function simulateScan() {
    setScanning(true);
    setTimeout(() => {
      const attendeePool = attendeesData?.data?.attendees || [];
      if (attendeePool.length === 0) {
        toast.error("No registered attendees for this event to simulate scan.");
        setScanning(false);
        return;
      }
      const attendee = attendeePool[scanIndex % attendeePool.length];
      setScanIndex((i) => i + 1);

      const isFull = attendee.kycStatus === "FULL_KYC" || attendee.kycStatus === "full" || attendee.kycStatus === "Full KYC";
      const isBasic = attendee.kycStatus === "BASIC_KYC" || attendee.kycStatus === "basic" || attendee.kycStatus === "Basic KYC";
      const kycStatusLabel = isFull ? "Full KYC" : isBasic ? "Basic KYC" : "None";

      const parsedAttendee = {
        id: attendee.id || attendee.participantId || `mock_${scanIndex}`,
        name: attendee.fullName || attendee.name || "Anonymous",
        email: attendee.email || "",
        seatRef: attendee.seatRef || `Seat-${12 + (scanIndex % 80)}`,
        kycStatus: kycStatusLabel,
      };

      setLastScan(parsedAttendee);
      setScanning(false);

      const now = new Date();
      const time = now.toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const newCheckin: CheckIn = {
        id: parsedAttendee.id,
        name: parsedAttendee.name,
        time,
        method: "QR Scan",
        status: parsedAttendee.kycStatus === "None" ? "Pending KYC" : "Verified",
      };
      setCheckins((prev) => [newCheckin, ...prev]);
      setTotalToday((n) => n + 1);
      toast.success(`${parsedAttendee.name} checked in successfully`);
    }, 900);
  }

  const verified = checkins.filter((c: CheckIn) => c.status === "Verified").length;
  const pending = checkins.filter((c: CheckIn) => c.status === "Pending KYC").length;
  const verifiedPct =
    checkins.length > 0 ? Math.round((verified / checkins.length) * 100) : 0;

  const selectedEvent = liveEvents.find((e: any) => e.id === selectedEventId);

  if (isEventsLoading) {
    return <Loader variant="page" text="Loading Events..." />;
  }

  return (
    <div className="relative">
      {isKycMutating && <Loader variant="overlay" text="Updating KYC status..." />}
      <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          QR Check-In Dashboard
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Scan attendee QR codes to verify and log check-ins in real time.
        </p>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Today's Check-Ins",
            value: totalToday,
            icon: Users,
            accent: "#2563eb",
          },
          {
            label: "Verified %",
            value: `${verifiedPct}%`,
            icon: ShieldCheck,
            accent: "#16a34a",
          },
          {
            label: "Pending KYC",
            value: pending,
            icon: Clock,
            accent: "#f59e0b",
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="attend-card p-4 flex items-center gap-4"
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: stat.accent + "18" }}
            >
              <stat.icon className="h-5 w-5" style={{ color: stat.accent }} />
            </div>
            <div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">
                {stat.label}
              </p>
              <p className="text-2xl font-bold tabular-nums text-[hsl(var(--foreground))]">
                {stat.value}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left: Scanner */}
        <div className="col-span-1 flex flex-col gap-4">
          {/* Event selector */}
          <Card className="attend-card p-4">
            <label className="block text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-2">
              Select Event
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full text-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
            >
              {liveEvents.map((evt: any) => (
                <option key={evt.id} value={evt.id}>
                  {evt.title}
                </option>
              ))}
            </select>
            {selectedEvent && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold capitalize"
                  style={{
                    backgroundColor: getEventStatusColor(selectedEvent.status) + "18",
                    color: getEventStatusColor(selectedEvent.status),
                  }}
                >
                  {selectedEvent.status.toLowerCase()}
                </span>
                <span>{selectedEvent.format}</span>
              </div>
            )}
          </Card>

          {/* QR Scanner area */}
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
              <QrCode className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <h2 className="font-semibold text-[hsl(var(--foreground))]">
                Scanner
              </h2>
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
                    <div
                      className="h-16 w-16 rounded-2xl animate-pulse flex items-center justify-center"
                      style={{ backgroundColor: "#16a34a18" }}
                    >
                      <QrCode
                        className="h-8 w-8"
                        style={{ color: "#16a34a" }}
                      />
                    </div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "#16a34a" }}
                    >
                      Scanning…
                    </p>
                  </>
                ) : (
                  <>
                    <QrCode
                      className="h-12 w-12"
                      style={{ color: "#16a34a" }}
                    />
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      Scan Attendee QR Code
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] text-center px-4">
                      Point scanner at attendee&apos;s QR code to check in
                    </p>
                  </>
                )}
              </div>
              <Button
                className="w-full"
                disabled={scanning}
                onClick={simulateScan}
                style={{ backgroundColor: "#16a34a", color: "white" }}
              >
                <QrCode className="h-4 w-4 mr-2" />
                {scanning ? "Scanning…" : "Simulate Scan"}
              </Button>
            </div>
          </Card>

          {/* Last scan result */}
          {lastScan && (
            <Card className="attend-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="font-semibold text-[hsl(var(--foreground))]">
                  Last Scan
                </h2>
              </div>
              <div className="px-5 py-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[hsl(var(--foreground))]">
                    {lastScan.name}
                  </span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        KYC_COLORS[lastScan.kycStatus]?.bg ?? "#9ca3af18",
                      color: KYC_COLORS[lastScan.kycStatus]?.text ?? "#6b7280",
                    }}
                  >
                    {lastScan.kycStatus}
                  </span>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {lastScan.email}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    Seat:
                  </span>
                  <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
                    {lastScan.seatRef}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Check-in successful
                </div>
                {lastScan.kycStatus === "None" && (
                  <div className="mt-3 pt-3 border-t border-[hsl(var(--border))] flex gap-2">
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-green-600 hover:bg-green-700 text-white flex-1"
                      onClick={() => handleApproveKyc(lastScan.id)}
                      disabled={isKycMutating}
                    >
                      Approve KYC
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 text-red-600 border-red-200 hover:bg-red-50 flex-1"
                      onClick={() => handleDeclineKyc(lastScan.id)}
                      disabled={isKycMutating}
                    >
                      Decline KYC
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Recent check-ins table */}
        <div className="col-span-2">
          <Card className="attend-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
              <h2 className="font-semibold text-[hsl(var(--foreground))]">
                Recent Check-Ins
              </h2>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {checkins.length} total
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="attend-table-header">
                  <th className="px-5 py-3 text-left">Attendee</th>
                  <th className="px-5 py-3 text-left">Time</th>
                  <th className="px-5 py-3 text-left">Method</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c, i) => (
                  <tr key={i} className="attend-table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: "#16a34a" }}
                        >
                          {c.name
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] tabular-nums">
                      {c.time}
                    </td>
                    <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                      {c.method}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={
                          c.status === "Verified"
                            ? { backgroundColor: "#16a34a18", color: "#16a34a" }
                            : { backgroundColor: "#f59e0b18", color: "#d97706" }
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {c.status === "Pending KYC" && c.id && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveKyc(c.id!)}
                            disabled={isKycMutating}
                            className="text-xs text-green-600 hover:text-green-700 font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDeclineKyc(c.id!)}
                            disabled={isKycMutating}
                            className="text-xs text-red-600 hover:text-red-700 font-semibold"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {c.status === "Verified" && (
                        <span className="text-xs text-gray-400">Verified</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
    </div>
  );
}

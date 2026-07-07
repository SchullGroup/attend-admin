"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Mail, Hash, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { useStakeholders } from "@/api/super-admin";

export default function StakeholderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // NOTE: The backend currently lacks a dedicated GET /stakeholder/{id} endpoint.
  // We fetch a larger page size to attempt to find the stakeholder locally.
  const { data, isLoading } = useStakeholders(0, 100);

  if (isLoading) {
    return <Loader variant="page" text="Loading Stakeholder Details..." />;
  }

  const stakeholders = data?.data?.content || [];
  const stakeholder = stakeholders.find((s) => s.id === id);

  if (!stakeholder) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[hsl(var(--foreground))]">
          Stakeholder not found
        </p>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          This organisation may not be in the current page results or has been removed.
        </p>
        <Button
          variant="outline"
          className="mt-4 gap-2"
          onClick={() => router.push("/stakeholders")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Stakeholders
        </Button>
      </div>
    );
  }

  const initials = stakeholder.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <button
        onClick={() => router.push("/stakeholders")}
        className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-5 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Stakeholders
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
            style={{
              backgroundColor: "hsl(var(--primary)/0.1)",
              color: "hsl(var(--primary))",
            }}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
                {stakeholder.name}
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
              <span>{stakeholder.industry || "Industry not specified"}</span>
              <span>·</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: stakeholder.online ? "#16a34a" : "#6b7280" }}
                />
                <span className="capitalize">{stakeholder.online ? "Online" : "Offline"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: org info */}
        <div className="col-span-1 flex flex-col gap-4">
          <Card className="attend-card p-5">
            <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">
              Organisation Details
            </h2>
            <div className="flex flex-col gap-3">
              {[
                { icon: Building2, label: "Industry", value: stakeholder.industry || "N/A" },
                {
                  icon: CalendarDays,
                  label: "Events Hosted",
                  value: stakeholder.eventCount?.toString() || "0",
                },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <div>
                    <p className="attend-section-title">{label}</p>
                    <p className="text-sm font-medium text-[hsl(var(--foreground))] mt-0.5 max-w-[200px] truncate">
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: events + docs (Mocked out or removed due to missing backend endpoints) */}
        <div className="col-span-2 flex flex-col gap-5">
          <Card className="attend-card p-10 text-center flex items-center justify-center h-full">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Event and Document filtering by Stakeholder ID is currently not supported by the backend APIs.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Radio, Eye, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/custom/status-badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Loader } from "@/components/ui/Loader";
import { useEvents } from "@/api/super-admin";

const TABS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Live", value: "LIVE" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Draft", value: "DRAFT" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useEvents(activeTab, page, 20);

  // Reset page when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPage(0);
  };

  if (isLoading) {
    return <Loader variant="page" text="Loading Events..." />;
  }

  const events = data?.data?.content || [];
  const totalPages = data?.data?.totalPages || 1;
  const totalElements = data?.data?.totalElements || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Events
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            {totalElements} total events matching the filter
          </p>
        </div>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          Events are created by enrolled stakeholders
        </span>
      </div>

      <div className="flex items-center gap-1 mb-4 bg-[hsl(var(--muted))] rounded-full p-1 w-fit overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.value
                ? "bg-white shadow-sm text-[hsl(var(--foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Event Title</th>
              <th className="px-5 py-3 text-left">Stakeholder</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const isLive = event.status === "LIVE";
              return (
                <tr key={event.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <CalendarDays className="h-4 w-4 text-[hsl(var(--primary))]" />
                      <div>
                        <div className="text-sm font-medium text-[hsl(var(--foreground))] max-w-[260px] truncate">
                          {event.title}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {event.organizerName || event.stakeholderName}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                    {formatDate(event.date || event.startDate || "")}
                    {event.endDate && (
                      <div className="text-xs">
                        to {formatDate(event.endDate || "")}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={event.status.toLowerCase()} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/events/${event.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </Link>
                      {isLive && (
                        <Link href={`/events/${event.id}/live`}>
                          <Button size="sm" className="h-7 text-xs gap-1">
                            <Radio className="h-3 w-3" />
                            Live
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {events.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No events found for this filter.
          </div>
        )}
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border)/0.6)]">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 0} 
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Page {page + 1} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= totalPages - 1} 
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

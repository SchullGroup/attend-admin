"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { useStakeholders } from "@/api/super-admin";

export default function StakeholdersPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError } = useStakeholders(page, 20);

  if (isLoading) {
    return <Loader variant="page" text="Loading Stakeholders..." />;
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-red-500">
        Failed to load stakeholders.
      </div>
    );
  }

  const stakeholders = data?.data?.content || [];
  const totalPages = data?.data?.totalPages || 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
            Stakeholders
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Enrolled organisations on the Attend platform
          </p>
        </div>
        <Link href="/stakeholders/pending">
          <Button className="gap-2">Enroll New Stakeholder</Button>
        </Link>
      </div>

      <Card className="attend-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="attend-table-header">
              <th className="px-5 py-3 text-left">Organisation</th>
              <th className="px-5 py-3 text-left">Industry</th>
              <th className="px-5 py-3 text-left">Events Hosted</th>
              <th className="px-5 py-3 text-left">Live Status</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stakeholders.map((stk) => {
              return (
                <tr key={stk.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {stk.name}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                      {stk.industry || "N/A"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-[hsl(var(--foreground))] tabular-nums">
                      {stk.eventCount || 0}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: stk.online ? "#16a34a" : "#6b7280" }}
                      />
                      <span className="text-sm text-[hsl(var(--foreground))] capitalize">
                        {stk.online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/stakeholders/${stk.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                        >
                          View
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {stakeholders.length === 0 && (
          <div className="py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No stakeholders found.
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

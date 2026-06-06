"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/Loader";
import { popup } from "@/lib/popup-store";
import { 
  usePendingEnrollments, 
  useEnrollStakeholder, 
  useApproveEnrollment, 
  useRejectEnrollment 
} from "@/api/super-admin";

export default function PendingEnrollmentsPage() {
  const [page, setPage] = useState(0);
  const { data, isLoading } = usePendingEnrollments(page, 20);
  
  const enrollMutation = useEnrollStakeholder();
  const approveMutation = useApproveEnrollment();
  const rejectMutation = useRejectEnrollment();

  const [form, setForm] = useState({
    name: "",
    domain: "",
    adminEmail: "",
    adminFirstName: "",
    adminLastName: "",
  });

  function handleFormChange(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSendInvitation() {
    if (
      !form.name.trim() ||
      !form.domain.trim() ||
      !form.adminEmail.trim() ||
      !form.adminFirstName.trim() ||
      !form.adminLastName.trim()
    ) {
      popup.error("Validation Error", "Please fill in all required fields.");
      return;
    }
    
    enrollMutation.mutate(form, {
      onSuccess: () => {
        setForm({
          name: "",
          domain: "",
          adminEmail: "",
          adminFirstName: "",
          adminLastName: "",
        });
      }
    });
  }

  function handleApprove(id: string, name: string) {
    popup.confirm(
      "Approve Stakeholder",
      `Are you sure you want to approve the enrollment for ${name}?`,
      () => approveMutation.mutate(id)
    );
  }

  function handleReject(id: string, name: string) {
    popup.confirm(
      "Reject Stakeholder",
      `Are you sure you want to reject the enrollment for ${name}?`,
      () => rejectMutation.mutate({ id, data: { reason: "Does not meet requirements." } }),
      undefined,
      "Reject",
      "Cancel"
    );
  }

  const isMutating = enrollMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  if (isLoading) {
    return <Loader variant="page" text="Loading pending enrollments..." />;
  }

  const pending = data?.data?.pendingStakeholders || [];
  const size = data?.data?.size || 20;
  const totalCount = data?.data?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / size));

  return (
    <div className="space-y-6 relative">
      {isMutating && <Loader variant="overlay" text="Processing..." />}
      
      <div>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">
          Pending Enrollments
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Stakeholders awaiting review and activation
        </p>
      </div>

      {/* Enroll New Organisation form */}
      <Card className="attend-card p-6">
        <h2 className="font-semibold text-[hsl(var(--foreground))] mb-4">
          Enroll New Organisation
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              placeholder="e.g. Access Bank Plc"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Domain <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => handleFormChange("domain", e.target.value)}
              placeholder="e.g. accessbankplc.com"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Admin Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => handleFormChange("adminEmail", e.target.value)}
              placeholder="e.g. admin@accessbankplc.com"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Admin First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.adminFirstName}
              onChange={(e) => handleFormChange("adminFirstName", e.target.value)}
              placeholder="e.g. John"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Admin Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.adminLastName}
              onChange={(e) => handleFormChange("adminLastName", e.target.value)}
              placeholder="e.g. Doe"
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSendInvitation} disabled={enrollMutation.isPending}>
            Send Invitation
          </Button>
        </div>
      </Card>

      {/* Pending requests table */}
      {pending.length > 0 ? (
        <Card className="attend-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
            <h2 className="font-semibold text-[hsl(var(--foreground))]">
              Pending Requests
            </h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="attend-table-header">
                <th className="px-5 py-3 text-left">Organisation</th>
                <th className="px-5 py-3 text-left">Industry</th>
                <th className="px-5 py-3 text-left">Contact Email</th>
                <th className="px-5 py-3 text-left">Requested</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((stk: any) => (
                <tr key={stk.id} className="attend-table-row">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                      {stk.companyName}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      RC: {stk.rcNumber || "N/A"}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {stk.industry || "N/A"}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {stk.contactEmail}
                  </td>
                  <td className="px-5 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {stk.requestedAt ? new Date(stk.requestedAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }) : "N/A"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleApprove(stk.id, stk.companyName)}
                        disabled={isMutating}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleReject(stk.id, stk.companyName)}
                        disabled={isMutating}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border)/0.6)]">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 0 || isMutating} 
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
                disabled={page >= totalPages - 1 || isMutating} 
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="attend-card p-10 text-center">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            No pending enrollment requests.
          </p>
        </Card>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  CheckSquare,
  Check,
  X,
  CornerDownLeft,
  Eye,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface PendingApprovalItem {
  id: string; // approval ID
  request_id: string;
  step_number: number;
  approval_level: number;
  approver_role: string;
  status: string;
  action_timestamp: string;
  request_number: string;
  requester_username: string | null;
  employee_first_name: string;
  employee_last_name: string;
  department_name: string | null;
  item_name: string | null;
  quantity: number;
  priority: string;
  justification: string;
  company_id: string;
  request_status: string;
  current_approval_level: number;
}

export default function PendingApprovalsPage() {
  const { user } = useAuth();

  const [approvals, setApprovals] = useState<PendingApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decision Modal
  const [selectedApproval, setSelectedApproval] = useState<PendingApprovalItem | null>(null);
  const [modalMode, setModalMode] = useState<"APPROVE" | "REJECT" | "RETURN" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient<PendingApprovalItem[]>("/approvals/pending");
      setApprovals(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || "Failed to load pending approvals inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApproval || !modalMode) return;

    try {
      setSubmitting(true);
      setModalError(null);

      const endpoint =
        modalMode === "APPROVE"
          ? `/requests/${selectedApproval.request_id}/approvals/${selectedApproval.id}/approve`
          : modalMode === "REJECT"
          ? `/requests/${selectedApproval.request_id}/approvals/${selectedApproval.id}/reject`
          : `/requests/${selectedApproval.request_id}/approvals/${selectedApproval.id}/return`;

      await apiClient.post(endpoint, {
        remarks: remarks.trim() || undefined,
      });

      setModalMode(null);
      setSelectedApproval(null);
      setRemarks("");
      fetchPending();
    } catch (err: any) {
      setModalError(err.message || `Failed to ${modalMode.toLowerCase()} request`);
    } finally {
      setSubmitting(false);
    }
  };

  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge variant="danger">URGENT</Badge>;
      case "HIGH":
        return <Badge variant="warning">HIGH</Badge>;
      case "MEDIUM":
        return <Badge variant="info">MEDIUM</Badge>;
      default:
        return <Badge variant="neutral">LOW</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Pending Approvals Inbox"
        description="Requisitions awaiting your role authorization and technical sign-off."
        icon={CheckSquare}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Approvals" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 border border-teal-200 text-teal-700">
              {approvals.length} Action Items Pending
            </span>
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={fetchPending}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Main Inbox Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-subtle">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-sm">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
            <p className="font-semibold">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={fetchPending}
            >
              Try Again
            </Button>
          </div>
        ) : approvals.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={CheckCircle2}
              title="All caught up!"
              description="You currently have no requisitions waiting for your authorization."
              actionLabel="View All Requisitions"
              onAction={() => window.location.href = "/requests"}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Request #</th>
                  <th className="px-4 py-3">Requested Item</th>
                  <th className="px-4 py-3">Requester & Dept</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-center">Priority</th>
                  <th className="px-4 py-3 text-center">Level / Role</th>
                  <th className="px-4 py-3">Justification</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvals.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-teal-600">
                      <Link href={`/requests/${item.request_id}`} className="hover:underline">
                        {item.request_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{item.item_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800 font-medium">
                        {item.employee_first_name} {item.employee_last_name}
                      </div>
                      <div className="text-[11px] text-slate-500">{item.department_name}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 font-mono">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderPriorityBadge(item.priority)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        Lvl {item.approval_level} • {item.approver_role}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-slate-500 italic">
                      {`"${item.justification}"`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedApproval(item);
                            setModalMode("APPROVE");
                          }}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 transition-colors shadow-2xs"
                          title="Authorize Stage"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedApproval(item);
                            setModalMode("RETURN");
                          }}
                          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 transition-colors shadow-2xs"
                          title="Return for Correction"
                        >
                          <CornerDownLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedApproval(item);
                            setModalMode("REJECT");
                          }}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-colors shadow-2xs"
                          title="Reject Requisition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/requests/${item.request_id}`}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 transition-colors shadow-2xs"
                          title="View Full Requisition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      <Modal
        isOpen={!!modalMode}
        onClose={() => setModalMode(null)}
        title={
          modalMode === "APPROVE"
            ? `Authorize ${selectedApproval?.request_number}`
            : modalMode === "REJECT"
            ? `Reject ${selectedApproval?.request_number}`
            : `Return ${selectedApproval?.request_number} for Revision`
        }
      >
        <form onSubmit={handleDecisionSubmit} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {modalError}
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed">
            {modalMode === "APPROVE"
              ? `You are authorizing Level ${selectedApproval?.approval_level} for "${selectedApproval?.item_name}". Upon approval, it will advance to the next workflow stage.`
              : modalMode === "REJECT"
              ? `Rejecting will permanently terminate requisition "${selectedApproval?.item_name}". Mandatory remarks required.`
              : `Returning will reset this request back to DRAFT so the employee can correct details.`}
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1.5">
              Remarks {modalMode !== "APPROVE" && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={3}
              required={modalMode !== "APPROVE"}
              placeholder="State your technical review findings, budgetary approval, or required changes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalMode(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={submitting}
              variant={
                modalMode === "APPROVE"
                  ? "primary"
                  : modalMode === "REJECT"
                  ? "destructive"
                  : "secondary"
              }
            >
              {modalMode === "APPROVE"
                ? "Confirm Authorization"
                : modalMode === "REJECT"
                ? "Confirm Rejection"
                : "Return to Requester"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

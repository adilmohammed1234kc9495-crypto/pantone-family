"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  ClipboardList,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Boxes,
  Package,
  Calendar,
  User,
  Building2,
  FileText,
  Clock,
  Send,
  Ban,
  Check,
  X,
  CornerDownLeft,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface RequisitionDetail {
  id: string;
  request_number: string;
  company_id: string;
  requester_id: string;
  employee_id: string;
  department_id: string | null;
  category_id: string | null;
  stock_item_id: string | null;
  item_name: string | null;
  quantity: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "PENDING_APPROVAL"
    | "PARTIALLY_APPROVED"
    | "APPROVED"
    | "REJECTED"
    | "FULFILLED"
    | "CANCELLED";
  current_approval_level: number;
  required_by_date: string | null;
  justification: string;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
  fulfilled_asset_id: string | null;
  fulfilled_stock_movement_id: string | null;
  fulfillment_notes: string | null;
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  department_name: string | null;
  category_name: string | null;
  stock_code: string | null;
  stock_item_name: string | null;
  requester_username: string | null;
  created_at: string;
  approvals: ApprovalStage[];
}

interface ApprovalStage {
  id: string;
  step_number: number;
  approval_level: number;
  approver_role: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED" | "CANCELLED";
  decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_CORRECTION" | null;
  remarks: string | null;
  decided_at: string | null;
  approver_username?: string | null;
}

interface RequestHistoryItem {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  performed_by_username: string | null;
  remarks: string | null;
  created_at: string;
}

interface AvailableAssetOption {
  id: string;
  asset_tag: string;
  name: string;
  status: string;
}

export default function RequisitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user, hasPermission } = useAuth();

  const [req, setReq] = useState<RequisitionDetail | null>(null);
  const [history, setHistory] = useState<RequestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [approvalModalMode, setApprovalModalMode] = useState<"APPROVE" | "REJECT" | "RETURN" | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

  // Fulfillment Modal
  const [isFulfillOpen, setIsFulfillOpen] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<"STOCK" | "ASSET">("STOCK");
  const [availableAssets, setAvailableAssets] = useState<AvailableAssetOption[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [res, histRes] = await Promise.all([
        apiClient<RequisitionDetail>(`/requests/${id}`),
        apiClient<RequestHistoryItem[]>(`/requests/${id}/history`).catch(() => []),
      ]);
      setReq(res);
      setHistory(histRes);
    } catch (err: any) {
      setError(err.message || "Failed to load requisition details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchDetail();
    }
  }, [id, fetchDetail]);

  const handleSubmitRequisition = async () => {
    try {
      setActionLoading(true);
      setActionError(null);
      await apiClient.post(`/requests/${id}/submit`);
      fetchDetail();
    } catch (err: any) {
      setActionError(err.message || "Failed to submit requisition");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequisition = async () => {
    if (!confirm("Are you sure you want to cancel this requisition?")) return;
    try {
      setActionLoading(true);
      setActionError(null);
      await apiClient.post(`/requests/${id}/cancel`);
      fetchDetail();
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel requisition");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApprovalId || !approvalModalMode) return;
    try {
      setActionLoading(true);
      setActionError(null);

      const endpoint =
        approvalModalMode === "APPROVE"
          ? `/requests/${id}/approvals/${selectedApprovalId}/approve`
          : approvalModalMode === "REJECT"
          ? `/requests/${id}/approvals/${selectedApprovalId}/reject`
          : `/requests/${id}/approvals/${selectedApprovalId}/return`;

      await apiClient.post(endpoint, { remarks: remarks.trim() || undefined });

      setApprovalModalMode(null);
      setSelectedApprovalId(null);
      setRemarks("");
      fetchDetail();
    } catch (err: any) {
      setActionError(err.message || `Failed to ${approvalModalMode.toLowerCase()} requisition`);
    } finally {
      setActionLoading(false);
    }
  };

  const openFulfillmentModal = async () => {
    setIsFulfillOpen(true);
    // Load available fixed assets in case user chooses serialized asset fulfillment
    try {
      const res = await apiClient<any>("/assets?status=AVAILABLE&limit=50");
      setAvailableAssets(res.items || res || []);
    } catch {
      // Soft fail
    }
  };

  const handleFulfillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setActionError(null);

      const payload: any = {
        fulfillmentType,
        fulfillmentNotes: fulfillmentNotes.trim() || undefined,
      };

      if (fulfillmentType === "ASSET") {
        if (!selectedAssetId) {
          setActionError("Please select an available fixed asset to assign");
          setActionLoading(false);
          return;
        }
        payload.existingAssetId = selectedAssetId;
      } else {
        payload.stockItemId = req?.stock_item_id;
      }

      await apiClient.post(`/requests/${id}/fulfill`, payload);

      setIsFulfillOpen(false);
      setFulfillmentNotes("");
      setSelectedAssetId("");
      fetchDetail();
    } catch (err: any) {
      setActionError(err.message || "Failed to fulfill requisition");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/requests" className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-2xs">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-48 bg-slate-200 animate-pulse rounded" />
        </div>
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-xl shadow-subtle space-y-4 max-w-lg mx-auto">
        <AlertTriangle className="w-12 h-12 mx-auto text-rose-500" />
        <h2 className="text-lg font-bold text-slate-900">Error Loading Requisition</h2>
        <p className="text-xs text-slate-500">{error || "Requisition not found"}</p>
        <Link
          href="/requests"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Requisitions
        </Link>
      </div>
    );
  }

  // Active step evaluation
  const activeApproval = req.approvals?.find(
    (a) => a.approval_level === req.current_approval_level && a.status === "PENDING"
  );

  const canApproveCurrentStep =
    (req.status === "PENDING_APPROVAL" || req.status === "PARTIALLY_APPROVED") &&
    activeApproval &&
    (user?.isCommonAdmin ||
      user?.roleCode === activeApproval.approver_role ||
      user?.roleCode === "COMPANY_ADMIN");

  const canFulfill =
    req.status === "APPROVED" &&
    (user?.isCommonAdmin || user?.roleCode === "ASSET_MANAGER" || user?.roleCode === "COMPANY_ADMIN");

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title={req.item_name || req.stock_code || "Asset Requisition"}
        description={`Requested by ${req.employee_first_name} ${req.employee_last_name} (${req.department_name || req.employee_code}) • Created ${new Date(req.created_at).toLocaleDateString()}`}
        icon={ClipboardList}
        badge={<Badge variant="neutral">{req.request_number}</Badge>}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Requisitions", href: "/requests" },
          { label: req.request_number },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {req.status === "DRAFT" && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Send}
                  onClick={handleSubmitRequisition}
                  loading={actionLoading}
                >
                  Submit for Approval
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Ban}
                  onClick={handleCancelRequisition}
                  loading={actionLoading}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                >
                  Cancel
                </Button>
              </>
            )}

            {canApproveCurrentStep && activeApproval && (
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={Check}
                  onClick={() => {
                    setSelectedApprovalId(activeApproval.id);
                    setApprovalModalMode("APPROVE");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  Approve (Lvl {activeApproval.approval_level})
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={CornerDownLeft}
                  onClick={() => {
                    setSelectedApprovalId(activeApproval.id);
                    setApprovalModalMode("RETURN");
                  }}
                >
                  Return
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  icon={X}
                  onClick={() => {
                    setSelectedApprovalId(activeApproval.id);
                    setApprovalModalMode("REJECT");
                  }}
                >
                  Reject
                </Button>
              </div>
            )}

            {canFulfill && (
              <Button
                variant="primary"
                size="sm"
                icon={Truck}
                onClick={openFulfillmentModal}
              >
                Fulfill Requisition
              </Button>
            )}
          </div>
        }
      />

      {actionError && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {actionError}
        </div>
      )}

      {/* Multi-Tier Approval Visual Pipeline */}
      <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Approval Stages Pipeline
          </span>
          <span className="text-xs font-mono text-slate-500">
            Current Level: {req.current_approval_level}
          </span>
        </div>

        {req.approvals && req.approvals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {req.approvals.map((stage) => {
              const isPast = stage.status === "APPROVED";
              const isCurrent = stage.approval_level === req.current_approval_level && stage.status === "PENDING";
              const isRejected = stage.status === "REJECTED";

              return (
                <div
                  key={stage.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPast
                      ? "bg-emerald-50/50 border-emerald-200"
                      : isCurrent
                      ? "bg-teal-50/60 border-teal-300 ring-1 ring-teal-500/20"
                      : isRejected
                      ? "bg-rose-50/50 border-rose-200"
                      : "bg-slate-50 border-slate-200 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">
                      Step {stage.step_number} • Level {stage.approval_level}
                    </span>
                    {isPast ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 animate-pulse">
                        <Clock className="w-3.5 h-3.5" /> CURRENT STAGE
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                        <XCircle className="w-3.5 h-3.5" /> REJECTED
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 uppercase font-medium">
                        {stage.status}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2">
                    {stage.approver_role.replace("_", " ")}
                  </h3>

                  <div className="text-[11px] text-slate-600 mt-2 space-y-1">
                    {stage.approver_username && (
                      <div>
                        Decided by: <span className="text-slate-800 font-mono font-medium">{stage.approver_username}</span>
                      </div>
                    )}
                    {stage.decided_at && (
                      <div>
                        Timestamp: <span className="font-mono text-slate-500">{new Date(stage.decided_at).toLocaleString()}</span>
                      </div>
                    )}
                    {stage.remarks && (
                      <div className="p-2 rounded bg-white border border-slate-200 italic text-slate-700 mt-2 shadow-2xs">
                        {`"${stage.remarks}"`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-slate-200">
            Approval stages will be generated once this requisition is submitted from DRAFT status.
          </div>
        )}
      </div>

      {/* Fulfillment Status Banner (If Fulfilled) */}
      {req.status === "FULFILLED" && (
        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Requisition Successfully Fulfilled
          </div>
          <p className="text-xs text-emerald-700">
            {req.fulfillment_notes || "Items have been released and handed over."}
          </p>
          <div className="flex flex-wrap gap-4 pt-2 text-[11px] font-mono text-emerald-800">
            {req.fulfilled_asset_id && (
              <div>
                Fulfilled Serial Asset: <span className="font-semibold">{req.fulfilled_asset_id}</span>
              </div>
            )}
            {req.fulfilled_stock_movement_id && (
              <div>
                Stock Movement Ref: <span className="font-semibold">{req.fulfilled_stock_movement_id}</span>
              </div>
            )}
            {req.fulfilled_at && (
              <div>
                Fulfilled At: <span className="text-emerald-700">{new Date(req.fulfilled_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Specification Card */}
        <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-subtle space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Requisition Specifications
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block">Requested Item</span>
              <span className="text-slate-900 font-semibold">{req.item_name}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Quantity</span>
              <span className="text-slate-900 font-bold font-mono">{req.quantity} units</span>
            </div>
            <div>
              <span className="text-slate-400 block">Stock Catalog Link</span>
              <span className="text-teal-600 font-mono font-medium">{req.stock_code || "Non-Catalog Spec"}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Category</span>
              <span className="text-slate-800">{req.category_name || "Uncategorized"}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Priority</span>
              <span className="font-semibold text-slate-900">{req.priority}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Required By Date</span>
              <span className="text-slate-800 font-mono">
                {req.required_by_date ? new Date(req.required_by_date).toLocaleDateString() : "Immediate"}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs space-y-1">
            <span className="text-slate-400 block">Business Justification</span>
            <p className="text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
              {req.justification}
            </p>
          </div>
        </div>

        {/* Audit Lifecycle History Card */}
        <div className="p-6 rounded-xl bg-white border border-slate-200/90 shadow-subtle space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            Immutable Audit History Log
          </h2>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-xs text-slate-400">No transition history recorded yet.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-teal-700 font-semibold">{h.action}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </div>
                  {h.from_status && h.to_status && (
                    <div className="text-[11px] text-slate-600">
                      State transition: <span className="text-slate-800 font-medium">{h.from_status}</span> →{" "}
                      <span className="text-emerald-700 font-semibold">{h.to_status}</span>
                    </div>
                  )}
                  {h.remarks && (
                    <div className="text-slate-700 italic text-[11px]">{`"${h.remarks}"`}</div>
                  )}
                  {h.performed_by_username && (
                    <div className="text-[10px] text-slate-500">
                      Actor: {h.performed_by_username}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Decision Modal (Approve / Reject / Return) */}
      <Modal
        isOpen={!!approvalModalMode}
        onClose={() => setApprovalModalMode(null)}
        title={
          approvalModalMode === "APPROVE"
            ? "Authorize Approval Stage"
            : approvalModalMode === "REJECT"
            ? "Reject Requisition"
            : "Return Requisition for Correction"
        }
      >
        <form onSubmit={handleDecisionSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 leading-relaxed text-xs">
            {approvalModalMode === "APPROVE"
              ? "You are approving this stage. If this is the final stage, the requisition will be marked APPROVED and ready for fulfillment."
              : approvalModalMode === "REJECT"
              ? "Rejecting will permanently terminate this requisition pipeline. Remarks explaining the decision are mandatory."
              : "Returning will reset the requisition to DRAFT status and return it to the requester for necessary revisions."}
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Remarks {approvalModalMode !== "APPROVE" && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={3}
              required={approvalModalMode !== "APPROVE"}
              placeholder="State your technical review findings, budgetary notes, or required corrections..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none shadow-2xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setApprovalModalMode(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={actionLoading}
              variant={
                approvalModalMode === "APPROVE"
                  ? "primary"
                  : approvalModalMode === "REJECT"
                  ? "destructive"
                  : "secondary"
              }
            >
              {`Confirm ${approvalModalMode}`}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fulfillment Modal */}
      <Modal
        isOpen={isFulfillOpen}
        onClose={() => setIsFulfillOpen(false)}
        title="Fulfill Approved Requisition"
      >
        <form onSubmit={handleFulfillSubmit} className="space-y-4 text-xs">
          <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFulfillmentType("STOCK")}
              className={`flex-1 py-1.5 rounded-md text-center font-medium transition-all ${
                fulfillmentType === "STOCK"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Fulfill from Stock Inventory
            </button>
            <button
              type="button"
              onClick={() => setFulfillmentType("ASSET")}
              className={`flex-1 py-1.5 rounded-md text-center font-medium transition-all ${
                fulfillmentType === "ASSET"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Fulfill Serialized Fixed Asset
            </button>
          </div>

          {fulfillmentType === "STOCK" ? (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
              <p className="font-semibold text-slate-900">Stock Deduction:</p>
              <p className="mt-1">
                Will automatically record an <span className="font-mono text-amber-700 font-bold">ISSUE</span> of{" "}
                <span className="font-bold text-slate-900">{req.quantity} units</span> from linked stock item{" "}
                <span className="font-mono text-teal-600 font-semibold">{req.stock_code || "Selected Catalog Item"}</span>.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Select Available Serialized Asset <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="">Select available asset...</option>
                {availableAssets.map((ast) => (
                  <option key={ast.id} value={ast.id}>
                    {ast.asset_tag} — {ast.name} ({ast.status})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                This will automatically assign custody to {req.employee_first_name} {req.employee_last_name} and confirm physical handover.
              </p>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Fulfillment & Delivery Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Dispatched from main warehouse, serial tags verified..."
              value={fulfillmentNotes}
              onChange={(e) => setFulfillmentNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none shadow-2xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFulfillOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={actionLoading}
            >
              Confirm & Complete Fulfillment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

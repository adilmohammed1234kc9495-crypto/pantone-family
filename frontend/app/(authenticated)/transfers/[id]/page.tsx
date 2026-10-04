"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  ArrowLeft,
  ArrowLeftRight,
  Truck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Building2,
  User,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  FileText,
  BadgeAlert,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface TransferDetail {
  id: string;
  transfer_code: string;
  asset_id: string;
  asset_tag: string;
  asset_name: string;
  asset_status: string;
  asset_current_value: string | number;
  from_company_id: string;
  from_company_name: string;
  from_company_code: string;
  to_company_id: string;
  to_company_name: string;
  to_company_code: string;
  from_employee_id: string | null;
  from_employee_name: string | null;
  to_employee_id: string | null;
  to_employee_name: string | null;
  from_department_id: string | null;
  from_department_name: string | null;
  to_department_id: string | null;
  to_department_name: string | null;
  from_location_id: string | null;
  from_location_name: string | null;
  to_location_id: string | null;
  to_location_name: string | null;
  transfer_type: "EMPLOYEE_TO_EMPLOYEE" | "DEPT_TO_DEPT" | "LOCATION_TO_LOCATION" | "INTER_COMPANY";
  reason: string;
  condition_before: string;
  condition_after: string | null;
  status: "INITIATED" | "PENDING_APPROVAL" | "APPROVED" | "DISPATCHED" | "HANDOVER_PENDING" | "COMPLETED" | "REJECTED" | "DISPUTED" | "CANCELLED";
  transfer_date: string;
  dispatch_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  dispute_reason: string | null;
  rejection_reason: string | null;
  remarks: string | null;
  requested_by_username: string | null;
  approved_by_username: string | null;
  dispatched_by_username: string | null;
  received_by_username: string | null;
  created_at: string;
  inter_company?: {
    id: string;
    originating_book_value: number;
    transfer_fee: number;
    dispatch_date: string | null;
    receipt_date: string | null;
    status: string;
    acknowledgement_notes: string | null;
    dispute_reason: string | null;
  } | null;
  handover?: {
    id: string;
    condition: string;
    physical_condition: string;
    remarks: string | null;
    digital_signature_token: string | null;
    verification_notes: string | null;
    handover_date: string;
    handover_time: string;
  } | null;
}

export default function TransferDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const [transfer, setTransfer] = useState<TransferDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState("");

  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    conditionAfter: "GOOD",
    acknowledgementNotes: "Asset delivered and inspected in good condition",
    signatureToken: `SIG-${Date.now()}`,
  });

  const [isDisputeOpen, setIsDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchTransfer = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.get<TransferDetail>(`/transfers/${id}`);
      setTransfer(res);
      setReceiveForm((prev) => ({
        ...prev,
        conditionAfter: res.condition_before || "GOOD",
      }));
    } catch (err: any) {
      setError(err.message || "Failed to load transfer record");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTransfer();
  }, [fetchTransfer]);

  // Actions
  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await apiClient.post(`/transfers/${id}/approve`, { remarks: approveRemarks });
      setActionSuccess("Transfer authorized and approved successfully.");
      setIsApproveOpen(false);
      fetchTransfer();
    } catch (err: any) {
      setActionError(err.message || "Failed to approve transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispatch = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await apiClient.post(`/transfers/${id}/dispatch`, {});
      setActionSuccess("Asset dispatched into transit.");
      fetchTransfer();
    } catch (err: any) {
      setActionError(err.message || "Failed to dispatch asset");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceive = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await apiClient.post(`/transfers/${id}/receive`, {
        conditionAfter: receiveForm.conditionAfter,
        acknowledgementNotes: receiveForm.acknowledgementNotes,
        signatureToken: receiveForm.signatureToken,
      });
      setActionSuccess("Transfer confirmed! Asset successfully received and re-homed.");
      setIsReceiveOpen(false);
      fetchTransfer();
    } catch (err: any) {
      setActionError(err.message || "Failed to confirm receipt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      setActionError("Mandatory dispute reason is required");
      return;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      await apiClient.post(`/transfers/${id}/dispute`, { reason: disputeReason.trim() });
      setActionSuccess("Transfer marked as disputed. Flagged for review.");
      setIsDisputeOpen(false);
      fetchTransfer();
    } catch (err: any) {
      setActionError(err.message || "Failed to record dispute");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsSubmitting(true);
      setActionError(null);
      await apiClient.post(`/transfers/${id}/cancel`, { reason: cancelReason });
      setActionSuccess("Transfer successfully cancelled.");
      setIsCancelOpen(false);
      fetchTransfer();
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="h-28 bg-white rounded-xl border border-slate-200"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-white rounded-xl border border-slate-200"></div>
          <div className="h-64 bg-white rounded-xl border border-slate-200"></div>
        </div>
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="p-8 bg-white rounded-xl border border-slate-200 text-center max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Transfer Record Not Found</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">{error || "The transfer could not be found or you lack permission to view it."}</p>
        <Link
          href="/transfers"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Transfers
        </Link>
      </div>
    );
  }

  // Authorization checks
  const isSenderCompany = user?.companyId === transfer.from_company_id;
  const isDestinationCompany = user?.companyId === transfer.to_company_id;
  const isCommonAdmin = !!user?.isCommonAdmin;

  const canApprove =
    (transfer.status === "INITIATED" || transfer.status === "PENDING_APPROVAL") &&
    (isCommonAdmin || (isSenderCompany && (hasPermission("transfers:approve") || user?.roleCode === "COMPANY_ADMIN" || user?.roleCode === "ASSET_MANAGER")));

  const canDispatch =
    transfer.status === "APPROVED" &&
    (isCommonAdmin || (isSenderCompany && (hasPermission("transfers:dispatch") || user?.roleCode === "COMPANY_ADMIN" || user?.roleCode === "ASSET_MANAGER")));

  const canReceive =
    (transfer.status === "DISPATCHED" || transfer.status === "HANDOVER_PENDING") &&
    (isCommonAdmin || (isDestinationCompany && (hasPermission("transfers:receive") || user?.roleCode === "COMPANY_ADMIN" || user?.roleCode === "ASSET_MANAGER")));

  const canDispute =
    (transfer.status === "DISPATCHED" || transfer.status === "HANDOVER_PENDING") &&
    (isCommonAdmin || (isDestinationCompany && (hasPermission("transfers:dispute") || user?.roleCode === "COMPANY_ADMIN")));

  const canCancel =
    ["INITIATED", "PENDING_APPROVAL", "APPROVED"].includes(transfer.status) &&
    (isCommonAdmin || (isSenderCompany && (hasPermission("transfers:cancel") || user?.roleCode === "COMPANY_ADMIN")));

  // Stepper Stage
  const getStepIndex = (status: string) => {
    switch (status) {
      case "INITIATED":
      case "PENDING_APPROVAL":
        return 1;
      case "APPROVED":
        return 2;
      case "DISPATCHED":
      case "HANDOVER_PENDING":
        return 3;
      case "COMPLETED":
        return 4;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex(transfer.status);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={transfer.transfer_code}
        description={`Initiated by ${transfer.requested_by_username || "System"} on ${new Date(transfer.created_at).toLocaleDateString()}`}
        breadcrumbs={[
          { label: "Transfers", href: "/transfers" },
          { label: transfer.transfer_code },
        ]}
        badge={
          <div className="flex items-center gap-1.5">
            <StatusBadge status={transfer.status} />
            {transfer.transfer_type === "INTER_COMPANY" && (
              <Badge variant="brand">Dual Authorization Protocol</Badge>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canApprove && (
              <Button
                onClick={() => setIsApproveOpen(true)}
                variant="primary"
                size="sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Authorize & Approve
              </Button>
            )}

            {canDispatch && (
              <Button
                onClick={handleDispatch}
                disabled={isSubmitting}
                variant="secondary"
                size="sm"
              >
                <Truck className="w-4 h-4" />
                {isSubmitting ? "Dispatching..." : "Dispatch Asset"}
              </Button>
            )}

            {canReceive && (
              <Button
                onClick={() => setIsReceiveOpen(true)}
                variant="primary"
                size="sm"
              >
                <ShieldCheck className="w-4 h-4" />
                Confirm Receipt & Accept Handover
              </Button>
            )}

            {canDispute && (
              <Button
                onClick={() => setIsDisputeOpen(true)}
                variant="destructive"
                size="sm"
              >
                <AlertTriangle className="w-4 h-4" />
                Flag Dispute
              </Button>
            )}

            {canCancel && (
              <Button
                onClick={() => setIsCancelOpen(true)}
                variant="outline"
                size="sm"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel Transfer
              </Button>
            )}
          </div>
        }
      />

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Visual Stepper */}
      <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
          Transfer Lifecycle Stepper
        </h3>
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-0.5 bg-slate-200 z-0"></div>
          {[
            { step: 1, label: "Initiated", icon: Clock },
            { step: 2, label: "Approved", icon: CheckCircle2 },
            { step: 3, label: "Dispatched", icon: Truck },
            { step: 4, label: "Completed", icon: ShieldCheck },
          ].map((s) => {
            const Icon = s.icon;
            const isDone = transfer.status === "COMPLETED" || (currentStep >= s.step && transfer.status !== "DISPUTED" && transfer.status !== "CANCELLED");
            const isCurrent = currentStep === s.step && transfer.status !== "DISPUTED" && transfer.status !== "CANCELLED";

            return (
              <div key={s.step} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                    isDone
                      ? "bg-teal-600 text-white shadow-sm"
                      : isCurrent
                      ? "bg-amber-500 text-white ring-4 ring-amber-100"
                      : "bg-white border-2 border-slate-300 text-slate-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-xs mt-2 font-medium ${
                    isDone || isCurrent ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {transfer.status === "DISPUTED" && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
            <BadgeAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Transfer Flagged in Dispute: </span>
              {transfer.dispute_reason}
            </div>
          </div>
        )}
      </div>

      {/* Dual Authorization Protocol Section (If Inter-Company) */}
      {transfer.transfer_type === "INTER_COMPANY" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sending Company Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">1. Sending Company Authorization</h3>
              </div>
              <Badge variant="brand">{transfer.from_company_code}</Badge>
            </div>
            <div className="text-xs space-y-1.5 text-slate-600">
              <div>
                <span className="text-slate-400">Company:</span>{" "}
                <span className="font-medium text-slate-900">{transfer.from_company_name}</span>
              </div>
              <div>
                <span className="text-slate-400">Originating Book Value:</span>{" "}
                <span className="font-semibold text-slate-900">
                  ${Number(transfer.inter_company?.originating_book_value || transfer.asset_current_value || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Authorized By:</span>{" "}
                <span className="font-medium text-slate-900">{transfer.approved_by_username || "Pending Authorization"}</span>
              </div>
              <div>
                <span className="text-slate-400">Dispatched By:</span>{" "}
                <span className="font-medium text-slate-900">{transfer.dispatched_by_username || "Not Dispatched"}</span>
              </div>
              <div>
                <span className="text-slate-400">Dispatch Date:</span>{" "}
                <span className="font-mono text-slate-700">
                  {transfer.dispatch_date ? new Date(transfer.dispatch_date).toLocaleString() : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Receiving Company Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-800">2. Destination Company Confirmation</h3>
              </div>
              <Badge variant="brand">{transfer.to_company_code}</Badge>
            </div>
            <div className="text-xs space-y-1.5 text-slate-600">
              <div>
                <span className="text-slate-400">Destination Company:</span>{" "}
                <span className="font-medium text-slate-900">{transfer.to_company_name}</span>
              </div>
              <div>
                <span className="text-slate-400">Confirmation Status:</span>{" "}
                <span className="font-semibold text-slate-900">
                  {transfer.status === "COMPLETED" ? "CONFIRMED & ACCEPTED" : transfer.status === "DISPUTED" ? "DISPUTED" : "PENDING RECEIPT"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Received & Inspected By:</span>{" "}
                <span className="font-medium text-slate-900">{transfer.received_by_username || "Pending Inspection"}</span>
              </div>
              <div>
                <span className="text-slate-400">Actual Delivery Date:</span>{" "}
                <span className="font-mono text-slate-700">
                  {transfer.actual_delivery_date ? new Date(transfer.actual_delivery_date).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Condition Verified:</span>{" "}
                <span className="font-medium text-slate-900">{transfer.condition_after || "Pending Inspection"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset & Logistics Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Asset Info Card */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">Transferred Asset</h3>
          </div>
          <div className="text-xs space-y-2 text-slate-600">
            <div>
              <span className="text-slate-400 block">Asset Name:</span>
              <span className="text-sm font-semibold text-slate-900">{transfer.asset_name}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Asset Tag:</span>
              <span className="font-mono text-xs font-semibold text-teal-700">{transfer.asset_tag}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Current Status:</span>
              <StatusBadge status={transfer.asset_status} />
            </div>
            <div>
              <span className="text-slate-400 block">Current Book Value:</span>
              <span className="font-semibold text-slate-900">${Number(transfer.asset_current_value).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Condition Before Transfer:</span>
              <Badge variant="neutral">{transfer.condition_before}</Badge>
            </div>
            {transfer.condition_after && (
              <div>
                <span className="text-slate-400 block">Condition After Receipt:</span>
                <Badge variant="success">{transfer.condition_after}</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Origin & Destination Card */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <MapPin className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-800">Movement Logistics & Custody Re-Homing</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-100">
              <span className="font-semibold text-slate-700 block uppercase tracking-wider text-[11px]">
                Origin (From)
              </span>
              <div>
                <span className="text-slate-400">Company:</span>{" "}
                <span className="font-medium text-slate-800">{transfer.from_company_name}</span>
              </div>
              <div>
                <span className="text-slate-400">Department:</span>{" "}
                <span className="font-medium text-slate-800">{transfer.from_department_name || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Location:</span>{" "}
                <span className="font-medium text-slate-800">{transfer.from_location_name || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Custodian:</span>{" "}
                <span className="font-medium text-slate-800">{transfer.from_employee_name || "Unassigned"}</span>
              </div>
            </div>

            <div className="p-3 bg-teal-50/50 rounded-lg space-y-1.5 border border-teal-100">
              <span className="font-semibold text-teal-900 block uppercase tracking-wider text-[11px]">
                Destination (To)
              </span>
              <div>
                <span className="text-slate-400">Company:</span>{" "}
                <span className="font-medium text-slate-800">{transfer.to_company_name}</span>
              </div>
              <div>
                <span className="text-slate-400">Department:</span>{" "}
                <span className="font-medium text-slate-800">{transfer.to_department_name || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Location:</span>{" "}
                <span className="font-medium text-slate-800">{transfer.to_location_name || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Custodian:</span>{" "}
                <span className="font-medium text-slate-800">{transfer.to_employee_name || "General Inventory"}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700 block">Transfer Reason / Business Justification:</span>
            <p className="mt-1 p-2 bg-slate-50 rounded border border-slate-100 text-slate-800 italic">
              &quot;{transfer.reason}&quot;
            </p>
          </div>
        </div>
      </div>

      {/* Handover Record Details (If available) */}
      {transfer.handover && (
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-800">Physical Handover & Digital Acceptance</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600 pt-1">
            <div>
              <span className="text-slate-400 block">Digital Token:</span>
              <span className="font-mono text-emerald-700 font-semibold">{transfer.handover.digital_signature_token}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Physical Condition:</span>
              <span className="font-medium text-slate-900">{transfer.handover.physical_condition}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Handover Recorded:</span>
              <span className="font-mono text-slate-700">{transfer.handover.handover_date} {transfer.handover.handover_time}</span>
            </div>
          </div>
          {transfer.handover.remarks && (
            <p className="text-xs text-slate-500 italic mt-2">
              Note: {transfer.handover.remarks}
            </p>
          )}
        </div>
      )}

      {/* Authorize Modal */}
      <Modal isOpen={isApproveOpen} onClose={() => setIsApproveOpen(false)} title="Authorize Asset Transfer">
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            You are authorizing the outgoing transfer of <strong>{transfer.asset_name}</strong> ({transfer.asset_tag})
            to <strong>{transfer.to_company_name}</strong>.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Approval Remarks (Optional)
            </label>
            <textarea
              rows={3}
              value={approveRemarks}
              onChange={(e) => setApproveRemarks(e.target.value)}
              placeholder="e.g., Transfer authorized in accordance with Q4 capacity planning..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsApproveOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Authorizing..." : "Confirm & Authorize"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Receipt Modal */}
      <Modal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} title="Confirm Receipt & Handover">
        <div className="space-y-4 text-sm text-slate-700">
          <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg text-xs flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-teal-600" />
            <span>
              <strong>Dual Authorization Enforcement:</strong> By confirming receipt, asset ownership will be atomically
              re-homed to <strong>{transfer.to_company_name}</strong>.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Condition Verified on Arrival *
            </label>
            <select
              value={receiveForm.conditionAfter}
              onChange={(e) => setReceiveForm({ ...receiveForm, conditionAfter: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="NEW">NEW</option>
              <option value="EXCELLENT">EXCELLENT</option>
              <option value="GOOD">GOOD</option>
              <option value="FAIR">FAIR</option>
              <option value="DAMAGED">DAMAGED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Acknowledgement Notes
            </label>
            <textarea
              rows={2}
              value={receiveForm.acknowledgementNotes}
              onChange={(e) => setReceiveForm({ ...receiveForm, acknowledgementNotes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Digital Signature Token
            </label>
            <input
              type="text"
              value={receiveForm.signatureToken}
              onChange={(e) => setReceiveForm({ ...receiveForm, signatureToken: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsReceiveOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReceive}
              disabled={isSubmitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Accepting..." : "Accept & Re-Home Asset"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Flag Dispute Modal */}
      <Modal isOpen={isDisputeOpen} onClose={() => setIsDisputeOpen(false)} title="Flag Transfer Dispute">
        <div className="space-y-4 text-sm text-slate-700">
          <p className="text-xs text-rose-600">
            Flagging a dispute locks the asset in <strong>DISPUTED</strong> status and alerts Common Administration.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mandatory Dispute Reason *
            </label>
            <textarea
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Detail discrepancies, physical damages, serial number mismatch..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsDisputeOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDispute}
              disabled={isSubmitting || !disputeReason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Flagging..." : "Submit Dispute"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal isOpen={isCancelOpen} onClose={() => setIsCancelOpen(false)} title="Cancel Asset Transfer">
        <div className="space-y-4 text-sm text-slate-700">
          <p className="text-xs text-slate-600">
            Are you sure you want to cancel transfer <strong>{transfer.transfer_code}</strong>?
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Cancellation Reason (Optional)
            </label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Transfer no longer required..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsCancelOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Dismiss
            </button>
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

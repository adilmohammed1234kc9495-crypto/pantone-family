"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  RotateCcw,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  AlertCircle,
  ClipboardCheck,
  Calendar,
  Layers,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface ReturnItem {
  id: string;
  return_code: string;
  asset_id: string;
  assignment_id: string | null;
  company_id: string;
  returned_by: string;
  received_by: string | null;
  returned_at: string;
  condition: string;
  damage_description: string | null;
  damage_photo_url: string | null;
  destination_status: string;
  remarks: string | null;
  return_reason: string | null;
  inspection_status: "PENDING_INSPECTION" | "PASSED" | "MAINTENANCE_REQUIRED" | "DAMAGE_REVIEW";
  inspected_by: string | null;
  inspected_at: string | null;
  missing_accessories: string | null;
  missing_components: string | null;
  functional_status: string | null;
  inspection_notes: string | null;
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  received_by_username: string | null;
  inspected_by_username: string | null;
}

interface AssignedAssetItem {
  id: string;
  asset_tag: string;
  name: string;
  status: string;
}

interface EmployeeItem {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function ReturnsPage() {
  const { hasPermission, user } = useAuth();

  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [assignedAssets, setAssignedAssets] = useState<AssignedAssetItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [inspectionFilter, setInspectionFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Return Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [returnCondition, setReturnCondition] = useState("GOOD");
  const [returnReason, setReturnReason] = useState("PROJECT_COMPLETION");
  const [returnRemarks, setReturnRemarks] = useState("");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Inspection Modal
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [targetReturn, setTargetReturn] = useState<ReturnItem | null>(null);
  const [inspectDecision, setInspectDecision] = useState<"PASSED" | "MAINTENANCE_REQUIRED" | "DAMAGE_REVIEW">("PASSED");
  const [inspectCondition, setInspectCondition] = useState("GOOD");
  const [functionalStatus, setFunctionalStatus] = useState("FUNCTIONAL");
  const [missingAccessories, setMissingAccessories] = useState("");
  const [missingComponents, setMissingComponents] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [isSubmittingInspect, setIsSubmittingInspect] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const canManage = user?.isCommonAdmin || hasPermission("assets:update") || hasPermission("assignments:update");

  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (inspectionFilter) params.set("inspectionStatus", inspectionFilter);
      if (companyFilter) params.set("companyId", companyFilter);

      const res = await apiClient.get<any>(`/returns?${params.toString()}`);
      const data = res?.returns || res?.items || res?.data?.returns || [];
      const totalCount = res?.total || res?.data?.total || 0;
      const pages = res?.totalPages || Math.ceil(totalCount / limit) || 1;

      setReturns(data);
      setTotal(totalCount);
      setTotalPages(pages);
    } catch (err: any) {
      setError(err.message || "Failed to load returns.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, inspectionFilter, companyFilter]);

  const loadDropdowns = useCallback(async () => {
    try {
      if (user?.isCommonAdmin) {
        const compRes = await apiClient.get<any>("/companies");
        if (compRes) {
          setCompanies(compRes.companies || compRes.data?.companies || (Array.isArray(compRes) ? compRes : []));
        }
      }

      // Fetch assigned assets for returning
      const assetParams = new URLSearchParams({ status: "ASSIGNED", limit: "100" });
      if (companyFilter) assetParams.set("companyId", companyFilter);
      const assetRes = await apiClient.get<any>(`/assets?${assetParams.toString()}`);
      const assetsList = assetRes?.assets || assetRes?.items || [];
      setAssignedAssets(assetsList);

      // Fetch employees
      const empParams = new URLSearchParams();
      if (companyFilter) empParams.set("companyId", companyFilter);
      const empRes = await apiClient.get<any>(`/employees?${empParams.toString()}`);
      const empList = Array.isArray(empRes) ? empRes : (empRes?.employees || empRes?.data || []);
      setEmployees(empList);
    } catch (err: any) {
      console.error("Dropdown load error:", err);
    }
  }, [user?.isCommonAdmin, companyFilter]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  const handleOpenReturnModal = () => {
    setSelectedAssetId("");
    setSelectedEmployeeId("");
    setReturnDate(new Date().toISOString().split("T")[0]);
    setReturnCondition("GOOD");
    setReturnReason("PROJECT_COMPLETION");
    setReturnRemarks("");
    setReturnError(null);
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setReturnError("Please select an assigned asset to return.");
      return;
    }
    if (!selectedEmployeeId) {
      setReturnError("Please select the employee who is returning the asset.");
      return;
    }

    setIsSubmittingReturn(true);
    setReturnError(null);

    try {
      await apiClient.post("/returns", {
        assetId: selectedAssetId,
        returnedBy: selectedEmployeeId,
        condition: returnCondition,
        returnReason,
        remarks: returnRemarks || undefined,
      });

      setIsReturnModalOpen(false);
      loadReturns();
      loadDropdowns();
    } catch (err: any) {
      setReturnError(err.message || "Failed to process asset return.");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleOpenInspectModal = (ret: ReturnItem) => {
    setTargetReturn(ret);
    setInspectDecision("PASSED");
    setInspectCondition(ret.condition || "GOOD");
    setFunctionalStatus("FUNCTIONAL");
    setMissingAccessories("");
    setMissingComponents("");
    setInspectionNotes("");
    setInspectError(null);
    setIsInspectModalOpen(true);
  };

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReturn) return;

    setIsSubmittingInspect(true);
    setInspectError(null);

    try {
      await apiClient.post(`/returns/${targetReturn.id}/inspect`, {
        inspectionStatus: inspectDecision,
        condition: inspectCondition,
        functionalStatus,
        missingAccessories: missingAccessories.trim() || undefined,
        missingComponents: missingComponents.trim() || undefined,
        inspectionNotes: inspectionNotes.trim() || undefined,
      });

      setIsInspectModalOpen(false);
      setTargetReturn(null);
      loadReturns();
      loadDropdowns();
    } catch (err: any) {
      setInspectError(err.message || "Failed to record return inspection.");
    } finally {
      setIsSubmittingInspect(false);
    }
  };

  const filteredReturns = returns.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.return_code.toLowerCase().includes(q) ||
      item.asset_tag.toLowerCase().includes(q) ||
      item.asset_name.toLowerCase().includes(q) ||
      item.employee_first_name.toLowerCase().includes(q) ||
      item.employee_last_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Asset Returns & Inward Inspection"
        description="Receive assigned assets back into company possession, execute multi-point inspections, and direct assets to available stock, maintenance, or damage review."
        icon={<RotateCcw className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Operations" },
          { label: "Asset Returns" },
        ]}
        actions={
          canManage ? (
            <Button
              onClick={handleOpenReturnModal}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Return Asset
            </Button>
          ) : undefined
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search return code, asset tag, custodian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={inspectionFilter}
              onChange={(e) => {
                setInspectionFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Inspection Statuses</option>
              <option value="PENDING_INSPECTION">PENDING INSPECTION</option>
              <option value="PASSED">PASSED</option>
              <option value="MAINTENANCE_REQUIRED">MAINTENANCE REQUIRED</option>
              <option value="DAMAGE_REVIEW">DAMAGE REVIEW</option>
            </select>

            {user?.isCommonAdmin && companies.length > 0 && (
              <select
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setPage(1);
                }}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500 self-center">
          Showing <span className="font-semibold text-slate-700">{filteredReturns.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{total}</span> records
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-medium">{error}</p>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RotateCcw className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">No Return Records Found</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              There are no asset return receipts matching the selected criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Return Code</th>
                  <th className="px-6 py-3.5">Asset</th>
                  <th className="px-6 py-3.5">Returned By</th>
                  <th className="px-6 py-3.5">Reason & Condition</th>
                  <th className="px-6 py-3.5">Inspection Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-900 text-xs block">
                        {item.return_code}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.returned_at).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <Link
                          href={`/assets/${item.asset_id}`}
                          className="font-mono font-bold text-teal-700 hover:underline"
                        >
                          {item.asset_tag}
                        </Link>
                        <span className="font-medium text-slate-800 text-sm">{item.asset_name}</span>
                        {item.serial_number && (
                          <span className="text-xs text-slate-400 font-mono">SN: {item.serial_number}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                          {item.employee_first_name} {item.employee_last_name}
                        </span>
                        <span className="text-xs font-mono text-slate-500">{item.employee_code}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-700 text-xs">
                          {item.return_reason?.replace(/_/g, " ") || "GENERAL RETURN"}
                        </span>
                        <span className="text-xs text-slate-500">
                          Condition: <span className="font-semibold">{item.condition}</span>
                        </span>
                        {item.missing_accessories && (
                          <span className="text-[11px] text-rose-600">
                            Missing: {item.missing_accessories}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {item.inspection_status === "PENDING_INSPECTION" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pending Inspection
                        </span>
                      )}
                      {item.inspection_status === "PASSED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Passed (Available)
                        </span>
                      )}
                      {item.inspection_status === "MAINTENANCE_REQUIRED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                          <Wrench className="w-3 h-3 text-sky-600" />
                          Maintenance Required
                        </span>
                      )}
                      {item.inspection_status === "DAMAGE_REVIEW" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Damage Review
                        </span>
                      )}
                      {item.inspected_by_username && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          By: {item.inspected_by_username}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.inspection_status === "PENDING_INSPECTION" && canManage && (
                          <button
                            onClick={() => handleOpenInspectModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-lg text-xs font-medium transition"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            Inspect Return
                          </button>
                        )}
                        <Link
                          href={`/assets/${item.asset_id}`}
                          className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
                          title="View Asset Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Return Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Initiate Asset Return Receipt"
        maxWidth="lg"
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          {returnError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{returnError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Select Currently Assigned Asset *
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              required
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Assigned Asset --</option>
              {assignedAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_tag} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Returned By Employee *
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              required
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Returning Custodian --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Return Reason
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="PROJECT_COMPLETION">PROJECT COMPLETION</option>
                <option value="RESIGNATION">RESIGNATION / SEPARATION</option>
                <option value="UPGRADE">EQUIPMENT UPGRADE</option>
                <option value="DEFECTIVE">DEFECTIVE / MALFUNCTION</option>
                <option value="ROUTINE_CYCLE">ROUTINE ROTATION</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Intake Condition
              </label>
              <select
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="EXCELLENT">EXCELLENT</option>
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
                <option value="POOR">POOR</option>
                <option value="DAMAGED">DAMAGED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Return Intake Notes
            </label>
            <textarea
              rows={2}
              value={returnRemarks}
              onChange={(e) => setReturnRemarks(e.target.value)}
              placeholder="e.g. Asset returned along with original bag and charging adapter..."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingReturn}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmittingReturn ? "Processing..." : "Generate Return Receipt"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Inspect Modal */}
      <Modal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        title="Execute Technical Return Inspection"
        maxWidth="lg"
      >
        <form onSubmit={handleInspectSubmit} className="space-y-4">
          {inspectError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{inspectError}</span>
            </div>
          )}

          {targetReturn && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-800">
                  {targetReturn.asset_tag} — {targetReturn.asset_name}
                </span>
                <span className="font-mono text-xs text-slate-500">{targetReturn.return_code}</span>
              </div>
              <div className="text-xs text-slate-500">
                Returned by: {targetReturn.employee_first_name} {targetReturn.employee_last_name} | Intake Condition: {targetReturn.condition}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Inspection Decision & Asset State Transition *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setInspectDecision("PASSED")}
                className={`p-3 rounded-lg border text-left transition flex flex-col gap-1 ${
                  inspectDecision === "PASSED"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  PASSED
                </div>
                <span className="text-[11px] text-slate-500">Return to Available Stock</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectDecision("MAINTENANCE_REQUIRED")}
                className={`p-3 rounded-lg border text-left transition flex flex-col gap-1 ${
                  inspectDecision === "MAINTENANCE_REQUIRED"
                    ? "border-sky-600 bg-sky-50 text-sky-900"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-sky-700">
                  <Wrench className="w-4 h-4" />
                  MAINTENANCE
                </div>
                <span className="text-[11px] text-slate-500">Under Maintenance</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectDecision("DAMAGE_REVIEW")}
                className={`p-3 rounded-lg border text-left transition flex flex-col gap-1 ${
                  inspectDecision === "DAMAGE_REVIEW"
                    ? "border-rose-600 bg-rose-50 text-rose-900"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-700">
                  <AlertTriangle className="w-4 h-4" />
                  DAMAGE REVIEW
                </div>
                <span className="text-[11px] text-slate-500">Flag for Triage</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Post-Inspection Condition
              </label>
              <select
                value={inspectCondition}
                onChange={(e) => setInspectCondition(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="EXCELLENT">EXCELLENT</option>
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
                <option value="POOR">POOR</option>
                <option value="DAMAGED">DAMAGED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Functional Operability
              </label>
              <select
                value={functionalStatus}
                onChange={(e) => setFunctionalStatus(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="FUNCTIONAL">Fully Functional</option>
                <option value="PARTIALLY_FUNCTIONAL">Partially Functional</option>
                <option value="NON_FUNCTIONAL">Non-Functional</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Missing Accessories
              </label>
              <input
                type="text"
                value={missingAccessories}
                onChange={(e) => setMissingAccessories(e.target.value)}
                placeholder="e.g. Power cord, USB adapter"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Missing Internal Components
              </label>
              <input
                type="text"
                value={missingComponents}
                onChange={(e) => setMissingComponents(e.target.value)}
                placeholder="e.g. Battery pack, RAM module"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Detailed Inspection Findings
            </label>
            <textarea
              rows={2}
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
              placeholder="e.g. Device passed power cycle and visual check with no physical defects..."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsInspectModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingInspect}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmittingInspect ? "Recording..." : "Finalize Inspection"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

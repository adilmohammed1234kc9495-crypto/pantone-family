"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  ShieldCheck,
  FileSignature,
  Calendar,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface AssignmentItem {
  id: string;
  asset_id: string;
  company_id: string;
  employee_id: string;
  department_id: string | null;
  location_id: string | null;
  assigned_by: string | null;
  assigned_at: string;
  condition_at_assignment: string;
  return_due_date: string | null;
  remarks: string | null;
  status: "ACTIVE" | "RETURNED" | "CANCELLED";
  is_handed_over: boolean;
  handed_over_at: string | null;
  handed_over_by: string | null;
  handover_condition: string | null;
  handover_remarks: string | null;
  handover_signature_ref: string | null;
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  department_name: string | null;
  location_room: string | null;
  assigned_by_username: string | null;
  handed_over_by_username: string | null;
}

interface AssetItem {
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
  department_id: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function AssignmentsPage() {
  const { hasPermission, user } = useAuth();

  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [availableAssets, setAvailableAssets] = useState<AssetItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [handoverFilter, setHandoverFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [conditionAtAssignment, setConditionAtAssignment] = useState("EXCELLENT");
  const [returnDueDate, setReturnDueDate] = useState("");
  const [assignRemarks, setAssignRemarks] = useState("");
  const [isImmediateHandover, setIsImmediateHandover] = useState(true);
  const [handoverCondition, setHandoverCondition] = useState("EXCELLENT");
  const [handoverRemarks, setHandoverRemarks] = useState("");
  const [handoverSignatureRef, setHandoverSignatureRef] = useState("");
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Handover Modal
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [targetAssignment, setTargetAssignment] = useState<AssignmentItem | null>(null);
  const [confirmCondition, setConfirmCondition] = useState("GOOD");
  const [confirmRemarks, setConfirmRemarks] = useState("");
  const [confirmSignatureRef, setConfirmSignatureRef] = useState("");
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [handoverModalError, setHandoverModalError] = useState<string | null>(null);

  const canAssign = user?.isCommonAdmin || hasPermission("assignments:create") || hasPermission("assets:update");

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (handoverFilter !== "") params.set("isHandedOver", handoverFilter);
      if (companyFilter) params.set("companyId", companyFilter);

      const res = await apiClient.get<any>(`/assignments?${params.toString()}`);
      const data = res?.assignments || res?.items || res?.data?.assignments || [];
      const totalCount = res?.total || res?.data?.total || 0;
      const pages = res?.totalPages || Math.ceil(totalCount / limit) || 1;

      setAssignments(data);
      setTotal(totalCount);
      setTotalPages(pages);
    } catch (err: any) {
      setError(err.message || "Failed to load asset assignments.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, handoverFilter, companyFilter]);

  const loadDropdowns = useCallback(async () => {
    try {
      if (user?.isCommonAdmin) {
        const compRes = await apiClient.get<any>("/companies");
        if (compRes) {
          setCompanies(compRes.companies || compRes.data?.companies || (Array.isArray(compRes) ? compRes : []));
        }
      }

      // Fetch available assets for assignment
      const assetParams = new URLSearchParams({ status: "AVAILABLE", limit: "100" });
      if (companyFilter) assetParams.set("companyId", companyFilter);
      const assetRes = await apiClient.get<any>(`/assets?${assetParams.toString()}`);
      const assetsList = assetRes?.assets || assetRes?.items || [];
      setAvailableAssets(assetsList);

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
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  const handleOpenAssignModal = () => {
    setSelectedAssetId("");
    setSelectedEmployeeId("");
    setConditionAtAssignment("EXCELLENT");
    setReturnDueDate("");
    setAssignRemarks("");
    setIsImmediateHandover(true);
    setHandoverCondition("EXCELLENT");
    setHandoverRemarks("");
    setHandoverSignatureRef(`SIG-${Math.floor(100000 + Math.random() * 900000)}`);
    setAssignError(null);
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setAssignError("Please select an available asset to assign.");
      return;
    }
    if (!selectedEmployeeId) {
      setAssignError("Please select a custodian employee.");
      return;
    }

    setIsSubmittingAssign(true);
    setAssignError(null);

    try {
      await apiClient.post("/assignments", {
        assetId: selectedAssetId,
        employeeId: selectedEmployeeId,
        conditionAtAssignment,
        returnDueDate: returnDueDate || null,
        remarks: assignRemarks || null,
        isHandedOver: isImmediateHandover,
        handoverCondition: isImmediateHandover ? handoverCondition : undefined,
        handoverRemarks: isImmediateHandover ? handoverRemarks : undefined,
        handoverSignatureRef: isImmediateHandover ? handoverSignatureRef : undefined,
      });

      setIsAssignModalOpen(false);
      loadAssignments();
      loadDropdowns();
    } catch (err: any) {
      setAssignError(err.message || "Failed to assign asset.");
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const handleOpenHandoverModal = (assignment: AssignmentItem) => {
    setTargetAssignment(assignment);
    setConfirmCondition(assignment.condition_at_assignment || "GOOD");
    setConfirmRemarks("");
    setConfirmSignatureRef(`SIG-${Math.floor(100000 + Math.random() * 900000)}`);
    setHandoverModalError(null);
    setIsHandoverModalOpen(true);
  };

  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssignment) return;

    setIsSubmittingHandover(true);
    setHandoverModalError(null);

    try {
      await apiClient.post(`/assignments/${targetAssignment.id}/handover`, {
        condition: confirmCondition,
        remarks: confirmRemarks || "Physical custody handover verified.",
        signatureRef: confirmSignatureRef || null,
      });

      setIsHandoverModalOpen(false);
      setTargetAssignment(null);
      loadAssignments();
    } catch (err: any) {
      setHandoverModalError(err.message || "Failed to confirm handover.");
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  const filteredAssignments = assignments.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.asset_tag.toLowerCase().includes(q) ||
      item.asset_name.toLowerCase().includes(q) ||
      item.employee_first_name.toLowerCase().includes(q) ||
      item.employee_last_name.toLowerCase().includes(q) ||
      item.employee_code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Asset Custody & Assignments"
        description="Assign company assets to employees, verify physical handovers, and track active custody across departments."
        icon={<UserCheck className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Operations" },
          { label: "Custody Assignments" },
        ]}
        actions={
          canAssign ? (
            <Button
              onClick={handleOpenAssignModal}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Assign Asset
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
              placeholder="Search by asset tag, name, employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="RETURNED">RETURNED</option>
            </select>

            <select
              value={handoverFilter}
              onChange={(e) => {
                setHandoverFilter(e.target.value);
                setPage(1);
              }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Handovers</option>
              <option value="true">Handed Over</option>
              <option value="false">Pending Handover</option>
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
          Showing <span className="font-semibold text-slate-700">{filteredAssignments.length}</span> of{" "}
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
        ) : filteredAssignments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <UserCheck className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">No Assignments Found</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              There are no custody assignment records matching the current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Asset</th>
                  <th className="px-6 py-3.5">Custodian</th>
                  <th className="px-6 py-3.5">Assigned Date</th>
                  <th className="px-6 py-3.5">Physical Handover</th>
                  <th className="px-6 py-3.5">Custody Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
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
                        {item.department_name && (
                          <span className="text-xs text-slate-400">{item.department_name}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-700 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(item.assigned_at).toLocaleDateString()}</span>
                        </div>
                        {item.return_due_date && (
                          <span className="text-slate-400 block text-[11px]">
                            Due: {new Date(item.return_due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {item.is_handed_over ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Handed Over
                          </span>
                          {item.handover_condition && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              Cond: {item.handover_condition}
                            </span>
                          )}
                          {item.handover_signature_ref && (
                            <span className="text-[10px] font-mono text-slate-400">
                              Ref: {item.handover_signature_ref}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Pending Handover
                          </span>
                          <span className="text-[11px] text-amber-600">Awaiting Physical Custody</span>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={item.status} />
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === "ACTIVE" && !item.is_handed_over && canAssign && (
                          <button
                            onClick={() => handleOpenHandoverModal(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-medium transition"
                          >
                            <FileSignature className="w-3.5 h-3.5" />
                            Confirm Handover
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

      {/* Assign Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Asset to Employee"
        maxWidth="lg"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          {assignError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{assignError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Select Asset (Available Only) *
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              required
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose an Available Asset --</option>
              {availableAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_tag} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Custodian Employee *
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              required
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Custodian Employee --</option>
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
                Condition at Assignment
              </label>
              <select
                value={conditionAtAssignment}
                onChange={(e) => setConditionAtAssignment(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="EXCELLENT">EXCELLENT</option>
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Expected Return Date
              </label>
              <input
                type="date"
                value={returnDueDate}
                onChange={(e) => setReturnDueDate(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Handover toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-800 block">
                  Confirm Immediate Physical Handover
                </span>
                <span className="text-xs text-slate-500">
                  Enable if the asset is physically delivered to the employee right now.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isImmediateHandover}
                onChange={(e) => setIsImmediateHandover(e.target.checked)}
                className="h-4 w-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
              />
            </div>

            {isImmediateHandover && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Handover Condition</label>
                  <select
                    value={handoverCondition}
                    onChange={(e) => setHandoverCondition(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
                  >
                    <option value="EXCELLENT">EXCELLENT</option>
                    <option value="GOOD">GOOD</option>
                    <option value="FAIR">FAIR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Signature / Ack. Code</label>
                  <input
                    type="text"
                    value={handoverSignatureRef}
                    onChange={(e) => setHandoverSignatureRef(e.target.value)}
                    placeholder="e.g. SIG-849102"
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Assignment Remarks
            </label>
            <textarea
              rows={2}
              value={assignRemarks}
              onChange={(e) => setAssignRemarks(e.target.value)}
              placeholder="e.g. Assigned for Q4 project milestone..."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAssign}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmittingAssign ? "Assigning Asset..." : "Confirm Assignment"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Handover Modal */}
      <Modal
        isOpen={isHandoverModalOpen}
        onClose={() => setIsHandoverModalOpen(false)}
        title="Confirm Physical Custody Handover"
        maxWidth="md"
      >
        <form onSubmit={handleHandoverSubmit} className="space-y-4">
          {handoverModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{handoverModalError}</span>
            </div>
          )}

          {targetAssignment && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-1">
              <div className="font-semibold text-slate-800">
                {targetAssignment.asset_tag} — {targetAssignment.asset_name}
              </div>
              <div className="text-xs text-slate-500">
                Custodian: {targetAssignment.employee_first_name} {targetAssignment.employee_last_name} ({targetAssignment.employee_code})
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Physical Condition Verified *
            </label>
            <select
              value={confirmCondition}
              onChange={(e) => setConfirmCondition(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="EXCELLENT">EXCELLENT</option>
              <option value="GOOD">GOOD</option>
              <option value="FAIR">FAIR</option>
              <option value="DAMAGED">DAMAGED</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Sign-Off Reference / Token
            </label>
            <input
              type="text"
              value={confirmSignatureRef}
              onChange={(e) => setConfirmSignatureRef(e.target.value)}
              placeholder="e.g. EMP-SIG-8491"
              className="w-full text-sm font-mono border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Handover Remarks
            </label>
            <textarea
              rows={2}
              value={confirmRemarks}
              onChange={(e) => setConfirmRemarks(e.target.value)}
              placeholder="e.g. Device inspected, chargers and protective case included."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsHandoverModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingHandover}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmittingHandover ? "Verifying..." : "Acknowledge Handover"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

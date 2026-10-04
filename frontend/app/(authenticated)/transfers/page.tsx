"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  ArrowLeftRight,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  Building2,
  Users,
  MapPin,
  Calendar,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface TransferItem {
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
  remarks: string | null;
  requested_by_username: string | null;
  approved_by_username: string | null;
  dispatched_by_username: string | null;
  received_by_username: string | null;
  created_at: string;
}

interface AssetItem {
  id: string;
  asset_tag: string;
  name: string;
  status: string;
  condition: string;
  company_id: string;
}

interface EmployeeItem {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  company_id: string;
}

interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  company_id: string;
}

interface LocationItem {
  id: string;
  building: string;
  floor: string | null;
  room_number: string | null;
  description: string | null;
  company_id: string;
}

interface CompanyItem {
  id: string;
  name: string;
  code: string;
}

export default function TransfersPage() {
  const { user, hasPermission } = useAuth();

  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"ALL" | "INTERNAL" | "INTER_COMPANY" | "IN_TRANSIT" | "DISPUTED">("ALL");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Data
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetsList, setAssetsList] = useState<AssetItem[]>([]);
  const [employeesList, setEmployeesList] = useState<EmployeeItem[]>([]);
  const [departmentsList, setDepartmentsList] = useState<DepartmentItem[]>([]);
  const [locationsList, setLocationsList] = useState<LocationItem[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyItem[]>([]);

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    assetId: "",
    transferType: "EMPLOYEE_TO_EMPLOYEE" as "EMPLOYEE_TO_EMPLOYEE" | "DEPT_TO_DEPT" | "LOCATION_TO_LOCATION" | "INTER_COMPANY",
    toCompanyId: "",
    toEmployeeId: "",
    toDepartmentId: "",
    toLocationId: "",
    reason: "",
    conditionBefore: "GOOD",
    expectedDeliveryDate: "",
    transferFee: 0,
    remarks: "",
  });

  const fetchTransfers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());

      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("transferType", typeFilter);

      // Handle tab filters
      if (activeTab === "INTER_COMPANY") {
        params.set("transferType", "INTER_COMPANY");
      } else if (activeTab === "IN_TRANSIT") {
        params.set("status", "DISPATCHED");
      } else if (activeTab === "DISPUTED") {
        params.set("status", "DISPUTED");
      }

      const res = await apiClient.get<{ transfers: TransferItem[]; total: number }>(
        `/transfers?${params.toString()}`
      );

      let filtered = res.transfers;
      if (activeTab === "INTERNAL") {
        filtered = filtered.filter((t) => t.transfer_type !== "INTER_COMPANY");
      }

      setTransfers(filtered);
      setTotal(res.total);
      setTotalPages(Math.ceil(res.total / limit) || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load asset transfers");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, typeFilter, activeTab]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Load auxiliary lists when opening initiate modal
  const openInitiateModal = async () => {
    setIsModalOpen(true);
    setFormError(null);
    try {
      const [assetsRes, empRes, deptRes, locRes, compRes] = await Promise.all([
        apiClient.get<{ assets: AssetItem[] }>("/assets?limit=100"),
        apiClient.get<{ employees: EmployeeItem[] }>("/employees?limit=100"),
        apiClient.get<{ departments: DepartmentItem[] }>("/departments?limit=100"),
        apiClient.get<{ locations: LocationItem[] }>("/locations?limit=100"),
        apiClient.get<CompanyItem[]>("/companies"),
      ]);

      // Only allow assets that can be transferred
      const validAssets = (assetsRes.assets || []).filter(
        (a) => !["UNDER_MAINTENANCE", "DAMAGED", "LOST", "IN_TRANSIT", "DISPUTED", "RETIRED", "DISPOSED"].includes(a.status)
      );

      setAssetsList(validAssets);
      setEmployeesList(empRes.employees || []);
      setDepartmentsList(deptRes.departments || []);
      setLocationsList(locRes.locations || []);
      setCompaniesList(compRes || []);

      if (validAssets.length > 0 && !formData.assetId) {
        setFormData((prev) => ({
          ...prev,
          assetId: validAssets[0].id,
          conditionBefore: validAssets[0].condition || "GOOD",
        }));
      }
    } catch (err: any) {
      setFormError("Failed to load options for transfer initiation: " + (err.message || "Unknown error"));
    }
  };

  const handleInitiateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetId) {
      setFormError("Please select an asset to transfer");
      return;
    }
    if (!formData.reason.trim()) {
      setFormError("Transfer reason / justification is required");
      return;
    }

    if (formData.transferType === "EMPLOYEE_TO_EMPLOYEE" && !formData.toEmployeeId) {
      setFormError("Please select the target recipient employee");
      return;
    }
    if (formData.transferType === "DEPT_TO_DEPT" && !formData.toDepartmentId) {
      setFormError("Please select the target department");
      return;
    }
    if (formData.transferType === "LOCATION_TO_LOCATION" && !formData.toLocationId) {
      setFormError("Please select the target physical location");
      return;
    }
    if (formData.transferType === "INTER_COMPANY" && !formData.toCompanyId) {
      setFormError("Please select the target receiving company");
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      await apiClient.post("/transfers", {
        assetId: formData.assetId,
        transferType: formData.transferType,
        toCompanyId: formData.transferType === "INTER_COMPANY" ? formData.toCompanyId : undefined,
        toEmployeeId: formData.transferType === "EMPLOYEE_TO_EMPLOYEE" ? formData.toEmployeeId : undefined,
        toDepartmentId: formData.transferType === "DEPT_TO_DEPT" ? formData.toDepartmentId : undefined,
        toLocationId: formData.transferType === "LOCATION_TO_LOCATION" ? formData.toLocationId : undefined,
        reason: formData.reason.trim(),
        conditionBefore: formData.conditionBefore,
        expectedDeliveryDate: formData.expectedDeliveryDate || undefined,
        transferFee: formData.transferFee ? Number(formData.transferFee) : 0,
        remarks: formData.remarks || undefined,
      });

      setIsModalOpen(false);
      setFormData({
        assetId: "",
        transferType: "EMPLOYEE_TO_EMPLOYEE",
        toCompanyId: "",
        toEmployeeId: "",
        toDepartmentId: "",
        toLocationId: "",
        reason: "",
        conditionBefore: "GOOD",
        expectedDeliveryDate: "",
        transferFee: 0,
        remarks: "",
      });
      fetchTransfers();
    } catch (err: any) {
      setFormError(err.message || "Failed to initiate transfer");
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalTransfers = total;
  const inTransitCount = transfers.filter((t) => t.status === "DISPATCHED").length;
  const disputedCount = transfers.filter((t) => t.status === "DISPUTED").length;
  const interCompanyCount = transfers.filter((t) => t.transfer_type === "INTER_COMPANY").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Asset Transfers & Protocols"
        description="Inter-department relocations, employee custody reassignments, and dual-authorized inter-company shipments."
        icon={<ArrowLeftRight className="w-6 h-6 text-teal-600" />}
        actions={
          (user?.isCommonAdmin ||
            hasPermission("transfers:create") ||
            hasPermission("assets:create")) && (
            <Button
              variant="primary"
              size="sm"
              onClick={openInitiateModal}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Initiate Transfer
            </Button>
          )
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-lg border border-slate-200/90 shadow-subtle flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Transfers
            </p>
            <p className="text-xl font-bold font-mono text-slate-900 mt-1">
              {totalTransfers}
            </p>
          </div>
          <div className="p-2.5 bg-slate-100 rounded-md text-slate-600">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200/90 shadow-subtle flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Inter-Company
            </p>
            <p className="text-xl font-bold font-mono text-teal-700 mt-1">
              {interCompanyCount}
            </p>
          </div>
          <div className="p-2.5 bg-teal-50 rounded-md text-teal-700">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200/90 shadow-subtle flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              In-Transit
            </p>
            <p className="text-xl font-bold font-mono text-amber-700 mt-1">
              {inTransitCount}
            </p>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-md text-amber-700">
            <Truck className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200/90 shadow-subtle flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Disputed Items
            </p>
            <p className="text-xl font-bold font-mono text-rose-700 mt-1">
              {disputedCount}
            </p>
          </div>
          <div className="p-2.5 bg-rose-50 rounded-md text-rose-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 pt-3 flex flex-wrap gap-2">
          {[
            { id: "ALL", label: "All Transfers" },
            { id: "INTERNAL", label: "Internal Moves" },
            { id: "INTER_COMPANY", label: "Inter-Company" },
            { id: "IN_TRANSIT", label: "In Transit" },
            { id: "DISPUTED", label: "Disputed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setPage(1);
              }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-teal-600 text-teal-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Secondary Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, asset, or reason..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeTab === "ALL" && (
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Types</option>
                <option value="EMPLOYEE_TO_EMPLOYEE">Employee Custody</option>
                <option value="DEPT_TO_DEPT">Department Move</option>
                <option value="LOCATION_TO_LOCATION">Location Move</option>
                <option value="INTER_COMPANY">Inter-Company Transfer</option>
              </select>
            )}

            {activeTab !== "IN_TRANSIT" && activeTab !== "DISPUTED" && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">All Statuses</option>
                <option value="INITIATED">INITIATED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="DISPUTED">DISPUTED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            )}

            <button
              onClick={() => fetchTransfers()}
              title="Refresh list"
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-rose-900">{error}</p>
            <button
              onClick={() => fetchTransfers()}
              className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : transfers.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowLeftRight className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No transfers found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              There are no asset transfer records matching your current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Transfer Code</th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Transfer Type</th>
                  <th className="px-4 py-3">Origin &rarr; Destination</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Initiated At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-teal-700">
                      <Link href={`/transfers/${item.id}`} className="hover:underline flex items-center gap-1.5">
                        {item.transfer_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-900">{item.asset_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{item.asset_tag}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      {item.transfer_type === "INTER_COMPANY" ? (
                        <Badge variant="brand">Inter-Company</Badge>
                      ) : item.transfer_type === "EMPLOYEE_TO_EMPLOYEE" ? (
                        <Badge variant="info">Employee Custody</Badge>
                      ) : item.transfer_type === "DEPT_TO_DEPT" ? (
                        <Badge variant="neutral">Department Move</Badge>
                      ) : (
                        <Badge variant="neutral">Location Move</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-slate-800 font-medium">
                        {item.transfer_type === "INTER_COMPANY" ? (
                          <span className="flex items-center gap-1">
                            <span className="text-indigo-600">{item.from_company_code}</span>
                            <span className="text-slate-400">&rarr;</span>
                            <span className="text-teal-600">{item.to_company_code}</span>
                          </span>
                        ) : item.transfer_type === "EMPLOYEE_TO_EMPLOYEE" ? (
                          <span>
                            {item.from_employee_name || "Unassigned"} &rarr; {item.to_employee_name || "Recipient"}
                          </span>
                        ) : item.transfer_type === "DEPT_TO_DEPT" ? (
                          <span>
                            {item.from_department_name || "Current"} &rarr; {item.to_department_name}
                          </span>
                        ) : (
                          <span>
                            {item.from_location_name || "Current"} &rarr; {item.to_location_name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 line-clamp-1 italic mt-0.5">
                        {item.reason}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        href={`/transfers/${item.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing page {page} of {totalPages} ({total} transfers)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Initiate Transfer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Initiate Asset Transfer"
      >
        <form onSubmit={handleInitiateSubmit} className="space-y-4 text-sm text-slate-700">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Asset Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Select Asset *
            </label>
            <select
              value={formData.assetId}
              onChange={(e) => {
                const selected = assetsList.find((a) => a.id === e.target.value);
                setFormData({
                  ...formData,
                  assetId: e.target.value,
                  conditionBefore: selected?.condition || "GOOD",
                });
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="">-- Choose Asset --</option>
              {assetsList.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.asset_tag} — {asset.name} ({asset.status})
                </option>
              ))}
            </select>
          </div>

          {/* Transfer Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Transfer Type *
            </label>
            <select
              value={formData.transferType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  transferType: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="EMPLOYEE_TO_EMPLOYEE">Employee Custody Transfer (Internal)</option>
              <option value="DEPT_TO_DEPT">Department Move (Internal)</option>
              <option value="LOCATION_TO_LOCATION">Location Relocation (Internal)</option>
              <option value="INTER_COMPANY">Inter-Company Transfer (Dual Authorization Required)</option>
            </select>
          </div>

          {/* Dynamic Target Fields */}
          {formData.transferType === "EMPLOYEE_TO_EMPLOYEE" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Destination Recipient Employee *
              </label>
              <select
                value={formData.toEmployeeId}
                onChange={(e) => setFormData({ ...formData, toEmployeeId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">-- Select Recipient Employee --</option>
                {employeesList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_code} — {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.transferType === "DEPT_TO_DEPT" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Destination Department *
              </label>
              <select
                value={formData.toDepartmentId}
                onChange={(e) => setFormData({ ...formData, toDepartmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">-- Select Department --</option>
                {departmentsList.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.code} — {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.transferType === "LOCATION_TO_LOCATION" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Destination Location *
              </label>
              <select
                value={formData.toLocationId}
                onChange={(e) => setFormData({ ...formData, toLocationId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">-- Select Location --</option>
                {locationsList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.building} {loc.floor ? ` - ${loc.floor}` : ""} {loc.room_number ? ` - ${loc.room_number}` : ""} {loc.description ? ` (${loc.description})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.transferType === "INTER_COMPANY" && (
            <div className="space-y-3 p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg">
              <div>
                <label className="block text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1">
                  Destination Company *
                </label>
                <select
                  value={formData.toCompanyId}
                  onChange={(e) => setFormData({ ...formData, toCompanyId: e.target.value })}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="">-- Select Target Company --</option>
                  {companiesList.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} ({comp.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">
                    Inter-Company Fee ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.transferFee}
                    onChange={(e) => setFormData({ ...formData, transferFee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.expectedDeliveryDate}
                    onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Condition Before & Reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Condition Before Dispatch
              </label>
              <select
                value={formData.conditionBefore}
                onChange={(e) => setFormData({ ...formData, conditionBefore: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="NEW">NEW</option>
                <option value="EXCELLENT">EXCELLENT</option>
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
                <option value="DAMAGED">DAMAGED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Business Justification / Reason *
            </label>
            <textarea
              rows={2}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Explain why this transfer is required..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Additional Remarks (Optional)
            </label>
            <input
              type="text"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Logistics, packaging, or handling notes..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {submitting ? "Initiating..." : "Initiate Transfer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

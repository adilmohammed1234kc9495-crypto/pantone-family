"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  Calendar,
  Layers,
  Activity,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface MaintenanceItem {
  id: string;
  maintenance_code: string;
  work_order_number: string | null;
  asset_id: string;
  company_id: string;
  problem: string;
  reported_by: string | null;
  report_date: string;
  vendor_id: string | null;
  technician_name: string | null;
  estimated_cost: number;
  actual_cost: number;
  currency: string;
  invoice_reference: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  maintenance_type: string;
  priority: string;
  description: string | null;
  remarks: string | null;
  completed_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  closed_at: string | null;
  inspection_id: string | null;
  created_at: string;
  asset_tag: string;
  asset_name: string;
  serial_number: string | null;
  reported_by_username: string | null;
  completed_by_username: string | null;
  verified_by_username: string | null;
  vendor_name: string | null;
}

interface AssetItem {
  id: string;
  asset_tag: string;
  name: string;
  status: string;
}

interface VendorItem {
  id: string;
  name: string;
  vendor_code: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function MaintenancePage() {
  const { hasPermission, user } = useAuth();

  const [records, setRecords] = useState<MaintenanceItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create WO Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [workOrderType, setWorkOrderType] = useState("CORRECTIVE");
  const [priority, setPriority] = useState("MEDIUM");
  const [problem, setProblem] = useState("");
  const [description, setDescription] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Status Advance Modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetRecord, setTargetRecord] = useState<MaintenanceItem | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [statusTechnician, setStatusTechnician] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [statusRemarks, setStatusRemarks] = useState("");
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [statusModalError, setStatusModalError] = useState<string | null>(null);

  const canManage = user?.isCommonAdmin || hasPermission("maintenance:create") || hasPermission("assets:update");

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (companyFilter) params.set("companyId", companyFilter);

      const res = await apiClient.get<any>(`/maintenance?${params.toString()}`);
      const data = res?.records || res?.items || res?.data?.records || [];
      const totalCount = res?.total || res?.data?.total || 0;
      const pages = res?.totalPages || Math.ceil(totalCount / limit) || 1;

      setRecords(data);
      setTotal(totalCount);
      setTotalPages(pages);
    } catch (err: any) {
      setError(err.message || "Failed to load maintenance records.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, companyFilter]);

  const loadDropdowns = useCallback(async () => {
    try {
      if (user?.isCommonAdmin) {
        const compRes = await apiClient.get<any>("/companies");
        if (compRes) {
          setCompanies(compRes.companies || compRes.data?.companies || (Array.isArray(compRes) ? compRes : []));
        }
      }

      // Assets
      const assetParams = new URLSearchParams({ limit: "150" });
      if (companyFilter) assetParams.set("companyId", companyFilter);
      const assetRes = await apiClient.get<any>(`/assets?${assetParams.toString()}`);
      const assetsList = assetRes?.assets || assetRes?.items || [];
      setAssets(assetsList);

      // Vendors
      const vendorParams = new URLSearchParams({ limit: "100" });
      if (companyFilter) vendorParams.set("companyId", companyFilter);
      const vendorRes = await apiClient.get<any>(`/vendors?${vendorParams.toString()}`);
      const vendorList = vendorRes?.vendors || vendorRes?.items || (Array.isArray(vendorRes) ? vendorRes : []);
      setVendors(vendorList);
    } catch (err: any) {
      console.error("Dropdown load error:", err);
    }
  }, [user?.isCommonAdmin, companyFilter]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  const handleOpenCreateModal = () => {
    setSelectedAssetId("");
    setWorkOrderType("CORRECTIVE");
    setPriority("MEDIUM");
    setProblem("");
    setDescription("");
    setTechnicianName("");
    setSelectedVendorId("");
    setEstimatedCost("0");
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) {
      setCreateError("Please select the asset requiring maintenance.");
      return;
    }
    if (!problem.trim()) {
      setCreateError("Please provide a problem summary / title.");
      return;
    }

    setIsSubmittingCreate(true);
    setCreateError(null);

    try {
      await apiClient.post("/maintenance", {
        assetId: selectedAssetId,
        maintenanceType: workOrderType,
        priority,
        problem: problem.trim(),
        description: description.trim() || undefined,
        technicianName: technicianName.trim() || undefined,
        vendorId: selectedVendorId || undefined,
        estimatedCost: parseFloat(estimatedCost) || 0,
      });

      setIsCreateModalOpen(false);
      loadRecords();
      loadDropdowns();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create work order.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const getPermissibleTransitions = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case "OPEN":
        return ["ASSIGNED", "CANCELLED"];
      case "ASSIGNED":
        return ["IN_PROGRESS", "CANCELLED"];
      case "IN_PROGRESS":
        return ["WAITING_PARTS", "COMPLETED", "CANCELLED"];
      case "WAITING_PARTS":
        return ["IN_PROGRESS", "CANCELLED"];
      case "COMPLETED":
        return ["VERIFIED"];
      case "VERIFIED":
        return ["CLOSED"];
      default:
        return [];
    }
  };

  const handleOpenStatusModal = (rec: MaintenanceItem) => {
    const transitions = getPermissibleTransitions(rec.status);
    setTargetRecord(rec);
    setNextStatus(transitions[0] || "");
    setStatusTechnician(rec.technician_name || "");
    setActualCost(rec.actual_cost ? rec.actual_cost.toString() : rec.estimated_cost?.toString() || "0");
    setInvoiceReference(rec.invoice_reference || "");
    setStatusRemarks("");
    setStatusModalError(null);
    setIsStatusModalOpen(true);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRecord || !nextStatus) return;

    setIsSubmittingStatus(true);
    setStatusModalError(null);

    try {
      await apiClient.patch(`/maintenance/${targetRecord.id}/status`, {
        status: nextStatus,
        technicianName: statusTechnician.trim() || undefined,
        actualCost: nextStatus === "COMPLETED" ? parseFloat(actualCost) || 0 : undefined,
        invoiceReference: nextStatus === "COMPLETED" ? invoiceReference.trim() || undefined : undefined,
        remarks: statusRemarks.trim() || undefined,
      });

      setIsStatusModalOpen(false);
      setTargetRecord(null);
      loadRecords();
      loadDropdowns();
    } catch (err: any) {
      setStatusModalError(err.message || "Failed to advance work order status.");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
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

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "OPEN":
        return <Badge variant="warning">OPEN</Badge>;
      case "ASSIGNED":
        return <Badge variant="info">ASSIGNED</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="brand">IN PROGRESS</Badge>;
      case "WAITING_PARTS":
        return <Badge variant="warning">WAITING PARTS</Badge>;
      case "COMPLETED":
        return <Badge variant="success">COMPLETED</Badge>;
      case "VERIFIED":
        return <Badge variant="brand">VERIFIED</Badge>;
      case "CLOSED":
        return <Badge variant="neutral">CLOSED</Badge>;
      case "CANCELLED":
        return <Badge variant="danger">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral">{st}</Badge>;
    }
  };

  const filteredRecords = records.filter((item) => {
    if (priorityFilter && item.priority !== priorityFilter) return false;
    if (typeFilter && item.maintenance_type !== typeFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.work_order_number && item.work_order_number.toLowerCase().includes(q)) ||
      item.maintenance_code.toLowerCase().includes(q) ||
      item.asset_tag.toLowerCase().includes(q) ||
      item.asset_name.toLowerCase().includes(q) ||
      item.problem.toLowerCase().includes(q) ||
      (item.technician_name && item.technician_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Maintenance & Work Orders"
        description="Manage asset maintenance lifecycle from initiation to closure, track technician assignments, and capture operational expenses."
        icon={<Wrench className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Operations" },
          { label: "Maintenance" },
        ]}
        actions={
          canManage ? (
            <Button
              onClick={handleOpenCreateModal}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Create Work Order
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
              placeholder="Search WO#, asset tag, title, technician..."
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
              <option value="OPEN">OPEN</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="WAITING_PARTS">WAITING PARTS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="CLOSED">CLOSED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Types</option>
              <option value="PREVENTIVE">PREVENTIVE</option>
              <option value="CORRECTIVE">CORRECTIVE</option>
              <option value="CALIBRATION">CALIBRATION</option>
              <option value="EMERGENCY">EMERGENCY</option>
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
          Showing <span className="font-semibold text-slate-700">{filteredRecords.length}</span> of{" "}
          <span className="font-semibold text-slate-700">{total}</span> records
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="font-medium">{error}</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Wrench className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-semibold text-slate-700">No Maintenance Records Found</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              There are no work orders matching the selected filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Work Order #</th>
                  <th className="px-6 py-3.5">Asset</th>
                  <th className="px-6 py-3.5">Issue & Priority</th>
                  <th className="px-6 py-3.5">Assigned Service</th>
                  <th className="px-6 py-3.5">Cost Tracking</th>
                  <th className="px-6 py-3.5">Lifecycle Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-900 text-xs block">
                        {item.work_order_number || item.maintenance_code}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.report_date).toLocaleDateString()}
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
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-1.5">
                          {getPriorityBadge(item.priority)}
                          <span className="text-xs font-medium text-slate-500 uppercase">
                            {item.maintenance_type}
                          </span>
                        </div>
                        <span className="font-medium text-slate-900 text-xs line-clamp-1">
                          {item.problem}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs">
                        <span className="font-medium text-slate-800">
                          {item.technician_name || item.vendor_name || "Unassigned"}
                        </span>
                        {item.vendor_name && item.technician_name && (
                          <span className="text-[11px] text-slate-400">{item.vendor_name}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs font-mono">
                        <span className="text-slate-800 font-medium">
                          Act: ${Number(item.actual_cost || 0).toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Est: ${Number(item.estimated_cost || 0).toLocaleString()}
                        </span>
                        {item.invoice_reference && (
                          <span className="text-[10px] text-teal-700 font-sans">
                            Inv: {item.invoice_reference}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {getStatusBadge(item.status)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {getPermissibleTransitions(item.status).length > 0 && canManage && (
                          <button
                            onClick={() => handleOpenStatusModal(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 rounded-lg text-xs font-medium transition"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            Advance
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

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Maintenance Work Order"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Select Asset *
            </label>
            <select
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              required
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- Choose Asset --</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_tag} — {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Maintenance Type
              </label>
              <select
                value={workOrderType}
                onChange={(e) => setWorkOrderType(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="CORRECTIVE">CORRECTIVE (Repair defect)</option>
                <option value="PREVENTIVE">PREVENTIVE (Routine service)</option>
                <option value="CALIBRATION">CALIBRATION (Precision tuning)</option>
                <option value="EMERGENCY">EMERGENCY (Critical outage)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Problem Title / Scope *
            </label>
            <input
              type="text"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              required
              placeholder="e.g. Needle drive assembly vibration & belt replacement"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Detailed Scope & Work Instructions
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Inspect drive shaft alignment, replace tensioner springs..."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Internal Technician
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="e.g. Alex Engineer"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                External Vendor
              </label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">-- Optional Vendor --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Estimated Cost ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmittingCreate ? "Creating..." : "Issue Work Order"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Advance Status Modal */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title="Advance Work Order Lifecycle"
        maxWidth="md"
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4">
          {statusModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusModalError}</span>
            </div>
          )}

          {targetRecord && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-1">
              <div className="font-semibold text-slate-800">
                {targetRecord.work_order_number || targetRecord.maintenance_code} — {targetRecord.asset_tag}
              </div>
              <div className="text-xs text-slate-500">
                Current Status: <span className="font-bold text-slate-700">{targetRecord.status}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Select Permissible Next State *
            </label>
            <div className="space-y-2">
              {targetRecord &&
                getPermissibleTransitions(targetRecord.status).map((s) => (
                  <label
                    key={s}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition ${
                      nextStatus === s
                        ? "border-teal-600 bg-teal-50/50 text-teal-900"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="nextStatus"
                        value={s}
                        checked={nextStatus === s}
                        onChange={(e) => setNextStatus(e.target.value)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <span className="font-semibold text-sm">{s.replace(/_/g, " ")}</span>
                    </div>
                  </label>
                ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Technician Assigned / Performing Work
            </label>
            <input
              type="text"
              value={statusTechnician}
              onChange={(e) => setStatusTechnician(e.target.value)}
              placeholder="e.g. Lead Technician John"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {nextStatus === "COMPLETED" && (
            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 block">
                Final Expense Reconciliation
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Actual Cost ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Invoice Reference</label>
                  <input
                    type="text"
                    value={invoiceReference}
                    onChange={(e) => setInvoiceReference(e.target.value)}
                    placeholder="e.g. INV-9812-SRV"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Lifecycle Transition Notes
            </label>
            <textarea
              rows={2}
              value={statusRemarks}
              onChange={(e) => setStatusRemarks(e.target.value)}
              placeholder="e.g. Replacement parts installed and verified operational..."
              className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingStatus}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {isSubmittingStatus ? "Advancing..." : "Apply Transition"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Boxes,
  Calendar,
  User,
  Building2,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface RequisitionItem {
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
  employee_first_name: string;
  employee_last_name: string;
  employee_code: string;
  department_name: string | null;
  category_name: string | null;
  stock_code: string | null;
  created_at: string;
}

export default function RequisitionsListPage() {
  const { user, hasPermission } = useAuth();

  const [requests, setRequests] = useState<RequisitionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [stockItems, setStockItems] = useState<Array<{ id: string; stock_code: string; item_name: string; unit: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [formData, setFormData] = useState({
    requestSource: "CUSTOM", // 'STOCK' | 'CUSTOM'
    stockItemId: "",
    itemName: "",
    categoryId: "",
    departmentId: "",
    quantity: 1,
    priority: "MEDIUM",
    requiredByDate: "",
    justification: "",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
      });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (priorityFilter) params.append("priority", priorityFilter);

      const res = await apiClient<{ requests: RequisitionItem[]; total: number }>(
        `/requests?${params.toString()}`
      );
      setRequests(res.requests || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load asset requisitions");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    // Load metadata for creation modal
    async function loadMeta() {
      try {
        const [stockRes, deptRes, catRes] = await Promise.all([
          apiClient<any>("/stock?limit=100").catch(() => ({ items: [] })),
          apiClient<any>("/departments").catch(() => []),
          apiClient<any>("/categories").catch(() => []),
        ]);
        setStockItems(stockRes.items || []);
        setDepartments(Array.isArray(deptRes) ? deptRes : deptRes.items || []);
        setCategories(Array.isArray(catRes) ? catRes : catRes.items || []);
      } catch {
        // Soft fail
      }
    }
    loadMeta();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);

    try {
      const selectedStock = stockItems.find((s) => s.id === formData.stockItemId);
      const payload: any = {
        quantity: Number(formData.quantity),
        priority: formData.priority,
        justification: formData.justification.trim(),
        departmentId: formData.departmentId || undefined,
        requiredByDate: formData.requiredByDate || undefined,
      };

      if (formData.requestSource === "STOCK" && formData.stockItemId) {
        payload.stockItemId = formData.stockItemId;
        payload.itemName = selectedStock?.item_name || "Catalog Stock Item";
      } else {
        payload.itemName = formData.itemName.trim();
        payload.categoryId = formData.categoryId || undefined;
      }

      await apiClient.post("/requests", payload);

      setIsCreateOpen(false);
      setFormData({
        requestSource: "CUSTOM",
        stockItemId: "",
        itemName: "",
        categoryId: "",
        departmentId: "",
        quantity: 1,
        priority: "MEDIUM",
        requiredByDate: "",
        justification: "",
      });
      fetchRequests();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create requisition");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const renderStatusBadge = (status: string, level: number) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="neutral">DRAFT</Badge>;
      case "PENDING_APPROVAL":
        return <Badge variant="warning">PENDING (Lvl {level})</Badge>;
      case "PARTIALLY_APPROVED":
        return <Badge variant="info">IN PROGRESS (Lvl {level})</Badge>;
      case "APPROVED":
        return <Badge variant="success">APPROVED</Badge>;
      case "FULFILLED":
        return <Badge variant="success">FULFILLED</Badge>;
      case "REJECTED":
        return <Badge variant="danger">REJECTED</Badge>;
      case "CANCELLED":
        return <Badge variant="neutral">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
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
      case "LOW":
      default:
        return <Badge variant="neutral">LOW</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Asset Requisitions"
        description="Employee equipment requests, multi-level approvals, and automated inventory fulfillment."
        icon={ClipboardList}
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Requisitions" },
        ]}
        actions={
          (user?.isCommonAdmin || hasPermission("requests:create")) ? (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateOpen(true)}
            >
              New Requisition
            </Button>
          ) : undefined
        }
      />

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search request #, item name, employee..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="PARTIALLY_APPROVED">Partially Approved</option>
            <option value="APPROVED">Approved</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-2xs focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-subtle">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-sm">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
            <p className="font-semibold">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={fetchRequests}
            >
              Try Again
            </Button>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={ClipboardList}
              title="No requisitions found"
              description="Submit a new equipment request to initiate the approval workflow."
              actionLabel="New Requisition"
              onAction={() => setIsCreateOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Request #</th>
                  <th className="px-4 py-3">Requested Item</th>
                  <th className="px-4 py-3">Employee & Dept</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-center">Priority</th>
                  <th className="px-4 py-3">Needed By</th>
                  <th className="px-4 py-3 text-center">Approval Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-teal-600">
                      <Link href={`/requests/${req.id}`} className="hover:underline">
                        {req.request_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {req.item_name || req.stock_code || "Equipment Requisition"}
                      </div>
                      {req.stock_code && (
                        <div className="text-[11px] text-teal-600 font-mono">
                          Stock: {req.stock_code}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {req.employee_first_name} {req.employee_last_name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {req.department_name || req.employee_code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900 font-mono">
                      {req.quantity}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderPriorityBadge(req.priority)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">
                      {req.required_by_date
                        ? new Date(req.required_by_date).toLocaleDateString()
                        : "Immediate"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderStatusBadge(req.status, req.current_approval_level)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/requests/${req.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs font-medium text-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Track</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, total)} of {total} requisitions
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Previous
            </button>
            <button
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* New Requisition Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Submit New Asset Requisition"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {createError}
            </div>
          )}

          {/* Toggle between stock catalog and custom item */}
          <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, requestSource: "STOCK" })}
              className={`flex-1 py-1.5 rounded-md text-center font-medium transition-all ${
                formData.requestSource === "STOCK"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Select from Stock Catalog
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, requestSource: "CUSTOM" })}
              className={`flex-1 py-1.5 rounded-md text-center font-medium transition-all ${
                formData.requestSource === "CUSTOM"
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Custom / Fixed Asset Request
            </button>
          </div>

          {formData.requestSource === "STOCK" ? (
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Stock Item <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={formData.stockItemId}
                onChange={(e) => setFormData({ ...formData, stockItemId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="">Select stock SKU...</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.stock_code} — {item.item_name} ({item.unit})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Item Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ergonomic Cutting Table Station"
                  value={formData.itemName}
                  onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e: any) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Required By</label>
              <input
                type="date"
                value={formData.requiredByDate}
                onChange={(e) => setFormData({ ...formData, requiredByDate: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Department</label>
            <select
              value={formData.departmentId}
              onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 shadow-2xs focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="">User&apos;s Primary Department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Business Justification <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="State the operational reason, work station requirement, or project mandate..."
              value={formData.justification}
              onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none shadow-2xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={createSubmitting}
            >
              Save Draft Requisition
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

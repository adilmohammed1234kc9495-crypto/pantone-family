"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Layers,
  Plus,
  Search,
  Filter,
  Edit,
  Power,
  AlertCircle,
  Building2,
  GitBranch,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface DepartmentItem {
  id: string;
  branch_id: string;
  branch_code: string;
  branch_name: string;
  company_id: string;
  company_name: string;
  code: string;
  name: string;
  is_active: boolean;
  assets_count: number;
  created_at: string;
}

interface BranchOption {
  id: string;
  code: string;
  name: string;
  company_id: string;
  company_name?: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function DepartmentsPage() {
  const { hasPermission, user } = useAuth();

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editDepartment, setEditDepartment] = useState<DepartmentItem | null>(null);
  const [toggleDepartment, setToggleDepartment] = useState<DepartmentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    branchId: "",
    code: "",
    name: "",
  });

  const canManage = user?.isCommonAdmin || hasPermission("branches:manage") || hasPermission("companies:manage");

  const loadCompaniesAndBranches = useCallback(async () => {
    try {
      if (user?.isCommonAdmin) {
        const compRes = await apiClient.get<any>("/companies");
        if (compRes) {
          setCompanies(compRes.companies || compRes.data?.companies || (Array.isArray(compRes) ? compRes : []));
        }
      }

      const branchParams = new URLSearchParams();
      branchParams.set("limit", "100");
      if (companyFilter) branchParams.set("companyId", companyFilter);
      const branchRes = await apiClient.get<any>(`/branches?${branchParams.toString()}`);
      if (branchRes) {
        setBranches(branchRes.branches || branchRes.items || branchRes.data?.branches || []);
      }
    } catch {
      // Silently ignore option loading errors
    }
  }, [user?.isCommonAdmin, companyFilter]);

  const loadDepartments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");
      if (companyFilter) params.set("companyId", companyFilter);
      if (branchFilter) params.set("branchId", branchFilter);

      const res = await apiClient.get<any>(`/departments?${params.toString()}`);
      if (res) {
        setDepartments(res.departments || res.items || res.data?.departments || []);
        setTotal(res.total ?? res.data?.total ?? 0);
        setTotalPages(res.totalPages ?? res.data?.totalPages ?? 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load departments");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, companyFilter, branchFilter]);

  useEffect(() => {
    loadCompaniesAndBranches();
  }, [loadCompaniesAndBranches]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const handleOpenCreate = () => {
    setFormData({
      branchId: branches[0]?.id || "",
      code: "",
      name: "",
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (dept: DepartmentItem) => {
    setEditDepartment(dept);
    setFormData({
      branchId: dept.branch_id,
      code: dept.code,
      name: dept.name,
    });
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branchId) {
      setFormError("Branch selection is required.");
      return;
    }
    if (!formData.code.trim() || !formData.name.trim()) {
      setFormError("Department code and name are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post("/departments", {
        branchId: formData.branchId,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
      });
      setIsCreateOpen(false);
      loadDepartments();
    } catch (err: any) {
      setFormError(err.message || "Failed to create department");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDepartment) return;
    if (!formData.name.trim()) {
      setFormError("Department name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.put(`/departments/${editDepartment.id}`, {
        name: formData.name.trim(),
        branchId: formData.branchId || undefined,
      });
      setEditDepartment(null);
      loadDepartments();
    } catch (err: any) {
      setFormError(err.message || "Failed to update department");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleDepartment) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/departments/${toggleDepartment.id}/status`, {
        isActive: !toggleDepartment.is_active,
      });
      setToggleDepartment(null);
      loadDepartments();
    } catch (err: any) {
      alert(err.message || "Failed to update department status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Department Master"
        description="Manage cost centers, production floors, and functional departments across facilities."
        icon={<Layers className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Departments" },
        ]}
        actions={
          canManage ? (
            <Button
              onClick={handleOpenCreate}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </Button>
          ) : undefined
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by code or department name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {user?.isCommonAdmin && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setBranchFilter("");
                setPage(1);
              }}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-slate-400" />
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : departments.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-800">No departments found</p>
            <p className="text-sm text-slate-500 mt-1">
              Try adjusting your search filters or create a new department.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Department Code</th>
                  <th className="px-6 py-3.5">Department Name</th>
                  <th className="px-6 py-3.5">Branch</th>
                  <th className="px-6 py-3.5">Company</th>
                  <th className="px-6 py-3.5">Assigned Assets</th>
                  <th className="px-6 py-3.5">Status</th>
                  {canManage && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-teal-700">
                      {d.code}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {d.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                        <span>{d.branch_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{d.company_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="neutral">{d.assets_count} Assets</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={d.is_active ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(d)}
                            title="Edit Department"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setToggleDepartment(d)}
                            title={d.is_active ? "Deactivate Department" : "Activate Department"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              d.is_active
                                ? "text-rose-600 hover:bg-rose-50"
                                : "text-emerald-600 hover:bg-emerald-50"
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} departments
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="px-2">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Department Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Department"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Branch *</label>
            <select
              value={formData.branchId}
              onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="">Select Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Department Code *</label>
              <input
                type="text"
                placeholder="e.g. DEP-CUTTING"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Department Name *</label>
              <input
                type="text"
                placeholder="e.g. Cutting & Pattern Division"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Department"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Department Modal */}
      <Modal
        isOpen={Boolean(editDepartment)}
        onClose={() => setEditDepartment(null)}
        title={`Edit Department: ${editDepartment?.name}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Branch</label>
            <select
              value={formData.branchId}
              onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Department Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setEditDepartment(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Toggle Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(toggleDepartment)}
        onClose={() => setToggleDepartment(null)}
        onConfirm={handleToggleStatus}
        title={toggleDepartment?.is_active ? "Deactivate Department?" : "Activate Department?"}
        message={`Are you sure you want to ${
          toggleDepartment?.is_active ? "deactivate" : "activate"
        } department "${toggleDepartment?.name}"?`}
        confirmText={toggleDepartment?.is_active ? "Deactivate" : "Activate"}
        variant={toggleDepartment?.is_active ? "danger" : "primary"}
        isLoading={isSubmitting}
      />
    </div>
  );
}

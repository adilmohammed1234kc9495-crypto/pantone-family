"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  GitBranch,
  Plus,
  Search,
  Filter,
  Edit,
  Power,
  AlertCircle,
  Building2,
  MapPin,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface BranchItem {
  id: string;
  company_id: string;
  company_name: string;
  code: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
  departments_count: number;
  locations_count: number;
  assets_count: number;
  created_at: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function BranchesPage() {
  const { hasPermission, user } = useAuth();

  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchItem | null>(null);
  const [toggleBranch, setToggleBranch] = useState<BranchItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    companyId: "",
    code: "",
    name: "",
    address: "",
    city: "",
    state: "",
  });

  const canManage = user?.isCommonAdmin || hasPermission("branches:manage");

  const loadCompanies = useCallback(async () => {
    if (user?.isCommonAdmin) {
      try {
        const res = await apiClient.get<any>("/companies");
        if (res) {
          const list = res.companies || res.data?.companies || (Array.isArray(res) ? res : []);
          setCompanies(list);
        }
      } catch {
        // Silently ignore
      }
    }
  }, [user?.isCommonAdmin]);

  const loadBranches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");
      if (companyFilter) params.set("companyId", companyFilter);

      const res = await apiClient.get<any>(`/branches?${params.toString()}`);
      if (res) {
        setBranches(res.branches || res.items || res.data?.branches || []);
        setTotal(res.total ?? res.data?.total ?? 0);
        setTotalPages(res.totalPages ?? res.data?.totalPages ?? 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load branches");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, companyFilter]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const handleOpenCreate = () => {
    setFormData({
      companyId: user?.companyId || (companies[0]?.id || ""),
      code: "",
      name: "",
      address: "",
      city: "",
      state: "",
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (branch: BranchItem) => {
    setEditBranch(branch);
    setFormData({
      companyId: branch.company_id,
      code: branch.code,
      name: branch.name,
      address: branch.address || "",
      city: branch.city || "",
      state: branch.state || "",
    });
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError("Branch code and name are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post("/branches", {
        companyId: user?.isCommonAdmin ? formData.companyId : undefined,
        code: formData.code.trim(),
        name: formData.name.trim(),
        address: formData.address.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
      });
      setIsCreateOpen(false);
      loadBranches();
    } catch (err: any) {
      setFormError(err.message || "Failed to create branch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBranch) return;
    if (!formData.name.trim()) {
      setFormError("Branch name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.put(`/branches/${editBranch.id}`, {
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
      });
      setEditBranch(null);
      loadBranches();
    } catch (err: any) {
      setFormError(err.message || "Failed to update branch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleBranch) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/branches/${toggleBranch.id}/status`, {
        isActive: !toggleBranch.is_active,
      });
      setToggleBranch(null);
      loadBranches();
    } catch (err: any) {
      alert(err.message || "Failed to update branch status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Branch Master"
        description="Manage company branches, factories, and operational plants."
        icon={<GitBranch className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Branches" },
        ]}
        actions={
          canManage ? (
            <Button
              onClick={handleOpenCreate}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Branch</span>
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
            placeholder="Search by code, branch name, or city..."
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
        ) : branches.length === 0 ? (
          <div className="p-12 text-center">
            <GitBranch className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-800">No branches found</p>
            <p className="text-sm text-slate-500 mt-1">
              Try adjusting your search criteria or add a new branch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Branch Code</th>
                  <th className="px-6 py-3.5">Branch Name</th>
                  <th className="px-6 py-3.5">Company</th>
                  <th className="px-6 py-3.5">City / State</th>
                  <th className="px-6 py-3.5">Units / Assets</th>
                  <th className="px-6 py-3.5">Status</th>
                  {canManage && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-teal-700">
                      {b.code}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{b.name}</div>
                      {b.address && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{b.address}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.company_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{[b.city, b.state].filter(Boolean).join(", ") || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="neutral">{b.departments_count} Depts</Badge>
                        <Badge variant="neutral">{b.assets_count} Assets</Badge>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={b.is_active ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(b)}
                            title="Edit Branch"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setToggleBranch(b)}
                            title={b.is_active ? "Deactivate Branch" : "Activate Branch"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              b.is_active
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
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} branches
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

      {/* Create Branch Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Branch"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {formError}
            </div>
          )}

          {user?.isCommonAdmin && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Company *</label>
              <select
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Select Company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Branch Code *</label>
              <input
                type="text"
                placeholder="e.g. BR-OKHLA"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Branch Name *</label>
              <input
                type="text"
                placeholder="e.g. Okhla Manufacturing Unit"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">City</label>
              <input
                type="text"
                placeholder="New Delhi"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">State / Province</label>
              <input
                type="text"
                placeholder="Delhi"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Street Address</label>
            <textarea
              rows={2}
              placeholder="Physical street address..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
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
              {isSubmitting ? "Creating..." : "Create Branch"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Branch Modal */}
      <Modal
        isOpen={Boolean(editBranch)}
        onClose={() => setEditBranch(null)}
        title={`Edit Branch: ${editBranch?.name}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Branch Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">State / Province</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Street Address</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setEditBranch(null)}
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
        isOpen={Boolean(toggleBranch)}
        onClose={() => setToggleBranch(null)}
        onConfirm={handleToggleStatus}
        title={toggleBranch?.is_active ? "Deactivate Branch?" : "Activate Branch?"}
        message={`Are you sure you want to ${
          toggleBranch?.is_active ? "deactivate" : "activate"
        } branch "${toggleBranch?.name}"?`}
        confirmText={toggleBranch?.is_active ? "Deactivate" : "Activate"}
        variant={toggleBranch?.is_active ? "danger" : "primary"}
        isLoading={isSubmitting}
      />
    </div>
  );
}

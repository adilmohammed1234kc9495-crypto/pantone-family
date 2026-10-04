"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  FolderTree,
  List,
  Plus,
  Search,
  Filter,
  Edit,
  Power,
  AlertCircle,
  Building2,
  ChevronRight,
  ChevronDown,
  Percent,
  Clock,
  Layers,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface CategoryItem {
  id: string;
  company_id: string;
  company_name: string;
  parent_id: string | null;
  parent_name: string | null;
  parent_code: string | null;
  code: string;
  name: string;
  description: string | null;
  depreciation_method: string;
  depreciation_rate_percent: number;
  useful_life_months: number;
  is_active: boolean;
  subcategories_count: number;
  assets_count: number;
  created_at: string;
}

interface TreeNode extends CategoryItem {
  children?: TreeNode[];
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function CategoriesPage() {
  const { hasPermission, user } = useAuth();

  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [companyFilter, setCompanyFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryItem | null>(null);
  const [toggleCategory, setToggleCategory] = useState<CategoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    companyId: "",
    parentId: "",
    code: "",
    name: "",
    description: "",
    depreciationMethod: "STRAIGHT_LINE",
    depreciationRatePercent: 20,
    usefulLifeMonths: 60,
  });

  const canManage = user?.isCommonAdmin || hasPermission("categories:manage") || hasPermission("companies:manage");

  const loadCompanies = useCallback(async () => {
    if (user?.isCommonAdmin) {
      try {
        const compRes = await apiClient.get<any>("/companies");
        if (compRes) {
          setCompanies(compRes.companies || compRes.data?.companies || (Array.isArray(compRes) ? compRes : []));
        }
      } catch {
        // Silently ignore
      }
    }
  }, [user?.isCommonAdmin]);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (viewMode === "tree") {
        const treeParams = new URLSearchParams({ tree: "true" });
        if (companyFilter) treeParams.set("companyId", companyFilter);
        const res = await apiClient.get<any>(`/categories?${treeParams.toString()}`);
        const tree = Array.isArray(res) ? res : res.data || [];
        setTreeData(tree);
      } else {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        params.set("limit", limit.toString());
        if (search) params.set("search", search);
        if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");
        if (companyFilter) params.set("companyId", companyFilter);

        const res = await apiClient.get<any>(`/categories?${params.toString()}`);
        if (res) {
          setCategories(res.categories || res.items || res.data?.categories || []);
          setTotal(res.total ?? res.data?.total ?? 0);
          setTotalPages(res.totalPages ?? res.data?.totalPages ?? 1);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, [viewMode, page, limit, search, statusFilter, companyFilter]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleOpenCreate = () => {
    setFormData({
      companyId: user?.companyId || (companies[0]?.id || ""),
      parentId: "",
      code: "",
      name: "",
      description: "",
      depreciationMethod: "STRAIGHT_LINE",
      depreciationRatePercent: 20,
      usefulLifeMonths: 60,
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (cat: CategoryItem) => {
    setEditCategory(cat);
    setFormData({
      companyId: cat.company_id,
      parentId: cat.parent_id || "",
      code: cat.code,
      name: cat.name,
      description: cat.description || "",
      depreciationMethod: cat.depreciation_method || "STRAIGHT_LINE",
      depreciationRatePercent: Number(cat.depreciation_rate_percent) || 20,
      usefulLifeMonths: Number(cat.useful_life_months) || 60,
    });
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError("Category code and name are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post("/categories", {
        companyId: user?.isCommonAdmin ? formData.companyId : undefined,
        parentId: formData.parentId || null,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        depreciationMethod: formData.depreciationMethod,
        depreciationRatePercent: Number(formData.depreciationRatePercent),
        usefulLifeMonths: Number(formData.usefulLifeMonths),
      });
      setIsCreateOpen(false);
      loadCategories();
    } catch (err: any) {
      setFormError(err.message || "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory) return;
    if (!formData.name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.put(`/categories/${editCategory.id}`, {
        name: formData.name.trim(),
        parentId: formData.parentId || null,
        description: formData.description.trim() || null,
        depreciationMethod: formData.depreciationMethod,
        depreciationRatePercent: Number(formData.depreciationRatePercent),
        usefulLifeMonths: Number(formData.usefulLifeMonths),
      });
      setEditCategory(null);
      loadCategories();
    } catch (err: any) {
      setFormError(err.message || "Failed to update category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleCategory) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/categories/${toggleCategory.id}/status`, {
        isActive: !toggleCategory.is_active,
      });
      setToggleCategory(null);
      loadCategories();
    } catch (err: any) {
      alert(err.message || "Failed to update category status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Asset Categories & Hierarchy"
        description="Authoritative asset taxonomy, parent-child groupings, and standard depreciation rules."
        icon={<FolderTree className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Categories" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "list"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode("tree")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === "tree"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                Hierarchy Tree
              </button>
            </div>

            {canManage && (
              <Button
                onClick={handleOpenCreate}
                variant="primary"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
        {viewMode === "list" && (
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by code, category name, or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        )}

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

        {viewMode === "list" && (
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
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content: Tree View or List View */}
      {viewMode === "tree" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Taxonomy Hierarchy Tree</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Displays root classes and cascaded subcategory structures
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {treeData.length} Root Categories
            </span>
          </div>

          {isLoading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : treeData.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No category trees found for the selected company.
            </div>
          ) : (
            <div className="space-y-4">
              {treeData.map((node) => (
                <TreeNodeItem
                  key={node.id}
                  node={node}
                  canManage={canManage}
                  onEdit={handleOpenEdit}
                  onToggleStatus={(cat) => setToggleCategory(cat)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : categories.length === 0 ? (
            <div className="p-12 text-center">
              <FolderTree className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-base font-medium text-slate-800">No categories found</p>
              <p className="text-sm text-slate-500 mt-1">
                Try adjusting your search criteria or register a new category.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Category Code</th>
                    <th className="px-6 py-3.5">Category Name</th>
                    <th className="px-6 py-3.5">Parent Category</th>
                    <th className="px-6 py-3.5">Company</th>
                    <th className="px-6 py-3.5">Depreciation</th>
                    <th className="px-6 py-3.5">Assets</th>
                    <th className="px-6 py-3.5">Status</th>
                    {canManage && <th className="px-6 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-teal-700">
                        {cat.code}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{cat.name}</div>
                        {cat.description && (
                          <div className="text-xs text-slate-400 truncate max-w-xs">{cat.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {cat.parent_name ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {cat.parent_name}
                          </span>
                        ) : (
                          <span className="text-xs text-teal-700 font-semibold uppercase bg-teal-50 px-2 py-0.5 rounded">
                            Root Class
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cat.company_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-700 font-medium">
                          {cat.depreciation_method.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {cat.useful_life_months}m ({(cat.useful_life_months / 12).toFixed(1)}y)
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Percent className="w-3 h-3 text-slate-400" />
                            {cat.depreciation_rate_percent}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="neutral">{cat.assets_count} Assets</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={cat.is_active ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(cat)}
                              title="Edit Category"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setToggleCategory(cat)}
                              title={cat.is_active ? "Deactivate Category" : "Activate Category"}
                              className={`p-1.5 rounded-lg transition-colors ${
                                cat.is_active
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
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} categories
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
      )}

      {/* Create Category Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Asset Category"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
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

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Parent Category (Optional - leave empty for Root class)
            </label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- No Parent (Root Category) --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Category Code *</label>
              <input
                type="text"
                placeholder="e.g. CAT-TEXTILE-SEW"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Category Name *</label>
              <input
                type="text"
                placeholder="e.g. Industrial Sewing Machines"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Scope, specifications, and asset classification criteria..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold uppercase text-slate-700 tracking-wider">
              Default Depreciation Schedule
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Method *</label>
                <select
                  value={formData.depreciationMethod}
                  onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="STRAIGHT_LINE">Straight Line (SLM)</option>
                  <option value="WRITTEN_DOWN_VALUE">Written Down Value (WDV)</option>
                  <option value="UNITS_OF_PRODUCTION">Units of Production</option>
                  <option value="SUM_OF_YEARS_DIGITS">Sum of Years Digits</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Useful Life (Months) *</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={formData.usefulLifeMonths}
                  onChange={(e) => setFormData({ ...formData, usefulLifeMonths: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Annual Rate (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={formData.depreciationRatePercent}
                  onChange={(e) => setFormData({ ...formData, depreciationRatePercent: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
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
              {isSubmitting ? "Creating..." : "Create Category"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={Boolean(editCategory)}
        onClose={() => setEditCategory(null)}
        title={`Edit Category: ${editCategory?.name}`}
        maxWidth="xl"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Category Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              Parent Category (Leave empty for Root class)
            </label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">-- No Parent (Root Category) --</option>
              {categories
                .filter((c) => c.id !== editCategory?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold uppercase text-slate-700 tracking-wider">
              Default Depreciation Schedule
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Method *</label>
                <select
                  value={formData.depreciationMethod}
                  onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="STRAIGHT_LINE">Straight Line (SLM)</option>
                  <option value="WRITTEN_DOWN_VALUE">Written Down Value (WDV)</option>
                  <option value="UNITS_OF_PRODUCTION">Units of Production</option>
                  <option value="SUM_OF_YEARS_DIGITS">Sum of Years Digits</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Useful Life (Months) *</label>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={formData.usefulLifeMonths}
                  onChange={(e) => setFormData({ ...formData, usefulLifeMonths: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Annual Rate (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={formData.depreciationRatePercent}
                  onChange={(e) => setFormData({ ...formData, depreciationRatePercent: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setEditCategory(null)}
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
        isOpen={Boolean(toggleCategory)}
        onClose={() => setToggleCategory(null)}
        onConfirm={handleToggleStatus}
        title={toggleCategory?.is_active ? "Deactivate Category?" : "Activate Category?"}
        message={`Are you sure you want to ${
          toggleCategory?.is_active ? "deactivate" : "activate"
        } category "${toggleCategory?.name}"?`}
        confirmText={toggleCategory?.is_active ? "Deactivate" : "Activate"}
        variant={toggleCategory?.is_active ? "danger" : "primary"}
        isLoading={isSubmitting}
      />
    </div>
  );
}

// Tree Node Item Component for visual hierarchy
function TreeNodeItem({
  node,
  canManage,
  onEdit,
  onToggleStatus,
  level = 0,
}: {
  node: TreeNode;
  canManage: boolean;
  onEdit: (cat: CategoryItem) => void;
  onToggleStatus: (cat: CategoryItem) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={`space-y-2 ${level > 0 ? "ml-6 pl-4 border-l-2 border-slate-200" : ""}`}>
      <div className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {hasChildren ? (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-teal-700">{node.code}</span>
              <span className="font-semibold text-sm text-slate-900 truncate">{node.name}</span>
              <StatusBadge status={node.is_active ? "ACTIVE" : "INACTIVE"} />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span>{node.depreciation_method.replace(/_/g, " ")}</span>
              <span>•</span>
              <span>{node.useful_life_months}m useful life</span>
              <span>•</span>
              <span>{node.depreciation_rate_percent}% rate</span>
              <span>•</span>
              <span className="font-medium text-slate-700">{node.assets_count || 0} Assets</span>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onEdit(node)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
              title="Edit Category"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggleStatus(node)}
              className={`p-1.5 rounded-lg transition-colors ${
                node.is_active ? "text-rose-600 hover:bg-white" : "text-emerald-600 hover:bg-white"
              }`}
              title={node.is_active ? "Deactivate" : "Activate"}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="space-y-2 mt-2">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              canManage={canManage}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

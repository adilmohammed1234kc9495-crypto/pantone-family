"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Building2,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Edit,
  Power,
  AlertCircle,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface CompanyItem {
  id: string;
  code: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  branch_count: number;
  department_count: number;
  user_count: number;
  asset_count: number;
  created_at: string;
  updated_at: string;
}

export default function CompaniesPage() {
  const { hasPermission, user } = useAuth();

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name" | "code" | "created_at">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status Toggle Modal state
  const [statusDialogCompany, setStatusDialogCompany] = useState<CompanyItem | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Edit Modal state
  const [editCompany, setEditCompany] = useState<CompanyItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", taxId: "", phone: "", email: "", address: "" });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const canManage = user?.isCommonAdmin || hasPermission("companies:manage");

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: statusFilter,
        sortBy,
        sortOrder,
      });

      if (search.trim()) {
        queryParams.set("search", search.trim());
      }

      const res = await apiClient<{
        companies: CompanyItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/companies?${queryParams.toString()}`);

      setCompanies(res.companies);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || "Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, sortBy, sortOrder, search]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleStatusToggleConfirm = async () => {
    if (!statusDialogCompany) return;
    setIsTogglingStatus(true);
    try {
      const targetState = !statusDialogCompany.is_active;
      await apiClient(`/companies/${statusDialogCompany.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: targetState }),
      });
      setStatusDialogCompany(null);
      await fetchCompanies();
    } catch (err: any) {
      alert(err?.message || "Failed to update company status");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleEditClick = (company: CompanyItem) => {
    setEditCompany(company);
    setEditForm({
      name: company.name,
      taxId: company.tax_id || "",
      phone: company.phone || "",
      email: company.email || "",
      address: company.address || "",
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompany) return;

    if (!editForm.name.trim()) {
      setEditError("Company name is required.");
      return;
    }

    setIsUpdating(true);
    setEditError(null);
    try {
      await apiClient(`/companies/${editCompany.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name.trim(),
          taxId: editForm.taxId.trim() || null,
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          address: editForm.address.trim() || null,
        }),
      });
      setEditCompany(null);
      await fetchCompanies();
    } catch (err: any) {
      setEditError(err?.message || "Failed to update company");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Company Management"
        description="Enterprise boundary registry for Pantone Apparels, Pantone Garments, and subsidiaries."
        icon={<Building2 className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Companies" },
        ]}
        actions={
          canManage ? (
            <Link href="/companies/new">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4" />
                <span>Create Company</span>
              </Button>
            </Link>
          ) : undefined
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-rose-700">{error}</div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{companies.length}</strong> of{" "}
            <strong className="text-slate-800">{total}</strong>
          </div>
        </div>
      </div>

      {/* Companies Table */}
      {isLoading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Company Code</th>
                  <th className="px-6 py-3.5">Company Name</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-center">Branches</th>
                  <th className="px-4 py-3.5 text-center">Users</th>
                  <th className="px-4 py-3.5 text-center">Assets</th>
                  <th className="px-6 py-3.5">Created At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      No companies match the selected search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  companies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        {c.code}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        {c.email && (
                          <div className="text-xs text-slate-400">{c.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={c.is_active} />
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-slate-700">
                        {c.branch_count}
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-slate-700">
                        {c.user_count}
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-slate-700">
                        {c.asset_count}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/companies/${c.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                            title="View Company Details"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          {canManage && (
                            <>
                              <button
                                onClick={() => handleEditClick(c)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Edit Company Details"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setStatusDialogCompany(c)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  c.is_active
                                    ? "text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                                    : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                                }`}
                                title={c.is_active ? "Deactivate Company" : "Activate Company"}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activation / Deactivation Confirmation Dialog */}
      {statusDialogCompany && (
        <ConfirmationDialog
          isOpen={!!statusDialogCompany}
          onClose={() => setStatusDialogCompany(null)}
          onConfirm={handleStatusToggleConfirm}
          isLoading={isTogglingStatus}
          title={statusDialogCompany.is_active ? "Deactivate Company Account" : "Reactivate Company Account"}
          variant={statusDialogCompany.is_active ? "danger" : "primary"}
          confirmText={statusDialogCompany.is_active ? "Deactivate Company" : "Reactivate Company"}
          message={
            statusDialogCompany.is_active
              ? `Are you sure you want to deactivate '${statusDialogCompany.name}' (${statusDialogCompany.code})? Ordinary company users will be blocked from logging into the portal. Existing data will NOT be deleted.`
              : `Are you sure you want to reactivate '${statusDialogCompany.name}' (${statusDialogCompany.code})? Company users will regain normal operational access to their workspace.`
          }
        />
      )}

      {/* Edit Company Modal */}
      {editCompany && (
        <Modal
          isOpen={!!editCompany}
          onClose={() => setEditCompany(null)}
          title={`Edit Company: ${editCompany.code}`}
          maxWidth="lg"
          footer={
            <>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setEditCompany(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-company-form"
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </>
          }
        >
          <form id="edit-company-form" onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {editError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Company Code (Immutable)
              </label>
              <input
                type="text"
                disabled
                value={editCompany.code}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Tax / GST ID
                </label>
                <input
                  type="text"
                  value={editForm.taxId}
                  onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Physical Office Address
              </label>
              <textarea
                rows={2}
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Truck,
  Plus,
  Search,
  Filter,
  Edit,
  Power,
  AlertCircle,
  Building2,
  Star,
  Mail,
  Phone,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface VendorItem {
  id: string;
  company_id: string;
  company_name: string;
  code: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_number: string | null;
  rating: number | null;
  is_active: boolean;
  assets_count: number;
  created_at: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function VendorsPage() {
  const { hasPermission, user } = useAuth();

  const [vendors, setVendors] = useState<VendorItem[]>([]);
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
  const [editVendor, setEditVendor] = useState<VendorItem | null>(null);
  const [toggleVendor, setToggleVendor] = useState<VendorItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form inputs
  const [formData, setFormData] = useState({
    companyId: "",
    code: "",
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    taxNumber: "",
    rating: 5,
  });

  const canManage = user?.isCommonAdmin || hasPermission("vendors:manage") || hasPermission("companies:manage");

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

  const loadVendors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");
      if (companyFilter) params.set("companyId", companyFilter);

      const res = await apiClient.get<any>(`/vendors?${params.toString()}`);
      if (res) {
        setVendors(res.vendors || res.items || res.data?.vendors || []);
        setTotal(res.total ?? res.data?.total ?? 0);
        setTotalPages(res.totalPages ?? res.data?.totalPages ?? 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load vendors");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter, companyFilter]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const handleOpenCreate = () => {
    setFormData({
      companyId: user?.companyId || (companies[0]?.id || ""),
      code: "",
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      taxNumber: "",
      rating: 5,
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (v: VendorItem) => {
    setEditVendor(v);
    setFormData({
      companyId: v.company_id,
      code: v.code,
      name: v.name,
      contactPerson: v.contact_person || "",
      email: v.email || "",
      phone: v.phone || "",
      address: v.address || "",
      taxNumber: v.tax_number || "",
      rating: v.rating ?? 5,
    });
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError("Vendor code and name are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.post("/vendors", {
        companyId: user?.isCommonAdmin ? formData.companyId : undefined,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        taxNumber: formData.taxNumber.trim() || undefined,
        rating: Number(formData.rating) || 5,
      });
      setIsCreateOpen(false);
      loadVendors();
    } catch (err: any) {
      setFormError(err.message || "Failed to create vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendor) return;
    if (!formData.name.trim()) {
      setFormError("Vendor name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiClient.put(`/vendors/${editVendor.id}`, {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim() || null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        taxNumber: formData.taxNumber.trim() || null,
        rating: Number(formData.rating) || null,
      });
      setEditVendor(null);
      loadVendors();
    } catch (err: any) {
      setFormError(err.message || "Failed to update vendor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleVendor) return;
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/vendors/${toggleVendor.id}/status`, {
        isActive: !toggleVendor.is_active,
      });
      setToggleVendor(null);
      loadVendors();
    } catch (err: any) {
      alert(err.message || "Failed to update vendor status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Vendor Master"
        description="Maintain authoritative records of manufacturers, suppliers, and service providers."
        icon={<Truck className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Vendors" },
        ]}
        actions={
          canManage ? (
            <Button
              onClick={handleOpenCreate}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vendor</span>
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
            placeholder="Search by vendor name, code, contact person, or tax ID..."
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
        ) : vendors.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-base font-medium text-slate-800">No vendors found</p>
            <p className="text-sm text-slate-500 mt-1">
              Try adjusting your search criteria or register a new vendor.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Vendor Code</th>
                  <th className="px-6 py-3.5">Vendor Name</th>
                  <th className="px-6 py-3.5">Contact Details</th>
                  <th className="px-6 py-3.5">Tax / GST</th>
                  <th className="px-6 py-3.5">Rating</th>
                  <th className="px-6 py-3.5">Assets</th>
                  <th className="px-6 py-3.5">Status</th>
                  {canManage && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-teal-700">
                      {v.code}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{v.name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{v.company_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {v.contact_person && (
                        <div className="text-slate-800 font-medium text-xs">{v.contact_person}</div>
                      )}
                      <div className="text-xs text-slate-500 flex flex-col gap-0.5 mt-0.5">
                        {v.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {v.email}
                          </span>
                        )}
                        {v.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {v.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                      {v.tax_number || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-amber-500 font-medium text-xs">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{v.rating ?? 5}/5</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="neutral">{v.assets_count} Assets</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={v.is_active ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(v)}
                            title="Edit Vendor"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setToggleVendor(v)}
                            title={v.is_active ? "Deactivate Vendor" : "Activate Vendor"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              v.is_active
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
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} vendors
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

      {/* Create Vendor Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Vendor"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Vendor Code *</label>
              <input
                type="text"
                placeholder="e.g. VND-JUKI"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Vendor Name *</label>
              <input
                type="text"
                placeholder="e.g. Juki Machinery Corporation"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Michael Chen"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Tax / GST Number</label>
              <input
                type="text"
                placeholder="e.g. GSTIN07AAACJ2938Q1Z5"
                value={formData.taxNumber}
                onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Email</label>
              <input
                type="email"
                placeholder="sales@juki.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Phone</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-center">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Address</label>
              <input
                type="text"
                placeholder="Supplier warehouse or corporate address..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Vendor Rating (1-5)</label>
              <select
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value={5}>5 Stars - Premium</option>
                <option value={4}>4 Stars - High Quality</option>
                <option value={3}>3 Stars - Standard</option>
                <option value={2}>2 Stars - Subpar</option>
                <option value={1}>1 Star - Warning</option>
              </select>
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
              {isSubmitting ? "Creating..." : "Create Vendor"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Vendor Modal */}
      <Modal
        isOpen={Boolean(editVendor)}
        onClose={() => setEditVendor(null)}
        title={`Edit Vendor: ${editVendor?.name}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Vendor Name *</label>
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
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Tax / GST Number</label>
              <input
                type="text"
                value={formData.taxNumber}
                onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 items-center">
            <div className="col-span-2">
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Vendor Rating (1-5)</label>
              <select
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value={5}>5 Stars - Premium</option>
                <option value={4}>4 Stars - High Quality</option>
                <option value={3}>3 Stars - Standard</option>
                <option value={2}>2 Stars - Subpar</option>
                <option value={1}>1 Star - Warning</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setEditVendor(null)}
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
        isOpen={Boolean(toggleVendor)}
        onClose={() => setToggleVendor(null)}
        onConfirm={handleToggleStatus}
        title={toggleVendor?.is_active ? "Deactivate Vendor?" : "Activate Vendor?"}
        message={`Are you sure you want to ${
          toggleVendor?.is_active ? "deactivate" : "activate"
        } vendor "${toggleVendor?.name}"?`}
        confirmText={toggleVendor?.is_active ? "Deactivate" : "Activate"}
        variant={toggleVendor?.is_active ? "danger" : "primary"}
        isLoading={isSubmitting}
      />
    </div>
  );
}

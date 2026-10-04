"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Building2,
  ArrowLeft,
  Users,
  Box,
  MapPin,
  FolderTree,
  GitBranch,
  Activity,
  Calendar,
  Phone,
  Mail,
  FileText,
  Power,
  Edit,
  AlertCircle,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface CompanyDetails {
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
  location_count: number;
  user_count: number;
  asset_count: number;
  created_at: string;
  updated_at: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, hasPermission } = useAuth();

  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "branches" | "departments" | "locations" | "assets" | "activity">("overview");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle state
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", taxId: "", phone: "", email: "", address: "" });
  const [isUpdating, setIsUpdating] = useState(false);

  const canManage = user?.isCommonAdmin || hasPermission("companies:manage");

  const fetchCompanyDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient<CompanyDetails>(`/companies/${id}`);
      setCompany(res);
      setEditForm({
        name: res.name,
        taxId: res.tax_id || "",
        phone: res.phone || "",
        email: res.email || "",
        address: res.address || "",
      });

      // Fetch company activity
      const act = await apiClient<any[]>(`/companies/${id}/activity`);
      setActivity(act);

      // Fetch users in this company
      const usrRes = await apiClient<{ users: any[] }>(`/users?companyId=${id}&limit=20`);
      setCompanyUsers(usrRes.users || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load company details");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCompanyDetails();
  }, [fetchCompanyDetails]);

  const handleStatusToggle = async () => {
    if (!company) return;
    setIsTogglingStatus(true);
    try {
      const updated = await apiClient<CompanyDetails>(`/companies/${company.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !company.is_active }),
      });
      setCompany(updated);
      setIsStatusDialogOpen(false);
      // Re-fetch activity
      const act = await apiClient<any[]>(`/companies/${id}/activity`);
      setActivity(act);
    } catch (err: any) {
      alert(err?.message || "Failed to toggle company status");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setIsUpdating(true);
    try {
      const updated = await apiClient<CompanyDetails>(`/companies/${company.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name.trim(),
          taxId: editForm.taxId.trim() || null,
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          address: editForm.address.trim() || null,
        }),
      });
      setCompany(updated);
      setIsEditModalOpen(false);
      // Re-fetch activity
      const act = await apiClient<any[]>(`/companies/${id}/activity`);
      setActivity(act);
    } catch (err: any) {
      alert(err?.message || "Failed to update company");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Company Not Available</h2>
        <p className="text-sm text-slate-500 mt-1">{error || "The requested company does not exist."}</p>
        <Link
          href="/companies"
          className="inline-block mt-4 px-4 py-2 text-sm font-semibold text-teal-600 hover:text-teal-700"
        >
          &larr; Back to Companies
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={company.name}
        description={`Registered entity ID: ${company.id}`}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Companies", href: "/companies" },
          { label: company.code },
        ]}
        icon={
          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
            {company.code}
          </span>
        }
        badge={<StatusBadge status={company.is_active} />}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsEditModalOpen(true)}
                variant="outline"
                size="sm"
              >
                <Edit className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Details</span>
              </Button>

              <Button
                onClick={() => setIsStatusDialogOpen(true)}
                variant={company.is_active ? "destructive" : "secondary"}
                size="sm"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{company.is_active ? "Deactivate" : "Activate"}</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{company.branch_count}</div>
            <div className="text-xs text-slate-500 font-medium">Branches</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{company.department_count}</div>
            <div className="text-xs text-slate-500 font-medium">Departments</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{company.location_count || 0}</div>
            <div className="text-xs text-slate-500 font-medium">Locations</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{company.user_count}</div>
            <div className="text-xs text-slate-500 font-medium">Users</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{company.asset_count}</div>
            <div className="text-xs text-slate-500 font-medium">Fixed Assets</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 overflow-x-auto text-sm font-medium">
          {[
            { key: "overview", label: "Overview" },
            { key: "users", label: `Users (${company.user_count})` },
            { key: "branches", label: `Branches (${company.branch_count})` },
            { key: "departments", label: `Departments (${company.department_count})` },
            { key: "locations", label: `Locations (${company.location_count || 0})` },
            { key: "assets", label: `Assets (${company.asset_count})` },
            { key: "activity", label: `Activity (${activity.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-3 px-1 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "border-teal-600 text-teal-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-900">Entity Details & Tax Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3 text-slate-600">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500 w-32 font-medium">Tax / GST ID:</span>
                <span className="font-mono text-slate-900">{company.tax_id || "None Registered"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500 w-32 font-medium">Phone:</span>
                <span className="text-slate-900">{company.phone || "Not specified"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500 w-32 font-medium">Corporate Email:</span>
                <span className="text-slate-900">{company.email || "Not specified"}</span>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-500 w-32 font-medium">Address:</span>
                <span className="text-slate-900">{company.address || "Not specified"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500 w-32 font-medium">Created On:</span>
                <span className="text-slate-900">{new Date(company.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-500 w-32 font-medium">Last Updated:</span>
                <span className="text-slate-900">{new Date(company.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Authorized Personnel</h2>
            <Link href="/users" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
              Manage in User Registry &rarr;
            </Link>
          </div>
          {companyUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No users currently assigned to this company.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Username</th>
                    <th className="px-6 py-3.5">Email</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companyUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 font-semibold text-slate-900">{u.username}</td>
                      <td className="px-6 py-4 text-slate-500">{u.email}</td>
                      <td className="px-4 py-4">
                        <Badge variant="neutral">{u.role_name || u.role_code}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={u.is_active} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Branches, Departments, Locations, Assets Placeholders for Future Phase Modules */}
      {["branches", "departments", "locations", "assets"].includes(activeTab) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FolderTree className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 capitalize">
            {activeTab} Management Module
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            This operational module is scheduled for implementation in subsequent phases (Phase 4: Asset Inventory & Organization Hierarchy). Database tables and foreign keys are seeded and ready.
          </p>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Company Audit Trail</h2>
            <p className="text-xs text-slate-500">Immutable ledger of administrative actions for this company</p>
          </div>
          {activity.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No audit logs recorded for this company yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Entity</th>
                    <th className="px-6 py-3">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {activity.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-3.5 text-slate-500">
                        {new Date(a.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-slate-800">{a.action}</td>
                      <td className="px-6 py-3.5 text-slate-600">{a.entity}</td>
                      <td className="px-6 py-3.5 text-slate-600">
                        {a.actor_username || "System Administrator"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Status Change */}
      <ConfirmationDialog
        isOpen={isStatusDialogOpen}
        onClose={() => setIsStatusDialogOpen(false)}
        onConfirm={handleStatusToggle}
        isLoading={isTogglingStatus}
        title={company.is_active ? "Deactivate Company" : "Activate Company"}
        variant={company.is_active ? "danger" : "primary"}
        confirmText={company.is_active ? "Deactivate" : "Activate"}
        message={
          company.is_active
            ? `Are you sure you want to deactivate '${company.name}'? Ordinary company users will be prevented from logging in. All records remain preserved.`
            : `Are you sure you want to reactivate '${company.name}'? Company users will regain operational access.`
        }
      />

      {/* Edit Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit ${company.name}`}
          maxWidth="lg"
          footer={
            <>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-detail-form"
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50"
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </>
          }
        >
          <form id="edit-detail-form" onSubmit={handleEditSubmit} className="space-y-4">
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
                Office Address
              </label>
              <textarea
                rows={3}
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

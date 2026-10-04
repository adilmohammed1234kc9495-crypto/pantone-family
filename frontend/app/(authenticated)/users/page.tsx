"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Users,
  Search,
  Filter,
  Plus,
  Power,
  Edit,
  Shield,
  Building2,
  AlertCircle,
  Key,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

interface UserItem {
  id: string;
  company_id: string | null;
  company_code: string | null;
  company_name: string | null;
  username: string;
  email: string;
  role_id: string;
  role_code: string;
  role_name: string;
  employee_id: string | null;
  employee_code: string | null;
  employee_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RoleItem {
  id: string;
  code: string;
  name: string;
  is_system_role: boolean;
  company_id: string | null;
}

export default function UsersPage() {
  const { user, hasPermission, availableCompanies } = useAuth();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create User Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    roleId: "",
    companyId: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const canManage = user?.isCommonAdmin || hasPermission("users:manage");

  // Fetch available roles
  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiClient<RoleItem[]>("/roles");
      setRoles(res);
      if (res.length > 0 && !createForm.roleId) {
        setCreateForm((f) => ({ ...f, roleId: res[0].id }));
      }
    } catch {
      // Ignore
    }
  }, [createForm.roleId]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        status: statusFilter,
      });

      if (search.trim()) params.set("search", search.trim());
      if (companyFilter !== "all") params.set("companyId", companyFilter);
      if (roleFilter !== "all") params.set("roleId", roleFilter);

      const res = await apiClient<{
        users: UserItem[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(`/users?${params.toString()}`);

      setUsers(res.users);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, companyFilter, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  const handleToggleUserStatus = async (targetUser: UserItem) => {
    try {
      const targetState = !targetUser.is_active;
      await apiClient(`/users/${targetUser.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: targetState }),
      });
      await fetchUsers();
    } catch (err: any) {
      alert(err?.message || "Failed to update user status");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.password) {
      setCreateError("Please fill out all required fields.");
      return;
    }

    if (createForm.password.length < 8) {
      setCreateError("Password must be at least 8 characters long.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      await apiClient("/users", {
        method: "POST",
        body: JSON.stringify({
          username: createForm.username.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          roleId: createForm.roleId,
          companyId: createForm.companyId || null,
        }),
      });

      setIsCreateModalOpen(false);
      setCreateForm({
        username: "",
        email: "",
        password: "",
        roleId: roles[0]?.id || "",
        companyId: "",
      });
      await fetchUsers();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={user?.isCommonAdmin ? "Global User Registry" : "Company User Directory"}
        description="Access control and administrative credentials management across tenant organizations."
        icon={<Users className="w-5 h-5 text-teal-600" />}
        breadcrumbs={[
          { label: "Settings" },
          { label: "Users" },
        ]}
        actions={
          canManage ? (
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              variant="primary"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create User</span>
            </Button>
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
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by username, email, name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Company Filter (for Common Admin) */}
          {user?.isCommonAdmin && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">All Companies</option>
                <option value="null">Global (Common Admin)</option>
                {availableCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-slate-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
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

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong className="text-slate-800">{users.length}</strong> of{" "}
          <strong className="text-slate-800">{total}</strong>
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">User Identity</th>
                  <th className="px-6 py-3.5">Company Tenancy</th>
                  <th className="px-4 py-3.5">Assigned Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Last Login</th>
                  <th className="px-6 py-3.5">Created At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No users match the specified search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{u.username}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                        {u.employee_name && (
                          <div className="text-[11px] text-teal-600 font-medium mt-0.5">
                            Linked: {u.employee_name} ({u.employee_code})
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.company_id ? (
                          <div>
                            <div className="font-medium text-slate-800">{u.company_name}</div>
                            <span className="font-mono text-xs text-slate-400">{u.company_code}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            Common Admin Authority
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={u.role_code === "COMMON_ADMIN" ? "brand" : "neutral"}>
                          {u.role_name || u.role_code}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={u.is_active} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
                          : "Never"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canManage && (
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.is_active
                                ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={u.is_active ? "Deactivate User" : "Activate User"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        )}
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

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Provision New User Account"
          maxWidth="md"
          footer={
            <>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-user-form"
                disabled={isCreating}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 shadow-sm"
              >
                {isCreating ? "Provisioning..." : "Create User"}
              </button>
            </>
          }
        >
          <form id="create-user-form" onSubmit={handleCreateSubmit} className="space-y-4">
            {createError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {createError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="e.g. rajesh_kumar"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="e.g. rajesh@pantone-apparels.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Initial Password * (min 8 chars)
              </label>
              <input
                type="password"
                required
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                Assigned Role *
              </label>
              <select
                required
                value={createForm.roleId}
                onChange={(e) => setCreateForm({ ...createForm, roleId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            {user?.isCommonAdmin && (
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Company Assignment
                </label>
                <select
                  value={createForm.companyId}
                  onChange={(e) => setCreateForm({ ...createForm, companyId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">No Company (Common Admin Authority)</option>
                  {availableCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

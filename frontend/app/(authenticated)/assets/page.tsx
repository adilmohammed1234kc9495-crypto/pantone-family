"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api";
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  AlertCircle,
  Building2,
  GitBranch,
  DollarSign,
  TrendingDown,
  CheckCircle2,
  FolderTree,
  RotateCcw,
  Printer,
  ChevronRight,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";

interface AssetItem {
  id: string;
  company_id: string;
  company_name: string;
  branch_id: string;
  branch_name: string;
  department_id: string | null;
  department_name: string | null;
  location_id: string | null;
  location_name: string | null;
  category_id: string;
  category_name: string;
  category_code: string;
  vendor_id: string | null;
  vendor_name: string | null;
  asset_tag: string;
  name: string;
  description: string | null;
  serial_number: string | null;
  model_number: string | null;
  purchase_date: string;
  purchase_cost: number;
  currency: string;
  salvage_value: number;
  status: string;
  condition: string;
  depreciation_method: string;
  depreciation_rate_percent: number;
  useful_life_months: number;
  depreciation_start_date: string;
  accumulated_depreciation: number;
  current_book_value: number;
  created_at: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

export default function AssetsPage() {
  const { hasPermission, user } = useAuth();

  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [conditionFilter, setConditionFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canCreate = user?.isCommonAdmin || hasPermission("assets:create");

  const loadDropdowns = useCallback(async () => {
    try {
      if (user?.isCommonAdmin) {
        const compRes = await apiClient.get<any>("/companies");
        if (compRes) {
          setCompanies(
            compRes.companies ||
              compRes.data?.companies ||
              (Array.isArray(compRes) ? compRes : [])
          );
        }
      }

      const branchParams = new URLSearchParams({ limit: "100" });
      if (companyFilter) branchParams.set("companyId", companyFilter);
      const branchRes = await apiClient.get<any>(
        `/branches?${branchParams.toString()}`
      );
      if (branchRes) {
        setBranches(
          branchRes.branches ||
            branchRes.items ||
            branchRes.data?.branches ||
            []
        );
      }

      const catParams = new URLSearchParams({ limit: "100" });
      if (companyFilter) catParams.set("companyId", companyFilter);
      const catRes = await apiClient.get<any>(
        `/categories?${catParams.toString()}`
      );
      if (catRes) {
        setCategories(
          catRes.categories ||
            catRes.items ||
            catRes.data?.categories ||
            []
        );
      }
    } catch {
      // Silently ignore
    }
  }, [user?.isCommonAdmin, companyFilter]);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (search) params.set("search", search);
      if (companyFilter) params.set("companyId", companyFilter);
      if (branchFilter) params.set("branchId", branchFilter);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (conditionFilter) params.set("condition", conditionFilter);

      const res = await apiClient.get<any>(`/assets?${params.toString()}`);
      if (res) {
        setAssets(res.assets || res.items || res.data?.assets || []);
        setTotal(res.total ?? res.data?.total ?? 0);
        setTotalPages(res.totalPages ?? res.data?.totalPages ?? 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load assets");
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    limit,
    search,
    companyFilter,
    branchFilter,
    categoryFilter,
    statusFilter,
    conditionFilter,
  ]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const resetFilters = () => {
    setSearch("");
    setCompanyFilter("");
    setBranchFilter("");
    setCategoryFilter("");
    setStatusFilter("");
    setConditionFilter("");
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(companyFilter) ||
    Boolean(branchFilter) ||
    Boolean(categoryFilter) ||
    Boolean(statusFilter) ||
    Boolean(conditionFilter);

  // Aggregate metrics from current view
  const totalCost = assets.reduce(
    (sum, a) => sum + (Number(a.purchase_cost) || 0),
    0
  );
  const totalBookValue = assets.reduce(
    (sum, a) => sum + (Number(a.current_book_value) || 0),
    0
  );
  const activeCount = assets.filter(
    (a) => a.status === "IN_SERVICE" || a.status === "REGISTERED"
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Asset Register"
        description="Fixed Asset Master Catalog across facilities, plants, branches, and departments."
        icon={<Package className="w-6 h-6 text-teal-600" />}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/assets/labels">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                Print Labels
              </Button>
            </Link>
            {canCreate && (
              <Link href="/assets/new">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Register Asset
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Assets
              </span>
              <Package className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {total}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Cataloged records</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Active / In-Service
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {activeCount}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">On current page view</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Acquisition Cost
              </span>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                ${totalCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Historical cost (page)</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4 sm:p-5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Net Book Value
              </span>
              <TrendingDown className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                ${totalBookValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Current depreciated value</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by asset tag, name, or serial number..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-white border border-slate-300/80 rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {user?.isCommonAdmin && (
              <div className="flex items-center gap-1.5 min-w-[160px]">
                <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <select
                  value={companyFilter}
                  onChange={(e) => {
                    setCompanyFilter(e.target.value);
                    setBranchFilter("");
                    setPage(1);
                  }}
                  className="w-full bg-white border border-slate-300/80 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
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

            <div className="flex items-center gap-1.5 min-w-[160px]">
              <GitBranch className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                value={branchFilter}
                onChange={(e) => {
                  setBranchFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-white border border-slate-300/80 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300/80 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300/80 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">All Statuses</option>
                  <option value="REGISTERED">Registered</option>
                  <option value="IN_SERVICE">In Service</option>
                  <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                  <option value="IDLE">Idle</option>
                  <option value="TRANSFERRED">Transferred</option>
                  <option value="DISPOSED">Disposed</option>
                  <option value="WRITTEN_OFF">Written Off</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={conditionFilter}
                  onChange={(e) => {
                    setConditionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300/80 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">All Conditions</option>
                  <option value="NEW">New</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair</option>
                  <option value="POOR">Poor</option>
                  <option value="SCRAP">Scrap</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Error state */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200/80 text-rose-800 flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <Card>
        {isLoading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : assets.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8 text-slate-400" />}
            title="No fixed assets found"
            description={
              hasActiveFilters
                ? "No assets match your active filter criteria. Try clearing filters."
                : "No fixed assets are cataloged in this repository yet."
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Clear Filters
                </Button>
              ) : canCreate ? (
                <Link href="/assets/new">
                  <Button variant="primary" size="sm">
                    Register First Asset
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Asset Tag</th>
                  <th className="px-4 py-3">Asset Name & Identification</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Branch & Location</th>
                  <th className="px-4 py-3 text-right">Valuation (Book / Cost)</th>
                  <th className="px-4 py-3">Status & Condition</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                        {asset.asset_tag}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900 leading-tight">
                        {asset.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {asset.serial_number ? `SN: ${asset.serial_number}` : ""}
                        {asset.model_number ? ` • Model: ${asset.model_number}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant="neutral">{asset.category_name}</Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-slate-800 font-medium">
                        {asset.branch_name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {[asset.department_name, asset.location_name]
                          .filter(Boolean)
                          .join(" • ") || "-"}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {asset.company_name}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono">
                      <div className="font-semibold text-slate-900 tabular-nums">
                        $
                        {Number(asset.current_book_value || 0).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                        Cost: $
                        {Number(asset.purchase_cost || 0).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={asset.status} />
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          {asset.condition}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/assets/${asset.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-teal-700 font-medium text-xs transition-colors shadow-2xs"
                        title="View Asset Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>
              Showing{" "}
              <strong className="font-medium text-slate-700">
                {(page - 1) * limit + 1}
              </strong>{" "}
              to{" "}
              <strong className="font-medium text-slate-700">
                {Math.min(page * limit, total)}
              </strong>{" "}
              of <strong className="font-medium text-slate-700">{total}</strong>{" "}
              assets
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="px-2 text-slate-600 font-medium">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

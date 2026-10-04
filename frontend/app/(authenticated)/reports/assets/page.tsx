"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { PackageCheck, ArrowLeft, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";

export default function AssetRegisterReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({
    page: "1",
    limit: "20",
  });

  const filterConfig: ReportFilterConfig = {
    searchPlaceholder: "Search asset tag, name, serial...",
    showStatus: true,
    statuses: [
      { value: "AVAILABLE", label: "Available" },
      { value: "ASSIGNED", label: "Assigned" },
      { value: "UNDER_MAINTENANCE", label: "Under Maintenance" },
      { value: "DAMAGED", label: "Damaged" },
      { value: "IN_TRANSIT", label: "In Transit" },
      { value: "DISPUTED", label: "Disputed" },
      { value: "RETIRED", label: "Retired" },
    ],
    showDepreciationStatus: true,
    depreciationStatuses: [
      { value: "DEPRECIATING", label: "Active Depreciating" },
      { value: "FULLY_DEPRECIATED", label: "Fully Depreciated" },
    ],
    showDateRange: true,
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getAssetRegister(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load asset register report");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const currentPage = Number(filters.page || 1);
  const limit = Number(filters.limit || 20);
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Fixed Asset Register Report"
        description="Complete inventory register with capital acquisition costs, net book values, locations, and custodians."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Asset Register" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Matched Assets</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{summary.totalAssets?.toLocaleString() ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Gross Acquisition Cost</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
              ${(summary.totalGrossValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Current Net Book Value</span>
            <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">
              ${(summary.totalBookValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Accumulated Depreciation</span>
            <span className="text-xl font-bold font-mono text-amber-700 mt-0.5 block">
              ${(summary.totalAccumulatedDepreciation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="assets"
        config={filterConfig}
        filters={filters}
        onFilterChange={setFilters}
        totalRecords={total}
        isLoading={loading}
      />

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3.5 font-semibold">Asset Tag</th>
                <th className="py-2.5 px-3.5 font-semibold">Name & Category</th>
                <th className="py-2.5 px-3.5 font-semibold">Company / Branch</th>
                <th className="py-2.5 px-3.5 font-semibold">Department / Location</th>
                <th className="py-2.5 px-3.5 font-semibold text-right">Purchase Cost</th>
                <th className="py-2.5 px-3.5 font-semibold text-right">Book Value</th>
                <th className="py-2.5 px-3.5 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3.5 font-semibold">Custodian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading asset register...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No asset records found matching current criteria.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono font-medium text-teal-700 whitespace-nowrap">
                      {item.asset_tag}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.category_name || "Uncategorized"}</div>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      <div>{item.company_name}</div>
                      <div className="text-[11px] text-slate-400">{item.branch_name || "—"}</div>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      <div>{item.department_name || "—"}</div>
                      <div className="text-[11px] text-slate-400">{item.location_name || "—"}</div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono text-slate-800">
                      ${Number(item.purchase_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-teal-700">
                      ${Number(item.current_book_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">
                      {item.custodian_name ? (
                        <div>
                          <span className="font-medium text-slate-900">{item.custodian_name}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {item.custodian_code}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200/90 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1 || loading}
                onClick={() => setFilters({ ...filters, page: String(currentPage - 1) })}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages || loading}
                onClick={() => setFilters({ ...filters, page: String(currentPage + 1) })}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

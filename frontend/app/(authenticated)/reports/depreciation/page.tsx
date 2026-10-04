"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { DollarSign, ArrowLeft, AlertCircle, TrendingDown, Clock, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default function DepreciationReportPage() {
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
    searchPlaceholder: "Search asset...",
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
      const res = await reportsApi.getDepreciation(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load depreciation report");
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
        title="Straight-Line Depreciation & Valuation Report"
        description="Authoritative financial amortization calculations, monthly write-offs, and carrying book values."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Depreciation" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Gross Asset Value</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
              ${(summary.grossAssetValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Net Book Value</span>
            <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">
              ${(summary.totalNetBookValue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Accumulated Dep.</span>
            <span className="text-xl font-bold font-mono text-amber-700 mt-0.5 block">
              ${(summary.totalAccumulatedDepreciation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Monthly Amortization</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
              ${(summary.totalMonthlyDepreciation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Annual Amortization</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
              ${(summary.totalAnnualDepreciation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Depreciation Counts</span>
            <div className="text-xs mt-1 space-y-0.5">
              <span className="text-emerald-700 font-medium block">
                Active: {summary.activeDepreciatingCount ?? 0}
              </span>
              <span className="text-slate-500 font-medium block">
                Fully Dep.: {summary.fullyDepreciatedCount ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="depreciation"
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
                <th className="py-2.5 px-3 font-semibold">Asset Tag</th>
                <th className="py-2.5 px-3 font-semibold">Name & Category</th>
                <th className="py-2.5 px-3 font-semibold">Company</th>
                <th className="py-2.5 px-3 font-semibold text-right">Purchase Cost</th>
                <th className="py-2.5 px-3 font-semibold text-center">Life</th>
                <th className="py-2.5 px-3 font-semibold text-right">Monthly Dep.</th>
                <th className="py-2.5 px-3 font-semibold text-right">Annual Dep.</th>
                <th className="py-2.5 px-3 font-semibold text-right">Accumulated Dep.</th>
                <th className="py-2.5 px-3 font-semibold text-right">Net Book Value</th>
                <th className="py-2.5 px-3 font-semibold text-center">Remaining</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    Computing straight-line depreciation amortization...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No depreciation records found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-teal-700 whitespace-nowrap">
                      {item.asset_tag}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.category_name || "Uncategorized"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{item.company_name}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                      ${Number(item.purchase_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {item.useful_life_months} mo
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                      ${Number(item.monthly_depreciation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                      ${Number(item.annual_depreciation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                      ${Number(item.accumulated_depreciation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-teal-700">
                      ${Number(item.current_book_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {item.remaining_useful_life_months !== undefined
                        ? `${item.remaining_useful_life_months} mo`
                        : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded ${
                          item.depreciation_status === "FULLY_DEPRECIATED"
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {item.depreciation_status === "FULLY_DEPRECIATED" ? "Fully Depreciated" : "Depreciating"}
                      </span>
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

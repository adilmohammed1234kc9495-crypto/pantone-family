"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { Boxes, ArrowLeft, AlertCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function StockReportPage() {
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
    searchPlaceholder: "Search stock code, item name...",
    showStatus: true,
    statuses: [
      { value: "IN_STOCK", label: "In Stock" },
      { value: "LOW_STOCK", label: "Low Stock" },
      { value: "OUT_OF_STOCK", label: "Out of Stock" },
    ],
    showLowStockOnly: true,
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getStock(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load stock inventory report");
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
        title="Stock Inventory & Consumables Report"
        description="Stock item balances, valuation, reorder threshold alerts, and warehouse distribution."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Stock Inventory" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Catalog Items</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{summary.totalItems ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">In Stock Items</span>
            <span className="text-xl font-bold font-mono text-emerald-700 mt-0.5 block">{summary.inStockCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Low Stock Items</span>
            <span className="text-xl font-bold font-mono text-amber-700 mt-0.5 block">{summary.lowStockCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Out of Stock</span>
            <span className="text-xl font-bold font-mono text-rose-700 mt-0.5 block">{summary.outOfStockCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Stock Valuation</span>
            <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">
              ${(summary.totalValuation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="stock"
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
                <th className="py-2.5 px-3 font-semibold">Stock Code</th>
                <th className="py-2.5 px-3 font-semibold">Item Name & Category</th>
                <th className="py-2.5 px-3 font-semibold">Company / Branch</th>
                <th className="py-2.5 px-3 font-semibold text-center">Unit</th>
                <th className="py-2.5 px-3 font-semibold text-right">Qty on Hand</th>
                <th className="py-2.5 px-3 font-semibold text-right">Reorder Level</th>
                <th className="py-2.5 px-3 font-semibold text-right">Unit Cost</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total Valuation</th>
                <th className="py-2.5 px-3 font-semibold text-center">Stock State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Loading inventory records...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No stock items found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-medium text-teal-700 whitespace-nowrap">
                      {item.stock_code}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{item.item_name}</div>
                      <div className="text-[11px] text-slate-500">{item.category_name || "General"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{item.company_name}</div>
                      <div className="text-[11px] text-slate-400">{item.branch_name || "—"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                      {item.unit || "PIECE"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {item.quantity_on_hand}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {item.reorder_level}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      ${Number(item.unit_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-teal-700">
                      ${Number(item.total_valuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${
                          item.stock_status === "OUT_OF_STOCK"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : item.stock_status === "LOW_STOCK"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {item.stock_status?.replace(/_/g, " ")}
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

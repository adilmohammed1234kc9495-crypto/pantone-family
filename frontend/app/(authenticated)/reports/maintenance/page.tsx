"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { Wrench, ArrowLeft, AlertCircle, DollarSign, Clock, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default function MaintenanceReportPage() {
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
    searchPlaceholder: "Search work order, code, asset...",
    showPriority: true,
    priorities: [
      { value: "LOW", label: "Low Priority" },
      { value: "MEDIUM", label: "Medium Priority" },
      { value: "HIGH", label: "High Priority" },
      { value: "CRITICAL", label: "Critical Priority" },
    ],
    showStatus: true,
    statuses: [
      { value: "OPEN", label: "Open" },
      { value: "ASSIGNED", label: "Assigned" },
      { value: "IN_PROGRESS", label: "In Progress" },
      { value: "WAITING_PARTS", label: "Waiting for Parts" },
      { value: "COMPLETED", label: "Completed" },
      { value: "CLOSED", label: "Closed" },
    ],
    showDateRange: true,
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getMaintenance(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load maintenance report");
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
        title="Maintenance & Work Orders Report"
        description="Work order lifecycle tracking, vendor repairs, cost analytics, and recurring equipment downtime insights."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Maintenance & Repairs" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Work Orders</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{summary.totalWorkOrders ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Open Work Orders</span>
            <span className="text-xl font-bold font-mono text-amber-700 mt-0.5 block">{summary.openOrders ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Completed Orders</span>
            <span className="text-xl font-bold font-mono text-emerald-700 mt-0.5 block">{summary.completedOrders ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Repair Cost</span>
            <span className="text-xl font-bold font-mono text-rose-700 mt-0.5 block">
              ${(summary.totalCost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Avg Cost per Order</span>
            <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">
              ${(summary.avgCost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Repeat Maint. Assets</span>
            <span className="text-xl font-bold font-mono text-amber-700 mt-0.5 block">{summary.repeatedMaintenanceAssets ?? 0}</span>
          </div>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="maintenance"
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
                <th className="py-2.5 px-3 font-semibold">Work Order / Code</th>
                <th className="py-2.5 px-3 font-semibold">Asset Tag & Name</th>
                <th className="py-2.5 px-3 font-semibold">Company / Dept</th>
                <th className="py-2.5 px-3 font-semibold">Problem Description</th>
                <th className="py-2.5 px-3 font-semibold text-center">Priority</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Estimated Cost</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actual Cost</th>
                <th className="py-2.5 px-3 font-semibold">Vendor / Tech</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Loading maintenance records...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No maintenance records found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono text-slate-900 font-semibold">{item.work_order_number || item.maintenance_code}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.maintenance_code}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-teal-700 font-semibold">{item.asset_tag}</div>
                      <div className="text-[11px] text-slate-500">{item.asset_name}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{item.company_name}</div>
                      <div className="text-[11px] text-slate-400">{item.department_name || "—"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={item.problem}>
                      {item.problem}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${
                          item.priority === "CRITICAL"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : item.priority === "HIGH"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : item.priority === "MEDIUM"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      ${Number(item.estimated_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-700">
                      ${Number(item.actual_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{item.vendor_name || item.technician_name || "Internal Staff"}</div>
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

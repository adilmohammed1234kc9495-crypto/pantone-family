"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { ClipboardList, ArrowLeft, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default function RequestsReportPage() {
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
    searchPlaceholder: "Search request number, requester...",
    showPriority: true,
    priorities: [
      { value: "LOW", label: "Low Priority" },
      { value: "MEDIUM", label: "Medium Priority" },
      { value: "HIGH", label: "High Priority" },
      { value: "URGENT", label: "Urgent Priority" },
    ],
    showStatus: true,
    statuses: [
      { value: "PENDING_APPROVAL", label: "Pending Approval" },
      { value: "APPROVED", label: "Approved" },
      { value: "REJECTED", label: "Rejected" },
      { value: "FULFILLED", label: "Fulfilled" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
    showDateRange: true,
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getRequests(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load requests report");
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
        title="Asset Requisitions & Multi-Level Approvals Report"
        description="Historical overview of procurement requisitions, multi-tier approval states, and fulfillment tracking."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Requisitions & Approvals" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Requests</span>
            <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">{summary.totalRequests ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Pending</span>
            <span className="text-xl font-bold font-mono text-amber-700 mt-0.5 block">{summary.pendingCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Approved</span>
            <span className="text-xl font-bold font-mono text-emerald-700 mt-0.5 block">{summary.approvedCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Fulfilled</span>
            <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">{summary.fulfilledCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Rejected</span>
            <span className="text-xl font-bold font-mono text-rose-700 mt-0.5 block">{summary.rejectedCount ?? 0}</span>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Cancelled</span>
            <span className="text-xl font-bold font-mono text-slate-600 mt-0.5 block">{summary.cancelledCount ?? 0}</span>
          </div>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="requests"
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
                <th className="py-2.5 px-3 font-semibold">Request # / Code</th>
                <th className="py-2.5 px-3 font-semibold">Requester Employee</th>
                <th className="py-2.5 px-3 font-semibold">Department & Company</th>
                <th className="py-2.5 px-3 font-semibold">Item & Justification</th>
                <th className="py-2.5 px-3 font-semibold text-center">Priority</th>
                <th className="py-2.5 px-3 font-semibold text-center">Tier</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold">Submitted Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading requisition records...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No requisition records found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono text-slate-900 font-semibold">{item.request_number || item.request_code}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.request_code}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{item.requester_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.employee_code}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>{item.company_name}</div>
                      <div className="text-[11px] text-slate-400">{item.department_name || "—"}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={item.reason || item.justification}>
                      <span className="font-medium text-slate-900 block">{item.item_name || "General Asset"}</span>
                      <span className="text-[11px] text-slate-500">{item.reason || item.justification || "No justification"}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded ${
                          item.priority === "URGENT"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : item.priority === "HIGH"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      Tier {item.current_approval_level || 1}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
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

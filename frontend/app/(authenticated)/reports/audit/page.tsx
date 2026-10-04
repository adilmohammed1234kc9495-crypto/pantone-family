"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { reportsApi } from "@/lib/api";
import { ReportFilters, ReportFilterConfig } from "@/components/reports/report-filters";
import { ShieldCheck, ArrowLeft, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function AuditReportPage() {
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
    searchPlaceholder: "Search action, entity, user...",
    showDateRange: true,
  };

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportsApi.getAudit(filters);
      setData(res.items || []);
      setTotal(res.total || 0);
      setSummary(res.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit trail report");
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
        title="Audit Trail & Security Ledger Report"
        description="Immutable event log of system operations, user activities, authentication attempts, and authorization changes."
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Audit & Security" },
        ]}
      />

      {/* Summary KPI Strip */}
      {summary && (
        <div className="bg-white border border-slate-200/90 rounded-lg p-3.5 shadow-subtle max-w-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Audited Events</span>
          <span className="text-xl font-bold font-mono text-teal-700 mt-0.5 block">
            {summary.totalAuditEvents?.toLocaleString() ?? 0}
          </span>
        </div>
      )}

      {/* Filter and Export Toolbar */}
      <ReportFilters
        reportType="audit"
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
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Actor / User</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Entity Type</th>
                <th className="py-2.5 px-3 font-semibold">Entity ID</th>
                <th className="py-2.5 px-3 font-semibold">Company</th>
                <th className="py-2.5 px-3 font-semibold">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-900 font-medium">
                      {item.actor_username || "System / Anonymous"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-slate-50 rounded text-[11px] font-mono text-teal-700 border border-slate-200">
                        {item.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 uppercase tracking-wider text-[11px]">
                      {item.entity || "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 max-w-[120px] truncate" title={item.entity_id}>
                      {item.entity_id || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{item.company_name || "Global / Core"}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{item.ip_address || "—"}</td>
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
